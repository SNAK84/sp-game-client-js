"""Read-only UI regression фаланги и обзора в существующей SPA-сессии snak1.

python3 tools/check_fleet_event_views.py
Снимки подставляются только в браузере. Сканы, миссии и записи ресурсов
не отправляются; режим страницы и настоящие данные восстанавливаются reload.
"""
import json
import time
from pathlib import Path

from check_fleet_mission_layout import Check


class FleetEventViewsCheck(Check):
    def reload(self, mode):
        self.js("Data.mode=arguments[0]", mode)
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page.messageData?.mode===arguments[0]&&Page.pageActive&&document.contains(Page.$Content[0])&&WS.ws.readyState===1&&WS.requestCallbacks.size===0", mode))
        self.js("""
            window.__viewErrors=[];window.__viewWrites=[];
            addEventListener('error',e=>__viewErrors.push(e.message));
            addEventListener('unhandledrejection',e=>__viewErrors.push(String(e.reason)));
            window.__viewSubmit=WS.Submit;
            WS.Submit=function(mode,action,data,options){
                if(action==='PhalanxScan'){options?.onSuccess?.({});return;}
                if(options?.kind==='write'){__viewWrites.push(action);throw Error('UI test запрещает игровые записи');}
                return __viewSubmit.call(this,mode,action,data,options);
            };
        """)

    def record(self, name, data):
        self.results.append({'name': name, 'data': data})
        print('OK ' + name, flush=True)

    def tooltip(self, selector):
        element = self.call('/element', {'using':'css selector','value':selector})
        key = 'element-6066-11e4-a52e-4f735466cecf'
        self.call('/actions', {'actions':[{'type':'pointer','id':'view-mouse','parameters':{'pointerType':'mouse'},'actions':[
            {'type':'pointerMove','origin':'viewport','x':1,'y':1,'duration':100},
            {'type':'pointerMove','origin':{key:element[key]},'x':0,'y':0,'duration':100}]}]})
        if self.js('return isTouch'):
            self.call('/element/'+element[key]+'/click',{})
        self.wait(lambda:self.js("return ToolTip.$Tip.is(':visible')&&Number(ToolTip.$Tip.css('opacity'))>.95"))
        time.sleep(.1)
        return self.js("const t=ToolTip.$Tip[0],r=t.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,width:innerWidth,overflow:t.scrollWidth-t.clientWidth,text:t.textContent,visible:ToolTip.$Tip.is(':visible')}" )

    def diagnostics(self):
        result = self.js("return {writes:__viewWrites,errors:__viewErrors.filter(e=>e!=='ResizeObserver loop completed with undelivered notifications.')}" )
        assert not result['writes'] and not result['errors'], result
        self.record('browser-diagnostics', result)

    def phalanx(self):
        self.reload('galaxy')
        # Данные только UI: не требуют настоящего полёта или оплаты фаланги.
        self.js("""
            window.__viewFixture={token:'',targetName:'Тест <img onerror=bad()>',
                coordinates:{type:1,galaxy:1,system:8,orbit:4,objectType:1},cost:5000,scannedAt:GameServerTime.now(),
                fleets:[{id:901,name:'Очень длинное имя <b>без HTML</b>',ownerName:'Player10',mission:10,
                    returning:false,from:{type:1,galaxy:1,system:8,orbit:4,objectType:1},
                    to:{type:1,galaxy:1,system:7,orbit:4,objectType:1},arrivesAt:GameServerTime.now()+180,
                    estimated:true,shipsCount:10,ships:[{id:202,count:10}],resources:{901:1250,902:250,903:0}}]};
            __viewFixture.fleets.push({...__viewFixture.fleets[0],id:902,name:'Возврат',returning:true,
                estimated:false,ships:[{id:202,count:null},{id:204,count:null}],shipsCount:25,resources:{901:0,902:0,903:0}});
            __viewFixture.fleets.push({...__viewFixture.fleets[0],id:903,name:'Охранение',
                holdingUntil:GameServerTime.now()+240,mission:12});
            window.__viewOpenScan=()=>{
                const source=Number(Page.messageData.data.PlanetList.current_planet);
                Page.messageData.data.Page.Phalanx ||= {sourceId:source,cost:5000};
                Page.openPhalanx({id:20,PhalanxAvailable:true});
                __viewFixture.token=Page.phalanxPending.token;
                Page.messageData.data.Page.PhalanxScan=__viewFixture;
                window.__viewSnapshot=JSON.stringify(__viewFixture);
                Page.renderPhalanxScan();
            };
        """)
        for width, height in [(1440,1000),(390,844),(320,568)]:
            self.call('/goog/cdp/execute', {'cmd':'Emulation.setDeviceMetricsOverride','params':{
                'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700}})
            self.js('__viewOpenScan()')
            self.wait(lambda:self.js("return $(Dialog.dialogDiv).is(':visible')&&!!document.querySelector('.PhalanxFleet')"))
            time.sleep(.4)
            result = self.js("""
                const d=Dialog.dialogDiv,r=d.getBoundingClientRect(),c=d.querySelector('dialog-content');
                const rows=[...d.querySelectorAll('.PhalanxFleet')];
                const bounds=rows.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,overflow:e.scrollWidth-e.clientWidth};});
                const tooltip=$($(rows[1]).find('.OverviewFleetEventTitle').data('tooltip'));
                return {width:innerWidth,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
                    overflow:c.scrollWidth-c.clientWidth,rows:rows.length,bounds,html:!!d.querySelector('h3 img, .OverviewFleetEventTitle b'),
                    contentBottom:c.getBoundingClientRect().bottom,buttonsTop:d.querySelector('dialog-buttons').getBoundingClientRect().top,
                    route:rows[0].querySelector('.PhalanxFleetRoute').textContent,
                    unknownCounts:tooltip.find('.OverviewFleetTooltipShip b').map((_,e)=>e.textContent).get(),
                    total:tooltip.find('.OverviewFleetTooltipTotal b').text(),cargoEmpty:tooltip.text().includes('Пусто'),
                    disabled:rows.every(e=>e.querySelector('.PhalanxInterceptButton').disabled),
                    arrival:$(rows[0]).find('.OverviewFleetEventCountdown').data('tooltip')};
            """)
            assert result['rows'] == 3 and not result['html'] and result['disabled'], result
            assert result['left'] >= -.5 and result['right'] <= width+.5 and result['overflow'] == 0, result
            assert result['top'] >= -.5 and result['bottom'] <= height+.5, result
            assert result['contentBottom'] <= result['buttonsTop']+1, result
            assert all(b['height'] <= 60 and b['overflow'] == 0 and b['right'] <= width for b in result['bounds']), result
            assert result['route'] == '[1:8:4] → [1:7:4]' and '≈' in result['arrival'], result
            assert result['unknownCounts'] == ['—','—'] and result['total'] == '25' and result['cargoEmpty'], result
            self.shot('phalanx-compact-'+str(width))
            tip = self.tooltip('.PhalanxFleet .OverviewFleetEventTitle')
            assert tip['visible'] and tip['height'] > 0 and tip['left'] >= -.5 and tip['right'] <= width+.5 and tip['overflow'] == 0, tip
            assert 'Груз' in tip['text'] and 'Металл' in tip['text'], tip
            self.shot('phalanx-composition-'+str(width))
            intercept_tip = self.tooltip('.PhalanxIntercept')
            assert 'этапе 3Б' in intercept_tip['text'] and 'недоступен' in intercept_tip['text'], intercept_tip
            self.js("document.querySelector('.PhalanxInterceptButton').click()")
            before = self.js("return document.querySelector('.OverviewFleetEventCountdown').textContent")
            time.sleep(1.15)
            assert self.js("return JSON.stringify(__viewFixture)===__viewSnapshot&&document.querySelector('.OverviewFleetEventCountdown').textContent!==arguments[0]",before)
            self.record('phalanx-'+str(width), result)
            self.js('Dialog.close()')
            self.wait(lambda:self.js("return !$(Dialog.dialogDiv).is(':visible')&&Page.phalanxTimer===null"))
        # Новое сканирование заменяет старый таймер, скрытие страницы отменяет новый.
        self.js('__viewOpenScan();window.__viewOldTimer=Page.phalanxTimer;Page.scanPhalanx({id:20},$(".PhalanxScan"));')
        assert self.js('return !Page.ownedTimers.has(__viewOldTimer)&&Page.phalanxTimer===null')
        self.js('Page.messageData.data.Page.PhalanxScan={...__viewFixture,token:Page.phalanxPending.token};Page.renderPhalanxScan();')
        self.wait(lambda:self.js('return Page.phalanxTimer!==null'))
        self.js('window.__viewPage=Page;Page.Hide()')
        assert self.js('return __viewPage.phalanxTimer===null&&__viewPage.ownedTimers.size===0')
        self.record('rescan-close-page-timer-cleanup-and-immutable-snapshot', True)
        self.diagnostics()

    def overview(self):
        self.reload('overview')
        self.js("""
            window.__viewFleet={id:901,name:'Транспорт',mission:10,is_incoming:false,
                route_leg:{start:{type:1,galaxy:1,system:8,orbit:4,objectType:1},
                    target:{type:1,galaxy:1,system:7,orbit:4,objectType:1},arrives_at:GameServerTime.now()+120,direction:'outbound'},
                ships:{202:{id:202,count:3}},resources:{901:{id:901,name:'metal',count:1250},
                    902:{id:902,count:250},903:{id:903,count:50},921:{id:921,count:10}}};
            Page.messageData.data.Page.FlyingFleets=[__viewFleet];Page.renderFlyingFleetsOverview();
        """)
        result = self.js("""
            const t=$($('.OverviewFleetEventTitle').data('tooltip'));
            return {cargo:t.find('.OverviewFleetTooltipResource b').map((_,e)=>e.textContent).get(),
                headings:t.find('.OverviewFleetTooltipTitle').map((_,e)=>e.textContent).get(),
                ships:t.find('.OverviewFleetTooltipTotal b').text()};
        """)
        assert len(result['cargo']) == 4 and result['headings'] == ['Состав флота','Груз'] and result['ships'] == '3', result
        for width in [1440,390,320]:
            self.call('/goog/cdp/execute',{'cmd':'Emulation.setDeviceMetricsOverride','params':{
                'width':width,'height':844,'deviceScaleFactor':1,'mobile':width<700}})
            bounds = self.tooltip('.OverviewFleetEventTitle')
            assert bounds['visible'] and bounds['height'] > 0, bounds
            assert bounds['left'] >= -1 and bounds['right'] <= width+1 and bounds['overflow'] == 0, bounds
            assert 'Груз' in bounds['text'] and 'Металл' in bounds['text'], bounds
            self.record('overview-cargo-tooltip-'+str(width), bounds)
            self.shot('overview-cargo-'+str(width))
            self.js('ToolTip.hide();ToolTip.parent=null;')
            self.wait(lambda:self.js("return !ToolTip.$Tip.is(':visible')"))
        # Груз не раскрыт != ноль; отсутствие состава не скрывает известный груз.
        cases = self.js("""
            const text=f=>$(Page.createFleetCompositionTooltip(f)).text();
            return {unknown:text({}),zero:text({ships:{},resources:{901:{id:901,count:0}}}),
                cargoOnly:text({resources:{901:100}}),unknownValue:text({resources:{901:null}}),
                escaped:!$(Page.createFleetCompositionTooltip({ships:[{id:9999,name:'<img onerror=bad()>',count:1}]})).find('img').length};
        """)
        assert 'Груз не раскрыт' in cases['unknown'] and 'Пусто' not in cases['unknown'], cases
        assert 'Пусто' in cases['zero'] and 'Состав флота не раскрыт' in cases['cargoOnly'] and '100' in cases['cargoOnly'], cases
        assert 'не раскрыто' in cases['unknownValue'] and cases['escaped'], cases
        self.record('overview-cargo-dto-numeric-zero-unknown-escaping', cases)
        self.record('overview-dto-content', result)
        self.diagnostics()

    def run(self):
        original_mode = self.js('return Data.mode')
        print('ARTIFACTS '+str(self.out), flush=True)
        try:
            root = Path(__file__).resolve().parents[1]
            for file in ['js/BasePageClass.js','js/pages/GalaxyPageClass.js','js/pages/OverViewPageClass.js']:
                assert self.js('new Function(arguments[0]);return true;',root.joinpath(file).read_text())
            self.record('javascript-parse-chromium', True)
            self.phalanx()
            self.overview()
            self.out.joinpath('fleet-event-views.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
            print(json.dumps({'passed':len(self.results),'artifacts':str(self.out),'paidScans':0,'missionsSent':0},ensure_ascii=False))
        finally:
            self.call('/goog/cdp/execute', {'cmd':'Emulation.clearDeviceMetricsOverride','params':{}})
            self.js('Data.mode=arguments[0]',original_mode)
            self.call('/refresh',{})


if __name__ == '__main__':
    FleetEventViewsCheck().run()
