window.BasePageClass = class BasePageClass {

    Name = "BasePageClass";
    messageData = null;
    $Layer = null;

    $TopNav = null;
    $Content = null;
    $LeftMenu = null;
    $PlanetsList = null;


    constructor() {
        this.$Layer = $("#layer");
        if (!this.$Layer.length) {
            console.error("❌ BasePageClass: не найден контейнер #layer!");
            return;
        }

        this.initContent();

        // Создаём левое меню (один раз)
        this.initLeftMenu();
        this.initTopNav();
        this.initPlanetsList();



    }

    /**
     * Инициализация левого меню (один раз при создании)
     */
    initLeftMenu() {
        if (this.$LeftMenu) return; // уже создано

        this.$LeftMenu = $("#LeftMenu");
        if (!this.$LeftMenu.length) {
            console.warn("⚠️ BasePageClass: элемент #LeftMenu не найден!");
            return;
        }

        this.$LeftMenu.hide();
        this.$Layer.append(this.$LeftMenu);

        // обработка кликов по пунктам меню
        this.$LeftMenu.find("[mode]").off("click.base").on("click.base", (e) => {
            const mode = $(e.currentTarget).attr("mode");
            this.setActiveMode(mode);
        });

        // восстановление последнего активного mode
        const initialMode = Data.mode || this.$LeftMenu.find("[mode]").first().attr("mode");
        if (initialMode) {
            this.setActiveMode(initialMode, false); // без запроса на сервер при старте
        }
    }

    setActiveMode(mode, send = true) {

        if (!mode) return;

        // сбрасываем выделение у всех
        this.$LeftMenu.find("[mode]").removeClass("open");

        // выделяем текущий пункт
        this.$LeftMenu.find(`[mode="${mode}"]`).addClass("open");

        // сохраняем в sessionStorage
        Data.mode = mode;

        // если нужно — отправляем запрос на сервер
        if (send) {
            Page.$LeftMenu.removeClass("menu_open");
            $("#MenuBtn").removeClass("menu-open");
            $("#MenuBtn").ToolTip('Показать Меню');

            if(Dialog) Dialog.close();
            Overlay.Show(null, 250, () => {
                this.$Content.stop(true, true).fadeOut(250, () => {
                    this.$Content.Show = false;
                    GameEvents.emit("SendServer", {
                        mode: mode,
                        //action: "list",
                        //data: {}
                    });
                });
            });
        }


    }

    initContent() {

        this.$Content = $("#Content");
        if (this.$Content.length === 0) {
            this.$Content = $("<div>", { id: "Content" });
            this.$Layer.append(this.$Content);
        }
        this.$Content.Show = false;

        this.$Content.empty().removeClass();
    }

    initTopNav() {
        this.$TopNav = $("#TopNav");
        if (this.$TopNav.length === 0) {
            this.$TopNav = $("<div>", { id: "TopNav" });
            this.$Layer.append(this.$TopNav);
        }

        const $MenuBtn = $("#MenuBtn");

        this.$TopNav.empty().hide().append($MenuBtn);

        $MenuBtn.off("click").on("click", () => {
            this.$LeftMenu.toggleClass("menu_open");

            if (this.$LeftMenu.hasClass("menu_open")) {
                //this.$LeftMenu.show(250);
                $("#MenuBtn").ToolTip('Скрыть Меню');
            }
            else {
                //this.$LeftMenu.hide(250);
                $("#MenuBtn").ToolTip('Показать Меню');
            }

            $("#MenuBtn").toggleClass("menu-open");
        }).ToolTip('Показать Меню');;

    }

    initPlanetsList() {
        this.$PlanetsList = $("#PlanetsList");
        if (this.$PlanetsList.length === 0) {
            console.loh("GeneretPlanetsList");
            this.$PlanetsList = $("<div>", { id: "PlanetsList" });
            this.$LeftMenu.append(this.$PlanetsList);
        }
        this.$PlanetsList.html("PlanetsList").hide();;
    }

    RenderLeftMenu() {

        console.log(`RenderLeftMenu [mode="${Data.mode}"]`);
        //alert(mode);
        // убираем выделение у всех
        this.$LeftMenu.find("[mode]").removeClass("open");

        // добавляем выделение к текущему
        this.$LeftMenu.find(`[mode="${Data.mode}"]`).addClass("open");

        this.$LeftMenu.show();
    }

    startTopNavTicker() {
        if (this._topNavActive || !this._topNavData) return;
        this._topNavActive = true;
        $(document).off("GameTick", this._onTopNavTick).on("GameTick", this._onTopNavTick);
    }

    stopTopNavTicker() {
        if (!this._topNavActive) return;
        this._topNavActive = false;
        $(document).off("GameTick", this._onTopNavTick);
    }

    // обработчик вынесем в метод, чтобы можно было отписать
    _onTopNavTick = () => {
        if (this.$TopNav.is(":visible")) {
            this.RenderTopNav(this._topNavData, false);
        } else {
            this.stopTopNavTicker();
        }
    }
    RenderTopNav(mData, startTicker = true) {

        this.$TopNav.show();

        $(".menu_toggle_btn").attr('style', '');
        //await Lang.waitLangs();

        if (this.$TopNav.length === 0) this.initTopNav();

        // Обновляем данные для таймера
        this._topNavData = mData;

        // Запускаем таймер, если нужно
        if (startTicker) {
            this.startTopNavTicker();
        }



        const now = Date.now();

        Data.Resources = mData.Resources;

        $.each(Data.Resources, (res, value) => {
            const $TopNavRes = this.getOrCreateTopNavItem(res);
            const color = this.computeColor(res, value, now);
            const tooltipData = this.buildTopNavTooltipData(res, value, color, now);
            this.renderTopNavTooltip($TopNavRes, tooltipData);

            //$TopNavRes.ToolTip(tooltip);
            $TopNavRes
                .text(humanNumber(value.count, true, 2))
                .attr('class', `ResBox icon${res} ${color}_text`);
        });


        if (!this.$TopNav["Messages"]) {
            this.$TopNav["Messages"] = this.createDiv("", "Messages", "ResBox iconMessages",
                () => {
                    Overlay.Show(null, 250, () => {
                        this.$Content.stop(true, true).fadeOut(250, () => {
                            this.$Content.Show = false;
                            GameEvents.emit("SendServer", {
                                mode: "messages"
                            });
                        });
                    });
                }
            );

            this.$TopNav.append(this.$TopNav["Messages"]);
        }

        this.$TopNav["Messages"].text(mData.NewMessages);
    }

    // Вспомогательная функция: создаём или возвращаем элемент TopNav
    getOrCreateTopNavItem(res) {
        if (!this.$TopNav["Res_" + res]) {
            this.$TopNav["Res_" + res] = $("<div>", {
                id: "Res_" + res,
                class: `ResBox icon${res}`
            });
            this.$TopNav.append(this.$TopNav["Res_" + res]);
        }
        return this.$TopNav["Res_" + res];
    }

    // Вычисление цвета ресурса
    computeColor(res, value, now) {
        if (res > 920) return 'lime';

        if (res > 910) {
            return value.count < 1 ? 'red' : 'lime';
        }

        if (value.time > 0) {
            let count = parseFloat(value.count);
            const sec = now - value.time * 1000;
            if (count < value.max) {
                count += (value.perhour / MS_PER_HOUR) * sec;
                value.time += sec / 1000;
                value.count = count;
            }
            return count >= value.max ? 'red' : 'lime';
        }

        return 'lime';
    }

    // Формирование тултипа
    buildTopNavTooltipData(res, value, color, now) {
        const data = {
            title: Lang.tech[res],
            main: { text: humanNumber(value.count), color },
            details: []
        };

        if (res > 910 && res <= 920) {
            const proc = Math.min(1, value.max / Math.abs(value.used)) * 100;
            data.details.push({ label: Lang.used, value: humanNumber(value.used * -1) });
            data.details.push({ label: Lang.total, value: humanNumber(value.max) });
            data.details.push({ empty: true });
            data.details.push({ label: Lang.production, value: humanNumber(proc) + "%", progress: proc });
        } else if (res <= 910 && value.time > 0) {
            const proc = value.count * 100 / value.max;
            data.details.push({ label: Lang.per_second, value: humanNumber(value.perhour / 3600) });
            data.details.push({ label: Lang.per_minute, value: humanNumber(value.perhour / 60) });
            data.details.push({ label: Lang.per_hour, value: humanNumber(value.perhour) });
            data.details.push({ label: Lang.per_day, value: humanNumber(value.perhour * 24) });
            data.details.push({ empty: true });
            data.details.push({ label: Lang.Capacity, value: humanNumber(value.max), progress: proc });
        }

        return data;
    }

    renderTopNavTooltip($el, tooltipData) {
        const $tooltip = $("<div>", { class: "tooltip-content" });

        // Заголовок
        $tooltip.append($("<strong>").text(tooltipData.title));

        // Основное значение
        $tooltip.append($("<div>", {
            class: `${tooltipData.main.color}_text`
        }).text(tooltipData.main.text));

        // Детали
        if (tooltipData.details.length) {
            const $ul = $("<ul>");
            tooltipData.details.forEach(d => {
                if (d.empty) {
                    $ul.append($("<li>").addClass("tooltip-empty")); // пустой li для отступа
                    return;
                }
                const $li = $("<li>").text(`${d.label}: ${d.value}`);
                if (d.progress !== undefined) {
                    const $progress = $("<div>", { class: "tooltip-progress" });
                    const $bar = $("<div>", {
                        class: `tooltip-progress-bar ${tooltipData.main.color}`
                    }).css("width", Math.min(d.progress, 100) + "%");
                    $progress.append($bar);
                    $li.append($progress);
                }
                $ul.append($li);
            });
            $tooltip.append($ul);
        }

        // Устанавливаем тултип через твою библиотеку
        $el.ToolTip($tooltip.prop('outerHTML'), { 'min-width': '200px' });
    }

    RenderPlanetsList(Data) {
        //return;
        if (this.$PlanetsList.length === 0) this.initPlanetsList();

        this.$PlanetsList.empty().show();

        const $select = $("<select>").attr("id", "planets-select");
        $.each(Data.Planets, (index, planet) => {
            const ptype = (planet.planet_type == 1) ? "П" : "М";
            const optionText = `${planet.name} [${planet.galaxy}:${planet.system}:${planet.planet}] (${ptype})`;
            const $option = $("<option>")
                .val(planet.id)
                .text(optionText)
                .attr("data-class", "planet-icon") // css-класс для иконки
                .attr("data-style", `background-image: url('/images/planets/galaxy/${planet.image}.png');`);

            // Если это выбранная планета
            if (planet.id == Data.current_planet) {
                $option.attr("selected", "selected");
            }
            $select.append($option);
        });
        // Добавляем select в контейнер
        this.$PlanetsList.append($select);



        // Применяем кастомный selectmenu с иконками
        $.widget("custom.planetselectmenu", $.ui.selectmenu, {
            _renderItem: function (ul, item) {
                const li = $("<li>");
                if (item.disabled) li.addClass("ui-state-disabled");

                const wrapper = $("<div>").addClass("planet-wrapper");


                $("<span>", {
                    style: item.element.attr("data-style"),
                    "class": "ui-icon " + item.element.attr("data-class")
                }).appendTo(wrapper);

                // Если пункт выбран (active)
                if (item.element.attr("selected")) {
                    wrapper.addClass("planet-select");
                }

                // Текст
                $("<span>", {
                    text: item.label
                }).appendTo(wrapper);

                return li.append(wrapper).appendTo(ul);
            },
            // Метод для отображения выбранного элемента
            _renderButtonItem: function (item) {
                const wrapper = $("<div>").addClass("planet-wrapper");

                // Иконка для выбранного пункта
                $("<span>", {
                    style: item.element.attr("data-style"),
                    "class": "ui-icon " + item.element.attr("data-class")
                }).appendTo(wrapper);

                // Текст выбранного пункта
                $("<span>", { text: item.label }).appendTo(wrapper);

                return wrapper;
            }
        });


        $("#planets-select")
            .planetselectmenu({
                change: (event, data) => {
                    if(Dialog) Dialog.close();
                    Overlay.Show(null, 250, () => {
                        //this.$Content.html($Content);
                        this.$Content.stop(true, true).fadeOut(250, () => {
                            this.$Content.Show = false;
                            GameEvents.emit("SendServer", {
                                mode: Mode,
                                action: "planetselect",
                                hide: "ActualData",
                                data: { 'planetId': data.item.value }
                            });

                            /*WS.send(new Message()
                                .setMode(Mode)
                                .setAction("planetselect")
                                .setData("planetId", data.item.value)
                            );*/
                        });


                    });

                }
            })
            .planetselectmenu("menuWidget")
            .addClass("ui-menu-icons planet-icons");
    }

    async render() {

        await Lang.waitLangs();

        const top = this.messageData.data?.TopNav;
        const planets = this.messageData.data?.PlanetList;

        if (top && typeof this.RenderTopNav === "function") {
            this.RenderTopNav(top);
        }

        if (planets && typeof this.RenderPlanetsList === "function") {
            this.RenderPlanetsList(planets);
        }

        if (typeof this.RenderLeftMenu === "function") {
            this.RenderLeftMenu();
        }


        /*this.$Content.Show = true;
        this.$Content.show();*/
    }

    Show(mode = "", data = null) {

        console.log("Show " + this.Name);
        // Сохраняем данные из сообщения для использования в формах
        if (data) {
            this.messageData = data;

            Data.mode = data.mode;
            this.render();
            //console.log("Сохранены данные сообщения:", this.messageData);
        }

        this.$Layer.stop(true, true).fadeIn(250, () => {
            if (this.$Content.Show) {
                Overlay.Hide();
            } else
                this.$Content.stop(true, true).fadeIn(250, () => {
                    this.$Content.Show = true;
                    Overlay.Hide();
                })

        });
        //this.$LeftMenu.show();

        /*
        
                GameLayer.RenderLeftMenu(mode);
        
                Layer.Show();*/
        /*this.$Content.fadeIn(250, () => {
            console.log("GameLayer Show");
        });*/
    }

    Hide() {
        if(Dialog) Dialog.close();

        //this.$Content.fadeOut(250);
        this.$Content.stop(true, true).fadeOut(250, () => {
            this.$Content.Show = false;
            Overlay.Hide();
            this.$Content.empty();
        })

        //this.$Layer.stop(true, true).fadeOut(250);
        // Удаляем DOM-узлы страницы, чтобы customElements отключились (disconnectedCallback вызовется)
        // if (this.$Content) {
        // либо remove только содержимого, либо весь контейнер в зависимости от архитектуры
        // this.$Content.empty();
        //}
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
                Data.login = { login: formData.login, password: formData.password }
                this.Hide();
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
                $input = this.createSpan(label, name);
            } else if (isSelect) {
                $input = this.createSelect(name, name, isSelect, SelectDefault);
            } else if (name === "password" || type === "password") {
                $input = this.createPasswordContainer(name, label, value, onInput);
            } else if (type === "slider") {
                $input = this.createSlider(name, value);
            } else if (type === "pin") {
                $input = this.createPinContainer(name, 6, onInput);
            } else {
                $input = this.createInput(type, name, label, null, onInput, value);
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
        // === Метаданные формы ===
        if (id) $form.attr("id", id);
        if (classname) $form.attr("class", classname);
        if (mode) $form._mode = mode;
        if (action) $form._action = action;

        // === Обновляем или создаём элементы ===
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
            let $input = $form[name] || $form.data(name) || $form.find("#" + name);

            // === Создание нового элемента, если его нет ===
            if (!$input || $input.length === 0) {

                if (type === "label") {
                    $input = this.createSpan(label, name);
                } else if (isSelect) {
                    $input = this.createSelect(name, name, isSelect, SelectDefault);
                } else if (name === "password" || type === "password") {
                    $input = this.createPasswordContainer(name, label, value, onInput);
                } else if (type === "slider") {
                    $input = this.createSlider(name, value);
                } else if (type === "pin") {
                    $input = this.createPinContainer(name, 6, onInput);
                } else {
                    $input = this.createInput(type, name, label, null, onInput, value);
                    if (mask) {
                        try {
                            $input[0].mask = IMask($input[0], mask);
                        } catch (e) {
                            console.warn("IMask не подключен:", e);
                        }
                    }
                }

                // создаём label, если нужно
                if (!["submit", "hidden", "label"].includes(type) && label != null) {
                    $form.append(this.createLabel(label, name));
                }

                $form[name] = $input;
                $form.append($input);
            } else {
                // === Элемент существует — обновляем его ===
                const el = $input[0];

                if (!el) {
                    console.warn(`⚠️ $input[0] для ${name} не найден`);
                    return;
                }

                // обновляем значение
                /*if (type !== "label" && value !== undefined) {
                    if (el.tagName === "SELECT") {
                        $(el).val(value).trigger("change");
                    } else if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
                        el.value = value;
                    }
                }*/

                // обновляем обработчик
                if (onInput) {
                    var events = $._data(el, "events"); // #myElement — пример, здесь может быть любой другой
                    console.log(events); // И вот они, все события на ладони!

                    $(el).off("input.form").on("input.form", onInput);
                }

                // обновляем маску
                if (mask && el.mask) {
                    try {
                        el.mask.updateOptions(mask);
                    } catch (e) {
                        console.warn("Ошибка обновления IMask:", e);
                    }
                }

                // обновляем таймер
                if (timer) {

                    const element = el;

                    if (element._timerController) {
                        element._timerController.stop();
                        delete element._timerController;
                    }

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
            }
        });

        // === Удаляем элементы, которых больше нет ===
        const fieldNames = FieldsForm.map(f => f.name);
        Object.keys($form).forEach(name => {
            if ($form[name] instanceof jQuery && !fieldNames.includes(name)) {
                $form[name].remove();
                delete $form[name];
            }
        });

        return $form;
    }

    createDiv(text, id = null, nameclass = null, onClick = null) {
        const $div = $('<div>', { text });

        if (id) $div.attr('id', id);

        $div.addClass(nameclass);

        if (onClick) $div.off('click').on('click', onClick);
        else $div.off('click');

        return $div;
    }

    createSpan(text, id = null, nameclass = null, onClick = null) {
        const $span = $('<span>', { text });

        if (id) $span.attr('id', id);

        $span.addClass(nameclass);

        if (onClick) $span.on('click', onClick);

        return $span;
    }

    createInput(type, id, placeholder = null, nameclass = null, onInput = null, value = "", options = {}) {
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

        if (nameclass) $input.addClass(nameclass);



        // Автоматическая инициализация числовых полей
        if (type === "number") {
            this.initNumericInput($input, options, onInput);
        } else if (onInput) {
            $input.on("input.form focus.form", onInput);
        }

        return $input;
    }

    createButton(id, label, onClick = null, disabled = false, tooltip = null, classname = null) {
        const $button = $("<input>", {
            type: "button",
            id: id,
            value: label,
            disabled: disabled
        });

        if (tooltip) $button.ToolTip(tooltip);
        if (classname) $button.addClass(classname);
        if (onClick) $button.on("click.form", onClick);

        return $button;
    }


    createLabel(text, forInput) {
        const label = document.createElement("label");
        label.innerText = text;
        label.setAttribute("for", forInput);
        return label;
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

        if (onInput) $input.on('input.form', onInput);

        const $toggle = $('<div>', { class: 'vpas', 'aria-label': 'Показать/скрыть пароль', role: 'button', tabindex: 0 });
        $toggle.on('click.vpas', () => {
            $toggle.toggleClass('view');
            $input.attr('type', $input.attr('type') === 'password' ? 'text' : 'password');
        });

        const $hint = $('<div>', { class: 'password-hint' }).hide();

        //$input.on('focus', () => $hint.show());
        $input.on('blur.form', () => $hint.hide());

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
            $input.on('input.PinContainer', function () {
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
            $input.on('keydown.PinContainer', function (e) {
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
            $input.on('paste.PinContainer', function (e) {
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

    /**
     * Инициализация числового input'а: допускает только цифры, учитывает min/max, подсветку при ошибке
     * @param {jQuery|HTMLElement|string} targetInput - селектор или сам input
     * @param {object} [options]
     * @param {number|Function|null} [options.min=null] - минимальное значение или функция, возвращающая число
     * @param {number|Function|null} [options.max=null] - максимальное значение или функция, возвращающая число
     * @param {boolean} [options.allowNegative=false] - можно ли вводить отрицательные значения
     */
    initNumericInput(targetInput, options = {}, userOnInput = null) {
        const $input = $(targetInput);

        const getValue = (v) =>
            typeof v === 'function' ? v($input[0]) : v ?? null;

        $input.off('focus keydown input paste blur').on('focus keydown input paste blur', function (event) {
            const input = event.target;

            // --- При фокусе выделяем всё ---
            if (event.type === 'focus') {
                setTimeout(() => input.select(), 0);
                return;
            }

            // --- Разрешённые клавиши ---
            const allowedKeys = new Set([
                'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
                'Tab', 'Enter', 'Home', 'End', 'Escape'
            ]);

            const isCtrl = event.ctrlKey || event.metaKey;
            const ctrlAllowedCodes = new Set(['KeyA', 'KeyC', 'KeyV', 'KeyX']);

            const isDigitByKey = typeof event.key === 'string' && /^\d$/.test(event.key);
            const isNumpad = typeof event.code === 'string' && event.code.startsWith('Numpad');
            const isDigit = isDigitByKey || isNumpad;
            const isFunctionKey = typeof event.key === 'string' && /^F\d{1,2}$/.test(event.key);
            const isMinus = event.key === '-' && options.allowNegative === true;

            // --- Фильтрация клавиш ---
            if (event.type === 'keydown') {
                if (
                    isDigit ||
                    isMinus ||
                    isFunctionKey ||
                    allowedKeys.has(event.key) ||
                    (isCtrl && ctrlAllowedCodes.has(event.code))
                ) {
                    return true;
                }
                event.preventDefault();
                return false;
            }

            // --- Обработка вставки ---
            if (event.type === 'paste') {
                event.preventDefault();
                const pasteData = (event.originalEvent || event).clipboardData.getData('text');
                let clean = pasteData.replace(/[^\d-]/g, '');
                if (!options.allowNegative) clean = clean.replace(/-/g, '');
                const start = input.selectionStart;
                const end = input.selectionEnd;
                const currentValue = input.value;
                input.value = currentValue.substring(0, start) + clean + currentValue.substring(end);
                input.selectionStart = input.selectionEnd = start + clean.length;
                $(input).trigger('input');
                return;
            }

            // --- Проверка значения ---
            if (event.type === 'input' || event.type === 'blur') {
                let value = input.value.replace(/[^\d-]/g, '');
                let num = Number(value) || 0;

                const min = getValue(options.min);
                const max = getValue(options.max);

                if (min !== null && num < min) {
                    num = min;
                    $(input).addClass('input-limit-flash');
                    setTimeout(() => $(input).removeClass('input-limit-flash'), 100);
                }

                if (max !== null && num > max) {
                    num = max;
                    $(input).addClass('input-limit-flash');
                    setTimeout(() => $(input).removeClass('input-limit-flash'), 100);
                }

                input.value = num;

                // ✅ Вызов пользовательского обработчика onInput, если он есть
                if (userOnInput && typeof userOnInput === 'function') {
                    userOnInput.call(input, event);
                }
            }
        });
    }

}