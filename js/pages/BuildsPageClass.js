window.BuildsPageClass = class BuildsPageClass extends BasePageClass {


    Name = "BuildsPageClass";

    constructor() {

        console.log("constructor BuildsPageClass");

        super();

        this.$Layer.toggleClass("accauntlayer", false);
        this.$Layer.toggleClass("gamelayer", true);

        //this.GeneretContainer();

        //if (!GameLayer) GameLayer = new GameLayerClass();

        //GameLayer.Show();

        //this.$Content = GameLayer.$Content.empty().hide().html("").removeClass().addClass("BuildsPage");
        this.$Content.addClass("BuildsPage");

        const event = (e) => {

            const { action, id } = e.detail;

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
                    case "dismantle":
                        act = "dismantle";
                        break;
                    case "cancel":
                        act = "cancel";
                        break;
                }

                if (["build", "dismantle", "cancel"].includes(act)) {

                    GameEvents.emit("SendServer", {
                        mode: "buildings",
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

        $.each(this.messageData.data.Page?.Types, (type, typename) => {
            this.$Content.Types[type].Name.text(Lang.nametypes[typename]);
        });
    }

    CreateBuilds() {
        //this.messageData.data
        const BuildList = this.messageData.data.Page?.BuildList;
        if (!BuildList) return;

        this.$Content.Builds = {};
        $.each(BuildList, (id, buid) => {
            this.$Content.Builds[id] = $("<game-build>");
            this.$Content.Builds[id][0].data = buid;
            this.$Content.Types[buid.type].append(this.$Content.Builds[id]);
        });
    }

    renderBuilds() {
        if (!this.$Content?.Builds || this.$Content.Builds.length === 0) {
            this.CreateBuilds();
        }
        $.each(this.messageData.data.Page?.BuildList, (id, buid) => {
            buid.CountQueue = this.messageData.data.Page?.CountQueue ?? 0;
            buid.MaxQueue = this.messageData.data.Page?.MaxQueue ?? 0;
            this.$Content.Builds[id][0].data = buid;
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

        // Поля планеты
        this.$Content.Queues.FieldsInfo = $("<div>").addClass("FieldsInfo");
        this.$Content.Queues.FieldsInfo.CurrentFields = $("<span>").addClass("CurrentFields");
        this.$Content.Queues.FieldsInfo.MaxFields = $("<span>").addClass("MaxFields green_text");
        this.$Content.Queues.FieldsInfo.append(
            $("<span>").text(Lang.queues.fieldsOccupied + ": "),
            this.$Content.Queues.FieldsInfo.CurrentFields,
            $("<span>").text(" " + Lang.of + " "),
            this.$Content.Queues.FieldsInfo.MaxFields
        );
        this.$Content.Queues.Header.append(this.$Content.Queues.FieldsInfo);

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

        // Создание элементов для очереди
        $.each(queues, (id, queue) => {
            const build = $("<game-build>").hide();
            build[0].type = "queues";
            build[0].data = queue;
            this.$Content.Queues.Items[id] = build;
            this.$Content.Queues.Queued.append(build);
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
        $.each(queues, (id, queue) => {
            this.$Content.Queues.QueueTimer.allEndTime = queue.end_time;
            if (!existing[id]) {
                // Новый элемент
                const build = $("<game-build>");
                build[0].type = "queues";
                build[0].data = queue;
                this.$Content.Queues.Items[id] = build;
                this.$Content.Queues.Queued.append(build);
                build.fadeIn(250);
            } else {
                // Обновляем данные существующего
                existing[id][0].data = queue;
                existing[id].fadeIn(250);
            }
        });

        const CountQueue = this.messageData.data.Page?.CountQueue;

        this.$Content.Queues.Queued.toggle(CountQueue > 0)
        this.$Content.Queues.QueueTimer.toggle(CountQueue > 0);
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

        this.renderColor(this.$Content.Queues.FieldsInfo.CurrentFields, this.messageData.data.Page?.field_used, this.messageData.data.Page?.field_current);

        this.$Content.Queues.FieldsInfo.CurrentFields.text(this.messageData.data.Page?.field_used);
        this.$Content.Queues.FieldsInfo.MaxFields.text(this.messageData.data.Page?.field_current);


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

        console.log("BuildsPageClass render");

        this.renderQueues();
        this.renderTypes();
        this.renderBuilds();




    }

}