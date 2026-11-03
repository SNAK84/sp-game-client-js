"""B011: read-only проверка редактора в открытой QA Selenium-сессии основного SPA.

python3 tools/check_fleet_resource_preview.py [--mobile]
Нужен свободный флот с редактором. Система 1:6 без ресурсных объектов,
1:7 с секторами и двумя гигантами — существующие QA-условия, не fixtures мира.
Миссии не отправляются; задерживается только доставка настоящего nav response в UI.
"""
import argparse
import json
import time
from check_fleet_route_layout import RouteCheck, KEY


class ResourcePreviewCheck(RouteCheck):
    viewport = (1365, 900)

    def click_visible(self, selector):
        item = self.js("return $('.FleetPlanStep:visible').find(arguments[0])[0]", selector)[KEY]
        self.call('/element/' + item + '/click', {})

    def field(self, name, value, change=True):
        self.js("""
            const e=$('.FleetPlanStep:visible').find('input[aria-label="'+arguments[0]+'"]')[0];
            e.focus();e.value=arguments[1];e.dispatchEvent(new Event('input',{bubbles:true}));
            if(arguments[2])e.dispatchEvent(new Event('change',{bubbles:true}));
        """, name, str(value), change)

    def check(self, name, predicate):
        result = self.js(predicate)
        assert result, name
        self.results.append({'name': name, 'passed': True})
        print('OK ' + name, flush=True)

    def valid_payloads(self):
        self.check('all-resource-coordinates-and-origins-match-server-sites', """
            return __resourcePreviews.every(p=>[p.data.coordinates,p.data.origin].every(c=>!c||c.type!==1||![4,5].includes(c.objectType)
                ||(Number.isInteger(c.siteId)&&c.siteId>0&&__resourceSites.some(s=>
                    ['siteId','galaxy','system','orbit','objectType'].every(k=>Number(s[k])===c[k])))));
        """)
        self.check('no-preview-errors', "return __resourcePreviews.every(p=>!p.error&&!p.result?.messages?.some(t=>/siteId/.test(t)))")

    def current(self):
        return self.js("""
            const p=$('.FleetPlanStep:visible'),s=p.find('select[aria-label="Ресурсный объект маршрута"]');
            return {galaxy:Number(p.find('input[aria-label="Галактика"]').val()),system:Number(p.find('input[aria-label="Система"]').val()),
                orbit:Number(p.find('input[aria-label="Орбита"]').val()),siteId:Number(s.val()),objectType:Number(p.find('.FleetObjectTypeSelector')[0].value)};
        """)

    def stage(self, index):
        self.click('.FleetPlanSteps button:nth-child(' + str(index + 1) + ')')
        self.settled()

    def run(self):
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page?.Name==='FleetsPageClass'&&WS.ws.readyState===1"))
        self.fleet_id=self.js("""
            return Object.values(Page.messageData.data.Page.FleetList||{}).find(f=>Number(f.status)===0
                &&f.actions?.SetFleetCommands!==false&&f.current?.galaxy===1&&f.current?.system===6)?.id;
        """)
        assert self.fleet_id and self.js("return Page.messageData.data.Page.FleetCapabilities?.plan"), 'Нужен QA-флот в 1:6'
        self.js("""
            window.__resourceEmit=GameEvents.emit;window.__resourcePreviews=[];window.__resourceSites=[];
            window.__resourceHeld=[];window.__resourceHoldSystem=null;window.__resourceWrites=[];window.__resourceErrors=[];
            window.__resourceError=e=>__resourceErrors.push(e.message||String(e.reason));
            addEventListener('error',__resourceError);addEventListener('unhandledrejection',__resourceError);
            GameEvents.emit=function(name,payload,...args){
                if(name==='SendServer'&&['SetFleetCommands','SendMission'].includes(payload.action)){
                    __resourceWrites.push(payload.action);throw Error('B011: игровая запись запрещена');
                }
                if(name==='SendServer'&&payload.action==='GetSystemNavigationInfo'){
                    const success=payload.onSuccess;
                    payload.onSuccess=m=>{const info=m.getData('Page')?.NavigationSystem;
                        __resourceSites.push(...(info?.resourceSites||[]));
                        if(info?.system===__resourceHoldSystem){__resourceHoldSystem=null;__resourceHeld.push(()=>success(m));}
                        else success(m);};
                }
                if(name==='SendServer'&&payload.action==='GetAvailableMissions'&&payload.data?.forPlan){
                    const entry={data:JSON.parse(JSON.stringify(payload.data))},success=payload.onSuccess,failure=payload.onError;
                    __resourcePreviews.push(entry);
                    payload.onSuccess=m=>{entry.result=m.getData('Page')?.AvailableMissions;entry.fuel=m.getData('Page')?.TravelInfo?.fuel;success?.(m);};
                    payload.onError=e=>{entry.error=e?.message||'error';failure?.(e);};
                }
                return __resourceEmit.call(this,name,payload,...args);
            };
        """)
        try:
            self.open(*self.viewport)
            self.check('ordinary-planet-preview-and-return', "return !document.querySelector('.FleetPlanSubmit').disabled&&__resourcePreviews.length>=2")
            self.click_visible('.FleetPlanModeSelector button[value="move"]')
            self.settled()
            start=self.js('return __resourcePreviews.length')
            for object_type in [5,4]:
                self.click_visible('.FleetObjectTypeSelector button[value="'+str(object_type)+'"]')
                self.settled();time.sleep(.25)
                assert self.current()['siteId']==0
                self.check('empty-resource-type-'+str(object_type)+'-blocks-submit', "return document.querySelector('.FleetPlanSubmit').disabled")
            assert self.js('return __resourcePreviews.length')==start, 'Отправлен неполный ресурсный preview'
            self.field('Система',7);self.settled()
            first=self.current()
            assert first['siteId']>0 and first['objectType']==4
            self.check('gas-giant-preview-recovers', "return !document.querySelector('.FleetPlanSubmit').disabled&&__resourcePreviews.slice(-2).every(p=>p.fuel)")
            self.js("window.__resourceSelect=$('.FleetPlanStep:visible select[aria-label=\"Ресурсный объект маршрута\"]')[0]")
            option=self.js("return [...__resourceSelect.options].find(o=>o.value!==__resourceSelect.value)")[KEY]
            self.call('/element/'+option+'/click',{});self.settled()
            second=self.current()
            assert second['siteId']!=first['siteId'] and second['orbit']!=first['orbit']
            self.check('giant-orbit-select-preserves-dom-and-focus', "return __resourceSelect===$('.FleetPlanStep:visible select[aria-label=\"Ресурсный объект маршрута\"]')[0]&&document.activeElement===__resourceSelect")
            self.click_visible('.FleetObjectTypeSelector button[value="5"]');self.settled()
            self.js("window.__resourceSelect=$('.FleetPlanStep:visible select[aria-label=\"Ресурсный объект маршрута\"]')[0]")
            option=self.js("return [...__resourceSelect.options].find(o=>o.value!==__resourceSelect.value)")[KEY]
            self.call('/element/'+option+'/click',{});self.settled()
            sector=self.current();assert sector['siteId']>0 and sector['objectType']==5
            self.valid_payloads()

            start=self.js('return __resourcePreviews.length')
            self.field('Система',6,change=False);time.sleep(.3)
            assert self.js('return __resourcePreviews.length')==start, 'Старый сектор ушёл в новую систему'
            self.check('input-before-blur-blocks-stale-sector', "return document.querySelector('.FleetPlanSubmit').disabled")
            self.field('Система',7);self.settled()

            self.click('.FleetPlanAdd');self.settled()
            self.click_visible('.FleetPlanModeSelector button[value="move"]')
            self.js("""
                const s=$('.FleetPlanStep:visible select[aria-label="Своя планета"]')[0];
                s.value=[...s.options].find(o=>o.value).value;
                s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));
            """)
            self.settled()
            self.check('next-stage-uses-complete-resource-origin', "return __resourcePreviews.some(p=>!p.data.planReturn&&p.data.origin?.objectType===5&&p.data.origin.siteId>0&&p.fuel)")
            self.stage(0)
            start=self.js('return __resourcePreviews.length;')
            self.js('window.__resourceHoldSystem=6')
            self.field('Система',6)
            self.wait(lambda:self.js('return __resourceHeld.length===1'))
            time.sleep(.3)
            assert self.js('return __resourcePreviews.length')==start, 'Preview ушёл до загрузки предыдущей системы'
            self.check('pending-system-blocks-dependent-stage', "return document.querySelector('.FleetPlanSubmit').disabled")
            self.field('Система',7);self.settled()
            before_late=self.current()
            self.js('__resourceHeld.shift()()');self.settled()
            assert self.current()==before_late, 'Поздний ответ изменил цель'
            self.check('late-navigation-response-ignored', "return !document.querySelector('.FleetPlanSubmit').disabled")

            self.field('Галактика',0)
            # После B041 ошибка навигации снимает и визуальное ожидание,
            # но не разрешает preview/submit неполной ресурсной цели.
            self.settled()
            self.check('invalid-galaxy-blocks-route', "return document.querySelector('.FleetPlanSubmit').disabled&&$('.FleetPlanStep:visible').text().includes('Система недоступна.')&&!document.querySelector('.FleetPlanFuelNotice').textContent.includes('Расчёт расхода')")
            self.field('Галактика',1);self.settled()
            self.check('valid-galaxy-recovers-route', "return !document.querySelector('.FleetPlanSubmit').disabled")
            self.click_visible('.FleetCoordinateTypeSelector button[value="2"]');self.settled()
            self.check('point-origin-and-return-still-work', "return !document.querySelector('.FleetPlanSubmit').disabled&&__resourcePreviews.some(p=>p.data.origin?.type===2&&p.fuel)")
            self.valid_payloads()
            self.check('no-gameplay-writes-or-js-errors', "return !__resourceWrites.length&&!__resourceErrors.length")
            print(json.dumps({'viewport':self.viewport,'passed':len(self.results),'previews':self.js('return __resourcePreviews.length'),'results':self.results},ensure_ascii=False),flush=True)
        finally:
            self.js("""
                GameEvents.emit=__resourceEmit;removeEventListener('error',__resourceError);
                removeEventListener('unhandledrejection',__resourceError);Dialog.close();
            """)
            self.call('/goog/cdp/execute',{'cmd':'Emulation.clearDeviceMetricsOverride','params':{}})
            self.call('/refresh',{})


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mobile',action='store_true')
    check=ResourcePreviewCheck()
    if parser.parse_args().mobile:check.viewport=(390,844)
    check.run()
