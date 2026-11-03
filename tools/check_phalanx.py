"""Настоящий SPA snak1: python3 tools/check_phalanx.py --execute --moon-id 34.

Требует явно подготовленную тестовую луну с фалангой. Один оплаченный скан
Homeworld (5 000 дейтерия луны); остальные проверки не меняют игровой мир.
Не логинится, не печатает токены; использует существующую WebDriver-сессию.
"""
import argparse
import json
import time
from check_fleet_mission_layout import Check


class PhalanxCheck(Check):
    def flight(self, moon_id):
        from check_fleet_loading_live import LiveLoadingCheck
        journey = LiveLoadingCheck()
        journey.fleet_id = 3
        self.js('Dialog.close()')
        journey.fleets(); journey.select_planet(20)
        self.call('/refresh', {})
        self.wait(lambda:self.js("return typeof Page!=='undefined'&&Page.Name==='FleetsPageClass'&&document.contains(Page.$Content[0])&&!!Page.messageData.data.Page.FleetList?.[3]"))
        assert journey.current()['status'] == 0 and journey.current()['ships']['202']['count'] == 1, 'Требуется исходный тестовый флот 3'
        print('FLIGHT_ARTIFACTS '+str(self.out),flush=True)
        journey.open(1440,1000)
        self.js("""
            document.querySelector('.FleetPlanSteps .FleetPlanStop').click();
            const p=$('.FleetPlanStep:visible');
            p.find('.FleetPlanModeSelector button[value=move]')[0].click();
            p.find('.FleetCoordinateTypeSelector button[value=2]')[0].click();
            p.find('input[aria-label="Расстояние"]').val(0).trigger('change');
            p.find('input[aria-label="Угол"]').val(0).trigger('change');
            $('#FleetPlanFuel').val(1000).trigger('input');
        """)
        journey.settled(); journey.submit()
        self.wait(lambda:self.js('return !!Page.messageData.data.Page.FlyingFleets?.[3]'))
        self.js("GameEvents.emit('SendServer',{mode:'galaxy',action:'planetselect',data:{planetId:arguments[0]},NotOverlay:true})",moon_id)
        self.wait(lambda:self.js('return Number(Page.messageData.data.PlanetList.current_planet)===arguments[0]&&WS.requestCallbacks.size===0',moon_id))
        self.navigate('galaxy'); self.call('/refresh',{})
        self.wait(lambda:self.js("return typeof Page!=='undefined'&&Page.Name==='GalaxyPageClass'&&Page.SystemShow&&document.contains(Page.$Content[0])"))
        before = self.js('return Number(Page.messageData.data.TopNav.Resources[903].count)')
        self.js("Page.openPhalanx(Page.Planets.find(p=>Number(p.id)===20))")
        self.wait(lambda:self.js("return !Page.phalanxPending&&!!document.querySelector('.PhalanxFleet')"))
        scan = self.js('return Page.messageData.data.Page.PhalanxScan')
        fleet = next(f for f in scan['fleets'] if f['id'] == 3)
        assert fleet['shipsCount'] == 1 and fleet['ships'][0]['count'] == 1 and fleet['from']['orbit'] == 4, fleet
        after = self.js('return Number(Page.messageData.data.TopNav.Resources[903].count)')
        assert before-after == 5000, (before,after)
        assert self.js("return !document.querySelector('.PhalanxScan').innerText.includes('NaN')"), 'Некорректный груз'
        self.shot('phalanx-real-flight')
        self.js('Dialog.close()'); journey.fleets(); self.call('/refresh',{})
        self.wait(lambda:self.js("return typeof Page!=='undefined'&&Page.Name==='FleetsPageClass'&&!!document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightRecallButton')"))
        self.js("document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightRecallButton').click()")
        self.wait(lambda:self.js('return !Page.messageData.data.Page.FlyingFleets?.[3]'),120)
        journey.select_planet(20)
        self.wait(lambda:self.js('return Page.messageData.data.Page.FleetList?.[3]?.status===0'))
        final = journey.current()
        assert final['ships']['202']['count'] == 1 and final['fuel'] == 0, final
        self.out.joinpath('phalanx-flight.json').write_text(json.dumps({'scan':scan,'beforeDeuterium':before,'afterDeuterium':after,'returned':final},ensure_ascii=False,indent=2))
        print('PASS actual flight detected, 5000 deducted, fleet recalled and returned; '+str(self.out),flush=True)

    def navigate(self, mode):
        self.js("Dialog.close();GameEvents.emit('SendServer',{mode:arguments[0],NotOverlay:true})", mode)
        self.wait(lambda: self.js("return Page.messageData.mode===arguments[0]&&WS.requestCallbacks.size===0", mode))
        time.sleep(.6)

    def run(self, moon_id):
        print('ARTIFACTS ' + str(self.out), flush=True)
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&!!Page.Name&&WS.ws.readyState===1&&WS.requestCallbacks.size===0"))
        self.js("GameEvents.emit('SendServer',{mode:Page.messageData.mode,action:'planetselect',data:{planetId:'20'},NotOverlay:true})")
        self.wait(lambda:self.js('return Number(Page.messageData.data.PlanetList.current_planet)===20&&WS.requestCallbacks.size===0'))
        self.navigate('researchs')
        techs = self.js("const r=Page.messageData.data.Page.ResearchList;return [135,136].map(id=>({id,name:r[id]?.name,level:r[id]?.level}))")
        assert techs[0]['name'] == 'sensor_tech' and techs[1]['name'] == 'extraterrestrial_mining_tech', techs
        self.results.append({'technologies': techs})
        self.js("GameEvents.emit('ShowInfoPanel',{data:{id:135}})")
        self.wait(lambda: self.js("return document.querySelector('.InformationPage[data-element-id=\"135\"] .InformationDescription')?.textContent.length>300"))
        self.wait(lambda:self.js("const i=document.querySelector('.InformationHero img');return i?.complete&&i.naturalWidth>0"))
        self.shot('sensor-information')
        self.js('Dialog.close()')
        self.navigate('galaxy')
        # Отрицательный реальный запрос с планеты не списывает дейтерий.
        self.js("""
        window.__phalanxRejected=null;
        WS.Submit('galaxy','PhalanxScan',{targetId:20,scanToken:crypto.randomUUID()},
            {scope:Page.requestScope,kind:'write',onSuccess:()=>{__phalanxRejected={unexpected:true}},onError:e=>{__phalanxRejected={code:e.code,message:e.message}}});
        """)
        rejection = self.wait(lambda: self.js('return window.__phalanxRejected'))
        assert rejection.get('code') == 'phalanx_unavailable', rejection
        self.results.append({'realRejection': rejection})

        # UI fixtures: настоящий renderer/serializer, без отправки сканов.
        self.js("window.__phalanxSubmit=WS.Submit;window.__phalanxPayloads=[];WS.Submit=function(mode,action,data,options){if(action==='PhalanxScan'){__phalanxPayloads.push({mode,action,data});options.onSuccess?.({});return;}return __phalanxSubmit.call(this,mode,action,data,options)}")
        try:
            for width, height in [(1440,1000),(390,844),(320,568)]:
                self.call('/goog/cdp/execute', {'cmd':'Emulation.setDeviceMetricsOverride','params':{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700}})
                self.js("""
                Page.openPhalanx({...Page.Planets.find(p=>Number(p.id)===20),PhalanxAvailable:true});
                const pending=Page.phalanxPending;
                Page.messageData.data.Page.PhalanxScan={token:pending.token,targetName:'Тест <img onerror=bad()>',coordinates:{type:1,galaxy:1,system:8,orbit:4,objectType:1},cost:5000,scannedAt:Date.now()/1000,
                    fleets:[{id:3,name:'Транспорт <b>без HTML</b>',ownerName:'Player6',mission:10,returning:false,from:{type:1,galaxy:1,system:8,orbit:4,objectType:1},to:{type:1,galaxy:1,system:7,orbit:4,objectType:1},arrivesAt:Date.now()/1000+180,estimated:true,shipsCount:10,ships:[{id:202,name:'small_ship_cargo',count:10}],resources:{901:100,902:0,903:0}}]};
                Page.renderPhalanxScan();
                """)
                self.wait(lambda:self.js("return $(Dialog.dialogDiv).is(':visible')&&Dialog.dialogDiv.getBoundingClientRect().width>0"))
                time.sleep(.4)  # Dialog.show() позиционирует окно в следующем animation frame.
                result = self.js("const c=document.querySelector('.PhalanxScan'),r=Dialog.dialogDiv.getBoundingClientRect();return {width:innerWidth,left:r.left,right:r.right,overflow:c.scrollWidth-c.clientWidth,rows:c.querySelectorAll('.PhalanxFleet').length,html:c.querySelector('h3 img')!==null,route:c.querySelector('.PhalanxFleetRoute').textContent,contentBottom:c.parentNode.getBoundingClientRect().bottom,buttonsTop:Dialog.dialogDiv.querySelector('dialog-buttons').getBoundingClientRect().top}")
                assert result['left'] >= -1 and result['right'] <= width+1 and result['overflow'] == 0 and result['rows'] == 1 and not result['html'], result
                assert result['contentBottom'] <= result['buttonsTop'] + 1, result
                self.results.append({'ui':result});self.shot('phalanx-'+str(width))
                self.js('Dialog.close()')
                self.wait(lambda:self.js("return !$(Dialog.dialogDiv).is(':visible')"))
        finally:
            self.js('WS.Submit=__phalanxSubmit;delete window.__phalanxSubmit;delete Page.messageData.data.Page.PhalanxScan;Dialog.close()')
            self.call('/goog/cdp/execute', {'cmd':'Emulation.clearDeviceMetricsOverride','params':{}})

        # Настоящий planetselect: скан привязан к источнику, не к ID из UI.
        self.js("GameEvents.emit('SendServer',{mode:'galaxy',action:'planetselect',data:{planetId:String(arguments[0])},NotOverlay:true})", moon_id)
        self.wait(lambda: self.js('return Number(Page.messageData.data.PlanetList.current_planet)===arguments[0]&&WS.requestCallbacks.size===0', moon_id))
        # Известный B001 общего Hide не исправляется этим тестом; проверяем видимый SPA.
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page.Name==='GalaxyPageClass'&&Page.SystemShow&&document.contains(Page.$ObjectMenu[0])&&Page.messageData.data.Page.Phalanx?.level===1&&Page.Planets.some(p=>Number(p.id)===20&&p.PhalanxAvailable)"))
        self.js("""
        window.__phalanxFrames=[];
        window.__phalanxListener=e=>{try{const m=JSON.parse(e.data);if(m.data?.Page?.PhalanxScan)__phalanxFrames.push(m.data.Page.PhalanxScan)}catch{}};
        WS.ws.addEventListener('message',__phalanxListener);
        Page.openObjectMenu('planet',20);document.querySelector('.GalaxyPhalanxAction').click();
        """)
        self.wait(lambda:self.js("return !Page.phalanxPending&&!!document.querySelector('.PhalanxScan h3')"))
        scan = self.js('return Page.messageData.data.Page.PhalanxScan')
        assert scan['sourceId'] == moon_id and scan['targetId'] == 20 and scan['cost'] == 5000 and not scan.get('error'), scan
        self.results.append({'realScan':scan,'rawFrames':self.js('return __phalanxFrames')})
        self.shot('phalanx-real')
        self.js("WS.ws.removeEventListener('message',__phalanxListener);delete window.__phalanxListener;delete window.__phalanxFrames;Dialog.close()")
        self.out.joinpath('phalanx.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
        print('PASS technologies, rejection, three viewport fixtures, real scan; '+str(self.out),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute',action='store_true')
    parser.add_argument('--moon-id',type=int,required=True)
    parser.add_argument('--flight-only',action='store_true',help='Реальный перелёт Fleet 3, скан и отзыв; расходует обычное топливо')
    args=parser.parse_args()
    if not args.execute: parser.error('Оплаченный скан запускается только с --execute')
    check=PhalanxCheck()
    if args.flight_only: check.flight(args.moon_id)
    else: check.run(args.moon_id)
