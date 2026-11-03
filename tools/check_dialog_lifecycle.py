"""B012: read-only regression Dialog в открытой QA Selenium-сессии основного SPA.

python3 tools/check_dialog_lifecycle.py [--mobile]
Проверяет настоящие анимации, кнопки/Esc, RAF и окно отправки существующего флота.
Игровые команды не отправляются. Дополнительные окна — только UI fixtures.
"""
import argparse
import json
from check_fleet_mission_layout import Check, KEY


class DialogCheck(Check):
    mobile = False

    def settled(self):
        self.wait(lambda:self.js("""return Dialog.showFrame===null && WS.requestCallbacks.size===0
            && !$(Dialog.dialogDiv).is(':animated') && !$(Dialog.overlay).is(':animated');"""))

    def check(self, name, visible, modal=False, title=None):
        self.settled()
        result=self.js("""
            const d=Dialog.dialogDiv,o=Dialog.overlay,s=getComputedStyle(d),r=d.getBoundingClientRect();
            return {visible:s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>.99,
                closed:s.display==='none',modal:getComputedStyle(o).display!=='none',
                title:d.querySelector('dialog-title')?.textContent,frame:Dialog.showFrame,
                queue:$.queue(d,'fx').length+$.queue(o,'fx').length,
                same:d===__dialogRoot&&o===__dialogOverlay,
                left:r.left,right:r.right,viewport:innerWidth,transition:d.style.transitionProperty};
        """)
        assert result['visible']==visible and result['modal']==modal and result['same'], (name,result)
        assert result['queue']==0 and result['frame'] is None, (name,result)
        assert result['transition']==self.transition, (name,result)
        if not visible:assert result['closed'],(name,result)
        else:assert result['left']>=0 and result['right']<=result['viewport']+1,(name,result)
        if title is not None:assert result['title']==title,(name,result)
        self.results.append({'name':name,'passed':True})
        print('OK '+name,flush=True)

    def fixture(self, title, modal=True, esc=True):
        self.js("Dialog.create($('<p>').text(arguments[0]),arguments[0],null,{width:320,overlay:arguments[1],escEnabled:arguments[2]});", title,modal,esc)

    def escape(self):
        self.call('/actions',{'actions':[{'type':'key','id':'dialog-keyboard','actions':[
            {'type':'keyDown','value':'\ue00c'},{'type':'keyUp','value':'\ue00c'}]}]})

    def drag(self, item, dx, dy):
        self.call('/actions',{'actions':[{'type':'pointer','id':'dialog-mouse','parameters':{'pointerType':'mouse'},'actions':[
            {'type':'pointerMove','origin':{KEY:item},'x':0,'y':0},
            {'type':'pointerDown','button':0},{'type':'pointerMove','origin':'pointer','x':dx,'y':dy,'duration':150},
            {'type':'pointerUp','button':0}]}]})

    def run(self):
        self.wait(lambda:self.js("return typeof Page!=='undefined'&&Page?.Name==='FleetsPageClass'&&WS.ws.readyState===1&&typeof Dialog.stopAnimations==='function'"))
        source=self.js("return Object.values(Page.messageData.data.Page.FleetList||{}).find(f=>Number(f.status)===0&&f.actions?.SetFleetCommands!==false)?.id")
        assert source,'Нужен существующий свободный QA-флот'
        self.call('/goog/cdp/execute',{'cmd':'Emulation.setDeviceMetricsOverride','params':{
            'width':390 if self.mobile else 1365,'height':844 if self.mobile else 900,'deviceScaleFactor':1,'mobile':self.mobile}})
        self.js("Dialog.close()")
        self.settled()
        self.transition=self.js("return Dialog.dialogDiv.style.transitionProperty")
        self.js("""
            window.__dialogRoot=Dialog.dialogDiv;window.__dialogOverlay=Dialog.overlay;
            window.__dialogErrors=[];window.__dialogActions=[];window.__dialogCallbacks=0;window.__dialogCloses=0;
            window.__dialogError=e=>__dialogErrors.push(e.message||String(e.reason));
            addEventListener('error',__dialogError);addEventListener('unhandledrejection',__dialogError);
            window.__dialogEmit=GameEvents.emit;window.__dialogClose=Dialog.close;
            Dialog.close=function(...args){++__dialogCloses;return __dialogClose.apply(this,args);};
            GameEvents.emit=function(name,payload,...args){
                if(name==='SendServer'){
                    __dialogActions.push(payload.action||'');
                    if(['SendMission','SetFleetCommands','ResumeFleet','StopFleet','RecallFleet','DisbandFleet'].includes(payload.action))
                        throw Error('B012: игровая запись запрещена');
                }
                return __dialogEmit.call(this,name,payload,...args);
            };
        """)
        try:
            self.fixture('Обычное окно');self.check('normal-modal-open',True,True,'Обычное окно')
            self.click('#dialog dialog-close-button');self.check('native-close-button',False)

            self.js("Dialog.alert('Переход к отправке',()=>{++__dialogCallbacks;Page.showTaskFleet(arguments[0]);});",source)
            self.settled();self.click('#dialog dialog-buttons button')
            self.check('native-alert-callback-opens-fleet-without-old-fadeout',True,True)
            assert self.js("return __dialogCallbacks===1&&!!Dialog.dialogDiv.querySelector('.FleetTaskPanel')")
            before=self.js('return __dialogCloses')
            self.escape();self.check('escape-closes-latest-fleet-dialog',False)
            assert self.js('return __dialogCloses')==before+1,'Несколько обработчиков Esc'

            self.fixture('Старое окно');self.settled()
            self.js("""
                Dialog.close();window.__dialogNode=$('<input>').val('Сохранённый ввод')[0];
                Dialog.create(__dialogNode,'Новое окно',null,{width:320,overlay:true});
            """)
            self.check('same-task-close-create-keeps-new-dialog',True,True,'Новое окно')
            assert self.js("return __dialogNode.isConnected&&Dialog.dialogDiv.querySelector('dialog-content').firstChild===__dialogNode&&__dialogNode.value==='Сохранённый ввод'")
            self.js("Dialog.close();setTimeout(()=>Dialog.create('После короткого закрытия','50ms',null,{width:320,overlay:true}),50)")
            self.wait(lambda:self.js("return Dialog.dialogDiv.querySelector('dialog-title')?.textContent==='50ms'"))
            self.check('reopen-during-fadeout',True,True,'50ms')

            self.js("""
                Dialog.create('A','До первого RAF',null,{width:320,overlay:true});Dialog.close();
            """)
            self.check('close-before-first-frame-does-not-resurrect-overlay',False)
            self.js("""
                Dialog.create('A','Входящая анимация',null,{width:320,overlay:true});
                requestAnimationFrame(()=>Dialog.close());
            """)
            self.check('close-during-fadein',False)

            self.js("""
                Dialog.create('A','A',null,{width:320,overlay:true});
                Dialog.create('B','B',null,{width:320,overlay:false});
            """)
            self.check('only-latest-create-before-frame-is-visible',True,False,'B')
            self.fixture('Modal');self.check('nonmodal-to-modal',True,True,'Modal')
            self.fixture('Nonmodal',False);self.check('modal-to-nonmodal-removes-old-overlay',True,False,'Nonmodal')

            self.js("Dialog.ErrorLoad('Проверка escEnabled=false')")
            self.check('error-dialog-open',True,True)
            self.escape();self.check('disabled-escape-does-not-close-error',True,True)
            self.click('#dialog dialog-buttons button');self.check('error-close-button',False)
            self.fixture('Повторное закрытие');self.settled()
            self.js('Dialog.close();Dialog.close();Dialog.close()')
            self.check('repeated-close-leaves-no-queue-or-overlay',False)

            self.js("Dialog.error('Продолжить',null,()=>{++__dialogCallbacks;Dialog.create('Новый контент','После error callback',null,{width:320,overlay:true})})")
            self.settled();self.click('#dialog dialog-buttons button')
            self.check('native-error-callback-opens-next-dialog',True,True,'После error callback')
            assert self.js('return __dialogCallbacks===2')
            if not self.mobile:
                before=self.js('return Dialog.dialogDiv.getBoundingClientRect().toJSON()')
                title=self.js("return Dialog.dialogDiv.querySelector('dialog-title')")[KEY]
                self.drag(title,35,20)
                after=self.js('return Dialog.dialogDiv.getBoundingClientRect().toJSON()')
                assert abs(after['left']-before['left']-35)<2 and abs(after['top']-before['top']-20)<2,(before,after)
                self.check('native-drag-still-works',True,True)
                before=after
                handle=self.js('return Dialog.dialogDiv.lastElementChild')[KEY]
                self.drag(handle,30,20)
                after=self.js('return Dialog.dialogDiv.getBoundingClientRect().toJSON()')
                assert after['width']>before['width'] and after['height']>before['height'],(before,after)
                self.check('native-resize-still-works',True,True)
            self.js('Dialog.close()');self.check('final-close',False)
            assert self.js('return !__dialogErrors.length&&__dialogCallbacks===2'),self.js('return __dialogErrors')
            print(json.dumps({'mobile':self.mobile,'passed':len(self.results),'actions':self.js('return __dialogActions'),'errors':self.js('return __dialogErrors'),'results':self.results},ensure_ascii=False),flush=True)
        finally:
            self.js("""
                Dialog.close=__dialogClose;GameEvents.emit=__dialogEmit;
                removeEventListener('error',__dialogError);removeEventListener('unhandledrejection',__dialogError);Dialog.close();
            """)
            self.call('/goog/cdp/execute',{'cmd':'Emulation.clearDeviceMetricsOverride','params':{}})
            self.call('/refresh',{})


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--mobile',action='store_true')
    check=DialogCheck();check.mobile=parser.parse_args().mobile;check.run()
