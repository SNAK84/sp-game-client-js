"""Границы POINT и запас удержания в настоящем SPA snak1.

Без флагов — только чтение API и изменение незаписанной формы.
--execute дополнительно отправляет Fleet 3 с 1000 топлива к близкой точке,
останавливает штатной кнопкой и возвращает его штатными командами. Выдачи ресурсов нет.
"""
import argparse
import json
from check_mobile_sensors import MobileSensorCheck


class PointCheck(MobileSensorCheck):
    def observe_wire(self):
        self.js("""
            window.__pointTravel=null;window.__pointNav=null;
            WS.ws.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data)}catch{return}
                const p=m.data?.Page;if(p?.TravelInfo)__pointTravel=p.TravelInfo;
                if(p?.NavigationSystem)__pointNav=p.NavigationSystem;});
        """)

    def settle(self):
        self.wait(lambda:self.js('return WS.requestCallbacks.size===0&&!Page.missionDataLoading'))

    def preview(self):
        self.js('Page.coordinatesChanged(3,null,true)')
        self.settle()

    def open_point(self):
        self.js('Dialog.close()')
        self.wait(lambda:self.js('return !$(Dialog.dialogDiv).is(":visible")&&!$(Dialog.dialogDiv).is(":animated")'))
        self.js('Page.showTaskFleet(3)')
        self.wait(lambda:self.js('return Page.navigationSystemInfo?.valid&&$(Dialog.dialogDiv).is(":visible")&&!$(Dialog.dialogDiv).is(":animated")'))
        self.js("document.querySelector('.FleetCoordinateTypeSelector button[value=\"2\"]').click()")
        self.wait(lambda:self.js('return !Page.navigation.$distance.prop("disabled")&&Page.navigationSystemInfo?.valid'))
        self.preview()
        self.js("if(Number(Page.selectedMission)!==30)document.querySelector('.FleetMissionPanel button[value=\"30\"]').click()")
        self.preview()

    def run(self, execute=False):
        self.source_page();assert self.current()['status']==0,'Нужен свободный snak1/Fleet 3'
        try:
            self.observe_wire()
            for width,height in [(1440,1000),(390,844),(320,568)]:
                self.call('/goog/cdp/execute',{'cmd':'Emulation.setDeviceMetricsOverride','params':{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700}})
                self.open_point()
                bounds=self.js('return Page.navigationSystemInfo')
                for value,expected in [(bounds['minDistance']-1,bounds['minDistance']),(bounds['maxDistance']+1,bounds['maxDistance'])]:
                    self.js('Page.navigation.$distance.val(arguments[0]).trigger("input").trigger("change")',value)
                    assert self.js('return Number(Page.navigation.$distance.val())')==expected
                    self.preview()
                result=self.js("""
                    const fuel=Page.flightControls.getPayload().fuel,travel=__pointTravel;
                    const d=Dialog.dialogDiv,c=d.querySelector('dialog-content'),r=d.getBoundingClientRect();
                    return {width:innerWidth,min:Number(Page.navigation.$distance.attr('min')),max:Number(Page.navigation.$distance.attr('max')),
                        fuel,flightMax:travel.fuel.max,canSend:!document.querySelector('#SendCmds').disabled,overflow:c.scrollWidth-c.clientWidth,
                        visible:$(d).is(':visible'),left:r.left,right:r.right};
                """)
                assert result['min']==bounds['minDistance'] and result['max']==bounds['maxDistance']
                assert result['fuel']>result['flightMax'] and result['canSend'] and result['overflow']==0,result
                assert result['visible'] and 0<=result['left']<result['right']<=width+1,result
                # Ввод по одной цифре не должен застревать на min_distance.
                typed=str(int((bounds['minDistance']+bounds['maxDistance'])/2))
                self.js('Page.navigation.$distance.val("")')
                for digit in typed:
                    self.js('Page.navigation.$distance.val(Page.navigation.$distance.val()+arguments[0]).trigger("input")',digit)
                assert self.js('return Page.navigation.$distance.val()')==typed
                self.results.append(result);self.shot('point-hold-'+str(width));self.js('Dialog.close()')

            # Конечная миссия сохраняет расчётный максимум, запас не становится грузом.
            self.open_point()
            self.js("const p=Page.getOwnPlanetTargets().find(p=>Number(p.id)!==20);Page.navigation.$ownPlanet.val(String(p.id)).trigger('change')")
            self.wait(lambda:self.js('return Page.navigationSystemInfo?.valid&&!Page.missionDataLoading'))
            self.js("if(Number(Page.selectedMission)!==10)document.querySelector('.FleetMissionPanel button[value=\"10\"]').click()")
            self.preview()
            finite=self.js('return {fuel:Page.flightControls.getPayload().fuel,max:Math.ceil(__pointTravel.fuel.max)}')
            assert finite['fuel']<=finite['max'],finite
            self.results.append({'finiteMission':finite});self.js('Dialog.close()')

            self.wait(lambda:self.js('return !$(Dialog.dialogDiv).is(":visible")&&!$(Dialog.dialogDiv).is(":animated")'))
            self.js('Page.showFleetPlan(3)')
            self.wait(lambda:self.js('return $(".FleetPlanStep:visible").length>0'))
            self.js("$('.FleetPlanStep:visible .FleetPlanModeSelector button[value=move]')[0].click();$('.FleetPlanStep:visible .FleetCoordinateTypeSelector button[value=2]')[0].click()")
            self.wait(lambda:self.js('return !$(".FleetPlanStep:visible input[aria-label=Расстояние]").prop("disabled")&&WS.requestCallbacks.size===0'))
            for system in [8,10,8]:
                self.js("$('.FleetPlanStep:visible input[aria-label=Система]').val(arguments[0]).trigger('change')",system)
                self.wait(lambda:self.js('return __pointNav?.system===arguments[0]&&!$(".FleetPlanStep:visible input[aria-label=Расстояние]").prop("disabled")&&WS.requestCallbacks.size===0',system))
                info=self.js('return __pointNav')
                for value,expected in [(info['minDistance']-1,info['minDistance']),(info['maxDistance']+1,info['maxDistance'])]:
                    self.js("$('.FleetPlanStep:visible input[aria-label=Расстояние]').val(arguments[0]).trigger('change')",value)
                    assert self.js('return Number($(".FleetPlanStep:visible input[aria-label=Расстояние]").val())')==expected
                self.results.append({'routeSystem':system,'min':info['minDistance'],'max':info['maxDistance']})
            self.js('Dialog.close()')
            self.out.joinpath('point-hold-ui.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
            print(json.dumps({'uiPassed':len(self.results),'gameWrites':0,'artifacts':str(self.out)}),flush=True)
        finally:
            self.js('Dialog.close()')
            self.call('/goog/cdp/execute',{'cmd':'Emulation.clearDeviceMetricsOverride','params':{}})
            self.reload('fleets')
        if execute:self.live()

    def live(self):
        self.reload('galaxy');self.wait(lambda:self.js('return Page.SystemShow&&Page.Planets.some(p=>p.id===20)'))
        planet=self.js('return {...Page.Planets.find(p=>p.id===20),speedPlanets:Page.SpeedPlanets}')
        self.source_page();assert self.current()['status']==0
        self.observe_wire();self.open_point()
        angle=self.js('const p=arguments[0];return ((p.deg+(p.rotation===0?-1:1)*(GameServerTime.now()-p.update_time)/3600*p.speed*p.speedPlanets/24)%360+360)%360',planet)
        self.js('Page.navigation.$distance.val(arguments[0]);Page.navigation.$deg.val(arguments[1])',planet['distance'],angle)
        self.preview()
        self.js("$('#FleetFuelRange').val(1000).trigger('input')")
        assert self.js('return Page.flightControls.getPayload().fuel')==1000
        payload=self.js('return Page.flightControls.getPayload()')
        assert payload['fuel']>self.js('return __pointTravel.fuel.max')
        assert not self.js('return document.querySelector("#SendCmds").disabled')
        self.js('document.querySelector("#SendCmds").click()')
        self.wait(lambda:self.current()['status']!=0)
        if not self.current()['control']['holding']:
            self.js("document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightStopButton').click()")
        self.wait(lambda:self.current()['control']['holding'])
        holding=self.current();assert holding['fuel']>0
        self.out.joinpath('point-hold-live-start.json').write_text(json.dumps({'payload':payload,'holding':holding},ensure_ascii=False,indent=2))
        self.command('SetFleetCommands',{'fleetId':3,'plan':{'version':holding['control']['version'],'steps':[{'kind':'return'}]}})
        self.wait(lambda:self.current()['control']['can_continue'])
        self.command('ResumeFleet',{'fleetId':3,'fuelMode':'available'})
        seconds=self.js('return Math.max(240,Number(Page.messageData.data.Page.FlyingFleets?.[3]?.end_time||0)-GameServerTime.now()+60)')
        self.wait(lambda:self.current()['status']==0,seconds=seconds)
        result={'payload':payload,'holdingFuel':holding['fuel'],'returned':True,'fleetId':3}
        self.out.joinpath('point-hold-live.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        print(json.dumps(result,ensure_ascii=False),str(self.out),flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--execute',action='store_true');a=p.parse_args()
    PointCheck().run(a.execute)
