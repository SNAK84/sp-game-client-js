"""0В: живые страницы snak1 после полного удаления ID 220. Без игровых команд."""
import json
from check_fleet_mission_layout import Check


class RemovedShipCheck(Check):
    def check(self, name, script):
        assert self.js(script), name
        self.results.append({'name':name,'passed':True})
        print('OK '+name,flush=True)

    def navigate(self, mode, page):
        self.js("GameEvents.emit('SendServer',{mode:arguments[0],NotOverlay:true})",mode)
        self.wait(lambda:self.js("return Page?.Name===arguments[0] && WS.requestCallbacks.size===0",page))

    def run(self):
        self.call('/refresh',{})
        self.wait(lambda:self.js("return typeof Page!=='undefined' && !!Page?.Name && WS.ws.readyState===1 && WS.requestCallbacks.size===0"))
        self.js("""
            window.__retiredEmit=GameEvents.emit;window.__retiredWrites=[];
            GameEvents.emit=function(name,p,...args){
                if(name==='SendServer'&&['build','toOrbit','MoveShip','SendMission','SetFleetCommands'].includes(p.action)){
                    __retiredWrites.push(p.action);return;
                }
                return __retiredEmit.call(this,name,p,...args);
            };
        """)
        try:
            for width,height in [(1440,1000),(390,844),(320,568)]:
                self.call('/goog/cdp/execute',{'cmd':'Emulation.setDeviceMetricsOverride','params':{
                    'width':width,'height':height,'deviceScaleFactor':1,'mobile':width<700}})
                self.navigate('shipyard','HangarPageClass')
                self.wait(lambda:self.js("return Page.messageData.data.Page.page==='shipyard' && !!Page.$Content?.Items?.[202]"))
                self.check(str(width)+'-shipyard-api-and-model',"""
                    return !Page.messageData.data.Page.FleetList[220] && !!Page.messageData.data.Page.FleetList[202]
                        && !Page.$Content.Items[220] && !!Page.$Content.Items[202];
                """)
                self.navigate('defense','HangarPageClass')
                self.wait(lambda:self.js("return Page.messageData.data.Page.page==='defense' && !!Page.$Content?.Items?.[401]"))
                self.check(str(width)+'-defense-preserved',"return !!Page.messageData.data.Page.FleetList[401] && !Page.messageData.data.Page.FleetList[220]")
                self.navigate('fleets','FleetsPageClass')
                self.check(str(width)+'-fleet-selection',"return !Page.messageData.data.Page.PlanetShips[220] && !!Page.messageData.data.Page.PlanetShips[202]")
            self.js('InformationPage.show(220)')
            self.wait(lambda:self.js("return !!document.querySelector('.InformationNotice.red_text') && WS.requestCallbacks.size===0"))
            self.check('removed-id-rejected',"return $('.InformationNotice').text().includes('Неизвестный игровой объект') && !Lang.tech[220] && !Lang.longDescription[220]")
            self.check('credit-description',"return Lang.shortDescription[921].includes('Кредиты') && Lang.longDescription[921].includes('Кредиты') && !Lang.longDescription[921].includes('Тёмная материя')")
            self.check('historical-report-fallback',"return BattleReportsUI.groupName({type:220})==='#220' && BattleReportsUI.visual({type:220,kind:'ship'}).find('i').length===1")
            self.check('no-gameplay-requests',"return __retiredWrites.length===0")
        finally:
            self.js('GameEvents.emit=__retiredEmit;Dialog.close()')
            self.call('/goog/cdp/execute',{'cmd':'Emulation.clearDeviceMetricsOverride','params':{}})
            self.call('/refresh',{})
            self.wait(lambda:self.js("return typeof Page!=='undefined' && !!Page?.Name && WS.ws.readyState===1 && WS.requestCallbacks.size===0"))
        self.out.joinpath('stage0c-results.json').write_text(json.dumps(self.results,ensure_ascii=False,indent=2))
        print('RESULT '+str(len(self.results))+' passed; '+str(self.out),flush=True)


if __name__=='__main__':
    RemovedShipCheck().run()
