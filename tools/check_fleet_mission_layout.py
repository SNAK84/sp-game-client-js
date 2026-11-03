"""Read-only UI regression через существующую Selenium-сессию snak1.

python3 tools/check_fleet_mission_layout.py
Не авторизуется другим аккаунтом и НЕ нажимает «Отправить».
Дополнительные миссионные панели проверяются как UI fixtures, без отправки миссий.
"""
import base64
import json
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = "http://127.0.0.1:4444"
KEY = "element-6066-11e4-a52e-4f735466cecf"


def http(path, payload=None):
    request = urllib.request.Request(ROOT + path,
        data=None if payload is None else json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        value = json.load(response)["value"]
    if isinstance(value, dict) and "error" in value:
        raise RuntimeError(value)
    return value


class Check:
    def __init__(self):
        sessions = [slot["session"]["sessionId"] for node in http("/status")["nodes"]
                    for slot in node["slots"] if slot.get("session")]
        assert len(sessions) == 1, "Нужна открытая Selenium-сессия тестового аккаунта snak1"
        self.base = "/session/" + sessions[0]
        self.out = Path(tempfile.mkdtemp(prefix="fleet-mission-layout-"))
        self.results = []

    def call(self, path, payload=None):
        return http(self.base + path, payload)

    def js(self, script, *args):
        return self.call("/execute/sync", {"script": script, "args": list(args)})

    def wait(self, predicate, seconds=30):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            try:
                result = predicate()
                if result:
                    return result
            except urllib.error.HTTPError as error:
                if error.code != 500:
                    raise
            time.sleep(.15)
        raise AssertionError("Browser condition timed out")

    def settled(self):
        self.wait(lambda: self.js("return Page.missionDataLoading===false && WS.requestCallbacks.size===0 && ![...document.querySelectorAll('.FleetMissionDataPanel>overlay')].some(e=>getComputedStyle(e).display!=='none')"))

    def click(self, selector):
        element = self.call("/element", {"using": "css selector", "value": selector})[KEY]
        self.call("/element/" + element + "/click", {})

    def shot(self, name):
        self.out.joinpath(name + ".png").write_bytes(base64.b64decode(self.call("/screenshot")))

    def open(self, width, height):
        self.js("Dialog.close()")
        self.wait(lambda: self.js("return getComputedStyle(Dialog.dialogDiv).display==='none'"))
        self.call("/goog/cdp/execute", {"cmd": "Emulation.setDeviceMetricsOverride", "params": {
            "width": width, "height": height, "deviceScaleFactor": 1, "mobile": width < 700}})
        self.js("Page.showTaskFleet(arguments[0])", self.fleet_id)
        self.settled()
        time.sleep(.15)

    def geometry(self, name):
        result = self.js("""
        const d=Dialog.dialogDiv,c=d.querySelector('dialog-content'),r=d.getBoundingClientRect(),cr=c.getBoundingClientRect();
        const right=cr.left+c.clientLeft+c.clientWidth;
        const wide=[...c.querySelectorAll('.FleetTaskPanel *')].filter(e=>{
            const x=e.getBoundingClientRect();return x.width>0&&x.height>0&&(x.left<cr.left-.6||x.right>right+.6);
        }).map(e=>e.id||e.className||e.tagName);
        const buttons=[...d.querySelector('dialog-buttons').children].map(e=>{
            const x=e.getBoundingClientRect();return {text:e.value||e.textContent,left:x.left,right:x.right,top:x.top,bottom:x.bottom};
        });
        return {name:arguments[0],width:innerWidth,height:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
            overflow:c.scrollWidth-c.clientWidth,wide,buttons,
            ownSelectorVisible:!!Page.navigation.$ownPlanet[0].getClientRects().length};
        """, name)
        assert result["left"] >= 0 and result["right"] <= result["width"] + .6, result
        assert result["top"] >= 0 and result["bottom"] <= result["height"] + .6, result
        assert result["overflow"] == 0 and not result["wide"], result
        assert result["ownSelectorVisible"], result
        for button in result["buttons"]:
            assert result["top"] <= button["top"] < button["bottom"] <= result["height"], result
            assert result["left"] <= button["left"] < button["right"] <= result["right"], result
        self.results.append(result)
        self.out.joinpath('results.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
        print('OK '+name,flush=True)

    def run(self):
        self.call('/refresh',{})
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page?.Name==='FleetsPageClass'&&Page.messageData?.data?.Page?.FleetList&&WS.ws.readyState===1"))
        self.fleet_id = self.js("return Number(Object.keys(Page.messageData.data.Page.FleetList)[0])")
        assert self.fleet_id, "Нужен существующий свободный тестовый флот"
        self.js("""
        window.__layoutErrors=[];window.__layoutActions=[];
        window.__layoutErrorListener=e=>__layoutErrors.push(e.message||String(e.reason));
        addEventListener('error',__layoutErrorListener);addEventListener('unhandledrejection',__layoutErrorListener);
        window.__layoutSocket=WS.ws;window.__layoutSend=WS.ws.send;
        WS.ws.send=function(raw){try{const m=JSON.parse(raw);__layoutActions.push(m.action||'');}catch{}return __layoutSend.call(this,raw);};
        """)
        try:
            for width, height in [(1440,1000),(1024,768),(768,1024),(600,800),(480,800),(390,844),(360,740),(320,568),(844,390)]:
                self.open(width,height)
                for kind in [1,2,3]:
                    if kind != 1:
                        self.click(f'.FleetCoordinateTypeSelector button[value="{kind}"]')
                        self.settled()
                    self.geometry(f"{width}x{height}-type{kind}")
                self.shot(f"{width}-fleet-target")

            self.open(390,844)
            self.call('/goog/cdp/execute',{"cmd":"Emulation.setDeviceMetricsOverride","params":{
                "width":844,"height":390,"deviceScaleFactor":1,"mobile":True}})
            time.sleep(.3)
            self.geometry('orientation-change-while-open')
            assert self.js('return getComputedStyle(document.querySelector(".FleetFlightParameters")).gridTemplateColumns.split(" ").length===1')

            # Настоящий выбор своей планеты/транспорта и штатные обработчики формы.
            self.open(390,844)
            self.js("const s=Page.navigation.$ownPlanet;s.val([...s[0].options].find(o=>o.value&&o.value!==s.val()).value).trigger('change');")
            self.settled()
            mission = self.js("return Page.getTransportMissionId()")
            self.click(f'.FleetMissionPanel button[value="{mission}"]')
            self.settled()
            self.js("$('#ResInput901').val(100).trigger('input')")
            assert self.js("return !document.querySelector('#SendCmds').disabled")
            payload = self.js("return Page.flightControls.getPayload()")
            assert payload["resources"]["901"] == 100 and payload["speedFactor"] == 10, payload
            assert "lastKnownPosition" not in payload["coordinates"], payload
            self.results.append({"name": "transport-form-contract", "payload": payload})

            gate = self.js("""
            const b=document.querySelector('#SendCmds'),v=Page.showMissionDataLoading();
            const blocked=b.disabled;Page.hideMissionDataLoading(v-1);const staleBlocked=b.disabled;
            Page.hideMissionDataLoading(v);return {blocked,staleBlocked,restored:!b.disabled};
            """)
            assert all(gate.values()), gate
            self.results.append({"name": "loading-gates-footer-action", **gate})

            for key, expected in [("\ue011",1),("\ue010",10)]:
                element=self.call('/element',{"using":"css selector","value":"#FleetSpeedRange"})[KEY]
                self.call('/element/'+element+'/value',{"text":key})
                self.settled()
                assert self.js("return Page.flightControls.getPayload().speedFactor") == expected
            self.results.append({"name": "speed-keyboard-min-max", "passed": True})
            self.click('.FleetResRow .btn-box-right')
            loaded=self.js("return Page.flightControls.getPayload().resources[901]")
            assert loaded > 0
            self.click('.FleetResRow .btn-box-left')
            assert self.js("return Page.flightControls.getPayload().resources[901]") == 0
            self.click('#all_resources')
            assert self.js("return Number($('#FleetRemainingResources').text().replace(/\\s/g,''))===0")
            self.results.append({"name": "cargo-max-clear-fill", "passed": True})
            self.geometry('390-transport-filled')
            self.shot('390-transport-filled')

            # UI fixtures, не отправка недоступных этому составу кораблей миссий.
            self.open(320,568)
            for key in ['GROUP_ATTACK','DEFEND','OBSERVE']:
                self.js("Page.selectedMission=Page.messageData.data.Page.FleetMissions.find(m=>m.key===arguments[0]).id;Page.updateMissionSendState();",key)
                self.geometry('320-panel-fixture-'+key)
                self.shot('320-panel-fixture-'+key)
            self.js("const s=Page.navigation.$ownPlanet;s.append($('<option>',{value:'layout-fixture',text:'Очень длинное название тестовой планеты — проверка ширины [1:128:15]'}));s.val('layout-fixture');")
            self.geometry('320-long-selector-fixture')

            original_name=self.js('return Page.messageData.data.Page.FleetList[arguments[0]].name',self.fleet_id)
            try:
                self.js('Page.messageData.data.Page.FleetList[arguments[0]].name=arguments[1]',self.fleet_id,'Очень длинное пользовательское название флота — UI fixture')
                self.open(320,568)
                self.geometry('320-long-title-fixture')
                assert self.js('return document.querySelector("dialog-title").getBoundingClientRect().right <= document.querySelector("dialog-close-button").getBoundingClientRect().left')
            finally:
                self.js('Page.messageData.data.Page.FleetList[arguments[0]].name=arguments[1]',self.fleet_id,original_name)

            theme=self.js('return document.querySelector("#theme-link").href')
            try:
                self.js('window.__layoutThemeLoaded=false;const l=document.querySelector("#theme-link");l.onload=()=>__layoutThemeLoaded=true;l.href="/css/theme-light.css";')
                self.wait(lambda:self.js('return __layoutThemeLoaded'))
                self.geometry('320-light-theme')
                self.shot('320-light-theme')
            finally:
                self.js('window.__layoutThemeLoaded=false;document.querySelector("#theme-link").href=arguments[0]',theme)
                self.wait(lambda:self.js('return __layoutThemeLoaded'))

            self.js('Dialog.close()')
            self.wait(lambda:self.js('return getComputedStyle(Dialog.dialogDiv).display==="none"'))
            self.js('Dialog.create($("<p>").text("UI fixture без формы отправки"),"Другой диалог",[{text:"Закрыть",action:()=>Dialog.close()}],{width:280})')
            time.sleep(.3)
            assert self.js('return getComputedStyle(Dialog.dialogDiv.querySelector("dialog-buttons")).position==="absolute"')
            self.results.append({"name":"other-dialog-styles-unchanged","passed":True})

            assert self.js("return !__layoutActions.includes('SendMission')"), "Запущена игровая миссия"
            # Warning воспроизведён отдельно на обычном tooltip вне диалога.
            # Общий tooltip.js здесь не меняется; новые JS-ошибки не скрываются.
            warnings=self.js('return __layoutErrors.filter(x=>x==="ResizeObserver loop completed with undelivered notifications.")')
            unexpected=self.js('return __layoutErrors.filter(x=>x!=="ResizeObserver loop completed with undelivered notifications.")')
            assert not unexpected, unexpected
            self.results.append({"name":"browser-diagnostics","unexpectedErrors":unexpected,"existingTooltipResizeWarnings":len(warnings)})
            self.settled()
            self.out.joinpath('results.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
            print(json.dumps({"passed":len(self.results),"artifacts":str(self.out),"gameMissionsSent":0,"existingTooltipResizeWarnings":len(warnings)},ensure_ascii=False))
        finally:
            self.js("if(window.__layoutSocket){__layoutSocket.send=__layoutSend;}removeEventListener('error',window.__layoutErrorListener);removeEventListener('unhandledrejection',window.__layoutErrorListener);Dialog.close();")
            self.call('/goog/cdp/execute',{"cmd":"Emulation.clearDeviceMetricsOverride","params":{}})


if __name__ == '__main__':
    Check().run()
