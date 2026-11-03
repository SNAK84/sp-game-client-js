"""Проверка маркеров в настоящем SPA snak1 на изолированных серверных DTO.

Не отправляет/возобновляет игровые флоты. После проверки восстанавливает страницу.
"""
import json
import subprocess
from urllib.error import HTTPError
from check_fleet_mission_layout import Check


c = Check()
fixtures = json.loads(subprocess.run(
    ['php', '/opt/sp-game/tests/GalaxyFleetVisibilityTest.php', '--export'],
    capture_output=True, text=True, check=True).stdout)

try:
    c.call('/refresh', {})
    c.wait(lambda: c.js("return typeof Page!=='undefined'&&WS.ws.readyState===1&&WS.requestCallbacks.size===0"))
    c.js("GameEvents.emit('SendServer',{mode:'galaxy',data:{galaxy:1,system:10}})")
    c.wait(lambda: c.js("return Page?.Name==='GalaxyPageClass'&&Number(Page.System?.galaxy)===1&&Number(Page.System?.system)===10&&Boolean(Page.canvas?.width)&&typeof Page.isFleetStationary==='function'&&WS.requestCallbacks.size===0"))
    c.js("""
        window.__galaxyFleetErrors=[];
        window.__galaxyFleetListener=e=>__galaxyFleetErrors.push(e.message||String(e.reason));
        addEventListener('error',__galaxyFleetListener);addEventListener('unhandledrejection',__galaxyFleetListener);
        window.__galaxyFleetFixtures=arguments[0];
        let id=99000;
        for(const [name,f] of Object.entries(__galaxyFleetFixtures)){
            f.id=++id;f.name=name;f.is_own=true;f.is_incoming=false;
            const delta=GameServerTime.now()-150;f.start_time+=delta;f.end_time+=delta;
        }
    """, fixtures)
    results = c.js("""
        Page.stopAnimation();Page.cancelZoomAnimation();
        const samples=__galaxyFleetFixtures,now=GameServerTime.now(),results=[];
        const check=(name,value,details)=>{if(!value)throw Error(name+' '+JSON.stringify(details));results.push({name,passed:true});};
        const draw=(fleet,time)=>{
            const saved=Page.mapObjects,canvas=document.createElement('canvas');
            const ctx=canvas.getContext('2d');let rects=0,lines=0;
            const rect=ctx.rect.bind(ctx),line=ctx.lineTo.bind(ctx);
            ctx.rect=(...args)=>{rects++;rect(...args);};
            ctx.lineTo=(...args)=>{lines++;line(...args);};
            Page.FlyingFleets=[fleet];Page.mapObjects=[];Page.drawFlyingFleets(ctx,time);
            const point=Page.mapObjects.find(p=>p.kind==='fleet');Page.mapObjects=saved;
            return {point,rects,lines};
        };
        const point=samples['paused-at-real-point'];
        const a=draw(point,now),b=draw(point,now+120);
        check('paused-point-visible-without-flight-timer',Boolean(a.point)&&a.rects===2);
        const physical=Page.mapFleetPhysicalPoint(Page.getFleetCoordinatePhysicalPoint(point.segment_start,now));
        const displaced=Math.hypot(a.point.x-(Page.canvas.width/2+Page.offset.x+physical.x*Page.zoom),
            a.point.y-(Page.canvas.height/2+Page.offset.y+physical.y*Page.zoom))>.001;
        check('paused-point-does-not-move-or-show-route',a.lines===(displaced?1:0)&&a.point.x===b.point.x&&a.point.y===b.point.y);
        for(const name of ['paused-planet','paused-moon']){
            const f=samples[name],a=draw(f,now),b=draw(f,now+3600);
            check(name+'-visible-and-follows-orbit',a.rects===2&&Math.hypot(a.point.x-b.point.x,a.point.y-b.point.y)>.001);
            const card=Page.createFleetCard(f);
            check(name+'-card-shows-pause-not-false-arrival',card.find('.GalaxyObjectCardNote').text().startsWith('Приостановлен:')
                &&!card.find('.GalaxyObjectCardNote').text().includes('прибытие'));
        }
        const planets=Page.Planets,anchor=planets.find(p=>Number(p.planet)===7&&Number(p.planet_type)===1);
        const moonPosition=Page.getFleetCoordinatePhysicalPoint(samples['paused-moon'].segment_start,now);
        Page.Planets=[{...anchor,planet_type:3,deg:Number(anchor.deg)+90,speed:0},...planets];
        const reordered=Page.getFleetCoordinatePhysicalPoint(samples['paused-moon'].segment_start,now);
        check('moon-uses-planet-anchor-regardless-of-response-order',JSON.stringify(moonPosition)===JSON.stringify(reordered));
        Page.Planets=planets;
        for(const name of ['paused-unload','observe','defend']){
            check(name+'-stationary-visible',draw(samples[name],now).rects===2);
        }
        check('expedition-not-drawn-even-in-stale-snapshot',!draw(samples.expedition,now).point
            &&!draw({...samples.expedition,blocked_reason:'Экспедиция приостановлена'},now).point);
        const expeditionMove={...samples['planet-to-planet'],mission:40};
        check('expedition-outbound-and-return-move-stay-visible',Boolean(draw(expeditionMove,now).point)
            &&Boolean(draw({...expeditionMove,is_return:true},now).point));
        const move=samples['planet-to-planet'],m1=draw(move,now),m2=draw(move,now+25);
        check('moving-fleet-keeps-arrow-path-and-progress',
            m1.rects===0&&[27,28].includes(m1.lines)&&Math.hypot(m1.point.x-m2.point.x,m1.point.y-m2.point.y)>1e-7,
            {m1,m2,now,start:move.start_time,end:move.end_time});
        check('invalid-active-timer-not-drawn',!draw({...move,end_time:move.start_time},now).point);
        const system=Page.System;Page.System={...system,system:9};
        check('other-system-not-drawn',!draw(point,now).point);Page.System=system;
        Page.FlyingFleets=[];Page.renderPlanets();
        return results;
    """)
    c.results.extend(results)
    for width, height in [(1440, 1000), (390, 844), (320, 740)]:
        c.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
            'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 700}})
        c.js("""
            Page.adjustCanvasSize();Page.calculateZoomFit();Page.cancelZoomAnimation();
            Page.zoom=Page.fitZoom;Page.offset={x:0,y:0};
            Page.FlyingFleets=[__galaxyFleetFixtures['paused-moon'],__galaxyFleetFixtures['paused-planet']];
            Page.renderPlanets();Page.closeObjectMenu();
            const objects=Page.mapObjects.filter(p=>p.kind==='fleet');
            if(objects.length!==2||Math.hypot(objects[0].x-objects[1].x,objects[0].y-objects[1].y)<29)throw Error('overlapping orbital fleets');
        """)
        # Принудительно перекрываем старое место маркера DOM-подписью, независимо от углов планет.
        assert c.js("""
            const before=Page.mapObjects.find(p=>p.kind==='fleet'),r=Page.canvas.getBoundingClientRect(),
                s=Page.$System[0].getBoundingClientRect();
            const baseline=JSON.stringify(Page.FlyingFleets);
            $('<div>',{class:'GalaxyPlanetCaption','data-fleet-audit-blocker':'1',text:'Подпись планеты'})
                .css({position:'absolute',left:r.left-s.left+before.x*r.width/Page.canvas.width-75,
                    top:r.top-s.top+before.y*r.height/Page.canvas.height-32,width:150,height:64,zIndex:200})
                .appendTo(Page.$System);
            Page.renderPlanets();
            const after=Page.mapObjects.find(p=>p.kind==='fleet');
            const free=Page.mapObjects.filter(p=>p.kind==='fleet').every(p=>
                [[p.x,p.y],[(p.label.left+p.label.right)/2,(p.label.top+p.label.bottom)/2]].every(([x,y])=>
                    document.elementFromPoint(Math.round(r.left+x*r.width/Page.canvas.width),
                        Math.round(r.top+y*r.height/Page.canvas.height))===Page.canvas));
            return free&&Math.hypot(after.x-before.x,after.y-before.y)>1&&baseline===JSON.stringify(Page.FlyingFleets);
        """)
        c.shot(str(width) + '-fleet-avoids-caption')
        forced_position = c.js("""
            const p=Page.mapObjects.find(p=>p.kind==='fleet'),r=Page.canvas.getBoundingClientRect();
            return {x:Math.round(r.left+p.x*r.width/Page.canvas.width),y:Math.round(r.top+p.y*r.height/Page.canvas.height),id:p.id};
        """)
        c.call('/actions', {'actions': [{'type': 'pointer', 'id': 'galaxy-mouse', 'parameters': {'pointerType': 'mouse'}, 'actions': [
            {'type': 'pointerMove', 'duration': 50, 'x': forced_position['x'], 'y': forced_position['y'], 'origin': 'viewport'},
            {'type': 'pointerDown', 'button': 0}, {'type': 'pointerUp', 'button': 0}]}]})
        c.wait(lambda: c.js("return Page.selectedMapObject?.kind==='fleet'&&Page.selectedMapObject.id===arguments[0]&&Page.$ObjectMenu.is(':visible')", forced_position['id']))
        c.results.append({'name': str(width) + '-marker-and-label-avoid-forced-caption-without-coordinate-mutation', 'passed': True})
        c.js("Page.closeObjectMenu();Page.$System.find('[data-fleet-audit-blocker]').remove();Page.renderPlanets()")
        c.shot(str(width) + '-paused-orbital-fleets')
        position = c.js("""
            const marker=Page.mapObjects.find(p=>p.kind==='fleet'),r=Page.canvas.getBoundingClientRect();
            // На тесной карте точку маркера может перекрыть подпись планеты.
            // Имя флота также является штатной целью клика: выбираем видимый hit target.
            const points=[[marker.x,marker.y],[(marker.label.left+marker.label.right)/2,
                (marker.label.top+marker.label.bottom)/2]];
            const candidates=points.map(([x,y])=>({x:Math.round(r.left+x*r.width/Page.canvas.width),
                y:Math.round(r.top+y*r.height/Page.canvas.height)}));
            const point=candidates.find(p=>document.elementFromPoint(p.x,p.y)===Page.canvas);
            if(!point)throw Error('Fleet marker and label covered by another element');
            return point;
        """)
        c.call('/actions', {'actions': [{'type': 'pointer', 'id': 'galaxy-mouse', 'parameters': {'pointerType': 'mouse'}, 'actions': [
            {'type': 'pointerMove', 'duration': 50, 'x': position['x'], 'y': position['y'], 'origin': 'viewport'},
            {'type': 'pointerDown', 'button': 0}, {'type': 'pointerUp', 'button': 0}]}]})
        c.wait(lambda: c.js("return Page.selectedMapObject?.kind==='fleet'&&Page.$ObjectMenu.is(':visible')"))
        assert c.js("""
            const text=Page.$ObjectMenuBody.find('.GalaxyObjectCardNote').text(),r=Page.$ObjectMenu[0].getBoundingClientRect();
            return text.startsWith('Приостановлен:')&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;
        """)
        c.shot(str(width) + '-paused-fleet-card')
        c.results.append({'name': str(width) + '-separate-orbital-markers-clickable-pause-card', 'passed': True})
    assert c.js("return __galaxyFleetErrors.filter(e=>e!=='ResizeObserver loop completed with undelivered notifications.').length===0")
    c.out.joinpath('galaxy-fleet-results.json').write_text(json.dumps(c.results, ensure_ascii=False, indent=2))
    print(json.dumps({'passed': len(c.results), 'artifacts': str(c.out), 'gameCommandsSent': 0}, ensure_ascii=False))
except HTTPError as error:
    raise AssertionError(json.loads(error.read()).get('value', {}).get('message', 'Selenium error')) from None
finally:
    c.js("""
        Page.$System?.find('[data-fleet-audit-blocker]').remove();
        Page.closeObjectMenu?.();
        if(window.__galaxyFleetListener){removeEventListener('error',__galaxyFleetListener);removeEventListener('unhandledrejection',__galaxyFleetListener);}
        delete window.__galaxyFleetFixtures;delete window.__galaxyFleetListener;delete window.__galaxyFleetErrors;
    """)
    c.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
    c.call('/refresh', {})
