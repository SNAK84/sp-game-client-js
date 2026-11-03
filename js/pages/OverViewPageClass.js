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
            const objectNames = { 1: "Планета", 2: "Обломки", 3: "Луна", 4: "Газовый гигант", 5: "Сектор пояса" };
            const objectName = Number(coordinate.objectType) === 5 && coordinate.sector
                ? `Сектор пояса ${coordinate.sector}` : objectNames[Number(coordinate.objectType)] || "Орбита";
            return `[${coordinate.galaxy}:${coordinate.system}:${coordinate.orbit}] ${objectName}`;
        }
        if (Number(coordinate.type) === 2) {
            return `[${coordinate.galaxy}:${coordinate.system}] ${number_format(Number(coordinate.distance) || 0, 0)} / ${number_format(Number(coordinate.angle) || 0, 1)}°`;
        }
        if (Number(coordinate.type) === 3) return `Флот #${coordinate.fleetId}`;
        return "—";
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
            isHolding: ["holding", "expedition"].includes(routeLeg.direction),
            isExpedition: routeLeg.direction === "expedition",
            recallPending: routeLeg.direction === "recall_pending",
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

    hideFlyingFleetTooltip() {
        if (window.ToolTip?.parent && this.$Content?.FlyingFleets?.[0]?.contains(ToolTip.parent)) {
            ToolTip.hide();
            ToolTip.parent = null;
        }
    }

    Hide() {
        this.hideFlyingFleetTooltip();
        super.Hide();
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
        const previousRows = this.flyingFleetRows;
        this.flyingFleetRows = new Map();
        const contactRows = new Map();
        this.$Content.FlyingFleets.List.children(".SensorContactRow").each((_, row) => {
            contactRows.set(Number($(row).data("contact")?.id), $(row));
        });
        const wantedRows = [];

        const fleets = this.normalizeFlyingFleets();
        const known = new Set(fleets.map(fleet => Number(fleet.id)));
        const contacts = Object.values(this.messageData.data.Page?.SensorContacts || {})
            .filter(contact => !known.has(Number(contact.id)) && Number(contact.retainUntil) > GameServerTime.now());
        this.$Content.FlyingFleets.Count.text(fleets.length + contacts.length);

        if (!fleets.length && !contacts.length) {
            this.hideFlyingFleetTooltip();
            if (!this.$Content.FlyingFleets.List.children(".OverviewFleetEventsEmpty").length) {
                this.$Content.FlyingFleets.List.empty().append(
                    $("<div>").addClass("OverviewFleetEventsEmpty").text("Нет передвижений флотов")
                );
            }
            return;
        }

        for (const fleet of fleets) {
            const previous = previousRows.get(Number(fleet.id));
            const isIncoming = Boolean(fleet.is_incoming);
            const isHostile = Boolean(fleet.is_hostile);
            const routeLeg = this.getOverviewRouteLeg(fleet);
            const missionName = this.getFleetLabel(
                this.messageData.data.Page?.FleetMissions,
                fleet.mission,
                `Миссия #${fleet.mission}`
            );
            const $countdown = previous?.$countdown || $("<strong>").addClass("OverviewFleetEventCountdown");
            const arrivalLabel = Number.isFinite(routeLeg.arrivesAt) && routeLeg.arrivesAt > 0
                ? `${routeLeg.estimated ? "≈ " : ""}${formatTimestamp(routeLeg.arrivesAt, "timedate")}`
                : "—";
            $countdown.ToolTip(`${routeLeg.isExpedition ? "Окончание экспедиции" : routeLeg.isHolding ? "Окончание удержания" : "Прибытие"}: ${arrivalLabel}`);

            const fullRoute = `${this.formatFleetCoordinate(routeLeg.start)} → ${this.formatFleetCoordinate(routeLeg.target)}`;
            const $route = (previous?.$route || $("<span>").addClass("OverviewFleetEventRoute"))
                .text(`${this.formatOverviewCoordinate(routeLeg.start)} → ${this.formatOverviewCoordinate(routeLeg.target)}`)
                .ToolTip(fullRoute);
            const $title = (previous?.$title || $("<span>").addClass("OverviewFleetEventTitle")).text(
                isIncoming
                    ? `${fleet.owner_name || "Чужой флот"} · ${missionName}`
                    : `${fleet.name || `Флот #${fleet.id}`} · ${missionName}`
            ).ToolTip(this.createFleetCompositionTooltip(fleet), {
                "max-width": "min(320px, calc(100vw - 24px))",
                "pointer-events": "none"
            });
            const $status = (previous?.$status || $("<span>").addClass("OverviewFleetEventStatus")).text(
                routeLeg.isExpedition ? "Экспедиция" : routeLeg.isHolding ? "Удержание" : (routeLeg.recallPending ? "Отзыв" : (isIncoming ? "К вам" : (routeLeg.isReturn ? "Возврат" : "К цели")))
            );
            const $row = previous?.$row || $("<button>", { type: "button" }).addClass("OverviewFleetEvent").append(
                $("<span>").addClass("OverviewFleetEventTime").append($countdown),
                $("<span>").addClass("OverviewFleetEventBody").append($title, $route),
                $status
            );
            $row
                .toggleClass("Returning", routeLeg.isReturn)
                .toggleClass("Holding", routeLeg.isHolding)
                .toggleClass("Incoming", isIncoming)
                .toggleClass("Hostile", isIncoming && isHostile)
                .toggleClass("Friendly", isIncoming && !isHostile)
                .off("click.overview-fleet confirmed-click.overview-fleet")
                .on("click.overview-fleet confirmed-click.overview-fleet", () => {
                    if (!isIncoming) this.setActiveMode("fleets");
                });

            wantedRows.push($row[0]);
            this.flyingFleetRows.set(Number(fleet.id), {
                endTime: routeLeg.arrivesAt,
                estimated: routeLeg.estimated,
                $countdown, $route, $title, $status, $row
            });
        }

        for (const contact of contacts) {
            wantedRows.push(this.createSensorContactRow(contact, contactRows.get(Number(contact.id)))[0]);
        }
        // Не вынимаем прежние строки из DOM: сохраняем hover/focus и источник tooltip.
        const wanted = new Set(wantedRows);
        this.$Content.FlyingFleets.List.children().each((_, row) => {
            if (wanted.has(row)) return;
            if (row.contains(ToolTip.parent)) this.hideFlyingFleetTooltip();
            $(row).remove();
        });
        const list = this.$Content.FlyingFleets.List[0];
        let next = list.firstChild;
        for (const row of wantedRows) {
            if (row !== next) this.placeElement(list, row, next);
            next = row.nextSibling;
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

        const $contacts = this.$Content.FlyingFleets.List.find(".SensorContactRow");
        $contacts.each((_, row) => {
            const $row = $(row), data = $row.data();
            const wasStale = $row.hasClass("Stale");
            $row.toggle(Number(data.retainUntil) > now).toggleClass("Stale", !data.fresh || Number(data.freshUntil) <= now);
            $row.find(".OverviewFleetEventStatus").text($row.hasClass("Stale") ? "Отметка" : "Обнаружен");
            if (wasStale !== $row.hasClass("Stale")) $row.find(".OverviewFleetEventTitle")
                .ToolTip(this.createSensorContactCard(data.contact).prop("outerHTML"), { "max-width": "min(320px, calc(100vw - 24px))" });
            if (Number(data.retainUntil) <= now && row.contains(ToolTip.parent)) ToolTip.hide();
        });
        if (!this.pageActive || (this.flyingFleetRows.size === 0 && $contacts.length === 0)) return;
        this.flyingFleetsTimer = this.setPageTimeout(() => this.updateFlyingFleetsClock(), 1000);
    }

    CreateData() {

        this.$Content.Name = $("<div>", { id: "UserName" }).text("UserName");
        this.$Content.Planet = $("<div>", { id: "Planet" }).addClass("box");
        this.$Content.Planet["Name"] = $("<div>", { id: "PlanetName" }).addClass("box");
        this.$Content.Planet["Info"] = $("<div>", { id: "PlanetInfo" }).addClass("box");
        this.$Content.Planet["Image"] = $("<div>", { id: "PlanetImage" });
        this.$Content.Planet["Moon"] = $("<button>", { type: "button", class: "OverviewMoon" }).hide()
            .append($("<span>", { class: "OverviewMoonImage", "aria-hidden": "true" }));
        this.$Content.Planet["Debris"] = $("<div>", { id: "PlanetDebris" }).hide();
        this.$Content.Planet.Debris.attr({ role: "button", tabindex: 0 });
        // Нормированная кольцевая hit-area: поверхность планеты остаётся свободной.
        this.$Content.Planet.Debris.append(
            '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">' +
            '<defs><clipPath id="OverviewDebrisRingClip" clipPathUnits="objectBoundingBox">' +
            '<path clip-rule="evenodd" d="M .5 0 A .5 .5 0 1 1 .5 1 A .5 .5 0 1 1 .5 0 Z ' +
            'M .5 .083333 A .416667 .416667 0 1 1 .5 .916667 A .416667 .416667 0 1 1 .5 .083333 Z"/>' +
            '</clipPath></defs></svg>'
        );


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
        this.$Content.Planet.append(this.$Content.Planet.Moon);
        // Планета и обломки масштабируются в одной системе координат.
        this.$Content.Planet.Image.append(this.$Content.Planet.Debris);

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

        this.renderDebris();
        this.renderMoon();

        this.$Content.Planet.Info.LDiameter.text(Lang.Diameter);
        this.$Content.Planet.Info.LTemperature.text(Lang.Temperature);
        this.$Content.Planet.Info.LPosition.text(Lang.Position);

        this.$Content.Planet.Info.Size.text(this.messageData.data.Page?.diameter + '' + Lang.km + ' (' + this.messageData.data.Page?.field_used + '/' + this.messageData.data.Page?.field_current + ')');
        this.$Content.Planet.Info.Temp.text(Lang.from + " " + this.messageData.data.Page?.TempMin + '°C ' + Lang.to + ' ' + this.messageData.data.Page?.TempMax + '°C');
        this.$Content.Planet.Info.Position.text('[' + this.messageData.data.Page?.galaxy + ':' + this.messageData.data.Page?.system + ':' + this.messageData.data.Page?.planet + ']');


        const image = this.messageData.data.Page?.PlanetImage;
        // Для большого обзора используем детальный спрайт без широких прозрачных полей.
        // Небольшая иконка moon в галактике остаётся прежней.
        const overviewImage = image === "moon" ? "moon-overview-v3" : image;
        this.$Content.Planet.Image.toggleClass("OverviewMoonSurface", image === "moon");
        this.$Content.Planet.Image.attr("style", `background:url('/images/planets/overview/${overviewImage}.png') no-repeat 0 0;background-size:100%`);
    }

    renderMoon() {
        const list = this.messageData.data?.PlanetList;
        const planets = Object.values(list?.Planets || {});
        const current = planets.find(planet => Number(planet.id) === Number(list?.current_planet));
        // Луна привязана к той же орбите. На самой луне второй спутник не рисуем.
        const moon = Number(current?.planet_type) === 1 ? planets.find(planet =>
            Number(planet.planet_type) === 3 && Number(planet.galaxy) === Number(current.galaxy)
            && Number(planet.system) === Number(current.system) && Number(planet.planet) === Number(current.planet)
        ) : null;
        const $moon = this.$Content.Planet.Moon;
        $moon.toggle(Boolean(moon)).off(".overview-moon");
        if (!moon) {
            if (ToolTip?.parent === $moon[0]) ToolTip.hide();
            $moon.removeData("tooltip").removeAttr("data-planet-id aria-label");
            return;
        }

        const name = moon.name || Lang.planetSelector.Moon;
        const coordinate = `[${moon.galaxy}:${moon.system}:${moon.planet}]`;
        $moon.attr({ "data-planet-id": moon.id, "aria-label": `${Lang.planetSelector.Moon}: ${name} ${coordinate}` });
        $moon.find(".OverviewMoonImage").css({
            backgroundImage: `url('/images/planets/galaxy/${moon.image}.png')`,
            backgroundSize: moon.image === "moon" ? "220%" : "100%"
        });
        $moon.ToolTip($("<div>").append($("<strong>").text(name),
            $("<div>").text(`${Lang.planetSelector.Moon} ${coordinate}`)), { "pointer-events": "none" });

        const chooseMoon = () => {
            ToolTip.hide();
            if (Dialog) Dialog.close();
            Overlay.Show(null, 250, () => {
                this.$Content.stop(true, true).fadeOut(250, () => {
                    this.$Content.Show = false;
                    GameEvents.emit("SendServer", { mode: "overview", action: "planetselect",
                        hide: "ActualData", data: { planetId: Number(moon.id) } });
                });
            });
        };
        $moon.on(isTouch ? "confirmed-click.overview-moon" : "click.overview-moon", chooseMoon)
            .on("keydown.overview-moon", event => {
                if (!["Enter", " "].includes(event.key)) return;
                event.preventDefault();
                chooseMoon();
            });
    }

    renderDebris() {
        const page = this.messageData.data.Page || {};
        const field = page.Debris;
        const counts = [901, 902].map(id => {
            const value = Number(field?.[id === 901 ? "metal" : "crystal"]);
            return Number.isFinite(value) ? Math.max(0, value) : 0;
        });
        const visible = counts.some(count => count > 0);
        const $planet = this.$Content.Planet;
        const $targets = $planet.Debris;
        $planet.toggleClass("has-debris", visible);
        $targets.toggle(visible).off("click.debris confirmed-click.debris keydown.debris");
        if (!visible) {
            $targets.removeData("tooltip");
            if ($targets.toArray().includes(ToolTip?.parent)) ToolTip.hide();
            return;
        }

        const coordinate = `[${page.galaxy}:${page.system}:${page.planet}]`;
        const $tooltip = $("<div>").addClass("DebrisTooltip").append(
            $("<div>").addClass("DebrisTooltipTitle").text(`${Lang.debris.Title} ${coordinate}`)
        );
        [901, 902].forEach((id, index) => {
            $tooltip.append($("<div>").addClass(`ResBox icon${id}`)
                .text(`${Lang.tech[id]}: ${humanNumber(counts[index], true, 3)}`));
        });
        $tooltip.append($("<div>").addClass("DebrisTooltipHint").text(Lang.debris.TargetHint));
        const chooseTarget = () => {
            ToolTip.hide();
            Overlay.Show(null, 250, () => {
                this.$Content.stop(true, true).fadeOut(250, () => {
                    this.$Content.Show = false;
                    GameEvents.emit("SendServer", {
                        mode: "fleets",
                        data: { target: { type: 1, galaxy: Number(page.galaxy), system: Number(page.system),
                            orbit: Number(page.planet), objectType: 2 } }
                    });
                });
            });
        };
        // Информационный tooltip не должен перехватывать курсор и вызывать mouseleave.
        $targets.attr("aria-label", `${Lang.debris.ChooseTarget} ${coordinate}`)
            .ToolTip($tooltip, { "max-width": "280px", "pointer-events": "none" });
        $targets.on(isTouch ? "confirmed-click.debris" : "click.debris", chooseTarget)
            .on("keydown.debris", event => {
                if (!["Enter", " "].includes(event.key)) return;
                event.preventDefault();
                chooseTarget();
            });
    }

    async render(generation = this.renderGeneration) {

        if (Dialog) Dialog.close();

        if (!await super.render(generation)) return;

        this.renderData();
        this.renderFlyingFleetsOverview();
        this.renderQueues();




    }


}
