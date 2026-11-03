"""B008: read-only проверка в открытой QA Selenium-сессии основного SPA.

Запуск: python3 tools/check_fleet_target_picker.py
Нужны свободный свой флот с редактором и доступная Fleet-цель в его системе.
Устаревший ID задаётся только в UI; отправки миссий и сохранения маршрутов нет.
"""
import json
from check_fleet_mission_layout import Check, KEY


class TargetPickerCheck(Check):
    def settled(self):
        self.wait(lambda: self.js("return WS.requestCallbacks.size===0"))

    def check_dialog(self, kind, source, target):
        self.js("Dialog.close()")
        self.wait(lambda: self.js("return !$(Dialog.dialogDiv).is(':visible')"))
        self.js("""
            const [kind, source, missing] = arguments;
            if (kind === 'mission') {
                Page.target = {type:3, fleetId:missing};
                Page.showTaskFleet(source);
            } else {
                const control = Page.messageData.data.Page.FleetList[source].control;
                const saved = control.steps;
                try {
                    control.steps = [{kind:'mission', mission:10, coordinates:{type:3, fleetId:missing}}, {kind:'return'}];
                    Page.showFleetPlan(source);
                } finally { control.steps = saved; }
            }
        """, kind, source, self.missing)
        self.settled()
        self.wait(lambda: self.js("return $('.FleetTargetPicker:visible').length===1"))
        before = self.js("""
            const picker = $('.FleetTargetPicker:visible')[0], select = picker.querySelector('select');
            const status = picker.querySelector('.FleetTargetStatus'), search = picker.querySelector('input');
            window.__pickerRefs = {picker, select, status, search}; window.__pickerImmediate = null;
            select.addEventListener('change', () => {
                // Снимок в той же задаче JS, до любого WebSocket response.
                window.__pickerImmediate = {value:select.value, text:status.textContent,
                    shown:$(status).is(':visible'), same:picker.querySelector('select')===select,
                    search:search.value, focused:document.activeElement===select};
            });
            return {text:status.textContent, shown:$(status).is(':visible'), value:select.value};
        """)
        assert before['shown'] and 'больше недоступен' in before['text'] and not before['value'], before
        option = self.js("return __pickerRefs.select.querySelector('option[value=\"'+arguments[0]+'\"]')", target)[KEY]
        self.call('/element/' + option + '/click', {})
        immediate = self.js("return window.__pickerImmediate")
        assert immediate and immediate['value'] == str(target), immediate
        assert not immediate['shown'] and not immediate['text'] and immediate['same'], immediate
        self.settled()
        after = self.js("""
            const {picker, select, status, search} = __pickerRefs;
            return {same:picker.isConnected && $('.FleetTargetPicker:visible')[0]===picker
                    && picker.querySelector('select')===select && picker.querySelector('input')===search,
                value:select.value, shown:$(status).is(':visible'), text:status.textContent,
                coordinates:arguments[0]==='mission' ? Page.getNavigationCoordinates() : null};
        """, kind)
        assert after['same'] and after['value'] == str(target) and not after['shown'] and not after['text'], after
        if kind == 'mission':
            assert after['coordinates'] == {'type': 3, 'fleetId': target}, after
        self.results.append({'dialog': kind, 'before': before, 'immediate': immediate, 'afterResponse': after})

    def check_states(self, source, target):
        result = self.js("""
            const [source, id] = arguments, page = Page.messageData.data.Page;
            const saved = page.FleetTargets, target = saved.find(f => Number(f.id)===id);
            let picker;
            const make = selected => {
                if (picker) picker.remove();
                picker = Page.createFleetTargetPicker(source, selected).$picker.appendTo(Dialog.dialogDiv);
                return picker.find('select');
            };
            try {
                page.FleetTargets=[];
                let select=make(0);
                const empty=select.prop('disabled') && picker.find('small').text()==='Нет доступных флотов вне базирования.';
                page.FleetTargets=[target]; select=make(0);
                picker.find('input').val('__no_matching_fleet__').trigger('input');
                const search=picker.find('small').text()==='Поиск не дал результатов.' && select.children().length===1;
                picker.find('input').val('').trigger('input'); select.val(String(id)).trigger('change');
                const recovered=!picker.find('small').is(':visible') && !picker.find('small').text();
                const node=select[0], option=select.find('option[value="'+id+'"]')[0];
                page.FleetTargets=[{...target, selectable:false, reason:'Контакт потерян'}];
                picker.data('refreshTargets')();
                const unavailable=select.val()==='' && option.disabled && picker.find('small').text().includes('больше недоступен');
                const same=select[0]===node && select.find('option[value="'+id+'"]')[0]===option;
                page.FleetTargets=[{...target,id:source}]; picker.data('refreshTargets')();
                const excluded=!select.find('option[value="'+source+'"]').length;
                return {empty, search, recovered, unavailable, same, excluded};
            } finally {
                if (picker) { Page.fleetTargetPickers.delete(picker); picker.remove(); }
                page.FleetTargets=saved;
            }
        """, source, target)
        assert all(result.values()), result
        self.results.append({'controlledUIStates': result})

    def run(self):
        self.wait(lambda: self.js("return typeof Page!=='undefined'&&Page?.Name==='FleetsPageClass'&&WS.ws.readyState===1"))
        ids = self.js("""
            const p=Page.messageData.data.Page;
            for (const source of Object.values(p.FleetList||{})) {
                if (source.status!==0 || !source.control || source.actions?.SetFleetCommands===false || !p.FleetCapabilities?.plan) continue;
                const target=Page.getFleetTargets(source.id).find(f => f.position.galaxy===source.current.galaxy
                    && f.position.system===source.current.system);
                if (target) return {source:source.id,target:target.id,missing:999999999};
            }
            return null;
        """)
        assert ids, 'Нужны свободный свой флот и доступная цель в той же системе'
        self.missing = ids['missing']
        self.js("""
            window.__pickerActions=[];window.__pickerErrors=[];window.__pickerEmit=GameEvents.emit;
            window.__pickerError=e=>__pickerErrors.push(e.message||String(e.reason));
            addEventListener('error',__pickerError);addEventListener('unhandledrejection',__pickerError);
            GameEvents.emit=function(name,payload,...args){
                if(name==='SendServer'){
                    __pickerActions.push(payload.action||'');
                    if(['SendMission','SetFleetCommands'].includes(payload.action)) throw Error('Игровая запись запрещена в проверке B008');
                }
                return __pickerEmit.call(this,name,payload,...args);
            };
        """)
        try:
            for kind in ['mission', 'plan']:
                self.check_dialog(kind, ids['source'], ids['target'])
            self.check_states(ids['source'], ids['target'])
            errors=self.js("return __pickerErrors")
            actions=self.js("return __pickerActions")
            assert not errors and actions.count('GetAvailableMissions') >= 2, (errors, actions)
            print(json.dumps({'ids':ids,'results':self.results,'errors':errors,'actions':actions},ensure_ascii=False),flush=True)
        finally:
            self.js("""
                GameEvents.emit=__pickerEmit;removeEventListener('error',__pickerError);
                removeEventListener('unhandledrejection',__pickerError);Page.target=null;Dialog.close();
            """)
            self.call('/refresh', {})


if __name__ == '__main__':
    TargetPickerCheck().run()
