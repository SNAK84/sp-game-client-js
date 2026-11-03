"""UI fixtures через настоящий SPA и приватную Selenium-сессию snak1.

Не отправляет флоты, не создаёт/удаляет игровые сообщения и не меняет аккаунт.
python3 tools/check_expedition_reports.py
"""
import json

from check_fleet_mission_layout import Check


def run():
    check = Check()
    check.call('/refresh', {})
    check.wait(lambda: check.js("return typeof WS!=='undefined'&&WS.ws?.readyState===1&&typeof Page!=='undefined'&&!!Page?.requestScope"))
    check.js("GameEvents.emit('SendServer',{mode:'messages'});")
    check.wait(lambda: check.js("return Page?.Name==='MessagesPageClass'&&typeof Page.createExpeditionReport==='function'&&!!Lang.notifications.expeditionReport"))
    check.wait(lambda: check.js("return WS.requestCallbacks.size===0&&!$('body>overlay').is(':visible')"))
    check.js("""
        Page.$LeftMenu.removeClass('menu_open');$('#MenuBtn').removeClass('menu-open');
        window.__expeditionErrors=[];
        window.__expeditionError=e=>__expeditionErrors.push(e.message||String(e.reason));
        addEventListener('error',__expeditionError);
        addEventListener('unhandledrejection',__expeditionError);
    """)
    rich = {
        'FleetId': 17, 'TargetCoordinate': '[1:10:18]', 'EventsCount': 8, 'HoursPlanned': 8,
        'EventCounts': {'resources': 2, 'credits': 1, 'ships': 1, 'time': 1, 'combat': 1, 'nothing': 2},
        'ResourcesFound': {'901': 60000, '902': 14000, '903': 5500, '921': 430},
        'ShipsFound': 'Малый транспорт: 2, Лёгкий истребитель: 5',
        'ResourcesOnboard': {'901': 60500, '902': 14000, '903': 5500, '921': 430},
        'TimeFactor': 2, 'lang': {'FleetState': 'expedition.returning'},
        'BattleIds': ['a' * 32, 'b' * 32], 'ReportVersion': 1,
    }
    empty = {**rich, 'EventCounts': {'nothing': 1}, 'ResourcesFound': {}, 'ShipsFound': '—',
             'ResourcesOnboard': {}, 'TimeFactor': 1, 'BattleIds': []}
    cases = {
        'finds': rich,
        'nothing': empty,
        'no-space-or-usable-ships': {**empty, 'EventCounts': {'resources': 1, 'ships': 1}},
        'lost': {**rich, 'EventCounts': {'resources': 1, 'lost': 1}, 'TimeFactor': 1,
                 'lang': {'FleetState': 'expedition.destroyed'}},
        'recalled': {**rich, 'lang': {'FleetState': 'expedition.recalled'}},
        'fast-return': {**empty, 'EventCounts': {'time': 1}, 'TimeFactor': 1 / 3},
        'legacy': {**rich, 'EventCounts': None, 'EventsSummary': 'Ресурсы: 2; Кредиты: 1'},
        'escaped-text': {**rich, 'TargetCoordinate': '<img src=x onerror="window.__expeditionXSS=true">',
                         'ShipsFound': '<script>window.__expeditionXSS=true</script>'},
    }
    results = []
    try:
        for width, height in [(1440, 1000), (390, 844), (320, 740)]:
            check.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
                'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 700}})
            if width < 700:
                check.wait(lambda: check.js("return getComputedStyle(Page.$LeftMenu[0]).visibility==='hidden'"))
            for name, data in cases.items():
                result = check.js("""
                    $('#Message900001').remove();
                    Page.ExpandedIds.add(900001);
                    const message={id:900001,from_id:0,read:1,type:24,from:'from.Expeditions',
                        subject:'subject.Expeditions.Success',sample:'FleetExpeditionSummary',time:1700000000,data:arguments[0]};
                    const row=Page.CreateMessage(message);
                    Page.$Content.MessagesBox.prepend(row);
                    row[0].scrollIntoView({block:'start'});
                    const report=row.find('.ExpeditionReport')[0],body=row.find('.MessageText')[0];
                    return {text:body.textContent,sections:report?.querySelectorAll('.ExpeditionReportFinds').length,
                        textAlign:report?getComputedStyle(report.querySelector('p')).textAlign:null,
                        links:body.querySelectorAll('a.MessageBattleReport').length,
                        overflow:body.scrollWidth-body.clientWidth,
                        documentOverflow:document.documentElement.scrollWidth-innerWidth,
                        unsafe:report?.querySelectorAll('script,img').length||!!window.__expeditionXSS};
                """, data)
                assert result['sections'] is not None, (name, result)
                assert result['overflow'] == 0 and result['documentOverflow'] <= 1, (width, name, result)
                assert not result['unsafe'], (name, result)
                assert result['textAlign'] == 'left', (name, result)
                assert not any(text in result['text'] for text in ['{FleetId}', '{FleetState}', 'Рассчитано событий', 'Коэффициент времени']), (name, result)
                if name == 'finds':
                    assert result['links'] == 2 and result['sections'] == 3 and '×2' in result['text'], result
                    check.shot(f'expedition-{width}')
                if name in ['nothing', 'no-space-or-usable-ships', 'fast-return']:
                    assert result['sections'] == 0, result
                if name == 'no-space-or-usable-ships':
                    assert 'свободного места' in result['text'] and 'ни один' in result['text'], result
                if name == 'lost':
                    assert result['sections'] == 2 and 'Возвращения и доставки находок не будет' in result['text'], result
                if name == 'fast-return':
                    assert 'в 3 раза меньше' in result['text'], result
                if name == 'recalled':
                    assert 'по приказу игрока' in result['text'], result
                results.append({'width': width, 'case': name, 'passed': True})
                print(f'PASS expedition UI {width}: {name}', flush=True)

        result = check.js("""
            $('#Message900001').remove();
            const row=Page.CreateMessage({id:900001,from_id:0,read:1,type:24,from:'from.Expeditions',
                subject:'subject.Transport.Return',sample:'FleetExpeditionReturned',time:1700000000,
                data:{FleetId:17,PlanetName:'Тестовая база',PlanetCoordinate:'[1:10:7]',
                    Resources:{901:1500,902:250,903:100,921:430},ResourcesFuelReturned:{903:84}}});
            Page.$Content.MessagesBox.prepend(row);
            const open=row.find('.MessageOpen');open.trigger('click');open.trigger('click');
            return {text:row.find('.MessageText').text(),visible:row.find('.MessageText').is(':visible'),
                count:row.find('.ResBox').length,errors:__expeditionErrors};
        """)
        assert 'вернулся на Тестовая база [1:10:7]' in result['text'] and result['count'] == 5 and result['visible'], result
        assert not result['errors'], result
        results.append({'case': 'returned-message-and-toggle', 'passed': True})
        print('PASS expedition return message and expand/collapse', flush=True)
        check.out.joinpath('expedition-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(f'RESULT {len(results)} browser fixture checks passed; artifacts: {check.out}', flush=True)
    finally:
        check.js("""
            $('#Message900001').remove();Page.ExpandedIds.delete(900001);
            removeEventListener('error',__expeditionError);
            removeEventListener('unhandledrejection',__expeditionError);
            delete window.__expeditionError;delete window.__expeditionErrors;delete window.__expeditionXSS;
        """)
        check.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})


if __name__ == '__main__':
    run()
