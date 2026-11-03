#!/usr/bin/env python3
"""B001: настоящие Page/ActualData в явно указанной своей Selenium-сессии.

Только навигация, выбор собственной планеты и reconnect. Игровые команды,
новый сервер, создание аккаунтов и получение credentials не используются.
"""
import argparse
import json
import time
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--session", required=True)
parser.add_argument("--grid", default="http://127.0.0.1:4444")
parser.add_argument("--phone", action="store_true")
parser.add_argument("--reconnect", action="store_true")
parser.add_argument("--planet-switch", action="store_true")
args = parser.parse_args()


def call(path, payload):
    request = urllib.request.Request(f"{args.grid}/session/{args.session}/{path}",
                                    json.dumps(payload).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        value = json.load(response)["value"]
    if isinstance(value, dict) and "error" in value:
        raise RuntimeError(value["message"])
    return value


def js(script, *values):
    return call("execute/sync", {"script": script, "args": list(values)})


def ready(mode):
    stable = None
    until = time.monotonic() + 25
    while time.monotonic() < until:
        good = js("""
            const root = document.getElementById('Content');
            return Boolean(Page?.pageActive && Page.ownsContent() && Page.messageData?.mode === arguments[0]
                && root?.children.length && $(root).is(':visible') && !$(root).is(':animated')
                && WS.requestCallbacks.size===0 && !$('#layer').is(':animated') && (Page.Name !== 'GalaxyPageClass'
                    || (Page.SystemShow && Page.$System[0].isConnected && !Page.zoomAnimationFrameId)));
        """, mode)
        if good:
            stable = stable or time.monotonic()
            if time.monotonic() - stable > 0.35:
                return
        else:
            stable = None
        time.sleep(0.1)
    raise RuntimeError(f"Нет видимого актуального DOM страницы {mode}")


if args.phone:
    call("goog/cdp/execute", {"cmd": "Emulation.setDeviceMetricsOverride", "params": {
        "width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True}})

js("""
    window.lifecycleProbe = {errors:[], lateEmpty:[], retired:[], completions:[], updates:0};
    const probe=lifecycleProbe;
    probe.onError=e=>probe.errors.push(e.message || String(e.reason));
    addEventListener('error',probe.onError); addEventListener('unhandledrejection',probe.onError);
    probe.consoleError=console.error;
    console.error=(...values)=>{probe.errors.push(values.find(value=>value instanceof Error)?.message || 'console.error');probe.consoleError.apply(console,values)};
    probe.empty=$.fn.empty;
    $.fn.empty=function(...values){
        if(this[0]?.id==='Content' && this.data('pageOwner')?.pageActive
            && new Error().stack.includes('HTMLDivElement.')) probe.lateEmpty.push({page:Page?.Name});
        return probe.empty.apply(this,values);
    };
    probe.hide=BasePageClass.prototype.Hide;
    BasePageClass.prototype.Hide=function(...values){
        const scope=this.requestScope; const result=probe.hide.apply(this,values);
        probe.retired.push({page:this,scope}); return result;
    };
    probe.show=BasePageClass.prototype.Show;
    BasePageClass.prototype.Show=function(...values){probe.updates++;return probe.show.apply(this,values)};
    for(const method of ['fadeOut','fadeIn']) {
        probe[method]=$.fn[method];
        $.fn[method]=function(...values){
            const callback=values.findLast(value=>typeof value==='function');
            if(callback && ['Content','layer'].includes(this[0]?.id)
                && new Error().stack.includes('BasePageClass')) {
                probe.completions.push({callback,node:this[0],owner:$('#Content').data('pageOwner')});
                if(probe.completions.length>100)probe.completions.shift();
            }
            return probe[method].apply(this,values);
        };
    }
""")

try:
    modes = ["fleets", "messages", "fleets", "galaxy", "overview", "buildings",
             "researchs", "shipyard", "defense", "fleets"]
    for mode in modes:
        # Тот же обработчик, что у обычного клика меню, включая fade/Overlay.
        js("Page.setActiveMode(arguments[0]);", mode)
        ready(mode)
        print(json.dumps({"navigation": mode, "visible": True}, ensure_ascii=False), flush=True)

    # UI-replay настоящих полученных DTO: переключения быстрее fadeOut(250).
    # Это проверка callback lifecycle, не выдаём replay за новые WS-ответы.
    js("""
        lifecycleProbe.snapshots=new Map([...lifecycleProbe.retired.map(item=>item.page),Page]
            .filter(page=>page.messageData?.data?.Page).map(page=>[page.messageData.mode,page.messageData]));
        lifecycleProbe.replayTimes=[];
    """)
    for mode in ["messages", "fleets", "galaxy", "fleets"] * 2:
        js("""
            const mode=arguments[0],snapshot=lifecycleProbe.snapshots.get(mode);
            if(!snapshot)throw new Error('Нет настоящего DTO '+mode);
            lifecycleProbe.replayTimes.push(performance.now());
            ShowPage.Show(mode,snapshot);
        """, mode)
        time.sleep(0.03)
    replay = js("""
        const times=lifecycleProbe.replayTimes;
        return {count:times.length,minGap:Math.min(...times.slice(1).map((at,index)=>at-times[index]))};
    """)
    js("GameEvents.emit('SendServer',{mode:'fleets',NotOverlay:true});")
    ready("fleets")

    stale = js("""
        const nodes=Array.from(document.querySelectorAll('#Content *'));
        const callbacks=lifecycleProbe.completions.filter(item=>item.owner!==Page);
        for(const item of callbacks)item.callback.call(item.node);
        return {callbacks:callbacks.length, retained:nodes.every(node=>node.isConnected),
            visible:$('#Content').is(':visible'), owner:Page.ownsContent()};
    """)
    assert stale["callbacks"] > 0 and stale["retained"] and stale["visible"] and stale["owner"], stale

    switched = []
    if args.planet_switch:
        planets = js("return Page.messageData.data.PlanetList.Planets.map(p=>({id:p.id,type:p.planet_type}));")
        current = js("return Number(Page.messageData.data.PlanetList.current_planet);")
        target = next((p for p in planets if p["type"] == 3 and p["id"] != current),
                      next((p for p in planets if p["id"] != current), None))
        if target is None:
            raise RuntimeError("Нужны две свои планеты/луны для настоящего planet switch")
        for planet_id in [target["id"], current]:
            js("""
                const widget=$('#planets-select').planetselectmenu('instance');
                widget.open(); widget._select(widget.items.find(item=>Number(item.value)===arguments[0]),null);
            """, planet_id)
            until = time.monotonic() + 25
            while js("return Number(Page?.messageData?.data?.PlanetList?.current_planet);") != planet_id:
                if time.monotonic() > until:
                    raise RuntimeError("Не применился planet switch")
                time.sleep(0.1)
            ready("fleets")
            switched.append(planet_id)

    if args.reconnect:
        js("lifecycleProbe.socket=WS.ws; WS.ws.close(4000,'QA lifecycle reconnect');")
        until = time.monotonic() + 25
        while not js("return WS.ws!==lifecycleProbe.socket && WS.ws.readyState===WebSocket.OPEN;"):
            if time.monotonic() > until:
                raise RuntimeError("Не завершился reconnect")
            time.sleep(0.2)
        ready("fleets")

    result = js("""
        const probe=lifecycleProbe;
        return {updates:probe.updates,retired:probe.retired.length,lateEmpty:probe.lateEmpty,errors:probe.errors,
            retiredInactive:probe.retired.every(({page})=>!page.pageActive),
            retiredTimersCleared:probe.retired.every(({page})=>page.ownedTimers.size===0 && !page._topNavActive),
            retiredScopesCancelled:probe.retired.every(({scope})=>![...WS.requestCallbacks.values()].some(entry=>entry.scope===scope)),
            retiredGalaxyStopped:probe.retired.filter(({page})=>page.Name==='GalaxyPageClass')
                .every(({page})=>!page.animationFrameId && !page.zoomAnimationFrameId),
            owner:Page.ownsContent(),contentConnected:Page.$FlyingFleets[0].isConnected};
    """)
    checks = [value for value in result.values() if isinstance(value, bool)]
    result.update(ui_replay=replay, stale_callbacks=stale, planet_switch=switched, reconnect=args.reconnect, phone=args.phone)
    result["passed"] = all(checks) and not result["lateEmpty"] and not result["errors"]
    print(json.dumps(result, ensure_ascii=False), flush=True)
    if not result["passed"]:
        raise SystemExit(1)
finally:
    js("""
        const probe=lifecycleProbe;
        $.fn.empty=probe.empty; $.fn.fadeIn=probe.fadeIn; $.fn.fadeOut=probe.fadeOut;
        BasePageClass.prototype.Hide=probe.hide; BasePageClass.prototype.Show=probe.show;
        console.error=probe.consoleError;
        removeEventListener('error',probe.onError);removeEventListener('unhandledrejection',probe.onError);
    """)
