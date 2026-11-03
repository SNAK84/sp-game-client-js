"""Read-only UI-проверка раскрытого сенсорного участка в открытом SPA.

Без игровых команд/сканов. Использует существующую Selenium-сессию;
после fixtures заново получает authoritative страницу.
"""
import json
from check_mobile_sensors import MobileSensorCheck


class SensorRouteCheck(MobileSensorCheck):
    def run(self):
        original = self.js('return Data.mode')
        try:
            self.reload('galaxy')
            self.wait(lambda: self.js('return Page.SystemShow&&Page.Orbits?.length>0'))
            self.js("""
                window.__routeFaults=[];
                window.__routeListener=e=>__routeFaults.push(e.message||String(e.reason));
                addEventListener('error',__routeListener);addEventListener('unhandledrejection',__routeListener);
                const now=GameServerTime.now(),g=Number(Page.System.galaxy),s=Number(Page.System.system);
                const r=Number(Page.Orbits[Math.floor(Page.Orbits.length/2)].distance);
                const a={type:2,galaxy:g,system:s,distance:r*.7,angle:350};
                const b={type:2,galaxy:g,system:s,distance:r*1.1,angle:100};
                window.__routeFixture={id:99051,tier:3,fresh:true,position:{type:2,galaxy:g,system:s,...Page.interpolateFleetPhysicalPoint(a,b,.25)},
                    observedAt:now,freshUntil:now+30,retainUntil:now+300,owner_name:'QA <img onerror=bad()>',
                    ships:[{id:202,count:2}],course:90,
                    route:{start:{type:1,galaxy:g,system:s,orbit:2,objectType:1},end:b,
                        motionStart:a,motionEnd:b,startsAt:now-100,endsAt:now+300}};
                Page.SensorContacts=[__routeFixture];window.__routeBaseline=JSON.stringify(__routeFixture);
                Page.renderPlanets();
            """)
            motion = self.js("""
                const c=__routeFixture,t=c.observedAt;
                const a=Page.getSensorContactPosition(c,t),b=Page.getSensorContactPosition(c,t+5);
                const frozen=Page.getSensorContactPosition({...c,fresh:false},t+20);
                const low={...c,tier:2};
                const lowPosition=Page.getSensorContactPosition(low,t+20);
                const unknown={...c,id:99052,fresh:false};
                return {moves:JSON.stringify(a)!==JSON.stringify(b),freezes:JSON.stringify(b)===JSON.stringify(frozen),
                    lowHidden:Page.sensorContactRoute(low)===null,
                    lowStatic:JSON.stringify(lowPosition)===JSON.stringify(c.position),
                    staleFirst:JSON.stringify(Page.getSensorContactPosition(unknown,t+20))===JSON.stringify(c.position),
                    immutable:JSON.stringify(c)===__routeBaseline};
            """)
            assert all(motion.values()), motion
            self.results.append({'name': 'movement-tier-and-stale-freeze', **motion})
            for width, height in [(1440, 1000), (390, 844), (320, 568)]:
                self.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
                    'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 700}})
                view = self.js("""
                    Page.adjustCanvasSize();Page.zoom=Page.fitZoom;Page.offset={x:0,y:0};Page.renderPlanets();
                    const old=Page.zoom,r=Page.canvas.getBoundingClientRect();
                    Page.$System[0].dispatchEvent(new WheelEvent('wheel',{deltaY:-120,
                        clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,cancelable:true}));
                    const zoomed=Page.zoom>old;Page.offset.x+=25;Page.offset.y-=20;Page.limitPan();Page.renderPlanets();
                    Page.openObjectMenu('contact',99051);
                    const text=Page.$ObjectMenuBody.text(),rect=Page.$ObjectMenu[0].getBoundingClientRect();
                    return {width:innerWidth,zoomed,from:text.includes('Откуда:'),to:text.includes('Куда:'),
                        escaped:!Page.$ObjectMenuBody.find('img').length,validLabels:!text.includes('undefined'),
                        noCargo:text.includes('Груз не раскрыт'),fits:rect.left>=-1&&rect.right<=innerWidth+1,
                        contactPresent:Page.mapObjects.filter(o=>o.kind==='contact'&&o.id===99051).length===1,
                        finite:Page.mapObjects.filter(o=>o.kind==='contact').every(o=>Number.isFinite(o.x)&&Number.isFinite(o.y))};
                """)
                assert all(view[k] for k in ['zoomed', 'from', 'to', 'escaped', 'validLabels', 'noCargo', 'fits', 'contactPresent', 'finite']), view
                self.results.append({'name': 'route-card-wheel-pan-'+str(width), **view})
                self.shot('sensor-route-'+str(width))
                self.js('Page.closeObjectMenu()')
            clean = self.js("""
                const c=__routeFixture;
                Page.SensorContacts=[{...c,tier:2}];Page.renderPlanets();
                const low=Page.createSensorContactCard(Page.SensorContacts[0]).text();
                Page.SensorContacts=[];Page.renderPlanets();
                return {lowPrivate:!low.includes('Откуда:')&&!low.includes('Куда:')&&low.includes('линия не обозначает цель'),
                    cleaned:Page.sensorContactPositions.size===0,faults:__routeFaults};
            """)
            assert clean['lowPrivate'] and clean['cleaned'] and not clean['faults'], clean
            self.results.append({'name': 'downgrade-cleanup-and-errors', **clean})
            self.out.joinpath('sensor-route-ui.json').write_text(json.dumps(self.results, ensure_ascii=False, indent=2))
            print(json.dumps({'passed': len(self.results), 'gameWrites': 0, 'artifacts': str(self.out)}), flush=True)
        finally:
            self.js("""
                if(window.__routeListener){removeEventListener('error',__routeListener);
                    removeEventListener('unhandledrejection',__routeListener);}
            """)
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
            self.reload(original)


if __name__ == '__main__':
    SensorRouteCheck().run()
