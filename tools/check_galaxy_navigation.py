#!/usr/bin/env python3
"""B013: read-only навигация в своей открытой Selenium-сессии основного SPA.

python3 tools/check_galaxy_navigation.py --session ID [--mobile]
Только чтение систем и переключение страниц. Не получает credentials,
не меняет конфигурацию галактики и не отправляет игровые команды.
"""
import argparse
import json
import time
from check_fleet_mission_layout import Check, KEY


class NavigationCheck(Check):
    def __init__(self, session, mobile):
        self.base = '/session/' + session
        self.results = []
        self.mobile = mobile

    def ready(self, system=None):
        self.wait(lambda: self.js("""
            return Page?.Name==='GalaxyPageClass' && Page.SystemShow
                && !Page.zoomAnimationFrameId && !$(Page.$System).is(':animated')
                && !Page.navigationTarget && WS.requestCallbacks.size===0
                && (arguments[0]===null || Number(Page.System.system)===arguments[0]);
        """, system), 40)

    def record(self, name, passed=True):
        assert passed, name
        self.results.append({'name': name, 'passed': True})
        print('OK ' + name, flush=True)

    def edit(self, selector, value):
        if not self.js('return document.activeElement===document.querySelector(arguments[0])', selector):
            self.click(selector)
        element = self.call('/element', {'using': 'css selector', 'value': selector})[KEY]
        self.call('/element/' + element + '/value', {'text': '\ue009a\ue000' + str(value)})

    def enter(self, selector='#NavigationSystemInput'):
        element = self.call('/element', {'using': 'css selector', 'value': selector})[KEY]
        self.call('/element/' + element + '/value', {'text': '\ue007'})

    def count(self):
        return self.js('return __galaxyNav.sent.length')

    def go(self, system):
        self.edit('#NavigationSystemInput', system)
        self.enter()
        self.ready(max(1, min(self.js('return Page.MaxSystem'), system)))

    def run(self):
        self.call('/refresh', {})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page?.pageActive&&WS.ws.readyState===1"))
        if self.js('return Page.Name') != 'GalaxyPageClass':
            self.js("Page.setActiveMode('galaxy')")
        self.ready()
        self.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
            'width': 390 if self.mobile else 1365, 'height': 844 if self.mobile else 900,
            'deviceScaleFactor': 1, 'mobile': self.mobile}})
        self.js("""
            window.__galaxyNav={sent:[],received:[],errors:[],holdSystem:null,held:null};
            const p=__galaxyNav;p.send=WS.ws.send;p.socket=WS.ws;p.handle=WS.handleMessage;
            p.error=e=>p.errors.push(e.message||String(e.reason));
            addEventListener('error',p.error);addEventListener('unhandledrejection',p.error);
            WS.ws.send=function(raw){
                const m=JSON.parse(raw);
                if(m.mode==='galaxy'&&!m.action)
                    p.sent.push({galaxy:Number(m.data.galaxy),system:Number(m.data.system),id:m.requestId});
                else if(!['connect','lang','overview'].includes(m.mode))
                    throw Error('B013: разрешены только read-only страницы');
                return p.send.call(this,raw);
            };
            WS.handleMessage=function(m){
                if(m.mode==='galaxy'&&m.data?.Page?.System){
                    const s=m.data.Page.System;
                    p.received.push([Number(s.galaxy),Number(s.system)]);
                    if(p.holdSystem===Number(s.system)){
                        p.holdSystem=null;p.held=m;return;
                    }
                }
                return p.handle.call(this,m);
            };
        """)
        initial = self.js('return Number(Page.System.system)')
        try:
            self.go(7)
            self.js("__galaxyNav.nodes=[Page.canvas,Page.$Content.Navigation[0],document.querySelector('#NavigationGalaxyInput'),document.querySelector('#NavigationSystemInput')]")
            before = self.count()
            self.edit('#NavigationSystemInput', 12)
            time.sleep(.25)
            self.record('typing-does-not-send', self.count() == before and self.js('return Number(Page.System.system)===7'))

            # Настоящий Page response той же системы, без подмены snapshot.
            self.js("""
                GameEvents.emit('SendServer',{mode:'galaxy',data:{galaxy:Page.System.galaxy,system:Page.System.system},
                    onSuccess:m=>ShowPage.Show(m.mode,m),...Page.getRequestOptions({latestKey:'qa-same-system'})});
            """)
            self.ready(7)
            self.record('same-system-response-preserves-draft-focus-and-dom', self.js("""
                return $('#NavigationSystemInput').val()==='12'
                    && document.activeElement===__galaxyNav.nodes[3]
                    && __galaxyNav.nodes.every(e=>e.isConnected)&&Page.canvas===__galaxyNav.nodes[0];
            """))

            before = self.count()
            self.enter(); self.ready(12)
            self.record('native-enter-loads-system-once', self.count() == before + 1)
            self.record('navigation-keeps-input-and-canvas-nodes', self.js("""
                return __galaxyNav.nodes.every(e=>e.isConnected)
                    && document.querySelector('#NavigationSystemInput')===__galaxyNav.nodes[3]
                    && Page.canvas===__galaxyNav.nodes[0];
            """))
            before = self.count()
            self.enter(); self.click('#GalaxySystemInfo summary'); self.ready(12)
            self.record('repeat-enter-and-blur-do-not-refetch', self.count() == before)

            before = self.count()
            self.edit('#NavigationSystemInput', 9)
            self.click('#GalaxySystemInfo summary'); self.ready(9)
            self.record('native-blur-loads-system-once', self.count() == before + 1)

            before = self.count()
            self.edit('#NavigationSystemInput', 10)
            self.click('#NavigationOrbit'); self.ready(10)
            self.record('show-button-with-edited-field-no-duplicate-blur', self.count() == before + 1)
            before = self.count()
            self.click('#NavigationOrbit'); self.ready(10)
            self.record('explicit-show-still-refreshes-current-system', self.count() == before + 1)

            before = self.count()
            self.edit('#NavigationSystemInput', 11)
            self.click('#NavigationSystemNext'); self.ready(12)
            self.record('next-uses-draft-without-intermediate-request', self.count() == before + 1)
            self.click('#NavigationSystemPrev'); self.ready(11)
            self.record('previous-still-works')

            self.go(0); self.ready(1)
            self.record('system-min-clamped-and-previous-disabled', self.js("return $('#NavigationSystemInput').val()==='1'&&document.querySelector('#NavigationSystemPrev').disabled"))
            maximum = self.js('return Page.MaxSystem')
            self.edit('#NavigationSystemInput', maximum + 500)
            self.enter(); self.ready(maximum)
            self.record('system-max-clamped-and-next-disabled', self.js('return Number($("#NavigationSystemInput").val())===Page.MaxSystem&&document.querySelector("#NavigationSystemNext").disabled'))

            self.go(7)
            before = self.count()
            self.edit('#NavigationGalaxyInput', 0)
            self.enter('#NavigationGalaxyInput'); self.ready(7)
            self.record('galaxy-min-clamped-and-previous-disabled', self.js('return $("#NavigationGalaxyInput").val()==="1"&&document.querySelector("#NavigationGalaxyPrev").disabled'))
            max_galaxy = self.js('return Page.MaxGalaxy')
            assert max_galaxy == 1, 'Этот dev-прогон не должен генерировать другую галактику'
            self.edit('#NavigationGalaxyInput', max_galaxy + 100)
            self.enter('#NavigationGalaxyInput'); self.ready(7)
            self.record('galaxy-server-max-respected-without-extra-request', self.count() == before and self.js('return Number($("#NavigationGalaxyInput").val())===Page.MaxGalaxy&&document.querySelector("#NavigationGalaxyNext").disabled'))

            # Локальная подготовка второго поля; Enter настоящим key event в поле галактики.
            self.js("$('#NavigationSystemInput').val(13).trigger('input')")
            self.enter('#NavigationGalaxyInput'); self.ready(13)
            self.record('galaxy-enter-applies-both-coordinate-fields')

            before = self.count()
            # UI replay настоящего прежнего DTO в том же task, до нового ответа.
            # Не выдаётся за новый ActualData. Проверяет именно факт отправки.
            self.js("""
                const snapshot=Page.messageData;
                $('#NavigationSystemInput').val(14).trigger('input');
                Page.NavigationEvent({currentTarget:document.querySelector('#NavigationSystemInput')});
                Page.Show('galaxy',snapshot);
            """)
            self.ready(14)
            self.record('same-task-page-refresh-cannot-cancel-submit', self.count() == before + 1)

            self.js('__galaxyNav.holdSystem=15')
            self.edit('#NavigationSystemInput', 15); self.enter()
            self.wait(lambda: self.js('return !!__galaxyNav.held'))
            self.edit('#NavigationSystemInput', 16); self.enter(); self.ready(16)
            self.js('const p=__galaxyNav,m=p.held;p.held=null;p.handle.call(WS,m)')
            self.ready(16)
            self.record('late-real-response-cannot-replace-newer-navigation', self.js('return $("#NavigationSystemInput").val()==="16"'))

            self.js('__galaxyNav.holdSystem=17')
            self.edit('#NavigationSystemInput', 17); self.enter()
            self.wait(lambda: self.js('return !!__galaxyNav.held'))
            before = self.count()
            self.enter(); self.js("document.querySelector('#NavigationSystemInput').blur()")
            self.record('pending-enter-and-controlled-blur-deduplicated', self.count() == before)
            # Управляемая client-side ошибка, настоящий server response уже получен.
            self.js("""
                const m=__galaxyNav.held;
                __galaxyNav.handle.call(WS,{mode:'galaxy',requestId:m.requestId,status:'error',
                    error:{code:'QA',message:'B013: контролируемая client-side ошибка ожидания'}});
                __galaxyNav.handle.call(WS,m);__galaxyNav.held=null;
            """)
            self.record('client-error-releases-pending-target', self.js('return Page.navigationTarget===null'))
            self.js('Dialog.close()')
            self.wait(lambda: self.js("return getComputedStyle(Dialog.dialogDiv).display==='none'"))
            self.enter(); self.ready(17)
            self.record('same-target-can-be-retried-after-error')

            self.js('__galaxyNav.holdSystem=18')
            self.edit('#NavigationSystemInput', 18); self.enter()
            self.wait(lambda: self.js('return !!__galaxyNav.held'))
            self.js("window.__galaxyOldPage=Page;Page.setActiveMode('overview')")
            self.wait(lambda: self.js("return Page?.Name==='OverViewPageClass'&&WS.requestCallbacks.size===0"))
            self.js('const p=__galaxyNav,m=p.held;p.held=null;p.handle.call(WS,m)')
            self.record('late-response-after-page-switch-is-ignored', self.js("return Page.Name==='OverViewPageClass'&&__galaxyOldPage.navigationTarget===null"))
            # Возврат через штатное read-событие без новой анимации меню:
            # B037 (callback Overlay до отправки запроса) — отдельный этап.
            self.js("""
                GameEvents.emit('SendServer',{mode:'galaxy',NotOverlay:true,
                    data:{galaxy:1,system:arguments[0]},onSuccess:m=>ShowPage.Show(m.mode,m),
                    ...Page.getRequestOptions({latestKey:'qa-return-galaxy'})});
            """, initial)
            self.ready()
            self.go(initial)
            self.record('return-to-galaxy-remains-functional')

            report = self.js("""
                const p=__galaxyNav;
                return {requests:p.sent.length,received:p.received.length,errors:p.errors,
                    inBounds:p.sent.every(s=>Number.isInteger(s.galaxy)&&s.galaxy>=1&&s.galaxy<=Page.MaxGalaxy
                        &&Number.isInteger(s.system)&&s.system>=1&&s.system<=Page.MaxSystem),
                    pending:WS.requestCallbacks.size,ws:WS.ws.readyState,overflow:document.documentElement.scrollWidth>innerWidth};
            """)
            self.record('all-real-request-coordinates-in-server-bounds', report['inBounds'])
            self.record('browser-errors-and-pending-requests-zero', not report['errors'] and report['pending'] == 0 and report['ws'] == 1)
            self.record('viewport-has-no-horizontal-overflow', not report['overflow'])
            print(json.dumps({'mobile': self.mobile, 'passed': len(self.results), **report}, ensure_ascii=False), flush=True)
        finally:
            self.js("""
                const p=__galaxyNav;WS.ws.send=p.send;WS.handleMessage=p.handle;
                removeEventListener('error',p.error);removeEventListener('unhandledrejection',p.error);Dialog.close();
            """)
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
            self.call('/refresh', {})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--session', required=True)
    parser.add_argument('--mobile', action='store_true')
    args = parser.parse_args()
    NavigationCheck(args.session, args.mobile).run()
