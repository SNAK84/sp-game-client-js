#!/usr/bin/env python3
"""Живая read-only проверка SPA. Требует явно заданную свою Selenium-сессию.

Не запускает игровой сервер, не получает credentials и не отправляет игровые
команды. Меняет только страницу, открытые панели и локальное UI-состояние.
"""
import argparse
import json
import time
import urllib.request


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--session", required=True)
parser.add_argument("--grid", default="http://127.0.0.1:4444")
parser.add_argument("--pages", default="galaxy,overview,fleets,messages,friends,buildings,researchs,shipyard,defense")
parser.add_argument("--seconds", type=int, default=23)
args = parser.parse_args()


def call(path, payload):
    request = urllib.request.Request(f"{args.grid}/session/{args.session}/{path}",
                                    json.dumps(payload).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=15) as response:
        result = json.load(response)["value"]
    if isinstance(result, dict) and "error" in result:
        raise RuntimeError(result["message"])
    return result


def js(script, *values):
    return call("execute/sync", {"script": script, "args": list(values)})


for attempt in range(60):
    if js("return typeof Page !== 'undefined' && Boolean(Page?.pageActive && Page?.messageData?.data?.Page);"):
        break
    time.sleep(0.2)
else:
    raise RuntimeError("Не готова авторизованная страница SPA")


failed = False
for mode in args.pages.split(","):
    js("Page.setActiveMode(arguments[0]);", mode)
    ready = False
    for attempt in range(60):
        time.sleep(0.2)
        ready = js("return Page?.pageActive && Page.ownsContent() && Page.messageData?.mode === arguments[0] && Data.mode === arguments[0] && Page.messageData?.data?.Page && $('#Content').children().length>0 && $('#Content').is(':visible') && !$('#Content').is(':animated') && !$('#layer').is(':animated') && (Page.Name !== 'GalaxyPageClass' || (Page.SystemShow && !Page.zoomAnimationFrameId));", mode)
        if ready:
            break
    if not ready:
        raise RuntimeError(f"Страница {mode} не готова")
    js("""
        window.incrementalProbe = {mode: arguments[0], started: Date.now(), pushes: [], errors: [], canvasWrites: 0, stops: 0};
        const probe = incrementalProbe, page = Page;
        probe.onError = e => probe.errors.push(e.message || String(e.reason));
        addEventListener('error', probe.onError); addEventListener('unhandledrejection', probe.onError);
        probe.consoleError = console.error;
        console.error = (...values) => { probe.errors.push(values.find(value => value instanceof Error)?.message || 'console.error'); probe.consoleError.apply(console, values); };
        probe.show = page.Show;
        page.Show = function(module, message) {
            probe.pushes.push({at: Date.now(), module, requestId: message.requestId || message.getRequestId?.()});
            return probe.show.call(this, module, message);
        };
        if (page.Name === 'MessagesPageClass') {
            const message = page.visibleMessages()[0];
            if (message) { page.SelectedIds.add(message.id); page.ExpandedIds.add(message.id); page.renderMessages(); }
        }
        if (page.Name === 'FleetsPageClass') {
            const id = Object.keys(page.flyingFleetRows)[0];
            if (id) { page.expandedFlyingFleetCommands.add(Number(id)); page.renderFlyingFleets(); }
        }
        if (page.Name === 'GalaxyPageClass') {
            page.$SystemInfo.prop('open', true);
            const planet = page.Planets.find(p => Number(p.planet_type) !== 3);
            if (planet) page.openObjectMenu('planet', planet.id, {stopPropagation(){}, clientX:700, clientY:230});
            probe.zoom = page.zoom; probe.offset = JSON.stringify(page.offset);
            probe.belts = Object.values(page.asteroidBelts || {});
            probe.stop = page.stopAnimation;
            page.stopAnimation = function(...params) { probe.stops++; return probe.stop.apply(this, params); };
            for (const property of ['width','height']) {
                const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, property);
                Object.defineProperty(page.canvas, property, {configurable:true,
                    get(){return descriptor.get.call(this)}, set(value){probe.canvasWrites++;descriptor.set.call(this,value)}});
            }
        }
        const widget = $('#planets-select').planetselectmenu('instance'); widget.open();
        const focus = page.$ObjectMenuBody?.find('button:visible')[0]
            || document.querySelector('.FleetFlightCommandsButton, .MessageCheckbox, #planets-select-button');
        focus?.focus(); probe.focus = focus; probe.focusAtStart = document.activeElement === focus;
        probe.nodes = Array.from(document.querySelectorAll('#Content *, #PlanetsList *, #planets-select-menu *'));
        window.incrementalGlobalNodes ||= Array.from(document.querySelectorAll('#TopNav *, #PlanetsList *, #planets-select-menu'));
        probe.widget = widget; probe.page = page;
    """, mode)
    time.sleep(max(1, args.seconds))
    result = js("""
        const p = incrementalProbe, page = p.page;
        const removed = p.nodes.filter(node => !node.isConnected).map(node => ({tag:node.tagName,id:node.id,class:node.className}));
        const checks = {samePage:page === Page, sameWidget:p.widget === $('#planets-select').planetselectmenu('instance'),
            contentOwner:page.ownsContent(), contentNonempty:page.$Content.children().length>0,
            initialFocus:p.focusAtStart,
            menuOpen:p.widget.isOpen, focus:p.focus === document.activeElement, noRemovedElements:removed.length === 0,
            globalElementsSurviveNavigation:incrementalGlobalNodes.every(node => node.isConnected)};
        if (page.Name === 'GalaxyPageClass') Object.assign(checks, {
            sameZoom:p.zoom === page.zoom, sameOffset:p.offset === JSON.stringify(page.offset),
            sameBelts:p.belts.every(belt => Object.values(page.asteroidBelts || {}).includes(belt)),
            noCanvasReset:p.canvasWrites === 0, noAnimationRestart:p.stops === 0,
            infoOpen:page.$SystemInfo.prop('open')});
        page.Show = p.show;
        if (p.stop) { page.stopAnimation=p.stop; delete page.canvas.width; delete page.canvas.height; }
        removeEventListener('error',p.onError); removeEventListener('unhandledrejection',p.onError);
        console.error = p.consoleError;
        p.widget.close();
        return {mode:p.mode, page:page.Name, elapsed:Date.now()-p.started, pushes:p.pushes,
            checks, removed:removed.slice(0,20), errors:p.errors,
            passed:Object.values(checks).every(Boolean) && p.pushes.length >= 2 && p.errors.length === 0};
    """)
    print(json.dumps(result, ensure_ascii=False), flush=True)
    failed |= not result["passed"]

raise SystemExit(1 if failed else 0)
