window.FleetsPageClass = class FleetsPageClass extends BasePageClass {

    Name = "FleetsPageClass";

    $Fleets = null;
    $FleetsPlanet = null;
    $FlyingFleets = null;
    flyingFleetRows = {};
    flyingFleetsTimer = null;
    expandedFlyingFleetCommands = new Set();
    fleetTargetPickers = new Set();
    resourceSiteLabels = new Map();
    resourceBaseSections = new Map();

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
        $site: null,
        $sitePanel: null,
        //$expedition: null,
        $objectTypePanel: null,
        $ownPlanet: null,
        $ownPlanetPanel: null,
        $attackGroup: null,
        $fleetTarget: null
    };

    lastCoordinates = null;
    missionsTimer = null;
    missionDataLoadingVersion = 0;
    missionDataLoading = false;
    $missionDataPanel = null;
    navigationSystemTimer = null;
    debounce = 500;
    target = null;
    navigationMissionType = null;
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
                ...(objectType > 0 ? { objectType } : {}),
                ...(objectType > 3 ? { siteId: Number(this.navigation.$site?.val()) } : {})
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
            fleetId: Number(this.navigation.$fleetTarget?.val())
        };
    }

    getOwnPlanetTargets() {
        const planets = this.messageData.data?.PlanetList?.Planets;
        if (!Array.isArray(planets)) return [];

        return planets.filter(planet => Number(planet.planet_type) === 1);
    }

    getFleetTargets(sourceId, includeUnavailable = false) {
        return (this.messageData.data.Page?.FleetTargets || []).filter(fleet => Number(fleet.id) !== Number(sourceId)
            && (includeUnavailable || fleet.selectable !== false));
    }

    refreshFleetTargets(sourceId, targets = this.messageData.data.Page?.FleetTargets) {
        if (!Array.isArray(targets)) return;
        this.messageData.data.Page.FleetTargets = targets;
        for (const $picker of this.fleetTargetPickers) {
            if (!$picker[0].isConnected) this.fleetTargetPickers.delete($picker);
            else $picker.data("refreshTargets")();
        }
    }

    createFleetTargetPicker(sourceId, selectedId = 0) {
        const $search = $("<input>", { type: "search", placeholder: "Поиск флота или игрока", "aria-label": "Поиск целевого флота" });
        const $select = $("<select>", { "aria-label": "Целевой флот" }).addClass("FleetOwnPlanetSelect");
        const $status = $("<small>", { role: "status" }).addClass("FleetTargetStatus");
        const $picker = $("<div>").addClass("FleetTargetPicker").append($search, $select, $status);
        let wanted = Number(selectedId) || 0;
        const refresh = () => {
            const targets = this.getFleetTargets(sourceId, true);
            const query = String($search.val()).trim().toLocaleLowerCase();
            const label = f => {
                const flight = this.messageData.data.Page?.FlyingFleets?.[f.id];
                const state = flight?.control?.paused ? "Остановлен" : flight?.command ? this.getFlyingFleetCommandName(flight.command) : "";
                return `${f.name || `Флот #${f.id}`} · ${f.is_own ? "свой · " : ""}${f.owner_name || ""} · ${this.formatFleetCoordinate(f.position)}${state ? ` · ${state}` : ""}${f.selectable === false ? ` · ${f.reason}` : ""}`;
            };
            const selected = targets.find(f => Number(f.id) === wanted && f.selectable !== false);
            const previous = Number($select.val());
            this.updateSelectOptions($select, [{ value: "", text: "— выбрать флот —" },
                ...targets.filter(f => Number(f.id) === wanted || label(f).toLocaleLowerCase().includes(query))
                    .map(f => ({ value: f.id, text: label(f), disabled: f.selectable === false, data: { fleetTarget: f } }))]);
            $select.val(selected ? String(wanted) : "").prop("disabled", targets.length === 0);
            const status = wanted && !selected ? "Выбранный флот больше недоступен. Выберите другую цель."
                : !targets.length ? "Нет доступных флотов вне базирования."
                : $select.children().length === 1 ? "Поиск не дал результатов." : "";
            $status.text(status).toggle(Boolean(status));
            if (previous && !selected) $select.trigger("change");
        };
        $select.on("change.fleet-target", () => {
            wanted = Number($select.val()) || 0;
            // Новый доступный выбор снимает старую ошибку до следующего ответа сервера.
            if (this.getFleetTargets(sourceId).some(fleet => Number(fleet.id) === wanted)) {
                $status.text("").hide();
            }
        });
        $search.on("input", refresh);
        $picker.data("refreshTargets", refresh);
        refresh();
        this.fleetTargetPickers.add($picker);
        return { $picker, $select };
    }

    selectFleetTarget(target, fleetId) {
        if (!target) {
            if (Number(this.navigation.$type?.[0]?.value) === 3) this.coordinatesChanged(fleetId, null, true);
            return;
        }
        this.expeditionTarget = false;
        this.navigation.$type[0].value = 3;
        this.navigation.$fleetTarget.val(String(target.id));
        this.selectedMission = target.interceptable && target.delivery === false ? this.getAttackMissionId() : this.getTransportMissionId();
        this.missionSelector.value = this.selectedMission;
        this.updateNavigationCoordinateFields?.(3);
        this.lastCoordinates = null;
        this.coordinatesChanged(fleetId, null, true);
    }

    createContactLossSelector(initial = "last_position") {
        const $select = $("<select>", { "aria-label": "При потере контакта" }).addClass("FleetOwnPlanetSelect FleetInterceptionPolicy")
            .append($("<option>", { value: "last_position", text: "Лететь к последней рассчитанной точке" }));
        if (this.messageData.data.Page?.FleetCapabilities?.interceptStop) {
            $select.append($("<option>", { value: "stop", text: "Немедленно остановиться" }));
        }
        return $select.val(initial === "stop" && $select.children().length > 1 ? "stop" : "last_position");
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

    selectOwnResourceBase(base, fleetId) {
        if (!base) return;
        const at = base.coordinates;
        this.navigationSystemInfo = null;
        this.expeditionTarget = false;
        this.clearMissionSelection();
        this.navigation.$type[0].value = 1;
        this.navigation.$objectType[0].value = at.objectType;
        this.navigation.$galaxy.val(at.galaxy);
        this.navigation.$system.val(at.system);
        this.navigation.$orbit.val(at.orbit);
        this.navigation.$site.empty().append($("<option>", { value: at.siteId, text: base.label })).val(at.siteId);
        this.updateNavigationCoordinateFields?.(1);
        this.lastCoordinates = null;
        this.requestNavigationSystemInfo(fleetId, true);
    }

    isResourceBaseMission() {
        return [45, this.getRelocateMissionId()].includes(Number(this.selectedMission))
            && Number(this.navigation.$type?.[0]?.value) === 1
            && [4, 5].includes(Number(this.navigation.$objectType?.[0]?.value));
    }

    standingFuel(fleet, now = GameServerTime.now()) {
        const state = fleet.standing;
        if (!state) return Math.max(0, Number(fleet.fuel) || 0);
        return Math.max(Math.min(state.fuel, state.reserve),
            state.fuel - Math.max(0, now - state.time) * state.perHour / 3600);
    }

    syncAttackGroupSelection(coordinates) {
        const $select = this.navigation.$attackGroup;
        const groupId = Number($select?.val());
        if (!groupId) return;

        const group = (this.messageData.data.Page?.AttackGroups || [])
            .find(item => Number(item.id) === groupId);
        const matchesTarget = group && ["type", "galaxy", "system", "orbit", "objectType"]
            .every(key => Number(coordinates?.[key]) === Number(group.target[key]));

        // Ручная смена цели или миссии не должна отправить старый ID группы.
        if (!matchesTarget || Number(this.selectedMission) !== this.getGroupAttackMissionId()) {
            $select.val(0);
            this.updateMissionSendState?.();
        }
    }

    selectAttackGroupTarget(group, fleetId) {
        if (!group) return;

        this.clearPageTimeout(this.missionsTimer);
        this.expeditionTarget = false;
        this.selectedMission = this.getGroupAttackMissionId();
        this.missionSelector.value = this.selectedMission;
        this.navigation.$type[0].value = 1;
        this.navigation.$objectType[0].value = group.target.objectType;
        this.navigation.$galaxy.val(group.target.galaxy);
        this.navigation.$system.val(group.target.system);
        this.navigation.$orbit.val(group.target.orbit);
        this.navigationOrdinaryOrbit = Number(group.target.orbit);
        this.updateNavigationCoordinateFields?.(1);
        this.syncOwnPlanetSelection(group.target);
        this.updateMissionSendState?.();

        // Сначала загружаем границы новой системы, затем — миссии и расчёт полёта.
        this.lastCoordinates = null;
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
                objectType: Number(source.objectType) || 1,
                ...(source.siteId ? { siteId: Number(source.siteId) } : {})
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
                fleetId: Number(source.fleetId) || 0
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
            if (coordinates.siteId && this.resourceSiteLabels.has(Number(coordinates.siteId))) {
                return this.resourceSiteLabels.get(Number(coordinates.siteId));
            }
            const names = {
                1: "Планета",
                2: "Обломки",
                3: "Луна", 4: "Газовый гигант", 5: "Сектор пояса"
            };
            const targetName = this.expeditionTarget
                ? "Экспедиция"
                : (names[coordinates.objectType] ?? "Орбита");
            return `[${coordinates.galaxy}:${coordinates.system}:${coordinates.orbit}] ${targetName}`;
        }

        if (coordinates.type === 2) {
            return `[${coordinates.galaxy}:${coordinates.system}] ${coordinates.distance} / ${coordinates.angle}°`;
        }

        return this.formatFleetCoordinate(coordinates);
    }

    isNavigationTarget(target, requireSystem = true) {
        const type = Number(target?.type);

        if (type === 1 && target?.objectType !== undefined) {
            return Number(target.galaxy) > 0
                && Number(target.system) > 0
                && Number(target.orbit) > 0
                && ([1, 2, 3].includes(Number(target.objectType))
                    || ([4, 5].includes(Number(target.objectType)) && Number(target.siteId) > 0));
        }

        if (type === 2 && target?.angle !== undefined) {
            const info = this.navigationSystemInfo;
            const point = Number(target.galaxy) > 0 && Number(target.system) > 0
                && Number.isFinite(Number(target.distance)) && Number(target.distance) >= 0
                && Number.isFinite(Number(target.angle));
            // При переходе с карты сохраняем точные координаты до загрузки границ.
            // Отправка по-прежнему требует подтверждённую NavigationSystem.
            return point && (!requireSystem || (info?.valid && Number(info.galaxy) === Number(target.galaxy)
                && Number(info.system) === Number(target.system)
                && ((Number(target.distance) >= Number(info.minDistance)
                    && Number(target.distance) <= Number(info.maxDistance)) || this.isKnownDebrisPoint(target, info))));
        }

        if (type === 3 && target?.fleetId !== undefined) {
            return this.getFleetTargets(this.missionSelectorFleetId).some(f => Number(f.id) === Number(target.fleetId));
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

    isKnownDebrisPoint(target, info) {
        if (Number(target.galaxy) !== Number(info?.galaxy) || Number(target.system) !== Number(info?.system)) return false;
        const radians = Number(target.angle) * Math.PI / 180;
        const x = Number(target.distance) * Math.cos(radians), y = Number(target.distance) * Math.sin(radians);
        return (info?.debrisPoints || []).some(point => {
            const angle = Number(point.angle) * Math.PI / 180;
            return Math.hypot(x - Number(point.distance) * Math.cos(angle), y - Number(point.distance) * Math.sin(angle)) <= .05;
        });
    }

    pointInputBounds(info, distance, angle) {
        const known = this.isKnownDebrisPoint({ galaxy: info.galaxy, system: info.system, distance, angle }, info);
        return { min: known ? Math.min(Number(info.minDistance), Number(distance)) : Number(info.minDistance),
            max: known ? Math.max(Number(info.maxDistance), Number(distance)) : Number(info.maxDistance) };
    }

    requestNavigationSystemInfo(fleetId, immediate = false) {
        this.clearPageTimeout(this.navigationSystemTimer);
        this.navigationSystemInfo = null;
        this.navigation.$distance?.prop("disabled", true);
        this.updateMissionSendState?.();

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

    fillResourceSiteSelect($select, sites, objectType, preferredId = null) {
        const selected = String(preferredId || $select.val() || "");
        const options = (sites || []).filter(site => Number(site.objectType) === objectType).map(site => {
            this.resourceSiteLabels.set(Number(site.siteId), site.label);
            return { value: site.siteId, text: site.label, data: { site } };
        });
        this.updateSelectOptions($select, options, selected);
        return $select.find(":selected").data("site") || null;
    }

    updateResourceSiteTarget(preferredId = null) {
        const objectType = Number(this.navigation.$objectType?.[0]?.value);
        const resource = Number(this.navigation.$type?.[0]?.value) === 1 && objectType > 3 && !this.expeditionTarget;
        this.navigation.$sitePanel?.toggle(resource);
        if (!resource || !this.navigation.$site) return;
        this.navigation.$site.prop("disabled", !this.navigationSystemInfo?.valid);
        if (!this.navigationSystemInfo?.valid) return;
        const site = this.fillResourceSiteSelect(this.navigation.$site, this.navigationSystemInfo?.resourceSites, objectType, preferredId);
        if (site) this.navigation.$orbit.val(site.orbit);
        this.navigation.$orbit.prop("disabled", true);
    }

    applyNavigationSystemInfo(info, fleetId) {
        if (!info?.valid) {
            this.expeditionTarget = false;
            this.navigationSystemInfo = null;
            this.navigation.$orbit?.prop("disabled", true);
            this.navigation.$distance?.prop("disabled", true);
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
        const bounds = this.pointInputBounds(info, this.navigation.$distance?.val(), this.navigation.$deg?.val());
        this.navigation.$distance?.attr(bounds)
            .prop("disabled", false).val(Math.max(bounds.min,
                Math.min(Number(this.navigation.$distance.val()) || 0, bounds.max)));
        this.navigation.$distance?.ToolTip(`Расстояние от центра системы: ${number_format(info.minDistance)}–${number_format(info.maxDistance)}`);

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

        this.updateResourceSiteTarget();
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

    getColonizeMissionId() {
        const missions = this.messageData.data.Page?.FleetMissions;
        return Array.isArray(missions) ? Number(missions.find(mission => mission.key === "COLONIZE")?.id) || null : null;
    }

    getAttackMissionId() {
        const missions = this.messageData.data.Page?.FleetMissions;
        return Array.isArray(missions) ? Number(missions.find(mission => mission.key === "ATTACK")?.id) || null : null;
    }

    getGroupAttackMissionId() {
        return Number(this.messageData.data.Page?.FleetMissions?.find(mission => mission.key === "GROUP_ATTACK")?.id) || null;
    }

    getDestroyMissionId() {
        return Number(this.messageData.data.Page?.FleetMissions?.find(mission => mission.key === "DESTROY")?.id) || null;
    }

    getDefendMissionId() {
        return Number(this.messageData.data.Page?.FleetMissions?.find(mission => mission.key === "DEFEND")?.id) || null;
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

    getHoldMissionId() {
        return Number(this.messageData.data.Page?.FleetMissions?.find(mission => mission.key === "OBSERVE")?.id) || null;
    }

    getMergeMissionId() {
        return Number(this.messageData.data.Page?.FleetMissions?.find(mission => mission.key === "MERGE")?.id) || null;
    }

    getRelocateMissionId() {
        const missions = this.messageData.data.Page?.FleetMissions;
        if (!Array.isArray(missions)) return null;

        const relocate = missions.find(mission => mission.key === "RELOCATE");
        return relocate ? Number(relocate.id) : null;
    }

    getSpyMissionId() {
        const missions = this.messageData.data.Page?.FleetMissions;
        const spy = Array.isArray(missions) ? missions.find(mission => mission.key === "SPY") : null;
        return spy ? Number(spy.id) : null;
    }

    getRecycleMissionId() {
        const missions = this.messageData.data.Page?.FleetMissions;
        const recycle = Array.isArray(missions) ? missions.find(mission => mission.key === "RECYCLE") : null;
        return recycle ? Number(recycle.id) : null;
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
        this.missionDataLoading = true;
        this.updateMissionSendState?.();

        if (this.$missionDataPanel?.length) {
            Overlay.Show(this.$missionDataPanel, 100);
            Overlay.Text("Получение данных...", this.$missionDataPanel);
        }

        return loadingVersion;
    }

    hideMissionDataLoading(loadingVersion) {
        if (loadingVersion !== this.missionDataLoadingVersion) return;
        this.missionDataLoading = false;
        this.updateMissionSendState?.();
        if (this.$missionDataPanel?.length) {
            Overlay.Hide(this.$missionDataPanel, 100);
        }
    }

    coordinatesChanged = (fleetId, event, immediate = false) => {
        this.clearPageTimeout(this.missionsTimer);

        const updateMissions = () => {

            const coordinates = this.getNavigationCoordinates();
            if (coordinates.type === 3 && !this.isNavigationTarget(coordinates)) {
                ++this.missionDataLoadingVersion;
                this.clearMissionSelection();
                this.missionSelector.items = this.buildMissionItems(this.messageData.data.Page?.FleetMissions || [], []);
                this.updateFleetInfoPanel(null);
                this.flightControls?.applyTravelInfo?.(null);
                this.lastCoordinates = null;
                this.hideMissionDataLoading(this.missionDataLoadingVersion);
                return;
            }
            this.syncOwnPlanetSelection(coordinates);
            this.syncAttackGroupSelection(coordinates);
            this.navigation.$fleetTarget?.val(Number(coordinates.type) === 3 ? String(coordinates.fleetId) : "");
            const speedFactor = this.flightControls?.getSpeedFactor?.() ?? 10;
            const missionType = this.selectedMission;
            const mining = this.flightControls?.getPayload?.().mining ?? null;
            const duration = this.flightControls?.getPayload?.().duration ?? null;
            const coordinatesKey = JSON.stringify({ fleetId, missionType, speedFactor, mining, duration, ...coordinates });

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
                data: { 'fleetId': fleetId, 'coordinates': coordinates, missionType, speedFactor, mining, duration },
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
        this.refreshFleetTargets(fleetId, page?.FleetTargets);

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
            this.fleetInfo.survey?.text("—");
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
        this.fleetInfo.survey?.text(travelInfo.survey
            ? `${this.formatDuration(travelInfo.survey.duration)} · +${number_format(travelInfo.survey.gain * 100, 2)}% · топливо ${number_format(travelInfo.survey.fuel)}` : "—");
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
            if (coordinate.siteId && this.resourceSiteLabels.has(Number(coordinate.siteId))) {
                return this.resourceSiteLabels.get(Number(coordinate.siteId));
            }
            const objectNames = {
                1: "Планета",
                2: "Обломки",
                3: "Луна", 4: "Газовый гигант", 5: "Сектор пояса"
            };
            const objectName = Number(coordinate.objectType) === 5 && coordinate.sector
                ? `Сектор пояса ${coordinate.sector}` : objectNames[Number(coordinate.objectType)] || "Орбита";
            return `[${coordinate.galaxy}:${coordinate.system}:${coordinate.orbit}] ${objectName}`;
        }

        if (type === 2) {
            const distance = number_format(Number(coordinate.distance) || 0, 0);
            const angle = number_format(Number(coordinate.angle) || 0, 1);
            return `[${coordinate.galaxy}:${coordinate.system}] ${distance} / ${angle}°`;
        }

        if (type === 3) {
            const page = this.messageData.data.Page;
            const id = Number(coordinate.fleetId);
            // Только имена из разрешённого snapshot, без кеша скрытых контактов.
            const fleet = page?.FleetTargets?.find(fleet => Number(fleet.id) === id)
                || page?.FleetList?.[id]
                || page?.FlyingFleets?.[id];
            return fleet?.name || `Флот #${coordinate.fleetId}`;
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

    createFlyingFleetRow(fleet, $row = null) {
        const created = !$row;
        $row ||= $("<article>").addClass("FleetFlightCard").attr("data-fleet-id", fleet.id);
        const part = (className, tag = "div") => {
            const $existing = $row.find(`.${className}`).first();
            return $existing.length ? $existing : $(`<${tag}>`).addClass(className);
        };
        const isHolding = ["holding", "expedition"].includes(fleet.route_leg?.direction);
        const isExpedition = fleet.route_leg?.direction === "expedition";
        const missionName = this.getFleetListLabel(
            this.messageData.data.Page?.FleetMissions,
            fleet.mission,
            `Миссия #${fleet.mission}`
        );
        const commandName = this.getFlyingFleetCommandName(fleet.command);
        const routeLeg = this.getFlyingFleetRouteLeg(fleet);
        const routeSegmentsTotal = Number(routeLeg.segmentsTotal) || 1;
        const routeActiveSegment = Number(routeLeg.activeSegment) || 1;
        const battleLabel = fleet.battle ? (fleet.battle.round > 0
            ? `Бой · раунд ${fleet.battle.round}/${fleet.battle.rounds_max}` : "Подготовка боя") : null;
        const commandLabel = fleet.blocked_reason || battleLabel || (routeSegmentsTotal > 1
            ? `${commandName} · ${routeActiveSegment}/${routeSegmentsTotal}`
            : commandName);
        const missionStartCoordinate = fleet.mission_start || fleet.segment_start;
        const missionTargetCoordinate = fleet.mission_target || fleet.segment_end;

        $row
            .toggleClass("Returning", Boolean(fleet.is_return))
            .toggleClass("WholeRouteProgress", Boolean(fleet.route_progress) && Number.isFinite(Number(fleet.route_progress.total)))
            .toggleClass("Holding", isHolding);

        const $fleet = part("FleetFlightFleet");
        if (created) $fleet.append(
                $("<div>").addClass("FleetFlightIdentity").append(
                    $("<strong>").text(fleet.name || `Флот #${fleet.id}`),
                    $("<span>").addClass("FleetFlightMissionName").text(isExpedition ? `${missionName} · ${battleLabel || "Обследование"}` : isHolding ? `${missionName} · Удержание` : missionName)
                )
            );
        $fleet.find("strong").text(fleet.name || `Флот #${fleet.id}`);
        $fleet.find(".FleetFlightMissionName").text(isExpedition ? `${missionName} · ${battleLabel || "Обследование"}` : isHolding ? `${missionName} · Удержание` : missionName);
        $fleet.ToolTip(this.createFlyingFleetTooltip(
                fleet,
                this.getFlyingFleetDisplayFuel(fleet, GameServerTime.now())
            ), {
                "min-width": "230px",
                "max-width": "320px"
            });
        const $missionTarget = part("FleetFlightMissionTarget", "span")
            .text(this.formatFleetCoordinate(missionTargetCoordinate))
            .ToolTip("Цель миссии");
        const $missionStart = part("FleetFlightMissionStart", "span")
            .text(this.formatFleetCoordinate(missionStartCoordinate))
            .ToolTip("Точка вылета");

        const $fill = part("FleetFlightTrackFill", "span");
        const $boundaries = this.createFlyingFleetTrackBoundaries(fleet, routeLeg, created ? null : part("FleetFlightTrackBoundaries", "span"));
        const $marker = part("FleetFlightMarker", "span")
            .attr("aria-hidden", "true")
            .text(isHolding ? "◆" : (fleet.route_progress ? "»" : (fleet.is_return ? "«" : "»")));

        const $remaining = part("FleetFlightRemaining", "strong");
        const arrivalTime = routeLeg.arrivesAt > 0
            ? formatTimestamp(routeLeg.arrivesAt, "timedate")
            : "—";
        const arrivalLabel = fleet.fuel_stop ? "Остановка при исчерпании топлива" : isExpedition ? "Окончание экспедиции" : isHolding ? "Окончание удержания" : (fleet.recall_pending ? "Завершение перехода" : (fleet.is_return ? "Возвращение домой" : "Прибытие к цели"));
        const $arrival = part("FleetFlightArrival")
            .addClass("FleetFlightTiming FleetFlightArrival")
            .ToolTip(`${arrivalLabel}: ${routeLeg.estimated ? "≈ " : ""}${arrivalTime}`);
        if (created) $arrival.append($remaining);
        const $track = part("FleetFlightTrack")
            .attr({
                role: "progressbar",
                "aria-label": fleet.route_progress ? "Прогресс всего маршрута" : commandLabel,
                "aria-valuemin": 0,
                "aria-valuemax": 100
            })
            .ToolTip(this.createFlyingFleetProgressTooltip(fleet, commandLabel, missionName), {
                "width": "min(320px, calc(100vw - 24px))",
                "max-width": "calc(100vw - 24px)",
                "padding": "8px 10px",
                "pointer-events": "none"
            });
        const $route = part("FleetFlightRoute");
        if (created) { $track.append($fill, $boundaries, $marker); $route.append($track); }

        const missionEndTime = Number(fleet.mission_end_time);
        const hasMissionEnd = Number.isFinite(missionEndTime) && missionEndTime > 0;
        const $missionRemaining = part("FleetFlightMissionRemaining", "strong");
        const $commands = this.createFlyingFleetCommands(fleet, created ? null : part("FleetFlightCommands"));
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
        const $commandsButton = part("FleetFlightCommandsButton", "button").attr("type", "button")
            .attr({
                "aria-controls": commandsId,
                "aria-expanded": String(commandsExpanded),
                "aria-label": `Выполнено команд: ${commandsCompleted} из ${commandsTotal}. Показать цепочку команд флота`
            })
            .text(`Команды: ${commandsCompleted}/${commandsTotal}`)
            .ToolTip(`Выполнено ${commandsCompleted} из ${commandsTotal}. Показать цепочку команд флота`)
            .off(".fleet-flight").on(isTouch ? "confirmed-click.fleet-flight" : "click.fleet-flight", () => {
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
        const $actions = part("FleetFlightActions");
        if (created) $actions.append($commandsButton);
        const actions = new Set(["FleetFlightCommandsButton"]);
        const action = (className, text) => {
            actions.add(className);
            let $button = $actions.children(`.${className}`);
            if (!$button.length) $actions.append($button = $("<button>", { type: "button", class: className }));
            return $button.text(text).show().off(".fleet-action");
        };
        if (fleet.sensors?.available) {
            action("FleetSensorModeButton", fleet.sensors.enabled ? "Выключить сенсоры" : "Включить сенсоры")
                .prop("disabled", false)
                .attr("aria-pressed", String(fleet.sensors.enabled))
                .ToolTip("Наблюдать текущую систему: скан раз в 10 секунд; расход топлива по правилу удержания всего флота.")
                .on(isTouch ? "confirmed-click.fleet-action" : "click.fleet-action", event => {
                    ToolTip.hide();
                    const $button = $(event.currentTarget).prop("disabled", true);
                    WS.Submit("fleets", "SetFleetSensors", { fleetId: Number(fleet.id), enabled: !fleet.sensors.enabled }, {
                        scope: this.requestScope, kind: "write", onSuccess: () => {},
                        onError: error => { $button.prop("disabled", false); Dialog.error(error.message); }
                    });
                });
        }
        const capabilities = this.messageData.data.Page?.FleetCapabilities || {};
        if (fleet.is_own !== false && (fleet.actions?.SetFleetCommands ?? (capabilities.edit && !fleet.battle))) {
            action("FleetFlightPlanButton", "Маршрут").on("click.fleet-action", () => this.showFleetPlan(Number(fleet.id)));
        }
        if (fleet.is_own !== false && (fleet.actions?.ResumeFleet ?? (!fleet.battle && (fleet.control?.paused || (fleet.control?.holding && fleet.control?.can_continue))))) {
            action("FleetFlightResumeButton", "Продолжить").on("click.fleet-action", () => this.showFleetResume(Number(fleet.id)));
        } else if (fleet.is_own !== false && (fleet.actions?.StopFleet ?? (capabilities.hold && [10,11,12].includes(Number(fleet.command?.type)) && !fleet.battle))) {
            action("FleetFlightStopButton", fleet.control?.stop_pending ? "Остановка после перехода" : "Остановить")
                .prop("disabled", !!fleet.control?.stop_pending).on("click.fleet-action", () => this.sendFleetControl("StopFleet", Number(fleet.id)));
        }
        const attackGroup = (this.messageData.data.Page?.AttackGroups || [])
            .find(group => (group.fleetIds || []).includes(Number(fleet.id)));
        if (attackGroup && !fleet.is_return) {
            action("FleetFlightGroupButton", "Группа")
                .ToolTip("Участники групповой атаки и приглашение по игровому имени")
                .on(isTouch ? "confirmed-click.fleet-action" : "click.fleet-action", () => {
                    ToolTip.hide();
                    this.showAttackGroup(attackGroup.id);
                });
        }
        if (fleet.can_recall || fleet.recall_pending) {
            action("FleetFlightRecallButton", fleet.recall_pending ? "Отзыв принят" : "Отозвать")
                .prop("disabled", Boolean(fleet.recall_pending))
                .ToolTip("Отозвать флот на базируемую планету или луну. Уже начатый межсистемный переход завершится перед возвратом.")
                .on(isTouch ? "confirmed-click.fleet-action" : "click.fleet-action", event => {
                    ToolTip.hide();
                    const $button = $(event.currentTarget).prop("disabled", true);
                    GameEvents.emit("SendServer", { mode: "fleets", action: "RecallFleet", data: { fleetId: Number(fleet.id) },
                        NotOverlay: true, ...this.getRequestOptions({ kind: "command" }),
                        onSuccess: () => {},
                        onError: error => { $button.prop("disabled", false); Dialog.ErrorLoad(error?.message || "Не удалось отозвать флот."); }
                    });
                });
        }
        $actions.children("button").each((_, button) => {
            if (![...actions].some(className => button.classList.contains(className))) {
                if (ToolTip.parent === button) ToolTip.hide();
                $(button).hide().off(".fleet-action");
            }
        });

        const missionEndLabel = hasMissionEnd
            ? `${fleet.mission_end_estimated ? "≈ " : ""}${formatTimestamp(missionEndTime, "timedate")}`
            : "—";
        const $missionTiming = part("FleetFlightMissionTiming")
            .addClass("FleetFlightTiming FleetFlightMissionTiming")
            .ToolTip(hasMissionEnd
                ? `Полное завершение миссии: ${missionEndLabel}`
                : (fleet.recall_pending ? "Возврат будет рассчитан после выхода из текущего перехода" : "Для одной из будущих команд сервер ещё не умеет рассчитывать длительность"));
        const $missionFinish = part("FleetFlightMissionFinish");
        if (created) {
            $missionTiming.append($missionRemaining);
            $missionFinish.append(
                $missionTiming,
                $actions,
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
        }
        $row.Flight = fleet;
        $row.Track = $track;
        $row.Fill = $fill;
        $row.Marker = $marker;
        $row.Remaining = $remaining;
        $row.MissionRemaining = $missionRemaining;
        $row.FleetElement = $fleet;
        return $row;
    }

    createFlyingFleetProgressTooltip(fleet, commandLabel, missionName) {
        const endTime = Number(fleet.end_time);
        const hasEndTime = !fleet.blocked_reason && Number.isFinite(endTime) && endTime > 0;
        const $tooltip = $("<div>").addClass("FleetFlightProgressTooltip")
            .toggleClass("Returning", Boolean(fleet.is_return))
            .toggleClass("Blocked", Boolean(fleet.blocked_reason));
        const $route = $("<dl>").addClass("FleetFlightProgressTooltipRoute");
        [["Откуда", fleet.segment_origin ?? fleet.segment_start],
            ["Куда", fleet.segment_target ?? fleet.segment_end]].forEach(([label, coordinate]) => {
            $route.append($("<div>").append(
                $("<dt>").text(label), $("<dd>").text(this.formatFleetCoordinate(coordinate))
            ));
        });
        return $tooltip.append(
            $("<header>").addClass("FleetFlightProgressTooltipHeader").append(
                $("<strong>").text(fleet.name || `Флот #${fleet.id}`),
                $("<span>").text(missionName)
            ),
            $("<div>").addClass("FleetFlightProgressTooltipCommand").append(
                $("<span>").text(fleet.route_leg?.direction === "mining" ? "Добыча" : fleet.route_leg?.direction === "expedition" ? "Экспедиция" : fleet.route_leg?.direction === "holding" ? "Удержание" : (fleet.is_return ? "Возврат" : "К цели")),
                $("<strong>").text(commandLabel)
            ),
            $route,
            $("<div>").addClass("FleetFlightProgressTooltipArrival").append(
                $("<span>").text(fleet.fuel_stop ? "Исчерпание топлива" : fleet.route_leg?.direction === "expedition" ? "Окончание экспедиции" : fleet.route_leg?.direction === "holding" ? "Окончание удержания" : "Завершение участка"),
                $("<time>").text(hasEndTime ? formatTimestamp(endTime, "timedate") : "—")
            )
        ).prop("outerHTML");
    }

    createFlyingFleetTooltip(fleet, displayedFuel = fleet.fuel) {
        const $tooltip = $("<div>").addClass("FleetFlightTooltip");
        const ships = Object.values(fleet.ships || {})
            .filter(ship => Number(ship?.count) > 0)
            .sort((left, right) => Number(left.id) - Number(right.id));
        const miningElapsed = fleet.mining ? Math.max(0, Math.min(GameServerTime.now(), fleet.mining.until) - fleet.mining.at) : 0;
        const resources = Object.values(fleet.resources || {}).map(resource => ({ ...resource,
            count: Number(resource.count) + Number(fleet.mining?.rates?.[resource.id] || 0) * miningElapsed / 3600 }))
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
                $ships.append(this.createFlyingFleetTooltipRow(name, ship.count).attr("data-card-field", ship.id));
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
                $cargo.append(this.createFlyingFleetTooltipRow(name, resource.count).attr("data-card-field", resource.id));
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
        if (fleet.standing) return this.standingFuel(fleet, now);
        if (fleet.mining) {
            const state = fleet.mining;
            const elapsed = Math.max(0, Math.min(now, state.until) - state.at);
            return Math.max(Math.min(authoritativeFuel, state.fuelReserve), authoritativeFuel - state.fuelPerHour * elapsed / 3600);
        }
        if (fleet.control?.holding) {
            return Math.max(0, authoritativeFuel - Number(fleet.control.holdRate || 0) * Math.max(0, now - Number(fleet.control.fuelTime || now)));
        }

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
        const name=translated && translated!==command.lang ? translated : (command.key || `Команда #${command.type ?? 0}`);
        return command.resource_percent!=null ? `${name} · ${command.resource_percent}% остатка` : name;
    }

    getFlyingFleetRouteLeg(fleet) {
        if (fleet.blocked_reason) {
            return { startedAt: Number(fleet.start_time) || 0, arrivesAt: 0, estimated: false,
                activeSegment: 1, segmentsTotal: 1, segments: [], isReturn: Boolean(fleet.is_return) };
        }
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
            estimated: Boolean(fleet.battle),
            activeSegment: 1,
            segmentsTotal: 1,
            segments: [],
            isReturn: Boolean(fleet.is_return)
        };
    }

    getFlyingFleetLegMetrics(fleet, now) {
        const routeLeg = this.getFlyingFleetRouteLeg(fleet);
        const wholeRoute = fleet.route_progress;
        if (wholeRoute && Number.isFinite(Number(wholeRoute.total))) {
            const active = wholeRoute.active;
            const from = Number(active?.started_at), until = Number(active?.ends_at);
            const fraction = active && !fleet.blocked_reason && until > from
                ? Math.max(0, Math.min(1, (now - from) / (until - from))) : 0;
            const travelled = Number(wholeRoute.completed) + Number(active?.span || 0) * fraction;
            const progress = Number(wholeRoute.total) > 0 ? Math.max(0, Math.min(1, travelled / Number(wholeRoute.total))) : 0;
            return { ...routeLeg, progress, markerProgress: progress,
                remaining: Math.max(0, Math.ceil(routeLeg.arrivesAt - now)) };
        }
        const isHolding = ["holding", "expedition", "mining"].includes(fleet.route_leg?.direction);
        const duration = Math.max(0, routeLeg.arrivesAt - routeLeg.startedAt);
        const progress = duration > 0
            ? Math.max(0, Math.min(1, (now - routeLeg.startedAt) / duration))
            : 1;

        return {
            ...routeLeg,
            progress: isHolding ? 1 : progress,
            markerProgress: isHolding ? 1 : (routeLeg.isReturn ? 1 - progress : progress),
            remaining: Math.max(0, Math.ceil(routeLeg.arrivesAt - now))
        };
    }

    createFlyingFleetTrackBoundaries(fleet, routeLeg = this.getFlyingFleetRouteLeg(fleet), $boundaries = null) {
        $boundaries ||= $("<span>").addClass("FleetFlightTrackBoundaries");
        let count = 0;
        const boundary = (position, hint) => {
            let $item = $boundaries.children().eq(count++);
            if (!$item.length) $boundaries.append($item = $("<i>").addClass("FleetFlightTrackBoundary"));
            $item.css("left", `${position * 100}%`).ToolTip(hint);
        };
        if (fleet.route_progress) {
            const total = Number(fleet.route_progress.total);
            (fleet.route_progress.boundaries || []).forEach((weight, index) => {
                if (total <= 0 || weight <= 0 || weight >= total) return;
                boundary(weight / total, `Участок маршрута ${index + 1}`);
            });
            $boundaries.children().slice(count).remove();
            return $boundaries;
        }
        const duration = routeLeg.arrivesAt - routeLeg.startedAt;
        if (duration <= 0 || routeLeg.segments.length < 2) {
            $boundaries.children().remove();
            return $boundaries;
        }

        routeLeg.segments.slice(0, -1).forEach(segment => {
            const endsAt = Number(segment.ends_at);
            if (!Number.isFinite(endsAt)) return;

            const progress = Math.max(0, Math.min(1, (endsAt - routeLeg.startedAt) / duration));
            const markerPosition = routeLeg.isReturn ? 1 - progress : progress;
            const commandName = this.getFlyingFleetCommandName(segment);
            boundary(markerPosition, `Граница участка: ${commandName}`);
        });
        $boundaries.children().slice(count).remove();
        return $boundaries;
    }

    createFlyingFleetCommands(fleet, $commands = null) {
        const commands = Array.isArray(fleet.commands) ? fleet.commands : [];
        $commands ||= $("<div>").addClass("FleetFlightCommands");
        let $empty = $commands.children(".FleetFlightCommandsEmpty");
        if (!$empty.length) $commands.append($empty = $("<div>").addClass("FleetFlightCommandsEmpty").text("Команды не переданы сервером"));
        $empty.toggle(commands.length === 0);
        const existing = new Map($commands.children(".FleetFlightCommandRow").get().map(row => [row.dataset.commandKey, row]));
        commands.forEach((command, index) => {
            const key = String(command.id ?? command.position);
            const active = command.status === "active";
            const completed = command.status === "completed";
            const commandTime = Number(command.estimated_time);
            const hasTime = Number.isFinite(commandTime) && commandTime > 0;
            const target = command.target
                ? this.formatFleetCoordinate(command.target)
                : "—";
            const name = this.getFlyingFleetCommandName(command);
            const status = command.status === "paused" ? "Приостановлено" : completed ? "Выполнено" : active ? "Сейчас" : "Ожидание";
            const timing = hasTime ? `${command.time_estimated ? "≈ " : ""}${formatTimestamp(commandTime, "timedate")}` : "—";
            const timingHint = command.status === "paused" ? (command.plan_error || "Ожидание команды игрока")
                : hasTime ? `${status}: ${timing}` : completed ? "Выполнено" : "После предыдущей команды";

            const $row = existing.has(key) ? $(existing.get(key)) : $("<div>")
                    .addClass("FleetFlightCommandRow").attr("data-command-key", key).append(
                        $("<span>").addClass("FleetFlightCommandPosition"),
                        $("<span>").addClass("FleetFlightCommandName").append(
                            $("<span>").addClass("FleetFlightCommandNameText"),
                            $("<small>").addClass("FleetFlightCommandReturn").text("возврат")
                        ),
                        $("<span>").addClass("FleetFlightCommandTarget"),
                        $("<span>").addClass("FleetFlightCommandTime").append($("<time>"))
                    );
            $row.toggleClass("Active", active).toggleClass("Completed", completed).toggleClass("Paused", command.status === "paused");
            $row.find(".FleetFlightCommandPosition").text(completed ? "✓" : command.position).ToolTip(`Команда #${command.position}`);
            $row.find(".FleetFlightCommandName").ToolTip(name).find(".FleetFlightCommandNameText").text(name);
            $row.find(".FleetFlightCommandReturn").toggle(Boolean(command.return_leg));
            $row.find(".FleetFlightCommandTarget").text(target).ToolTip($("<span>").text(target).prop("outerHTML"));
            $row.find(".FleetFlightCommandTime").ToolTip(timingHint).find("time")
                .text(hasTime ? `${command.time_estimated ? "≈ " : ""}${formatTimestamp(commandTime, "time")}` : command.status === "paused" ? "Пауза" : "—");
            const before = $commands.children(".FleetFlightCommandRow")[index];
            if (before !== $row[0]) this.placeElement($commands[0], $row[0], before || null);
            existing.delete(key);
        });
        existing.forEach(row => { if (row.contains(ToolTip.parent)) ToolTip.hide(); $(row).remove(); });

        return $commands;
    }

    updateFlyingFleetsClock() {
        const now = GameServerTime.now();
        Object.values(this.messageData.data.Page?.FleetList || {}).forEach(fleet => {
            const $card = this.$Fleets?.[fleet.id];
            if (!fleet.standing || !$card?.Standing) return;
            const state = fleet.standing;
            $card.Standing.text(`Топливо: ${number_format(this.standingFuel(fleet, now), 1)} · стоянка ${number_format(state.perHour, 1)}/ч · резерв ${number_format(state.reserve)}`);
        });

        Object.values(this.flyingFleetRows).forEach($row => {
            const fleet = $row.Flight;
            const routeLeg = this.getFlyingFleetLegMetrics(fleet, now);
            const percent = routeLeg.progress * 100;
            $row.Fill.css("width", `${percent}%`);
            $row.Marker.css("left", `${routeLeg.markerProgress * 100}%`);
            $row.Track.attr("aria-valuenow", Math.round(percent));
            if (fleet.blocked_reason) {
                $row.Remaining.text("Приостановлен");
                $row.MissionRemaining.text("—");
                this.updateFlyingFleetTooltip($row, now);
                return;
            }
            const remaining = routeLeg.remaining;
            const missionEndTime = Number(fleet.mission_end_time);
            const missionRemaining = Number.isFinite(missionEndTime) && missionEndTime > 0
                ? Math.max(0, Math.ceil(missionEndTime - now))
                : null;

            $row.Remaining.text(
                remaining > 0
                    ? `${routeLeg.estimated ? "≈ " : ""}${this.formatDuration(remaining)}`
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

        if (Object.keys(this.flyingFleetRows).length === 0
            && !Object.values(this.messageData.data.Page?.FleetList || {}).some(fleet => fleet.standing)) return;

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

        const slots = this.messageData.data.Page?.FleetLimits?.missions;
        this.$FlyingFleets.Count.text(slots ? `${slots.used} / ${slots.max}` : flyingFleets.length)
            .ToolTip("Активные миссии / лимит компьютерной технологии. Место занято до полного завершения миссии.");
        const previousRows = this.flyingFleetRows || {};
        this.flyingFleetRows = {};
        const visibleFleetIds = new Set(flyingFleets.map(fleet => Number(fleet.id)));
        for (const fleetId of this.expandedFlyingFleetCommands) {
            if (!visibleFleetIds.has(fleetId)) {
                this.expandedFlyingFleetCommands.delete(fleetId);
            }
        }

        let $empty = this.$FlyingFleets.List.children(".FleetFlightsEmpty");
        if (!$empty.length) this.$FlyingFleets.List.append($empty = $("<div>").addClass("FleetFlightsEmpty").text("Нет флотов в полёте"));
        $empty.toggle(flyingFleets.length === 0);
        flyingFleets.forEach((fleet, index) => {
                const $row = this.createFlyingFleetRow(fleet, previousRows[fleet.id]);
                this.flyingFleetRows[fleet.id] = $row;
                const before = this.$FlyingFleets.List.children(".FleetFlightCard")[index];
                if (before !== $row[0]) this.placeElement(this.$FlyingFleets.List[0], $row[0], before || null);
        });
        Object.entries(previousRows).forEach(([id, $row]) => {
            if (this.flyingFleetRows[id]) return;
            if ($row[0].contains(ToolTip.parent)) ToolTip.hide();
            $row.remove();
        });

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
        if (!Fleet || Fleet.battle) return;

        const resourceSource = Number(Fleet.home_site_id) > 0;

        this.flightControls = null;
        this.lastCoordinates = null;
        ++this.missionDataLoadingVersion;
        this.missionDataLoading = false;
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
        const $sendPanel = this.createDiv("", "sendPanel");
        let $sendButton = null;

        if (Commands) {


        } else {
            //$panel.append("-= Комманды отсутствуют =-", "<br><br>");


            // === Панель выбора типа цели и ввода координат ===
            const $coordPanel = $("<div>").addClass("box FleetCoordsPanel");
            const target = this.normalizeNavigationTarget(this.target, Fleet);
            const coordinateField = (label, id) => $("<label>", { id })
                .addClass(`FleetCoordinateField ${id}`).append($("<span>").text(label));

            // Поля ввода координат

            const $galaxy = coordinateField("Галактика", "GalaxyBlock");
            $galaxy.append(
                this.navigation.$galaxy = this.createInput(
                    'number', 'NavigationGalaxyInput', '', "InputNavigation", () => this.requestNavigationSystemInfo(FleetId), target.galaxy ?? 1,
                    { min: 1, max: () => 1 }));


            const $system = coordinateField("Система", "SystemBlock");
            $system.append(
                this.navigation.$system = this.createInput(
                    'number', 'NavigationSystemInput', '', "InputNavigation", () => this.requestNavigationSystemInfo(FleetId), target.system ?? 1,
                    { min: 1, max: () => 128 })
            );

            const $orbit = coordinateField("Орбита", "OrbitBlock");
            $orbit.append(
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

            const $distance = coordinateField("Расстояние", "DistanceBlock");
            $distance.append(
                // Физическая точка боя дробная: общий integer input удаляет десятичную точку при blur.
                this.navigation.$distance = $("<input>", { type: "number", id: "NavigationDistanceInput", class: "InputNavigation",
                    step: "any", min: 0, value: target.distance ?? 0, disabled: true })
                    .on("input.form", event => this.coordinatesChanged(FleetId, event))
            );
            // Нижнюю границу применяем после ввода, иначе первый символ "3"
            // превратится в 736 и игрок не сможет напечатать расстояние 3000.
            this.navigation.$distance.on("change.pointBounds blur.pointBounds", () => {
                const info = this.navigationSystemInfo;
                if (!info) return;
                const bounds = this.pointInputBounds(info, this.navigation.$distance.val(), this.navigation.$deg.val());
                this.navigation.$distance.attr(bounds).val(Math.max(bounds.min,
                    Math.min(Number(this.navigation.$distance.val()) || 0, bounds.max)));
                this.coordinatesChanged(FleetId);
            });

            const $deg = coordinateField("Угол, °", "DegBlock");
            $deg.append(
                this.navigation.$deg = $("<input>", { type: "number", id: "NavigationDegInput", class: "InputNavigation",
                    step: "any", min: 0, max: 359.999999, value: target.angle ?? 0 })
                    .on("input.form", event => this.coordinatesChanged(FleetId, event))
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
                debris: { label: "Обломки", value: 2, class: "NavType", imgClass: "NavTypeImg NavTypeDedris", tooltip: "Поле обломков" },
                gas: { label: "Гигант", value: 4, class: "NavType", imgClass: "NavTypeImg NavTypeGasGiant", tooltip: "Газовый гигант" },
                sector: { label: "Пояс", value: 5, class: "NavType", imgClass: "NavTypeImg NavTypeAsteroidBelt", tooltip: "Сектор пояса астероидов" }
            };
            objectSelector.single = true;
            objectSelector.vertical = false;
            objectSelector.value = target.objectType ?? null;

            const $objectTypePanel = $("<div>").addClass("FleetObjectTypePanel").append(
                $("<div>").addClass("FleetCoordinateSubTitle").text("Тип объекта:"),
                this.navigation.$objectType
            );
            this.navigation.$objectTypePanel = $objectTypePanel;
            this.navigation.$site = $("<select>", { "aria-label": "Ресурсный объект" }).addClass("FleetOwnPlanetSelect");
            if (target.siteId) this.navigation.$site.append($("<option>", { value: target.siteId, text: "Загрузка объекта…" }));
            this.navigation.$sitePanel = $("<label>").addClass("FleetOwnPlanetPanel")
                .append($("<span>").text("Объект / сектор:"), this.navigation.$site).hide();
            this.navigation.$site.on("change", () => {
                const site = this.navigation.$site.find(":selected").data("site");
                if (site) this.navigation.$orbit.val(site.orbit);
                this.clearMissionSelection(); this.coordinatesChanged(FleetId);
            });

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
            const $quickTargets = $("<div>").addClass("FleetQuickTargets").append($ownPlanetPanel);
            const ownBases = this.messageData.data.Page?.ResourceBases?.bases || [];
            if (ownBases.length) {
                const $ownBase = $("<select>", { "aria-label": "Своя ресурсная база" }).addClass("FleetOwnPlanetSelect")
                    .append($("<option>", { value: "", text: "— выбрать базу —" }));
                ownBases.forEach(base => $ownBase.append($("<option>", { value: base.siteId, text: base.label })));
                $ownBase.on("change", () => this.selectOwnResourceBase(ownBases.find(base => String(base.siteId) === $ownBase.val()), FleetId));
                $quickTargets.append($("<label>").addClass("FleetOwnPlanetPanel").append($("<span>").text("Своя ресурсная база:"), $ownBase));
            }
            const $coordinateFields = $("<div>").addClass("FleetCoordinateFields").append(
                $galaxy, $system, $orbit, $distance, $deg);

            const toggleCoordinateFields = (type) => {
                const isObject = type === 1;
                const isPoint = type === 2;
                $coordinateFields.attr("data-coordinate-type", type);

                $objectTypePanel.toggle(isObject && !this.expeditionTarget);
                $galaxy.toggle(isObject || isPoint);
                $system.toggle(isObject || isPoint);
                $orbit.toggle(isObject);
                $distance.toggle(isPoint);
                $deg.toggle(isPoint);

                this.navigation.$galaxy.prop("disabled", isObject && this.expeditionTarget);
                this.navigation.$system.prop("disabled", isObject && this.expeditionTarget);
                this.navigation.$orbit.prop("disabled", !isObject || this.expeditionTarget);
                this.updateResourceSiteTarget();
            };
            this.updateNavigationCoordinateFields = toggleCoordinateFields;

            selector.addEventListener("change", e => {
                const type = Number(e.detail.value);
                if (type !== 1) {
                    this.expeditionTarget = false;
                    this.clearMissionSelection();
                }
                toggleCoordinateFields(type);
                if (type === 1 || type === 2) {
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
                $("<h3>").addClass("FleetSectionTitle").text("Цель полёта"),
                this.navigation.$type,
                $quickTargets,
                $objectTypePanel,
                this.navigation.$sitePanel,
                $coordinateFields
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
            const requestedMissionId = Number(this.navigationMissionType);
            this.selectedMission = (allFleetMissions || []).some(mission => Number(mission.id) === requestedMissionId)
                ? requestedMissionId : null;
            missionSelector.value = this.selectedMission ?? "";

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
                        this.getAttackMissionId(),
                        this.getGroupAttackMissionId(),
                        this.getDestroyMissionId(),
                        this.getDefendMissionId(),
                        this.getTransportMissionId(),
                        this.getRelocateMissionId(),
                        this.getSpyMissionId(),
                        this.getRecycleMissionId(),
                        this.getColonizeMissionId(),
                        this.getHoldMissionId(),
                        this.getMergeMissionId(),
                        25,
                        45,
                        50,
                        this.getExpeditionMissionId()
                    ].includes(missionType);
                    if (!payload || !supportedMission) {
                        Dialog.ErrorLoad("Выберите доступную миссию и её параметры.");
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
            ).addClass("FleetMissionSendButton btn-info");
            $sendButton = $sendBtn;
            //const $clearBtn = this.createButton("ClearCmds", "Очистить", () => $commandsList.empty());

            const $holdDuration = $("<select>", { id: "FleetDefendDuration", "aria-label": "Время обороны" });
            const $contactLoss = this.createContactLossSelector();
            const $interceptionPanel = $("<div>").addClass("FleetDefendOptions FleetInterceptionOptions").append(
                $("<label>").append("При потере контакта: ", $contactLoss),
                $("<p>").text("Встреча рассчитывается по наблюдению. Новый скан может уточнить курс и расход топлива. Если цель не найдена — флот остановится с сообщением; после боя атакующий продолжит маршрут, защитник ждёт команды.")
            ).hide();
            for (const hours of this.messageData.data.Page?.DefenseHours || []) {
                $holdDuration.append($("<option>", { value: hours * 3600, text: `${hours} ч` }));
            }
            const $holdRate = $("<span>");
            const $holdSupplySource = $("<span>").text(" дейтерия/ч с принимающего объекта.");
            const $holdSupplyNote = $("<p>").text("Когда дейтерий у принимающей стороны закончится, флот вернётся досрочно.");
            const $holdPanel = $("<div>").addClass("FleetDefendOptions").append(
                $("<label>").text("Время обороны: ").append($holdDuration),
                $("<p>").append("Расход охранения: ", $holdRate, $holdSupplySource),
                $holdSupplyNote
            ).hide();
            this.$defendDuration = $holdDuration;
            $holdDuration.on("change", () => this.coordinatesChanged(FleetId, null, true));
            const expeditionLimits = this.messageData.data.Page?.ExpeditionLimits || {};
            const $expeditionDuration = $("<select>", { id: "FleetExpeditionDuration", "aria-label": "Время экспедиции" });
            for (let hours = 1; hours <= Number(expeditionLimits.maxHours || 0); hours++) {
                $expeditionDuration.append($("<option>", { value: hours * 3600, text: `${hours} ч` }));
            }
            const $expeditionSlots = $("<p>");
            const $expeditionPanel = $("<div>").addClass("FleetDefendOptions FleetExpeditionOptions").append(
                $("<label>").append("Время экспедиции: ", $expeditionDuration),
                $expeditionSlots,
                $("<p>").text("Каждый час — одно событие. Итоговый отчёт — после обследования или отзыва. Возможны находки, бой, изменение времени возврата и потеря флота. Кредиты на борту не занимают трюм и зачисляются после возвращения.")
            ).hide();
            $expeditionDuration.on("change", () => this.updateMissionSendState?.());

            const miningRules = this.messageData.data.Page?.MiningRules || {};
            const $miningMode = $("<select>", { id: "FleetMiningMode", "aria-label": "Ресурс для добычи" });
            for (const [value, text] of [["mix", "Металл и кристалл"], ["metal", "Металл"], ["crystal", "Кристалл"], ["deuterium", "Дейтерий"]]) {
                $miningMode.append($("<option>", { value, text }));
            }
            const $miningDuration = $("<select>", { id: "FleetMiningDuration", "aria-label": "Время добычи" });
            (miningRules.durations || []).forEach(value => $miningDuration.append($("<option>", { value, text: `${value / 3600} ч` })));
            $miningDuration.val(String(miningRules.default_duration || 3600));
            const $miningFinish = $("<select>", { id: "FleetMiningFinish", "aria-label": "После добычи" }).append(
                $("<option>", { value: "return", text: "Вернуться на домашнюю базу" }),
                $("<option>", { value: "stay", text: "Остаться на ресурсной базе" }));
            const $miningEstimate = $("<p>");
            const getMining = () => ({ mode: Number(this.navigation.$objectType?.val()) === 4 ? "deuterium"
                : ["metal", "crystal", "mix"].includes($miningMode.val()) ? $miningMode.val() : "mix",
                duration: Number($miningDuration.val()), finish: $miningFinish.val() });
            const $miningPanel = $("<div>").addClass("FleetDefendOptions FleetMiningOptions").append(
                $("<label>").append("Добывать: ", $miningMode), $("<label>").append("Время работы: ", $miningDuration),
                $("<label>").append("После добычи: ", $miningFinish), $miningEstimate,
                $("<p>").text("Работа ограничена обследованным резервом, свободным трюмом и топливом на возвращение. На свободном объекте флот установит контроль без боя. Добытый дейтерий остаётся грузом."));
            $miningPanel.hide();
            $miningMode.add($miningDuration).add($miningFinish).on("change", () => this.coordinatesChanged(FleetId, null, true));

            const groups = this.messageData.data.Page?.AttackGroups || [];
            const $attackGroup = $("<select>", { id: "FleetAttackGroup", "aria-label": "Приглашения в САБ" })
                .addClass("FleetOwnPlanetSelect")
                .append($("<option>", { value: 0,
                    text: groups.length ? "— выбрать группу —" : "— нет приглашений —" }));
            this.navigation.$attackGroup = $attackGroup;
            groups.forEach(group => $attackGroup.append($("<option>", { value: group.id,
                text: `#${group.id} · ${group.ownerName} · [${group.target.galaxy}:${group.target.system}:${group.target.orbit}]${Number(group.target.objectType) === 3 ? " Луна" : ""} · ${formatTimestamp(group.executeAt, "datetime")}` })));
            // Выбор приглашения доступен до ввода координат и выбора миссии.
            $ownPlanetPanel.after($("<label>").addClass("FleetOwnPlanetPanel FleetAttackGroupPanel").append(
                $("<span>").text("Приглашения в САБ:"), $attackGroup));
            const { $picker, $select: $fleetTarget } = this.createFleetTargetPicker(FleetId, target.fleetId);
            $fleetTarget.attr("id", "FleetTargetSelect");
            this.navigation.$fleetTarget = $fleetTarget;
            $fleetTarget.on("change", () => this.selectFleetTarget($fleetTarget.find(":selected").data("fleetTarget"), FleetId));
            $(".FleetAttackGroupPanel", $coordPanel).after($("<label>").addClass("FleetOwnPlanetPanel FleetFleetTargetPanel")
                .append($("<span>").text("Целевой флот:"), $picker));
            const $refuel = $("<input>", { type: "checkbox", id: "FleetRefuelReceiver", checked: true });
            const $refuelPanel = $("<label>").addClass("FleetRefuelOption").append($refuel,
                $("<span>").text("Дейтерий груза — в топливный бак получателя"));
            const $freeHoldPanel = $("<p>").addClass("FleetHoldNotice").text(
                `Бессрочное удержание расходует ${100 * (this.messageData.data.Page?.FleetCapabilities?.holdFuelFactor ?? .1)}% базового топлива в час, включая запас на возврат. Для него максимум загрузки — свободная вместимость. При исчерпании флот останется на месте; после дозаправки продолжение вручную.`);
            const $attackAt = $("<input>", { type: "datetime-local", id: "FleetAttackAt", step: 1 });
            const $invite = $("<input>", { type: "text", id: "FleetAttackInvite", maxlength: 32,
                list: "FleetAttackInviteSuggestions", placeholder: "Игровое имя, не логин аккаунта", "aria-label": "Пригласить игрока" });
            const $suggestions = $("<datalist>", { id: "FleetAttackInviteSuggestions" });
            // Друзья — только подсказки: пригласить можно любого игрока.
            (this.messageData.data.Page?.AttackFriends || []).forEach(friend => $suggestions.append(
                $("<option>", { value: friend.name })));
            const $newGroup = $("<div>").append(
                $("<label>").text("Общее время прибытия: ").append($attackAt),
                $("<small>").text("Пустое поле — сервер выберет срок с запасом. Скорость будет снижена автоматически, но не выше выбранной."),
                $("<label>").text("Пригласить игрока (необязательно): ").append($invite), $suggestions,
                $("<small>").text("Дружба не обязательна. Других участников можно пригласить после вылета кнопкой «Группа»."));
            const $inviteToGroup = $("<button>", { type: "button", text: "Участники" })
                .hide().on("click", () => this.showAttackGroup(Number($attackGroup.val())));
            const $groupOptions = $("<div>").addClass("FleetGroupAttackOptions").hide()
                .append($newGroup, $inviteToGroup,
                    $("<small>").text("Участники прибывают к одной цели одновременно. Присоединение не сдвигает общий срок."));
            $attackGroup.on("change", () => {
                const group = groups.find(item => Number(item.id) === Number($attackGroup.val()));
                if (group) {
                    this.selectAttackGroupTarget(group, FleetId);
                } else {
                    this.updateMissionSendState?.();
                }
            });
            $MissionPanel.append(
                $("<h3>").addClass("FleetSectionTitle").text("Миссия"),
                $missionSelector,
                $holdPanel,
                $expeditionPanel,
                $miningPanel,
                $interceptionPanel,
                $groupOptions,
                $freeHoldPanel,
                //$addCmdBtn,
                //$clearBtn
            );

            //$sendPanel.append($coordPanel);

            // Инфо Поле

            const $infoPanel = $("<div>").addClass("box FleetInfoPanel");
            $infoPanel.append($("<h3>").addClass("FleetSectionTitle").text("Расчёт полёта"));

            const infoMap = {
                coords: "Coords",
                distance: "Distance",
                duration: "Duration",
                fuel: "Fuel",
                survey: "Survey",
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
                survey: "Обследование:",
                storage: "Грузоподъемность:",
                maxspeed: "Максимальная скорость:"
            };

            Object.entries(infoLabels).forEach(([key, label]) => {
                $infoPanel.append(
                    $("<div>").addClass("FleetInfoRow").append(
                        this.createSpan(label, null, "FleetInfoLabel"), infos[key])
                );
            });

            // Скорость и топливо используют серверный расчёт TravelInfo.
            const $flightSettingsPanel = $("<div>").addClass("box FleetFlightSettingsPanel");
            $flightSettingsPanel.append($("<h3>").addClass("FleetSectionTitle").text("Параметры полёта"));
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
            $speedRange.attr("aria-label", "Скорость полёта, %");

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
            $fuelRange.attr("aria-label", "Загрузить топлива");
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
                    $("<label>", { for: "FleetSpeedRange", text: "Скорость" }).addClass("FleetInfoLabel"),
                    $speedValue
                ),
                $speedRange,
                $("<div>").addClass("FleetRangeHeader FleetFuelHeader").append(
                    $("<label>", { for: "FleetFuelRange", text: "Загрузить топлива" }).addClass("FleetInfoLabel"),
                    $fuelValue
                ),
                $fuelRange
            );



            // Поля ввода ресурсов

            const $resourcesPanel = $("<div>").addClass("box FleetResourcesPanel");
            const $resourcesTitle = $("<h3>").addClass("FleetSectionTitle FleetResourcesTitle").text("Загрузка ресурсов");
            const $resourcesGrid = $("<div>").addClass("FleetResourcesGrid");
            const $resourcesFooter = $("<div>").addClass("FleetResourcesFooter");

            const resourceIds = [901, 902, 903]
                .filter((resId) => Data.Resources?.[resId] !== undefined);

            const resourceInputs = {};
            const fleetCapacity = Math.max(0, Math.floor(Number(Fleet.capacity) || 0));
            const existingCargo = Math.max(0, Math.floor(
                Object.values(Fleet.resources || {}).reduce(
                    (sum, resource) => sum + (Number(resource?.id) === 921 ? 0 : (Number(resource?.count) || 0)),
                    0
                )
            ));
            const existingFuel = Math.max(0, resourceSource ? this.standingFuel(Fleet) : Number(Fleet.fuel) || 0);
            const parseNumber = (value) => Math.max(0, Math.floor(Number(value) || 0));
            let travelInfo = null;
            let fuelTouched = false;

            const $remainingResources = this.createSpan("-", "FleetRemainingResources", "FleetRemainingValue");
            const $loadStatus = $("<div>").addClass("FleetLoadStatus").hide();

            const getFuel = () => parseNumber($fuelRange.val());
            const getPlanetResource = (resId) => resourceSource ? 0 : parseNumber(Data.Resources?.[resId]?.count);
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
                if (Number(this.selectedMission) !== this.getHoldMissionId() && !this.isResourceBaseMission()
                    && fuel > Math.max(0, maximumFuel - existingFuel)) {
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
                const resourceName = Lang.tech?.[resId] || `Ресурс ${resId}`;
                const $label = $("<label>", { for: `ResInput${resId}`, text: resourceName }).addClass("FleetResLabel");
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
                    "aria-label": `Очистить: ${resourceName}`
                }).on("click", () => {
                    $input.val(0).trigger("input");
                }).ToolTip("Очистить ресурс");

                const $setMaxBtn = $("<button>", {
                    type: "button",
                    class: "btn-box btn-box-right FleetResBtn",
                    "aria-label": `Максимум: ${resourceName}`
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
                }).ToolTip("Заполнить максимум");

                resourceInputs[resId] = $input;

                $controls.append($setZeroBtn, $input, $setMaxBtn);
                $resourcesGrid.append($("<div>").addClass("FleetResRow").append($label, $controls));
            });

            const $remainingWrap = $("<div>").addClass("FleetRemainingWrap").append(
                this.createSpan("Свободно для груза:", null, "FleetResLabel"),
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
            if (resourceSource) {
                $resourcesTitle.text("Груз на борту");
                $resourcesGrid.empty();
                Object.values(Fleet.resources || {}).filter(item => item.count > 0).forEach(item =>
                    $resourcesGrid.append($("<div>").addClass(`ResBox icon${item.id}`).text(`${Lang.tech[item.id]}: ${number_format(item.count)}`)));
                if (!existingCargo) $resourcesGrid.append($("<span>").text("Трюм пуст"));
                $resourcesFooter.hide();
                $resourcesPanel.append($("<small>").text("У базы нет склада. Используются только бортовой груз и бак; при передислокации на планету они будут выгружены."));
                $fuelRange.hide();
                $flightSettingsPanel.find("label[for='FleetFuelRange']").text("Топливо на борту");
            }

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
                const isAttack = selectedMissionId === this.getAttackMissionId();
                $interceptionPanel.toggle(isAttack && Number(this.navigation.$type?.[0]?.value) === 3);
                const isGroupAttack = selectedMissionId === this.getGroupAttackMissionId();
                const isFreeHold = selectedMissionId === this.getHoldMissionId();
                const isExpedition = selectedMissionId === this.getExpeditionMissionId();
                const isMining = selectedMissionId === 50;
                $miningPanel.toggle(isMining);
                const gasMining = Number(this.navigation.$objectType?.val()) === 4;
                $miningMode.find("option").each((_, option) => { option.hidden = gasMining !== (option.value === "deuterium"); });
                $miningMode.val(getMining().mode);
                const currentExpeditionLimits = this.messageData.data.Page?.ExpeditionLimits || {};
                const maxHours = Number(currentExpeditionLimits.maxHours || 0);
                if ($expeditionDuration.children().length !== maxHours) {
                    const previous = $expeditionDuration.val();
                    this.updateSelectOptions($expeditionDuration, Array.from({ length: maxHours }, (_, i) => ({ value: (i + 1) * 3600, text: `${i + 1} ч` })), previous);
                }
                $expeditionSlots.text(`Экспедиции: ${currentExpeditionLimits.used || 0} / ${currentExpeditionLimits.max || 0}. Лимит и время определяет астрофизика.`);
                $expeditionPanel.toggle(isExpedition);
                $freeHoldPanel.toggle(isFreeHold);
                $refuelPanel.toggle(isTransport && Number(this.navigation.$type?.[0]?.value) === 3);
                if (!isGroupAttack) $attackGroup.val(0);
                const hasAttackGroup = Number($attackGroup.val()) > 0;
                $newGroup.toggle(!hasAttackGroup);
                const selectedGroup = groups.find(group => Number(group.id) === Number($attackGroup.val()));
                $inviteToGroup.toggle(hasAttackGroup)
                    .text(selectedGroup?.canInvite === true ? "Участники / пригласить" : "Участники");
                const isDestroy = selectedMissionId === this.getDestroyMissionId();
                $groupOptions.toggle(isGroupAttack);
                const isDefend = selectedMissionId === this.getDefendMissionId();
                $holdPanel.toggle(isDefend);
                const isRelocation = selectedMissionId === relocateMissionId;
                const isSpy = selectedMissionId === this.getSpyMissionId();
                const isRecycle = selectedMissionId === this.getRecycleMissionId();
                const isColonization = selectedMissionId === this.getColonizeMissionId();
                const isMerge = selectedMissionId === this.getMergeMissionId();
                $resourcesPanel.toggle(!isSpy);
                if (isSpy) resourceIds.forEach(resId => resourceInputs[resId].val(0));
                const hasRequiredCargo = !isTransport || existingCargo + getLoadedResources() > 0;
                const slots = this.messageData.data.Page?.FleetLimits?.missions;
                const hasMissionSlot = !slots || slots.used < slots.max;
                const hasExpeditionSlot = !isExpedition || (Number(currentExpeditionLimits.used) < Number(currentExpeditionLimits.max) && Number($expeditionDuration.val()) > 0);
                const canSend = (isAttack || isGroupAttack || isDestroy || isDefend || isTransport || isRelocation || isSpy || isRecycle || isColonization || isFreeHold || isExpedition || isMerge || isMining || selectedMissionId === 25 || selectedMissionId === 45)
                    && !this.missionDataLoading
                    && (Number(this.navigation.$type?.[0]?.value) !== 3 || this.isNavigationTarget(this.getNavigationCoordinates()))
                    && travelInfo !== null
                    && getLoadError() === ""
                    && hasRequiredCargo
                    && hasExpeditionSlot
                    && hasMissionSlot;

                $sendBtn
                    .prop("disabled", !canSend)
                    .attr("title", canSend && isMining ? "Отправить флот на добычу" : canSend && isExpedition ? "Отправить флот в экспедицию" : canSend && isDefend ? "Отправить флот на оборону друга" : canSend && isAttack ? "Отправить флот в атаку" : canSend
                        ? (isColonization ? "Отправить флот для колонизации" : (isRecycle ? "Отправить флот на переработку обломков" : (isSpy ? "Отправить разведывательный флот" : (isRelocation ? "Передислоцировать флот" : "Отправить транспортную миссию"))))
                        : (!hasMissionSlot ? "Достигнут лимит активных миссий. Повысьте компьютерную технологию."
                            : "Выберите миссию, цель и достаточное количество топлива; для транспорта добавьте груз"));
            };

            this.flightControls = {
                getSpeedFactor: () => parseNumber($speedRange.val()) / 10,
                applyTravelInfo: (newTravelInfo) => {
                    travelInfo = newTravelInfo || null;
                    const mining = travelInfo?.mining;
                    $miningEstimate.text(mining ? `Производительность: ${humanNumber(Object.values(mining.rates).reduce((sum, rate) => sum + Number(rate), 0), true, 2)}/ч · топливо на работу: ${humanNumber(mining.workFuel, true, 2)} · обследовано ${Math.round(mining.coverage * 100)}%.` : "");
                    $holdRate.text(travelInfo?.defendSupplyPerHour === undefined ? "—" : humanNumber(travelInfo.defendSupplyPerHour, true, 3));
                    $holdSupplySource.text(travelInfo?.resourceDefense ? " дейтерия/ч из бортового бака." : " дейтерия/ч с принимающего объекта.");
                    $holdSupplyNote.text(travelInfo?.resourceDefense
                        ? "Запасы объекта не расходуются. При достижении топливного резерва флот вернётся домой."
                        : "Когда дейтерий у принимающей стороны закончится, флот вернётся досрочно.");
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
                        (Number(this.selectedMission) === this.getHoldMissionId() || this.isResourceBaseMission()
                            ? fleetCapacity - existingCargo : Math.ceil(Number(travelInfo.fuel.max) || 0)) - existingFuel
                    );
                    const fuelMin = calculatedFuelMin;
                    const fuelMax = resourceSource ? 0 : Math.max(0, Math.min(
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
                    $fuelValue.text(humanNumber(resourceSource ? existingFuel : selectedFuel, true, 2));
                    updateRangeVisual($fuelRange);
                    updateResourceLimits();
                },
                getPayload: () => ({
                    fleetId: FleetId,
                    coordinates: this.getNavigationCoordinates(),
                    missionType: this.selectedMission,
                    mining: Number(this.selectedMission) === 50 ? getMining() : null,
                    refuel: Number(this.navigation.$type?.[0]?.value) === 3 && $refuel.prop("checked"),
                    contactLoss: Number(this.selectedMission) === this.getAttackMissionId() && Number(this.navigation.$type?.[0]?.value) === 3
                        ? $contactLoss.val() : null,
                    duration: Number(this.selectedMission) === this.getDefendMissionId() ? Number($holdDuration.val())
                        : Number(this.selectedMission) === this.getExpeditionMissionId() ? Number($expeditionDuration.val()) : null,
                    group: Number(this.selectedMission) === this.getGroupAttackMissionId() ? {
                        id: Number($attackGroup.val()),
                        ...($attackAt.val() ? { executeAt: new Date($attackAt.val()).getTime() / 1000 } : {}),
                        usernames: $invite.val().trim() ? [$invite.val().trim()] : []
                    } : null,
                    speedFactor: parseNumber($speedRange.val()) / 10,
                    fuel: getFuel(),
                    resources: Object.fromEntries(
                        resourceIds.map((resId) => [resId, parseNumber(resourceInputs[resId].val())])
                    )
                })
            };

            const $missionDataPanel = $("<div>").addClass("FleetMissionDataPanel").append(
                $MissionPanel,
                $("<div>").addClass("FleetFlightParameters").append($flightSettingsPanel, $infoPanel),
                $resourcesPanel,
                $refuelPanel
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




        Dialog.create($panel, `Отправка · ${Fleet.name || `Флот #${FleetId}`}`, [
            { text: Lang.Close, action: () => Dialog.close() }
        ], {
            width: 560,
            overlay: true,
            drag: true
        });
        if ($sendButton) $(Dialog.dialogDiv).find("dialog-buttons").prepend($sendButton);

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


    sendFleetControl(action, fleetId, extra = {}, onError = null) {
        GameEvents.emit("SendServer", { mode: "fleets", action, data: { fleetId, ...extra }, NotOverlay: true,
            ...this.getRequestOptions({ kind: "command" }), onSuccess: () => {},
            onError: error => onError ? onError(error) : Dialog.ErrorLoad(error?.message || "Управление флотом недоступно.") });
    }

    showFleetResume(fleetId) {
        const fleet = this.messageData.data.Page?.FlyingFleets?.[fleetId];
        if (fleet?.actions?.ResumeFleet === false) return;
        if (!fleet || fleet.is_own === false || fleet.battle
            || !(fleet.control?.paused || (fleet.control?.holding && fleet.control?.can_continue))) return;
        ToolTip.hide();
        const fuel = this.getFlyingFleetDisplayFuel(fleet, GameServerTime.now());
        const cargo = Math.max(0, Number(fleet.resources?.[903]?.count) || 0);
        const capabilities = this.messageData.data.Page?.FleetCapabilities || {};
        const cargoRefuel = capabilities.cargoRefuel === true;
        const cargoRequirement = `Для дозаправки из трюма нужна Флотовая логистика ${capabilities.cargoRefuelLevel}.`;
        const hasMove = (fleet.commands || []).some(command => command.status !== "completed" && [10, 11, 12].includes(Number(command.type)));
        const loading = fleet.control?.loading_pending === true;
        const $content = $("<div>").addClass("FleetResumeForm");
        const $error = $("<div>").addClass("FleetResumeError").attr("role", "alert").hide();
        $content.append($("<div>").addClass("FleetResumeSummary").append(
            $("<span>").text(`Топливо: ${number_format(fuel, 2)}`),
            $("<span>").text(`Дейтерий в трюме: ${number_format(cargo, 2)}`)
        ));
        const choices = [
            { mode: "available", title: loading ? "Повторить погрузку" : "Лететь, пока хватит топлива", disabled: !loading && fuel <= .000001,
                description: loading ? "Повторно проверить запасы своей планеты / луны и свободный трюм. При успехе — погрузить и продолжить маршрут."
                    : "Без использования груза. Если топлива не хватит на внутрисистемный участок, флот остановится в промежуточной точке." },
            { mode: "segment", title: "Дозаправить до следующего участка", disabled: !cargoRefuel || !hasMove || fuel + cargo <= .000001,
                description: cargoRefuel ? "Перевести из трюма только недостающий дейтерий для завершения ближайшей команды перелёта. Далее груз автоматически не расходуется." : cargoRequirement },
            { mode: "route", title: "Дозаправить до конца маршрута", disabled: !cargoRefuel || !hasMove || fuel + cargo <= .000001,
                description: cargoRefuel ? "Загрузить расчётный резерв для всех оставшихся перелётов, включая возврат. Этот дейтерий останется топливом, а не грузом для промежуточной выгрузки." : cargoRequirement }
        ];
        let selected = false;
        (loading ? choices.slice(0, 1) : choices).forEach(choice => {
            const checked = !selected && !choice.disabled;
            if (checked) selected = true;
            $content.append($("<label>").addClass("FleetResumeOption").append(
                $("<input>", { type: "radio", name: "fleet-resume-mode", value: choice.mode, disabled: choice.disabled, checked }),
                $("<span>").append($("<strong>").text(choice.title), $("<small>").text(choice.description))
            ));
        });
        $content.append($("<p>").addClass("FleetResumeHint").text(
            loading ? "Пустой бак не мешает погрузке у текущего объекта. Ресурсы и вместимость будут проверены повторно. Если условия не выполнены, флот останется на паузе без списания."
                : "Межсистемные и межгалактические переходы, а также переходы между планетой, луной и обломками на одной орбите требуют полного запаса. При нехватке дейтерия дозаправка не применяется. Бой, изменение маршрута или состава флота могут изменить резерв. Бессрочное удержание не входит в расчёт всего маршрута."
        ), $error);
        let submitting = false;
        const alive = () => $.contains(Dialog.dialogDiv, $content[0]) && $(Dialog.dialogDiv).is(":visible");
        const submit = () => {
            const mode = $content.find("input:checked").val();
            if (submitting || !mode) return;
            submitting = true;
            $error.hide();
            $(Dialog.dialogDiv).find(".FleetResumeSubmit").prop("disabled", true);
            GameEvents.emit("SendServer", { mode: "fleets", action: "ResumeFleet", data: { fleetId, fuelMode: mode }, NotOverlay: true,
                ...this.getRequestOptions({ kind: "command" }),
                onSuccess: () => { if (alive()) Dialog.close(); },
                onError: error => {
                    if (!alive()) return;
                    submitting = false;
                    $(Dialog.dialogDiv).find(".FleetResumeSubmit").prop("disabled", false);
                    $error.text(error?.message || "Не удалось продолжить полёт.").show();
                }
            });
        };
        Dialog.create($content, `Продолжить · ${fleet.name || `Флот #${fleetId}`}`, [
            { text: "Продолжить", class: ["btn-info", "FleetResumeSubmit"], action: submit },
            { text: "Отмена", action: () => Dialog.close() }
        ], { width: Math.min(520, innerWidth - 20), overlay: true });
        $(Dialog.dialogDiv).find(".FleetResumeSubmit").prop("disabled", !selected);
    }

    // Тот же контракт логического этапа, что FleetPlanService::stageCount.
    fleetPlanStageCount(active, steps) {
        if (!active) return steps.length;
        const first = steps[0] || {};
        const target = active.coordinates;
        const keys = { 1: ["type", "galaxy", "system", "orbit", "objectType", "siteId"],
            2: ["type", "galaxy", "system", "distance", "angle"], 3: ["type", "fleetId"] };
        const sameTarget = target && first.coordinates && (keys[Number(target.type)] || []).every(key =>
            (target[key] == null && first.coordinates[key] == null) || Number(target[key]) === Number(first.coordinates[key]));
        const continues = active.moving && ((first.kind === "return" && active.returning)
            || (["move", "mission", "transfer", "load"].includes(first.kind) && sameTarget));
        return steps.length + (continues ? 0 : 1);
    }

    showFleetPlan(fleetId) {
        const page = this.messageData.data.Page;
        const fleet = page?.FleetList?.[fleetId] || page?.FlyingFleets?.[fleetId];
        if (!fleet?.control || fleet.actions?.SetFleetCommands === false) return;
        const idle = Number(fleet.status ?? 1) === 0;
        const capabilities = page.FleetCapabilities || {};
        if (!(idle ? capabilities.plan : capabilities.edit)) return;
        const maxStages = Number(capabilities.maxStages) || 0;
        const ownPlanets = Object.values(this.messageData.data?.PlanetList?.Planets || {});
        const ownPosition = page.FleetTargets?.find(item => Number(item.id) === Number(fleetId))?.position
            || fleet.current || fleet.segment_start || {};
        const missions = (page.FleetMissions || [])
            .filter(m => m.key !== "OBSERVE" || capabilities.hold);
        const missionName = id => {
            const mission = missions.find(m => Number(m.id) === Number(id));
            return mission ? (Lang[mission.lang] || mission.key) : "Выберите миссию";
        };
        const input = (type, value, attrs = {}) => $("<input>", { type, ...attrs }).val(value);
        const field = (text, element) => $("<label>").append($("<span>").text(text), element);
        const section = title => $("<section>").addClass("box").append($("<h3>").addClass("FleetSectionTitle").text(title));
        const selector = (items, value, classes) => {
            const $selector = $("<icon-selector>").addClass(classes);
            const element = $selector[0];
            element.setTooltipHandler((button, item) => $(button).ToolTip(item.tooltip || item.label));
            element.single = true;
            element.vertical = false;
            element.items = items;
            element.value = value;
            return $selector;
        };
        const fillRange = $range => {
            const min = Number($range.attr("min")), max = Number($range.attr("max"));
            const progress = max > min ? (Number($range.val()) - min) / (max - min) * 100 : 0;
            $range[0].style.setProperty("--fleet-range-progress", Math.max(0, Math.min(100, progress)) + "%");
        };
        const number = value => Math.max(0, Math.floor(Number(value) || 0));
        const rows = [];
        const stageCount = () => this.fleetPlanStageCount(fleet.control.planActiveStage, rows.map(row => row.read()));
        let sequence = 0, active = null, opened = false, submitting = false;
        const $list = $("<nav>").addClass("FleetPlanSteps").attr("aria-label", "Этапы маршрута");
        const $details = $("<div>").addClass("FleetPlanDetails");
        const $count = $("<span>").addClass("FleetPlanCount");
        const $error = $("<p>").addClass("FleetPlanError").attr("role", "alert").hide();
        const $content = $("<div>").addClass("FleetTaskPanel FleetPlanEditor");
        const $loadSummary = $("<small>");
        const $loadButton = $("<button>", { type: "button", "aria-controls": "FleetPlanLoading" })
            .addClass("FleetPlanStop FleetPlanLoadButton").append(
                $("<span>").addClass("FleetPlanStopNumber mdi mdi-package-variant"),
                $("<span>").addClass("FleetPlanStopText").append($("<strong>").text("Погрузка"), $loadSummary));
        const cargo = Object.values(fleet.resources || {}).reduce((sum, r) => sum + (Number(r.id) === 921 ? 0 : Math.max(0, Number(r.count) || 0)), 0);
        const freeCapacity = Math.max(0, Math.floor((Number(fleet.capacity) || 0) - cargo - Math.max(0, Number(fleet.fuel) || 0)));
        const stock = id => number(Data.Resources?.[id]?.count ?? this.messageData.data.TopNav?.Resources?.[id]?.count);
        const resourceInputs = {};
        const fuelMax = () => Math.min(freeCapacity, stock(903));
        const $fuel = input("number", Math.min(1000, fuelMax()), { id: "FleetPlanFuel", min: 0, max: fuelMax(), step: 1,
            "aria-label": "Добавить топлива" }).addClass("FleetPlanNumber");
        const $fuelRange = input("range", $fuel.val(), { min: 0, max: fuelMax(), step: 1,
            "aria-label": "Запас топлива" }).addClass("FleetRangeInput");
        const $fuelBox = section("Топливо на весь маршрут").addClass("FleetFlightSettingsPanel").append(
            $("<div>").addClass("FleetRangeHeader").append($("<label>", { for: "FleetPlanFuel", text: "Добавить в бак" }), $fuel),
            $fuelRange, $("<p>").addClass("FleetPlanHint").text(
                "Запас задаётся вручную. Расход каждого перелёта рассчитывается при его начале; при нехватке топлива флот остановится."));
        const $fuelNotice = $("<div>").addClass("FleetPlanFuelNotice").attr("role", "status");
        const updateFuelNotice = () => {
            const steps = rows.map(row => row.read());
            const legs = rows.filter((row, index) => ["mission", "move", "load", "return"].includes(steps[index].kind));
            const fuel = Math.max(0, Number(fleet.fuel) || 0) + (idle ? number($fuel.val()) : 0);
            const format = value => humanNumber(Math.ceil(value), true, 2);
            const pending = legs.some(row => row.pending || row.missionPending);
            const unknown = legs.some(row => !row.fuelEstimate);
            const min = legs.reduce((sum, row) => sum + (row.fuelEstimate?.min || 0), 0);
            const max = legs.reduce((sum, row) => sum + (row.fuelEstimate?.max || 0), 0);
            const uncertain = steps.some(step => step.kind === "hold" || [1, 3, 5, 7, 15, 30, 40].includes(step.mission) || step.coordinates?.type === 3);
            const warning = !pending && (unknown || fuel < max || uncertain);
            const state = pending ? "Расчёт расхода всех перелётов…" : unknown ? "Не удалось оценить весь маршрут. Достаточность топлива не подтверждена."
                : fuel < min ? "Топлива недостаточно даже для минимального расчётного расхода."
                    : fuel < max ? "Топлива может не хватить на весь маршрут: флот остановится при его исчерпании."
                        : "Запас покрывает расчётный расход перелётов.";
            const note = (uncertain ? " Бой, экспедиция, изменение состава или движение цели могут изменить расход; бессрочное удержание в расчёт не входит." : "")
                + (steps.some(step => step.kind === "load") ? " Будущие дозаправки здесь не прибавляются к запасу: ресурсы проверяются только по прибытии." : "");
            $fuelNotice.attr("data-level", warning ? "warning" : "info");
            this.cardField($fuelNotice, "amount", "strong", "", "Топливо: " + format(fuel)
                + (!pending && !unknown ? " · Маршрут ≈ " + format(min) + (max !== min ? "–" + format(max) : "") : ""));
            this.cardField($fuelNotice, "state", "span", "", state + note);
        };
        const $resourcesBox = section("Загрузка ресурсов").addClass("FleetResourcesPanel");
        const $resourcesGrid = $("<div>").addClass("FleetResourcesGrid");
        const $remaining = $("<strong>").addClass("FleetRemainingValue");
        const $loadPanel = $("<div>", { id: "FleetPlanLoading" }).addClass("FleetPlanLoading").append($fuelBox, $resourcesBox);
        const loaded = () => Object.values(resourceInputs).reduce((sum, $input) => sum + number($input.val()), 0);
        const available = id => Math.max(0, stock(id) - (id === 903 ? number($fuel.val()) : 0));
        const cargoLimit = () => Math.max(0, freeCapacity - number($fuel.val()));
        const updateLoad = changedId => {
            const fuel = Math.min(number($fuel.val()), fuelMax());
            $fuel.attr("max", fuelMax()).val(fuel);
            $fuelRange.attr("max", fuelMax()).val(fuel);
            fillRange($fuelRange);
            if (resourceInputs[changedId]) {
                const others = loaded() - number(resourceInputs[changedId].val());
                resourceInputs[changedId].val(Math.min(number(resourceInputs[changedId].val()),
                    available(changedId), Math.max(0, cargoLimit() - others)));
            }
            let remaining = cargoLimit();
            [901, 902, 903].forEach(id => {
                const value = Math.min(number(resourceInputs[id].val()), available(id), remaining);
                resourceInputs[id].val(value);
                remaining -= value;
            });
            [901, 902, 903].forEach(id => resourceInputs[id].attr("max",
                Math.min(available(id), Math.max(0, cargoLimit() - loaded() + number(resourceInputs[id].val())))));
            $remaining.text(humanNumber(remaining, true, 2));
            $loadSummary.text("Топливо: " + humanNumber(fuel, true, 2) + " · Груз: " + humanNumber(loaded(), true, 2));
            updateFuelNotice();
        };
        [901, 902, 903].forEach(id => {
            const name = Lang.tech?.[id] || String(id);
            const $input = input("number", 0, { min: 0, step: 1, id: "FleetPlanResource" + id, "aria-label": name }).addClass("FleetResInput");
            resourceInputs[id] = $input;
            const $zero = $("<button>", { type: "button", "aria-label": "Очистить: " + name })
                .addClass("btn-box btn-box-left FleetResBtn").ToolTip("Очистить ресурс")
                .on("click", () => { $input.val(0); updateLoad(id); });
            const $max = $("<button>", { type: "button", "aria-label": "Максимум: " + name })
                .addClass("btn-box btn-box-right FleetResBtn").ToolTip("Заполнить свободный трюм")
                .on("click", () => {
                    $input.val(Math.min(available(id), Math.max(0, cargoLimit() - loaded() + number($input.val()))));
                    updateLoad(id);
                });
            $input.on("input change", () => updateLoad(id));
            $resourcesGrid.append($("<div>").addClass("FleetResRow").append(
                $("<label>", { for: "FleetPlanResource" + id, text: name }).addClass("FleetResLabel"),
                $("<div>").addClass("FleetResControls").append($zero, $input, $max)));
        });
        const $fillAll = $("<button>", { type: "button", text: "Все ресурсы" }).addClass("FleetAllResBtn").on("click", () => {
            let remaining = cargoLimit();
            [901, 902, 903].forEach(id => {
                const value = Math.min(available(id), remaining);
                resourceInputs[id].val(value); remaining -= value;
            });
            updateLoad();
        });
        $resourcesBox.append($resourcesGrid, $("<div>").addClass("FleetResourcesFooter").append(
            $("<span>").addClass("FleetRemainingWrap").append("Свободно для груза: ", $remaining), $fillAll));
        $fuel.on("input change", () => updateLoad());
        $fuelRange.on("input change", () => { $fuel.val($fuelRange.val()); updateLoad(); });
        updateLoad();
        $details.append($loadPanel);
        const alive = () => opened && $.contains(Dialog.dialogDiv, $content[0]) && $(Dialog.dialogDiv).is(":visible");
        const updateSubmit = () => {
            if (alive()) $(Dialog.dialogDiv).find("dialog-buttons button").first().prop("disabled",
                submitting || rows.length === 0 || stageCount() > maxStages
                || rows.some(row => row.pending || row.missionPending || row.missionError || row.navigationError));
        };
        const refresh = () => {
            $count.text(stageCount() + " / " + maxStages).toggleClass("red_text", stageCount() > maxStages);
            rows.forEach((row, index) => {
                const step = row.read();
                const name = step.kind === "mission" ? missionName(step.mission)
                    : { move: "Перелёт", load: "Погрузка / заправка", hold: "Удержание", return: "Возврат на базу" }[step.kind];
                row.$number.text(index + 1);
                row.$name.text(name);
                row.$heading.text("Этап " + (index + 1) + " · " + name);
                row.$caption.text(step.coordinates ? this.formatFleetCoordinate(step.coordinates)
                    : step.kind === "return" ? "Выгрузить груз и остаток топлива" : "До команды «Продолжить»");
                row.$up.prop("disabled", index === 0);
                row.$down.prop("disabled", index === rows.length - 1);
                if ($list[0].children[index] !== row.$button[0]) {
                    $list[0].insertBefore(row.$button[0], $list[0].children[index] || null);
                } // Панели с icon-selector не перемещаем и не подключаем повторно.
            });
            $add.prop("disabled", stageCount() >= maxStages);
            rows.forEach(row => row.requestMissions());
            updateFuelNotice();
            updateSubmit();
        };
        const select = row => {
            active = row;
            $loadPanel.toggle(idle && row === null);
            $loadButton.toggleClass("FleetPlanStopActive", row === null).attr("aria-current", row === null ? "step" : null);
            rows.forEach(item => {
                item.$panel.toggle(item === row);
                item.$button.toggleClass("FleetPlanStopActive", item === row).attr("aria-current", item === row ? "step" : null);
            });
            if (opened) row?.requestSystem();
        };
        $loadButton.on("click", () => select(null));
        const addStep = (initial = { kind: "mission", mission: 10 }, restoring = false) => {
            // Старый длинный маршрут показываем целиком: игрок сам сокращает его перед сохранением.
            if (!restoring && stageCount() >= maxStages) return;
            const uid = ++sequence;
            const previous = [...rows].reverse().map(row => row.read()).find(step => step.coordinates);
            const position = initial.coordinates || previous?.coordinates || ownPosition;
            const $panel = $("<section>", { id: "FleetPlanStep" + uid }).addClass("FleetPlanStep");
            const $heading = $("<h3>").addClass("FleetPlanStepHeading");
            const $number = $("<span>").addClass("FleetPlanStopNumber");
            const $name = $("<strong>"), $caption = $("<small>");
            const $button = $("<button>", { type: "button", "aria-controls": "FleetPlanStep" + uid }).addClass("FleetPlanStop")
                .append($number, $("<span>").addClass("FleetPlanStopText").append($name, $caption));
            const $mode = selector({
                mission: { label: "Миссия", value: "mission", class: "NavType", imgClass: "mdi mdi-flag-outline", tooltip: "Действие в точке назначения" },
                move: { label: "Перелёт", value: "move", class: "NavType", imgClass: "mdi mdi-rocket-launch", tooltip: "Перелёт без действия" },
                load: { label: "Погрузка", value: "load", class: "NavType", imgClass: "mdi mdi-tray-arrow-up", tooltip: "Загрузить груз и топливо на своей планете / луне" },
                ...(capabilities.hold ? { hold: { label: "Пауза", value: "hold", class: "NavType", imgClass: "mdi mdi-pause-circle-outline", tooltip: "Удерживать до команды игрока" } } : {}),
                return: { label: "Домой", value: "return", class: "NavType", imgClass: "mdi mdi-home-import-outline", tooltip: "Вернуться на базу и выгрузить всё" }
            }, initial.kind === "transfer" ? "mission" : initial.kind, "FleetPlanModeSelector");
            const $mission = selector(this.buildMissionItems(missions), initial.mission || 10, "FleetPlanMissionSelector");
            $mission[0].deselectable = true;
            const $missionTitle = $("<h3>").addClass("FleetSectionTitle");
            const $missionStatus = $("<p>").addClass("FleetPlanHint").attr("role", "status");
            const $missions = $("<section>").addClass("box FleetMissionPanel").append($missionTitle, $mission);
            const $type = selector({
                1: { label: "Объект", value: 1, class: "NavType", imgClass: "FleetCoordinateTypeIcon mdi mdi-orbit" },
                2: { label: "Точка", value: 2, class: "NavType", imgClass: "FleetCoordinateTypeIcon mdi mdi-crosshairs-gps" },
                3: { label: "Флот", value: 3, class: "NavType", imgClass: "FleetCoordinateTypeIcon mdi mdi-rocket-launch" }
            }, position.type || 1, "FleetCoordinateTypeSelector");
            const $object = selector({
                planet: { label: "Планета", value: 1, class: "NavType", imgClass: "NavTypeImg NavTypePlanet" },
                moon: { label: "Луна", value: 3, class: "NavType", imgClass: "NavTypeImg NavTypeMoon" },
                debris: { label: "Обломки", value: 2, class: "NavType", imgClass: "NavTypeImg NavTypeDedris" },
                gas: { label: "Гигант", value: 4, class: "NavType", imgClass: "NavTypeImg NavTypeGasGiant" },
                sector: { label: "Пояс", value: 5, class: "NavType", imgClass: "NavTypeImg NavTypeAsteroidBelt" }
            }, position.objectType || 1, "FleetObjectTypeSelector");
            const $galaxy = input("number", position.galaxy || 1, { min: 1, step: 1, "aria-label": "Галактика" });
            const $system = input("number", position.system || 1, { min: 1, step: 1, "aria-label": "Система" });
            const $orbit = input("number", position.orbit || 1, { min: 1, step: 1, "aria-label": "Орбита" });
            const $distance = input("number", position.distance ?? 1000, { min: 0, step: "any", "aria-label": "Расстояние" });
            const $angle = input("number", position.angle ?? 0, { min: 0, max: 359.999999, step: "any", "aria-label": "Угол" });
            const $own = $("<select>", { "aria-label": "Своя планета" }).addClass("FleetOwnPlanetSelect")
                .append($("<option>", { value: "", text: "— выбрать свою планету / луну —" }));
            ownPlanets.forEach(p => $own.append($("<option>", { value: p.id, text: p.name + " [" + p.galaxy + ":" + p.system + ":" + p.planet + "]" })));
            const { $picker: $targetPicker, $select: $target } = this.createFleetTargetPicker(fleetId, position.fleetId);
            const $ownLabel = field("Своя планета / луна", $own).addClass("FleetOwnPlanetPanel");
            const $targetLabel = field("Целевой флот", $targetPicker).addClass("FleetOwnPlanetPanel");
            const $objectPanel = $("<div>").addClass("FleetObjectTypePanel").append($("<span>").text("Тип объекта"), $object);
            const $site = $("<select>", { "aria-label": "Ресурсный объект маршрута" }).addClass("FleetOwnPlanetSelect");
            if (position.siteId) $site.append($("<option>", { value: position.siteId, text: "Загрузка объекта…" }));
            const $sitePanel = field("Объект / сектор", $site).addClass("FleetOwnPlanetPanel").hide();
            const coordField = (text, $input) => field(text, $input).addClass("FleetCoordinateField");
            const $g = coordField("Галактика", $galaxy), $s = coordField("Система", $system), $o = coordField("Орбита", $orbit);
            const $d = coordField("Расстояние", $distance), $a = coordField("Угол, °", $angle);
            const $fields = $("<div>").addClass("FleetCoordinateFields").append($g, $s, $o, $d, $a);
            const $navStatus = $("<p>").addClass("FleetPlanHint").attr("role", "status").hide();
            const $coords = section("Цель этапа").addClass("FleetCoordsPanel").append(
                $type, $("<div>").addClass("FleetQuickTargets").append($ownLabel, $targetLabel), $objectPanel, $fields, $navStatus);
            // Сохраняем дробный factor программного расписания; ручной выбор — шагом 10%.
            const $speed = input("range", (initial.speedFactor || 10) * 10, { min: 10, max: 100, step: "any", "aria-label": "Скорость полёта" }).addClass("FleetRangeInput");
            const $speedText = $("<strong>").addClass("FleetRangeValue");
            const $speedBox = section("Параметры перелёта").addClass("FleetFlightSettingsPanel").append(
                $("<div>").addClass("FleetRangeHeader").append("Скорость", $speedText), $speed);
            const paintSpeed = () => { $speedText.text(Number($speed.val()).toLocaleString("ru-RU", { maximumFractionDigits: 3 }) + "%"); fillRange($speed); };
            $speed.on("input change", () => { $speed.val(Math.max(10, Math.min(100, Math.round(Number($speed.val()) / 10) * 10))); paintSpeed(); });
            $speed.on("keydown", event => {
                const value = Number($speed.val());
                const next = { ArrowRight: (Math.floor(value / 10) + 1) * 10, ArrowUp: (Math.floor(value / 10) + 1) * 10,
                    ArrowLeft: (Math.ceil(value / 10) - 1) * 10, ArrowDown: (Math.ceil(value / 10) - 1) * 10, Home: 10, End: 100 }[event.key];
                if (next !== undefined) { event.preventDefault(); $speed.val(Math.max(10, Math.min(100, next))).trigger("input"); }
            });
            paintSpeed();
            const $percent = input("number", initial.percent ?? 100, { min: 0, max: 100, step: 1,
                "aria-label": "Процент выгрузки" }).addClass("FleetPlanNumber");
            const $percentRange = input("range", $percent.val(), { min: 0, max: 100, step: 1,
                "aria-label": "Доля оставшегося груза" }).addClass("FleetRangeInput");
            const $refuel = input("checkbox", "").prop("checked", Boolean(initial.refuel));
            const $refuelLabel = field("Дейтерий — в топливный бак целевого флота", $refuel).addClass("FleetRefuelOption");
            const $unload = section("Выгрузка груза").append(
                $("<div>").addClass("FleetRangeHeader").append("Выгрузить, %", $percent), $percentRange,
                $("<p>").addClass("FleetPlanHint").text("Процент от оставшегося груза при прибытии. Топливо в баке не выгружается."), $refuelLabel);
            const updatePercent = () => {
                $percent.val(Math.max(0, Math.min(100, Math.round(Number($percent.val()) || 0))));
                $percentRange.val($percent.val()); fillRange($percentRange);
            };
            $percent.on("input change", updatePercent);
            $percentRange.on("input change", () => { $percent.val($percentRange.val()); updatePercent(); });
            updatePercent();
            const $loadFuel = input("number", initial.fuel ?? 0, { min: 0, max: 1e15, step: "any", "aria-label": "Добавить топливо на остановке" }).addClass("FleetResCount");
            const loadInputs = {};
            const $loadGrid = $("<div>").addClass("FleetResourcesGrid");
            [901, 902, 903].forEach(id => {
                loadInputs[id] = input("number", initial.resources?.[id] ?? 0, { min: 0, max: 1e15, step: "any", "aria-label": "Погрузить " + id }).addClass("FleetResCount");
                $loadGrid.append(field({ 901: "Металл", 902: "Кристалл", 903: "Дейтерий — груз" }[id], loadInputs[id]).addClass("FleetResRow"));
            });
            const $fillResource = $("<select>", { "aria-label": "Заполнить свободный трюм" }).append(
                $("<option>", { value: "", text: "Только указанные количества" }),
                ...[901, 902, 903].map(id => $("<option>", { value: id, text: { 901: "Металлом", 902: "Кристаллом", 903: "Дейтерием — грузом" }[id] }))
            ).val(initial.fillResource ?? "");
            const $shortage = $("<select>", { "aria-label": "При нехватке для погрузки" }).append(
                $("<option>", { value: "wait", text: "Пауза без погрузки" }),
                $("<option>", { value: "partial", text: "Взять доступное и продолжить" })
            ).val(initial.shortage ?? "wait");
            const $loading = section("Погрузка на остановке").addClass("FleetResourcesPanel FleetPlanIntermediateLoad").append(
                field("Топливо — в бак", $loadFuel).addClass("FleetResRow"), $loadGrid,
                field("Остаток трюма заполнить", $fillResource), field("При нехватке ресурсов / места", $shortage),
                $("<p>").addClass("FleetPlanHint").text("Только своя планета или луна. Сначала топливо, затем указанный груз: металл, кристалл, дейтерий; затем заполнение остатка. Бак тоже занимает вместимость. Запасы проверяются по прибытии, без резервирования. При паузе ничего не списывается; уведомление придёт в сообщения."));
            const $duration = $("<select>", { "aria-label": "Время экспедиции" });
            for (let h = 1; h <= Math.max(1, Number(page.ExpeditionLimits?.maxHours || 1)); ++h) $duration.append($("<option>", { value: h * 3600, text: h + " ч" }));
            $duration.val(initial.duration || 3600);
            const $expedition = section("Экспедиция").append(field("Время исследования", $duration));
            const $defense = $("<select>", { "aria-label": "Время обороны" });
            (page.DefenseHours || []).forEach(h => $defense.append($("<option>", { value: h * 3600, text: h + " ч" })));
            $defense.val(initial.duration || 3600);
            const $defend = section("Оборона").append(field("Время удержания", $defense));
            const $mineMode = $("<select>", { "aria-label": "Добыча в этапе" }).append(
                ...[["mix", "Металл и кристалл"], ["metal", "Металл"], ["crystal", "Кристалл"], ["deuterium", "Дейтерий"]].map(([value, text]) => $("<option>", { value, text }))).val(initial.mining?.mode || "mix");
            const $mineTime = $("<select>", { "aria-label": "Время добычи в этапе" }).append(
                ...(page.MiningRules?.durations || [3600]).map(value => $("<option>", { value, text: `${value / 3600} ч` }))).val(initial.mining?.duration || 3600);
            const $mineFinish = $("<select>", { "aria-label": "Завершение добычи в этапе" }).append(
                $("<option>", { value: "return", text: "Продолжить маршрут" }), $("<option>", { value: "stay", text: "Остаться на ресурсной базе" })).val(initial.mining?.finish || "return");
            const $mining = section("Добыча").append(field("Ресурс (у гиганта — дейтерий)", $mineMode), field("Время работы", $mineTime), field("После работы", $mineFinish));
            const $group = $("<select>", { "aria-label": "Групповая атака" }).append($("<option>", { value: 0, text: "Создать новую САБ" }));
            (page.AttackGroups || []).forEach(g => $group.append($("<option>", { value: g.id, text: "САБ #" + g.id + " · " + this.formatFleetCoordinate(g.target) })));
            if (initial.group?.id && !(page.AttackGroups || []).some(g => Number(g.id) === Number(initial.group.id))) {
                $group.append($("<option>", { value: initial.group.id, text: "САБ #" + initial.group.id + " · нет в текущем списке" }));
            }
            $group.val(initial.group?.id || 0);
            const initialGroupTime = initial.group?.executeAt ? this.formatPlanDate(initial.group.executeAt) : "";
            const $groupAt = input("datetime-local", initialGroupTime, { "aria-label": "Время САБ" });
            const $groupTime = field("Время новой САБ (необязательно)", $groupAt);
            const $groups = section("Групповая атака").append(field("САБ / приглашение", $group), $groupTime);
            const $contactLoss = this.createContactLossSelector(initial.contactLoss);
            const $interception = section("Перехват флота").addClass("FleetInterceptionOptions")
                .append(field("При потере контакта", $contactLoss));
            const $notice = $("<p>").addClass("box FleetPlanHint");
            const $up = $("<button>", { type: "button", "aria-label": "Этап выше" }).addClass("mdi mdi-arrow-up").ToolTip("Переместить этап выше");
            const $down = $("<button>", { type: "button", "aria-label": "Этап ниже" }).addClass("mdi mdi-arrow-down").ToolTip("Переместить этап ниже");
            const $remove = $("<button>", { type: "button", "aria-label": "Удалить этап" }).addClass("mdi mdi-close").ToolTip("Удалить этап");
            const mode = () => String($mode[0].value), mission = () => mode() === "mission" ? Number($mission[0].value) : null;
            let navRevision = 0, navInfo = null, navKey = "", ordinaryOrbit = Number(position.orbit) || 1, previousMission = null;
            let missionRevision = 0, missionKey = "", missionTimer = null, availability = null;
            const row = { $panel, $button, $number, $name, $caption, $heading, $up, $down, pending: false, navigationError: "",
                read: () => {
                    const kind = mode(), id = mission(), type = Number($type[0].value);
                    const coordinates = type === 3 ? { type, fleetId: Number($target.val()) }
                        : type === 2 ? { type, galaxy: Number($galaxy.val()), system: Number($system.val()), distance: Number($distance.val()), angle: Number($angle.val()) }
                        : { type, galaxy: Number($galaxy.val()), system: Number($system.val()), orbit: Number($orbit.val()), objectType: id === 40 ? null : Number($object[0].value),
                            ...(id !== 40 && Number($object[0].value) > 3 ? { siteId: Number($site.val()) } : {}) };
                    const site = $site.find(":selected").data("site");
                    // При вводе новой системы/типа список ещё может содержать прежний объект.
                    if (coordinates.siteId && site && ["galaxy", "system", "orbit", "objectType", "siteId"]
                        .some(key => Number(site[key]) !== coordinates[key])) coordinates.siteId = 0;
                    const step = { kind, speedFactor: Number($speed.val()) / 10 };
                    if (["mission", "move", "load"].includes(kind)) step.coordinates = coordinates;
                    if (kind === "load") {
                        step.fuel = Number($loadFuel.val());
                        step.resources = Object.fromEntries(Object.entries(loadInputs).map(([id, $input]) => [id, Number($input.val())]));
                        step.fillResource = $fillResource.val() ? Number($fillResource.val()) : null;
                        step.shortage = $shortage.val();
                    }
                    if (kind === "mission") step.mission = id;
                    if (kind === "mission" && id === this.getAttackMissionId() && type === 3) step.contactLoss = $contactLoss.val();
                    if (id === 10) { step.percent = Number($percent.val()); step.refuel = $refuel.prop("checked"); }
                    if (id === 40) step.duration = Number($duration.val());
                    if (id === 5) step.duration = Number($defense.val());
                    if (id === 50) step.mining = { mode: Number($object[0].value) === 4 ? "deuterium" : $mineMode.val(),
                        duration: Number($mineTime.val()), finish: $mineFinish.val() };
                    if (id === 3) {
                        const groupId = Number($group.val());
                        step.group = groupId === Number(initial.group?.id || 0) ? { ...initial.group, id: groupId } : { id: groupId };
                        if (!groupId) {
                            if ($groupAt.val()) step.group.executeAt = $groupAt.val() === initialGroupTime
                                ? initial.group.executeAt : new Date($groupAt.val()).getTime() / 1000;
                            else delete step.group.executeAt;
                        }
                    }
                    return step;
                },
                requestSystem: () => {
                    if (!alive() || !rows.includes(row) || !["mission", "move", "load"].includes(mode()) || ![1, 2].includes(Number($type[0].value))) return;
                    const key = $galaxy.val() + ":" + $system.val();
                    const apply = () => {
                        const resource = Number($type[0].value) === 1 && Number($object[0].value) > 3 && mission() !== 40;
                        $sitePanel.toggle(resource);
                        if (resource) {
                            const site = this.fillResourceSiteSelect($site, navInfo.resourceSites, Number($object[0].value));
                            if (site) $orbit.val(site.orbit);
                        }
                        if (Number($type[0].value) === 2) {
                            const bounds = this.pointInputBounds(navInfo, $distance.val(), $angle.val());
                            $distance.attr(bounds).prop("disabled", false);
                            $distance.val(Math.max(bounds.min, Math.min(Number($distance.val()) || 0, bounds.max)));
                            $distance.ToolTip(`Расстояние от центра системы: ${number_format(navInfo.minDistance)}–${number_format(navInfo.maxDistance)}`);
                        } else {
                            const expedition = mission() === 40;
                            $orbit.attr("max", expedition ? navInfo.expeditionOrbit : navInfo.maxOrbit).prop("readonly", expedition);
                            $orbit.val(expedition ? navInfo.expeditionOrbit : Math.max(1, Math.min(Number($orbit.val()) || 1, navInfo.maxOrbit)));
                            $orbit.prop("readonly", expedition || resource);
                        }
                        syncOwn(); refresh();
                    };
                    if (navInfo && navKey === key) { apply(); return; }
                    if (row.pending && navKey === key) return;
                    navKey = key; navInfo = null; row.pending = true; row.navigationError = "";
                    $distance.prop("disabled", true);
                    const revision = ++navRevision;
                    $navStatus.text("Получение данных системы…").show(); refresh();
                    GameEvents.emit("SendServer", { mode: "fleets", action: "GetSystemNavigationInfo", NotOverlay: true,
                        data: { fleetId, galaxy: Number($galaxy.val()), system: Number($system.val()), forPlan: true },
                        ...this.getRequestOptions({ kind: "read", latestKey: "plan-system-" + fleetId + "-" + uid }),
                        onSuccess: message => {
                            if (!alive() || !rows.includes(row) || revision !== navRevision) return;
                            row.pending = false;
                            const info = message.getData("Page")?.NavigationSystem;
                            if (!info?.valid || (mission() === 40 && !info.expeditionOrbit)) {
                                row.navigationError = info?.message || "Система или экспедиционная орбита недоступна.";
                            } else navInfo = info;
                            $navStatus.text(row.navigationError).toggle(Boolean(row.navigationError));
                            // Ошибка тоже завершает ожидание: обновляем индикаторы,
                            // проверку миссий и зависимые этапы, не только кнопку.
                            if (navInfo) apply(); else refresh();
                        },
                        onError: error => {
                            if (!alive() || !rows.includes(row) || revision !== navRevision) return;
                            row.pending = false; row.navigationError = error?.message || "Не удалось получить данные системы.";
                            $navStatus.text(row.navigationError).show(); refresh();
                        }
                    });
                }
            };
            // Каждый этап проверяется от предыдущей цели, а первый — от конца активного перелёта на сервере.
            row.requestMissions = () => {
                if (!alive() || !rows.includes(row)) return;
                const step = row.read();
                const previous = rows.slice(0, rows.indexOf(row)).reverse().find(previous => previous.read().coordinates);
                const origin = previous?.read().coordinates || null;
                const originUnavailable = Boolean(previous?.pending || previous?.navigationError);
                const key = JSON.stringify([step.kind, step.coordinates, step.speedFactor, step.mining, origin, originUnavailable, row.pending, row.navigationError]);
                const paint = () => {
                    const allowed = availability?.missions || [];
                    const disabled = Boolean(availability?.disabled);
                    row.missionError = ["mission", "move", "load", "return"].includes(step.kind)
                        ? row.missionPending ? "" : !availability ? "Не удалось проверить доступность цели."
                            : disabled ? (availability.messages || []).join(" ") || "Цель недоступна."
                                : step.kind === "mission" && !allowed.includes(step.mission) ? "Выбранная миссия недоступна для этой цели и состава флота." : ""
                        : "";
                    if (step.kind === "load" && !ownPlanets.some(p => step.coordinates?.type === 1
                        && Number(p.galaxy) === step.coordinates.galaxy && Number(p.system) === step.coordinates.system
                        && Number(p.planet) === step.coordinates.orbit && Number(p.planet_type) === step.coordinates.objectType)) {
                        row.missionError = "Для погрузки выберите свою планету или луну.";
                    }
                    $mission.find("button").each((_, button) => {
                        const id = Number(button.value);
                        // Иконка экспедиции сама выбирает её орбиту; после этого
                        // обычный preview проверит возможность отправки.
                        const available = !row.missionPending && (id === 40 || (!disabled && allowed.includes(id)));
                        button.disabled = !available;
                        $(button).toggle(id === 40 || available);
                    });
                    $missionStatus.text(row.missionPending ? "Проверка доступных миссий…" : row.missionError || (availability?.messages || []).join(" "));
                    $missionStatus.toggle(["mission", "move", "load", "return"].includes(step.kind));
                    $panel.attr("aria-busy", String(Boolean(row.pending || row.missionPending)));
                };
                if (missionKey === key) { paint(); return; }
                missionKey = key;
                const revision = ++missionRevision;
                clearTimeout(missionTimer); availability = null; row.fuelEstimate = null;
                row.missionPending = ["mission", "move", "load", "return"].includes(step.kind) && !row.pending && !row.navigationError;
                const validCoordinates = c => c && (c.type === 3 ? this.getFleetTargets(fleetId).some(f => Number(f.id) === Number(c.fleetId))
                    : [c.galaxy, c.system].every(n => Number.isInteger(n) && n > 0)
                        && (c.type === 1 ? Number.isInteger(c.orbit) && c.orbit > 0
                            && (![4, 5].includes(c.objectType) || (Number.isInteger(c.siteId) && c.siteId > 0))
                            : c.type === 2 && Number.isFinite(c.distance) && c.distance >= 0 && Number.isFinite(c.angle) && c.angle >= 0 && c.angle < 360));
                if (row.missionPending && (originUnavailable || (step.kind !== "return" && !validCoordinates(step.coordinates)) || (origin && !validCoordinates(origin)))) {
                    row.missionPending = false;
                    availability = { missions: [], disabled: true, messages: ["Проверьте координаты этапа и предыдущую цель."] };
                }
                paint();
                if (!row.missionPending) return;
                // Не отправляем запрос на каждую цифру при ручном вводе координат.
                missionTimer = setTimeout(() => {
                    if (!alive() || !rows.includes(row) || revision !== missionRevision) return;
                    const finish = (result, travelInfo = null) => {
                        if (!alive() || !rows.includes(row) || revision !== missionRevision) return;
                        availability = result; row.missionPending = false;
                        const fuel = travelInfo?.fuel;
                        row.fuelEstimate = fuel && [fuel.min, fuel.max].every(n => Number.isFinite(n) && n >= 0) && fuel.min <= fuel.max ? fuel : null;
                        row.requestMissions(); updateSubmit(); updateFuelNotice();
                    };
                    GameEvents.emit("SendServer", { mode: "fleets", action: "GetAvailableMissions", NotOverlay: true,
                        data: { fleetId, coordinates: step.coordinates, origin, speedFactor: step.speedFactor, forPlan: true,
                            missionType: step.mission, mining: step.mining, duration: step.duration, planReturn: step.kind === "return" },
                        ...this.getRequestOptions({ kind: "read", latestKey: "plan-missions-" + fleetId + "-" + uid }),
                        onSuccess: message => finish(message.getData("Page")?.AvailableMissions || null, message.getData("Page")?.TravelInfo),
                        onError: error => finish({ missions: [], disabled: true, messages: [error?.message || "Не удалось проверить доступность миссий."] })
                    });
                }, 150);
            };
            const syncOwn = () => {
                const own = ownPlanets.find(p => Number($type[0].value) === 1 && mission() !== 40 && Number(p.galaxy) === Number($galaxy.val())
                    && Number(p.system) === Number($system.val()) && Number(p.planet) === Number($orbit.val()) && Number(p.planet_type) === Number($object[0].value));
                $own.val(own?.id || "");
            };
            const toggle = () => {
                const id = mission(), kind = mode();
                if (previousMission === 40 && id !== 40) $orbit.val(ordinaryOrbit);
                if (id === 40 && previousMission !== 40) ordinaryOrbit = Number($orbit.val()) || 1;
                previousMission = id;
                if (id === 35) $type[0].value = 3;
                else if (id === 30) $type[0].value = 2;
                else if (id && id !== 10 && id !== 1 && !(id === 12 && Number($type[0].value) === 2)) $type[0].value = 1;
                if (kind === "load") {
                    $type[0].value = 1;
                    if (![1, 3].includes(Number($object[0].value))) $object[0].value = 1;
                }
                const type = Number($type[0].value), hasCoords = ["mission", "move", "load"].includes(kind);
                $coords.toggle(hasCoords); $missions.toggle(kind === "mission");
                $missionTitle.text("Миссия · " + missionName(id));
                $type.toggle(kind !== "load" && (kind === "move" || !id || id === 10 || id === 1 || id === 12));
                $targetLabel.toggle(kind !== "load" && (type === 3 || this.getFleetTargets(fleetId).length > 0));
                $object.find("button[value='2']").toggle(kind !== "load");
                $objectPanel.toggle(type === 1 && id !== 40);
                $fields.attr("data-coordinate-type", type);
                $g.add($s).toggle(type !== 3); $o.toggle(type === 1); $d.add($a).toggle(type === 2);
                $orbit.prop("readonly", id === 40);
                $loading.toggle(kind === "load");
                $unload.toggle(id === 10); $refuelLabel.toggle(id === 10 && type === 3);
                $expedition.toggle(id === 40); $defend.toggle(id === 5); $groups.toggle(id === 3);
                const gasMining = Number($object[0].value) === 4;
                $mining.toggle(id === 50);
                $mineMode.prop("disabled", gasMining);
                $mineMode.find("option").each((_, option) => { option.hidden = gasMining !== (option.value === "deuterium"); });
                if (gasMining) $mineMode.val("deuterium");
                else if ($mineMode.val() === "deuterium") $mineMode.val("mix");
                $interception.toggle(kind === "mission" && id === 1 && type === 3);
                $groupTime.toggle(Number($group.val()) === 0);
                $speedBox.toggle(kind !== "hold");
                $notice.text(kind === "return" ? "Флот вернётся на свою базу и выгрузит груз вместе с остатком топлива. Этот этап должен быть последним."
                    : kind === "hold" || id === 30 ? "Флот будет удерживать позицию. Следующие этапы начнутся после команды «Продолжить»."
                    : id === 11 ? "Передислокация завершает маршрут на новой базе."
                    : id === 35 ? "Донор присоединится к своему флоту. Получатель сохранит имя, базу и маршрут. Этот этап должен быть последним."
                    : id === 15 ? "Колонизация расходует колонизатор. Если других кораблей нет, маршрут завершится." : "")
                    .toggle(["return", "hold"].includes(kind) || [11, 15, 30, 35].includes(id));
                if (!hasCoords || type !== 1) { ++navRevision; row.pending = false; row.navigationError = ""; $navStatus.hide(); }
                syncOwn();
                refresh();
                if (active === row && opened) row.requestSystem();
            };
            $mode[0].addEventListener("change", toggle);
            $mission[0].addEventListener("change", toggle);
            $type[0].addEventListener("change", toggle);
            $object[0].addEventListener("change", toggle);
            $site.on("change", () => {
                const site = $site.find(":selected").data("site");
                if (site) $orbit.val(site.orbit);
                refresh();
            });
            $own.on("change", () => {
                const planet = ownPlanets.find(p => String(p.id) === $own.val());
                if (!planet) return;
                if ([30, 40].includes(mission())) { $mission[0].value = 10; toggle(); }
                $type[0].value = 1; $galaxy.val(planet.galaxy); $system.val(planet.system); $orbit.val(planet.planet); $object[0].value = planet.planet_type;
                toggle();
            });
            $target.on("change", () => {
                if (!$target.val()) { refresh(); return; }
                if (mode() !== "move") {
                    $mode[0].value = "mission";
                    const selected = $target.find(":selected").data("fleetTarget");
                    $mission[0].value = selected?.interceptable && selected?.delivery === false ? this.getAttackMissionId() : this.getTransportMissionId();
                }
                $type[0].value = 3; toggle();
            });
            $group.on("change", () => {
                const group = (page.AttackGroups || []).find(g => Number(g.id) === Number($group.val()));
                if (group) { $type[0].value = 1; $galaxy.val(group.target.galaxy); $system.val(group.target.system); $orbit.val(group.target.orbit); $object[0].value = group.target.objectType || 1; }
                toggle();
            });
            $galaxy.add($system).on("change", () => row.requestSystem());
            $distance.on("change blur", () => row.requestSystem());
            $panel.on("input change", event => {
                // Нативный select сначала посылает input. Нельзя сбрасывать его до обработчика change.
                if (event.target === $own[0] && event.type === "input") return;
                syncOwn(); refresh();
            });
            const move = delta => {
                const index = rows.indexOf(row), next = index + delta;
                if (next < 0 || next >= rows.length) return;
                [rows[index], rows[next]] = [rows[next], rows[index]]; refresh();
            };
            $up.on("click", () => move(-1)); $down.on("click", () => move(1));
            $remove.on("click", () => {
                ++navRevision;
                const index = rows.indexOf(row); rows.splice(index, 1);
                $button.remove(); $panel.remove(); refresh();
                select(rows[Math.min(index, rows.length - 1)] || null);
            });
            $button.on("click", () => select(row));
            $panel.append($("<header>").addClass("FleetPlanStepHeader").append($heading,
                $("<div>").addClass("FleetPlanStepControls").append($up, $down, $remove)),
                $mode, $coords, $sitePanel, $missions, $missionStatus, $loading, $unload, $expedition, $defend, $mining, $groups, $interception, $speedBox, $notice);
            // Новый этап добавляется перед завершающим, а не после возврата домой.
            const last = rows.at(-1)?.read();
            const beforeFinish = !restoring && last && (["return", "hold"].includes(last.kind) || (last.kind === "mission" && ([11, 35].includes(last.mission) || last.mission === 50 && last.mining?.finish === "stay")));
            rows.splice(beforeFinish ? rows.length - 1 : rows.length, 0, row);
            $details.append($panel); toggle();
            if (!restoring) select(row);
        };
        const $add = $("<button>", { type: "button", text: "+ Добавить этап" }).addClass("FleetPlanAdd").on("click", () => addStep());
        const $sidebar = $("<aside>").addClass("FleetPlanSidebar").append(
            $("<div>").addClass("FleetPlanSidebarHeader").append($("<strong>").text("Маршрут"), $count), idle ? $loadButton : null,
            !idle ? $("<p>").addClass("FleetPlanHint").text("Груз и топливо уже на борту. Текущее действие не изменяется.") : null, $list, $add);
        $content.append($("<p>").addClass("FleetPlanHint").text(idle
            ? "Выберите этап, настройте цель и миссию. Топливо и груз — в разделе «Погрузка»."
            : "Редактируются только будущие этапы. Приостановленный флот останется на паузе."),
            $("<p>").addClass("FleetPlanHint").text(`Лимит: ${maxStages} оставшихся этапов, включая текущее действие и возврат. Погрузка при старте и внутренние переходы не считаются отдельно.`),
            $fuelNotice, $("<div>").addClass("FleetPlanLayout").append($sidebar, $details), $error);
        const currentSteps = fleet.control.steps || [];
        if (currentSteps.length) currentSteps.forEach(step => addStep(step, true));
        else { if (idle) addStep({ kind: "mission", mission: 10 }, true); addStep({ kind: "return" }, true); }
        const submit = () => {
            $error.hide(); updateLoad();
            if (stageCount() > maxStages) {
                $error.text(`Превышен лимит ${maxStages} этапов. Сократите маршрут перед сохранением.`).show();
                return;
            }
            const steps = [];
            for (const row of rows) {
                const step = row.read(), c = step.coordinates;
                row.requestMissions();
                let error = row.navigationError || row.missionError || "";
                if (row.pending || row.missionPending) error = "Дождитесь проверки доступных миссий.";
                if (step.mission === 10 && !Number.isInteger(step.percent)) error = "Процент выгрузки должен быть целым числом от 0 до 100.";
                if (step.kind === "mission" && !step.mission) error = "Выберите миссию этапа.";
                if (step.kind === "load" && ![step.fuel, ...Object.values(step.resources)].every(n => Number.isFinite(n) && n >= 0 && n <= 1e15)) error = "Проверьте количества погрузки: от 0 до 10¹⁵.";
                if (c) {
                    if (c.type === 3 && !this.getFleetTargets(fleetId).some(f => Number(f.id) === Number(c.fleetId))) error = "Выберите доступный целевой флот.";
                    if (c.type !== 3 && (![c.galaxy, c.system].every(n => Number.isInteger(n) && n > 0)
                        || (c.type === 1 && (!Number.isInteger(c.orbit) || c.orbit < 1))
                        || (c.type === 2 && (!Number.isFinite(c.distance) || c.distance < 0 || !Number.isFinite(c.angle) || c.angle < 0 || c.angle >= 360)))) error = "Проверьте координаты этапа.";
                }
                if ((step.kind === "return" || [11, 35].includes(step.mission)) && row !== rows.at(-1)) error = "Возврат, передислокация и объединение должны завершать маршрут.";
                if (error) { select(row); $error.text(error).show(); return; }
                steps.push(step);
            }
            const last = steps.at(-1);
            if (!last || (!["return", "hold"].includes(last.kind) && !(last.kind === "mission" && ([11, 30, 35].includes(last.mission) || last.mission === 50 && last.mining?.finish === "stay")))) {
                $error.text("Завершите маршрут возвратом, удержанием, передислокацией или объединением.").show(); return;
            }
            const plan = { version: fleet.control.version, steps, fuel: idle ? number($fuel.val()) : 0,
                resources: Object.fromEntries(Object.entries(resourceInputs).map(([id, $input]) => [id, idle ? number($input.val()) : 0])) };
            submitting = true; updateSubmit();
            GameEvents.emit("SendServer", { mode: "fleets", action: "SetFleetCommands", data: { fleetId, plan }, NotOverlay: true,
                ...this.getRequestOptions({ kind: "command" }),
                onSuccess: () => { if (alive()) Dialog.close(); },
                onError: error => {
                    if (!alive()) return;
                    submitting = false; updateSubmit(); $error.text(error?.message || "План не принят").show();
                }
            });
        };
        Dialog.create($content, "Маршрут · " + (fleet.name || "Флот #" + fleetId), [
            { text: idle ? "Выполнить маршрут" : "Сохранить маршрут", class: ["btn-info", "FleetPlanSubmit"], action: submit },
            { text: "Закрыть", action: () => Dialog.close() }
        ], { width: Math.min(820, innerWidth - 20), overlay: true });
        opened = true; select(rows[0] || null); refresh();
    }

    formatPlanDate(timestamp) {
        const date=new Date(timestamp*1000);
        return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
    }

    showAttackGroup(groupId) {
        const group = (this.messageData.data.Page?.AttackGroups || []).find(item => item.id === Number(groupId));
        if (!group) return;
        const canInvite = group.canInvite === true;
        const $name = $("<input>", { type: "text", id: "FleetGroupInviteName", maxlength: 32,
            placeholder: "Игровое имя, не логин аккаунта", "aria-label": "Имя приглашённого игрока" });
        const $error = $("<p>").addClass("FleetGroupInviteError").attr("role", "alert").hide();
        const $content = $("<div>").addClass("FleetGroupAttackOptions FleetGroupInviteForm").append(
            $("<p>").text(`Цель: ${this.formatFleetCoordinate(group.target)}`),
            $("<p>").text(`Общее прибытие: ${formatTimestamp(group.executeAt, "datetime")}`),
            $("<div>").addClass("FleetGroupAttackMembers").append(
                $("<span>").text("Приглашены:"),
                ...(group.invited || []).map(user => $("<span>").addClass("FleetGroupAttackMember").text(user.name))),
            ...(canInvite ? [
                $("<label>").text("Пригласить игрока:").append($name),
                $("<small>").text("Любой игрок, кроме владельца цели. Дружба и общий альянс не обязательны. Приглашение не переносит срок атаки."), $error
            ] : [$("<small>").text("Приглашать игроков может только создатель САБ.")])
        );
        Dialog.create($content, `Групповая атака #${group.id}`, [
            ...(canInvite ? [{ text: "Пригласить", class: ["btn-info"], action: () => {
                const username = $name.val().trim();
                if (!username) { $name.trigger("focus"); return; }
                const $buttons = $(Dialog.dialogDiv).find("dialog-buttons button").prop("disabled", true);
                GameEvents.emit("SendServer", { mode: "fleets", action: "InviteAttackGroup",
                    data: { groupId: group.id, username }, ...this.getRequestOptions({ kind: "command" }),
                    onSuccess: () => {
                        if ($.contains(Dialog.dialogDiv, $content[0])) Dialog.close();
                        Overlay.Hide();
                    },
                    onError: error => {
                        Overlay.Hide();
                        $buttons.prop("disabled", false);
                        $error.text(error?.message || "Не удалось пригласить игрока.").show();
                    }
                });
            } }] : []),
            { text: "Закрыть", action: () => Dialog.close() }
        ], { width: Math.min(420, Math.max(0, innerWidth - 20)), overlay: true });
        if (canInvite) $name.trigger("focus");
    }

    sendFleetManagement(action, fleetId, content, data = {}) {
        $("dialog-buttons button").prop("disabled", true);
        GameEvents.emit("SendServer", {
            mode: "fleets", action, data: { FleetId: fleetId, ...data },
            ...this.getRequestOptions({ kind: "command" }),
            onSuccess: () => {
                if ($.contains(Dialog.dialogDiv, content[0])) Dialog.close();
                Overlay.Hide();
            },
            onError: error => {
                Overlay.Hide();
                Dialog.ErrorLoad(error?.message || "Не удалось выполнить действие с флотом.");
            }
        });
    }

    renameFleet(event) {
        const fleetId = $(event.currentTarget).closest(".InfoFleet")[0]?.FleetId;
        const fleet = this.messageData.data.Page?.FleetList[fleetId];
        if (!fleet || fleet.battle) return;
        const $name = $("<input>", {
            type: "text", maxlength: 32, value: fleet.name || "",
            placeholder: `Флот #${fleetId}`, "aria-label": "Название флота"
        }).addClass("FleetNameInput");
        const $content = $("<div>").addClass("FleetRenameForm").append(
            $name,
            $("<div>").text("2–32 символа. Пустое поле вернёт название по номеру флота.")
        );
        Dialog.create($content, "Название флота", [
            { text: "Сохранить", class: ["btn-info"], action: () => this.sendFleetManagement("RenameFleet", fleetId, $content, { Name: $name.val() }) },
            { text: Lang.Cancel, class: ["btn-warning"], action: () => Dialog.close() }
        ], { width: 360, overlay: true });
        $name.trigger("focus");
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
        if (!Fleet || Fleet.battle) return;

        const content = this.createSpan("Расформирование флота ");
        content.append(this.createSpan(Fleet.name || `Флот #${Fleet.id}`), "<br><br>");
        content.append(
            this.createDiv("Корабли, груз и остаток топлива вернутся на выбранную планету. Опыт флота будет потерян."),
            "<br>"
        );

        Dialog.create(content, "Расформировать флот?",
            [
                { text: Lang.fleets.Disband, action: () => this.sendFleetManagement("DisbandFleet", FleetId, content), class: ["btn-danger"] },
                { text: Lang.Cancel, action: () => Dialog.close(), class: ["btn-warning"] }
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

        if (!FleetId || !this.$Fleets[FleetId]) return;

        // Клик переключает состав, обновление snapshot только перерисовывает открытый.
        if (Fleet?.target && this.LastFleetId === FleetId) {
            this.LastFleetId = 0;
            this.$FleetMoreDetails.stop(true, true).hide();
            this.$Fleets[FleetId].removeClass("FleetOrbitExpanded");
            this.$Fleets[FleetId].Buttons.MoreDetails.attr("aria-expanded", "false");
            return;
        }

        if (!this.$FleetMoreDetails)
            this.createFleetMoreDetails(FleetId);

        this.LastFleetId = FleetId;
        this.renderFleetMoreDetailsShips(FleetId);
        this.$FleetMoreDetails.stop(true, true).show();
    }

    renderFleetMoreDetailsShips(FleetId) {

        if (!this.$FleetMoreDetails)
            this.createFleetMoreDetails(FleetId);

        if (!this.$Fleets[FleetId]) return;

        this.$Content.find(".FleetOrbitCards > .InfoFleet").removeClass("FleetOrbitExpanded")
            .find(".FleetOrbitDetails").attr("aria-expanded", "false");
        this.$Fleets[FleetId].addClass("FleetOrbitExpanded");
        this.$Fleets[FleetId].Buttons.MoreDetails.attr("aria-expanded", "true");
        this.$Fleets[FleetId].append(this.$FleetMoreDetails);

        const FleetShips = this.messageData.data.Page?.FleetList[FleetId].ships;

        $.each(FleetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createFleetShip(id, ship);
            } else if (ship.count > 0) {
                this.$FleetMoreDetails.Ships[id][0].data = ship;
            }
        });
        this.$FleetMoreDetails.find(".ui-draggable").draggable("option", "disabled",
            Boolean(this.messageData.data.Page?.FleetList[FleetId]?.home_site_id
                || this.messageData.data.Page?.FleetList[FleetId]?.battle));

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
            NotOverlay: true,
            data: { 'items': items },
            ...this.getRequestOptions({ kind: "command" }),
            onSuccess: () => this.clearSelectElements(),
            onError: error => Dialog.ErrorLoad(error?.message || "Не удалось создать флот.")
        });
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
        this.$FleetsPlanet.BlockTitle = $("<div>").addClass("BlockTitle FleetOrbitSectionHeader");
        this.$FleetsPlanet.BlockTitle.Count = $("<span>");
        this.$FleetsPlanet.BlockTitle.Max = $("<span>");
        this.$FleetsPlanet.BlockTitle.append(
            $("<span>").text("Флотов у планеты"),
            $("<span>").addClass("FleetOrbitSlots").append(
                "Места: ",
                this.$FleetsPlanet.BlockTitle.Count,
                " / ",
                this.$FleetsPlanet.BlockTitle.Max
            )
        );

        this.$FleetsPlanet.Cards = $("<div>").addClass("FleetOrbitCards");
        this.$FleetsPlanet.Empty = $("<div>").addClass("FleetOrbitEmpty").text("У планеты пока нет флотов");
        this.$FleetsPlanet.append(this.$FleetsPlanet.BlockTitle, this.$FleetsPlanet.Cards, this.$FleetsPlanet.Empty);

        this.$Fleets = {};


        this.$Content.append(this.$FleetsPlanet);
    }

    renderResourceBaseSections() {
        const data = this.messageData.data.Page?.ResourceBases;
        if (!this.$ResourceBases) {
            this.$ResourceBases = $("<section>").addClass("box FleetResourceBases");
            this.$ResourceBases.Title = $("<div>").addClass("BlockTitle FleetOrbitSectionHeader");
            this.$ResourceBases.append(this.$ResourceBases.Title);
            this.$FleetsPlanet.after(this.$ResourceBases);
        }
        this.$ResourceBases.toggle(Boolean(data?.enabled));
        this.$ResourceBases.Title.text(`Ресурсные базы: ${data?.used || 0} / ${data?.max || 0}`);
        const ids = new Set();
        for (const base of data?.bases || []) {
            ids.add(base.siteId);
            this.resourceSiteLabels.set(Number(base.siteId), base.label);
            let section = this.resourceBaseSections.get(base.siteId);
            if (!section) {
                const $root = $("<div>").addClass("FleetResourceBase");
                const $title = $("<div>").addClass("FleetResourceBaseTitle");
                const $cards = $("<div>").addClass("FleetOrbitCards");
                const $note = $("<small>").addClass("FleetResourceBaseNote");
                $root.append($title, $note, $cards);
                this.$ResourceBases.append($root);
                section = { $root, $title, $cards, $note };
                this.resourceBaseSections.set(base.siteId, section);
            }
            section.$title.text(`${base.label} · места ${base.slots.used} / ${base.slots.max}`);
            section.$note.text("Бортовой бак оплачивает стоянку. Уход последней охраны освобождает базу; оставшиеся флоты получают резервный дом.");
        }
        for (const [id, section] of this.resourceBaseSections) if (!ids.has(id)) {
            // Карточки отсоединяются: в этом же snapshot они могут сменить базу.
            section.$cards.children(".InfoFleet").detach();
            section.$root.remove();
            this.resourceBaseSections.delete(id);
        }
    }

    renderFleetsPlanet() {

        const FleetList = this.messageData.data.Page?.FleetList;
        if (!FleetList) return;

        if (!this.$FleetsPlanet)
            this.createFleetsPlanet();

        this.renderResourceBaseSections();

        const fleetIds = Object.values(FleetList).filter(fleet => !fleet.home_site_id).map(fleet => fleet.id);
        const slots = this.messageData.data.Page?.FleetLimits?.base;
        this.$FleetsPlanet.BlockTitle.Count.text(slots?.used ?? fleetIds.length);
        this.$FleetsPlanet.BlockTitle.Max.text(slots?.max ?? "—");
        this.$FleetsPlanet.BlockTitle.find(".FleetOrbitSlots").ToolTip(
            `Места базирования: ${slots?.based ?? fleetIds.length}; передислокаций сюда: ${slots?.incoming ?? 0}. `
            + "Улетевшие флоты сохраняют место до возвращения. Лимит: 2 + уровень флотовой логистики."
        );

        $.each(FleetList, (fid, fleet) => {

            if (!this.$Fleets[fid] || this.$Fleets[fid].length === 0) {
                this.$Fleets[fid] = this.createInfoFleet();
                this.$Fleets[fid][0].FleetId = parseInt(fid);
            }
            //this.$Fleets[fid] = $fleet;
            const $fleet = this.$Fleets[fid];
            const siteId = Number(fleet.home_site_id) || 0;
            const inBattle = Boolean(fleet.battle);
            const $container = siteId ? this.resourceBaseSections.get(siteId)?.$cards : this.$FleetsPlanet.Cards;
            if ($container && $fleet.parent()[0] !== $container[0]) $container.append($fleet);
            if (!siteId && !$fleet.hasClass("ui-droppable")) $fleet.droppable({ drop: (event, ui) => this.dropShip(event, ui) });
            if (!siteId) $fleet.droppable("option", "disabled", inBattle);
            if (siteId && $fleet.hasClass("ui-droppable")) $fleet.droppable("destroy");
            $fleet.Battle.toggle(inBattle).text(!inBattle ? "" : fleet.battle.phase === "running"
                ? `Участвует в бою · ${fleet.battle.round > 0 ? `раунд ${fleet.battle.round}/${fleet.battle.rounds_max}` : "Подготовка боя"}`
                : fleet.battle.phase === "failed" ? "Бой приостановлен" : "Бой завершён · Сохранение результата");
            $fleet.Buttons.Task.prop("disabled", inBattle);
            $fleet.Buttons.Disband.prop("disabled", inBattle);
            $fleet.find(".FleetOrbitRename").prop("disabled", inBattle);
            $fleet.Buttons.Disband.toggle(!siteId);
            if (!$fleet.Standing) $fleet.Standing = $("<div>").addClass("FleetResourceStanding").insertBefore($fleet.Buttons);
            $fleet.Standing.toggle(Boolean(fleet.standing));
            if (fleet.standing) $fleet.Standing.ToolTip(
                `Резервная база: ${this.formatFleetCoordinate(fleet.fallback)}. `
                + (fleet.standing.evacuationAt === null ? "Расход стоянки отсутствует."
                    : `Эвакуация при достижении резерва: ${formatTimestamp(fleet.standing.evacuationAt, "datetime")}. Скорость: ${fleet.standing.speedFactor * 10}%.`));

            const { count, types, consumption, capacity, experience, speed } = this.calcShipsStats(fleet.ships, Ship => ({
                count: Ship.count,
                speed: Ship.speed,
                consumption: Ship.consumption,
                capacity: Ship.capacity,
                experience: Ship.experience
            }));

            // Название и данные
            $fleet.Name.text(fleet.name || `Флот #${fleet.id}`);
            if (!$fleet.Buttons.Plan) {
                $fleet.Buttons.Plan = $("<button>", { type: "button", text: "Маршрут" })
                    .addClass("FleetOrbitPlanButton").on("click", () => this.showFleetPlan(Number(fleet.id)));
                $fleet.Buttons.append($fleet.Buttons.Plan);
            }
            $fleet.Buttons.Plan.toggle(!inBattle && Boolean(fleet.actions?.SetFleetCommands ?? this.messageData.data.Page?.FleetCapabilities?.plan));
            $fleet.ShipsCount.text(humanNumber(count, true, 2));
            $fleet.ShipsTypes.text(types);
            $fleet.ShipsSpeed.text(humanNumber(speed, true, 2));
            $fleet.ShipsCapacity.text(humanNumber(capacity, true, 2));
            $fleet.ShipsСonsumption.text(humanNumber(consumption, true, 2));
            $fleet.ShipsExperience.text(humanNumber(experience, true, 2));
            $fleet.Buttons.MoreDetails[0].FleetId = fleet.id;
            $fleet.Buttons[0].FleetId = fleet.id;

        });

        // Удаляем исчезнувшие
        for (const id in this.$Fleets) {
            if ((!FleetList[id] || FleetList[id].count <= 0) && this.$Fleets[id].length > 0) {
                if (Number(id) === this.LastFleetId) {
                    this.$FleetMoreDetails.stop(true, true).hide().detach();
                    this.LastFleetId = 0;
                }
                //this.$Ships[id].fadeOut(250, () => {
                this.$Fleets[id].remove();
                delete this.$Fleets[id];
                //});
            }
        }

        this.$FleetsPlanet.Empty.toggle(fleetIds.length === 0);
        this.renderFleetMoreDetails(this.LastFleetId);
        this.updateFlyingFleetsClock();
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
        this.$ShipsBlock.Count = $("<span>").addClass("FleetOrbitSlots");
        this.$ShipsBlock.SelectAll = $("<button>", { type: "button", text: "Выбрать все" })
            .addClass("btn-info").on("click", () => {
                Object.values(this.$Ships).forEach($ship => $ship[0].Input.val($ship[0]._data.count));
                this.renderNewFleetBlock();
            });
        this.$ShipsBlock.append($("<div>").addClass("FleetPlanetShipsHeader").append(
            $("<span>").text("Корабли на планете"),
            this.$ShipsBlock.Count, this.$ShipsBlock.SelectAll
        ));
        this.$ShipsPlanet = $("<div>").addClass("box ShipsPlanet");
        this.$ShipsPlanet.Empty = $("<div>").addClass("FleetPlanetShipsEmpty").text("На планете нет кораблей. Сюда можно перетащить корабли из флота.");
        this.$ShipsPlanet.append(this.$ShipsPlanet.Empty);
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

        const element = this.$Ships[id][0];
        element.Input.attr("aria-label", `Выбрать кораблей: ${Lang.tech[id]}`);
        element.Buttons.Max.off("click.build");
        element.Buttons.Info.off("click.build confirmed-click.build");
        // GameBuild при перестановке в DOM очищает handlers своих кнопок.
        // Делегирование на корне сохраняет действия после сортировки/snapshot.
        this.$Ships[id].off("click.fleet-select")
            .on("click.fleet-select", ".btn-box-max", e => {
                e.stopPropagation();
                element.Input.val(element._data.count);
                this.renderNewFleetBlock();
            })
            .on("click.fleet-select", ".btn-box-info", () => {
                GameEvents.emit("ShowInfoPanel", { data: { id } });
            });

    }

    createInfoFleet() {

        const $InfoFleet = $("<div>").addClass("box InfoFleet");

        $InfoFleet.Name = $("<div>").addClass("Name");
        const $rename = $("<button>", { type: "button", "aria-label": "Переименовать флот" })
            .addClass("FleetOrbitRename mdi mdi-pencil-outline").on("click", this.renameFleet.bind(this));
        if (!isTouch) $rename.ToolTip("Переименовать флот");

        $InfoFleet.ShipsCount = $("<span>").addClass("ShipsCount");
        $InfoFleet.ShipsTypes = $("<span>").addClass("ShipsTypes");
        $InfoFleet.ShipsSpeed = $("<span>").addClass("ShipsSpeed");
        $InfoFleet.ShipsCapacity = $("<span>").addClass("ShipsCapacity");
        $InfoFleet.ShipsExperience = $("<span>").addClass("ShipsExperience");
        $InfoFleet.ShipsСonsumption = $("<span>").addClass("ShipsСonsumption");
        $InfoFleet.Battle = $("<div>").addClass("FleetOrbitBattle yellow_text").attr("role", "status").hide();


        $InfoFleet.Buttons = $("<div>").addClass("Buttons");

        $InfoFleet.Buttons.MoreDetails = this.createButton(
            "ButtonsFleet", Lang.fleets.MoreDetails, this.renderFleetMoreDetails.bind(this), false, null, 'btn-info FleetOrbitDetails')
            .attr("aria-expanded", "false");

        $InfoFleet.Buttons.Task = this.createButton(
            "ButtonsFleet", Lang.fleets.Task, this.showTaskFleet.bind(this), false, null, 'btn-info FleetOrbitTask');

        $InfoFleet.Buttons.Disband = this.createButton(
            "ButtonsFleet", Lang.fleets.Disband, this.DisbandFleet.bind(this), false, null, 'btn-danger');

        $InfoFleet.Buttons.append(
            $InfoFleet.Buttons.MoreDetails,
            $InfoFleet.Buttons.Task,
            $InfoFleet.Buttons.Disband
        );


        const $summary = $("<div>").addClass("FleetOrbitSummary").append(
            $("<div>").addClass("Count FleetOrbitBadge").append(
                $("<span>").text(Lang.fleets.Count), $InfoFleet.ShipsCount
            ),
            $("<div>").addClass("Types FleetOrbitBadge").append(
                $("<span>").text(Lang.fleets.Types), $InfoFleet.ShipsTypes
            )
        );
        const $stats = $("<div>").addClass("FleetOrbitStats");
        [
            ["Speed", Lang.fleets.Speed, $InfoFleet.ShipsSpeed],
            ["Capacity", Lang.fleets.Capacity, $InfoFleet.ShipsCapacity],
            ["Сonsumption", Lang.fleets.Сonsumption, $InfoFleet.ShipsСonsumption],
            ["Experience", Lang.fleets.Experience, $InfoFleet.ShipsExperience]
        ].forEach(([className, label, $value]) => {
            $stats.append($("<div>").addClass(`FleetOrbitMetric ${className}`).append(
                $("<span>").addClass("FleetOrbitMetricLabel").text(label + ":"),
                $value.addClass("FleetOrbitMetricValue")
            ));
        });

        $InfoFleet.append(
            $("<div>").addClass("FleetOrbitHeader").append(
                $("<div>").addClass("FleetOrbitIdentity").append($InfoFleet.Name, $rename), $summary
            ),
            $stats,
            $InfoFleet.Battle,
            $InfoFleet.Buttons
        );

        return $InfoFleet;

    }

    createNewFleetBlock() {

        this.$ShipsBlock.NewFleetBlock = $("<div>").addClass("NewFleetBlock");

        if (!this.$ShipsBlock.InfoFleet) {
            this.$ShipsBlock.InfoFleet = this.createInfoFleet().addClass("FleetOrbitPreview");
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

        this.$ShipsBlock.InfoFleet.Buttons.hide();

        const slots = this.messageData.data.Page?.FleetLimits?.base;
        const hasBaseSlot = !slots || slots.used < slots.max;
        this.$ShipsBlock.NewFleetButtons.ToOrbit.prop('disabled', count === 0 || !hasBaseSlot)
            .ToolTip(hasBaseSlot ? "Создать флот из выбранных кораблей"
                : "Нет свободных мест базирования. Повысьте флотовую логистику.");
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

        this.$ShipsBlock.Count.text(humanNumber(Object.values(PlanetShips || {}).reduce((sum, ship) => sum + Math.max(0, Number(ship.count) || 0), 0), true, 2));
        this.$ShipsPlanet.Empty.toggle(Object.keys(this.$Ships).length === 0);
        this.$ShipsBlock.SelectAll.prop("disabled", Object.keys(this.$Ships).length === 0);
        this.renderNewFleetBlock();
    }

    async render(generation = this.renderGeneration) {
        if (!await super.render(generation)) return;

        const target = this.messageData.data.Page?.Target;
        if (this.isNavigationTarget(target, false)) {
            this.target = target;
            this.navigationMissionType = this.messageData.data.Page?.NavigationMissionType ?? null;
        } else if (this.messageData.action !== "ActualData") {
            this.target = null;
            this.navigationMissionType = null;
        }
        this.renderFlyingFleets();
        this.renderFleetsPlanet();
        this.renderShips();
        this.refreshFleetTargets(this.missionSelectorFleetId);
        this.updateMissionSendState?.();
    }
}
