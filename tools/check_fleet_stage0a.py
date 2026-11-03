"""Stage 0А: настоящий SPA, UI fixtures без игровых команд/чужой авторизации."""
import json
import time
from check_fleet_mission_layout import Check


class Stage0A(Check):
    def check(self, name, script):
        assert self.js(script), name
        self.results.append({"name": name, "passed": True})
        print("OK " + name, flush=True)

    def run(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined' && !!Page?.Name && WS.ws.readyState===1 && WS.requestCallbacks.size===0"))
        self.js("GameEvents.emit('SendServer',{mode:'fleets',NotOverlay:true})")
        self.wait(lambda: self.js("return typeof Page!=='undefined' && Page?.Name==='FleetsPageClass' && WS.ws.readyState===1 && WS.requestCallbacks.size===0"))
        self.fleet_id = self.js("return Number(Object.keys(Page.messageData.data.Page.FleetList)[0])")
        assert self.fleet_id, 'Нужен базируемый тестовый флот snak1'
        self.js("""
        window.__stage0Errors=[];window.__stage0Commands=[];
        window.__stage0Error=e=>__stage0Errors.push(e.message||String(e.reason));
        addEventListener('error',__stage0Error);addEventListener('unhandledrejection',__stage0Error);
        window.__stage0Emit=GameEvents.emit;
        GameEvents.emit=function(name,p,...args){
            if(name==='SendServer' && ['SendMission','SetFleetCommands','StopFleet','ResumeFleet','RecallFleet'].includes(p.action)){
                __stage0Commands.push(p.action);return;
            }
            if(name==='SendServer' && p.action==='GetAvailableMissions' && (p.data?.coordinates?.type===3 || p.data?.origin?.type===3)){
                p.onSuccess?.({getData:()=>({FleetTargets:__stage0Targets,TravelInfo:null,AvailableMissions:{missions:[]},FleetMissions:Page.messageData.data.Page.FleetMissions})});return;
            }
            return __stage0Emit.call(this,name,p,...args);
        };
        window.__stage0Targets=[
            {id:99001,name:'Караван Альфа',is_own:true,owner_name:'Тестер',position:{type:2,galaxy:1,system:8,distance:1500,angle:45}},
            {id:99002,name:'Дозор',is_own:true,owner_name:'Тестер',position:{type:1,galaxy:1,system:8,orbit:4,objectType:1}},
            {id:99003,name:'',is_own:false,owner_name:'Игрок Бета',position:{type:2,galaxy:1,system:8,distance:1900,angle:90}}
        ];
        """)
        try:
            for width, height in [(1440, 1000), (390, 844), (320, 568)]:
                self.open(width, height)
                self.js("Page.refreshFleetTargets(arguments[0],__stage0Targets)", self.fleet_id)
                self.check(str(width)+'-no-manual-id', "return !document.querySelector('#NavigationFleetIdInput') && document.querySelectorAll('.FleetTargetPicker').length===1")
                self.js("$('.FleetTargetPicker input').val('Бета').trigger('input')")
                self.check(str(width)+'-search-owner', "return $('#FleetTargetSelect option').length===2 && $('#FleetTargetSelect option').last().text().includes('Бета')")
                self.js("$('.FleetTargetPicker input').val('Караван').trigger('input');$('#FleetTargetSelect').val('99001').trigger('change')")
                self.check(str(width)+'-selection-contract', "return Page.getNavigationCoordinates().type===3 && Page.getNavigationCoordinates().fleetId===99001 && !('lastKnownPosition' in Page.getNavigationCoordinates())")
                self.geometry(str(width)+'-fleet-picker')
                self.shot(str(width)+'-fleet-picker')
                self.js("Page.refreshFleetTargets(arguments[0],__stage0Targets.filter(f=>f.id!==99001))", self.fleet_id)
                self.check(str(width)+'-stale-target-blocked', "return !$('#FleetTargetSelect').val() && !$('#FleetTargetSelect option[value=99001]').length && $('.FleetTargetStatus').text().includes('недоступен') && $('#SendCmds').prop('disabled')")
                self.js("Page.refreshFleetTargets(arguments[0],[])", self.fleet_id)
                self.check(str(width)+'-empty-list', "return $('#FleetTargetSelect').prop('disabled') && $('.FleetTargetStatus').text().includes('Нет доступных')")

            self.js("Dialog.close()")
            time.sleep(.25)
            self.js("Page.messageData.data.Page.FleetTargets=__stage0Targets;Page.showFleetPlan(arguments[0])", self.fleet_id)
            self.wait(lambda: self.js("return !!document.querySelector('.FleetPlanStep .FleetTargetPicker')"))
            self.js("const t=$('.FleetPlanStep:visible .FleetTargetPicker select');t.val('99002').trigger('change')")
            self.check('route-reuses-picker', "return $('.FleetPlanStep:visible .FleetTargetPicker select').val()==='99002' && !document.querySelector('.FleetPlanStep input[aria-label*=ID]')")
            self.js("Page.refreshFleetTargets(arguments[0],__stage0Targets.filter(f=>f.id!==99002))", self.fleet_id)
            self.check('route-stale-target-removed', "return !$('.FleetPlanStep:visible .FleetTargetPicker select').val() && !$('.FleetPlanStep:visible option[value=99002]').length && $('.FleetPlanStep:visible .FleetTargetStatus').text().includes('недоступен')")
            self.shot('320-route-stale-target')
            self.js("Dialog.close()")
            time.sleep(.25)

            self.js("""
            const now=GameServerTime.now(),home={type:1,galaxy:1,system:8,orbit:4,objectType:1};
            window.__stage0Card={id:99004,name:'Караван',is_own:true,mission:10,status:1,
                start_time:now-30,end_time:now+30,mission_end_time:now+90,
                mission_start:home,mission_target:{...home,orbit:7},segment_start:home,segment_end:{...home,orbit:7},
                command:{type:10,key:'MOVE_IN_SYSTEM',status:'active'},commands:[],ships:{},resources:{},fuel:0,
                control:{paused:false,holding:false},can_recall:true,actions:{SetFleetCommands:true,StopFleet:true,ResumeFleet:false}};
            """)
            self.check('actions-moving-and-recall-label', """
            const e=Page.createFlyingFleetRow(__stage0Card);
            return e.find('.FleetFlightPlanButton').text()==='Маршрут' && e.find('.FleetFlightStopButton').length===1
                && e.find('.FleetFlightResumeButton').length===0 && e.find('.FleetFlightRecallButton').text()==='Отозвать';
            """)
            self.check('actions-paused', """
            const e=Page.createFlyingFleetRow({...__stage0Card,control:{paused:true},actions:{SetFleetCommands:true,StopFleet:false,ResumeFleet:true}});
            return e.find('.FleetFlightResumeButton').length===1 && e.find('.FleetFlightStopButton').length===0;
            """)
            self.check('actions-denied-and-foreign', """
            const denied=Page.createFlyingFleetRow({...__stage0Card,actions:{SetFleetCommands:false,StopFleet:false,ResumeFleet:false},can_recall:false});
            const foreign=Page.createFlyingFleetRow({...__stage0Card,is_own:false,can_recall:false});
            return !denied.find('.FleetFlightPlanButton,.FleetFlightStopButton,.FleetFlightResumeButton').length
                && !foreign.find('.FleetFlightPlanButton,.FleetFlightStopButton,.FleetFlightResumeButton,.FleetFlightRecallButton').length;
            """)

            # Рендер сообщения использует реальный класс/локализацию, но не создаёт сообщение на сервере.
            self.js("GameEvents.emit('SendServer',{mode:'messages',NotOverlay:true})")
            self.wait(lambda: self.js("return Page?.Name==='MessagesPageClass' && WS.requestCallbacks.size===0"))
            self.check('message-name-text-not-html', """
            const name='<img src=x onerror=alert(1)>', message={id:99001,from_id:0,from:'from.Transport',subject:'subject.Transport.Return',sample:'FleetReturned',read:1,time:Date.now()/1000,
                data:{FleetId:31,FleetName:name,PlanetName:'Планета',PlanetCoordinate:'[1:8:4]'}};
            const e=Page.CreateMessage(message);return e.find('.MessageText').text().includes(name) && e.find('.MessageText img').length===0;
            """)
            self.check('message-legacy-fallback-without-mutation', """
            const data={FleetId:31,PlanetName:'Планета',PlanetCoordinate:'[1:8:4]'},e=Page.CreateMessage({id:99002,from_id:0,from:'from.Transport',subject:'subject.Transport.Return',sample:'FleetReturned',read:1,time:Date.now()/1000,data});
            return e.find('.MessageText').text().includes('Флот #31') && !('FleetName' in data);
            """)
            self.check('fuel-message-command-translation', """
            const e=Page.CreateMessage({id:99003,from_id:0,from:'from.Transport',subject:'subject.Transport.FuelStop',sample:'FleetFuelStopped',read:1,time:Date.now()/1000,
                data:{FleetId:31,FleetName:'Караван',Position:'[1:8]',ResourcesCargoFuel:{903:123},lang:{Command:'fleet_command.move_in_system'}}});
            return e.find('.MessageText').text().includes('Полет внутри системы') && !e.find('.MessageText').text().includes('{Command}');
            """)
            self.check('no-gameplay-command-sent', "return __stage0Commands.length===0")
            self.check('no-browser-errors', "return __stage0Errors.filter(e=>e!=='ResizeObserver loop completed with undelivered notifications.').length===0")
            self.out.joinpath('results.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
            print(f'RESULT {len(self.results)} checks passed; {self.out}', flush=True)
        finally:
            self.js("GameEvents.emit=__stage0Emit;removeEventListener('error',__stage0Error);removeEventListener('unhandledrejection',__stage0Error)")
            self.call('/refresh', {})
            self.wait(lambda:self.js("return typeof Page!=='undefined' && !!Page?.Name && WS.ws.readyState===1 && WS.requestCallbacks.size===0"))


if __name__ == '__main__':
    Stage0A().run()
