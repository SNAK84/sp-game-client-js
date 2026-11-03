"""Read-only проверка карточек полёта в SPA snak1, без отправки флотов.

Когда реальных полётов нет, визуальные сценарии задаются только в DOM/Page fixture.
Запуск: python3 tools/check_fleet_flight_layout.py [--capture-only]
"""
import json
import sys
from check_fleet_mission_layout import Check


class FlightCheck(Check):
    def fixture(self):
        self.js("""
        const now=GameServerTime.now();
        const home={type:1,galaxy:1,system:10,orbit:7,objectType:1};
        const target={type:1,galaxy:2,system:8,orbit:2,objectType:3};
        const point={type:2,galaxy:1,system:10,distance:12789.5,angle:177.4};
        const statuses=['completed','completed','active','pending','pending','pending'];
        const types=[31,10,11,10,32,52];
        const keys=['LOAD','MOVE_IN_SYSTEM','MOVE_BETWEEN_SYSTEMS','MOVE_IN_SYSTEM','UNLOAD','STAY'];
        const commands=types.map((type,i)=>({id:91000+i,position:i+1,type,key:keys[i],lang:'fleet_command.'+keys[i].toLowerCase(),status:statuses[i],
            target:i===0?home:target,estimated_time:now+(i-1)*240,time_estimated:i>2,return_leg:i>=4}));
        commands[4].resource_percent=50;
        const base={id:90001,name:'Тестовый транспорт',mission:10,is_own:false,is_return:false,
            start_time:now-240,end_time:now+240,mission_end_time:now+900,mission_end_estimated:true,
            mission_start:home,mission_target:target,segment_start:point,segment_end:{...point,system:11},
            route_leg:{direction:'outbound',start:home,target,started_at:now-480,arrives_at:now+600,
                estimated:true,active_segment:2,segments_total:3,segments:[]},
            command:commands[2],commands,commands_total:6,commands_left:4,
            fuel:10000,ships:{202:{id:202,count:100,name:'small_cargo'}},resources:{901:{id:901,count:25000}}};
        const back={...base,id:90002,name:'Возвращение',is_return:true,
            segment_start:{...point,system:11},segment_end:point,
            route_leg:{...base.route_leg,direction:'return',start:target,target:home},
            commands:commands.map(c=>({...c,return_leg:true}))};
        Page.messageData.data.Page.FlyingFleets={90001:base,90002:back};
        Page.expandedFlyingFleetCommands.add(90001);Page.expandedFlyingFleetCommands.add(90002);
        Page.renderFlyingFleets();
        window.__flightErrors=[];window.__flightListener=e=>__flightErrors.push(e.message||String(e.reason));
        addEventListener('error',__flightListener);addEventListener('unhandledrejection',__flightListener);
        """)

    def run(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page.Name==='FleetsPageClass'&&WS.ws.readyState===1"))
        try:
            self.fixture()
            for width, height in [(1440, 1000), (768, 1024), (600, 800), (390, 844), (320, 740)]:
                self.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
                    'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 700}})
                self.js("document.querySelector('.FleetFlights').scrollIntoView({block:'start'})")
                self.shot(str(width) + '-flight-cards')
                if '--capture-only' in sys.argv:
                    continue
                result = self.js("""
                const card=document.querySelector('.FleetFlightCard'),rows=[...card.querySelectorAll('.FleetFlightCommandRow')];
                const rect=e=>e.getBoundingClientRect().toJSON();
                return {width:innerWidth,card:rect(card),overflow:card.scrollWidth-card.clientWidth,
                    timers:[...card.querySelectorAll('.FleetFlightTiming')].map(e=>({extra:e.querySelectorAll('span').length,tooltip:$(e).data('tooltip')})),
                    rows:rows.map(e=>({row:rect(e),name:rect(e.querySelector('.FleetFlightCommandName')),
                        target:rect(e.querySelector('.FleetFlightCommandTarget')),time:rect(e.querySelector('.FleetFlightCommandTime'))}))};
                """)
                assert result['overflow'] == 0 and result['card']['right'] <= width + 1, result
                assert all(t['extra'] == 0 and ':' in t['tooltip'] for t in result['timers']), result
                for field in ['name', 'target', 'time']:
                    lefts = [r[field]['left'] for r in result['rows']]
                    assert max(lefts) - min(lefts) <= 1, result
                assert all(r['target']['width'] > 0 for r in result['rows']), result
                assert all(r['row']['height'] <= 22 for r in result['rows']), result
                self.results.append({'name': str(width) + '-aligned-commands-and-timers', 'passed': True})
                print('OK ' + self.results[-1]['name'], flush=True)

            self.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
                'width': 1440, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False}})
            for fleet_id in [90001, 90002]:
                self.js("""
                const row=Page.flyingFleetRows[arguments[0]],r=row.Track[0].getBoundingClientRect();
                ToolTip.show({currentTarget:row.Track[0],pageX:r.left+r.width/2+scrollX,pageY:r.top+scrollY});
                """, fleet_id)
                self.wait(lambda: self.js("return ToolTip.$Tip.is(':visible')&&Number(ToolTip.$Tip.css('opacity'))>=.99"))
                self.shot('tooltip-' + str(fleet_id))
                if '--capture-only' not in sys.argv:
                    assert self.js("""
                        const f=Page.flyingFleetRows[arguments[0]].Flight;
                        const tip=ToolTip.$Tip[0],values=[...tip.querySelectorAll('.FleetFlightProgressTooltipRoute dd')].map(e=>e.textContent);
                        return values[0]===Page.formatFleetCoordinate(f.segment_start)
                            &&values[1]===Page.formatFleetCoordinate(f.segment_end)
                            &&tip.querySelector('.FleetFlightProgressTooltipArrival time').textContent===formatTimestamp(f.end_time,'timedate');
                    """, fleet_id)
                    self.results.append({'name': 'tooltip-current-segment-and-deadline-' + str(fleet_id), 'passed': True})
                self.js('ToolTip.hide()')
            if '--capture-only' not in sys.argv:
                assert self.js("""
                    const row=Page.flyingFleetRows[90001],f=row.Flight;
                    return $(row).find('.FleetFlightArrival').data('tooltip').includes(formatTimestamp(f.route_leg.arrives_at,'timedate'))
                        &&$(row).find('.FleetFlightMissionTiming').data('tooltip').includes(formatTimestamp(f.mission_end_time,'timedate'))
                        &&row.Remaining.text().startsWith('≈')&&row.MissionRemaining.text().startsWith('≈');
                """)
                self.results.append({'name': 'absolute-times-only-in-tooltip-estimate-preserved', 'passed': True})
                self.js("window.__flightBefore=Page.flyingFleetRows[90001].Remaining.text()")
                self.wait(lambda: self.js("return Page.flyingFleetRows[90001].Remaining.text()!==__flightBefore"), seconds=5)
                self.results.append({'name': 'countdown-keeps-ticking', 'passed': True})
                self.js("Page.flyingFleetRows[90001].find('.FleetFlightCommandsButton')[0].click();Page.renderFlyingFleets()")
                assert self.js("return !Page.flyingFleetRows[90001].find('.FleetFlightCommands').is(':visible')&&Page.flyingFleetRows[90001].find('.FleetFlightCommandsButton').attr('aria-expanded')==='false'")
                self.js("Page.flyingFleetRows[90001].find('.FleetFlightCommandsButton')[0].click()")
                assert self.js("return Page.flyingFleetRows[90001].find('.FleetFlightCommands').is(':visible')")
                self.results.append({'name': 'commands-toggle-survives-rerender', 'passed': True})
                assert self.js("""
                    const f=Page.flyingFleetRows[90001].Flight;
                    for(const is_return of [false,true]){
                        const text=Page.createFlyingFleetProgressTooltip({...f,route_leg:null,is_return},'Полет','Транспорт');
                        const values=$(text).find('dd').toArray().map(e=>e.textContent);
                        if(values[0]!==Page.formatFleetCoordinate(f.segment_start)||values[1]!==Page.formatFleetCoordinate(f.segment_end))return false;
                    }return true;
                """)
                self.results.append({'name': 'segment-independent-of-route-leg-and-return-flag', 'passed': True})
                assert self.js("""
                    const f=Page.flyingFleetRows[90001].Flight,error='Пауза: недоступна цель следующего этапа';
                    const list=Page.createFlyingFleetCommands({...f,commands:[{...f.commands[3],status:'paused',estimated_time:null,plan_error:error}]});
                    return list.find('.FleetFlightCommandRow').hasClass('Paused')&&list.find('.FleetFlightCommandTime').text()==='Пауза'
                        &&list.find('.FleetFlightCommandTime').data('tooltip')===error;
                """)
                self.results.append({'name': 'paused-command-full-reason-stays-in-tooltip', 'passed': True})
                self.resume_dialog()
                self.whole_route_progress()
                self.track_fill_geometry()
                assert self.js("return __flightErrors.filter(e=>e!=='ResizeObserver loop completed with undelivered notifications.').length===0")
                self.out.joinpath('flight-results.json').write_text(json.dumps(self.results, ensure_ascii=False, indent=2))
            print(json.dumps({'passed': len(self.results), 'artifacts': str(self.out), 'gameMissionsSent': 0}, ensure_ascii=False))
        finally:
            self.js('ToolTip.hide();Dialog.close();if(window.__resumeOriginalEmit)GameEvents.emit=__resumeOriginalEmit;removeEventListener("error",__flightListener);removeEventListener("unhandledrejection",__flightListener)')
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
            self.call('/refresh', {})

    def resume_dialog(self):
        self.js("""
            window.__resumeFixture={...Page.flyingFleetRows[90001].Flight,id:90003,is_own:true,
                control:{paused:true,reason:'fuel',can_continue:true},resources:{903:{id:903,count:1234}}};
            Page.messageData.data.Page.FlyingFleets[90003]=__resumeFixture;
            window.__resumeMessages=[];window.__resumeOriginalEmit=GameEvents.emit;
            GameEvents.emit=function(event,payload){
                if(event==='SendServer'&&payload.action==='ResumeFleet'){__resumeMessages.push(payload);return;}
                return __resumeOriginalEmit.call(this,event,payload);
            };
        """)
        assert self.js("""
            const card=Page.createFlyingFleetRow(__resumeFixture);
            if(card.find('.FleetFlightResumeButton').length!==1||card.find('.FleetFlightResumeCargoButton').length)return false;
            card.find('.FleetFlightResumeButton').trigger('click');
            return __resumeMessages.length===0&&$(Dialog.dialogDiv).find('.FleetResumeForm').length===1
                &&$(Dialog.dialogDiv).find('input[type=radio]').toArray().map(e=>e.value).join(',')==='available,segment,route';
        """)
        self.results.append({'name': 'one-resume-button-opens-three-options-without-request', 'passed': True})
        self.js('Dialog.close()')
        self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')"))

        for width, height in [(1440, 1000), (600, 800), (390, 844), (320, 568), (844, 390)]:
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
                'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 900}})
            self.js('Page.showFleetResume(90003)')
            self.wait(lambda: self.js("return $(Dialog.dialogDiv).is(':visible')&&Number($(Dialog.dialogDiv).css('opacity'))>=.99"))
            result = self.js("""
                const d=Dialog.dialogDiv,c=d.querySelector('dialog-content'),r=d.getBoundingClientRect();
                const buttons=[...d.querySelectorAll('dialog-buttons button')].map(e=>e.getBoundingClientRect().toJSON());
                return {width:innerWidth,height:innerHeight,dialog:r.toJSON(),overflow:c.scrollWidth-c.clientWidth,buttons};
            """)
            assert result['dialog']['left'] >= 0 and result['dialog']['right'] <= width + 1, result
            assert result['dialog']['top'] >= 0 and result['dialog']['bottom'] <= height + 1 and result['overflow'] == 0, result
            assert all(b['top'] >= 0 and b['bottom'] <= height + 1 for b in result['buttons']), result
            self.shot(str(width) + '-resume-dialog')
            self.results.append({'name': str(width) + '-resume-dialog-fits-screen', 'passed': True})
            self.js('Dialog.close()')
            self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')"))

        for mode in ['available', 'segment', 'route']:
            self.js('Page.showFleetResume(90003)')
            self.wait(lambda: self.js("return $(Dialog.dialogDiv).is(':visible')"))
            assert self.js("""
                const mode=arguments[0],d=$(Dialog.dialogDiv),before=__resumeMessages.length;
                d.find(`input[value="${mode}"]`).prop('checked',true);
                d.find('.FleetResumeSubmit').trigger('click').trigger('click');
                const request=__resumeMessages.at(-1);
                if(__resumeMessages.length!==before+1||request.data.fuelMode!==mode||request.data.fleetId!==90003)return false;
                request.onError({message:'Проверка отказа: недостаточно дейтерия'});
                return d.find('.FleetResumeError').is(':visible')&&!d.find('.FleetResumeSubmit').prop('disabled');
            """, mode)
            self.results.append({'name': 'resume-' + mode + '-payload-doubleclick-guard-inline-error', 'passed': True})
            self.js("$(Dialog.dialogDiv).find('.FleetResumeSubmit').trigger('click');__resumeMessages.at(-1).onSuccess()")
            self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')"))

        assert self.js("""
            Page.messageData.data.Page.FlyingFleets[90003]={...__resumeFixture,fuel:0,resources:{}};
            Page.showFleetResume(90003);
            return $(Dialog.dialogDiv).find('input:enabled').length===0&&$(Dialog.dialogDiv).find('.FleetResumeSubmit').prop('disabled');
        """)
        self.results.append({'name': 'empty-tank-and-cargo-no-submit', 'passed': True})
        self.js('Dialog.close();GameEvents.emit=__resumeOriginalEmit;delete window.__resumeOriginalEmit')

    def whole_route_progress(self):
        assert self.js("""
            const f=__resumeFixture,now=GameServerTime.now();
            const active={started_at:now-50,ends_at:now+50,span:1};
            const route_progress={completed:1,total:3,active,boundaries:[1,2,3]};
            const moving={...f,route_progress,is_return:true,blocked_reason:null};
            const half=Page.getFlyingFleetLegMetrics(moving,now);
            if(Math.abs(half.progress-.5)>1e-9||half.markerProgress!==half.progress)return false;
            if(Page.getFlyingFleetLegMetrics({...moving,route_progress:{...route_progress,completed:2}},now+50).progress!==1)return false;
            for(const direction of ['holding','expedition','outbound']){
                const state={...moving,route_leg:{...moving.route_leg,direction},route_progress:{...route_progress,active:null}};
                if(Page.getFlyingFleetLegMetrics(state,now).progress!==1/3||Page.getFlyingFleetLegMetrics(state,now+10000).progress!==1/3)return false;
            }
            const paused={...moving,blocked_reason:'Ручная остановка',route_progress:{...route_progress,completed:.6,active:null}};
            Page.messageData.data.Page.FlyingFleets={90003:paused};Page.renderFlyingFleets();
            const row=Page.flyingFleetRows[90003];
            if(Math.abs(parseFloat(row.Fill[0].style.width)-20)>1e-6||Math.abs(parseFloat(row.Marker[0].style.left)-20)>1e-6)return false;
            window.__progressFrozen=row.Fill[0].style.width;
            window.__progressFrozenAt=GameServerTime.now();
            return row.Track.attr('aria-label')==='Прогресс всего маршрута'&&row.Remaining.text()==='Приостановлен';
        """)
        self.results.append({'name': 'whole-route-return-forward-actions-and-pauses-frozen', 'passed': True})
        self.wait(lambda: self.js("return GameServerTime.now()-__progressFrozenAt>=2"), seconds=5)
        assert self.js("return Page.flyingFleetRows[90003].Fill[0].style.width===__progressFrozen")
        assert self.js("""
            Page.renderFlyingFleets();const row=Page.flyingFleetRows[90003];
            return row.Fill[0].style.width===__progressFrozen&&row.Marker[0].style.left===__progressFrozen;
        """)
        self.results.append({'name': 'authoritative-rerender-keeps-stop-position', 'passed': True})
        assert self.js("""
            const own={...__resumeFixture,control:{paused:false,holding:true,can_continue:true}};
            Page.messageData.data.Page.FlyingFleets[90003]=own;
            const row=Page.createFlyingFleetRow(own);
            if(row.find('.FleetFlightResumeButton').length!==1)return false;
            row.find('.FleetFlightResumeButton').trigger('click');
            return $(Dialog.dialogDiv).find('.FleetResumeForm input:enabled').length===3;
        """)
        self.results.append({'name': 'manual-hold-opens-same-three-option-dialog', 'passed': True})
        self.shot('manual-stop-progress-and-dialog')
        self.js('Dialog.close()')

    def track_fill_geometry(self):
        # Проверяем реальную геометрию DOM, а не только совпадение inline-процентов.
        # При отзыве старое CSS могло прижать заливку справа, оставив маркер слева.
        for width, height in [(1440, 1000), (390, 844), (320, 740)]:
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
                'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 700}})
            result = self.js("""
                const problems=[],base=__resumeFixture,now=GameServerTime.now();
                const scenarios=[
                    {name:'outbound',is_return:false},
                    {name:'return-after-cancel',is_return:true},
                    {name:'paused-return',is_return:true,blocked_reason:'Ручная остановка'},
                    {name:'holding',is_return:false,direction:'holding'},
                    {name:'expedition',is_return:false,direction:'expedition'},
                    {name:'legacy-outbound',is_return:false,legacy:true},
                    {name:'legacy-return',is_return:true,legacy:true}
                ];
                for(const s of scenarios) for(const progress of [0,.25,.75,1]){
                    const f={...base,id:90003,is_return:s.is_return,blocked_reason:s.blocked_reason||null,
                        route_progress:s.legacy?null:{completed:progress*4,total:4,active:null,boundaries:[1,2,3,4]},
                        route_leg:{...base.route_leg,direction:s.direction||(s.is_return?'return':'outbound'),
                            started_at:now-100*progress,arrives_at:now+100*(1-progress)}};
                    Page.messageData.data.Page.FlyingFleets={90003:f};Page.renderFlyingFleets();
                    const row=Page.flyingFleetRows[90003],track=row.Track[0],r=track.getBoundingClientRect();
                    const fill=row.Fill[0].getBoundingClientRect(),marker=row.Marker[0].getBoundingClientRect();
                    const style=getComputedStyle(track),left=r.left+parseFloat(style.borderLeftWidth),right=r.right-parseFloat(style.borderRightWidth);
                    const center=marker.left+marker.width/2,reverse=s.legacy&&s.is_return;
                    const anchorError=Math.abs(reverse?fill.right-right:fill.left-left);
                    const markerError=Math.abs(reverse?fill.left-center:fill.right-center);
                    if(anchorError>1||markerError>1)problems.push({scenario:s.name,progress,anchorError,markerError});
                }
                return {width:innerWidth,scenarios:scenarios.length,samples:scenarios.length*4,problems};
            """)
            assert not result['problems'], result
            self.results.append({'name': str(width)+'-whole-route-return-fill-geometry', 'passed': True, **result})
            print('OK '+self.results[-1]['name'], flush=True)
            self.js("Page.messageData.data.Page.FlyingFleets={90003:{...__resumeFixture,is_return:true,blocked_reason:null,route_progress:{completed:1,total:4,active:null,boundaries:[1,2,3,4]}}};Page.renderFlyingFleets();document.querySelector('.FleetFlightCard').scrollIntoView({block:'center'})")
            self.shot(str(width)+'-return-whole-route-fill')


if __name__ == '__main__':
    FlightCheck().run()
