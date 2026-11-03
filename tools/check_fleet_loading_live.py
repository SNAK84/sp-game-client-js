"""ЯВНЫЙ игровой тест snak1/Fleet 3 через кнопки настоящего SPA.

python3 tools/check_fleet_loading_live.py --execute
Две погрузки у базы → выгрузка; отказ → повтор → правка плана → продолжение.
--start-journey вместо короткого теста запускает долгий рейс 20 → 28 → 31 → 20.
Не меняет аккаунты, технологии, серверные часы или настройки игры.
"""
import argparse
import json
import time
from check_fleet_route_layout import RouteCheck


class LiveLoadingCheck(RouteCheck):
    def select_planet(self, planet):
        self.js("GameEvents.emit('SendServer',{mode:'fleets',action:'planetselect',NotOverlay:true,data:{planetId:arguments[0]}})", planet)
        self.wait(lambda: self.js("return Number(Page.messageData.data.PlanetList?.current_planet)===arguments[0]&&WS.requestCallbacks.size===0", planet))

    def start_journey(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&!!Page?.Name&&WS.ws.readyState===1&&WS.requestCallbacks.size===0"))
        self.fleets(); self.fleet_id = 3
        assert self.js("return [20,28,31].every(id=>Page.messageData.data.PlanetList.Planets.some(p=>p.id===id))"), 'Требуется тестовый snak1'
        self.select_planet(20)
        fleet = self.current()
        assert fleet and fleet['status'] == 0 and fleet['current'] == dict(type=1, galaxy=1, system=8, orbit=4, objectType=1), 'Требуется свободный тестовый Fleet 3 snak1 на [1:8:4]'
        stocks = {}
        try:
            for planet in [28, 31, 20]:
                self.select_planet(planet)
                stocks[planet] = self.js("return Object.fromEntries([901,902,903].map(id=>[id,Number(Page.messageData.data.TopNav.Resources[id].count)]))")
            assert stocks[20]['903'] >= 500 and stocks[28]['901'] >= 100 and stocks[28]['902'] >= 20 and stocks[28]['903'] >= 10, stocks
            assert stocks[31]['901'] >= 50 and stocks[31]['902'] >= 30 and stocks[31]['903'] >= 110, stocks
            self.fleets()
            previews = []
            for origin, target in [(8, 7), (7, 6), (6, 8)]:
                self.js("""
                window.__loadingJourneyPreview=null;
                GameEvents.emit('SendServer',{mode:'fleets',action:'GetAvailableMissions',NotOverlay:true,
                    data:{fleetId:3,forPlan:true,speedFactor:10,
                        origin:{type:1,galaxy:1,system:arguments[0],orbit:4,objectType:1},
                        coordinates:{type:1,galaxy:1,system:arguments[1],orbit:4,objectType:1}},
                    onSuccess:m=>__loadingJourneyPreview=m.getData('Page')?.TravelInfo,
                    onError:e=>__loadingJourneyPreview={failed:e.message}});
                """, origin, target)
                self.wait(lambda: self.js('return __loadingJourneyPreview!==null'))
                preview = self.js('return __loadingJourneyPreview')
                assert preview and 'failed' not in preview, preview
                previews.append(preview)
            self.open(390, 844)
            self.js("$('#FleetPlanFuel').val(500).trigger('input')")
            self.loading_controls(0, 0, {'901': 100, '902': 20, '903': 10}, 28)
            self.js("document.querySelector('.FleetPlanAdd').click()")
            self.loading_controls(1, 100, {'901': 50, '902': 30, '903': 10}, 31)
            self.submit()
            self.wait(lambda: self.js("return !!Page.messageData.data.Page.FlyingFleets?.[3]"))
            result = {'status': 'started-not-completed', 'fleetId': 3, 'planets': [20, 28, 31, 20], 'previews': previews,
                'stockBefore': stocks, 'initialFuel': 500, 'expectedCargo': {'901': 150, '902': 50, '903': 20},
                'fleet': self.current()}
            self.out.joinpath('journey.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
            self.shot('loading-journey-started')
            print(json.dumps({'status': result['status'], 'fleetId': 3,
                'estimatedSeconds': sum(p['duration']['max'] for p in previews),
                'missionEnd': result['fleet']['mission_end_time'], 'artifacts': str(self.out)}, ensure_ascii=False), flush=True)
        finally:
            self.js('Dialog.close();delete window.__loadingJourneyPreview')
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})

    def fleets(self):
        self.js("GameEvents.emit('SendServer',{mode:'fleets',NotOverlay:true})")
        self.wait(lambda: self.js("return Page.Name==='FleetsPageClass'&&WS.requestCallbacks.size===0"))

    def current(self):
        return self.js('return Page.messageData.data.Page.FlyingFleets?.[3]||Page.messageData.data.Page.FleetList?.[3]')

    def loading_controls(self, index, fuel, resources, planet=20):
        self.js("document.querySelectorAll('.FleetPlanSteps .FleetPlanStop')[arguments[0]].click()", index)
        self.js("$('.FleetPlanStep:visible .FleetPlanModeSelector button[value=load]')[0].click()")
        self.js("""
        const p=$('.FleetPlanStep:visible');
        p.find('select[aria-label="Своя планета"]').val(String(arguments[2])).trigger('change');
        p.find('input[aria-label="Добавить топливо на остановке"]').val(arguments[0]).trigger('input');
        for(const id of [901,902,903])p.find('input[aria-label="Погрузить '+id+'"]').val(arguments[1][id]||0).trigger('input');
        """, fuel, resources, planet)
        self.settled()

    def submit(self):
        self.settled()
        assert not self.js("return document.querySelector('.FleetPlanSubmit').disabled"), self.js("return document.querySelector('.FleetPlanEditor').innerText")
        self.js("document.querySelector('.FleetPlanSubmit').click()")
        result = self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')?'accepted':document.querySelector('.FleetPlanError')?.textContent||null"))
        assert result == 'accepted', result

    def returned(self, since):
        self.fleets()
        self.wait(lambda: self.js("const f=Page.messageData.data.Page.FleetList?.[3];return f&&f.current_position_time>=arguments[0]&&f.status===0", since))
        self.js("GameEvents.emit('SendServer',{mode:'messages',NotOverlay:true})")
        self.wait(lambda: self.js("return Page.Name==='MessagesPageClass'&&WS.requestCallbacks.size===0"))
        messages = self.js("""
        return Object.values(Page.messageData.data.Page.allMessages||{}).map(m=>({...m,data:typeof m.data==='string'?JSON.parse(m.data):m.data}))
            .filter(m=>m.data?.FleetId===3&&m.time>=arguments[0]&&m.subject==='subject.Transport.Return');
        """, since)
        assert len(messages) == 1, messages
        self.fleets()
        return messages[0]

    def resume(self):
        self.js('Page.showFleetResume(3)')
        self.wait(lambda: self.js("return $(Dialog.dialogDiv).is(':visible')&&!!document.querySelector('.FleetResumeSubmit')"))
        assert self.js("return document.querySelector('input[name=fleet-resume-mode]:checked').value") == 'available'
        self.js("document.querySelector('.FleetResumeSubmit').click()")
        self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')"))

    def run(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&!!Page?.Name&&WS.ws.readyState===1&&WS.requestCallbacks.size===0"))
        self.fleets()
        self.fleet_id = 3
        f = self.current()
        assert f and f['status'] == 0 and f['current'] == dict(type=1, galaxy=1, system=8, orbit=4, objectType=1), 'Требуется свободный тестовый Fleet 3 snak1 на [1:8:4]'
        assert 'loading_pending' in f['control'], 'Сначала активировать новый backend'
        # Сохраняем только игровые поля, без token/request headers.
        self.js("""
        window.__liveLoadingFrames=[];
        window.__liveLoadingListener=event=>{try{const m=JSON.parse(event.data),p=m.data?.Page;
            const f=p?.FleetList?.[3]||p?.FlyingFleets?.[3];
            if(f)__liveLoadingFrames.push({at:Date.now()/1000,mode:m.mode,fleet:f});
        }catch{}};
        WS.ws.addEventListener('message',__liveLoadingListener);
        """)
        try:
            since = time.time() - 1
            self.open(390, 844)
            self.js("$('#FleetPlanFuel').val(0).trigger('input')")
            self.loading_controls(0, 20, {'901': 7, '902': 3, '903': 2})
            self.js("document.querySelector('.FleetPlanAdd').click()")
            self.loading_controls(1, 30, {'901': 11, '902': 5, '903': 4})
            self.submit()
            result = self.returned(since)
            assert result['data']['Resources'] == {'901': 18, '902': 8, '903': 6}, result
            assert result['data']['ResourcesFuelReturned'] == {'903': 50}, result
            self.results.append({'name': 'two-loads-return', 'report': result})
            print('PASS live: две погрузки и конечная выгрузка, груз 18/8/6, топливо 50', flush=True)

            since = time.time() - .1
            self.open(390, 844)
            self.js("$('#FleetPlanFuel').val(0).trigger('input')")
            self.loading_controls(0, 1e10, {'901': 100})
            self.submit()
            self.wait(lambda: self.js("return Page.messageData.data.Page.FlyingFleets?.[3]?.control?.reason==='load'"))
            paused = self.current()
            assert paused['fuel'] == 0 and all(r['count'] == 0 for r in paused['resources'].values()), paused
            self.resume()
            # Ждём завершения явной повторной попытки, а не старого paused snapshot.
            version = paused['control']['version']
            self.wait(lambda: self.js("const f=Page.messageData.data.Page.FlyingFleets?.[3];return f?.control?.reason==='load'&&f.control.version!==arguments[0]", version))
            self.open(390, 844)
            self.loading_controls(0, 20, {'901': 7})
            self.submit()
            self.wait(lambda: self.js("const f=Page.messageData.data.Page.FlyingFleets?.[3];return f?.control?.reason==='manual'&&f.control.loading_pending===true"))
            self.resume()
            result = self.returned(since)
            assert result['data']['Resources'] == {'901': 7} and result['data']['ResourcesFuelReturned'] == {'903': 20}, result
            self.results.append({'name': 'pause-retry-edit-resume', 'report': result})
            print('PASS live: нехватка → пауза → retry без топлива → правка → погрузка → возврат', flush=True)
            self.out.joinpath('results.json').write_text(json.dumps(self.results, ensure_ascii=False, indent=2))
            self.out.joinpath('frames.json').write_text(json.dumps(self.js('return __liveLoadingFrames'), ensure_ascii=False, indent=2))
            self.shot('loading-live-final')
            print('ARTIFACTS ' + str(self.out), flush=True)
        finally:
            self.js("WS.ws.removeEventListener('message',__liveLoadingListener);delete window.__liveLoadingListener;delete window.__liveLoadingFrames;Dialog.close()")
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='Разрешить реальные игровые команды только snak1/Fleet 3')
    parser.add_argument('--start-journey', action='store_true', help='Запустить отдельный долгий рейс, не ждать завершения')
    args = parser.parse_args()
    if not args.execute:
        parser.error('Требуется явный --execute')
    check = LiveLoadingCheck()
    check.start_journey() if args.start_journey else check.run()
