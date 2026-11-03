window.BasePageClass = class BasePageClass {

    Name = "BasePageClass";
    messageData = null;
    $Layer = null;

    $TopNav = null;
    $Content = null;
    $LeftMenu = null;
    $PlanetsList = null;

    renderGeneration = 0;
    requestScope = {};
    pageActive = true;
    ownedTimers = new Set();

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

            if (Dialog) Dialog.close();
            // Фоновый render может прервать Overlay. Переход отправляется
            // сразу, без callback анимации и повторного ожидания в SendServer.
            Overlay.Show(null, 250);
            GameEvents.emit("SendServer", {
                mode: mode,
                NotOverlay: true
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

        // Общий #Content уже принадлежит новой странице. Завершение анимации
        // прежней страницы не должно очищать или скрывать новое содержимое.
        this.$Content.data("pageOwner", this);
        this.$Content.stop(true, true).empty().removeClass();
    }

    initTopNav() {
        this.$TopNav = $("#TopNav");
        if (this.$TopNav.length === 0) {
            this.$TopNav = $("<div>", { id: "TopNav" });
            this.$Layer.append(this.$TopNav);
        }

        const $MenuBtn = $("#MenuBtn");

        this.$TopNav.hide();
        if ($MenuBtn.length && $MenuBtn.parent()[0] !== this.$TopNav[0]) this.$TopNav.prepend($MenuBtn);

        $MenuBtn.off("click.base").on("click.base", () => {
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
            this.$PlanetsList = $("<div>", { id: "PlanetsList" });
            this.$LeftMenu.append(this.$PlanetsList);
        }
        // Общий селектор не принадлежит конкретной странице: сохраняем его
        // widget, раскрытый список и option также при переходе между страницами.
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

        // Серверный response остаётся snapshot: расчётные значения не мутируют DTO.
        const resourcesSnapshot = $.extend(true, {}, mData.Resources || {});
        this._topNavData = { ...mData, Resources: resourcesSnapshot };
        Data.Resources = resourcesSnapshot;

        // Запускаем таймер, если нужно
        if (startTicker) {
            this.startTopNavTicker();
        }



        const now = Date.now();

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


        if (!this.$TopNav["Messages"]) this.$TopNav["Messages"] = this.$TopNav.children("#Messages");
        if (!this.$TopNav["Messages"].length) {
            this.$TopNav["Messages"] = this.createDiv("", "Messages", "ResBox iconMessages");
            this.$TopNav.append(this.$TopNav["Messages"]);
        }
        this.$TopNav["Messages"].off("click.base").on("click.base", () => {
            this.setActiveMode("messages");
        });

        this.$TopNav["Messages"].text(mData.NewMessages);
    }

    // Вспомогательная функция: создаём или возвращаем элемент TopNav
    getOrCreateTopNavItem(res) {
        if (!this.$TopNav["Res_" + res]) this.$TopNav["Res_" + res] = this.$TopNav.children("#Res_" + res);
        if (!this.$TopNav["Res_" + res].length) {
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
        if (this.$PlanetsList.length === 0) this.initPlanetsList();

        const planets = Object.values(Data.Planets || {});
        // Угол, ресурсы и время snapshot не меняют содержимое селектора.
        const optionsKey = JSON.stringify([Data.main_planet, Lang.planetSelector.Select,
            Lang.planetSelector.Planet, Lang.planetSelector.Moon, Lang.planetSelector.Main,
            planets.map(p => [p.id, p.name, p.galaxy, p.system, p.planet, p.planet_type, p.image])]);
        let $select = this.$PlanetsList.find("#planets-select");
        const widget = $select.length && $.custom?.planetselectmenu
            ? $select.planetselectmenu("instance") : null;
        const optionsChanged = this.planetListOptionsKey !== optionsKey || !$select.length;
        if (!optionsChanged && widget && $select.val() === String(Data.current_planet)) return;

        const wasOpen = Boolean(widget?.isOpen);
        const scrollTop = widget?.menu.scrollTop() || 0;
        const focusedValue = widget?.menuInstance.active?.data("ui-selectmenu-item")?.value;
        this.$PlanetsList.show();
        if (!$select.length) {
            $select = $("<select>").attr({ id: "planets-select", "aria-label": Lang.planetSelector.Select });
            this.$PlanetsList.empty().append($select);
        }
        if (optionsChanged) {
            $select.attr("aria-label", Lang.planetSelector.Select);
            const existing = new Map($select.children().get()
                .map(option => [option.value, option]));
            $.each(planets, (index, planet) => {
            const ptype = (planet.planet_type == 1) ? Lang.planetSelector.Planet : Lang.planetSelector.Moon;
            const coordinates = `[${planet.galaxy}:${planet.system}:${planet.planet}]`;
            const optionText = `${planet.name} ${coordinates} · ${ptype}`;
            const option = existing.get(String(planet.id));
            const $option = option ? $(option) : $("<option>");
            $option
                .val(planet.id)
                .text(optionText)
                .attr({
                    "data-name": planet.name,
                    "data-coordinates": coordinates,
                    "data-type": ptype,
                    "data-main": String(planet.id == Data.main_planet),
                    "data-style": `background-image: url('/images/planets/galaxy/${planet.image}.png');`
                });

            if ($select[0].children[index] !== $option[0]) {
                $select[0].insertBefore($option[0], $select[0].children[index] || null);
            }
            existing.delete(String(planet.id));
            });
            existing.forEach(option => option.remove());
        }
        $select.val(String(Data.current_planet));

        // Регистрируем оформление один раз; snapshot обновляет существующий widget.
        if (!$.custom?.planetselectmenu) $.widget("custom.planetselectmenu", $.ui.selectmenu, {
            _renderPlanet: function (item, wrapper = $("<div>").addClass("planet-wrapper")) {
                if (!wrapper.children().length) wrapper.append(
                    $("<span>", { class: "planet-icon", "aria-hidden": "true" }),
                    $("<span>").addClass("PlanetSelectorText").append(
                        $("<span>").addClass("PlanetSelectorName"),
                        $("<span>").addClass("PlanetSelectorMeta").append(
                            $("<span>").addClass("PlanetSelectorCoordinates"),
                            $("<span>").addClass("PlanetSelectorType"),
                            $("<span>").addClass("PlanetSelectorHome").text("⌂")
                        )));
                wrapper.find(".planet-icon").attr("style", item.element.attr("data-style"));
                wrapper.find(".PlanetSelectorName").text(item.element.attr("data-name"));
                wrapper.find(".PlanetSelectorCoordinates").text(item.element.attr("data-coordinates"));
                wrapper.find(".PlanetSelectorType").text(item.element.attr("data-type"));
                wrapper.find(".PlanetSelectorHome").attr("aria-label", Lang.planetSelector.Main)
                    .toggle(item.element.attr("data-main") === "true");
                return wrapper;
            },
            _renderItem: function (ul, item) {
                const li = $("<li>");
                if (item.disabled) li.addClass("ui-state-disabled");
                const selected = item.element.prop("selected");
                const wrapper = this._renderPlanet(item).toggleClass("planet-select", selected);
                wrapper.append($("<span>").addClass("PlanetSelectorCheck").attr("aria-hidden", "true")
                    .text(selected ? "✓" : ""));
                return li.append(wrapper).appendTo(ul);
            },
            // Метод для отображения выбранного элемента
            _renderButtonItem: function (item) {
                return this._renderPlanet(item);
            },
            // Штатный selectmenu.refresh() очищает все li и заменяет подпись
            // кнопки. Здесь сохраняем сами option/li/подпись и их focus/hover.
            _refreshMenu: function () {
                const existing = new Map(this.menu.children().get().map(li =>
                    [$(li).data("ui-selectmenu-item")?.value, li]));
                this._parseOptions(this.element.find("option"));
                this.items.forEach((item, index) => {
                    const li = existing.get(item.value);
                    const $li = li ? $(li) : this._renderItem(this.menu, item);
                    $li.data("ui-selectmenu-item", item).toggleClass("ui-state-disabled", item.disabled);
                    this._renderPlanet(item, $li.children().first()).toggleClass("planet-select", item.element.prop("selected"));
                    $li.find(".PlanetSelectorCheck").text(item.element.prop("selected") ? "✓" : "");
                    if (this.menu[0].children[index] !== $li[0]) this.menu[0].insertBefore($li[0], this.menu[0].children[index] || null);
                    existing.delete(item.value);
                });
                existing.forEach(li => $(li).remove());
                this.menuInstance.refresh();
                this.menuItems = this.menu.find(".ui-menu-item-wrapper");
                this._rendered = true;
                if (this.items.length) {
                    const $selected = this._getSelectedItem();
                    this.menuInstance.focus(null, $selected);
                    this._setAria($selected.data("ui-selectmenu-item"));
                }
                this._setOption("disabled", this.element.prop("disabled"));
            },
            refresh: function () {
                this._refreshMenu();
                const item = this.items[this.element[0].selectedIndex];
                if (item) this._renderPlanet(item, this.buttonItem);
                this._resizeButton();
            },
            _select: function (item, event) {
                const previous = this.element[0].selectedIndex;
                this.element[0].selectedIndex = item.index;
                this._renderPlanet(item, this.buttonItem);
                this.menu.find(".planet-wrapper").removeClass("planet-select").find(".PlanetSelectorCheck").text("");
                this.menuItems.eq(item.index).addClass("planet-select").find(".PlanetSelectorCheck").text("✓");
                this._setAria(item);
                this._trigger("select", event, { item });
                if (previous !== item.index) this._trigger("change", event, { item });
                this.close(event);
            },
            _resizeMenu: function () {
                const width = Math.max(this.button.outerWidth(), Math.ceil(this.menu.css("width", "max-content").outerWidth()));
                this.menu.outerWidth(Math.min(width, document.documentElement.clientWidth - 20));
            }
        });


        if (widget) {
            $select.planetselectmenu("refresh");
            if (wasOpen) {
                if (!widget.isOpen) widget.open();
                const $focused = widget.menu.children().filter((_, item) =>
                    $(item).data("ui-selectmenu-item")?.value === focusedValue);
                if ($focused.length) widget.menuInstance.focus(null, $focused);
                widget._resizeMenu();
                widget._position();
                widget.menu.scrollTop(scrollTop);
            }
        } else $select
            .planetselectmenu({
                width: false,
                position: { my: "left top", at: "left bottom+4", collision: "flipfit" },
                change: (event, data) => {
                    // Общий widget переживает экземпляры страниц. Обработчик
                    // действует на текущую страницу, не на создавшую его старую.
                    const page = Page;
                    if (!page?.pageActive) return;
                    if (Dialog) Dialog.close();
                    Overlay.Show(null, 250);
                    GameEvents.emit("SendServer", {
                        mode: Mode,
                        action: "planetselect",
                        NotOverlay: true,
                        data: { 'planetId': data.item.value }
                    });
                }
            })
            .planetselectmenu("menuWidget")
            .addClass("ui-menu-icons planet-icons");
        $("#planets-select-button").attr("aria-label", Lang.planetSelector.Select + ": " + $select.find(":selected").text());
        this.planetListOptionsKey = optionsKey;
    }

    // Обновление native select без замены option и потери раскрытого списка.
    updateSelectOptions($select, items, selected = $select.val()) {
        const existing = new Map($select.children().get().map(option => [option.value, option]));
        items.forEach((item, index) => {
            const value = String(item.value);
            const $option = existing.has(value) ? $(existing.get(value)) : $("<option>");
            $option.val(value).text(item.text).prop("disabled", Boolean(item.disabled));
            if (item.data) $option.data(item.data);
            if ($select[0].children[index] !== $option[0]) $select[0].insertBefore($option[0], $select[0].children[index] || null);
            existing.delete(value);
        });
        existing.forEach(option => $(option).remove());
        if (items.some(item => String(item.value) === String(selected))) $select.val(String(selected));
    }

    placeElement(parent, element, before = null) {
        if (element === before) return;
        // moveBefore сохраняет состояние DOM при сортировке. В старых браузерах
        // возвращаем focus, если insertBefore переместил его вместе со строкой.
        if (parent.moveBefore && parent.isConnected && element.isConnected) {
            parent.moveBefore(element, before);
            return;
        }
        const focused = element.contains(document.activeElement) ? document.activeElement : null;
        parent.insertBefore(element, before);
        if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    }

    getRequestOptions(options = {}) {
        return {
            ...options,
            scope: this.requestScope
        };
    }

    ownsContent() {
        return this.$Content?.data("pageOwner") === this;
    }

    isRenderCurrent(generation) {
        return this.pageActive && this.ownsContent() && generation === this.renderGeneration;
    }

    setPageTimeout(callback, delay) {
        const timerId = setTimeout(() => {
            this.ownedTimers.delete(timerId);
            if (this.pageActive) callback();
        }, delay);
        this.ownedTimers.add(timerId);
        return timerId;
    }

    clearPageTimeout(timerId) {
        if (!timerId) return;
        clearTimeout(timerId);
        this.ownedTimers.delete(timerId);
    }

    async render(generation = this.renderGeneration) {
        await Lang.waitLangs();

        if (!this.isRenderCurrent(generation)) return false;

        queueMicrotask(() => window.BattleReportsUI?.openLinkedReport());

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

        return this.isRenderCurrent(generation);
    }

    Show(mode = "", data = null) {
        if (!this.ownsContent()) return;
        console.log("Show " + this.Name);
        this.pageActive = true;
        const generation = ++this.renderGeneration;

        if (data) {
            this.messageData = data;
            Data.mode = data.mode;
            Promise.resolve(this.render(generation)).catch(error => {
                if (!this.isRenderCurrent(generation)) return;
                console.error("Ошибка асинхронного render страницы:", error);
                try { Overlay.Hide(); } catch (e) { }
            });
        }

        this.$Layer.stop(true, true).fadeIn(250, () => {
            if (!this.isRenderCurrent(generation)) return;
            if (this.$Content.Show) {
                Overlay.Hide();
            } else {
                this.$Content.stop(true, true).fadeIn(250, () => {
                    if (!this.isRenderCurrent(generation)) return;
                    this.$Content.Show = true;
                    Overlay.Hide();
                });
            }
        });
    }

    Hide() {
        this.pageActive = false;
        const generation = ++this.renderGeneration;

        if (window.WS?.cancelScope) {
            window.WS.cancelScope(this.requestScope);
        }
        this.requestScope = {};
        for (const timerId of this.ownedTimers) {
            clearTimeout(timerId);
        }
        this.ownedTimers.clear();
        if (typeof this.stopTopNavTicker === "function") {
            this.stopTopNavTicker();
        }

        if (!this.ownsContent()) return;
        if (Dialog) Dialog.close();

        this.$Content.stop(true, true).fadeOut(250, () => {
            if (!this.ownsContent() || this.pageActive || generation !== this.renderGeneration) return;
            this.$Content.Show = false;
            Overlay.Hide();
            this.$Content.empty();
        });
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
                if (formData.login !== undefined && formData.password !== undefined) {
                    Data.login = {
                        login: formData.login,
                        password: formData.password
                    };
                }
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
                    $(el).off("input.form focus.form click.form");
                    if (type === "button" || type === "submit") {
                        $(el).on("click.form", onInput);
                    } else {
                        $(el).on("input.form focus.form", onInput);
                    }
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

    formatFleetDuration(seconds) {
        const total = Math.max(0, Math.ceil(Number(seconds) || 0));
        return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
            .map(value => String(value).padStart(2, "0")).join(":");
    }

    // Общая подсказка обзора и фаланги. Неизвестные значения не означают ноль.
    // Поле карточки создаётся один раз, контейнеры не заменяются при snapshot.
    cardField($parent, key, tag = "div", className = "", text = undefined) {
        let $field = $parent.children().filter((_, element) => element.dataset.cardField === String(key));
        if (!$field.length) $parent.append($field = $(`<${tag}>`).attr("data-card-field", key));
        $field.attr("class", className);
        if (text !== undefined && $field.text() !== String(text)) $field.text(text);
        return $field;
    }

    createFleetCompositionTooltip(fleet, $tooltip = null) {
        $tooltip ||= $("<div>").addClass("OverviewFleetTooltip");
        this.cardField($tooltip, "shipsTitle", "strong", "OverviewFleetTooltipTitle", "Состав флота");
        const ships = Object.values(fleet.ships || {})
            .filter(ship => ship && (ship.count === null || Number(ship.count) > 0))
            .sort((left, right) => Number(left.id) - Number(right.id));
        const disclosed = fleet.ships && typeof fleet.ships === "object";
        this.cardField($tooltip, "shipsEmpty", "span", "OverviewFleetTooltipEmpty", disclosed ? "Кораблей нет" : "Состав флота не раскрыт").toggle(!disclosed || !ships.length);
        const $ships = this.cardField($tooltip, "ships", "div", "OverviewFleetTooltipShips").toggle(Boolean(disclosed && ships.length));
        const shipIds = new Set();
        for (const ship of ships) {
            shipIds.add(String(ship.id));
            const $ship = this.cardField($ships, ship.id, "div", "OverviewFleetTooltipShip");
            this.cardField($ship, "name", "span", "", Lang.tech?.[ship.id] || ship.name || `Корабль #${ship.id}`);
            this.cardField($ship, "count", "b", "", ship.count === null ? "—" : number_format(Number(ship.count)));
        }
        $ships.children().each((_, row) => { if (!shipIds.has(row.dataset.cardField)) $(row).remove(); });
        const $total = this.cardField($tooltip, "total", "div", "OverviewFleetTooltipTotal").toggle(Boolean(disclosed && ships.length));
            const total = ships.every(ship => ship.count !== null)
                ? ships.reduce((sum, ship) => sum + Number(ship.count), 0)
                : fleet.shipsCount;
        this.cardField($total, "label", "span", "", "Всего кораблей");
        this.cardField($total, "count", "b", "", total != null && Number.isFinite(Number(total)) ? number_format(Number(total)) : "—");
        this.cardField($tooltip, "cargoTitle", "strong", "OverviewFleetTooltipTitle", "Груз");
        const $cargo = this.cardField($tooltip, "cargo", "div", "OverviewFleetTooltipCargo");
        const resourceIds = new Set(["empty"]);
        const resourcesDisclosed = fleet.resources && typeof fleet.resources === "object";
        if (resourcesDisclosed) {
            // Обзор передаёт resource DTO, фаланга — численные значения по ID.
            const resources = Object.entries(fleet.resources).map(([id, value]) => ({
                id: Number(value?.id ?? id),
                name: value?.name,
                count: value !== null && typeof value === "object" ? value.count : value
            })).sort((left, right) => left.id - right.id);
            for (const resource of resources) {
                if (resource.count == null || !Number.isFinite(Number(resource.count))) {
                    resourceIds.add(String(resource.id));
                    const $resource = this.cardField($cargo, resource.id, "div", "OverviewFleetTooltipResource");
                    this.cardField($resource, "name", "span", "", Lang.tech?.[resource.id] || resource.name || `Ресурс #${resource.id}`);
                    this.cardField($resource, "count", "b", "", "не раскрыто");
                } else if (Number(resource.count) > 0) {
                    resourceIds.add(String(resource.id));
                    const $resource = this.cardField($cargo, resource.id, "div", "OverviewFleetTooltipResource");
                    this.cardField($resource, "name", "span", "", Lang.tech?.[resource.id] || resource.name || `Ресурс #${resource.id}`);
                    this.cardField($resource, "count", "b", "", number_format(Number(resource.count)));
                }
            }
        }
        this.cardField($cargo, "empty", "span", "OverviewFleetTooltipEmpty", resourcesDisclosed ? "Пусто" : "Груз не раскрыт").toggle(resourceIds.size === 1);
        $cargo.children().each((_, row) => { if (!resourceIds.has(row.dataset.cardField)) $(row).remove(); });
        return $tooltip.prop("outerHTML");
    }

    sensorContactFresh(contact) {
        return Boolean(contact.fresh) && Number(contact.freshUntil) > GameServerTime.now();
    }

    sensorContactRoute(contact) {
        const route = contact.route;
        return Number(contact.tier) >= 3 && route?.motionStart && route?.motionEnd
            && Number.isFinite(Number(route.startsAt)) && Number(route.endsAt) > Number(route.startsAt)
            ? route : null;
    }

    sensorEndpointLabel(coordinate) {
        if (Number(coordinate?.type) !== 1) return `[${coordinate.galaxy}:${coordinate.system}] ${number_format(coordinate.distance)} / ${number_format(coordinate.angle, 1)}°`;
        const type = ({ 1: "Планета", 2: "Обломки", 3: "Луна", 4: "Гигант", 5: "Сектор пояса" })[coordinate.objectType] || "Орбита";
        return `[${coordinate.galaxy}:${coordinate.system}:${coordinate.orbit}] ${type}${coordinate.siteId ? ` #${coordinate.siteId}` : ""}`;
    }

    createSensorContactCard(contact, $card = null) {
        const point = contact.position;
        const route = this.sensorContactRoute(contact);
        $card ||= $("<div>").addClass("OverviewFleetTooltip SensorContactCard");
        this.cardField($card, "title", "strong", "OverviewFleetTooltipTitle", `Контакт #${contact.id}`);
        this.cardField($card, "fresh", "span", "", this.sensorContactFresh(contact) ? "Сенсорное обнаружение" : "Последняя известная отметка");
        this.cardField($card, "position", "span", "", `[${point.galaxy}:${point.system}] ${number_format(point.distance)} / ${number_format(point.angle, 1)}°`);
        this.cardField($card, "time", "span", "", `Наблюдение: ${formatTimestamp(contact.observedAt, "timedate")}`);
        this.cardField($card, "routeTitle", "strong", "OverviewFleetTooltipTitle", "Обнаруженный участок").toggle(Boolean(route));
        this.cardField($card, "from", "span", "", route ? `Откуда: ${this.sensorEndpointLabel(route.start)}` : "").toggle(Boolean(route));
        this.cardField($card, "to", "span", "", route ? `Куда: ${this.sensorEndpointLabel(route.end)}` : "").toggle(Boolean(route));
        this.cardField($card, "course", "span", "", `Курс: ${number_format(contact.course || 0, 1)}° · линия не обозначает цель`)
            .toggle(!route && typeof contact.course === "number" && Number.isFinite(contact.course));
        this.cardField($card, "owner", "span", "", contact.owner_name || "").toggle(Boolean(contact.owner_name));
        this.cardField($card, "range", "span", "", contact.countRange ? `Кораблей: ${number_format(contact.countRange[0])}–${number_format(contact.countRange[1])}` : "")
            .toggle(Boolean(contact.countRange && !contact.ships));
        this.createFleetCompositionTooltip(contact, this.cardField($card, "composition", "div", "OverviewFleetTooltip"));
        return $card;
    }

    createSensorContactRow(contact, $row = null) {
        if (!$row) $row = $("<article>").addClass("OverviewFleetEvent SensorContactRow").append(
                $("<span>").addClass("OverviewFleetEventTime").attr("aria-label", "Сенсорный контакт")
                    .append($("<i>", { class: "mdi mdi-radar", "aria-hidden": "true" })),
                $("<span>").addClass("OverviewFleetEventBody").append(
                    $("<span>").addClass("OverviewFleetEventTitle"),
                    $("<span>").addClass("OverviewFleetEventRoute")
                ),
                $("<span>").addClass("OverviewFleetEventStatus")
            );
        $row.data({ freshUntil: contact.freshUntil, retainUntil: contact.retainUntil, fresh: contact.fresh, contact })
            .toggleClass("Stale", !this.sensorContactFresh(contact));
        $row.find(".OverviewFleetEventTitle")
            .text(`Контакт #${contact.id}${contact.owner_name ? ` · ${contact.owner_name}` : ""}`)
            .ToolTip(this.createSensorContactCard(contact).prop("outerHTML"), { "max-width": "min(320px, calc(100vw - 24px))" });
        $row.find(".OverviewFleetEventRoute").text(`[${contact.position.galaxy}:${contact.position.system}] ${number_format(contact.position.distance)}`);
        $row.find(".OverviewFleetEventStatus").text(this.sensorContactFresh(contact) ? "Обнаружен" : "Отметка");
        return $row;
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
            if (type === "button" || type === "submit") {
                $input.on("click.form", onInput);
            } else {
                $input.on("input.form focus.form", onInput);
            }
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
