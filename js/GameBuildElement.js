class GameBuild extends HTMLElement {


    _data = null;

    _type = "builds";
    _images = "builds";
    created = false;

    queues = false;

    EventActive = false;
    _boundRender = null;

    constructor() {
        super();
        //this.attachShadow({ mode: "open" }); // изоляция стилей
    }

    set images(images) {
        this._images = images;
    }
    get images() {
        return this._images;
    }

    set type(elementType) {
        this._type = elementType;
    }
    get type() {
        return this._type;
    }

    set data(buildData) {
        if (JSON.stringify(this._data) !== JSON.stringify(buildData)) {
            this._data = buildData;
            this.render();
        }
    }

    get data() {
        return this._data;
    }


    // Универсальная функция для создания элемента с классом и текстом
    createElement(tag, className = "", text = "") {
        return $("<" + tag + ">").addClass(className).text(text);
    }

    // Создаем таблицу ресурсов
    createResourceTable(resources, tableElement, itemsStorage) {
        $.each(resources, (res, value) => {
            itemsStorage[res] = this.createElement("div", `ResBox icon${res}`).attr("id", "Res_" + res);
            tableElement.append(itemsStorage[res]);
        });
    }

    // Обновляем таблицу ресурсов
    updateResourceTable(resources, itemsStorage, conditionFn, production = false) {
        let $result = true;
        $.each(resources, (res, value) => {
            const el = itemsStorage[res];
            if (!el) return;
            el.text(humanNumber(value, true, 2));
            if (production) {
                el.toggleClass("lime_text", value > 0).toggleClass("red_text", value <= 0);
            } else {
                if (!conditionFn(value, res)) $result = false;
                el.toggleClass("lime_text", conditionFn(value, res)).toggleClass("red_text", !conditionFn(value, res));
            }
        });
        return $result;
    }

    createTooltip({ headText, nameText, levelNum, timeNum, timeLabel, priceResources, prod, isDismantle = false }) {
        const tooltip = this.createElement("div", this._type);

        // Время с контейнером
        const timeContainer = this.createElement("div", "timeBuild", timeLabel + ": ");
        timeContainer.append(timeNum);

        tooltip.append(
            this.createElement("div", "name orange_text", nameText),
        );

        if (this._images !== 'fleets' && this._images !== 'defenses') {
            tooltip.append(
                this.createElement("div", "level", Lang.build.level + ": ").append(levelNum),
                this.createElement("div", "tooltip-empty"),
            ).prepend(this.createElement("div", "head yellow_text", headText),
                this.createElement("div", "tooltip-empty"),
            );
        }

        tooltip.append(
            this.createElement("div", "tooltip-empty"),
            this.createElement("div", "description", Lang.longDescription[this._data.id])
        );

        if (prod && prod.resources) {
            tooltip.append(this.createElement("div", "tooltip-empty"),
                this.createElement("div", "priceBuild", prod.title),
                prod.table);
            //this.createResourceTable(prod.resources, prod.table, prod.items);
        }

        tooltip.append(
            this.createElement("div", "tooltip-empty"),
            timeContainer,
            this.createElement("div", "tooltip-empty"),
            this.createElement("div", "priceBuild", isDismantle ? Lang.build.priceDestroy : (this._data.level > 0 ? Lang.build.priceUpgrade : Lang.build.priceBuild)),
            priceResources
        );

        return tooltip;
    }

    create() {
        if (this._type === 'queues') this.queues = true;

        this.Image = this.createElement("div", "image")
            .css({
                'background': `url("/images/${this._images}/${this._data.name}.gif") no-repeat`,
                'background-size': 'contain'
            });

        //console.log(Lang.t('tech') ,this._data.id);
        this.Header = {
            container: this.createElement("div", "head"),
            Name: this.createElement("div", "name", Lang.tech[this._data.id]),
            Level: this.createElement("div", "level"),
            Number: this.createElement("span", "LevelNumber")
        };

        this.Header.Level.append(this.Header.Number).prepend(
            ((this._images === 'techs' || this._images === 'builds') ? Lang.build.level : Lang.build.count)
            + ": ");

        this.Header.container.append(this.Header.Name, this.Header.Level);


        if (this._type === 'queues') {
            let LabelText = Lang.queues.building;

            if (this._images === 'builds')
                LabelText = ((this._data.action === 'build') ? Lang.queues.building : Lang.queues.destruction);
            else if (this._images === 'techs')
                LabelText = Lang.queues.research;

            this.Header.Label = this.createElement("div", "label").text(LabelText);
            this.Header.Name.addClass("yellow_text");

            this.Header.LastTime = this.createElement("div", "LastTime");
            this.Header.LastTimeText = this.createElement("span", "LastTimeText").text(Lang.build.Time + ": ");
            this.Header.LastTimeNumber = this.createElement("span", "LastTimeNumber");
            this.Header.LastTime.append(this.Header.LastTimeNumber).prepend(this.Header.LastTimeText);


            this.Header.EndTime = this.createElement("div", "EndTime");
            this.Header.EndTimeText = this.createElement("span", "EndTimeText").text(Lang.queues.endsIn + " ");
            this.Header.EndTimeNumber = this.createElement("span", "EndTimeNumber");
            this.Header.EndTime.append(this.Header.EndTimeNumber);
            this.Header.container.prepend(this.Header.Label).append(this.Header.LastTime);
            if (this._images == 'techs') {
                this.Header.container.prepend(this.Header.Label).append(
                    this.createElement("div", "Planet",
                        this._data.planet.name + " [" + this._data.planet.galaxy + ":" + this._data.planet.system + "]")
                        .ToolTip(this._data.planet.name + " [" + this._data.planet.galaxy + ":" + this._data.planet.system + "]")
                );
            } else if (this._images == 'fleets' || this._images == 'defenses') {
                this.Header.container.append(this.Header.Number);
            } else {
                this.Header.container.prepend(this.Header.Label).append(
                    this.createElement("div")
                );
            }

            this.Header.container.prepend(this.Header.Label).append(this.Header.EndTime);

            this.Header.Progress = $("<div>", { class: "tooltip-progress" }).hide();
            this.Header.ProgressBar = $("<div>", { class: `tooltip-progress-bar lime` }).css("width", "0%");
            this.Header.Progress.append(this.Header.ProgressBar);
            this.Header.container.append(this.Header.Progress);

            this.Buttons = { Cancel: this.createElement("div", "btn-box btn-box-cancel") };
            this.ToolTipCancel = this.createElement("div");
            this.ToolTipCancel.append(this.createElement("span", "", Lang.interrupt));

            this.ToolTipCancel.Progress = this.createElement("div", "ProgressCancel").hide();
            this.ToolTipCancel.Progress.Text = this.createElement("span", "ProgressCancel", Lang.queues.willBeReturned + " ");
            this.ToolTipCancel.Progress.Text.append(
                this.ToolTipCancel.ProgressNum = this.createElement("span", "ProgressCancelNum lime_text"),
                this.createElement("span", "lime_text", "%"),
                " " + Lang.queues.resourcesSpent
            ).addClass("yellow_text");

            this.ToolTipCancel.Progress.append(this.createElement("div", "tooltip-empty"), this.ToolTipCancel.Progress.Text);
            this.ToolTipCancel.append(this.ToolTipCancel.Progress);

            this.Buttons.Cancel.ToolTip(this.ToolTipCancel);
            $(this).append(this.Buttons.Cancel);

            this.Buttons.Cancel
                .off(isTouch ? "confirmed-click.build" : "click.build")
                .on(isTouch ? "confirmed-click.build" : "click.build", () => {
                    GameEvents.emit("BuildAction", {
                        action: "cancel",
                        id: this._data.qid
                    });
                });
        } else if (this._type === 'over_queues') {

            this.Bottom = {
                container: this.createElement("div", "bottom"),
                LastTime: this.createElement("div", "LastTime")
            };

            this.Bottom.LastTime = this.createElement("div", "LastTime");
            this.Bottom.LastTimeNumber = this.createElement("span", "LastTimeNumber");
            this.Bottom.LastTime.append(this.Bottom.LastTimeNumber);

            this.Bottom.container.prepend(this.Bottom.LastTime);

            $(this).append(this.Bottom.container);

        } else if (this._type !== 'queues') {
            this.Buttons = {
                Up: this.createElement("div", "btn-box btn-box-up"),
                Down: this.createElement("div", "btn-box btn-box-down"),
                Info: this.createElement("div", "btn-box btn-box-info"),
                Max: this.createElement("div", "btn-box btn-box-max")
            };

            this.Input = Page.createInput('number', 'buildCount', 'Сколько строить', "btn-box btn-input", null, 0, {
                min: 0,
                max: () => Page.getMaxConstructibleElements(this._data.id, this._data.costResources)
            });
            /*
            this.Input = this.createElement("input", "btn-box btn-input").attr({
                'type': "text",
                'inputmode': "numeric",
                'pattern': "\d*",
                'autocomplete': "off"
            }).val(0);*/

            this.ToolTip = {
                levelBuildNum: this.createElement("span", "levelNum lime_text"),
                levelDismantleNum: this.createElement("span", "levelNum lime_text"),
                timeBuildNum: this.createElement("span", "timeBuildNum lime_text"),
                timeDismantleNum: this.createElement("span", "timeBuildNum lime_text"),
                priceBuildTable: this.createElement("div", "priceBuildTable"),
                priceBuildTableItems: {},
                priceDismantleTable: this.createElement("div", "priceBuildTable"),
                priceDismantleTableItems: {},
                ProdNextTable: this.createElement("div", "priceBuildTable"),
                ProdNextTableItems: {},
                ProdPreviousTable: this.createElement("div", "priceBuildTable"),
                ProdPreviousTableItems: {}
            };

            this.createResourceTable(this._data.costResources, this.ToolTip.priceBuildTable, this.ToolTip.priceBuildTableItems);
            this.createResourceTable(this._data.destroyResources, this.ToolTip.priceDismantleTable, this.ToolTip.priceDismantleTableItems);

            if (this._data.Prod?.Next) this.createResourceTable(this._data.Prod.Next, this.ToolTip.ProdNextTable, this.ToolTip.ProdNextTableItems);
            if (this._data.Prod?.Previous) this.createResourceTable(this._data.Prod.Previous, this.ToolTip.ProdPreviousTable, this.ToolTip.ProdPreviousTableItems);

            this.ToolTipBuild = this.createElement("div", "ToolTipBuildBuild");

            this.ToolTipBuild.MaxLevel = this.createElement("div", "ToolTipBuildMaxLevel red_text", Lang.build.maxLevel).hide();
            this.ToolTipBuild.QueueFull = this.createElement("div", "ToolTipBuildQueueFull red_text").hide()
                .append(
                    this.createElement("div", "", Lang.queues.full),
                    this.createElement("div", "tooltip-empty")
                );

            this.ToolTipBuild.IsBusy = this.createElement("div", "ToolTipBuildIsBusy red_text").hide()
                .append(
                    this.createElement("div", "", (this._images == 'builds') ? Lang.build.IsBusyReseach : Lang.build.IsBuildReseach),
                    this.createElement("div", "tooltip-empty")
                );

            this.ToolTipBuild.Build = this.createTooltip({
                headText: this._data.level > 0 ? Lang.build.upgrade : Lang.build.build,
                nameText: Lang.tech?.[this._data.id] || this._data.name,
                levelNum: this.ToolTip.levelBuildNum,
                timeNum: this.ToolTip.timeBuildNum,
                timeLabel: Lang.build.timeBuild,
                priceResources: this.ToolTip.priceBuildTable,
                prod: { title: Lang.build.productionIncrease, table: this.ToolTip.ProdNextTable, items: this.ToolTip.ProdNextTableItems, resources: this._data.Prod?.Next }
            }).hide();

            this.ToolTipBuild.append(this.ToolTipBuild.IsBusy, this.ToolTipBuild.QueueFull, this.ToolTipBuild.Build, this.ToolTipBuild.MaxLevel);
            //this.ToolTipBuild.prepend(this.ToolTip.maxLevel);

            this.ToolTipDismantle = this.createElement("div", "ToolTipDismantle");

            this.ToolTipDismantle.Build = this.createTooltip({
                headText: Lang.build.dismantle,
                nameText: Lang.tech?.[this._data.id] || this._data.name,
                levelNum: this.ToolTip.levelDismantleNum,
                timeNum: this.ToolTip.timeDismantleNum,
                timeLabel: Lang.build.timeDestroy,
                priceResources: this.ToolTip.priceDismantleTable,
                prod: { title: Lang.build.productionDecrease, table: this.ToolTip.ProdPreviousTable, items: this.ToolTip.ProdPreviousTableItems, resources: this._data.Prod?.Previous },
                isDismantle: true
            });

            this.ToolTipDismantle.QueueFull = $(this.ToolTipBuild.QueueFull[0].cloneNode(true)).hide();
            this.ToolTipDismantle.IsBusy = $(this.ToolTipBuild.IsBusy[0].cloneNode(true)).hide();

            this.ToolTipDismantle.append(this.ToolTipDismantle.IsBusy, this.ToolTipDismantle.QueueFull, this.ToolTipDismantle.Build);

            this.ToolTipInfo = this.createElement("div", this._type);
            this.ToolTipInfo.append(this.createElement("div", "head yellow_text", Lang.fcm_info));

            if (this._data.requirements && Object.keys(this._data.requirements).length > 0) {
                this.ToolTip.requirements = this.createElement("div", "requirements", Lang.build.requirements + ":");
                this.ToolTip.requirementsTable = this.createElement("div", "requirementsTable");
                this.ToolTip.requirementsTableItems = {};

                $.each(this._data.requirements, (id, value) => {
                    const row = this.createElement("div");
                    row.append(
                        this.createElement("span", "", Lang.tech?.[id] || value.name),
                        this.createElement("span", "", ` ${value.own} ${Lang.from} ${value.count}`)
                    );
                    this.ToolTip.requirementsTableItems[id] = row;
                    this.ToolTip.requirementsTable.append(row);
                });

                this.ToolTipInfo.append(this.createElement("div", "tooltip-empty"), this.ToolTip.requirements, this.ToolTip.requirementsTable);
            }

            this.Buttons.Up.ToolTip(this.ToolTipBuild, { 'max-width': '350px' });
            this.Buttons.Down.ToolTip(this.ToolTipDismantle, { 'max-width': '350px' });
            this.Buttons.Info.ToolTip(this.ToolTipInfo, { 'max-width': '350px' });

            this.Buttons.Max.ToolTip(Lang.build.maximum);

            this.Buttons.Up
                .off(isTouch ? "confirmed-click.build" : "click.build")
                .on(isTouch ? "confirmed-click.build" : "click.build", (e) => {
                    if (!this._data.accessible) return;
                    if ($(e.currentTarget).attr("disabled")) {
                        return false;
                    }
                    GameEvents.emit("BuildAction", { action: "upgrade", id: this._data.id });
                });

            this.Buttons.Down
                .off(isTouch ? "confirmed-click.build" : "click.build")
                .on(isTouch ? "confirmed-click.build" : "click.build", (e) => {
                    if (this._data.levelToBuild <= 0) return;
                    if ($(e.currentTarget).attr("disabled")) {
                        return false;
                    }
                    GameEvents.emit("BuildAction", { action: "dismantle", id: this._data.id });
                });

            this.Buttons.Info
                .off(isTouch ? "confirmed-click.build" : "click.build")
                .on(isTouch ? "confirmed-click.build" : "click.build", (e) => {
                    if ($(e.currentTarget).attr("disabled")) {
                        return false;
                    }
                    GameEvents.emit("BuildAction", { action: "info", id: this._data.id });
                });

            this.Buttons.Max
                .off("click.build")
                .on("click.build", (e) => {
                    if ($(e.currentTarget).attr("disabled")) {
                        return false;
                    }
                    GameEvents.emit("BuildAction", {
                        action: "max",
                        id: this._data.id,
                        Price: this._data.costResources
                    });
                });

            $(this).append(this.Buttons.Up, this.Buttons.Down, this.Buttons.Info, this.Buttons.Max, this.Input)
        }

        if (this._images == 'fleets' || this._images == 'defenses') {
            this.Image.ToolTip(this.ToolTipBuild, { 'max-width': '250px' });
        } else if (this._type === 'over_queues') {

        } else {
            this.Image.ToolTip(Lang.shortDescription[this._data.id], { 'max-width': '250px' });
        }
        $(this).append(this.Header.container, this.Image);

        this.created = true;
    }

    render() {
        if (!this._data) return;
        if (!this.created) this.create();

        $(this).removeClass().addClass(this._type);

        let count = this._data.count ?? 0;
        if ((this._images === 'fleets' || this._images === 'defenses') && (this._type === 'queues' || this._type === 'over_queues')) {
            if (this._data.status == "active" || this._type === 'over_queues')
                count = Math.max(0, Math.floor((this._data.end_time - GameServerTime.now() - 0.001) / this._data.time)) + 1;

            else count = this._data.count;

            if (!this.ItemDataCount) this.ItemDataCount = {};

            if (this._data.count > count && Page.$Content.Items && Page.$Content.Items[this._data.id]) {
                if (!this.ItemDataCount[this._data.id])
                    this.ItemDataCount[this._data.id] = Page.$Content.Items[this._data.id][0].data.count;


                Page.$Content.Items[this._data.id][0].data.count = this.ItemDataCount[this._data.id] + this._data.count - count;
            }

        }
        this.Header.Number.text((this._images === 'builds' || this._images === 'techs') ? this._data.level : count);

        if (this._type === 'queues') {
            $(this).toggleClass("active", this._data.status == "active");
            $(this).toggleClass("queued", this._data.status == "queued");


            let remaining = 0;

            if (this._data.status == "active") {
                this.Header.Progress.show();

                const now = GameServerTime.now();
                const totalTime = this._data.end_time - this._data.start_time;
                const elapsed = Math.max(0, now - this._data.start_time + 1); // не меньше 0
                const elapsed1 = Math.max(0, now - this._data.start_time); // не меньше 0

                let progress = 0;
                let progress1 = 0;
                if (totalTime > 0) {
                    progress = Math.round((elapsed / totalTime) * 100);
                    progress = Math.min(progress, 100); // не больше 100%
                    progress1 = Math.round((elapsed1 / (totalTime - 1)) * 100);
                    progress1 = Math.min(progress1, 100); // не больше 100%
                }

                this.Header.ProgressBar.css("width", progress + "%");
                this.Header.Progress.ToolTip(progress1 + "%");

                this.ToolTipCancel.Progress.show();
                this.ToolTipCancel.ProgressNum.text(100 - progress);

                remaining = Math.max(0, Math.round(this._data.end_time - GameServerTime.now()));

            } else {
                this.ToolTipCancel.Progress.hide();
                this.Header.Progress.hide();
                remaining = Math.max(0, Math.round(this._data.end_time - this._data.start_time));
            }

            this.Header.LastTimeNumber.text(secondToTime(remaining));
            this.Header.EndTimeNumber.text(formatTimestamp(this._data.end_time, 'timedate'));
        } else if (this._type === 'over_queues') {

            this.Image.css({
                    'background': `url("/images/${this._images}/${this._data.name}.gif") no-repeat`,
                    'background-size': 'contain'
                });

            const remaining = Math.max(0, Math.round(this._data.end_time - GameServerTime.now()));
            this.Bottom.LastTimeNumber.text(secondToTime(remaining));

            this.Header.Name.text(Lang.tech[this._data.id]);

        } else {
            this.ToolTip.levelBuildNum.text(this._data.levelToBuild + 1);
            this.ToolTip.timeBuildNum.text(secondToTime(this._data.elementTime, true, this._data.elementTime < 10));
            this.ToolTip.levelDismantleNum.text(this._data.levelToBuild);
            this.ToolTip.timeDismantleNum.text(secondToTime(this._data.destroyTime, true, this._data.destroyTime < 10));

            const $resBul = this.updateResourceTable(this._data.costResources, this.ToolTip.priceBuildTableItems, (v, res) => Data.Resources?.[res]?.count >= v);
            const $resDest = this.updateResourceTable(this._data.destroyResources, this.ToolTip.priceDismantleTableItems, (v, res) => Data.Resources?.[res]?.count >= v);

            // Update production
            if (this._data.Prod?.Next) this.updateResourceTable(this._data.Prod.Next, this.ToolTip.ProdNextTableItems, null, true);
            if (this._data.Prod?.Previous) this.updateResourceTable(this._data.Prod.Previous, this.ToolTip.ProdPreviousTableItems, null, true);

            this.Buttons.Down.toggle(this._data.levelToBuild > 0 && this._images === 'builds');
            this.Buttons.Up.toggle(this._data.accessible && (this._images !== 'fleets' && this._images !== 'defenses'));
            this.Buttons.Max.toggle(this._data.accessible && (this._images === 'fleets' || this._images === 'defenses'));
            if (this._data.accessible && (this._images === 'fleets' || this._images === 'defenses')) {
                this.Input.show();
                this.Buttons.Info.css("bottom", "28px");
            } else {
                this.Buttons.Info.css("bottom", "2px");

                this.Input.hide();
            }
            this.Buttons.Up.Dis = false;
            this.Buttons.Down.Dis = false;
            this.Buttons.Max.Dis = false;
            this.Input.Dis = false;

            if (this._data.CountQueue >= this._data.MaxQueue || this._data.working) {
                this.Buttons.Up.Dis = true;
                this.Buttons.Down.Dis = true;
                this.Buttons.Max.Dis = true;
                this.Input.Dis = true;
            }

            let count = this._data.count;
            $.each(Page.$Content.Queues.Items, (id, queue) => {
                if (this._data.id == queue[0]._data.id)
                    count += queue[0]._data.count;
            });

            if (
                (!$resBul && !this._data.CountQueue) ||
                (this._data.one && count > 0)
            ) {
                this.Buttons.Up.Dis = true;
                this.Buttons.Max.Dis = true;
                this.Input.Dis = true;
            }


            if (!$resDest && !this._data.CountQueue) this.Buttons.Down.Dis = true;
            if (this._data.levelToBuild >= this._data.maxLevel) this.Buttons.Up.Dis = true;

            this.ToolTipBuild.Build.toggle(!(this._data.levelToBuild >= this._data.maxLevel));
            this.ToolTipBuild.MaxLevel.toggle((this._data.levelToBuild >= this._data.maxLevel));
            this.ToolTipBuild.QueueFull.toggle(this._data.CountQueue >= this._data.MaxQueue);
            this.ToolTipBuild.IsBusy.toggle(this._data.working);

            this.ToolTipDismantle.QueueFull.toggle(this._data.CountQueue >= this._data.MaxQueue);
            this.ToolTipDismantle.IsBusy.toggle(this._data.working);


            this.Buttons.Up.attr('disabled', this.Buttons.Up.Dis);
            this.Buttons.Down.attr('disabled', this.Buttons.Down.Dis);
            this.Buttons.Max.attr('disabled', this.Buttons.Max.Dis);
            this.Input.attr('disabled', this.Input.Dis);

            if (this._data.requirements && this.ToolTip?.requirementsTableItems) {
                $.each(this._data.requirements, (id, value) => {
                    if (!this.ToolTip?.requirementsTableItems[id]) return;
                    const row = this.ToolTip?.requirementsTableItems[id];
                    if (!row) return;

                    // Обновляем текст
                    const spans = row.children("span");
                    spans.eq(0).text(Lang.tech?.[id] || value.name);           // название
                    spans.eq(1).text(` ${value.own} из ${value.count}`);      // уровень / количество

                    // Цвет: lime если достаточно, orange если не хватает
                    row.toggleClass("lime_text", value.own >= value.count)
                        .toggleClass("orange_text", value.own < value.count);
                });
            }
        }




        if (!this._data.accessible) {
            if (this._type !== 'queues' && this._type !== 'over_queues') $(this).addClass("disabled");
        } else {
            $(this).removeClass("disabled");
        }
    }

    connectedCallback() {
        this.render();

        if (!this.EventActive) {
            this.EventActive = true;
            // сохраняем связанный метод для правильного удаления
            this._boundRender = this.render.bind(this);
            document.addEventListener("GameTick", this._boundRender);
        }
    }

    disconnectedCallback() {
        this.Buttons?.Up?.off("click");
        this.Buttons?.Down?.off("click");
        this.Buttons?.Info?.off("click");
        this.Buttons?.Cancel?.off("click");
        this.Buttons?.Max?.off("click");
        if (this.EventActive && this._boundRender) {
            document.removeEventListener("GameTick", this._boundRender);
            this.EventActive = false;
        }
    }
}

customElements.define("game-build", GameBuild);
