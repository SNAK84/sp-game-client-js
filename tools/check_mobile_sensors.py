"""SPA regression мобильных сенсоров в существующей сессии snak1.

Без флагов — только UI fixtures. --start отправляет Fleet 3 в удержание и
включает сенсоры; --finish возвращает его и переносит разведчика в ангар.
Оба игровых режима требуют явно подготовленный snak1/Homeworld 20.
"""
import argparse
import json
import time
from check_fleet_mission_layout import Check


class MobileSensorCheck(Check):
    def reload(self, mode):
        # Во время живого скана ActualData может прийти между записью Data.mode
        # и refresh. Сначала штатно переключаем также серверную текущую страницу.
        self.js("GameEvents.emit('SendServer',{mode:arguments[0],NotOverlay:true})",mode)
        self.wait(lambda:self.js('return Page.messageData?.mode===arguments[0]',mode))
        self.js('Data.mode=arguments[0]', mode)
        self.call('/refresh', {})
        self.wait(lambda:self.js("return typeof Page!=='undefined'&&Page.messageData?.mode===arguments[0]&&Page.pageActive&&document.contains(Page.$Content[0])&&WS.ws.readyState===1",mode))
        if mode == 'overview': self.wait(lambda:self.js('return !!Page.$Content.FlyingFleets?.[0]?.isConnected'))
        self.wait(lambda:self.js('return WS.requestCallbacks.size===0&&!Page.$Content.is(":animated")'))

    def fixtures(self):
        original=self.js('return Data.mode')
        try:
            self.reload('overview')
            self.js("""
                const now=GameServerTime.now();
                window.__sensorFixtures=[1,2,3].map(tier=>({id:90000+tier,tier,fresh:tier!==2,
                    position:{type:2,galaxy:1,system:8,distance:1000*tier,angle:40*tier},
                    observedAt:now-10,freshUntil:now+30,retainUntil:now+300,
                    ...(tier>=2?{owner_name:'QA <img onerror=bad()>',countRange:[100,999]}:{}),
                    ...(tier===3?{ships:[{id:202,count:100},{id:221,count:1}]}:{})}));
                Page.messageData.data.Page.FlyingFleets=[];
                Page.messageData.data.Page.SensorContacts=__sensorFixtures;Page.renderFlyingFleetsOverview();
            """)
            for width,height in [(1440,1000),(390,844),(320,568)]:
                self.call('/goog/cdp/execute',{'cmd':'Emulation.setDeviceMetricsOverride','params':{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700}})
                result=self.js("""
                    const rows=[...document.querySelectorAll('.SensorContactRow')];
                    return {width:innerWidth,rows:rows.length,overflow:rows.some(e=>e.scrollWidth>e.clientWidth),
                        escaped:!rows.some(e=>e.querySelector('img')),tier1:$(Page.createSensorContactCard(__sensorFixtures[0])).text(),
                        tier3:$(Page.createSensorContactCard(__sensorFixtures[2])).text()};
                """)
                assert result['rows']==3 and not result['overflow'] and result['escaped'],result
                assert 'QA' not in result['tier1'] and '100' in result['tier3'] and 'Груз не раскрыт' in result['tier3'],result
                self.results.append(result);self.shot('mobile-contacts-overview-'+str(width))
            self.js("const c={...__sensorFixtures[0],freshUntil:GameServerTime.now()+1,retainUntil:GameServerTime.now()+3};Page.messageData.data.Page.SensorContacts=[c];Page.renderFlyingFleetsOverview();")
            self.wait(lambda:self.js("return document.querySelector('.SensorContactRow')?.classList.contains('Stale')"))
            self.wait(lambda:self.js("return !$('.SensorContactRow').is(':visible')"))
            self.reload('galaxy')
            self.wait(lambda:self.js('return Page.SystemShow'))
            self.js("""
                const now=GameServerTime.now(),distance=Number(Page.Orbits[3]?.distance||1000);
                Page.SensorContacts=[{id:90001,tier:1,fresh:true,position:{type:2,galaxy:1,system:8,distance,angle:180},
                    observedAt:now,freshUntil:now+30,retainUntil:now+300}];Page.renderPlanets();
            """)
            self.wait(lambda:self.js("return Page.mapObjects.some(o=>o.kind==='contact')"))
            self.js("Page.openObjectMenu('contact',90001)")
            assert self.js("return !!document.querySelector('.GalaxyObjectMenu .SensorContactCard')||Page.$ObjectMenuBody.find('.SensorContactCard').length===1")
            self.shot('mobile-contacts-map')
            self.js('Page.SensorContacts[0].freshUntil=GameServerTime.now()+1;Page.SensorContacts[0].retainUntil=GameServerTime.now()+3')
            self.wait(lambda:self.js('return Page.$ObjectMenuBody.text().includes("Последняя известная отметка")'))
            self.wait(lambda:self.js('return !Page.selectedMapObject'))
            self.results.append({'mapContact':True,'ttlCleanup':True,'openCardTtlCleanup':True})
            self.reload('fleets')
            result=self.js("""
                const p=Page.messageData.data.Page;p.FleetTargets=[{id:90001,name:'Контакт #90001',is_own:false,selectable:false,reason:'Перехват: этап 3Б',position:{type:2,galaxy:1,system:8,distance:1000,angle:0}}];
                const picker=Page.createFleetTargetPicker(3);return {disabled:picker.$select.find('option[value=90001]').prop('disabled'),valid:Page.getFleetTargets(3).some(f=>f.id===90001)};
            """)
            assert result=={'disabled':True,'valid':False},result
            self.results.append(result)
            self.out.joinpath('mobile-sensors-ui.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
            print(json.dumps({'uiPassed':len(self.results),'gameWrites':0,'artifacts':str(self.out)}),flush=True)
        finally:
            self.call('/goog/cdp/execute',{'cmd':'Emulation.clearDeviceMetricsOverride','params':{}})
            self.reload(original)

    def source_page(self):
        self.reload('fleets')
        self.js("GameEvents.emit('SendServer',{mode:'fleets',action:'planetselect',data:{planetId:20},NotOverlay:true})")
        self.wait(lambda:self.js('return Number(Page.messageData.data.PlanetList.current_planet)===20&&!!(Page.messageData.data.Page.FleetList?.[3]||Page.messageData.data.Page.FlyingFleets?.[3])'))
        assert self.js('return Page.messageData.data.PlanetList.Planets.some(p=>p.id===20&&p.galaxy===1&&p.system===8&&p.planet===4)')

    def command(self, action, data):
        self.js("""
            window.__sensorAck=null;
            WS.Submit('fleets',arguments[0],arguments[1],{scope:Page.requestScope,kind:'write',
                onSuccess:()=>__sensorAck={ok:true},onError:e=>__sensorAck={error:e.message}});
        """,action,data)
        ack=self.wait(lambda:self.js('return __sensorAck'))
        assert ack.get('ok'),ack

    def current(self):
        return self.js('return Page.messageData.data.Page.FlyingFleets?.[3]||Page.messageData.data.Page.FleetList?.[3]')

    def start(self):
        self.source_page()
        assert self.current()['status']==0,'Тестовый флот уже занят'
        assert self.js('return Page.messageData.data.Page.PlanetShips[221]?.count===1'),'Нет разрешённого разведчика в ангаре'
        self.js('Page.moveShip(3,0,221,1)')
        self.wait(lambda:self.js('return Page.messageData.data.Page.FleetList[3]?.ships[221]?.count===1'))
        version=self.current()['control']['version']
        self.js("Page.showTaskFleet(3)")
        self.wait(lambda:self.js('return Page.navigationSystemInfo?.valid'))
        distance=self.js('return Number(Page.navigationSystemInfo.minDistance)')
        self.js('Dialog.close()')
        self.command('SetFleetCommands',{'fleetId':3,'plan':{'version':version,'fuel':100,'resources':{},'steps':[
            {'kind':'mission','mission':30,'coordinates':{'type':2,'galaxy':1,'system':8,'distance':distance,'angle':0},'speedFactor':10}]}})
        # Останавливаем обычный внутрисистемный перелёт через UI: проверяем,
        # что ручная остановка сама не включает сенсоры, затем включаем явно.
        self.wait(lambda:self.js("return !!document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightStopButton')"))
        self.js("document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightStopButton').click()")
        self.wait(lambda:self.js('return Page.messageData.data.Page.FlyingFleets?.[3]?.sensors?.available'),seconds=240)
        before=self.current()
        self.js("document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetSensorModeButton').click()")
        self.wait(lambda:self.js('return Page.messageData.data.Page.FlyingFleets?.[3]?.sensors?.enabled'))
        result={'before':before['sensors'],'after':self.current()['sensors'],'fleetId':3,'status':'observing'}
        self.out.joinpath('mobile-sensors-live-start.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        self.shot('mobile-sensors-live-on');print(json.dumps(result),str(self.out),flush=True)

    def finish(self):
        self.source_page();f=self.current()
        if f.get('sensors',{}).get('enabled'):
            self.js("document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetSensorModeButton').click()")
            self.wait(lambda:not self.current().get('sensors',{}).get('enabled'))
        f=self.current()
        if f['status'] != 0 and not f.get('is_return'):
            self.command('SetFleetCommands',{'fleetId':3,'plan':{'version':f['control']['version'],'steps':[{'kind':'return'}]}})
            self.wait(lambda:self.current()['control']['can_continue'])
            self.command('ResumeFleet',{'fleetId':3,'fuelMode':'available'})
            self.wait(lambda:self.current().get('is_return'))
        seconds=self.js('return Math.max(240,Number(Page.messageData.data.Page.FlyingFleets?.[3]?.end_time||0)-GameServerTime.now()+60)')
        self.wait(lambda:self.current()['status']==0,seconds=seconds)
        if self.current()['ships'].get('221',{}).get('count',0): self.js('Page.moveShip(0,3,221,1)')
        self.wait(lambda:self.js('return Page.messageData.data.Page.PlanetShips[221]?.count===1'))
        print(json.dumps({'returned':True,'scoutInHangar':1,'originalCargoShips':self.current()['ships']['202']['count']}),flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group();g.add_argument('--start',action='store_true');g.add_argument('--finish',action='store_true');args=p.parse_args()
    c=MobileSensorCheck()
    c.start() if args.start else c.finish() if args.finish else c.fixtures()
