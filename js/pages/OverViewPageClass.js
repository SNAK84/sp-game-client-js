window.OverViewPageClass = class OverViewPageClass extends BasePageClass {


    Name = "OverViewPageClass";
    flyingFleetsTimer = null;
    flyingFleetRows = new Map();

    constructor() {

        console.log("constructor OverViewPageClass");

        super();

        this.$Layer.toggleClass("accauntlayer", false);
        this.$Layer.toggleClass("gamelayer", true);
        //this.GeneretContainer();

        //if (!GameLayer) GameLayer = new GameLayerClass();

        //GameLayer.Show();

        this.$Content.addClass("OverView");



    }

    CreateQueues() {
        const queues = this.messageData.data.Page?.Queues;
        this.$Content.Queues = $("<div>").addClass("Queues").hide();
        this.$Content.Queues.Build = {};
        this.$Content.Queues.Tech = {};
        this.$Content.Queues.Hangar = {};

        // Создание элементов для очереди
        $.each(queues, (Type, queue) => {
            const build = $("<game-build>").hide();;
            build[0].type = "over_queues";
            build[0].images = (Type === "Build") ? "builds" : (Type === "Tech") ? "techs" : (queue.id > 400) ? "defenses" : "fleets";
            build[0].data = queue;

            this.$Content.Queues[Type] = build;
            this.$Content.Queues.append(build);

        });

        this.$Content.append(this.$Content.Queues);
    }

    renderQueues() {
        const queues = this.messageData.data.Page?.Queues;

        if (!this.$Content?.Queues) {
            this.CreateQueues();
        }

        if (!queues) {
            this.$Content.Queues.fadeOut(250);
        } else {
            this.$Content.Queues.fadeIn(250);
        }


        if (queues.Build.length === 0) {
            this.$Content.Queues.Build.fadeOut(250);
        } else {
            this.$Content.Queues.Build.fadeIn(250);
        }

        if (queues.Tech.length === 0) {
            this.$Content.Queues.Tech.fadeOut(250);
        } else {
            this.$Content.Queues.Tech.fadeIn(250);
        }

        if (queues.Hangar.length === 0) {
            this.$Content.Queues.Hangar.fadeOut(250);
        } else {
            this.$Content.Queues.Hangar.fadeIn(250);
        }

        $.each(queues, (Type, queue) => {
            this.$Content.Queues[Type][0].type = "over_queues";
            this.$Content.Queues[Type][0].images = (Type === "Build") ? "builds" : (Type === "Tech") ? "techs" : (queue.id > 400) ? "defenses" : "fleets";
            this.$Content.Queues[Type][0].data = queue;
        });
    }

    normalizeFlyingFleets() {
        const fleets = this.messageData.data.Page?.FlyingFleets || [];
        return Array.isArray(fleets) ? fleets : Object.values(fleets);
    }

    formatFleetCoordinate(coordinate) {
        if (!coordinate) return "—";

        if (Number(coordinate.type) === 1) {
            const objectNames = { 1: "Планета", 2: "Обломки", 3: "Луна" };
            const objectName = objectNames[Number(coordinate.objectType)] || "Орбита";
            return `[${coordinate.galaxy}:${coordinate.system}:${coordinate.orbit}] ${objectName}`;
        }
        if (Number(coordinate.type) === 2) {
            return `[${coordinate.galaxy}:${coordinate.system}] ${number_format(Number(coordinate.distance) || 0, 0)} / ${number_format(Number(coordinate.angle) || 0, 1)}°`;
        }
        if (Number(coordinate.type) === 3) return `Флот #${coordinate.fleetId}`;
        return "—";
    }

    formatFleetDuration(seconds) {
        const total = Math.max(0, Math.ceil(Number(seconds) || 0));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        return [hours, minutes, secs].map(value => String(value).padStart(2, "0")).join(":");
    }

    getFleetLabel(items, id, fallback) {
        const item = Array.isArray(items)
            ? items.find(entry => Number(entry.id) === Number(id))
            : null;
        if (!item) return fallback;
        const translated = item.lang ? Lang[item.lang] : "";
        return translated && translated !== item.lang ? translated : (item.key || fallback);
    }

    getOverviewRouteLeg(fleet) {
        const routeLeg = fleet.route_leg || {};
        const arrivesAt = Number(routeLeg.arrives_at);

        return {
            start: routeLeg.start || fleet.mission_start || fleet.segment_start,
            target: routeLeg.target || fleet.mission_target || fleet.segment_end,
            arrivesAt: Number.isFinite(arrivesAt) && arrivesAt > 0
                ? arrivesAt
                : Number(fleet.end_time),
            estimated: Boolean(routeLeg.estimated),
            isReturn: routeLeg.direction === "return" || Boolean(fleet.is_return)
        };
    }

    formatOverviewCoordinate(coordinate) {
        if (!coordinate) return "—";
        if (Number(coordinate.type) === 1) {
            return `[${coordinate.galaxy}:${coordinate.system}:${coordinate.orbit}]`;
        }
        if (Number(coordinate.type) === 2) {
            return `[${coordinate.galaxy}:${coordinate.system}] ${number_format(Number(coordinate.distance) || 0, 0)}`;
        }
        if (Number(coordinate.type) === 3) return `Флот #${coordinate.fleetId}`;
        return "—";
    }

    createFlyingFleetsOverview() {
        this.$Content.FlyingFleets = $("<section>").addClass("box OverviewFleetEvents");
        this.$Content.FlyingFleets.Header = $("<button>", { type: "button" })
            .addClass("OverviewFleetEventsHeader")
            .on("click.overview-fleets", () => this.setActiveMode("fleets"));
        this.$Content.FlyingFleets.Title = $("<span>").text("Передвижения флотов");
        this.$Content.FlyingFleets.Count = $("<span>").addClass("OverviewFleetEventsCount");
        this.$Content.FlyingFleets.List = $("<div>").addClass("OverviewFleetEventsList");
        this.$Content.FlyingFleets.Header.append(
            this.$Content.FlyingFleets.Title,
            this.$Content.FlyingFleets.Count
        );
        this.$Content.FlyingFleets.append(
            this.$Content.FlyingFleets.Header,
            this.$Content.FlyingFleets.List
        );
        this.$Content.FlyingFleets.insertAfter(this.$Content.Name);
    }

    renderFlyingFleetsOverview() {
        if (!this.$Content?.FlyingFleets) this.createFlyingFleetsOverview();

        this.clearPageTimeout(this.flyingFleetsTimer);
        this.flyingFleetsTimer = null;
        this.flyingFleetRows.clear();
        this.$Content.FlyingFleets.List.empty();

        const fleets = this.normalizeFlyingFleets();
        this.$Content.FlyingFleets.Count.text(fleets.length);

        if (!fleets.length) {
            this.$Content.FlyingFleets.List.append(
                $("<div>").addClass("OverviewFleetEventsEmpty").text("Нет передвижений флотов")
            );
            return;
        }

        for (const fleet of fleets) {
            const isIncoming = Boolean(fleet.is_incoming);
            const isHostile = Boolean(fleet.is_hostile);
            const routeLeg = this.getOverviewRouteLeg(fleet);
            const missionName = this.getFleetLabel(
                this.messageData.data.Page?.FleetMissions,
                fleet.mission,
                `Миссия #${fleet.mission}`
            );
            const $countdown = $("<strong>").addClass("OverviewFleetEventCountdown");
            const arrivalLabel = Number.isFinite(routeLeg.arrivesAt) && routeLeg.arrivesAt > 0
                ? `${routeLeg.estimated ? "≈ " : ""}${formatTimestamp(routeLeg.arrivesAt, "timedate")}`
                : "—";
            $countdown.ToolTip(`Прибытие: ${arrivalLabel}`);

            const fullRoute = `${this.formatFleetCoordinate(routeLeg.start)} → ${this.formatFleetCoordinate(routeLeg.target)}`;
            const $route = $("<span>")
                .addClass("OverviewFleetEventRoute")
                .text(`${this.formatOverviewCoordinate(routeLeg.start)} → ${this.formatOverviewCoordinate(routeLeg.target)}`)
                .ToolTip(fullRoute);
            const $row = $("<button>", { type: "button" })
                .addClass("OverviewFleetEvent")
                .toggleClass("Returning", routeLeg.isReturn)
                .toggleClass("Incoming", isIncoming)
                .toggleClass("Hostile", isIncoming && isHostile)
                .toggleClass("Friendly", isIncoming && !isHostile)
                .on("click.overview-fleet", () => {
                    if (!isIncoming) this.setActiveMode("fleets");
                })
                .append(
                    $("<span>").addClass("OverviewFleetEventTime").append($countdown),
                    $("<span>").addClass("OverviewFleetEventBody").append(
                        $("<span>").addClass("OverviewFleetEventTitle").text(
                            isIncoming
                                ? `${fleet.owner_name || "Чужой флот"} · ${missionName}`
                                : `Флот #${fleet.id} · ${missionName}`
                        ),
                        $route
                    ),
                    $("<span>").addClass("OverviewFleetEventStatus").text(
                        isIncoming ? "К вам" : (routeLeg.isReturn ? "Возврат" : "К цели")
                    )
                );

            this.$Content.FlyingFleets.List.append($row);
            this.flyingFleetRows.set(Number(fleet.id), {
                endTime: routeLeg.arrivesAt,
                estimated: routeLeg.estimated,
                $countdown
            });
        }

        this.updateFlyingFleetsClock();
    }

    updateFlyingFleetsClock() {
        const now = GameServerTime.now();
        for (const row of this.flyingFleetRows.values()) {
            const remaining = Math.max(0, row.endTime - now);
            row.$countdown.text(
                remaining > 0
                    ? `${row.estimated ? "≈ " : ""}${this.formatFleetDuration(remaining)}`
                    : "Событие"
            );
        }

        if (!this.pageActive || this.flyingFleetRows.size === 0) return;
        this.flyingFleetsTimer = this.setPageTimeout(() => this.updateFlyingFleetsClock(), 1000);
    }

    CreateData() {

        this.$Content.Name = $("<div>", { id: "UserName" }).text("UserName");
        this.$Content.Planet = $("<div>", { id: "Planet" }).addClass("box");
        this.$Content.Planet["Name"] = $("<div>", { id: "PlanetName" }).addClass("box");
        this.$Content.Planet["Info"] = $("<div>", { id: "PlanetInfo" }).addClass("box");
        this.$Content.Planet["Image"] = $("<div>", { id: "PlanetImage" });
        this.$Content.Planet["Debris"] = $("<div>", { id: "PlanetDebris" }).hide();
        this.$Content.Planet["DebrisNoSel"] = $("<div>", { id: "PlanetDebrisNoSel" });


        this.$Content.Planet.Info["LDiameter"] = $("<span>", { id: "PlanetInfoLDiameter" });
        this.$Content.Planet.Info["Size"] = $("<span>", { id: "PlanetInfoSize" });
        this.$Content.Planet.Info["LTemperature"] = $("<span>", { id: "PlanetInfoLTemperature" });
        this.$Content.Planet.Info["Temp"] = $("<span>", { id: "PlanetInfoTemp" });
        this.$Content.Planet.Info["LPosition"] = $("<span>", { id: "PlanetInfoLPosition" });
        this.$Content.Planet.Info["Position"] = $("<span>", { id: "PlanetInfoPosition" });

        this.$Content.Planet.Info.append(this.$Content.Planet.Info.LDiameter);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.Size);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.LTemperature);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.Temp);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.LPosition);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.Position);

        this.$Content.Planet.append(this.$Content.Planet.Name);
        this.$Content.Planet.append(this.$Content.Planet.Info);
        this.$Content.Planet.append(this.$Content.Planet.Image);
        this.$Content.Planet.append(this.$Content.Planet.Debris);
        this.$Content.Planet.append(this.$Content.Planet.DebrisNoSel);

        this.$Content.append(this.$Content.Name);
        this.$Content.append(this.$Content.Planet);


        this.$Content.Planet.Name.off("click.overview").on("click.overview", () => {

            const content = this.createSpan(Lang.overview.RenameTitle);
            content.append("<br><br>");

            const FormName = this.createDiv("", "RenamePlanet");
            const InputName = this.createInput("text", "NewPlanetName", Lang.overview.New_name_planet);
            const InfoName = this.createSpan("", "InfoPlanetName", "mdi mdi-help-box-outline").ToolTip(Lang.overview.InfoRenamePlanet);
            const ButtonName = this.createButton("NewPlanetNameBtn", Lang.overview.Rename).prop("disabled", true);
            FormName.append(InputName, InfoName, ButtonName);

            InputName[0].addEventListener("input", () => {
                const value = InputName[0].value;

                if (value.length > 20) {
                    InputName[0].value = value.slice(0, 20);
                }

                // Проверка длины
                if (value.length < 2 || value.length > 20) {
                    InputName[0].setCustomValidity("Название должно быть от 2 до 20 символов");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Проверка разрешенных символов
                if (!/^[\p{L}\p{N} _-]+$/u.test(value)) {
                    InputName[0].setCustomValidity("Использованы недопустимые символы");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Проверка начала/конца на спецсимволы
                if (/^[-_ ]|[-_ ]$/.test(value)) {
                    InputName[0].setCustomValidity("Название не может начинаться или заканчиваться спецсимволом");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Проверка на подряд идущие спецсимволы
                if (/[-_ ]{2,}/.test(value)) {
                    InputName[0].setCustomValidity("Спецсимволы не могут идти подряд");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Проверка количества спецсимволов (не более 3)
                const countSpecial = (value.match(/[-_ ]/g) || []).length;
                if (countSpecial > 3) {
                    InputName[0].setCustomValidity("Слишком много спецсимволов");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Всё ок
                InputName[0].setCustomValidity("");
                ButtonName.prop("disabled", false);
            });

            ButtonName.on("click", () => {

                if (Dialog) Dialog.close();
                //Overlay.Show(null, 250, () => {
                    //this.$Content.stop(true, true).fadeOut(250, () => {
                        //this.$Content.Show = false;
                        GameEvents.emit("SendServer", {
                            mode: Data.mode,
                            action: "RenamePlanet",
                            NotOverlay: false,
                            data: { Name: InputName.val() }
                        });
                   // });
                //});
            });

            content.append(FormName);

            Dialog.create(content, Lang.overview.PlanetMenu,
                [{ text: Lang.Close, action: () => Dialog.close() }],
                {
                    width: 350,
                    drag: true,
                    position: { my: 'center bottom', at: 'center center', of: "#Planet" }
                });
        });
    }

    renderData() {

        if (!this.$Content?.Planet) {
            this.CreateData();
        }

        this.$Content.Name.text(this.messageData.data.Page?.UserName);
        this.$Content.Planet.Name.text(this.messageData.data.Page?.PlanetName);

        this.$Content.Planet.Debris.ToolTip("tooltip");

        this.$Content.Planet.Info.LDiameter.text(Lang.Diameter);
        this.$Content.Planet.Info.LTemperature.text(Lang.Temperature);
        this.$Content.Planet.Info.LPosition.text(Lang.Position);

        this.$Content.Planet.Info.Size.text(this.messageData.data.Page?.diameter + '' + Lang.km + ' (' + this.messageData.data.Page?.field_used + '/' + this.messageData.data.Page?.field_current + ')');
        this.$Content.Planet.Info.Temp.text(Lang.from + " " + this.messageData.data.Page?.TempMin + '°C ' + Lang.to + ' ' + this.messageData.data.Page?.TempMax + '°C');
        this.$Content.Planet.Info.Position.text('[' + this.messageData.data.Page?.galaxy + ':' + this.messageData.data.Page?.system + ':' + this.messageData.data.Page?.planet + ']');


        this.$Content.Planet.Image.attr("style", "background:url('/images/planets/overview/" + this.messageData.data.Page?.PlanetImage + ".png') no-repeat;background-size:100%");
    }

    async render(generation = this.renderGeneration) {

        if (Dialog) Dialog.close();

        if (!await super.render(generation)) return;

        this.renderData();
        this.renderFlyingFleetsOverview();
        this.renderQueues();




    }


}
