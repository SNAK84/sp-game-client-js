"""Проверка редактора маршрута в существующей Selenium-сессии snak1.

Запуск: python3 tools/check_fleet_route_layout.py
Игровые команды НЕ отправляются: submit перехватывается до WebSocket.
Временные UI fixtures не изменяют сервер; после проверки страница обновляется.
"""
import json
import time
from check_fleet_mission_layout import Check, KEY


class RouteCheck(Check):
    def settled(self):
        self.wait(lambda: self.js("return WS.requestCallbacks.size===0 && !document.querySelector('.FleetPlanStep[aria-busy=\"true\"]')"))

    def open(self, width=390, height=844):
        self.js("Dialog.close()")
        self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')"))
        self.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
            'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 700}})
        self.js('Page.showFleetPlan(arguments[0])', self.fleet_id)
        self.settled()
        time.sleep(.1)

    def geometry(self, name):
        result = self.js("""
        const d=Dialog.dialogDiv,c=d.querySelector('dialog-content'),r=d.getBoundingClientRect();
        const buttons=[...d.querySelector('dialog-buttons').children].map(b=>b.getBoundingClientRect().toJSON());
        return {name:arguments[0],width:innerWidth,height:innerHeight,dialog:r.toJSON(),overflow:c.scrollWidth-c.clientWidth,
            selectedPanels:$('.FleetPlanStep:visible').length,buttons};
        """, name)
        r = result['dialog']
        assert r['left'] >= 0 and r['right'] <= result['width'] + 1, result
        assert r['top'] >= 0 and r['bottom'] <= result['height'] + 1, result
        assert result['overflow'] == 0 and result['selectedPanels'] <= 1, result
        for button in result['buttons']:
            assert r['left'] <= button['left'] < button['right'] <= r['right'] + 1, result
            assert r['top'] <= button['top'] < button['bottom'] <= result['height'] + 1, result
        self.results.append(result)
        print('OK ' + name, flush=True)

    def capture(self):
        # Проверяем настоящую кнопку и serializer, не ставим тестовую миссию в очередь.
        return self.js("""
        let result=null;const emit=GameEvents.emit;
        GameEvents.emit=function(name,payload,...args){
            if(name==='SendServer'&&payload.action==='SetFleetCommands'){
                result=JSON.parse(JSON.stringify(payload.data));
                payload.onError?.({message:'Проверка интерфейса без отправки'});return;
            }return emit.call(this,name,payload,...args);
        };
        try{document.querySelector('.FleetPlanSubmit').click();return result;}
        finally{GameEvents.emit=emit;}
        """)

    def run(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined' && !!Page?.Name && WS.ws.readyState===1 && WS.requestCallbacks.size===0"))
        self.js("GameEvents.emit('SendServer',{mode:'fleets',NotOverlay:true})")
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page.Name==='FleetsPageClass'&&WS.ws.readyState===1"))
        self.fleet_id = self.js('return Number(Object.keys(Page.messageData.data.Page.FleetList)[0])')
        assert self.fleet_id, 'Нужен тестовый флот у планеты'
        self.js("""
        window.__routeErrors=[];window.__routeActions=[];
        window.__routeError=e=>__routeErrors.push(e.message||String(e.reason));
        addEventListener('error',__routeError);addEventListener('unhandledrejection',__routeError);
        window.__routeSocket=WS.ws;window.__routeSend=WS.ws.send;
        WS.ws.send=function(raw){const m=JSON.parse(raw);__routeActions.push(m.action);return __routeSend.call(this,raw);};
        """)
        try:
            for width, height in [(1440, 1000), (1024, 768), (768, 1024), (600, 800),
                                  (480, 800), (390, 844), (360, 740), (320, 568), (844, 390)]:
                self.open(width, height)
                for kind in [1, 2, 3]:
                    self.js("$('.FleetPlanStep:visible .FleetCoordinateTypeSelector button[value=\"'+arguments[0]+'\"]')[0].click()", kind)
                    self.settled()
                    self.geometry(str(width) + 'x' + str(height) + '-target-' + str(kind))
                self.js('document.querySelector(".FleetPlanLoadButton").click()')
                self.geometry(str(width) + 'x' + str(height) + '-load')
                if width in [1440, 390, 320]:
                    self.shot(str(width) + '-route-load')

            self.open()
            self.js("""
            const own=$('.FleetPlanStep:visible select[aria-label="Своя планета"]');
            own.val([...own[0].options].find(o=>o.value&&o.value!==own.val()).value).trigger('change');
            """)
            self.settled()
            payload = self.capture()
            assert payload and payload['plan']['steps'][0]['coordinates']['type'] == 1, payload
            assert 'lastKnownPosition' not in json.dumps(payload), payload
            own = self.js("""return Number($('.FleetPlanStep:visible select[aria-label="Своя планета"]').val())""")
            assert own, 'Своя планета не синхронизирована с координатами'
            self.js("""$('.FleetPlanStep:visible input[aria-label="Орбита"]').val(1).trigger('input')""")
            assert self.js("""return $('.FleetPlanStep:visible select[aria-label="Своя планета"]').val()""") == ''
            self.results.append({'name': 'own-planet-coordinate-sync', 'passed': True})

            # Далее только serializer/layout fixtures: правила миссий проверяются отдельно с настоящим сервером.
            self.js("""
            window.__routeEmit=GameEvents.emit;
            GameEvents.emit=function(name,payload,...args){
                if(name==='SendServer'&&payload.action==='GetAvailableMissions'&&payload.data?.forPlan){
                    payload.onSuccess({getData:()=>({AvailableMissions:{missions:[1,3,5,7,10,11,12,15,20,30,40],disabled:false,messages:[]}})});return;
                }return __routeEmit.call(this,name,payload,...args);
            };
            """)
            self.open()
            for object_type in [3, 2, 1]:
                self.js("$('.FleetPlanStep:visible .FleetObjectTypeSelector button[value=\"'+arguments[0]+'\"]')[0].click()", object_type)
                self.settled()
                payload = self.capture()
                assert payload['plan']['steps'][0]['coordinates']['objectType'] == object_type, payload
            self.results.append({'name': 'planet-moon-debris-object-type-contract', 'passed': True})
            speed = self.js("""return $('.FleetPlanStep:visible input[aria-label="Скорость полёта"]')[0]""")[KEY]
            for key, expected in [("\ue011", 1), ("\ue010", 10)]:
                self.call('/element/' + speed + '/value', {'text': key})
                self.settled()
                payload = self.capture()
                assert payload['plan']['steps'][0]['speedFactor'] == expected, payload
            self.results.append({'name': 'route-speed-keyboard-min-max', 'passed': True})

            self.open()
            self.js('document.querySelector(".FleetPlanLoadButton").click()')
            self.js("$('#FleetPlanFuel').val(1000).trigger('input');document.querySelector('#FleetPlanResource901').closest('.FleetResRow').querySelector('.btn-box-right').click()")
            budget = self.js("return {fuel:Number($('#FleetPlanFuel').val()),metal:Number($('#FleetPlanResource901').val()),capacity:Page.messageData.data.Page.FleetList[arguments[0]].capacity}", self.fleet_id)
            assert budget['fuel'] + budget['metal'] == budget['capacity'], budget
            self.js("$('#FleetPlanFuel').val(1e12).trigger('input')")
            assert self.js("return [901,902,903].every(id=>Number($('#FleetPlanResource'+id).val())===0)")
            self.js("$('#FleetPlanFuel').val(-1).trigger('input')")
            assert self.js("return Number($('#FleetPlanFuel').val())") == 0
            self.js("document.querySelector('.FleetAllResBtn').click()")
            assert self.js("return [901,902,903].reduce((s,id)=>s+Number($('#FleetPlanResource'+id).val()),0)") == budget['capacity']
            saved_stock = self.js('return Object.fromEntries([901,902,903].map(id=>[id,Data.Resources[id].count]))')
            try:
                self.js("""
                Data.Resources[901].count=12;Data.Resources[902].count=7;Data.Resources[903].count=20;
                $('#FleetPlanFuel').val(10).trigger('input');document.querySelector('.FleetAllResBtn').click();
                """)
                assert self.js("return [901,902,903].map(id=>Number($('#FleetPlanResource'+id).val()))") == [12, 7, 10]
            finally:
                self.js('for(const [id,count] of Object.entries(arguments[0]))Data.Resources[id].count=count;', saved_stock)
            self.results.append({'name': 'cargo-fuel-capacity-planet-stock-max-clear', 'passed': True})

            self.open()
            self.js("""$('.FleetPlanStep:visible input[aria-label="Процент выгрузки"]').val(37.5).trigger('input');$('.FleetPlanStep:visible input[aria-label="Скорость полёта"]').val(60).trigger('input');document.querySelector('.FleetPlanAdd').click()""")
            self.settled()
            self.js("""$('.FleetPlanStep:visible input[aria-label="Процент выгрузки"]').val(25).trigger('input');$('.FleetPlanStep:visible button[aria-label="Этап выше"]')[0].click()""")
            self.settled()
            payload = self.capture()
            assert [s.get('percent') for s in payload['plan']['steps']] == [25, 38, None], payload
            assert payload['plan']['steps'][1]['speedFactor'] == 6, payload
            self.js("""$('.FleetPlanSteps button').last()[0].click();$('.FleetPlanStep:visible button[aria-label="Этап выше"]')[0].click()""")
            assert self.capture() is None, 'Возврат в середине маршрута прошёл клиентскую проверку'
            self.results.append({'name': 'reorder-preserves-percent-speed-and-terminal-validation', 'passed': True})

            self.open()
            self.js('for(let i=0;i<15;i++)document.querySelector(".FleetPlanAdd").click()')
            self.settled()
            assert self.js('return document.querySelectorAll(".FleetPlanStep").length===12&&document.querySelector(".FleetPlanAdd").disabled')
            payload = self.capture()
            assert len(payload['plan']['steps']) == 12 and payload['plan']['steps'][-1]['kind'] == 'return', payload
            self.geometry('390-twelve-stages')
            self.shot('390-route-twelve-stages')

            # Подключаем существующие возможности только как UI fixture, без игровых команд.
            self.js('Page.messageData.data.Page.FleetCapabilities.hold=true')
            self.open()
            for mission in [1, 3, 5, 7, 10, 12, 15, 30, 40]:
                self.js("$('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=\"'+arguments[0]+'\"]')[0].click()", mission)
                self.settled()
                payload = self.capture()
                assert payload and payload['plan']['steps'][0]['mission'] == mission, payload
                step = payload['plan']['steps'][0]
                if mission == 40:
                    assert step['coordinates']['objectType'] is None and step['duration'] >= 3600
                elif mission == 30:
                    assert step['coordinates']['type'] == 2
                elif mission == 5:
                    assert step['duration'] > 0
                self.results.append({'name': 'mission-serializer-' + str(mission), 'passed': True})

            self.js("""
            const p=Page.messageData.data.Page,f=p.FleetList[arguments[0]];
            f.status=1;f.control.steps=[{kind:'mission',mission:10,speedFactor:3.275,percent:43,refuel:false,coordinates:f.current},{kind:'return',speedFactor:7.834}];
            p.FleetCapabilities.edit=true;
            """, self.fleet_id)
            self.open()
            assert not self.js('return !!document.querySelector(".FleetPlanLoadButton")')
            payload = self.capture()
            assert payload['plan']['fuel'] == 0 and all(v == 0 for v in payload['plan']['resources'].values()), payload
            assert payload['plan']['steps'][0]['percent'] == 43 and abs(payload['plan']['steps'][0]['speedFactor'] - 3.275) < 1e-12, payload
            assert abs(payload['plan']['steps'][1]['speedFactor'] - 7.834) < 1e-12, payload
            self.results.append({'name': 'inflight-edit-has-no-planet-loading-preserves-existing-plan', 'passed': True})
            self.geometry('390-inflight-fixture')

            expected_time = self.js("""
            const f=Page.messageData.data.Page.FleetList[arguments[0]],time=Date.now()/1000+3600.123;
            f.status=1;Page.messageData.data.Page.FleetCapabilities.edit=true;
            f.control.steps=[{kind:'mission',mission:3,speedFactor:3.275,coordinates:f.current,
                group:{id:0,executeAt:time,usernames:['ui-only-no-invite']}},{kind:'return'}];return time;
            """, self.fleet_id)
            self.open()
            payload = self.capture()
            group = payload['plan']['steps'][0]['group']
            assert group['executeAt'] == expected_time and group['usernames'] == ['ui-only-no-invite'], payload
            self.results.append({'name': 'group-time-precision-and-original-invite-options-roundtrip', 'passed': True})

            self.js("""
            const f=Page.messageData.data.Page.FleetList[arguments[0]];f.status=1;Page.messageData.data.Page.FleetCapabilities.edit=true;
            f.control.steps=[{kind:'mission',mission:10,speedFactor:10,percent:50,
                coordinates:{type:3,fleetId:98765}},{kind:'return'}];
            """, self.fleet_id)
            self.open()
            # Цель отсутствует в серверном списке: больше не создаём разрешённую fallback-option.
            assert self.capture() is None, 'Исчезнувший флот разрешён как цель'
            self.results.append({'name': 'unavailable-fleet-target-blocked', 'passed': True})
            self.js("Page.refreshFleetTargets(arguments[0],[{id:98765,name:'UI цель',is_own:true,position:{type:2,galaxy:1,system:8,distance:1500,angle:45}}])", self.fleet_id)
            self.js("$('.FleetPlanStep:visible .FleetTargetPicker select').val('98765').trigger('change')")
            self.settled()
            payload = self.capture()
            assert payload['plan']['steps'][0]['coordinates'] == {'type': 3, 'fleetId': 98765}, payload
            self.results.append({'name': 'fleet-coordinate-without-last-known-position-roundtrip', 'passed': True})
            assert self.js("return !__routeActions.includes('SetFleetCommands')&&!__routeActions.includes('SendMission')")
            errors = self.js("return __routeErrors.filter(e=>e!=='ResizeObserver loop completed with undelivered notifications.')")
            assert not errors, errors
            self.results.append({'name': 'browser-errors-and-no-gameplay-writes', 'unexpectedErrors': errors, 'gameCommandsSent': 0})
            self.out.joinpath('route-results.json').write_text(json.dumps(self.results, ensure_ascii=False, indent=2))
            print(json.dumps({'passed': len(self.results), 'artifacts': str(self.out), 'gameCommandsSent': 0}, ensure_ascii=False))
        finally:
            self.js('if(window.__routeSocket)__routeSocket.send=__routeSend;if(window.__routeEmit)GameEvents.emit=__routeEmit;removeEventListener("error",__routeError);removeEventListener("unhandledrejection",__routeError);Dialog.close();')
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
            self.call('/refresh', {})


if __name__ == '__main__':
    RouteCheck().run()
