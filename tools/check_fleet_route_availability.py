"""Read-only проверка доступности этапов в настоящем SPA snak1.

Реальные GetAvailableMissions, без отправки/изменения игровых маршрутов.
Запуск: python3 tools/check_fleet_route_availability.py
"""
import json
from check_fleet_route_layout import RouteCheck, KEY


class AvailabilityCheck(RouteCheck):
    def target(self, coordinate):
        self.js("""
        const p=$('.FleetPlanStep:visible');
        for(const [key,label] of Object.entries({galaxy:'Галактика',system:'Система',orbit:'Орбита'}))
            p.find('input[aria-label="'+label+'"]').val(arguments[0][key]);
        p.find('input[aria-label="Орбита"]').trigger('input');
        p.find('input[aria-label="Система"]').trigger('change');
        """, coordinate)

    def check(self, name, predicate):
        assert self.js(predicate), name
        self.results.append({'name': name, 'passed': True})
        print('OK ' + name, flush=True)

    def run(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page.Name==='FleetsPageClass'&&WS.ws.readyState===1"))
        self.fleet_id = self.js('return Number(Object.keys(Page.messageData.data.Page.FleetList)[0])')
        assert self.fleet_id
        self.js("""
        window.__availabilityEmit=GameEvents.emit;window.__previews=[];window.__held=[];window.__writes=[];
        GameEvents.emit=function(name,payload,...args){
            if(name==='SendServer'&&['SetFleetCommands','SendMission'].includes(payload.action)){
                __writes.push(payload.action);throw Error('Запрещена игровая запись в read-only тесте');
            }
            if(name==='SendServer'&&payload.action==='GetAvailableMissions'&&payload.data?.forPlan){
                if(window.__failPreview&&!payload.data.planReturn){__failPreview=false;payload.onError({message:'Тестовая ошибка preview'});return;}
                const success=payload.onSuccess;
                payload.onSuccess=message=>{
                    const page=message.getData('Page');
                    const item={data:payload.data,result:page?.AvailableMissions,fuel:page?.TravelInfo?.fuel};__previews.push(item);
                    if(window.__holdPreview&&!payload.data.planReturn){__holdPreview=false;__held.push(()=>success(message));}
                    else success(message);
                };
            }
            return __availabilityEmit.call(this,name,payload,...args);
        };
        """)
        try:
            self.open()
            # События нативного select идут input → change, в отличие от старого теста trigger('change').
            self.js("""
            const s=$('.FleetPlanStep:visible select[aria-label="Своя планета"]')[0];
            const next=[...s.options].find(o=>o.value&&o.value!==s.value).value;
            s.value=next;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));
            window.__chosenPlanet=next;
            """)
            self.settled()
            self.check('native-input-change-preserves-own-planet', "return $('.FleetPlanStep:visible select[aria-label=\"Своя планета\"]').val()===__chosenPlanet")
            self.open(1440, 1000)
            option = self.js("return [...$('.FleetPlanStep:visible select[aria-label=\"Своя планета\"]')[0].options].find(o=>o.value===__chosenPlanet)")[KEY]
            self.call('/element/' + option + '/click', {})
            self.settled()
            self.check('real-native-select-click-updates-coordinates', """
                const p=$('.FleetPlanStep:visible'),id=p.find('select[aria-label="Своя планета"]').val();
                const planet=Object.values(Page.messageData.data.PlanetList.Planets).find(p=>String(p.id)===id);
                return id===__chosenPlanet&&Number(p.find('input[aria-label="Система"]').val())===Number(planet.system)
                    &&Number(p.find('input[aria-label="Орбита"]').val())===Number(planet.planet);
            """)
            self.open()
            home = self.js("""const p=$('.FleetPlanStep:visible');return {galaxy:Number(p.find('input[aria-label="Галактика"]').val()),
                system:Number(p.find('input[aria-label="Система"]').val()),orbit:Number(p.find('input[aria-label="Орбита"]').val())} """)
            self.check('own-planet-attack-disabled-transport-enabled', "return $('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=1]')[0].disabled&&!$('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=10]')[0].disabled")
            self.check('unavailable-missions-hidden', "return $('.FleetPlanStep:visible .FleetPlanMissionSelector button:visible').toArray().every(b=>__previews.filter(p=>!p.data.planReturn).at(-1).result.missions.includes(Number(b.value)))")
            self.check('zero-length-route-consumes-no-fuel', "return __previews.slice(-2).every(p=>p.fuel?.max===0)&&document.querySelector('.FleetPlanFuelNotice').dataset.level==='info'")
            self.js("""$('.FleetPlanStep:visible input[aria-label="Процент выгрузки"]').val(37.5).trigger('input')""")
            payload = self.capture()  # Перехвачено до игрового WS, как в layout-тесте.
            assert payload['plan']['steps'][0]['percent'] == 38, payload
            self.check('integer-percent-input-and-range', """return $('.FleetPlanStep:visible input[aria-label="Процент выгрузки"]').attr('step')==='1'&&$('.FleetPlanStep:visible input[aria-label="Доля оставшегося груза"]').attr('step')==='1'""")

            # Известная тестовая чужая планета; raw ответ дополнительно подтверждает наличие цели.
            foreign = {'galaxy': 1, 'system': 7, 'orbit': 2}
            self.target(foreign)
            self.settled()
            self.check('foreign-planet-attack-enabled-relocate-disabled', "return !$('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=1]')[0].disabled&&$('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=11]')[0].disabled")
            self.js("$('#FleetPlanFuel').val(0).trigger('input')")
            self.check('fuel-warning-includes-return', "return __previews.some(p=>p.data.planReturn&&p.data.origin?.system===7&&p.fuel?.max>0)&&document.querySelector('.FleetPlanFuelNotice').dataset.level==='warning'")
            self.check('fuel-sum-is-outbound-plus-return-once', """
                const out=__previews.filter(p=>!p.data.planReturn).at(-1).fuel,back=__previews.filter(p=>p.data.planReturn).at(-1).fuel;
                const min=out.min+back.min,max=out.max+back.max;
                const text='Маршрут ≈ '+humanNumber(Math.ceil(min),true,2)+(max!==min?'–'+humanNumber(Math.ceil(max),true,2):'');
                return document.querySelector('.FleetPlanFuelNotice strong').textContent.includes(text);
            """)
            self.check('fuel-warning-does-not-forbid-valid-route', "return !document.querySelector('.FleetPlanSubmit').disabled")
            self.js("window.__fastFuel=__previews.filter(p=>!p.data.planReturn).at(-1).fuel.max;$('.FleetPlanStep:visible input[aria-label=\"Скорость полёта\"]').val(10).trigger('input')")
            self.settled()
            self.check('speed-recalculates-fuel-preview', "return __previews.filter(p=>!p.data.planReturn).at(-1).fuel.max<__fastFuel")
            self.js("$('.FleetPlanStep:visible input[aria-label=\"Скорость полёта\"]').val(100).trigger('input')")
            self.settled()
            self.js("$('#FleetPlanFuel').val(1e9).trigger('input')")
            self.check('fuel-warning-recalculates-after-loading', "return !document.querySelector('.FleetPlanFuelNotice').textContent.includes('Топливо: 0 ·')")
            self.check('all-regular-missions-match-authoritative-response', """
                const a=__previews.filter(p=>!p.data.planReturn).at(-1).result;return !a.disabled&&[...$('.FleetPlanStep:visible .FleetPlanMissionSelector button')]
                    .filter(b=>![30,40].includes(Number(b.value))).every(b=>b.disabled===!a.missions.includes(Number(b.value)));
            """)
            self.js("$('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=1]')[0].click()")
            self.target(home)
            self.settled()
            self.check('selected-mission-becomes-unavailable-submit-blocked', "return document.querySelector('.FleetPlanSubmit').disabled&&$('.FleetPlanStep:visible [role=status]').text().includes('недоступна')")
            self.check('unavailable-plan-cannot-be-submitted', "return __writes.length===0")
            self.js("$('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=10]')[0].click()")
            self.settled()
            self.check('valid-mission-recovers-without-reopening', "return !document.querySelector('.FleetPlanSubmit').disabled")

            # Запоздавший ответ не должен вернуть доступность атаки после выбора своей планеты.
            self.js('window.__holdPreview=true')
            self.target(foreign)
            self.wait(lambda: self.js('return __held.length===1'))
            self.check('submit-disabled-while-preview-pending', "return document.querySelector('.FleetPlanSubmit').disabled")
            self.target(home)
            self.settled()
            self.js('__held.shift()()')
            self.check('stale-response-ignored', "return $('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=1]')[0].disabled&&!document.querySelector('.FleetPlanSubmit').disabled")

            self.js('window.__failPreview=true')
            self.target(foreign)
            self.settled()
            self.check('preview-failure-keeps-submit-disabled', "return document.querySelector('.FleetPlanSubmit').disabled&&$('.FleetPlanStep:visible [role=status]').text().includes('Тестовая ошибка')")
            self.target(home)
            self.settled()
            self.check('preview-recovers-on-new-target', "return !document.querySelector('.FleetPlanSubmit').disabled")

            self.target(foreign)
            self.settled()
            self.js('document.querySelector(".FleetPlanAdd").click()')
            self.settled()
            self.check('next-stage-origin-is-previous-target', "return __previews.filter(p=>!p.data.planReturn).at(-1).data.origin?.system===7&&__previews.filter(p=>!p.data.planReturn).at(-1).data.origin?.orbit===2")
            self.js("$('.FleetPlanSteps button').first()[0].click()")
            self.target(home)
            self.settled()
            self.check('previous-target-change-revalidates-following-stage', "return __previews.filter(p=>p.data.origin&&!p.data.planReturn).at(-1).data.origin.system===" + str(home['system']))
            self.check('all-route-legs-have-server-fuel-estimate', "return __previews.some(p=>p.data.planReturn&&Number.isFinite(p.fuel?.max))")
            self.check('three-stage-valid-route-remains-submittable', "return !document.querySelector('.FleetPlanSubmit').disabled")
            self.shot('390-route-real-availability')
            # В snak1 нет луны: только UI fixture, аккаунт и серверные объекты не меняются.
            self.js("""
                const planets=Page.messageData.data.PlanetList.Planets,home=Page.messageData.data.Page.FleetList[arguments[0]].current;
                const moon={id:99999,name:'UI Moon',galaxy:home.galaxy,system:home.system,planet:home.orbit,planet_type:3};
                if(Array.isArray(planets))planets.push(moon);else planets['ui-moon']=moon;
            """, self.fleet_id)
            self.open()
            self.js("""
                const s=$('.FleetPlanStep:visible select[aria-label="Своя планета"]')[0];
                s.value='99999';s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));
            """)
            self.settled()
            self.check('moon-native-selection-preserves-object-type-ui-fixture', "return $('.FleetPlanStep:visible select[aria-label=\"Своя планета\"]').val()==='99999'&&Number($('.FleetPlanStep:visible .FleetObjectTypeSelector')[0].value)===3")
            self.check('all-request-callbacks-finished-no-gameplay-writes', "return WS.requestCallbacks.size===0&&__writes.length===0")
            self.out.joinpath('availability-results.json').write_text(json.dumps(self.results, ensure_ascii=False, indent=2))
            print(json.dumps({'passed': len(self.results), 'artifacts': str(self.out), 'gameCommandsSent': 0}, ensure_ascii=False))
        finally:
            self.js('GameEvents.emit=__availabilityEmit;Dialog.close()')
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
            self.call('/refresh', {})


if __name__ == '__main__':
    AvailabilityCheck().run()
