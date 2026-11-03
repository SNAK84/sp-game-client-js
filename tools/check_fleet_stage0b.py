"""Stage 0Б: лимиты и технология дозаправки в настоящем SPA.

Использует текущую сессию snak1. Только UI fixtures; игровые команды перехватываются.
"""
import json
import time
from check_fleet_route_layout import RouteCheck


class TechnologyCheck(RouteCheck):
    def check(self, name, script):
        assert self.js(script), name
        self.results.append({'name': name, 'passed': True})
        print('OK ' + name, flush=True)

    def close(self):
        self.js('Dialog.close()')
        self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')"))

    def run(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined' && !!Page?.Name && WS.ws.readyState===1 && WS.requestCallbacks.size===0"))
        self.js("GameEvents.emit('SendServer',{mode:'fleets',NotOverlay:true})")
        self.wait(lambda: self.js("return Page?.Name==='FleetsPageClass' && WS.requestCallbacks.size===0"))
        self.fleet_id = self.js('return Number(Object.keys(Page.messageData.data.Page.FleetList)[0])')
        assert self.fleet_id, 'Нужен базируемый тестовый флот'
        self.check('live-server-capabilities', """
            const c=Page.messageData.data.Page.FleetCapabilities;
            return Number.isInteger(c.maxStages) && c.cargoRefuelLevel===3 && typeof c.cargoRefuel==='boolean';
        """)
        self.js("""
            window.__techFleet=structuredClone(Page.messageData.data.Page.FleetList[arguments[0]]);
            window.__techCaps=structuredClone(Page.messageData.data.Page.FleetCapabilities);
            window.__techEmit=GameEvents.emit;window.__techWrites=[];window.__techErrors=[];
            window.__techError=e=>__techErrors.push(e.message||String(e.reason));
            addEventListener('error',__techError);addEventListener('unhandledrejection',__techError);
            GameEvents.emit=function(name,p,...args){
                if(name==='SendServer'&&['SetFleetCommands','ResumeFleet','SendMission','StopFleet','RecallFleet'].includes(p.action)){
                    __techWrites.push(p.action);return;
                }
                if(name==='SendServer'&&p.action==='GetAvailableMissions'&&p.data?.forPlan){
                    p.onSuccess?.({getData:()=>({AvailableMissions:{missions:[10,11],disabled:false,messages:[]}})});return;
                }
                return __techEmit.call(this,name,p,...args);
            };
            window.__techSetup=(level,count=2,active=null)=>{
                const p=Page.messageData.data.Page,f=structuredClone(__techFleet);
                p.FleetCapabilities={...__techCaps,plan:level>=3,edit:level>=6,maxStages:level<3?0:Math.min(12,level)};
                f.status=active?1:0;f.actions={SetFleetCommands:active?level>=6:level>=3};
                f.control={...f.control,planActiveStage:active,steps:Array.from({length:count-1},()=>({kind:'mission',mission:10,coordinates:{type:1,galaxy:1,system:10,orbit:4,objectType:1},percent:10,speedFactor:10})).concat({kind:'return'})};
                p.FleetList[arguments[0]]=f;
            };
        """, self.fleet_id)
        try:
            for level in [0, 2, 3, 5, 6, 11, 12, 13]:
                self.close()
                self.js('__techSetup(arguments[0]);Page.showFleetPlan(arguments[1])', level, self.fleet_id)
                if level < 3:
                    self.check('level-'+str(level)+'-editor-locked', "return !document.querySelector('.FleetPlanEditor')")
                    continue
                self.settled()
                limit = min(12, level)
                assert self.js('return $(".FleetPlanCount").text()') == '2 / ' + str(limit)
                while self.js('return $(".FleetPlanStep").length') < limit:
                    self.js('document.querySelector(".FleetPlanAdd").click()')
                self.check('level-'+str(level)+'-limit-blocks-add', 'return $(".FleetPlanAdd").prop("disabled") && !$(".FleetPlanCount").hasClass("red_text")')

            for width, height in [(1440,1000),(390,844),(320,568)]:
                self.close()
                self.js('__techSetup(3)')
                self.open(width,height)
                self.js('document.querySelector(".FleetPlanAdd").click()')
                self.check(str(width)+'-three-stages-with-return', 'return $(".FleetPlanCount").text()==="3 / 3" && $(".FleetPlanAdd").prop("disabled")')
                self.geometry(str(width)+'-stage-limit')
                self.shot(str(width)+'-stage-limit')

            self.close()
            self.js('__techSetup(6,9);Page.showFleetPlan(arguments[0])', self.fleet_id)
            self.settled()
            self.check('old-plan-shown-without-truncation', 'return $(".FleetPlanStep").length===9 && $(".FleetPlanCount").text()==="9 / 6" && $(".FleetPlanSubmit").prop("disabled")')
            self.js('for(let i=0;i<3;i++)document.querySelector(".FleetPlanStepControls button:last-child").click()')
            self.check('old-plan-can-be-shortened', 'return $(".FleetPlanStep").length===6 && $(".FleetPlanCount").text()==="6 / 6" && !$(".FleetPlanCount").hasClass("red_text")')

            self.close()
            self.js('__techSetup(6,6,{moving:true,returning:false,coordinates:{type:1,galaxy:1,system:10,orbit:4,objectType:1}});Page.showFleetPlan(arguments[0])', self.fleet_id)
            self.settled()
            self.check('active-target-not-counted-twice', 'return $(".FleetPlanCount").text()==="6 / 6"')
            self.js('$(".FleetPlanStep:visible input[aria-label=Орбита]").val(5).trigger("input")')
            self.check('active-stage-plus-new-target-counted', 'return $(".FleetPlanCount").text()==="7 / 6" && $(".FleetPlanSubmit").prop("disabled")')

            for width,height in [(1440,1000),(390,844),(320,568)]:
                self.call('/goog/cdp/execute', {'cmd':'Emulation.setDeviceMetricsOverride','params':{'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700}})
                for logistics in [0,2,3]:
                    self.close()
                    self.js("""
                        const p=Page.messageData.data.Page,id=99009;
                        p.FleetCapabilities={...__techCaps,cargoRefuel:arguments[0]>=3,cargoRefuelLevel:3};
                        p.FlyingFleets[id]={...__techFleet,id,is_own:true,battle:null,fuel:5,
                            resources:{903:{id:903,count:1000}},control:{paused:true},
                            actions:{ResumeFleet:true},commands:[{type:10,status:'pending'}]};
                        Page.showFleetResume(id);
                    """, logistics)
                    disabled = self.js('return [...document.querySelectorAll(".FleetResumeOption input")].map(e=>e.disabled)')
                    assert disabled == [False, logistics<3, logistics<3], (logistics,disabled)
                    if logistics < 3:
                        self.check(str(width)+'-logistics-'+str(logistics)+'-requirement', 'return $(".FleetResumeOption").text().includes("Флотовая логистика 3")')
                    self.geometry(str(width)+'-resume-logistics-'+str(logistics))
                    if logistics == 2:
                        self.shot(str(width)+'-resume-locked')
            self.close()
            self.js("""
                const p=Page.messageData.data.Page;
                p.FleetCapabilities.cargoRefuel=false;p.FlyingFleets[99009].fuel=0;Page.showFleetResume(99009);
            """)
            self.check('empty-tank-and-locked-cargo', 'return $(".FleetResumeSubmit").prop("disabled") && !$(".FleetResumeOption input:enabled").length')
            self.close()
            self.js('Page.messageData.data.Page.FleetCapabilities.cargoRefuel=true;Page.showFleetResume(99009)')
            self.check('empty-tank-with-technology-selects-cargo', 'return $(".FleetResumeOption input:checked").val()==="segment" && !$(".FleetResumeSubmit").prop("disabled")')

            self.close()
            self.js("GameEvents.emit('SendServer',{mode:'messages',NotOverlay:true})")
            self.wait(lambda: self.js("return Page?.Name==='MessagesPageClass' && WS.requestCallbacks.size===0"))
            for advice in ['locked','available',None]:
                text = self.js("""
                    const data={FleetId:99009,Position:'[1:10]',TargetCoordinate:'[1:10:4]',ResourcesCargoFuel:{903:100},
                        lang:{Command:'fleet_command.move_in_system'}};
                    if(arguments[0])data.lang.CargoRefuelAdvice='fuelAdvice.'+arguments[0];
                    const e=Page.CreateMessage({id:99009,from_id:0,from:'from.Transport',subject:'subject.Transport.FuelStop',
                        sample:'FleetFuelStopped',read:1,time:Date.now()/1000,data});
                    return e.find('.MessageText').text();
                """, advice)
                assert '{CargoRefuelAdvice}' not in text and 'undefined' not in text, text
                assert ('Флотовую логистику до уровня 3' in text) == (advice=='locked'), text
                assert ('Доступна дозаправка из трюма' in text) == (advice=='available'), text
                self.results.append({'name':'fuel-message-advice-'+str(advice),'passed':True})
            self.check('no-gameplay-requests', 'return __techWrites.length===0')
            self.check('no-js-errors', 'return __techErrors.length===0')
        finally:
            self.js("""
                GameEvents.emit=__techEmit;removeEventListener('error',__techError);removeEventListener('unhandledrejection',__techError);Dialog.close();
            """)
            self.call('/goog/cdp/execute', {'cmd':'Emulation.clearDeviceMetricsOverride','params':{}})
            self.call('/refresh', {})
            self.wait(lambda: self.js("return typeof Page!=='undefined' && !!Page?.Name && WS.ws.readyState===1 && WS.requestCallbacks.size===0"))
        self.out.joinpath('stage0b-results.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
        print('RESULT '+str(len(self.results))+' passed; '+str(self.out),flush=True)


if __name__ == '__main__':
    TechnologyCheck().run()
