
const MS_PER_HOUR = 3600000;
window.GameLayerClass = class GameLayerClass extends BasePageClass {

    $TopNav = null;
    $Content = null;
    $LeftMenu = null;
    $PlanetsList = null;

    Resources = [];

    $TopNavItems = {}
    /*
    _topNavTimer = null;  // <--- таймер для TopNav
    _topNavData = null;       // последние данные для таймера
    */
    // убираем _topNavTimer
    _topNavData = null;
    _topNavActive = false; // подписан ли на GameTick

    constructor() {
        console.log("constructor GameLayerClass");

        super();
        this.GeneretLayer();

        $("#gamelayer").append(this.$TopNav);
        $("#gamelayer").append(this.$Content);
        $("#gamelayer").append(this.$LeftMenu);
        //$("#gamelayer").append(this.$PlanetsList);

        // Слушаем событие смены видимости страницы
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.stopTopNavTicker();
            } else if (this._topNavData) {
                this.startTopNavTicker();
            }
        });
    }

    GeneretLayer() {
        this.GeneretTopNav();
        this.GeneretContent();
        this.GeneretLeftMenu();
        this.GeneretPlanetsList();

    }

    GeneretTopNav() {
        this.$TopNav = $("#TopNav");
        if (this.$TopNav.length === 0) {
            this.$TopNav = $("<div>", { id: "TopNav" });
        }
        this.$TopNav.html("");
    }

    GeneretContent() {
        this.$Content = $("#Content");
        if (this.$Content.length === 0) {
            this.$Content = $("<div>", { id: "Content" });
        }
        this.$Content.empty().hide();
    }

    GetContent() {
        this.GeneretContent();
        return this.$Content;
    }

    GeneretLeftMenu() {
        this.$LeftMenu = $("#LeftMenu");

        // навешиваем обработчики кликов
        this.$LeftMenu.find("[mode]").on("click", (e) => {
            const mode = $(e.currentTarget).attr("mode");
            this.setActiveMode(mode);
        });

        // при загрузке страницы — восстановим сохранённый mode
        const savedMode = sessionStorage.getItem("activeMode");
        if (savedMode) {
            this.setActiveMode(savedMode);
        } else {
            // если ничего нет — выберем первый по умолчанию
            const firstMode = this.$LeftMenu.find("[mode]").first().attr("mode");
            this.setActiveMode(firstMode);
        }
    }

    GeneretPlanetsList() {
        this.$PlanetsList = $("#PlanetsList");
        /*if (this.$PlanetsList.length === 0) {
            console.loh("GeneretPlanetsList");
            this.$PlanetsList = $("<div>", { id: "PlanetsList" });
        }
        this.$PlanetsList.html("PlanetsList");*/
    }

    RenderPlanetsList(Data) {
        if (this.$PlanetsList.length === 0) this.GeneretPlanetsList();

        this.$PlanetsList.empty();

        const $select = $("<select>").attr("id", "planets-select");
        $.each(Data.Planets, (index, planet) => {
            const ptype = (planet.planet_type == 1) ? "П" : "М";
            const optionText = `${planet.name} [${planet.galaxy}:${planet.system}] (${ptype})`;
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
                change: function (event, data) {
                    //Overlay.Show(null, 250, () => {
                        //this.$Content.html($Content);
                       // $("#gamelayer").fadeOut(250, () => {
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
                       // });


                    //});

                }
            })
            .planetselectmenu("menuWidget")
            .addClass("ui-menu-icons planet-icons");
    }


    setActiveMode(mode) {
        // убираем выделение у всех
        this.$LeftMenu.find("[mode]").removeClass("open");

        // добавляем выделение к текущему
        this.$LeftMenu.find(`[mode="${mode}"]`).addClass("open");

        // сохраняем в sessionStorage
        sessionStorage.setItem("activeMode", mode);

        // здесь можно вызвать свою функцию для открытия страницы
        Overlay.Show(null, 250,
            () => {
                //this.$Content.html($Content);
                $("#gamelayer").fadeOut(250, () => {

                    GameEvents.emit("SendServer", {
                                mode: mode,
                                action: "list",
                                //hide: "ActualData",
                                //data: { 'planetId': data.item.value }
                            });

                    /*WS.send(new Message()
                        .setMode(mode)
                        .setAction("list")
                    );*/
                }
                );


            });


    }

    /*
    // Метод для запуска таймера
    startTopNavTimer() {
        if (this._topNavTimer || !this._topNavData) return;
        this._topNavTimer = setInterval(() => {
            if (this.$TopNav.is(":visible")) {
                this.RenderTopNav(this._topNavData, false);
            } else {
                this.stopTopNavTimer();
            }
        }, 1000);
    }

    // Метод для остановки таймера
    stopTopNavTimer() {
        if (this._topNavTimer) {
            clearInterval(this._topNavTimer);
            this._topNavTimer = null;
        }
    }

    */
    // вместо старых startTopNavTimer/stopTopNavTimer:
    startTopNavTicker() {
        if (this._topNavActive || !this._topNavData) return;
        this._topNavActive = true;
        document.addEventListener("GameTick", this._onTopNavTick);
    }

    stopTopNavTicker() {
        if (!this._topNavActive) return;
        this._topNavActive = false;
        document.removeEventListener("GameTick", this._onTopNavTick);
    }

    // обработчик вынесем в метод, чтобы можно было отписать
    _onTopNavTick = () => {
        if (this.$TopNav.is(":visible")) {
            this.RenderTopNav(this._topNavData, false);
        } else {
            this.stopTopNavTicker();
        }
    }
    async RenderTopNav(Data, startTicker = true) {
        await Lang.waitLangs();

        if (this.$TopNav.length === 0) this.GeneretTopNav();

        // Обновляем данные для таймера
        this._topNavData = Data;

        // Запускаем таймер, если нужно
        if (startTicker) {
            this.startTopNavTicker();
        }



        const now = Date.now();

        this.Resources = Data.Resources;

        $.each(Data.Resources, (res, value) => {
            const $TopNavRes = this.getOrCreateTopNavItem(res);
            const color = this.computeColor(res, value, now);
            const tooltipData = this.buildTooltipData(res, value, color, now);
            this.renderTooltip($TopNavRes, tooltipData);

            //$TopNavRes.ToolTip(tooltip);
            $TopNavRes
                .text(humanNumber(value.count, true, 3))
                .attr('class', `ResBox icon${res} ${color}_text`);
        });


    }

    // Вспомогательная функция: создаём или возвращаем элемент TopNav
    getOrCreateTopNavItem(res) {
        if (!this.$TopNavItems["Res_" + res]) {
            this.$TopNavItems["Res_" + res] = $("<div>", {
                id: "Res_" + res,
                class: `ResBox icon${res}`
            });
            this.$TopNav.append(this.$TopNavItems["Res_" + res]);
        }
        return this.$TopNavItems["Res_" + res];
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
    buildTooltipData(res, value, color, now) {
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

    renderTooltip($el, tooltipData) {
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

    RenderLeftMenu(mode) {
        //alert(mode);
        // убираем выделение у всех
        this.$LeftMenu.find("[mode]").removeClass("open");

        // добавляем выделение к текущему
        this.$LeftMenu.find(`[mode="${mode}"]`).addClass("open");
    }
    /*
        startTicker(resources) {
            setInterval(() => this.RenderTopNav(resources), 250);
        }*/

    updateMessage(newMes) {
        if (this.lastNewMes !== newMes) {
            const $message = $("#message");
            if (newMes > 0) {
                $message.html(newMes).attr('tooltip', `${lang.New_messages}: ${newMes}`);
            } else {
                $message.html(newMes).attr('tooltip', lang.No_new_messages);
            }
            this.lastNewMes = newMes;
        }
    }

    ShowContent($Content) {
        this.$Content.fadeOut(250,
            () => {
                //this.$Content.html($Content);
                this.$Content.fadeIn(250);
            }
        );

    }
    Show() {
        //GameServerTime.renderDisplay();
        $("#gamelayer").fadeIn(250);
        $("#accauntlayer").hide(250);
    }
    Hide() {

        $("#gamelayer").fadeOut(250)
    }
}