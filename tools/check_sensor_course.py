"""Read-only SPA fixtures: сенсорный курс, не реальная цель или live-маршрут.

Использует существующую Selenium-сессию. Не отправляет игровые команды,
не сканирует фалангой и не создаёт флоты. В конце перечитывает серверную страницу.
"""
import json
from check_mobile_sensors import MobileSensorCheck


class SensorCourseCheck(MobileSensorCheck):
    def run(self):
        original = self.js('return Data.mode')
        try:
            self.reload('galaxy')
            self.wait(lambda: self.js('return Page.SystemShow&&Page.Orbits?.length>0'))
            self.js("""
                window.__courseFaults=[];
                window.__courseListener=e=>__courseFaults.push(e.message||String(e.reason));
                addEventListener('error',__courseListener);addEventListener('unhandledrejection',__courseListener);
                const now=GameServerTime.now(),galaxy=Number(Page.System.galaxy),system=Number(Page.System.system);
                const radius=Number(Page.Orbits[Math.floor(Page.Orbits.length/2)].distance);
                const point=(distance,angle)=>({type:2,galaxy,system,distance,angle});
                Page.SensorContacts=[0,90,225,null].map((course,i)=>({id:99001+i,tier:1,fresh:i!==2,
                    position:point(radius*(.65+i*.1),20+i*85),observedAt:now-5,
                    freshUntil:i===2?now-1:now+120,retainUntil:now+300,
                    ...(course===null?{}:{course})}));
                Page.FlyingFleets=[{id:99010,command:{key:'MOVE_IN_SYSTEM'},start_time:now-10,end_time:now+300,
                    segment_start:point(radius*.3,300),segment_end:point(radius*1.1,60),
                    is_incoming:true,is_hostile:true,owner_name:'QA incoming'}];
                window.__courseBaseline=JSON.stringify(Page.SensorContacts);
                Page.renderPlanets();
            """)
            geometry = self.js("""
                const xy=p=>({x:p.distance*Math.cos(p.angle*Math.PI/180),y:p.distance*Math.sin(p.angle*Math.PI/180)});
                const rows=Page.SensorContacts.filter(c=>c.course!==undefined).map(c=>{
                    const line=Page.getSensorCourseLine(c),a=xy(line.start),b=xy(line.end),p=xy(c.position);
                    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),rad=c.course*Math.PI/180;
                    return {course:c.course,cross:Math.abs((p.x-a.x)*dy-(p.y-a.y)*dx)/len,
                        heading:Math.abs(dx/len-Math.cos(rad))+Math.abs(dy/len-Math.sin(rad)),
                        equalRadius:Math.abs(line.start.distance-line.end.distance),
                        hidden:!['target','segment_end','end_time','motionEnd'].some(k=>k in c)};
                });
                return {rows,stationary:Page.getSensorCourseLine(Page.SensorContacts[3])===null};
            """)
            assert geometry['stationary'] and len(geometry['rows']) == 3, geometry
            assert all(r['cross'] < .00001 and r['heading'] < .00001 and r['equalRadius'] < .00001 and r['hidden'] for r in geometry['rows']), geometry
            self.results.append({'name': 'course-geometry-zero-and-hidden-destination', **geometry})

            rendering = self.js("""
                const oldPath=Page.drawFleetPath,oldMarker=Page.drawFleetMarker,paths=[],markers=[];
                try {
                    Page.drawFleetPath=function(ctx,a,b,color){paths.push({color});return oldPath.call(this,ctx,a,b,color);};
                    Page.drawFleetMarker=function(ctx,p,d,stationary,label,color){markers.push({direction:d,stationary,label,color});return oldMarker.call(this,ctx,p,d,stationary,label,color);};
                    Page.renderPlanets();
                } finally {Page.drawFleetPath=oldPath;Page.drawFleetMarker=oldMarker;}
                return {paths,markers};
            """)
            assert len(rendering['paths']) == 4 and len(rendering['markers']) == 5, rendering
            assert sum(m['stationary'] for m in rendering['markers']) == 1, rendering
            assert all(isinstance(m['direction'], (float, int)) for m in rendering['markers']), rendering
            assert rendering['markers'][0]['color'] == 'rgba(255,90,90,0.95)', rendering
            assert rendering['markers'][3]['color'] == 'rgba(155,163,177,0.95)', rendering
            self.results.append({'name': 'same-path-and-arrow-renderer-as-incoming', **rendering})

            for width, height in [(1440, 1000), (390, 844), (320, 568)]:
                self.call('/goog/cdp/execute', {'cmd': 'Emulation.setDeviceMetricsOverride', 'params': {
                    'width': width, 'height': height, 'deviceScaleFactor': 1, 'mobile': width < 700}})
                result = self.js("""
                    Page.cancelZoomAnimation();Page.adjustCanvasSize();Page.zoom=Page.fitZoom;
                    Page.offset={x:0,y:0};Page.renderPlanets();
                    const before=Page.zoom,r=Page.canvas.getBoundingClientRect();
                    Page.$System[0].dispatchEvent(new WheelEvent('wheel',{deltaY:-120,
                        clientX:r.left+r.width/2,clientY:r.top+r.height/2,bubbles:true,cancelable:true}));
                    const zoomed=Page.zoom>before;
                    Page.offset.x+=25;Page.offset.y-=20;Page.limitPan();Page.renderPlanets();
                    const objects=Page.mapObjects.filter(o=>o.kind==='contact');
                    const o=objects.find(o=>o.id===99001),rect=Page.canvas.getBoundingClientRect();
                    const hit=Page.findMapObject({clientX:rect.left+(o.label.left+o.label.right)/2*rect.width/Page.canvas.width,
                        clientY:rect.top+(o.label.top+o.label.bottom)/2*rect.height/Page.canvas.height});
                    return {width:innerWidth,contacts:objects.length,zoomed,hit:hit?.id===99001,
                        finite:objects.every(o=>Number.isFinite(o.x)&&Number.isFinite(o.y)),
                        immutable:JSON.stringify(Page.SensorContacts)===__courseBaseline};
                """)
                assert result['contacts'] == 4 and all(result[k] for k in ['zoomed', 'hit', 'finite', 'immutable']), result
                self.results.append({'name': 'viewport-wheel-pan-'+str(width), **result})
                self.shot('sensor-course-'+str(width))

            self.js("Page.openObjectMenu('contact',99001)")
            text = self.js('return Page.$ObjectMenuBody.text()')
            assert 'Курс: 0' in text and 'линия не обозначает цель' in text and 'Прибытие' not in text, text
            self.shot('sensor-course-card')
            self.results.append({'name': 'card-explains-course-without-eta', 'text': text})

            ttl = self.js("""
                const c=Page.SensorContacts[0],old=JSON.stringify({position:c.position,course:c.course});
                c.freshUntil=GameServerTime.now()+1;c.retainUntil=GameServerTime.now()+3;
                return {old};
            """)
            self.wait(lambda: self.js('return Page.$ObjectMenuBody.text().includes("Последняя известная отметка")'))
            assert self.js('return JSON.stringify({position:Page.SensorContacts[0].position,course:Page.SensorContacts[0].course})') == ttl['old']
            self.wait(lambda: self.js('return !Page.selectedMapObject&&!Page.mapObjects.some(o=>o.kind==="contact"&&o.id===99001)'))
            self.results.append({'name': 'stale-course-frozen-and-retention-cleanup', 'passed': True})

            dedupe = self.js("""
                Page.SensorContacts=[{...Page.SensorContacts[1],id:99010}];Page.renderPlanets();
                return {contacts:Page.mapObjects.filter(o=>o.kind==='contact').length,
                    incoming:Page.mapObjects.filter(o=>o.kind==='fleet'&&o.id===99010).length,faults:__courseFaults};
            """)
            assert dedupe == {'contacts': 0, 'incoming': 1, 'faults': []}, dedupe
            self.results.append({'name': 'deduplicate-incoming-and-no-js-faults', **dedupe})
            self.out.joinpath('sensor-course-ui.json').write_text(json.dumps(self.results, ensure_ascii=False, indent=2))
            print(json.dumps({'passed': len(self.results), 'gameWrites': 0, 'artifacts': str(self.out)}), flush=True)
        finally:
            self.js("""
                if(window.__courseListener){removeEventListener('error',__courseListener);
                    removeEventListener('unhandledrejection',__courseListener);}
            """)
            self.call('/goog/cdp/execute', {'cmd': 'Emulation.clearDeviceMetricsOverride', 'params': {}})
            self.reload(original)


if __name__ == '__main__':
    SensorCourseCheck().run()
