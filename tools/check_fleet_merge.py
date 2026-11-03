"""Явный E2E snak1 через настоящий SPA: python3 tools/check_fleet_merge.py --execute.

Требует Fleet 3 с одним малым транспортом и ещё один на базе 20 [1:8:4].
Нормальными игровыми командами создаёт стоянку получателя и донора,
проверяет UI/serializer и слияние; завершает план и возвращает один корабль
на планету. Без SQL, подмены времени/ответов сервера или изменения технологий.
Расходует обычное топливо на тестовые перелёты; логирует только игровые поля.
"""
import argparse
import json
import time
from check_fleet_loading_live import LiveLoadingCheck


class MergeCheck(LiveLoadingCheck):
    def fleet(self, fid):
        return self.js("return Page.messageData.data.Page.FlyingFleets?.[arguments[0]]||Page.messageData.data.Page.FleetList?.[arguments[0]]", fid)

    def mission_settled(self):
        self.wait(lambda: self.js("return Page.missionDataLoading===false&&WS.requestCallbacks.size===0"))

    def finish(self, predicate, phase):
        deadline = time.monotonic() + 900
        next_log = 0
        while time.monotonic() < deadline:
            if predicate():
                return
            if time.monotonic() > next_log:
                print('WAIT ' + phase, flush=True)
                next_log = time.monotonic() + 30
            time.sleep(.25)
        raise AssertionError('Не завершён реальный этап: ' + phase)

    def run(self, resume=False, donor_id=None):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page.Name==='FleetsPageClass'&&WS.ws.readyState===1&&!!Page.messageData.data.Page.FleetList"))
        f = self.fleet(3)
        home = dict(type=1, galaxy=1, system=8, orbit=4, objectType=1)
        assert f and ((not resume and f['status'] == 0 and f['current'] == home)
            or (resume and f.get('owner_id') == 4 and f.get('mission_start') == home and f['control']['holding'])), 'Требуется тестовый Fleet 3 snak1 дома либо подготовленная тестом стоянка'
        assert f['ships']['202']['count'] == 1 and self.js("return Page.messageData.data.Page.PlanetShips[202]?.count||0") == (0 if donor_id else 1), 'Требуются ровно два тестовых транспорта'
        if donor_id:
            donor = self.fleet(donor_id)
            assert resume and donor_id != 3 and donor and donor['status'] == 0 and donor['current'] == home and donor['ships']['202']['count'] == 1, 'Не подтверждён подготовленный тестом донор'
        self.state = {'before': f, 'ui': [], 'phases': {}}
        manual = self.js('return Boolean(Page.messageData.data.Page.FleetCapabilities.hold)')
        print('ARTIFACTS ' + str(self.out), flush=True)
        self.js("""
        window.__mergeFrames=[];
        window.__mergeListener=event=>{try{const m=JSON.parse(event.data),p=m.data?.Page;
            if(p?.FleetList||p?.FlyingFleets)__mergeFrames.push({at:Date.now()/1000,fleets:p.FleetList,flying:p.FlyingFleets});
        }catch{}};
        WS.ws.addEventListener('message',__mergeListener);
        """)
        try:
            if not resume:
                self.fleet_id = 3
                self.open(1440, 1000)
                self.js("""
                document.querySelector('.FleetPlanSteps .FleetPlanStop').click();
                const p=$('.FleetPlanStep:visible');
                p.find('.FleetPlanModeSelector button[value=move]')[0].click();
                p.find('.FleetCoordinateTypeSelector button[value=2]')[0].click();
                p.find('input[aria-label="Расстояние"]').val(0).trigger('change');
                p.find('input[aria-label="Угол"]').val(0).trigger('change');
                $('#FleetPlanFuel').val(arguments[0]?1000:0).trigger('input');
                """, manual)
                self.settled(); self.submit()
                if manual:
                    self.wait(lambda: self.js("return !!document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightStopButton')"))
                    self.js("document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightStopButton').click()")
                self.wait(lambda: self.js("const s=Page.messageData.data.Page.FlyingFleets?.[3]?.control;return arguments[0]?s?.holding:s?.reason==='fuel'", manual))
            paused = self.fleet(3); self.state['phases']['paused'] = paused
            # Создание донора — настоящая кнопка «Вывести на орбиту».
            if not donor_id:
                old_ids = self.js("return Object.keys(Page.messageData.data.Page.FleetList).map(Number)")
                self.js("Page.$Ships[202][0].Input.val(1);Page.renderNewFleetBlock();Page.$ShipsBlock.NewFleetButtons.ToOrbit[0].click()")
                self.wait(lambda: self.js("return Object.keys(Page.messageData.data.Page.FleetList).some(id=>!arguments[0].includes(Number(id)))", old_ids))
                donor_id = self.js("return Number(Object.keys(Page.messageData.data.Page.FleetList).find(id=>!arguments[0].includes(Number(id))))", old_ids)
            self.state['donorId'] = donor_id
            self.fleet_id = donor_id
            for width, height in [(1440, 1000), (390, 844), (320, 568)]:
                self.open(width, height)
                self.js("""
                document.querySelector('.FleetPlanSteps .FleetPlanStop').click();
                const p=$('.FleetPlanStep:visible');
                p.find('.FleetCoordinateTypeSelector button[value=3]')[0].click();
                p.find('select[aria-label="Целевой флот"]').val('3').trigger('change');
                """)
                self.settled()
                self.wait(lambda: self.js("return !!document.querySelector('.FleetPlanStep .FleetPlanMissionSelector button[value=\"35\"]:not([disabled])')"))
                self.js("$('.FleetPlanStep:visible .FleetPlanMissionSelector button[value=35]')[0].click();$('.FleetPlanStep').last().find('[aria-label=\"Удалить этап\"]')[0].click()")
                self.settled(); self.geometry(str(width) + '-merge-plan')
                payload = self.capture()
                step = payload['plan']['steps'][0]
                assert len(payload['plan']['steps']) == 1 and step['mission'] == 35 and step['coordinates'] == {'type': 3, 'fleetId': 3}, payload
                self.state['ui'].append({'width': width, 'plan': payload['plan']})
                self.shot('merge-plan-' + str(width))
            # Обычное окно миссии и настоящий server preview.
            self.js('Dialog.close()')
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
            self.js('Page.showTaskFleet(arguments[0])', donor_id)
            self.mission_settled()
            self.js("Page.navigation.$fleetTarget.val('3').trigger('change')")
            self.mission_settled()
            self.wait(lambda: self.js("return !!Page.missionSelector.querySelector('button[value=\"35\"]')"))
            self.js("Page.missionSelector.querySelector('button[value=\"35\"]').click()")
            self.mission_settled()
            assert self.js("return Number(Page.selectedMission)===35&&!document.querySelector('.FleetMissionSendButton').disabled"), 'Нельзя отправить выбранное объединение'
            self.shot('merge-mission')
            self.js("document.querySelector('.FleetMissionSendButton').click()")
            self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')"))
            self.finish(lambda: (self.fleet(3) or {}).get('ships', {}).get('202', {}).get('count') == 2, 'merge')
            merged = self.fleet(3)
            assert not self.fleet(donor_id), 'Донор не исчез из authoritative snapshot'
            assert merged['control']['reason'] == paused['control']['reason'] and merged['control']['steps'] == paused['control']['steps'] and merged['control']['holding'] == paused['control']['holding'], 'Изменились пауза/маршрут получателя'
            self.state['phases']['merged'] = merged
            self.shot('merge-result')
            print('PASS actual merge donor=' + str(donor_id) + ' receiver=3', flush=True)
            if manual:
                self.return_receiver()
            else:
                self.finish_at_base()
            returned = self.fleet(3)
            assert returned['current'] == home and returned['fuel'] == 0, returned
            self.state['phases']['returned'] = returned
            self.js('Page.moveShip(0,3,202,1)')
            self.wait(lambda: self.js("return Page.messageData.data.Page.FleetList?.[3]?.ships?.[202]?.count===1&&Page.messageData.data.Page.PlanetShips?.[202]?.count===1"))
            self.state['phases']['restored'] = self.fleet(3)
            self.state['status'] = 'passed'
        finally:
            self.state['frames'] = self.js('return window.__mergeFrames||[]')
            self.out.joinpath('merge.json').write_text(json.dumps(self.state, ensure_ascii=False, indent=2))
            self.js("WS.ws.removeEventListener('message',__mergeListener);delete window.__mergeListener;delete window.__mergeFrames;Dialog.close()")
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
        print('PASS merge SPA; artifacts ' + str(self.out), flush=True)

    def return_receiver(self):
        if self.js("return !!document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightRecallButton')"):
            self.js("document.querySelector('.FleetFlightCard[data-fleet-id=\"3\"] .FleetFlightRecallButton').click()")
        else:
            # Нынешний OBSERVE не поддерживает Recall: используем существующий редактор/Resume.
            self.fleet_id = 3
            self.open(1440, 1000)
            self.js("""
            while(document.querySelectorAll('.FleetPlanStep').length>1)$('.FleetPlanStep').last().find('[aria-label="Удалить этап"]')[0].click();
            $('.FleetPlanStep:visible .FleetPlanModeSelector button[value=return]')[0].click();
            """)
            self.settled(); self.submit()
            self.wait(lambda: self.js("const s=Page.messageData.data.Page.FlyingFleets?.[3]?.control;return s?.steps?.length===1&&s.steps[0].kind==='return'"))
            self.resume()
        self.finish(lambda: (self.fleet(3) or {}).get('status') == 0, 'return-home')

    def finish_from(self, path):
        from pathlib import Path
        self.state = json.loads(Path(path).read_text())
        donor_id = self.state['donorId']
        merged = self.state['phases']['merged']
        current = self.fleet(3)
        assert current and current.get('owner_id') == 4 and current['ships']['202']['count'] == 2 and not self.fleet(donor_id), 'Не подтверждено выполненное тестом слияние'
        print('FINISH_ARTIFACTS ' + str(self.out), flush=True)
        self.state['sourceArtifact'] = path
        try:
            if current['status'] != 0:
                if current.get('control', {}).get('planActiveStage', {}).get('returning'):
                    # Продолжение проверки после restart не отзывает уже возвращающийся флот.
                    self.finish(lambda: (self.fleet(3) or {}).get('status') == 0, 'return-home')
                else:
                    self.return_receiver()
            returned = self.fleet(3)
            assert returned['status'] == 0 and returned['fuel'] == 0 and returned['current'] == merged['mission_start'], returned
            self.state['phases']['returned'] = returned
            self.js('Page.moveShip(0,3,202,1)')
            self.wait(lambda: self.js("return Page.messageData.data.Page.FleetList?.[3]?.ships?.[202]?.count===1&&Page.messageData.data.Page.PlanetShips?.[202]?.count===1"))
            self.state['phases']['restored'] = self.fleet(3)
            self.state['status'] = 'passed'
        finally:
            self.out.joinpath('merge.json').write_text(json.dumps(self.state, ensure_ascii=False, indent=2))
        print('PASS merge SPA; artifacts ' + str(self.out), flush=True)

    def finish_at_base(self):
        # При логистике 0 топливо у базы можно получить через этап 1.
        self.fleet_id = 3
        self.open(1440, 1000)
        self.js("""
            while(document.querySelectorAll('.FleetPlanStep').length>1)$('.FleetPlanStep').last().find('[aria-label="Удалить этап"]')[0].click();
            const p=$('.FleetPlanStep:visible');
            p.find('.FleetPlanModeSelector button[value=load]')[0].click();
            p.find('select[aria-label="Своя планета"]').val('20').trigger('change');
            p.find('input[aria-label="Добавить топливо на остановке"]').val(10).trigger('input');
            document.querySelector('.FleetPlanAdd').click();
            $('.FleetPlanStep:visible .FleetPlanModeSelector button[value=return]')[0].click();
        """)
        self.settled(); self.submit()
        self.wait(lambda: self.js("return Page.messageData.data.Page.FlyingFleets?.[3]?.control?.loading_pending"))
        self.resume()
        self.finish(lambda: (self.fleet(3) or {}).get('status') == 0, 'finish-at-home')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--resume', action='store_true', help='Продолжить только уже подготовленную тестом стоянку Fleet 3')
    parser.add_argument('--donor-id', type=int, help='Продолжить только уже подготовленного тестом донора на базе 20')
    parser.add_argument('--finish-from', help='Завершить уборку только подтверждённого слияния из своего merge.json')
    args = parser.parse_args()
    if not args.execute:
        parser.error('Игровой тест запускается только с явным --execute')
    check = MergeCheck()
    if args.finish_from:
        check.finish_from(args.finish_from)
    else:
        check.run(args.resume, args.donor_id)
