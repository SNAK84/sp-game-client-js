window.HangarPageClass = class HangarPageClass extends BasePageClass {


    Name = "HangarPageClass";

    constructor() {

        console.log("constructor HangarPageClass");

        super();

        this.$Layer.toggleClass("accauntlayer", false);
        this.$Layer.toggleClass("gamelayer", true);

        //this.GeneretContainer();

        //if (!GameLayer) GameLayer = new GameLayerClass();

        //GameLayer.Show();

        //this.$Content = GameLayer.$Content.empty().hide().html("").removeClass().addClass("BuildsPage");
        this.$Content.addClass("ShipyardPage");

        const event = (e) => {
            const { action, id } = e.detail;

            if (action === "max") {
                const count = this.getMaxConstructibleElements(id, e.detail.Price);
                this.$Content.Items[id][0].Input.val(count);
                return;
            }
            if (action === "info") {
                console.log(`ℹ️ Инфо по ${id}`);
                GameEvents.emit("ShowInfoPanel", { data: { 'id': id } });
                return;
            }
            Overlay.Show(null, 250, () => {

                let act = null;
                switch (action) {
                    case "upgrade":
                        act = "build";
                        break;
                    case "cancel":
                        act = "cancel";
                        break;
                }

                if (["build", "dismantle", "cancel"].includes(act)) {
                    GameEvents.emit("SendServer", {
                        mode: Data.mode,//(id > 400) ? "defense" : "shipyard",
                        action: act,
                        hide: "ActualData",
                        data: { 'id': id }
                    });
                }
            });
        };

        GameEvents.off("BuildAction");
        GameEvents.on("BuildAction", event);

    }

    getSelectElements() {
        let count = 0;
        $.each(this.$Content.Items, (id, build) => {
            count += build[0]?.Input.val();
        });

        return count;
    }

    clearSelectElements() {
        $.each(this.$Content.Items, (id, build) => {
            build[0].Input.val(0);
        });
    }

    buildSelectElements() {
        let items = {};
        $.each(this.$Content.Items, (id, build) => {
            if (build[0]?.Input) {
                const count = build[0].Input.val();
                if (count > 0) items[id] = count;
            }
        });

        GameEvents.emit("SendServer", {
            mode: Data.mode,
            action: "build",
            hide: "ActualData",
            data: { 'items': items }
        });

        this.clearSelectElements();
        //return build;
    }


    getMaxConstructibleElements(Element, Price) {

        let Res = structuredClone(Data.Resources);
        const maxElement = [];

        // Учитываем занятые ресурсы другими постройками
        $.each(this.$Content.Items, (id, build) => {
            if (Element == id) return;

            const count = Number(build[0]?.Input?.val()) || 0;
            const cost = build[0]?._data?.costResources || {};

            $.each(cost, (res, price) => {
                if (!Res[res]) return;
                Res[res].count -= price * count;
            });

        });

        // Определяем максимум по каждому ресурсу
        $.each(Price, (res, cost) => {
            if (!Res[res] || cost <= 0) return;
            maxElement.push(Math.floor(Res[res].count / cost));
        });

        // Лимиты по ракетам (если это ракета)
        const MaxMissiles = this.getMaxConstructibleRockets();
        if (MaxMissiles[Element] !== undefined)
            maxElement.push(MaxMissiles[Element]);

        // Проверка уникальных объектов (флаг one)
        const data = this.$Content.Items[Element]?.[0]?._data;
        if (data.one) {
            let total = Number(data.count) || 0;
            $.each(this.$Content.Queues.Items, (id, queue) => {
                if (Element === queue[0]?._data?.id)
                    total += queue[0]._data.count;
            });
            maxElement.push(total > 0 ? 0 : 1);
        }

        return maxElement.length ? Math.min(...maxElement) : 0;

    }

    getMaxConstructibleRockets() {

        const Page = this.messageData.data.Page;
        const MissileList = Page?.MissileList || [];
        const Missiles = {};

        // Собираем количество ракет
        $.each(MissileList, (i, id) => {
            Missiles[id] = this.$Content.Items[id]?.[0]?._data?.count || 0;
        });

        // Добавляем из очереди
        $.each(this.$Content.Queues.Items, (id, queue) => {
            const objId = queue[0]?._data?.id;
            if (Missiles.hasOwnProperty(objId)) {
                Missiles[objId] += queue[0]._data.count;
            }
        });

        // Вместимость шахты
        const level = Number(Page?.SiloLevel) || 0;
        const factor = Math.max(Number(Page?.SiloFactor) || 1, 1);
        const maxCapacity = level * 10 * factor;

        //let MaxMissiles = this.messageData.data.Page.SiloLevel * 10 * Math.max(this.messageData.data.Page.SiloFactor, 1);


        const ActuMissiles = Missiles[502] + (2 * Missiles[503]);
        const MissilesSpace = Math.max(0, maxCapacity - ActuMissiles);

        return {
            502: MissilesSpace,
            503: Math.floor(MissilesSpace / 2),
        };

    }

    CreateButtons() {
        //this.$Content.Buttons = {};
        this.$Content.Buttons = $("<div>").addClass("Buttons").hide();

        this.$Content.Buttons.Build = this.createButton(
            "ButtonsBuild", Lang.build.build, this.buildSelectElements.bind(this), false, null, 'btn-success');

        //this._clearSelectElements = this.clearSelectElements.bind(this);
        this.$Content.Buttons.Clear = this.createButton(
            "ButtonsBuild", Lang.build.Clear, this.clearSelectElements.bind(this), false, null, 'btn-warning');


        this.$Content.Buttons.append(this.$Content.Buttons.Build, this.$Content.Buttons.Clear);


        this.$Content.append(this.$Content.Buttons);

        this._renderButtons = this.renderButtons.bind(this);
        $(document).off("GameTick", this._renderButtons).on("GameTick", this._renderButtons);

    }

    renderButtons() {
        if (!this.$Content?.Buttons || !this.$Content.Buttons?.Build || this.$Content.Buttons.Build.length === 0) {
            this.CreateButtons();
        }

        let count = this.getSelectElements();
        if (count > 0) {
            this.$Content.Buttons.fadeIn(250);
        } else {

            this.$Content.Buttons.fadeOut(250);

        }

    }

    CreateTypes() {
        const Types = this.messageData.data.Page?.Types;
        if (!Types) return;
        this.$Content.Types = {};
        $.each(Types, (type, typename) => {
            this.$Content.Types[type] = $("<div>").addClass("box TypeBox");
            this.$Content.Types[type].Name = $("<div>").text(typename).addClass("header");
            this.$Content.Types[type].append(this.$Content.Types[type].Name);

            this.$Content.append(this.$Content.Types[type]);
        });
    }

    renderTypes() {
        if (!this.$Content?.Types || this.$Content.Types.length === 0) {
            this.CreateTypes();
        }

        const types = this.messageData.data.Page?.Types;

        const existing = this.$Content.Types;

        // 1️⃣ Удаляем те, которых больше нет в списке
        for (const id in existing) {
            if (!(id in types)) {
                existing[id].fadeOut(250, () => {
                    existing[id].remove();
                    delete existing[id];
                })
            }
        }

        $.each(types, (type, typename) => {

            if (!existing[type]) {
                this.$Content.Types[type] = $("<div>").addClass("box TypeBox").hide();
                this.$Content.Types[type].Name = $("<div>").text(typename).addClass("header");
                this.$Content.Types[type].append(this.$Content.Types[type].Name);

                this.$Content.append(this.$Content.Types[type]);
                this.$Content.Types[type].fadeIn(250);
            } else {
                // Обновляем данные существующего
                this.$Content.Types[type].Name.text(Lang.nametypes[typename]);
            }


        });
    }

    CreateItems() {
        //this.messageData.data
        const BuildList = this.messageData.data.Page?.FleetList;
        if (!BuildList) return;

        this.$Content.Items = {};
        $.each(BuildList, (id, buid) => {
            this.$Content.Items[id] = $("<game-build>");
            this.$Content.Items[id][0].images = (id > 400) ? "defenses" : "fleets";
            this.$Content.Items[id][0].data = buid;
            this.$Content.Types[buid.type].append(this.$Content.Items[id]);
        });
    }

    renderItems() {
        if (!this.$Content?.Items || this.$Content.Items.length === 0) {
            this.CreateItems();
        }

        const items = this.messageData.data.Page?.FleetList;

        const existing = this.$Content.Items;

        // 1️⃣ Удаляем те, которых больше нет в списке
        for (const id in existing) {
            if (!(id in items)) {
                existing[id].hide(0, () => {
                    existing[id].remove();
                    delete existing[id];
                })
            }
        }

        $.each(items, (id, item) => {

            if (!existing[id]) {
                item.CountQueue = this.messageData.data.Page?.CountQueue ?? 0;
                item.MaxQueue = this.messageData.data.Page?.MaxQueue ?? 0;
                item.working = this.messageData.data.Page?.IsHangarBuild ?? 0;

                this.$Content.Items[id] = $("<game-build>");
                this.$Content.Items[id][0].images = (id > 400) ? "defenses" : "fleets";
                this.$Content.Items[id][0].data = item;
                this.$Content.Types[item.type].append(this.$Content.Items[id].hide());
                this.$Content.Items[id].show(0);
            } else {
                // Обновляем данные существующего            
                item.CountQueue = this.messageData.data.Page?.CountQueue ?? 0;
                item.MaxQueue = this.messageData.data.Page?.MaxQueue ?? 0;
                item.working = this.messageData.data.Page?.IsHangarBuild ?? 0;
                this.$Content.Items[id][0].data = item;
            }


        });
    }

    CreateQueues() {
        const queues = this.messageData.data.Page?.QueueList;
        this.$Content.Queues = $("<div>").addClass("box Queues").hide();
        this.$Content.Queues.Items = {};

        // Заголовок
        this.$Content.Queues.Name = $("<div>")
            .text(Lang.queues.queueBuild)
            .addClass("header");
        this.$Content.Queues.Header = $("<div>").addClass("QueuesHeader");
        this.$Content.Queues.Header.append(this.$Content.Queues.Name);
        this.$Content.Queues.append(this.$Content.Queues.Header);

        // Общий статус очереди (в очереди X из Y)
        this.$Content.Queues.QueueStatus = $("<div>").addClass("QueueStatus");
        this.$Content.Queues.QueueStatus.CountQueue = $("<span>").addClass("CountQueue");
        this.$Content.Queues.QueueStatus.MaxQueue = $("<span>").addClass("MaxQueue green_text");
        this.$Content.Queues.QueueStatus.append(
            $("<span>").text(Lang.queues.inQueue + " "),
            this.$Content.Queues.QueueStatus.CountQueue,
            $("<span>").text(" " + Lang.of + " "),
            this.$Content.Queues.QueueStatus.MaxQueue,
        );
        this.$Content.Queues.Header.append(this.$Content.Queues.QueueStatus);

        // Завершение + таймер
        this.$Content.Queues.QueueTimer = $("<div>").addClass("QueueTimer");
        this.$Content.Queues.QueueTimer.EndTime = $("<span>").addClass("EndTime green_text");
        this.$Content.Queues.QueueTimer.Timer = $("<span>").addClass("Timer green_text");
        this.$Content.Queues.QueueTimer.allEndTime = 0;

        this.$Content.Queues.QueueTimer.append(
            $("<span>").text(Lang.queues.endsIn + " "),
            this.$Content.Queues.QueueTimer.EndTime,
            $("<span>").text(" " + Lang.in + " "),
            this.$Content.Queues.QueueTimer.Timer
        );
        this.$Content.Queues.Header.append(this.$Content.Queues.QueueTimer);


        // Контейнер очередей
        this.$Content.Queues.Queued = $("<div>").addClass("Queued");

        let index = 0;
        // Создание элементов для очереди
        $.each(queues, (id, queue) => {
            const build = $("<game-build>");
            build[0].type = "queues";
            build[0].images = (queue.id > 400) ? "defenses" : "fleets";
            if (index === 0) queue.status = "active";
            build[0].data = queue;
            this.$Content.Queues.Items[id] = build;
            this.$Content.Queues.Queued.append(build);
            index++;
        });

        this.$Content.Queues.append(this.$Content.Queues.Queued);
        this.$Content.append(this.$Content.Queues);

    }

    renderQueues() {
        const queues = this.messageData.data.Page?.QueueList;

        if (!this.$Content?.Queues) {
            this.CreateQueues();
        }

        const existing = this.$Content.Queues.Items;

        // 1️⃣ Удаляем те, которых больше нет в списке
        for (const id in existing) {
            if (!(id in queues)) {
                existing[id].fadeOut(250, () => {
                    existing[id].remove();
                    delete existing[id];
                })
            }
        }

        // 2️⃣ Добавляем новые или обновляем существующие
        let index = 0;
        $.each(queues, (id, queue) => {
            this.$Content.Queues.QueueTimer.allEndTime = queue.end_time;
            if (!existing[id]) {
                // Новый элемент
                const build = $("<game-build>").hide();
                build[0].type = "queues";
                build[0].images = (queue.id > 400) ? "defenses" : "fleets";
                if (index === 0) queue.status = "active";
                build[0].data = queue;
                this.$Content.Queues.Items[id] = build;
                this.$Content.Queues.Queued.append(build);
                build.fadeIn(250);
            } else {
                // Обновляем данные существующего
                if (index === 0) queue.status = "active";
                existing[id][0].data = queue;
                existing[id].fadeIn(250);
            }
            index++;
        });

        const CountQueue = this.messageData.data.Page?.CountQueue;

        this.$Content.Queues.Queued.toggle(CountQueue > 0)
        this.$Content.Queues.QueueTimer.toggle(CountQueue > 0);
        //this.$Content.Queues.toggle(250, CountQueue > 0);

        if (CountQueue > 0) {
            this.$Content.Queues.fadeIn(250);
        } else {
            this.$Content.Queues.fadeOut(250);
        }

        if ((CountQueue > 0)) {
            this.renderQueuesTimer();
            if (!this.$Content.Queues.QueueTimer.EventActive) {
                this.$Content.Queues.QueueTimer.EventActive = true;
                // сохраняем связанный метод для правильного удаления
                this.$Content.Queues.QueueTimer._boundRender = this.renderQueuesTimer.bind(this);
                document.addEventListener("GameTick", this.$Content.Queues.QueueTimer._boundRender);
            }
        } else {
            if (this.$Content.Queues.QueueTimer.EventActive && this.$Content.Queues.QueueTimer._boundRender) {
                document.removeEventListener("GameTick", this.$Content.Queues.QueueTimer._boundRender);
                this.$Content.Queues.QueueTimer.EventActive = false;
            }
        }

        this.$Content.Queues.QueueStatus.CountQueue.text(CountQueue);

        this.renderColor(this.$Content.Queues.QueueStatus.CountQueue, CountQueue, this.messageData.data.Page?.MaxQueue);

        this.$Content.Queues.QueueStatus.MaxQueue.text(this.messageData.data.Page?.MaxQueue);

        this.$Content.Queues.QueueTimer.EndTime.text(formatTimestamp(this.$Content.Queues.QueueTimer.allEndTime, 'timedate'));

    }

    renderColor(Obj, Count, Max) {
        const QueueProc = (Count / Max) * 100;

        Obj.removeClass("lime_text yellow_text orange_text red_text");
        // Определяем правила для классов
        const colorRules = [
            { className: "lime_text", max: 50 },
            { className: "yellow_text", max: 75 },
            { className: "orange_text", max: 90 },
            { className: "red_text", max: Infinity }
        ];

        // Применяем класс по правилу
        for (const rule of colorRules) {
            if (QueueProc <= rule.max) {
                Obj.addClass(rule.className);
                break;
            }
        }
    }

    renderQueuesTimer() {
        this.$Content.Queues.QueueTimer.Timer.text(secondToTime(Math.max(0, Math.round(this.$Content.Queues.QueueTimer.allEndTime - GameServerTime.now()))));
    }

    async render() {

        await super.render();

        this.renderQueues();
        this.renderButtons();
        this.renderTypes();
        this.renderItems();




    }

}