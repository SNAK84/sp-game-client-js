"""Промежуточная погрузка: реальный SPA, только preview и перехват serializer.

Ничего не отправляет в PlayerQueue и не изменяет игровой мир.
"""
import json
from check_fleet_route_layout import RouteCheck


class LoadingCheck(RouteCheck):
    def run(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&WS.ws.readyState===1&&WS.requestCallbacks.size===0"))
        self.js("GameEvents.emit('SendServer',{mode:'fleets',NotOverlay:true})")
        self.wait(lambda: self.js("return Page.Name==='FleetsPageClass'&&WS.requestCallbacks.size===0"))
        self.fleet_id = self.js('return Number(Object.keys(Page.messageData.data.Page.FleetList)[0])')
        assert self.fleet_id, 'Нужен свой свободный флот'
        self.js("window.__loadingErrors=[];window.__loadingError=e=>__loadingErrors.push(e.message||String(e.reason));addEventListener('error',__loadingError);addEventListener('unhandledrejection',__loadingError)")
        try:
            for width, height in [(1440, 1000), (390, 844), (320, 568)]:
                self.open(width, height)
                self.js("$('.FleetPlanStep:visible .FleetPlanModeSelector button[value=load]')[0].click()")
                self.settled()
                self.geometry(str(width) + '-loading')
                state = self.js("""
                const p=$('.FleetPlanStep:visible');return {
                    panel:p.find('.FleetPlanIntermediateLoad:visible').length,
                    coordTypes:p.find('.FleetCoordinateTypeSelector:visible').length,
                    debris:p.find('.FleetObjectTypeSelector button[value=2]:visible').length,
                    fleet:p.find('select[aria-label="Целевой флот"]:visible').length,
                    shortage:p.find('select[aria-label="При нехватке для погрузки"]').val()
                }
                """)
                assert state == dict(panel=1, coordTypes=0, debris=0, fleet=0, shortage='wait'), state
                self.js("""
                const p=$('.FleetPlanStep:visible');
                const own=p.find('select[aria-label="Своя планета"]');
                own.val([...own[0].options].filter(o=>o.value).at(-1).value).trigger('change');
                p.find('input[aria-label="Добавить топливо на остановке"]').val(100).trigger('input');
                p.find('input[aria-label="Погрузить 901"]').val(200).trigger('input');
                p.find('input[aria-label="Погрузить 903"]').val(30).trigger('input');
                p.find('select[aria-label="Заполнить свободный трюм"]').val('902').trigger('change');
                p.find('select[aria-label="При нехватке для погрузки"]').val('partial').trigger('change');
                """)
                self.settled()
                payload = self.capture()
                assert payload, 'Submit не сериализовал этап'
                step = payload['plan']['steps'][0]
                assert step['kind'] == 'load' and step['fuel'] == 100 and step['resources'] == {'901': 200, '902': 0, '903': 30}, step
                assert step['fillResource'] == 902 and step['shortage'] == 'partial' and step['coordinates']['type'] == 1, step
                assert 'lastKnownPosition' not in json.dumps(payload), payload
                self.results.append(dict(name=str(width) + '-serializer', passed=True))
                self.shot(str(width) + '-intermediate-loading')
                self.js("$('.FleetPlanStep:visible .FleetPlanIntermediateLoad')[0].scrollIntoView({block:'start'})")
                self.geometry(str(width) + '-loading-controls')
                self.shot(str(width) + '-loading-controls')
                # Возврат к миссии сохраняет старые controls; скрытый load не попадёт в payload.
                self.js("$('.FleetPlanStep:visible .FleetPlanModeSelector button[value=mission]')[0].click()")
                self.settled()
                payload = self.capture()
                assert payload and payload['plan']['steps'][0]['kind'] == 'mission' and 'fuel' not in payload['plan']['steps'][0], payload
            assert self.js('return __loadingErrors') == [], self.js('return __loadingErrors')
            self.out.joinpath('results.json').write_text(json.dumps(self.results, ensure_ascii=False, indent=2))
            print('PASS loading SPA; artifacts ' + str(self.out))
        finally:
            self.js("removeEventListener('error',__loadingError);removeEventListener('unhandledrejection',__loadingError);delete window.__loadingErrors;delete window.__loadingError;Dialog.close()")
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})


if __name__ == '__main__':
    LoadingCheck().run()
