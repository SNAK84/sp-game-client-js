window.FleetsPageClass = class FleetsPageClass extends BasePageClass {

    Name = "FleetsPageClass";

    $Fleets = null;
    $FleetsPlanet = null;
    $FlyingFleets = null;
    flyingFleetRows = {};
    flyingFleetsTimer = null;
    expandedFlyingFleetCommands = new Set();

    LastFleetId = 0;

    draggableDelay = 500;

    navigation = {
        $galaxy: null,
        $system: null,
        $orbit: null,
        $distance: null,
        $deg: null,
        $type: null,
        $objectType: null,
        $fleetId: null,
        //$expedition: null,
        $objectTypePanel: null,
        $ownPlanet: null,
        $ownPlanetPanel: null
    };

    lastCoordinates = null;
    missionsTimer = null;
    missionDataLoadingVersion = 0;
    $missionDataPanel = null;
    navigationSystemTimer = null;
    debounce = 500;
    target = null;
    flightControls = null;
    navigationSystemInfo = null;
    navigationSystemCache = new Map();
    expeditionTarget = false;
    navigationFleetSystem = null;
    navigationOrdinaryOrbit = 1;
    selectedMission = null;
    updateNavigationCoordinateFields = null;
    updateMissionSendState = null;

    constructor() {
        super();

        this.$Layer.toggleClass("accauntlayer", false);
        this.$Layer.toggleClass("gamelayer", true);

        this.$Content.addClass("FleetsPage");

        const event = (e) => {
            const { action, ...data } = e.detail;

            if (action === "max") {
                console.log("max");
                const count = this.getMaxConstructibleElements(id, e.detail.Price);
                this.$Ships[id][0].Input.val(count);
                this.renderNewFleetBlock();
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
                    case "MoveShip":
                        act = "MoveShip";
                        break;
                    case "DisbandFleet":
                        act = "DisbandFleet";
                        break;
                    case "cancel":
                        act = "cancel";
                        break;
                }

                if (["MoveShip", "DisbandFleet", "cancel"].includes(act)) {

                    GameEvents.emit("SendServer", {
                        mode: "fleets",
                        action: act,
                        //hide: "ActualData",
                        data: data
                    });
                }
            });
        };

        GameEvents.off("FleetAction");
        GameEvents.on("FleetAction", event);
    }

    getNavigationCoordinates() {
        const type = Number(this.navigation.$type?.[0]?.value);

        if (type === 1) {
            if (this.expeditionTarget) {
                return {
                    type,
                    galaxy: Number(this.navigationSystemInfo?.galaxy),
                    system: Number(this.navigationSystemInfo?.system),
                    orbit: Number(this.navigationSystemInfo?.expeditionOrbit)
                };
            }

            const objectType = Number(this.navigation.$objectType?.[0]?.value);
            return {
                type,
                galaxy: Number(this.navigation.$galaxy.val()),
                system: Number(this.navigation.$system.val()),
                orbit: Number(this.navigation.$orbit.val()),
                ...(objectType > 0 ? { objectType } : {})
            };
        }

        if (type === 2) {
            return {
                type,
                galaxy: Number(this.navigation.$galaxy.val()),
                system: Number(this.navigation.$system.val()),
                distance: Number(this.navigation.$distance.val()),
                angle: Number(this.navigation.$deg.val())
            };
        }

        return {
            type: 3,
            fleetId: Number(this.navigation.$fleetId.val())
        };
    }

    getOwnPlanetTargets() {
        const planets = this.messageData.data?.PlanetList?.Planets;
        if (!Array.isArray(planets)) return [];

        return planets.filter(planet => Number(planet.planet_type) === 1);
    }

    syncOwnPlanetSelection(coordinates) {
        if (!this.navigation.$ownPlanet?.length) return;

        if (
            this.expeditionTarget
            || Number(coordinates?.type) !== 1
            || Number(coordinates?.objectType) !== 1
        ) {
            this.navigation.$ownPlanet.val("");
            return;
        }

        const selectedPlanet = this.getOwnPlanetTargets().find(planet =>
            Number(planet.galaxy) === Number(coordinates.galaxy)
            && Number(planet.system) === Number(coordinates.system)
            && Number(planet.planet) === Number(coordinates.orbit)
        );
        this.navigation.$ownPlanet.val(selectedPlanet ? String(selectedPlanet.id) : "");
    }

    selectOwnPlanetTarget(planet, fleetId) {
        if (!planet) return;

        this.expeditionTarget = false;
        this.clearMissionSelection();

        if (this.navigation.$type?.[0]) {
            this.navigation.$type[0].value = 1;
        }
        if (this.navigation.$objectType?.[0]) {
            this.navigation.$objectType[0].value = 1;
        }

        this.navigation.$galaxy.val(Number(planet.galaxy));
        this.navigation.$system.val(Number(planet.system));
        this.navigation.$orbit.val(Number(planet.planet));
        this.navigationOrdinaryOrbit = Math.max(1, Number(planet.planet) || 1);
        this.updateNavigationCoordinateFields?.(1);

        this.navigationSystemInfo = null;
        this.requestNavigationSystemInfo(fleetId, true);
    }

    normalizeNavigationTarget(target, Fleet) {
        const source = target ?? Fleet.current ?? Fleet.start ?? {};
        const type = Number(source.type);

        if (source.objectType !== undefined && source.objectType !== null) {
            return {
                type: 1,
                galaxy: Number(source.galaxy) || 1,
                system: Number(source.system) || 1,
                orbit: Number(source.orbit) || 1,
                objectType: Number(source.objectType) || 1
            };
        }

        if (type === 1 && source.orbit !== undefined) {
            return {
                type: 1,
                galaxy: Number(source.galaxy) || 1,
                system: Number(source.system) || 1,
                orbit: Number(source.orbit) || 1
            };
        }

        if (source.fleetId !== undefined && source.fleetId !== null) {
            return {
                type: 3,
                fleetId: Number(source.fleetId) || 1
            };
        }

        if (source.angle !== undefined || (source.distance !== undefined && type === 2)) {
            return {
                type: 2,
                galaxy: Number(source.galaxy) || 1,
                system: Number(source.system) || 1,
                distance: Number(source.distance) || 0,
                angle: Number(source.angle) || 0
            };
        }

        // Вход из Galaxy пока использует старый тип цели: 1/2/3 — объект, 4 — точка.
        if ([1, 2, 3].includes(type)) {
            return {
                type: 1,
                galaxy: Number(source.galaxy) || 1,
                system: Number(source.system) || 1,
                orbit: Number(source.orbit) || 1,
                objectType: type
            };
        }

        if (type === 4) {
            return {
                type: 2,
                galaxy: Number(source.galaxy) || 1,
                system: Number(source.system) || 1,
                distance: Number(source.distance) || 0,
                angle: Number(source.deg) || 0
            };
        }

        return { type: 1, galaxy: 1, system: 1, orbit: 1, objectType: 1 };
    }

    formatNavigationTarget(coordinates) {
        if (coordinates.type === 1) {
            const names = {
                1: "Планета",
                2: "Обломки",
                3: "Луна"
            };
            const targetName = this.expeditionTarget
                ? "Экспедиция"
                : (names[coordinates.objectType] ?? "Орбита");
            return `[${coordinates.galaxy}:${coordinates.system}:${coordinates.orbit}] ${targetName}`;
        }

        if (coordinates.type === 2) {
            return `[${coordinates.galaxy}:${coordinates.system}] ${coordinates.distance} / ${coordinates.angle}°`;
        }

        return `Флот #${coordinates.fleetId}`;
    }

    isNavigationTarget(target) {
        const type = Number(target?.type);

        if (type === 1 && target?.objectType !== undefined) {
            return Number(target.galaxy) > 0
                && Number(target.system) > 0
                && Number(target.orbit) > 0
                && [1, 2, 3].includes(Number(target.objectType));
        }

        if (type === 2 && target?.angle !== undefined) {
            return Number(target.galaxy) > 0
                && Number(target.system) > 0
                && Number.isFinite(Number(target.distance))
                && Number.isFinite(Number(target.angle));
        }

        if (type === 3 && target?.fleetId !== undefined) {
            return Number(target.fleetId) > 0;
        }

        // Совместимость только для уже открытых переходов старого клиента.
        if ([1, 2, 3].includes(type) && target?.objectType === undefined) {
            return Number(target.galaxy) > 0
                && Number(target.system) > 0
                && Number(target.orbit) > 0;
        }

        return type === 4
            && Number(target?.galaxy) > 0
            && Number(target?.system) > 0
            && Number.isFinite(Number(target?.distance))
            && Number.isFinite(Number(target?.deg));
    }

    requestNavigationSystemInfo(fleetId, immediate = false) {
        this.clearPageTimeout(this.navigationSystemTimer);

        const loadSystem = () => {
            const galaxy = Number(this.navigation.$galaxy?.val());
            const system = Number(this.navigation.$system?.val());
            if (galaxy < 1 || system < 1) {
                return;
            }

            const cacheKey = `${fleetId}:${galaxy}:${system}`;
            const cached = this.navigationSystemCache.get(cacheKey);
            if (cached) {
                this.applyNavigationSystemInfo(cached, fleetId);
                return;
            }

            const loadingVersion = this.showMissionDataLoading();

            GameEvents.emit("SendServer", {
                mode: Data.mode,
                action: "GetSystemNavigationInfo",
                NotOverlay: true,
                data: { fleetId, galaxy, system },
                onSuccess: (message) => {
                    const info = message.getData("Page")?.NavigationSystem;
                    if (!info) {
                        this.hideMissionDataLoading(loadingVersion);
                        return;
                    }

                    this.navigationSystemCache.set(cacheKey, info);
                    if (
                        Number(this.navigation.$galaxy?.val()) !== galaxy
                        || Number(this.navigation.$system?.val()) !== system
                    ) {
                        this.hideMissionDataLoading(loadingVersion);
                        return;
                    }
                    this.applyNavigationSystemInfo(info, fleetId);
                    this.hideMissionDataLoading(loadingVersion);
                },
                onError: (error) => {
                    this.hideMissionDataLoading(loadingVersion);
                    console.warn("Не удалось загрузить границы системы:", error);
                },
                ...this.getRequestOptions({ latestKey: "navigation-system" })
            });
        };

        if (immediate) {
            loadSystem();
        } else {
            this.navigationSystemTimer = this.setPageTimeout(loadSystem, this.debounce);
        }
    }

    applyNavigationSystemInfo(info, fleetId) {
        if (!info?.valid) {
            this.expeditionTarget = false;
            this.navigationSystemInfo = null;
            this.navigation.$orbit?.prop("disabled", true);
            /*this.navigation.$expedition
                ?.removeClass("btn-success")
                .val("Экспедиция");*/
            this.clearMissionSelection();
            if (this.missionSelector) {
                this.missionSelector.items = this.buildMissionItems(
                    this.messageData.data.Page?.FleetMissions,
                    []
                );
            }
            this.updateFleetInfoPanel(null);
            return;
        }

        this.navigationSystemInfo = info;
        const minOrbit = Number(info.minOrbit) || 1;
        const maxOrbit = Math.max(minOrbit, Number(info.maxOrbit) || minOrbit);

        this.navigation.$orbit?.attr({ min: minOrbit, max: maxOrbit });

        if (this.expeditionTarget) {
            const expeditionOrbit = Number(info.expeditionOrbit);
            if (expeditionOrbit > maxOrbit) {
                this.navigation.$orbit.val(expeditionOrbit);
            } else {
                this.expeditionTarget = false;
                this.clearMissionSelection();
            }
        }

        if (!this.expeditionTarget) {
            const orbit = Math.max(
                minOrbit,
                Math.min(Number(this.navigation.$orbit?.val()) || minOrbit, maxOrbit)
            );
            this.navigation.$orbit?.val(orbit);
        }

        const isObject = Number(this.navigation.$type?.[0]?.value) === 1;
        this.navigation.$galaxy?.prop("disabled", isObject && this.expeditionTarget);
        this.navigation.$system?.prop("disabled", isObject && this.expeditionTarget);
        this.navigation.$orbit?.prop("disabled", !isObject || this.expeditionTarget);
        this.navigation.$objectTypePanel?.toggle(isObject && !this.expeditionTarget);
        /*this.navigation.$expedition
            ?.toggleClass("btn-success", this.expeditionTarget)
            .val(this.expeditionTarget ? "Обычные орбиты" : "Экспедиция");*/

        this.coordinatesChanged(fleetId, null, true);
    }

    setExpeditionTarget(enabled, fleetId) {
        if (enabled && !this.expeditionTarget) {
            this.navigationOrdinaryOrbit = Math.max(1, Number(this.navigation.$orbit?.val()) || 1);
        }
        this.expeditionTarget = Boolean(enabled);

        if (this.expeditionTarget) {
            const galaxy = Number(this.navigationFleetSystem?.galaxy);
            const system = Number(this.navigationFleetSystem?.system);
            if (galaxy < 1 || system < 1) {
                this.expeditionTarget = false;
                this.clearMissionSelection();
                return;
            }
            this.navigation.$galaxy.val(galaxy);
            this.navigation.$system.val(system);
        } else {
            this.navigation.$orbit.val(this.navigationOrdinaryOrbit);
        }

        this.updateNavigationCoordinateFields?.(
            Number(this.navigation.$type?.[0]?.value)
        );

        this.navigationSystemInfo = null;
        this.requestNavigationSystemInfo(fleetId, true);
    }

    getExpeditionMissionId() {
        const missions = this.messageData.data.Page?.FleetMissions;
        if (!Array.isArray(missions)) return null;

        const expedition = missions.find(mission => mission.key === "EXPEDITION");
        return expedition ? Number(expedition.id) : null;
    }

    getTransportMissionId() {
        const missions = this.messageData.data.Page?.FleetMissions;
        if (!Array.isArray(missions)) return null;

        const transport = missions.find(mission => mission.key === "TRANSPORT");
        return transport ? Number(transport.id) : null;
    }

    getRelocateMissionId() {
        const missions = this.messageData.data.Page?.FleetMissions;
        if (!Array.isArray(missions)) return null;

        const relocate = missions.find(mission => mission.key === "RELOCATE");
        return relocate ? Number(relocate.id) : null;
    }

    clearMissionSelection() {
        this.selectedMission = null;
        if (this.missionSelector) {
            this.missionSelector.value = "";
        }
        this.updateMissionSendState?.();
    }

    toggleExpeditionMission(fleetId) {
        const expeditionMissionId = this.getExpeditionMissionId();
        if (!expeditionMissionId) return;

        if (this.expeditionTarget) {
            this.clearMissionSelection();
            this.setExpeditionTarget(false, fleetId);
            return;
        }

        const coordinateTypeSelector = this.navigation.$type?.[0];
        if (coordinateTypeSelector && Number(coordinateTypeSelector.value) !== 1) {
            coordinateTypeSelector.value = 1;
        }

        this.selectedMission = expeditionMissionId;
        if (this.missionSelector) {
            this.missionSelector.value = expeditionMissionId;
        }
        this.setExpeditionTarget(true, fleetId);
    }

    buildMissionItems(allFleetMissions, availableMissionIds = null) {
        if (!Array.isArray(allFleetMissions)) return {};

        const hasAvailabilityFilter = Array.isArray(availableMissionIds);
        const available = new Set((availableMissionIds || []).map(Number));
        const items = {};

        const missionsById = [...allFleetMissions].sort(
            (left, right) => Number(left.id) - Number(right.id)
        );

        for (const mission of missionsById) {
            const isExpedition = mission.key === "EXPEDITION";
            if (hasAvailabilityFilter && !available.has(Number(mission.id)) && !isExpedition) {
                continue;
            }

            items[mission.id] = {
                value: mission.id,
                class: "NavType",
                imgClass: "NavMissionImg Mission_" + mission.key,
                tooltip: Lang[mission.lang]
            };
        }

        return items;
    }

    showMissionDataLoading() {
        const loadingVersion = ++this.missionDataLoadingVersion;

        if (this.$missionDataPanel?.length) {
            Overlay.Show(this.$missionDataPanel, 100);
            Overlay.Text("Получение данных...", this.$missionDataPanel);
        }

        return loadingVersion;
    }

    hideMissionDataLoading(loadingVersion) {
        if (loadingVersion !== this.missionDataLoadingVersion) return;
        if (this.$missionDataPanel?.length) {
            Overlay.Hide(this.$missionDataPanel, 100);
        }
    }

    coordinatesChanged = (fleetId, event, immediate = false) => {
        this.clearPageTimeout(this.missionsTimer);

        const updateMissions = () => {

            const coordinates = this.getNavigationCoordinates();
            this.syncOwnPlanetSelection(coordinates);
            const speedFactor = this.flightControls?.getSpeedFactor?.() ?? 10;
            const missionType = this.selectedMission;
            const coordinatesKey = JSON.stringify({ fleetId, missionType, speedFactor, ...coordinates });

            if (coordinatesKey === this.lastCoordinates) {
                return;
            }

            this.lastCoordinates = coordinatesKey;
            const loadingVersion = this.showMissionDataLoading();
            if (this.fleetInfo) {
                this.fleetInfo.coords.text(this.formatNavigationTarget(coordinates));
            }

            console.log("coordinatesChanged", coordinates);

            GameEvents.emit("SendServer", {
                mode: Data.mode,
                action: "GetAvailableMissions",
                NotOverlay: true,
                data: { 'fleetId': fleetId, 'coordinates': coordinates, missionType, speedFactor },
                onSuccess: (message) => {
                    if (loadingVersion !== this.missionDataLoadingVersion) return;

                    try {
                        this.updateAvailableMissions(message, fleetId);
                    } finally {
                        this.hideMissionDataLoading(loadingVersion);
                    }
                },
                onError: (error) => {
                    if (loadingVersion !== this.missionDataLoadingVersion) return;

                    if (this.lastCoordinates === coordinatesKey) {
                        this.lastCoordinates = null;
                    }
                    this.hideMissionDataLoading(loadingVersion);
                    console.warn("Не удалось загрузить доступные миссии:", error);
                },
                ...this.getRequestOptions({ latestKey: "missions" })
            });
        };

        if (immediate) {
            updateMissions();
        } else {
            this.missionsTimer = this.setPageTimeout(updateMissions, this.debounce);
        }
    }

    updateAvailableMissions(message, fleetId) {
        if (this.missionSelectorFleetId !== fleetId || !this.missionSelector) {
            return;
        }

        const page = message.getData("Page");

        this.updateFleetInfoPanel(page?.TravelInfo);
        this.flightControls?.applyTravelInfo?.(page?.TravelInfo);

        const availableMissionIds = page?.AvailableMissions?.missions;
        const allFleetMissions = page?.FleetMissions;

        if (!Array.isArray(availableMissionIds) || !Array.isArray(allFleetMissions)) {
            return;
        }

        this.missionSelector.items = this.buildMissionItems(
            allFleetMissions,
            availableMissionIds
        );

        if (this.expeditionTarget) {
            const expeditionMissionId = this.getExpeditionMissionId();
            if (expeditionMissionId && availableMissionIds.map(Number).includes(expeditionMissionId)) {
                this.selectedMission = expeditionMissionId;
                this.missionSelector.value = expeditionMissionId;
            } else {
                this.clearMissionSelection();
            }
        } else if (
            this.selectedMission !== null
            && !availableMissionIds.map(Number).includes(Number(this.selectedMission))
        ) {
            this.clearMissionSelection();
        }

        this.updateMissionSendState?.();
    }

    updateFleetInfoPanel(travelInfo) {
        if (!this.fleetInfo) return;

        if (!travelInfo) {
            this.fleetInfo.distance.text("-");
            this.fleetInfo.duration.text("-");
            this.fleetInfo.fuel.text("-");
            return;
        }

        const range = (min, max, digits = 0) => min === max
            ? humanNumber(min, true, digits)
            : `${humanNumber(min, true, digits)} - ${humanNumber(max, true, digits)}`;

        this.fleetInfo.distance.text(range(travelInfo.distance.min, travelInfo.distance.max, 2));
        this.fleetInfo.duration.text(
            travelInfo.duration.min === travelInfo.duration.max
                ? this.formatDuration(travelInfo.duration.min)
                : `${this.formatDuration(travelInfo.duration.min)} - ${this.formatDuration(travelInfo.duration.max)}`
        );
        this.fleetInfo.fuel.text(range(travelInfo.fuel.min, travelInfo.fuel.max, 2));
    }

    formatDuration(seconds) {
        seconds = Math.max(0, Math.round(seconds));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
    }

    getFleetListLabel(items, id, fallback) {
        const item = Array.isArray(items)
            ? items.find(entry => Number(entry.id) === Number(id))
            : null;
        if (!item) return fallback;

        const translated = item.lang ? Lang[item.lang] : "";
        return translated && translated !== item.lang
            ? translated
            : (item.key || fallback);
    }

    formatFleetCoordinate(coordinate) {
        if (!coordinate) return "—";

        const type = Number(coordinate.type);
        if (type === 1) {
            const objectNames = {
                1: "Планета",
                2: "Обломки",
                3: "Луна"
            };
            const objectName = objectNames[Number(coordinate.objectType)] || "Орбита";
            return `[${coordinate.galaxy}:${coordinate.system}:${coordinate.orbit}] ${objectName}`;
        }

        if (type === 2) {
            const distance = number_format(Number(coordinate.distance) || 0, 0);
            const angle = number_format(Number(coordinate.angle) || 0, 1);
            return `[${coordinate.galaxy}:${coordinate.system}] ${distance} / ${angle}°`;
        }

        if (type === 3) {
            return `Флот #${coordinate.fleetId}`;
        }

        return "—";
    }

    createFlyingFleetsTable() {
        this.$FlyingFleets = $("<section>").addClass("box FleetFlights");
        this.$FlyingFleets.Title = $("<div>")
            .addClass("FleetFlightsTitle")
            .append(
                $("<span>").text("Флоты в полёте"),
                this.$FlyingFleets.Count = $("<span>").addClass("FleetFlightsCount")
            );
        this.$FlyingFleets.List = $("<div>").addClass("FleetFlightsList");

        this.$FlyingFleets.append(
            this.$FlyingFleets.Title,
            this.$FlyingFleets.List
        );
        this.$Content.prepend(this.$FlyingFleets);
    }

    createFlyingFleetRow(fleet) {
        const missionName = this.getFleetListLabel(
            this.messageData.data.Page?.FleetMissions,
            fleet.mission,
            `Миссия #${fleet.mission}`
        );
        const commandName = this.getFlyingFleetCommandName(fleet.command);
        const direction = fleet.is_return ? "Возврат" : "К цели";
        const routeLeg = this.getFlyingFleetRouteLeg(fleet);
        const routeSegmentsTotal = Number(routeLeg.segmentsTotal) || 1;
        const routeActiveSegment = Number(routeLeg.activeSegment) || 1;
        const commandLabel = routeSegmentsTotal > 1
            ? `${commandName} · ${routeActiveSegment}/${routeSegmentsTotal}`
            : commandName;
        const missionStartCoordinate = fleet.mission_start || fleet.segment_start;
        const missionTargetCoordinate = fleet.mission_target || fleet.segment_end;

        const $row = $("<article>")
            .addClass("FleetFlightCard")
            .attr("data-fleet-id", fleet.id)
            .toggleClass("Returning", Boolean(fleet.is_return));

        const $fleet = $("<div>")
            .addClass("FleetFlightFleet")
            .append(
                $("<div>").addClass("FleetFlightIdentity").append(
                    $("<strong>").text(`Флот #${fleet.id}`),
                    $("<span>").addClass("FleetFlightMissionName").text(missionName)
                )
            )
            .ToolTip(this.createFlyingFleetTooltip(
                fleet,
                this.getFlyingFleetDisplayFuel(fleet, GameServerTime.now())
            ), {
                "min-width": "230px",
                "max-width": "320px"
            });
        const $missionTarget = $("<span>")
            .addClass("FleetFlightMissionTarget")
            .text(this.formatFleetCoordinate(missionTargetCoordinate))
            .ToolTip("Цель миссии");
        const $missionStart = $("<span>")
            .addClass("FleetFlightMissionStart")
            .text(this.formatFleetCoordinate(missionStartCoordinate))
            .ToolTip("Точка вылета");

        const $fill = $("<span>").addClass("FleetFlightTrackFill");
        const $boundaries = this.createFlyingFleetTrackBoundaries(fleet, routeLeg);
        const $marker = $("<span>")
            .addClass("FleetFlightMarker")
            .attr("aria-hidden", "true")
            .text(fleet.is_return ? "«" : "»");

        const $remaining = $("<strong>").addClass("FleetFlightRemaining");
        const arrivalTime = routeLeg.arrivesAt > 0
            ? formatTimestamp(routeLeg.arrivesAt, "timedate")
            : "—";
        const arrivalLabel = fleet.is_return ? "Возвращение домой" : "Прибытие к цели";
        const $arrival = $("<div>")
            .addClass("FleetFlightTiming FleetFlightArrival")
            .append(
                $remaining,
                $("<span>").text(`${routeLeg.estimated ? "≈ " : ""}${arrivalTime}`)
            )
            .ToolTip(`${arrivalLabel}: ${routeLeg.estimated ? "≈ " : ""}${arrivalTime}`);
        const segmentArrival = formatTimestamp(fleet.end_time, "timedate");
        const commandTooltip = [
            `${direction}: ${commandLabel}`,
            `${this.formatFleetCoordinate(fleet.segment_start)} → ${this.formatFleetCoordinate(fleet.segment_end)}`,
            `Завершение участка: ${segmentArrival}`
        ].join("<br>");
        const $track = $("<div>")
            .addClass("FleetFlightTrack")
            .attr({
                role: "progressbar",
                "aria-label": commandLabel,
                "aria-valuemin": 0,
                "aria-valuemax": 100
            })
            .append($fill, $boundaries, $marker)
            .ToolTip(commandTooltip);
        const $route = $("<div>").addClass("FleetFlightRoute").append($track);

        const missionEndTime = Number(fleet.mission_end_time);
        const hasMissionEnd = Number.isFinite(missionEndTime) && missionEndTime > 0;
        const $missionRemaining = $("<strong>").addClass("FleetFlightMissionRemaining");
        const $commands = this.createFlyingFleetCommands(fleet);
        const commandsId = `FleetFlightCommands-${fleet.id}`;
        const commandsExpanded = this.expandedFlyingFleetCommands.has(Number(fleet.id));
        const commandRows = Array.isArray(fleet.commands) ? fleet.commands : [];
        const commandsLeftValue = Number(fleet.commands_left);
        const commandsTotalValue = Number(fleet.commands_total);
        const commandsLeft = Number.isFinite(commandsLeftValue)
            ? commandsLeftValue
            : commandRows.filter(command => command.status !== "completed").length;
        const commandsTotal = Number.isFinite(commandsTotalValue)
            ? commandsTotalValue
            : commandRows.length;
        const commandsCompleted = Number.isFinite(commandsLeftValue)
            ? Math.max(0, Math.min(commandsTotal, commandsTotal - commandsLeft))
            : commandRows.filter(command => command.status === "completed").length;
        const $commandsButton = $("<button>", { type: "button" })
            .addClass("FleetFlightCommandsButton")
            .attr({
                "aria-controls": commandsId,
                "aria-expanded": String(commandsExpanded),
                "aria-label": `Выполнено команд: ${commandsCompleted} из ${commandsTotal}. Показать цепочку команд флота`
            })
            .text(`Команды: ${commandsCompleted}/${commandsTotal}`)
            .ToolTip(`Выполнено ${commandsCompleted} из ${commandsTotal}. Показать цепочку команд флота`)
            .on(isTouch ? "confirmed-click.fleet-flight" : "click.fleet-flight", () => {
                const expanded = !$commands.is(":visible");
                $commands.toggle(expanded);
                $commandsButton.attr("aria-expanded", String(expanded));
                if (expanded) {
                    this.expandedFlyingFleetCommands.add(Number(fleet.id));
                } else {
                    this.expandedFlyingFleetCommands.delete(Number(fleet.id));
                }
            });
        $commands.attr("id", commandsId).toggle(commandsExpanded);

        const missionEndLabel = hasMissionEnd
            ? `${fleet.mission_end_estimated ? "≈ " : ""}${formatTimestamp(missionEndTime, "timedate")}`
            : "—";
        const $missionTiming = $("<div>")
            .addClass("FleetFlightTiming FleetFlightMissionTiming")
            .append(
                $missionRemaining,
                $("<span>").addClass("FleetFlightMissionEnd").text(missionEndLabel)
            )
            .ToolTip(hasMissionEnd
                ? `Полное завершение миссии: ${missionEndLabel}`
                : "Для одной из будущих команд сервер ещё не умеет рассчитывать длительность");
        const $missionFinish = $("<div>")
            .addClass("FleetFlightMissionFinish")
            .append(
                $missionTiming,
                $commandsButton,
                $arrival
            );

        $row.append(
            $("<div>").addClass("FleetFlightSummary").append(
                $missionStart,
                $fleet,
                $missionTarget
            ),
            $route,
            $missionFinish,
            $commands
        );
        $row.Flight = fleet;
        $row.Track = $track;
        $row.Fill = $fill;
        $row.Marker = $marker;
        $row.Remaining = $remaining;
        $row.MissionRemaining = $missionRemaining;
        $row.FleetElement = $fleet;
        return $row;
    }

    createFlyingFleetTooltip(fleet, displayedFuel = fleet.fuel) {
        const $tooltip = $("<div>").addClass("FleetFlightTooltip");
        const ships = Object.values(fleet.ships || {})
            .filter(ship => Number(ship?.count) > 0)
            .sort((left, right) => Number(left.id) - Number(right.id));
        const resources = Object.values(fleet.resources || {})
            .filter(resource => Number(resource?.count) > 0)
            .sort((left, right) => Number(left.id) - Number(right.id));

        $tooltip.append($("<strong>").addClass("FleetFlightTooltipTitle").text("Состав флота"));
        const $ships = $("<div>").addClass("FleetFlightTooltipSection");
        if (ships.length === 0) {
            $ships.append($("<span>").addClass("FleetFlightTooltipEmpty").text("Корабли не переданы сервером"));
        } else {
            ships.forEach(ship => {
                const key = String(ship.name || "");
                const name = Lang.tech?.[ship.id] || key || `Корабль #${ship.id}`;
                $ships.append(this.createFlyingFleetTooltipRow(name, ship.count));
            });
        }
        $tooltip.append($ships);

        $tooltip.append($("<strong>").addClass("FleetFlightTooltipTitle").text("Груз"));
        const $cargo = $("<div>").addClass("FleetFlightTooltipSection");
        if (resources.length === 0) {
            $cargo.append($("<span>").addClass("FleetFlightTooltipEmpty").text("Пусто"));
        } else {
            resources.forEach(resource => {
                const key = String(resource.name || "");
                const name = Lang.tech?.[resource.id] || key || `Ресурс #${resource.id}`;
                $cargo.append(this.createFlyingFleetTooltipRow(name, resource.count));
            });
        }
        $tooltip.append(
            $cargo,
            $("<div>")
                .addClass("FleetFlightTooltipFuel")
                .append(
                    $("<span>").text("Остаток топлива"),
                    $("<b>").text(humanNumber(displayedFuel, true, 4))
                )
        );

        return $tooltip.prop("outerHTML");
    }

    getFlyingFleetDisplayFuel(fleet, now) {
        const authoritativeFuel = Number(fleet.fuel);
        if (!Number.isFinite(authoritativeFuel)) return 0;

        const routeLeg = this.getFlyingFleetRouteLeg(fleet);
        const activeSegment = routeLeg.segments.find(segment => segment.status === "active")
            || routeLeg.segments[routeLeg.activeSegment - 1];
        if (!activeSegment) return Math.max(0, authoritativeFuel);

        const fuelCost = Number(activeSegment.fuel_cost);
        const startedAt = Number(activeSegment.started_at);
        const endsAt = Number(activeSegment.ends_at);
        if (
            !Number.isFinite(fuelCost)
            || fuelCost <= 0
            || !Number.isFinite(startedAt)
            || !Number.isFinite(endsAt)
            || endsAt <= startedAt
        ) {
            return Math.max(0, authoritativeFuel);
        }

        const progress = Math.max(0, Math.min(1, (now - startedAt) / (endsAt - startedAt)));
        return Math.max(0, authoritativeFuel + fuelCost * (1 - progress));
    }

    updateFlyingFleetTooltip($row, now) {
        if (!$row.FleetElement?.length) return;

        const content = this.createFlyingFleetTooltip(
            $row.Flight,
            this.getFlyingFleetDisplayFuel($row.Flight, now)
        );
        $row.FleetElement.data("tooltip", content);
        if (window.ToolTip?.parent === $row.FleetElement[0]) {
            window.ToolTip.Render($row.FleetElement[0], true);
        }
    }

    createFlyingFleetTooltipRow(name, count) {
        return $("<div>")
            .addClass("FleetFlightTooltipRow")
            .append(
                $("<span>").text(name),
                $("<b>").text(humanNumber(count, true, 4))
            );
    }

    getFlyingFleetCommandName(command) {
        if (!command) return "Неизвестная команда";

        const translated = command.lang ? Lang[command.lang] : "";
        if (translated && translated !== command.lang) return translated;

        return command.key || `Команда #${command.type ?? 0}`;
    }

    getFlyingFleetRouteLeg(fleet) {
        const routeLeg = fleet.route_leg || {};
        const startedAt = Number(routeLeg.started_at);
        const arrivesAt = Number(routeLeg.arrives_at);
        const segments = Array.isArray(routeLeg.segments) ? routeLeg.segments : [];
        const hasRouteTimeline = Number.isFinite(startedAt)
            && startedAt > 0
            && Number.isFinite(arrivesAt)
            && arrivesAt >= startedAt;

        if (hasRouteTimeline) {
            return {
                startedAt,
                arrivesAt,
                estimated: Boolean(routeLeg.estimated),
                activeSegment: Number(routeLeg.active_segment) || 1,
                segmentsTotal: Number(routeLeg.segments_total) || segments.length || 1,
                segments,
                isReturn: routeLeg.direction === "return" || Boolean(fleet.is_return)
            };
        }

        return {
            startedAt: Number(fleet.start_time) || 0,
            arrivesAt: Number(fleet.end_time) || 0,
            estimated: false,
            activeSegment: 1,
            segmentsTotal: 1,
            segments: [],
            isReturn: Boolean(fleet.is_return)
        };
    }

    getFlyingFleetLegMetrics(fleet, now) {
        const routeLeg = this.getFlyingFleetRouteLeg(fleet);
        const duration = Math.max(0, routeLeg.arrivesAt - routeLeg.startedAt);
        const progress = duration > 0
            ? Math.max(0, Math.min(1, (now - routeLeg.startedAt) / duration))
            : 1;

        return {
            ...routeLeg,
            progress,
            markerProgress: routeLeg.isReturn ? 1 - progress : progress,
            remaining: Math.max(0, Math.ceil(routeLeg.arrivesAt - now))
        };
    }

    createFlyingFleetTrackBoundaries(fleet, routeLeg = this.getFlyingFleetRouteLeg(fleet)) {
        const $boundaries = $("<span>").addClass("FleetFlightTrackBoundaries");
        const duration = routeLeg.arrivesAt - routeLeg.startedAt;
        if (duration <= 0 || routeLeg.segments.length < 2) {
            return $boundaries;
        }

        routeLeg.segments.slice(0, -1).forEach(segment => {
            const endsAt = Number(segment.ends_at);
            if (!Number.isFinite(endsAt)) return;

            const progress = Math.max(0, Math.min(1, (endsAt - routeLeg.startedAt) / duration));
            const markerPosition = routeLeg.isReturn ? 1 - progress : progress;
            const commandName = this.getFlyingFleetCommandName(segment);
            $("<i>")
                .addClass("FleetFlightTrackBoundary")
                .css("left", `${markerPosition * 100}%`)
                .ToolTip(`Граница участка: ${commandName}`)
                .appendTo($boundaries);
        });

        return $boundaries;
    }

    createFlyingFleetCommands(fleet) {
        const commands = Array.isArray(fleet.commands) ? fleet.commands : [];
        const $commands = $("<div>").addClass("FleetFlightCommands");

        if (commands.length === 0) {
            return $commands.append(
                $("<div>").addClass("FleetFlightCommandsEmpty").text("Команды не переданы сервером")
            );
        }

        commands.forEach(command => {
            const active = command.status === "active";
            const completed = command.status === "completed";
            const commandTime = Number(command.estimated_time);
            const hasTime = Number.isFinite(commandTime) && commandTime > 0;
            const target = command.target
                ? this.formatFleetCoordinate(command.target)
                : "—";
            const timing = completed
                ? (hasTime ? `выполнено · ${formatTimestamp(commandTime, "timedate")}` : "выполнено")
                : (hasTime
                    ? `${command.time_estimated ? "≈ " : ""}${formatTimestamp(commandTime, "timedate")}`
                    : "после предыдущей команды");

            $commands.append(
                $("<div>")
                    .addClass("FleetFlightCommandRow")
                    .toggleClass("Active", active)
                    .toggleClass("Completed", completed)
                    .append(
                        $("<span>")
                            .addClass("FleetFlightCommandPosition")
                            .text(completed ? "✓" : command.position)
                            .ToolTip(`Команда #${command.position}`),
                        $("<span>").addClass("FleetFlightCommandName").text(this.getFlyingFleetCommandName(command)),
                        $("<span>").addClass("FleetFlightCommandTarget").text(target),
                        $("<span>")
                            .addClass("FleetFlightCommandTime")
                            .text(active ? `сейчас · ${timing}` : timing),
                        command.return_leg
                            ? $("<span>").addClass("FleetFlightCommandReturn").text("возврат")
                            : null
                    )
            );
        });

        return $commands;
    }

    updateFlyingFleetsClock() {
        const now = GameServerTime.now();

        Object.values(this.flyingFleetRows).forEach($row => {
            const fleet = $row.Flight;
            const routeLeg = this.getFlyingFleetLegMetrics(fleet, now);
            const percent = routeLeg.progress * 100;
            const markerPercent = routeLeg.markerProgress * 100;
            const remaining = routeLeg.remaining;
            const missionEndTime = Number(fleet.mission_end_time);
            const missionRemaining = Number.isFinite(missionEndTime) && missionEndTime > 0
                ? Math.max(0, Math.ceil(missionEndTime - now))
                : null;

            $row.Fill.css("width", `${percent}%`);
            $row.Marker.css("left", `${markerPercent}%`);
            $row.Track.attr("aria-valuenow", Math.round(percent));
            $row.Remaining.text(
                remaining > 0
                    ? this.formatDuration(remaining)
                    : "Обработка события"
            );
            $row.MissionRemaining.text(
                missionRemaining === null
                    ? "—"
                    : `${fleet.mission_end_estimated ? "≈ " : ""}${this.formatDuration(missionRemaining)}`
            );
            this.updateFlyingFleetTooltip($row, now);

        });
    }

    startFlyingFleetsTicker() {
        this.clearPageTimeout(this.flyingFleetsTimer);
        this.flyingFleetsTimer = null;

        if (Object.keys(this.flyingFleetRows).length === 0) return;

        const tick = () => {
            this.updateFlyingFleetsClock();
            if (!this.pageActive) return;
            this.flyingFleetsTimer = this.setPageTimeout(tick, 1000);
        };
        tick();
    }

    renderFlyingFleets() {
        if (!this.$FlyingFleets?.length) {
            this.createFlyingFleetsTable();
        }

        const flyingFleets = Object.values(
            this.messageData.data.Page?.FlyingFleets || {}
        ).sort((left, right) =>
            Number(left.end_time) - Number(right.end_time)
            || Number(left.id) - Number(right.id)
        );

        this.$FlyingFleets.List.empty();
        this.$FlyingFleets.Count.text(flyingFleets.length);
        this.flyingFleetRows = {};
        const visibleFleetIds = new Set(flyingFleets.map(fleet => Number(fleet.id)));
        for (const fleetId of this.expandedFlyingFleetCommands) {
            if (!visibleFleetIds.has(fleetId)) {
                this.expandedFlyingFleetCommands.delete(fleetId);
            }
        }

        if (flyingFleets.length === 0) {
            this.$FlyingFleets.List.append(
                $("<div>")
                    .addClass("FleetFlightsEmpty")
                    .text("Нет флотов в полёте")
            );
        } else {
            flyingFleets.forEach(fleet => {
                const $row = this.createFlyingFleetRow(fleet);
                this.flyingFleetRows[fleet.id] = $row;
                this.$FlyingFleets.List.append($row);
            });
        }

        this.startFlyingFleetsTicker();
    }

    calcShipsStats(ships, mapper) {
        let count = 0;
        let types = 0;
        let consumption = 0;
        let capacity = 0;
        let experience = 0;
        const speeds = [];
        $.each(ships, (id, item) => {
            const data = mapper(item);
            if (!data || data.count <= 0) return;

            count += data.count;
            types++;
            speeds.push(data.speed);
            consumption += data.consumption * data.count;
            capacity += data.capacity * data.count;
            experience += data.experience || 0;
        });

        return {
            count,
            types,
            consumption,
            capacity,
            experience,
            speed: speeds.length ? Math.min(...speeds) : 0
        };
    }

    getMaxConstructibleElements(Element, Price) {

        return this.messageData.data.Page?.PlanetShips[Element].count;

    }

    showTaskFleet(event) {
        let FleetId = event?.target ? $(event.target).parent()[0].FleetId : event;
        if (!FleetId) return;

        const Fleet = this.messageData.data.Page?.FleetList[FleetId];
        if (!Fleet) return;

        this.flightControls = null;
        this.lastCoordinates = null;
        ++this.missionDataLoadingVersion;
        this.$missionDataPanel = null;
        this.navigationSystemInfo = null;
        this.expeditionTarget = false;
        this.updateNavigationCoordinateFields = null;
        this.updateMissionSendState = null;
        this.navigationOrdinaryOrbit = Math.max(1, Number(Fleet.current?.orbit) || 1);
        const fleetPosition = Fleet.current?.type === 3
            ? Fleet.current.lastKnownPosition
            : Fleet.current;
        this.navigationFleetSystem = {
            galaxy: Number(fleetPosition?.galaxy),
            system: Number(fleetPosition?.system)
        };
        console.log("Fleet",Fleet);

        const Commands = this.messageData.data.Page?.FleetList[FleetId]?.Commands;


        // Создаем базовую оболочку
        const $panel = $("<div>").addClass("FleetTaskPanel");
        $panel.append(this.createSpan(`🚀 Текущие задания:`), "<br><br>");

        const $sendPanel = this.createDiv("", "sendPanel");

        if (Commands) {


        } else {
            //$panel.append("-= Комманды отсутствуют =-", "<br><br>");


            // === Панель выбора типа цели и ввода координат ===
            const $coordPanel = $("<div>").addClass("box FleetCoordsPanel");
            const target = this.normalizeNavigationTarget(this.target, Fleet);

            // Поля ввода координат

            const $galaxy = this.createSpan("", "GalaxyBlock", "GalaxyBlock");
            $galaxy.append(
                "Галактика",
                this.navigation.$galaxy = this.createInput(
                    'number', 'NavigationGalaxyInput', '', "InputNavigation", () => this.requestNavigationSystemInfo(FleetId), target.galaxy ?? 1,
                    { min: 1, max: () => 1 }));


            const $system = this.createSpan("", "SystemBlock", "SystemBlock");
            $system.append(
                "Система",
                this.navigation.$system = this.createInput(
                    'number', 'NavigationSystemInput', '', "InputNavigation", () => this.requestNavigationSystemInfo(FleetId), target.system ?? 1,
                    { min: 1, max: () => 128 })
            );

            const $orbit = this.createSpan("", "OrbitBlock", "OrbitBlock");
            $orbit.append(
                "Орбита",
                this.navigation.$orbit = this.createInput(
                    'number', 'NavigationOrbitInput', '', "InputNavigation", (event) => this.coordinatesChanged(FleetId, event), target.orbit ?? 1,
                    { min: 1, max: () => Number(this.navigationSystemInfo?.maxOrbit) || 1 })
            );

            /*this.navigation.$expedition = this.createButton(
                "FleetExpeditionTarget",
                "Экспедиция",
                () => this.toggleExpeditionMission(FleetId),
                false,
                "Экспедиционная орбита текущей системы флота",
                "btn btn-sm FleetExpeditionTarget"
            );
            $orbit.append(this.navigation.$expedition);*/

            const $distance = this.createSpan("", "DistanceBlock", "DistanceBlock");
            $distance.append(
                "Расстояние",
                this.navigation.$distance = this.createInput(
                    'number', 'NavigationDistanceInput', '', "InputNavigation", (event) => this.coordinatesChanged(FleetId, event), target.distance ?? 0,
                    { min: 0, max: () => 16000 })
            );

            const $deg = this.createSpan("", "DegBlock", "DegBlock");
            $deg.append(
                "Угол",
                this.navigation.$deg = this.createInput(
                    'number', 'NavigationDegInput', '', "InputNavigation", (event) => this.coordinatesChanged(FleetId, event), target.angle ?? 0,
                    { min: 0, max: () => 359 })
            );

            const $fleetId = this.createSpan("", "FleetTargetBlock", "FleetTargetBlock");
            $fleetId.append(
                "ID флота",
                this.navigation.$fleetId = this.createInput(
                    'number', 'NavigationFleetIdInput', '', "InputNavigation", (event) => this.coordinatesChanged(FleetId, event), target.fleetId ?? 1,
                    { min: 1 })
            );

            // Верхний уровень соответствует Space\CoordinateType: OBJECT / POINT / FLEET.
            this.navigation.$type = $("<icon-selector>").addClass("FleetCoordinateTypeSelector");

            const selector = this.navigation.$type[0];
            selector.setTooltipHandler((button, item) => {
                $(button).ToolTip(item.tooltip, item.tooltipCss);
            });

            selector.items = {
                1: { label: "Объект", value: 1, class: "NavType", imgClass: "FleetCoordinateTypeIcon mdi mdi-orbit", tooltip: "Космический объект" },
                2: { label: "Точка", value: 2, class: "NavType", imgClass: "FleetCoordinateTypeIcon mdi mdi-crosshairs-gps", tooltip: "Свободная точка пространства" },
                3: { label: "Флот", value: 3, class: "NavType", imgClass: "FleetCoordinateTypeIcon mdi mdi-rocket-launch", tooltip: "Другой флот" }
            };
            selector.single = true;
            selector.vertical = false;
            selector.value = target.type;

            // Для OBJECT отдельно выбирается Space\ObjectType.
            this.navigation.$objectType = $("<icon-selector>").addClass("FleetObjectTypeSelector");
            const objectSelector = this.navigation.$objectType[0];
            objectSelector.setTooltipHandler((button, item) => {
                $(button).ToolTip(item.tooltip, item.tooltipCss);
            });
            objectSelector.items = {
                planet: { label: "Планета", value: 1, class: "NavType", imgClass: "NavTypeImg NavTypePlanet", tooltip: "Планета" },
                moon: { label: "Луна", value: 3, class: "NavType", imgClass: "NavTypeImg NavTypeMoon", tooltip: "Луна" },
                debris: { label: "Обломки", value: 2, class: "NavType", imgClass: "NavTypeImg NavTypeDedris", tooltip: "Поле обломков" }
            };
            objectSelector.single = true;
            objectSelector.vertical = false;
            objectSelector.value = target.objectType ?? null;

            const $objectTypePanel = $("<div>").addClass("FleetObjectTypePanel").append(
                $("<div>").addClass("FleetCoordinateSubTitle").text("Тип объекта:"),
                this.navigation.$objectType
            );
            this.navigation.$objectTypePanel = $objectTypePanel;

            const ownPlanets = this.getOwnPlanetTargets();
            this.navigation.$ownPlanet = $("<select>")
                .addClass("FleetOwnPlanetSelect")
                .append($("<option>", {
                    value: "",
                    text: "— выбрать планету —"
                }));
            for (const planet of ownPlanets) {
                const isCurrent = Number(planet.id)
                    === Number(this.messageData.data?.PlanetList?.current_planet);
                this.navigation.$ownPlanet.append($("<option>", {
                    value: String(planet.id),
                    text: `${planet.name} [${planet.galaxy}:${planet.system}:${planet.planet}]${isCurrent ? " · текущая" : ""}`
                }));
            }
            this.navigation.$ownPlanet.on("change", () => {
                const planetId = Number(this.navigation.$ownPlanet.val());
                const planet = ownPlanets.find(item => Number(item.id) === planetId);
                this.selectOwnPlanetTarget(planet, FleetId);
            });

            const $ownPlanetPanel = $("<label>").addClass("FleetOwnPlanetPanel").append(
                $("<span>").text("Своя планета:"),
                this.navigation.$ownPlanet
            );
            this.navigation.$ownPlanetPanel = $ownPlanetPanel;

            const toggleCoordinateFields = (type) => {
                const isObject = type === 1;
                const isPoint = type === 2;
                const isFleet = type === 3;

                $objectTypePanel.toggle(isObject && !this.expeditionTarget);
                $galaxy.toggle(isObject || isPoint);
                $system.toggle(isObject || isPoint);
                $orbit.toggle(isObject);
                $distance.toggle(isPoint);
                $deg.toggle(isPoint);
                $fleetId.toggle(isFleet);

                this.navigation.$galaxy.prop("disabled", isObject && this.expeditionTarget);
                this.navigation.$system.prop("disabled", isObject && this.expeditionTarget);
                this.navigation.$orbit.prop("disabled", !isObject || this.expeditionTarget);
            };
            this.updateNavigationCoordinateFields = toggleCoordinateFields;

            selector.addEventListener("change", e => {
                const type = Number(e.detail.value);
                if (type !== 1) {
                    this.expeditionTarget = false;
                    this.clearMissionSelection();
                }
                toggleCoordinateFields(type);
                if (type === 1) {
                    this.requestNavigationSystemInfo(FleetId, true);
                } else {
                    this.coordinatesChanged(FleetId);
                }
            });
            objectSelector.addEventListener("change", () => {
                this.expeditionTarget = false;
                this.clearMissionSelection();
                toggleCoordinateFields(Number(selector.value));
                this.coordinatesChanged(FleetId);
            });
            toggleCoordinateFields(Number(selector.value));
            this.syncOwnPlanetSelection(target);

            // --- Сборка панели ---
            $coordPanel.append(
                $("<div>").text("Координаты назначения:"),
                this.navigation.$type,
                $ownPlanetPanel,
                $objectTypePanel,
                $galaxy, $system, $orbit,
                $distance, $deg, $fleetId
            );




            const $MissionPanel = $("<div>").addClass("box FleetMissionPanel");


            // === Выбор миссии через icon-selector ===
            const $missionSelector = $("<icon-selector>");
            const missionSelector = $missionSelector[0];
            this.missionSelector = missionSelector;
            this.missionSelectorFleetId = FleetId;

            // Подключаем tooltip
            missionSelector.setTooltipHandler((button, item) => {
                $(button).ToolTip(item.tooltip, item.tooltipCss);
            });

            // Готовим список миссий, доступных для выбранного флота и цели.
            const allFleetMissions = this.messageData.data.Page?.FleetMissions;
            const availableMissionIds = this.messageData.data.Page?.AvailableMissions?.missions;
            missionSelector.items = this.buildMissionItems(
                allFleetMissions,
                availableMissionIds
            );

            missionSelector.single = true;
            missionSelector.vertical = false;
            missionSelector.deselectable = true;

            // Текущее выбранное задание
            this.selectedMission = null;

            missionSelector.addEventListener("change", e => {
                const changedMissionId = Number(e.detail.changedValue);
                if (changedMissionId === this.getExpeditionMissionId()) {
                    this.toggleExpeditionMission(FleetId);
                    return;
                }

                const missionId = Number(e.detail.value);
                this.selectedMission = missionId > 0 ? missionId : null;
                this.updateMissionSendState?.();
                this.coordinatesChanged(FleetId, null, true);
            });

            //const $commandsList = $("<div>").addClass("FleetCommandsList");
            //const $addCmdBtn = this.createButton("AddCmd", "Добавить команду", () => addCommandRow());
            const $sendBtn = this.createButton(
                "SendCmds",
                "Отправить",
                () => {
                    const payload = this.flightControls?.getPayload?.();
                    const missionType = Number(payload?.missionType);
                    const supportedMission = [
                        this.getTransportMissionId(),
                        this.getRelocateMissionId()
                    ].includes(missionType);
                    if (!payload || !supportedMission) {
                        Dialog.ErrorLoad("Выберите доступную миссию «Транспорт» или «Передислокация».");
                        return;
                    }

                    $sendBtn.prop("disabled", true).val("Отправка...");
                    GameEvents.emit("SendServer", {
                        mode: "fleets",
                        action: "SendMission",
                        NotOverlay: true,
                        data: payload,
                        ...this.getRequestOptions({ kind: "command" }),
                        onSuccess: () => {
                            Dialog.close();
                        },
                        onError: (error) => {
                            $sendBtn.val("Отправить");
                            this.updateMissionSendState?.();
                            Dialog.ErrorLoad(error?.message || "Миссия не принята сервером.");
                        }
                    });
                },
                true,
                "Выберите цель, миссию, топливо и груз"
            );
            //const $clearBtn = this.createButton("ClearCmds", "Очистить", () => $commandsList.empty());

            $MissionPanel.append(
                $("<div>").text("Тип миссии:"),
                $missionSelector,

                //$addCmdBtn,
                //$clearBtn
            );

            //$sendPanel.append($coordPanel);

            // Инфо Поле

            const $infoPanel = $("<div>").addClass("box FleetInfoPanel");

            const infoMap = {
                coords: "Coords",
                distance: "Distance",
                duration: "Duration",
                fuel: "Fuel",
                storage: "Storage",
                maxspeed: "MaxSpeed"
            };

            const infos = {};
            Object.entries(infoMap).forEach(([key, suffix]) => {
                infos[key] = this.createSpan("-", `FleetInfo${suffix}`, "FleetInfo");
            });

            this.fleetInfo = infos;
            infos.storage.text(humanNumber(Fleet.capacity, true, 2));
            infos.maxspeed.text(humanNumber(Fleet.speed, true, 2));

            const infoLabels = {
                coords: "Координаты цели:",
                distance: "Расстояние:",
                duration: "Время полета:",
                fuel: "Потребление топлива:",
                storage: "Грузоподъемность:",
                maxspeed: "Максимальная скорость:"
            };

            Object.entries(infoLabels).forEach(([key, label]) => {
                $infoPanel.append(
                    this.createSpan(label, null, "FleetInfoLabel"),
                    infos[key]
                );
            });

            // Скорость и топливо используют серверный расчёт TravelInfo.
            const $flightSettingsPanel = $("<div>").addClass("box FleetFlightSettingsPanel");
            const $speedValue = this.createSpan("100%", "FleetSpeedValue", "FleetRangeValue");
            const $speedRange = $("<input>", {
                type: "range",
                id: "FleetSpeedRange",
                class: "FleetRangeInput",
                min: 10,
                max: 100,
                step: 10,
                value: 100
            });

            const $fuelValue = this.createSpan("-", "FleetFuelValue", "FleetRangeValue");
            const $fuelRange = $("<input>", {
                type: "range",
                id: "FleetFuelRange",
                class: "FleetRangeInput",
                min: 0,
                max: 0,
                step: 1,
                value: 0,
                disabled: true
            });
            const updateRangeVisual = ($range) => {
                const min = Number($range.attr("min"));
                const max = Number($range.attr("max"));
                const value = Number($range.val());
                const progress = max > min
                    ? Math.max(0, Math.min(100, (value - min) / (max - min) * 100))
                    : 0;

                $range[0].style.setProperty("--fleet-range-progress", `${progress}%`);
            };

            updateRangeVisual($speedRange);
            updateRangeVisual($fuelRange);

            $flightSettingsPanel.append(
                $("<div>").addClass("FleetRangeHeader").append(
                    this.createSpan("Скорость:", null, "FleetInfoLabel"),
                    $speedValue
                ),
                $speedRange,
                $("<div>").addClass("FleetRangeHeader FleetFuelHeader").append(
                    this.createSpan("Топливо:", null, "FleetInfoLabel"),
                    $fuelValue
                ),
                $fuelRange
            );



            // Поля ввода ресурсов

            const $resourcesPanel = $("<div>").addClass("box FleetResourcesPanel");
            const $resourcesTitle = this.createDiv("Ресурсы:", null, "FleetResourcesTitle");
            const $resourcesGrid = $("<div>").addClass("FleetResourcesGrid");
            const $resourcesFooter = $("<div>").addClass("FleetResourcesFooter");

            const resourceIds = [901, 902, 903]
                .filter((resId) => Data.Resources?.[resId] !== undefined);

            const resourceInputs = {};
            const fleetCapacity = Math.max(0, Math.floor(Number(Fleet.capacity) || 0));
            const existingCargo = Math.max(0, Math.floor(
                Object.values(Fleet.resources || {}).reduce(
                    (sum, resource) => sum + (Number(resource?.count) || 0),
                    0
                )
            ));
            const existingFuel = Math.max(0, Math.floor(Number(Fleet.fuel) || 0));
            const parseNumber = (value) => Math.max(0, Math.floor(Number(value) || 0));
            let travelInfo = null;
            let fuelTouched = false;

            const $remainingResources = this.createSpan("-", "FleetRemainingResources", "FleetRemainingValue");
            const $loadStatus = $("<div>").addClass("FleetLoadStatus").hide();

            const getFuel = () => parseNumber($fuelRange.val());
            const getPlanetResource = (resId) => parseNumber(Data.Resources?.[resId]?.count);
            const getAvailableResource = (resId) => {
                const planetAmount = getPlanetResource(resId);
                return resId === 903
                    ? Math.max(0, planetAmount - getFuel())
                    : planetAmount;
            };
            const getCargoLimit = () => Math.max(
                0,
                fleetCapacity - existingCargo - existingFuel - getFuel()
            );
            const getLoadedResources = () => Object.values(resourceInputs)
                .reduce((sum, $input) => sum + parseNumber($input.val()), 0);

            const getLoadError = () => {
                const fuel = getFuel();
                const cargoBeforeFuel = Math.max(0, fleetCapacity - existingCargo - existingFuel);
                const planetDeuterium = getPlanetResource(903);
                const minimumFuel = Math.max(
                    0,
                    Math.ceil(Number(travelInfo?.fuel?.min) || 0)
                );
                const maximumFuel = Math.max(
                    0,
                    Math.ceil(Number(travelInfo?.fuel?.max) || 0)
                );

                if (!travelInfo) {
                    return "Ожидание расчёта полёта";
                }
                if (existingFuel + fuel < minimumFuel) {
                    return "Недостаточно топлива для минимальной дальности полёта";
                }
                if (existingFuel + fuel > maximumFuel) {
                    return "Выбрано больше расчётного максимума топлива";
                }
                if (fuel > cargoBeforeFuel) {
                    return "Для выбранного топлива недостаточно грузоподъёмности";
                }
                if (fuel > planetDeuterium) {
                    return "На планете недостаточно дейтерия для топлива";
                }

                return "";
            };

            const setLoadStatus = () => {
                const message = getLoadError();

                $loadStatus.text(message).toggle(Boolean(message));
            };

            const updateResourceLimits = (changedResourceId = null) => {
                const cargoLimit = getCargoLimit();

                if (changedResourceId !== null && resourceInputs[changedResourceId]) {
                    const usedByOthers = resourceIds.reduce((sum, resId) => {
                        return resId === changedResourceId
                            ? sum
                            : sum + parseNumber(resourceInputs[resId].val());
                    }, 0);
                    const maxForChanged = Math.min(
                        getAvailableResource(changedResourceId),
                        Math.max(0, cargoLimit - usedByOthers)
                    );
                    resourceInputs[changedResourceId].val(Math.min(
                        parseNumber(resourceInputs[changedResourceId].val()),
                        maxForChanged
                    ));
                }

                let overflow = Math.max(0, getLoadedResources() - cargoLimit);
                [...resourceIds].reverse().forEach((resId) => {
                    const $input = resourceInputs[resId];
                    let value = Math.min(parseNumber($input.val()), getAvailableResource(resId));
                    if (overflow > 0) {
                        const reduction = Math.min(value, overflow);
                        value -= reduction;
                        overflow -= reduction;
                    }
                    $input.val(value);
                });

                const loaded = getLoadedResources();
                resourceIds.forEach((resId) => {
                    const usedByOthers = loaded - parseNumber(resourceInputs[resId].val());
                    const maxValue = Math.min(
                        getAvailableResource(resId),
                        Math.max(0, cargoLimit - usedByOthers)
                    );
                    resourceInputs[resId].attr("max", maxValue);
                });

                const remain = Math.max(cargoLimit - loaded, 0);
                $remainingResources.text(humanNumber(remain, true, 2));
                setLoadStatus();
                this.updateMissionSendState?.();
            };

            resourceIds.forEach((resId) => {
                const $label = this.createSpan(`${Lang.tech?.[resId] || `Ресурс ${resId}`}:`, null, "FleetResLabel");
                const $controls = $("<div>").addClass("FleetResControls");

                const $input = $("<input>", {
                    type: "number",
                    id: `ResInput${resId}`,
                    class: "InputResources FleetResInput",
                    min: 0,
                    step: 1,
                    value: 0
                }).on("input.form change.form", () => updateResourceLimits(resId));

                const $setZeroBtn = $("<button>", {
                    type: "button",
                    class: "btn-box btn-box-left FleetResBtn",
                    title: "Очистить ресурс"
                }).on("click", () => {
                    $input.val(0).trigger("input");
                });

                const $setMaxBtn = $("<button>", {
                    type: "button",
                    class: "btn-box btn-box-right FleetResBtn",
                    title: "Заполнить максимум"
                }).on("click", () => {
                    const usedByOthers = resourceIds.reduce((sum, otherResId) => {
                        return otherResId === resId
                            ? sum
                            : sum + parseNumber(resourceInputs[otherResId]?.val());
                    }, 0);
                    const maxValue = Math.min(
                        getAvailableResource(resId),
                        Math.max(0, getCargoLimit() - usedByOthers)
                    );
                    $input.val(maxValue).trigger("input");
                });

                resourceInputs[resId] = $input;

                $controls.append($setZeroBtn, $input, $setMaxBtn);
                $resourcesGrid.append($label, $controls);
            });

            const $remainingWrap = $("<div>").addClass("FleetRemainingWrap").append(
                this.createSpan("Остаток:", null, "FleetResLabel"),
                $remainingResources
            );

            const $fillAllBtn = this.createButton(
                "all_resources",
                "Все ресурсы",
                () => {
                    resourceIds.forEach((resId) => resourceInputs[resId].val(0));
                    let remaining = getCargoLimit();
                    resourceIds.forEach((resId) => {
                        const value = Math.min(getAvailableResource(resId), remaining);
                        resourceInputs[resId].val(value);
                        remaining -= value;
                    });
                    updateResourceLimits();
                },
                false,
                null,
                "btn btn-sm FleetAllResBtn"
            );

            $resourcesFooter.append($remainingWrap, $fillAllBtn);
            $resourcesPanel.append($resourcesTitle, $resourcesGrid, $resourcesFooter, $loadStatus);

            $speedRange.on("input.form", () => {
                $speedValue.text(`${parseNumber($speedRange.val())}%`);
                updateRangeVisual($speedRange);
            }).on("change.form", () => {
                this.coordinatesChanged(FleetId, null, true);
            });

            $fuelRange.on("input.form change.form", () => {
                fuelTouched = true;
                $fuelValue.text(humanNumber(getFuel(), true, 2));
                updateRangeVisual($fuelRange);
                updateResourceLimits();
            });

            this.updateMissionSendState = () => {
                const transportMissionId = this.getTransportMissionId();
                const relocateMissionId = this.getRelocateMissionId();
                const selectedMissionId = Number(this.selectedMission);
                const isTransport = selectedMissionId === transportMissionId;
                const isRelocation = selectedMissionId === relocateMissionId;
                const hasRequiredCargo = !isTransport || getLoadedResources() > 0;
                const canSend = (isTransport || isRelocation)
                    && travelInfo !== null
                    && getLoadError() === ""
                    && hasRequiredCargo;

                $sendBtn
                    .prop("disabled", !canSend)
                    .attr("title", canSend
                        ? (isRelocation ? "Передислоцировать флот" : "Отправить транспортную миссию")
                        : "Выберите миссию, цель и достаточное количество топлива; для транспорта добавьте груз");
            };

            this.flightControls = {
                getSpeedFactor: () => parseNumber($speedRange.val()) / 10,
                applyTravelInfo: (newTravelInfo) => {
                    travelInfo = newTravelInfo || null;
                    if (!travelInfo?.fuel) {
                        $fuelRange.prop("disabled", true).attr({ min: 0, max: 0 }).val(0);
                        $fuelValue.text("-");
                        updateRangeVisual($fuelRange);
                        updateResourceLimits();
                        return;
                    }

                    const calculatedFuelMin = Math.max(
                        0,
                        Math.ceil(Number(travelInfo.fuel.min) || 0) - existingFuel
                    );
                    const calculatedFuelMax = Math.max(
                        0,
                        Math.ceil(Number(travelInfo.fuel.max) || 0) - existingFuel
                    );
                    const fuelMin = calculatedFuelMin;
                    const fuelMax = Math.max(0, Math.min(
                        calculatedFuelMax,
                        fleetCapacity - existingCargo - existingFuel,
                        getPlanetResource(903)
                    ));
                    const previousFuel = getFuel();
                    const selectedFuel = fuelMax < fuelMin
                        ? fuelMax
                        : (fuelTouched
                            ? Math.max(fuelMin, Math.min(previousFuel, fuelMax))
                            : fuelMax);

                    $fuelRange
                        .prop("disabled", fuelMax < fuelMin)
                        .attr({ min: Math.min(fuelMin, fuelMax), max: fuelMax })
                        .val(selectedFuel);
                    $fuelValue.text(humanNumber(selectedFuel, true, 2));
                    updateRangeVisual($fuelRange);
                    updateResourceLimits();
                },
                getPayload: () => ({
                    fleetId: FleetId,
                    coordinates: this.getNavigationCoordinates(),
                    missionType: this.selectedMission,
                    speedFactor: parseNumber($speedRange.val()) / 10,
                    fuel: getFuel(),
                    resources: Object.fromEntries(
                        resourceIds.map((resId) => [resId, parseNumber(resourceInputs[resId].val())])
                    )
                })
            };

            const $missionDataPanel = $("<div>").addClass("FleetMissionDataPanel").append(
                $MissionPanel,
                $infoPanel,
                $flightSettingsPanel,
                $resourcesPanel,
                $sendBtn
            );
            this.$missionDataPanel = $missionDataPanel;

            $sendPanel.append(
                $coordPanel,
                $missionDataPanel
            );

            $panel.append($sendPanel);

            updateResourceLimits();
            this.requestNavigationSystemInfo(FleetId, true);
        }




        Dialog.create($panel, `🚀 Управление флотом #${FleetId}`, [
            { text: Lang.Close, action: () => Dialog.close(), class: ["btn-warning"] }
        ], {
            width: 420,
            overlay: true,
            drag: true,
            position: { my: 'center bottom', at: 'center center', of: "#Planet" }
        });

        // Загружаем список миссий с сервера
        /*GameEvents.emit("SendServer", {
            mode: "fleets",
            action: "GetMissions",
            data: {},
            onSuccess: (res) => {

            }
        });*/

        // Загружаем текущие команды флота
        /* GameEvents.emit("SendServer", {
             mode: "fleets",
             action: "GetFleetCommands",
             data: { fleet_id: FleetId },
             onSuccess: (res) => {
                 res.forEach(c => addCommandRow(c.type, c.params));
             }
         });*/

        function addCommandRow(type = null, params = {}) {
            const $row = $("<div>").addClass("FleetCmdRow");

            const $cmdSelect = $("<select>").addClass("CmdSelect");
            for (const t in Lang.fleet_command) {
                const $opt = $("<option>").val(t).text(Lang.fleet_command[t]);
                if (t == type) $opt.attr("selected", true);
                $cmdSelect.append($opt);
            }

            const $paramInput = $("<input>")
                .addClass("CmdParams")
                .attr("placeholder", "params (JSON)")
                .val(JSON.stringify(params));

            const $del = $("<button>")
                .addClass("btn btn-danger btn-xs")
                .text("✖")
                .on("click", () => $row.remove());

            $row.append($cmdSelect, $paramInput, $del);
            $commandsList.append($row);
        }

        function sendFleetCommands() {
            const commands = [];
            $commandsList.find(".FleetCmdRow").each(function () {
                const type = $(this).find(".CmdSelect").val();
                let params = {};
                try {
                    params = JSON.parse($(this).find(".CmdParams").val());
                } catch (e) { console.warn("Bad JSON", e); }
                commands.push({ type: parseInt(type), params });
            });

            GameEvents.emit("SendServer", {
                mode: "fleets",
                action: "SetFleetCommands",
                data: {
                    fleet_id: FleetId,
                    start_time: Date.now() / 1000,
                    commands
                },
                ...this.getRequestOptions({ kind: "command" }),
                onSuccess: () => {
                    Dialog.close();
                    Overlay.Show(Lang.fleets.CommandsSaved, 1000);
                },
                onError: (error) => {
                    Overlay.Hide();
                    Dialog.ErrorLoad(error?.message || "Команда не выполнена.");
                }
            });
        }
    }


    DisbandFleet(event) {
        let FleetId;

        // Если передан объект события
        if (event && event.target) {
            FleetId = $(event.target).parent()[0].FleetId;
        } else {
            // Если передан просто id
            FleetId = event;
        }

        if (!FleetId) return;

        const Fleet = this.messageData.data.Page?.FleetList[FleetId];


        const content = this.createSpan("Расформирование флота ");
        content.append(this.createSpan(`Флот #${Fleet.id}`), "<br><br>");
        content.append(
            this.createDiv("Если флот будет расформирован, потеряется весь прогресс"),
            "<br>"
        );

        Dialog.create(content, Lang.overview.PlanetMenu,
            [
                { text: Lang.Close, action: () => Dialog.close(), class: ["btn-warning"] }
            ],
            {
                width: 360,
                overlay: true,
                drag: true,
                position: { my: 'center bottom', at: 'center center', of: "#Planet" }
            });
    }

    createFleetMoreDetails(FleetId) {
        console.log("createFleetMoreDetails");

        this.$FleetMoreDetails = $(".FleetMoreDetails");

        if (this.$FleetMoreDetails.length === 0) {
            this.$FleetMoreDetails = $("<div>").addClass("box FleetMoreDetails");
        }

        this.$FleetMoreDetails.Ships = {};
        const FleetShips = this.messageData.data.Page?.FleetList[FleetId].ships;


        /*$.each(FleetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createFleetShip(id, ship);
            }
        });*/

        this.$FleetMoreDetails.hide();
        /*this.$Content.append(this.$ShipsBlock);*/
        //console.log(this.$FleetMoreDetails);
    }

    createFleetShip(id, ship) {
        console.log("createFleetShip");

        this.$FleetMoreDetails.Ships[id] = $("#fleetsDetails" + id);

        if (this.$FleetMoreDetails.Ships[id].length === 0) {
            this.$FleetMoreDetails.Ships[id] = $("<game-build>");
            this.$FleetMoreDetails.Ships[id][0].images = (id > 400) ? "defenses" : "fleets";
            this.$FleetMoreDetails.Ships[id][0].type = 'fleetsDetails';
            this.$FleetMoreDetails.Ships[id][0].FleetId = this.LastFleetId;
            //this.$FleetMoreDetails.Ships[id][0].OnInput = () => this.renderNewFleetBlock();
            this.$FleetMoreDetails.Ships[id][0].data = ship;
            this.$FleetMoreDetails.append(this.$FleetMoreDetails.Ships[id]);
        } else {
            this.$FleetMoreDetails.Ships[id][0].FleetId = this.LastFleetId;
            this.$FleetMoreDetails.Ships[id][0].data = ship;
        }

        const self = this;


        this.$FleetMoreDetails.Ships[id].draggable({
            helper: "clone",
            revert: 'invalid',
            delay: this.draggableDelay,
            axis: null, opacity: 0.8,
            cursorAt: { top: 50, left: 50 },
            containment: "#Content"
        }).off("mousedown.cursor touchstart.cursor").on("mousedown.cursor touchstart.cursor", function () {
            const $this = $(this);
            $this.data("holdTimer", setTimeout(() => {
                $this.css("cursor", "grabbing"); // показать "готов к движению" по истечении задержки
            }, self.draggableDelay)); // совпадает с delay
        }).off("mouseup.cursor mouseleave.cursor touchend.cursor touchcancel.cursor").on("mouseup.cursor mouseleave.cursor touchend.cursor touchcancel.cursor", function () {
            const $this = $(this);
            clearTimeout($this.data("holdTimer"));
            $this.css("cursor", "grab"); // вернуть нормальный курсор
        });;

    }

    renderFleetMoreDetails(Fleet) {

        let FleetId;

        // Если передан объект события
        if (Fleet && Fleet.target) {
            FleetId = $(Fleet.target).parent()[0].FleetId;
        } else {
            // Если передан просто id
            FleetId = Fleet;
        }

        if (!FleetId) return;

        if (!this.$FleetMoreDetails)
            this.createFleetMoreDetails(FleetId);

        if (this.LastFleetId !== FleetId) {
            this.$FleetMoreDetails.hide(100, () => {
                this.LastFleetId = FleetId;

                this.renderFleetMoreDetailsShips(FleetId);

                this.$FleetMoreDetails.show(100);
            });
        } else this.renderFleetMoreDetailsShips(FleetId);
    }

    renderFleetMoreDetailsShips(FleetId) {

        if (!this.$FleetMoreDetails)
            this.createFleetMoreDetails(FleetId);

        if (!this.$Fleets[FleetId]) return;

        this.$Fleets[FleetId].append(this.$FleetMoreDetails);

        const FleetShips = this.messageData.data.Page?.FleetList[FleetId].ships;

        $.each(FleetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createFleetShip(id, ship);
            } else if (ship.count > 0) {
                this.$FleetMoreDetails.Ships[id][0].data = ship;
            }
        });

        // Удаляем исчезнувшие
        for (const id in this.$FleetMoreDetails.Ships) {
            if ((!FleetShips[id] || FleetShips[id].count <= 0) && this.$FleetMoreDetails.Ships[id].length > 0) {
                //this.$Ships[id].fadeOut(250, () => {
                this.$FleetMoreDetails.Ships[id].remove();
                delete this.$FleetMoreDetails.Ships[id];
                //});
            }
        }

        const shipsArray = Object.entries(this.$FleetMoreDetails.Ships);
        shipsArray.sort((a, b) => a[0] - b[0]);

        let last = null;
        shipsArray.forEach(([id, $ship]) => {
            if (last === null) {
                this.$FleetMoreDetails.prepend($ship);
            } else {
                last.after($ship);
            }
            last = $ship;
        });

    }

    createNewFleet() {
        let items = {};
        $.each(this.$Ships, (id, Ship) => {
            if (Ship[0]?.Input) {
                const count = Ship[0].Input.val();
                if (count > 0) items[id] = count;
            }
        });

        GameEvents.emit("SendServer", {
            mode: Data.mode,
            action: "toOrbit",
            hide: "ActualData",
            data: { 'items': items }
        });

        this.clearSelectElements();
    }

    clearSelectElements() {
        $.each(this.$Ships, (id, Ship) => {
            Ship[0].Input.val(0);
        });

        this.renderNewFleetBlock();
    }

    moveShip(toFleetId, fromFleetId, shipId, count) {
        const FleetList = this.messageData.data.Page?.FleetList;
        const PlanetShips = this.messageData.data.Page?.PlanetShips;

        let fromFleet, fromShip, isPlanetSource = false;

        // 🌍 Источник — планета
        if (!fromFleetId || fromFleetId === 0) {
            isPlanetSource = true;
            fromFleet = PlanetShips;
            fromShip = fromFleet[shipId];
        } else {
            fromFleet = FleetList[fromFleetId];
            fromShip = fromFleet?.ships?.[shipId];
        }

        if (!fromShip) return;

        // 🧮 Корректируем количество
        if (count > fromShip.count) count = fromShip.count;


        GameEvents.emit("FleetAction", {
            action: "MoveShip",
            fromFleetId: fromFleetId,
            toFleetId: toFleetId,
            shipId: shipId,
            count: count,
        });

        // 🔄 Обновляем интерфейс
        this.renderFleetsPlanet();
        this.renderShips();

    }

    createFleetsPlanet() {
        this.$FleetsPlanet = $("<div>").addClass("box FleetsPlanet");
        this.$FleetsPlanet.BlockTitle = $("<div>").addClass("box FleetsPlanet BlockTitle").text("Флотов у планеты ");
        this.$FleetsPlanet.BlockTitle.Count = $("<span>");
        this.$FleetsPlanet.BlockTitle.Max = $("<span>");
        this.$FleetsPlanet.BlockTitle.append(
            this.$FleetsPlanet.BlockTitle.Count,
            " из ",
            this.$FleetsPlanet.BlockTitle.Max
        );

        this.$FleetsPlanet.append(this.$FleetsPlanet.BlockTitle);

        const FleetList = this.messageData.data.Page?.FleetList;


        this.$Fleets = {};
        $.each(FleetList, (id, fleet) => {
            this.$Fleets[id] = this.createInfoFleet();
            this.$Fleets[id][0].FleetId = parseInt(id);
            this.$Fleets[id].droppable({
                drop: (event, ui) => this.dropShip(event, ui)
            });
            this.$FleetsPlanet.append(this.$Fleets[id]);
        });


        this.$Content.append(this.$FleetsPlanet);
    }

    renderFleetsPlanet() {

        const FleetList = this.messageData.data.Page?.FleetList;
        if (!FleetList) return;

        if (!this.$FleetsPlanet)
            this.createFleetsPlanet();

        const fleetIds = Object.keys(FleetList);
        this.$FleetsPlanet.BlockTitle.Count.text(fleetIds.length);
        this.$FleetsPlanet.BlockTitle.Max.text(10);

        $.each(FleetList, (fid, fleet) => {

            if (!this.$Fleets[fid] || this.$Fleets[fid].length === 0) {
                this.$Fleets[fid] = this.createInfoFleet();
                this.$Fleets[fid][0].FleetId = parseInt(fid);
                this.$Fleets[fid].droppable({
                    drop: (event, ui) => this.dropShip(event, ui)
                });
                this.$FleetsPlanet.append(this.$Fleets[fid]);
            }
            //this.$Fleets[fid] = $fleet;
            const $fleet = this.$Fleets[fid];

            const { count, types, consumption, capacity, experience, speed } = this.calcShipsStats(fleet.ships, Ship => ({
                count: Ship.count,
                speed: Ship.speed,
                consumption: Ship.consumption,
                capacity: Ship.capacity,
                experience: Ship.experience
            }));

            let Cargo = 0;
            let ResourcesTable = this.createDiv("", null, "CargoTable");
            //const Resources = {};
            $.each(fleet.resources, (res, resource) => {
                //Resources[resource.id] = resource.count;
                if (resource.count > 0) {
                    Cargo += resource.count;
                    const Res = this.createDiv(humanNumber(resource.count, true, 4), "Res_" + res, `ResBox icon${res}`);
                    ResourcesTable.append(Res);
                }
            });

            // Название и данные
            $fleet.Name.text(`Флот #${fleet.id}`);
            $fleet.ShipsCount.text(humanNumber(count, true, 2));
            $fleet.ShipsTypes.text(types);
            $fleet.ShipsSpeed.text(humanNumber(speed, true, 2));
            $fleet.ShipsCapacity.text(humanNumber(capacity, true, 2));
            $fleet.ShipsСonsumption.text(humanNumber(consumption, true, 2));
            $fleet.ShipsExperience.text(humanNumber(experience, true, 2));
            $fleet.ShipsFuel.text(humanNumber(fleet.fuel, true, 2));
            $fleet.ShipsCargo.text(humanNumber(Cargo, true, 2)).ToolTip(ResourcesTable, { 'max-width': '300px' });
            $fleet.Buttons.MoreDetails[0].FleetId = fleet.id;
            $fleet.Buttons[0].FleetId = fleet.id;

        });

        // Удаляем исчезнувшие
        for (const id in this.$Fleets) {
            if ((!FleetList[id] || FleetList[id].count <= 0) && this.$Fleets[id].length > 0) {
                //this.$Ships[id].fadeOut(250, () => {
                this.$Fleets[id].remove();
                delete this.$Fleets[id];
                //});
            }
        }

        this.renderFleetMoreDetails(this.LastFleetId);
    }

    renderFleets() {
        if (!this.$Fleets) this.$Fleets = {};
    }

    dropShip(event, ui) {
        const FleetList = this.messageData.data.Page?.FleetList;
        const PlanetShips = this.messageData.data.Page?.PlanetShips;

        const shipId = ui.draggable[0]._data.id;
        const toFleetId = event.target.FleetId;
        const fromFleetId = ui.draggable[0].FleetId;
        if (toFleetId == fromFleetId) {
            ui.draggable.draggable("option", "revert", true);
            return false;
        } else {
            // Если флот тот же — выключаем revert
            ui.draggable.draggable("option", "revert", false);
        }

        const content = this.createSpan("Перемещение корабля ");
        content.append(this.createSpan(Lang.tech[shipId]), "<br><br>");

        let fromFleet, fromShip, isPlanetSource = false;

        // 🌍 Источник — планета
        if (!fromFleetId || fromFleetId === 0) {
            isPlanetSource = true;
            fromFleet = PlanetShips;
            fromShip = fromFleet[shipId];
        } else {
            fromFleet = FleetList[fromFleetId];
            fromShip = fromFleet?.ships?.[shipId];

            if (fromFleet.types < 2) {
                content.append(
                    this.createDiv("Если флот останется без кораблей он будет расформирован и потеряет весь прогресс"),
                    "<br>"
                );
            }

        }

        const MoveForm = this.createDiv("", "MoveForm");
        const MoveInput = Page.createInput('number', 'MoveCount', null, "btn-box btn-input", null, fromShip.count, {
            min: 0,
            max: fromShip.count
        });
        MoveForm.append(MoveInput);
        content.append(MoveForm);

        Dialog.create(content, Lang.overview.PlanetMenu,
            [
                {
                    text: '25%', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(fromShip.count / 4))
                        Dialog.close();
                    }
                },
                {
                    text: '50%', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(fromShip.count / 2))
                        Dialog.close();
                    }
                },
                {
                    text: '75%', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(fromShip.count / 4 * 3))
                        Dialog.close();
                    }
                },
                {
                    text: '100%', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(fromShip.count))
                        Dialog.close();
                    }
                },
                {
                    text: 'Перести', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(MoveInput.val()))
                        Dialog.close();
                    }
                },
                { text: Lang.Cancel, action: () => Dialog.close(), class: ["btn-warning"] }
            ],
            {
                width: 360,
                overlay: true,
                drag: true,
                position: { my: 'center bottom', at: 'center center', of: "#Planet" }
            });

        console.log('toFleetId', toFleetId, 'fromFleetId', fromFleetId, event, ui);
    }

    createShips() {
        const PlanetShips = this.messageData.data.Page?.PlanetShips;
        if (!PlanetShips) return;

        this.$ShipsBlock = $("<div>").addClass("box ShipsBlock");
        this.$ShipsPlanet = $("<div>").addClass("box ShipsPlanet");
        this.$ShipsPlanet[0].FleetId = 0

        this.$ShipsPlanet.droppable({
            drop: (event, ui) => this.dropShip(event, ui)
        });

        this.$Ships = {};
        $.each(PlanetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createShip(id, ship);
            }
        });

        this.$ShipsBlock.append(this.$ShipsPlanet);
        this.$Content.append(this.$ShipsBlock);
    }

    createShip(id, ship) {
        this.$Ships[id] = $("#fleets" + id);

        if (this.$Ships[id].length === 0) {
            this.$Ships[id] = $("<game-build>");
            this.$Ships[id][0].images = (id > 400) ? "defenses" : "fleets";
            this.$Ships[id][0].type = 'fleets';
            this.$Ships[id][0].FleetId = 0;
            this.$Ships[id][0].OnInput = () => this.renderNewFleetBlock();
            this.$Ships[id][0].data = ship;
            this.$ShipsPlanet.append(this.$Ships[id]);
        } else {
            this.$Ships[id][0].data = ship;
        }

        const self = this;

        this.$Ships[id].draggable({
            handle: ".head, .image",
            cancel: ".btn-box, input",
            helper: "clone",
            revert: 'invalid',
            delay: this.draggableDelay,
            axis: null, opacity: 0.8,
            cursorAt: { top: 50, left: 50 },
            containment: "#Content"
        }).off("mousedown.cursor touchstart.cursor").on("mousedown.cursor touchstart.cursor", function () {
            const $this = $(this);
            $this.data("holdTimer", setTimeout(() => {
                $this.css("cursor", "grabbing"); // показать "готов к движению" по истечении задержки
            }, self.draggableDelay)); // совпадает с delay
        }).off("mouseup.cursor mouseleave.cursor touchend.cursor touchcancel.cursor").on("mouseup.cursor mouseleave.cursor touchend.cursor touchcancel.cursor", function () {
            const $this = $(this);
            clearTimeout($this.data("holdTimer"));
            $this.css("cursor", "grab"); // вернуть нормальный курсор
        });;

        this.$Ships[id].off("click").on("click", ".btn-box-max", (e) => {
            const count = this.getMaxConstructibleElements(id, e.detail.Price);
            this.$Ships[id][0].Input.val(count);
            this.renderNewFleetBlock();

            console.log("Кнопка info нажата для", id);
        });

    }

    createInfoFleet() {

        const $InfoFleet = $("<div>").addClass("box InfoFleet");

        $InfoFleet.Name = $("<div>").addClass("Name");

        $InfoFleet.ShipsCount = $("<span>").addClass("ShipsCount");
        $InfoFleet.ShipsTypes = $("<span>").addClass("ShipsTypes");
        $InfoFleet.ShipsSpeed = $("<span>").addClass("ShipsSpeed");
        $InfoFleet.ShipsCapacity = $("<span>").addClass("ShipsCapacity");
        $InfoFleet.ShipsExperience = $("<span>").addClass("ShipsExperience");
        $InfoFleet.ShipsFuel = $("<span>").addClass("ShipsFuel");
        $InfoFleet.ShipsCargo = $("<span>").addClass("ShipsCargo");
        $InfoFleet.ShipsСonsumption = $("<span>").addClass("ShipsСonsumption");


        $InfoFleet.Buttons = $("<div>").addClass("Buttons");

        $InfoFleet.Buttons.MoreDetails = this.createButton(
            "ButtonsFleet", Lang.fleets.MoreDetails, this.renderFleetMoreDetails.bind(this), false, null, 'btn-info');

        $InfoFleet.Buttons.Task = this.createButton(
            "ButtonsFleet", Lang.fleets.Task, this.showTaskFleet.bind(this), false, null, 'btn-info');

        $InfoFleet.Buttons.Disband = this.createButton(
            "ButtonsFleet", Lang.fleets.Disband, this.DisbandFleet.bind(this), false, null, 'btn-danger');

        $InfoFleet.Buttons.append(
            $InfoFleet.Buttons.MoreDetails,
            $InfoFleet.Buttons.Task,
            $InfoFleet.Buttons.Disband
        );


        $InfoFleet.append(
            $InfoFleet.Name,
            $("<div>").append(Lang.fleets.Count + ": ", $InfoFleet.ShipsCount).addClass("Count"),
            $("<div>").append(Lang.fleets.Types + ": ", $InfoFleet.ShipsTypes).addClass("Types"),
            $("<div>").append(Lang.fleets.Speed + ": ", $InfoFleet.ShipsSpeed).addClass("Speed"),
            $("<div>").append(Lang.fleets.Capacity + ": ", $InfoFleet.ShipsCapacity).addClass("Capacity"),
            $("<div>").append(Lang.fleets.Experience + ": ", $InfoFleet.ShipsExperience).addClass("Experience"),
            $("<div>").append(Lang.fleets.Fuel + ": ", $InfoFleet.ShipsFuel).addClass("Fuel"),
            $("<div>").append(Lang.fleets.Cargo + ": ", $InfoFleet.ShipsCargo).addClass("Cargo"),
            $("<div>").append(Lang.fleets.Сonsumption + ": ", $InfoFleet.ShipsСonsumption).addClass("Сonsumption"),
            $InfoFleet.Buttons
        );

        return $InfoFleet;

    }

    createNewFleetBlock() {

        this.$ShipsBlock.NewFleetBlock = $("<div>").addClass("NewFleetBlock");

        if (!this.$ShipsBlock.InfoFleet) {
            this.$ShipsBlock.InfoFleet = this.createInfoFleet();
            this.$ShipsBlock.NewFleetBlock.append(this.$ShipsBlock.InfoFleet);
        }

        this.$ShipsBlock.NewFleetButtons = $("<div>").addClass("NewFleetButtons");
        this.$ShipsBlock.NewFleetButtons.ToOrbit = this.createButton(
            "ButtonsBuild", Lang.fleets.ToOrbit, this.createNewFleet.bind(this), false, null, 'btn-success');
        this.$ShipsBlock.NewFleetButtons.Clear = this.createButton(
            "ButtonsBuild", Lang.fleets.Clear, this.clearSelectElements.bind(this), false, null, 'btn-warning');
        this.$ShipsBlock.NewFleetButtons.append(this.$ShipsBlock.NewFleetButtons.ToOrbit, this.$ShipsBlock.NewFleetButtons.Clear);

        this.$ShipsBlock.NewFleetBlock.append(this.$ShipsBlock.NewFleetButtons);


        this.$ShipsBlock.append(this.$ShipsBlock.NewFleetBlock);
    }

    renderNewFleetBlock() {
        if (!this.$ShipsBlock.NewFleetBlock) {
            this.createNewFleetBlock();
        }



        const { count, types, consumption, capacity, speed } = this.calcShipsStats(this.$Ships, Ship => {
            const shipsCount = parseInt(Ship[0].Input.val());
            return shipsCount > 0 ? {
                count: shipsCount,
                speed: Ship[0]._data.speed,
                consumption: Ship[0]._data.consumption,
                capacity: Ship[0]._data.capacity
            } : null;
        });

        this.$ShipsBlock.InfoFleet.ShipsCount.text(humanNumber(count, true, 2));
        this.$ShipsBlock.InfoFleet.ShipsTypes.text(humanNumber(types, true, 2));
        this.$ShipsBlock.InfoFleet.ShipsSpeed.text(humanNumber(speed, true, 2));
        this.$ShipsBlock.InfoFleet.ShipsCapacity.text(humanNumber(capacity, true, 2));
        this.$ShipsBlock.InfoFleet.ShipsСonsumption.text(humanNumber(consumption, true, 2));

        this.$ShipsBlock.InfoFleet.Name.hide();
        this.$ShipsBlock.InfoFleet.ShipsExperience.parent().hide();
        this.$ShipsBlock.InfoFleet.ShipsFuel.parent().hide();

        this.$ShipsBlock.InfoFleet.Buttons.hide();

        this.$ShipsBlock.NewFleetButtons.ToOrbit.attr('disabled', count === 0);
        this.$ShipsBlock.NewFleetButtons.Clear.attr('disabled', count === 0);
    }

    renderShips() {
        if (!this.$Ships) this.createShips();

        const PlanetShips = this.messageData.data.Page?.PlanetShips;

        $.each(PlanetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createShip(id, ship);
            } else if (ship.count > 0) {
                this.$Ships[id][0].data = ship;
            }
        });



        // Удаляем исчезнувшие
        for (const id in this.$Ships) {
            if ((!PlanetShips[id] || PlanetShips[id].count <= 0) && this.$Ships[id].length > 0) {
                //this.$Ships[id].fadeOut(250, () => {
                this.$Ships[id].remove();
                delete this.$Ships[id];
                //});
            }
        }

        const shipsArray = Object.entries(this.$Ships);
        shipsArray.sort((a, b) => a[0] - b[0]);

        let last = null;
        shipsArray.forEach(([id, $ship]) => {
            if (last === null) {
                this.$ShipsPlanet.prepend($ship);
            } else {
                last.after($ship);
            }
            last = $ship;
        });

        this.renderNewFleetBlock();



    }

    async render(generation = this.renderGeneration) {
        if (!await super.render(generation)) return;

        console.log("this.messageData", this.messageData);

        const target = this.messageData.data.Page?.Target;
        this.target = this.isNavigationTarget(target) ? target : null;
        this.renderFlyingFleets();
        this.renderFleetsPlanet();
        this.renderShips();
    }
}
