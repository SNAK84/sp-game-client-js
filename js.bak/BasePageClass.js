window.BasePageClass = class BasePageClass {
    Container = null;
    Name = "Base";
    urls = [];

    messageData = true;

    Head = null;
    Table = null;
    Indexes = {};

    HeadRadios = null;
    HeadInputs = null;
    HeadText = null;
    HeadButtons = null;

    sortDefFlieds = [];
    sortflieds = [];
    // Переменные для отслеживания состояния сортировки
    lastSortedKey = null;
    sortDirection = 1;

    EventNoBlur = false;

    constructor() {
        console.log('BasePageClass constructor');
    }

    GeneretContainer() {
        console.log('BasePageClass GeneretContainer');

        /*
        this.Container = document.createElement("div");
        this.Container.id = this.Name + "Table";
        this.Container.addClass("PageTable");
        this.createHead();
        this.createTable();
        //this.CreateData();
        $("#content").html("");
        $("#content").append(this.Container);

        */
    }

    createHead() {
        console.log('BasePageClass createHead');
        this.Head = document.createElement("div");
        this.Head.id = "Head";
        this.Head.addClass("HeadPage");

        if (this.HeadText) {
            this.Head.append(this.Head.Text = this.createSpan("", "HeadText"));
            this.HeadText.forEach((text) => {
                if (text.Level && text.Level < UserLevel) return;
                this.Head.Text.append(
                    this.Head[text.id] =
                    this.createSpan(text.text, text.id)
                );
            });
        }

        if (this.HeadButtons) {
            this.Head.append(this.Head.Buttons = this.createSpan("", "HeadButtons"));
            this.HeadButtons.forEach((button) => {
                if (button.Level && button.Level < UserLevel) return;
                this.Head.Buttons.append(
                    this.Head[button.id] =
                    this.createButton(button.id, button.Text, button.onClick, button.disabled, button.tooltip, button.class)
                );
                if (button.Hide) this.Head[button.id].hide();
            });
        }

        if (this.HeadInputs) {
            this.Head.append(this.Head.Inputs = this.createSpan("", "HeadInputs"));
            this.HeadInputs.forEach((input) => {
                if (input.Level && input.Level < UserLevel) return;
                this.Head.Inputs.append(
                    this.Head[input.id] =
                    this.createSlider(input.id, input.Text, input.Event, input.checked)
                );
            });
        }

        if (this.HeadRadios) {
            this.Head.append(this.Head.Radios = this.createSpan("", "HeadRadios"));
            this.HeadRadios.forEach((radio) => {
                if (radio.Level && radio.Level < UserLevel) return;
                this.Head.Radios.append(
                    this.Head[radio.id] =
                    this.createRadio(radio.id, radio.name, radio.value, radio.Text, radio.checked, radio.Event)
                );
            });
        }
        this.Container.append(this.Head);
    }

    createTable() {
        console.log('BasePageClass createTable');

        this.Table = document.createElement("table");
        this.Table.Head = document.createElement("thead");
        this.Table.Head.tr = document.createElement("tr");
        this.Table.Head.append(this.Table.Head.tr);
        this.Table.append(this.Table.Head);
        this.Table.Body = document.createElement("tbody");
        this.Table.append(this.Table.Body);

        let div = document.createElement("div");
        div.id = "BodyTable";
        div.addClass("BodyPage");
        div.append(this.Table);
        this.Container.append(div);

        //let th = document.createElement("th");
        //th.addClass("FixTop");

        this.CreateTableHead(this.offsets);
    }

    CreateTableHead(offsets) {
        console.log('BasePageClass CreateTableHead');
        this.Table.Head.tr.remove();
        this.Table.Head.tr = document.createElement("tr");
        this.Table.Head.append(this.Table.Head.tr);

        Object.keys(offsets).forEach(key => {
            let th = document.createElement("th");

            if (this.sortflieds.includes(key)) {
                th.addClass("Pointer");
                th.addEventListener("click", (event) => this.EventSort(event));
            }

            if (this.fixed_fields && this.fixed_fields.includes(key)) {
                th.addClass("fix_left");
            }

            th.addClass("FixTop");
            th.text(offsets[key]);
            th.key = key;

            this.Table.Head.tr.append(th);

            this.Table.Head.tr[key] = th;
        });
    }

    CreateData() {
        console.log('BasePageClass CreateData');

        if (!this.Data) this.Data = [];

        this.Indexes = {};

        let Cats = this.BodyCats;

        let LastCat = 0;
        let offsetsSize = 0;

        if (Cats) {
            if (!this.Data.CatTb) {
                this.Data.CatTb = {};
            }
            if (!this.Data.Cat) {
                this.Data.Cat = {};
            }
            //this.Data.CatTb = {};
            offsetsSize = Array.isArray(this.offsets) ? this.offsets.length : Object.keys(this.offsets).length;
        }
        if (this.Table) this.Table.Body.remove();
        this.Table.Body = document.createElement("tbody");
        this.Table.append(this.Table.Body);



        let This = this;
        PageData.MainData.forEach((data, index) => {
            let UID = data.id.toString();

            This.Indexes[UID] = index;
            let WIN = This.Indexes[UID];

            This.Data[WIN] = {
                ...data
            };


            if (data.cat != LastCat && Cats) {

                if (This.Data.CatTb[data.cat]) This.Data.CatTb[data.cat].remove();
                This.Data.CatTb[data.cat] = document.createElement("tbody");
                This.Data.CatTb[data.cat].id = "cat" + data.cat;
                This.Data.CatTb[data.cat].addClass("Cat");
                this.Data.Cat[data.cat] = {};
                This.Data.Cat[data.cat].count = 0;

                let tr = document.createElement("tr");
                let td = document.createElement("td");

                td.text(PageData.Cats[data.cat].name);
                td.colSpan = offsetsSize;

                td.addClass("green_fon");
                tr.append(td.cloneNode(true));
                This.Data.CatTb[data.cat].append(tr.cloneNode(true));

                This.Table.append(This.Data.CatTb[data.cat]);

                LastCat = data.cat;
            }

            This.Data[WIN].tr = document.createElement("tr");
            This.Data[WIN].td = {};

            if (Cats) {

                This.Data.CatTb[data.cat].append(This.Data[WIN].tr);
            } else {
                This.Table.Body.tr = This.Data[WIN].tr;
                This.Table.Body.append(This.Table.Body.tr);
            }

        });
    }

    RenderData() {
        console.log('BasePageClass RenderData');


    }





    createButton(id, label, onClick, disabled = false, tooltip = null, classname = null) {
        const button = document.createElement("input");
        button.type = "button";
        button.id = id;
        button.value = label;
        if (tooltip) button.ToolTip(tooltip);
        if (disabled) button.disabled = true;
        button.addEventListener("click", onClick);
        if (classname) button.addClass(classname);
        return button;
    }

    createLabel(text, forInput) {
        const label = document.createElement("label");
        label.innerText = text;
        label.setAttribute("for", forInput);
        return label;
    }

    createSpan(text, id = null, nameclass = null, onClick = null) {
        const $span = $('<span>', { text });

        if (id) $span.attr('id', id);

        $span.addClass(nameclass);

        if (onClick) $span.on('click', onClick);

        return $span;
    }

    createDiv(id, nameclass = null, text = null, onClick = null) {
        const div = document.createElement("div");
        div.id = id;
        if (Array.isArray(nameclass)) {
            nameclass.forEach(name => div.addClass(name));
        } else if (nameclass) {
            div.addClass(nameclass);
        }
        if (text) div.innerText = text;
        if (onClick) div.addEventListener("click", onClick);
        return div;
    }

    createInput(type, id, placeholder = null, onInput = null, value = "") {
        const $input = $("<input>", {
            type: type,
            id: id,
            name: id,
            value: value,
            placeholder: placeholder || ""
        });

        // Отключаем автозаполнение для полей пароля
        if (type === "password") {
            $input.attr("autocomplete", "off");
        }

        if (onInput) {
            $input.on("input focus", onInput);
        }
        return $input;
    }

    createRadio(id, name, value, text, checked = false, onChange = null) {
        const label = document.createElement("label");
        label.className = "radio-chkbox";
        label.checked = checked;

        if (onChange) label.addEventListener("change", onChange);

        const input = document.createElement("input");
        input.type = "radio";
        input.id = id;
        input.name = name;
        input.value = value;
        if (checked) input.checked = true;
        //if (onChange) input.addEventListener("change", onChange);
        input.addEventListener("change", (event) => {
            event.target.parentElement.checked = event.target.checked;
        });

        label.append(input);
        label.append(this.createSpan(" ", null, "radio-custom"));
        label.append(this.createSpan(text, null, "radio-text"));
        return label;
    }

    createSlider(id, text, onChange = null, checked = false) {
        const $slider = $("<label>").addClass("slider-chkbox");

        const $input = this.createInput("checkbox", id);

        $slider.prop("checked", checked);
        $input.prop("checked", checked);
        $input.val(checked ? "on" : "off");

        $input.on("change", (event) => {
            const isChecked = $(event.target).prop("checked");

            $slider.prop("checked", isChecked);
            $(event.target).val(isChecked ? "on" : "off");

        });

        if (onChange) $input.on('change', onChange);

        $slider
            .append($input)
            .append(this.createSpan(" ", null, "slider"))
            .append(this.createSpan(text, null, "slider-text"));

        // Добавляем поддержку .val() на jQuery-стиле
        $slider.val = function (value) {
            if (value === undefined) {
                return $input.prop("checked");
            } else {
                $input.prop("checked", !!value);
                $slider.toggleClass("checked", !!value);
                return $slider;
            }
        };

        return $slider;
    }

    createPasswordContainer(id, label, value = "", onInput = null) {
        const $container = $('<div>', { class: 'password-container' });

        const $input = $('<input>', {
            type: 'password',
            id: id,
            name: id,
            placeholder: label,
            value: value,
            //autocomplete: 'off'
        });

        if (onInput) $input.on('input', onInput);

        const $toggle = $('<div>', { class: 'vpas', 'aria-label': 'Показать/скрыть пароль', role: 'button', tabindex: 0 });
        $toggle.on('click', () => {
            $toggle.toggleClass('view');
            $input.attr('type', $input.attr('type') === 'password' ? 'text' : 'password');
        });

        const $hint = $('<div>', { class: 'password-hint' }).hide();

        //$input.on('focus', () => $hint.show());
        $input.on('blur', () => $hint.hide());

        const $inputWrapper = $('<div>', { class: 'input-wrapper' }).append($input, $toggle);
        $container.append($inputWrapper, $hint);

        return $container;
    }

    createPinContainer(id, length = 6, onComplete = null) {
        length = Math.max(4, Math.min(8, parseInt(length, 10) || 4));

        const $container = $('<div>', { class: 'pin-container', id: id });
        const $hidden = $('<input>', { type: 'hidden', name: id });
        $container.append($hidden);

        const inputs = []; // массив jQuery-элементов

        for (let i = 0; i < length; i++) {
            const $input = $('<input>', {
                type: 'tel',
                inputmode: 'numeric',
                pattern: '[0-9]*',
                maxlength: 1,
                class: 'pin-input',
                'data-index': i,
                //autocomplete: 'one-time-code' // полезно на мобильных
            });

            // input: только цифры, переход вправо при вводе
            $input.on('input', function () {
                const $t = $(this);
                const idx = parseInt($t.data('index'), 10);
                const val = ($t.val() || '').replace(/\D/g, '').slice(0, 1);
                $t.val(val);

                if (val !== '' && idx < length - 1) {
                    inputs[idx + 1].focus();
                }
                checkComplete();
            });

            // клавиатурные события: backspace, стрелки
            $input.on('keydown', function (e) {
                const $t = $(this);
                const idx = parseInt($t.data('index'), 10);

                if (e.key === 'Backspace') {
                    if ($t.val() === '') {
                        if (idx > 0) {
                            e.preventDefault();
                            inputs[idx - 1].val('').focus();
                        }
                    } else {
                        // если есть символ — просто очистить текущую ячейку
                        $t.val('');
                    }
                    checkComplete();
                } else if (e.key === 'ArrowLeft') {
                    if (idx > 0) inputs[idx - 1].focus();
                    e.preventDefault();
                } else if (e.key === 'ArrowRight') {
                    if (idx < length - 1) inputs[idx + 1].focus();
                    e.preventDefault();
                }
            });

            // вставка: распределяем по ячейкам, начиная с текущей
            $input.on('paste', function (e) {
                e.preventDefault();
                const clipboard = (e.originalEvent || e).clipboardData.getData('text') || '';
                const digits = clipboard.replace(/\D/g, '');
                if (!digits) return;

                const start = parseInt($(this).data('index'), 10);
                for (let k = 0; k < digits.length && (start + k) < length; k++) {
                    inputs[start + k].val(digits[k]);
                }
                const next = Math.min(length - 1, start + digits.length - 1);
                inputs[next].focus();
                checkComplete();
            });

            inputs.push($input);
            $container.append($input);
        }

        function checkComplete() {
            const code = inputs.map(($el) => $el.val()).join('');
            $hidden.val(code); // обновляем hidden
            $container.val(code);
            if (code.length === length) {
                if (typeof onComplete === 'function') onComplete(code);
            }
        }

        // вспомогательные методы на jQuery-контейнере
        $container[0].getCode = function () {
            return inputs.map($el => $el.val()).join('');
        };
        $container[0].clear = function () {
            inputs.forEach($el => $el.val(''));
            inputs[0].focus();
        };

        // если нужно — поставить фокус в первую ячейку
        setTimeout(() => inputs[0].focus(), 0);

        return $container;
    }


    createSelect(id, name, options, SelectDefault = null) {
        const select = document.createElement("select");
        select.id = id;
        select.name = name;
        // Если options — объект, преобразуем его в массив
        if (Array.isArray(options)) {
            console.log('createSelect', options);
            options.forEach((data, index) => {
                select.append(this.createOption(data.value, (data.name) ? data.name : data.text, SelectDefault == index));
            });
        } else if (typeof options === 'object') {
            Object.entries(options).forEach(([value, option]) => {
                select.append(this.createOption(value, option.name, SelectDefault == value));
            });
        }

        return select;
    }

    createOption(value, text, selected = false) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        if (selected) option.selected = true;
        return option;
    }

    createForm(FieldsForm, id = "Form", mode, action, classname = null) {

        const $form = $("<form>", {
            id: id,
            //autocomplete: "off"
        });

        if (classname) {
            $form.addClass(classname);
        }

        // обработчик отправки через WS
        $form.on("submit", (event) => {
            event.preventDefault();

            const formData = {};
            $form.serializeArray().forEach(({ name, value }) => {
                formData[name] = value;
            });


            Overlay.Show(null, 250, () => {
                WS.Submit(mode, action, formData);
            });

        });

        FieldsForm.forEach(({
            label,
            name,
            type = "text",
            value,
            isSelect,
            SelectDefault,
            mask,
            onInput,
            timer
        }) => {
            let $input;

            if (type === "label") {
                $input = $(this.createSpan(label, name));
            } else if (isSelect) {
                $input = $(this.createSelect(name, name, isSelect, SelectDefault));
            } else if (name === "password" || type === "password") {
                $input = $(this.createPasswordContainer(name, label, value, onInput));
            } else if (type === "slider") {
                $input = $(this.createSlider(name, value));
            } else if (type === "pin") {
                $input = $(this.createPinContainer(name, 6, onInput));
            } else {
                $input = $(this.createInput(type, name, label, onInput, value));
                if (mask) {
                    try {
                        $input[0].mask = IMask($input[0], mask);
                    } catch (e) {
                        console.warn("IMask не подключен:", e);
                    }
                }
            }

            // === интеграция TimerController ===
            if (timer) {
                const element = $input[0];

                // Авто-блокировка кнопки/инпута
                if (element.tagName === "INPUT" || element.tagName === "BUTTON") {
                    element.disabled = true;
                }

                // timer: { seconds, template, tickInterval, form, ms, onEnd }
                new TimerController(element, timer.time, {
                    template: timer.template,
                    tickInterval: timer.tickInterval,
                    form: timer.form,
                    ms: timer.ms,
                    onEnd: (el) => {
                        // Разблокируем кнопку
                        if (el.tagName === "INPUT" || el.tagName === "BUTTON") {
                            el.disabled = false;
                            el.value = value;
                        }

                        // Вызов пользовательского callback, если есть
                        if (typeof timer.onEnd === "function") {
                            timer.onEnd(el);
                        }
                    }
                });

            }

            if (!["submit", "hidden", "label"].includes(type) && label != null) {
                $form.append(this.createLabel(label, name));
            }

            $form[name] = $input;
            $form.append($input);


        });
        return $form;
    }

    renderForm($form, FieldsForm, id = null, mode = null, action = null, classname = null) {
        // Обновляем метаданные формы
        if (id) $form.attr("id", id);
        if (classname) $form.attr("class", classname);
        if (mode) $form._mode = mode;
        if (action) $form._action = action;

        // Полная перерисовка: очищаем и пересоздаём элементы
        $form.empty();

        FieldsForm.forEach(({
            label,
            name,
            type = "text",
            value,
            isSelect,
            SelectDefault,
            mask,
            onInput,
            timer
        }) => {
            let $input;

            if (type === "label") {
                $input = $(this.createSpan(label, name));
            } else if (isSelect) {
                $input = $(this.createSelect(name, name, isSelect, SelectDefault));
            } else if (name === "password" || type === "password") {
                $input = $(this.createPasswordContainer(name, label, value, onInput));
            } else if (type === "slider") {
                $input = $(this.createSlider(name, value));
            } else if (type === "pin") {
                $input = $(this.createPinContainer(name, 6, onInput));
            } else {
                $input = $(this.createInput(type, name, label, onInput, value));
                if (mask) {
                    try {
                        $input[0].mask = IMask($input[0], mask);
                    } catch (e) {
                        console.warn("IMask не подключен:", e);
                    }
                }
            }

            // Таймер для элементов, поддерживающих его
            if (timer) {
                const element = $input[0];
                if (element.tagName === "INPUT" || element.tagName === "BUTTON") {
                    element.disabled = true;
                }

                new TimerController(element, timer.time, {
                    template: timer.template,
                    tickInterval: timer.tickInterval,
                    form: timer.form,
                    ms: timer.ms,
                    onEnd: (el) => {
                        if (el.tagName === "INPUT" || el.tagName === "BUTTON") {
                            el.disabled = false;
                            el.value = value;
                        }
                        if (typeof timer.onEnd === "function") timer.onEnd(el);
                    }
                });
            }

            if (!["submit", "hidden", "label"].includes(type) && label != null) {
                $form.append(this.createLabel(label, name));
            }

            $form[name] = $input;
            $form.append($input);
        });

        return $form;
    }

    EventSort(event) {
        let currentKey = event.target.key;

        // Если кликаем на то же поле, меняем направление
        if (this.lastSortedKey === currentKey) {
            this.sortDirection *= -1; // Меняем направление
        } else {
            // Если кликаем на новое поле, сбрасываем на возрастание
            this.sortDirection = 1;
            this.lastSortedKey = currentKey;
        }

        let sortflieds = [currentKey];
        this.sortDefFlieds.forEach(flied => {
            if (flied != currentKey)
                sortflieds.push(flied);
        });

        this.Data.sort(sortByMultipleKey(sortflieds, this.sortDirection));
        this.RenderData();
    }

    EventDClick(event) {

        let WIN = event.target.WIN;
        let Key = event.target.Key;

        if (this.Data[WIN].td[Key].Edit) return;

        this.CreateEditInput(WIN, Key);
    }

    EventEndEdit(event) {

        if (event.key === "Escape") {
            //console.log('EventEndEdit', "Escape");
            this.EventKeyEsc(event);
        }
        else if (event.shiftKey && event.key === "ArrowDown") {
            //console.log('EventEndEdit', "Shift+ArrowDown");
            this.EventSaveEdit(event, "bottom");
        }
        else if (event.shiftKey && event.key === "ArrowUp") {
            //console.log('EventEndEdit', "Shift+ArrowUp");
            this.EventSaveEdit(event, "top");
        }
        else if (event.shiftKey && event.key === "Tab") {
            //console.log('EventEndEdit', "Shift+Tab");
            this.EventSaveEdit(event, "prev");
        }
        else if (event.key === "Tab") {
            //console.log('EventEndEdit', "Tab");
            this.EventSaveEdit(event, "next");
        }
        else if (event.key === "Enter") {
            //console.log('EventEndEdit', "Enter");
            this.EventSaveEdit(event);
        }
        else this.EventKey(event);
    }

    EventKey(event) {



    }

    EventSaveEdit(event, next = null) {
        this.EventNoBlur = true;

        let WIN = event.target.WIN;
        let Key = event.target.Key;
        let nextWIN = WIN;
        let nextKey = Key;

        if (next == "prev") {
            nextKey = this.prevoffsets[Key];
            if (!nextKey) {
                event.preventDefault();
                return;
            }
        } else if (next == "next") {
            nextKey = this.nextoffsets[Key];
            if (!nextKey) {
                event.preventDefault();
                return;
            }
        } else if (next == "top") {
            nextWIN = WIN - 1;
            while (nextWIN >= 0 && this.Data[nextWIN].tr.style.display === "none") {
                nextWIN--;
            }
            if (nextWIN < 0) {
                event.preventDefault();
                return;
            }
        } else if (next == "bottom") {
            nextWIN = WIN + 1;
            while (nextWIN < this.Data.length && this.Data[nextWIN].tr.style.display === "none") {
                nextWIN++;
            }
            if (nextWIN >= this.Data.length) {
                event.preventDefault();
                return;
            }
        }

        let isSave = this.ProcessInputValue(WIN, Key);
        //if (next) this.RenderDataKey(WIN, Key);
        if (isSave) this.SaveEditInputAjax(WIN, Key, (next) ? false : true);
        this.EventKeyEsc(event);
        this.EventNoBlur = true;

        if (next) {
            //console.log('EventSaveEdit: Создаем input', nextWIN, nextKey);
            this.CreateEditInput(nextWIN, nextKey);
        }

        event.preventDefault();
        this.EventNoBlur = false;
    }

    EventKeyEsc(event) {
        //console.log('EventKeyEsc', event);

        this.EventNoBlur = true;
        let WIN = event.target.WIN;
        let Key = event.target.Key;

        // Проверка на существование данных
        if (!this.Data[WIN] || !this.Data[WIN].td || !this.Data[WIN].td[Key]) {
            console.warn('EventKeyEsc: Нет данных для', WIN, Key, this.Data[WIN]);
            this.EventNoBlur = false;
            return;
        }

        if (this.Data[WIN].td[Key].input) {
            //console.log('EventKeyEsc: Удаляем input', WIN, Key);
            if (this.Data[WIN].td[Key].input.mask) this.Data[WIN].td[Key].input.mask.destroy();
            this.Data[WIN].td[Key].input.remove();
        }
        this.Data[WIN].td[Key].Edit = false;

        this.RenderDataKey(WIN, Key);

        this.EventNoBlur = false;
    }

    EventBlur(event) {
        //console.log('EventBlur', this.EventNoBlur, event);
        if (this.EventNoBlur == true) return;
        this.EventKeyEsc(event);
    }

    FormDialog(action, title, BtnText) {
        // Показать диалог подтверждения
        let form = this.createForm(action, this.FieldsForm[action]);
        dialog.create(
            form,
            title,
            [{
                text: BtnText,
                action: () => {
                    // Создаем событие 'submit'
                    const submitEvent = new Event('submit', {
                        bubbles: true,    // Всплывает как обычное событие
                        cancelable: true  // Можно отменить через event.preventDefault()
                    });
                    // Запускаем событие на форме
                    form.dispatchEvent(submitEvent); // Вызовет handleSubmit

                    dialog.close(); // Закрыть диалог при подтверждении
                    //This.RemoveServer(SID, true)
                }
            },
            { text: "Отмена", action: () => dialog.close() }
            ],
            false
        );
    }


    // Заглушки для переопределения в наследниках
    CreateEditInput(WIN, Key) { }
    ProcessInputValue(WIN, Key) { }
    SaveEditInputAjax(WIN, Key, Render = true) { }
    RenderDataKey(WIN, Key) { }

    hasMainDataChanged() {
        if (!this.hasMainData) return false;

        // Если нет данных — считаем, что изменилось
        if (!PageData.MainData || !this.Data) return true;

        // Получаем строку для PageData.MainData
        const mainDataStr = JSON.stringify(PageData.MainData);
        // Получаем строку для текущих данных (только id, если нужно)
        const dataStr = JSON.stringify(this.Data.map(w => w.id));

        // Можно использовать простую hash-функцию (например, djb2)
        function simpleHash(str) {
            let hash = 5381;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) + hash) + str.charCodeAt(i);
            }
            return hash >>> 0;
        }

        const mainDataHash = simpleHash(mainDataStr);
        const dataHash = simpleHash(dataStr);

        return mainDataHash !== dataHash;
    }

    Show(mode = "", data = null) {
        //console.log("OverViewPageClass Show", data);

        /*if (!GameLayer) GameLayer = new GameLayerClass();
        GameLayer.RenderLeftMenu(data.mode);*/

        // Сохраняем данные из сообщения для использования в формах
        if (data) {
            this.messageData = data;
            if (this.messageData.data.TopNav) GameLayer.RenderTopNav(this.messageData.data.TopNav);
            if (this.messageData.data.PlanetList) GameLayer.RenderPlanetsList(this.messageData.data.PlanetList);

            this.render();
            //console.log("Сохранены данные сообщения:", this.messageData);
        }


        GameLayer.RenderLeftMenu(mode);
        GameLayer.Show();
        this.$Content.fadeIn(250, () => {
            console.log("GameLayer Show");
            //Overlay.Hide()

        });




        /*this.$Content.fadeOut(250,
            () => {
                //this.$Content.html($Content);
                this.$Content.fadeIn(250);
            }
        );*/
        //GameLayer.ShowContent(this.$Content);
    }

    Hide() {
        //this.$Content.fadeOut(250);
        GameLayer.Hide();
        // Удаляем DOM-узлы страницы, чтобы customElements отключились (disconnectedCallback вызовется)
        if (this.$Content) {
            // либо remove только содержимого, либо весь контейнер в зависимости от архитектуры
            this.$Content.empty();
            GameEvents.off("BuildAction");
        }
    }

    Remove() {
        this.Container.remove();
        ShowPage.Page = null;
    }


}