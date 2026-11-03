window.GalaxyPageClass = class GalaxyPageClass extends BasePageClass {

    Name = "GalaxyPageClass";
    phalanxTimer = null;

    // Параметры зума
    zoom = 0.00001;
    minZoom = 0.001;
    maxZoom = 3;
    fitZoom = null;

    offset = { x: 0, y: 0 };
    isDragging = false;
    dragStart = { x: 0, y: 0 };

    // Контейнеры изображений
    planetImages = {};
    asteroidSprites = {};
    starSprites = {};
    gasGiantSprites = {};
    gasGiantRingSprites = {};
    debrisSprite = null;
    ResourceSites = [];
    SpaceDebris = [];
    FlyingFleets = [];
    SensorContacts = [];
    sensorContactPositions = new Map();
    resourceSitesByOrbit = {};
    resourceSiteTypes = Object.freeze({ GAS_GIANT: 1, ASTEROID_SECTOR: 2 });
    // Обозначения Nova. Клиент отображает только статусы, присланные сервером.
    playerStatusLabels = Object.freeze({
        noob: { short: "н", label: "Новичок" },
        strong: { short: "с", label: "Сильный игрок" },
        vacation: { short: "РО", label: "Режим отпуска" },
        banned: { short: "бан", label: "Заблокирован" },
        inactive: { short: "i", label: "Неактивен более 7 дней" },
        longinactive: { short: "I", label: "Неактивен более 28 дней" }
    });


    asteroidBelts = {};
    asteroidSpriteSizes = {
        1: [69, 58], 2: [122, 74], 3: [139, 116], 4: [210, 168],
        5: [252, 210], 6: [252, 266], 7: [253, 137], 8: [483, 327]
    };

    SystemShow = false;
    navigationTarget = null;
    freeOrbits = [];
    freeOrbitIds = new Set();
    freeOrbitsOpen = false;
    selectedFreeOrbit = null;
    mapObjects = [];
    selectedMapObject = null;
    mapPress = null;
    mapPressMoved = false;
    suppressMapClickUntil = 0;

    // === Сенсорное управление ===
    isTouching = false;
    touchStartDist = 0;
    startZoom = 1;
    lastTouchCenter = { x: 0, y: 0 };
    renderVersion = 0;
    zoomAnimationFrameId = null;
    zoomAnimationVersion = 0;

    constructor() {
        super();

        console.log("constructor GalaxyPageClass");

        // === Canvas ===
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        $(this.canvas).addClass("canvas");


        // === DOM ===
        this.$Layer.toggleClass("accauntlayer", false);
        this.$Layer.toggleClass("gamelayer", true);

        this.$System = this.createDiv("", "System", "system box").hide();
        this.$System.append(this.canvas);

        this.$SystemInfo = $("<details>", { id: "GalaxySystemInfo", class: "GalaxySystemInfo box" });
        this.$Legend = $("<details>", { id: "GalaxyLegend", class: "GalaxyLegend box" });
        this.$System.append(this.$SystemInfo, this.$Legend);

        this.$FreeOrbits = this.createDiv("", "", "GalaxyFreeOrbits");
        this.$FreeOrbitsToggle = $("<button>", {
            type: "button", text: "Свободные орбиты", class: "GalaxyFreeOrbitsToggle",
            "aria-expanded": "false", "aria-controls": "GalaxyFreeOrbitsBody"
        }).on("click.galaxyFreeOrbits", () => {
            if (this.pageActive && this.SystemShow) this.setFreeOrbitsOpen(!this.freeOrbitsOpen);
        });
        this.$FreeOrbitsBody = this.createDiv("", "GalaxyFreeOrbitsBody", "GalaxyFreeOrbitsBody box").hide();
        this.$FreeOrbitList = this.createDiv("", "", "GalaxyFreeOrbitList")
            .attr({ role: "group", "aria-label": "Свободные орбиты" });
        this.$FreeOrbitSelection = this.createDiv("", "", "GalaxyFreeOrbitSelection");
        this.$FreeOrbitsBody.append(this.$FreeOrbitList, this.$FreeOrbitSelection);
        this.$FreeOrbits.append(this.$FreeOrbitsToggle, this.$FreeOrbitsBody);
        this.$System.append(this.$FreeOrbits);

        // Карточка принадлежит странице, не общему hover-tooltip.
        this.$ObjectMenuBody = $("<div>", { class: "GalaxyObjectMenuBody" });
        this.$ObjectMenu = $("<section>", {
            id: "GalaxyObjectMenu", class: "GalaxyObjectMenu box", role: "dialog",
            "aria-modal": "false", "aria-label": "Объект системы"
        }).hide().append(
            $("<button>", { type: "button", class: "GalaxyObjectMenuClose", text: "×", "aria-label": "Закрыть карточку" })
                .on("click.galaxy", () => this.closeObjectMenu(true)),
            this.$ObjectMenuBody
        );
        this.$System.append(this.$ObjectMenu);
        $(document).off("click.galaxyObjectMenu keydown.galaxyObjectMenu")
            .on("click.galaxyObjectMenu", (event) => {
                if (this.selectedMapObject && !this.$ObjectMenu[0].contains(event.target)) this.closeObjectMenu();
            }).on("keydown.galaxyObjectMenu", (event) => {
                if (event.key === "Escape" && this.selectedMapObject) {
                    event.preventDefault();
                    this.closeObjectMenu(true);
                }
            });
        $(window).off("resize.galaxyObjectMenu").on("resize.galaxyObjectMenu", () => this.positionObjectMenu());

        this.$Content.addClass("Galaxy").append(this.$System);

        /*this.canvas.style.display = "block";
        this.canvas.style.margin = "0 auto";
        this.canvas.style.userSelect = "none";
        this.canvas.style.cursor = "grab";
        this.canvas.style.position = "absolute";
        this.canvas.style.top = "50%";
        this.canvas.style.left = "50%";
        this.canvas.style.transform = "translate(-50%, -50%)";*/

        // === События ===

        // Подписи находятся над canvas, а общий tooltip — вне карты.
        // Колёсик должен масштабировать карту и над ними, но не другие страницы.
        this.wheelHandler = (event) => {
            if (!this.pageActive || !this.SystemShow || !this.$Content.Show) return;
            const system = this.$System[0];
            const overSystem = system.contains(event.target);
            const overOwnTooltip = ToolTip.$Tip[0].contains(event.target)
                && system.contains(ToolTip.parent);
            if (!overSystem && !overOwnTooltip) return;
            if (overSystem && event.target.closest(".GalaxySystemInfo, .GalaxyLegend, .GalaxyFreeOrbitsBody")) return;
            const body = event.target.closest(".GalaxyObjectMenuBody");
            if (body && body.scrollHeight > body.clientHeight) return;
            this.onWheel(event);
        };
        this.$System[0].addEventListener("wheel", this.wheelHandler, { passive: false });
        ToolTip.$Tip[0].addEventListener("wheel", this.wheelHandler, { passive: false });
        $(this.canvas).off("mousedown.canvas").on("mousedown.canvas", (e) => this.onMouseDown(e));
        $(this.canvas).off("mouseup.canvas").on("mouseup.canvas", (e) => this.onMouseUp(e));
        $(this.canvas).off("mouseleave.canvas").on("mouseleave.canvas", (e) => this.onMouseUp(e));
        $(this.canvas).off("mousemove.canvas").on("mousemove.canvas", (e) => this.onMouseMove(e));
        $(this.canvas).off("click.canvas").on("click.canvas", (event) => this.onMapClick(event));



        // --- Touch (need passive:false) ---
        // сначала снять старые jQuery-имитированные привязки (чтобы стиль был единым)
        $(this.canvas).off("touchstart.canvas touchmove.canvas touchend.canvas");

        // функция-утилита для безопасного бинда/анбinda нативных слушателей с хранением ссылки
        const bindTouchWithPassive = (el, evt, handler, passive = false) => {
            const key = `__${evt}Handler`;
            // если ранее был добавлен — удаляем
            if (el[key]) {
                try {
                    // удаляем с теми же опциями (modern browsers)
                    el.removeEventListener(evt, el[key], { passive: passive });
                } catch (err) {
                    // fallback: попробовать удалить с булевым useCapture=false
                    el.removeEventListener(evt, el[key], false);
                }
                el[key] = null;
            }
            // сохраняем новую функцию и добавляем с нужной опцией
            el[key] = handler;
            el.addEventListener(evt, handler, { passive: passive });
        };

        // привязываем обработчики (сохраняя контекст this через стрелочные функции)
        bindTouchWithPassive(this.canvas, "touchstart", (e) => this.onTouchStart(e), false);
        bindTouchWithPassive(this.canvas, "touchmove", (e) => this.onTouchMove(e), false);
        // touchend обычно не требует passive:false — но можно указывать без вреда
        bindTouchWithPassive(this.canvas, "touchend", (e) => this.onTouchEnd(e), false);


        this.SystemShow = false;
    }

    // === Получение центра и дистанции между пальцами ===
    getTouchCenter(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left - rect.width / 2;
        const y = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top - rect.height / 2;
        return { x, y };
    }

    getTouchDistance(e) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // === Начало касания ===
    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.mapPress = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this.mapPressMoved = false;
            // Однопальцевое перемещение
            this.isDragging = true;
            this.canvas.style.cursor = "grabbing";
            const touch = e.touches[0];
            this.dragStart.x = touch.clientX - this.offset.x;
            this.dragStart.y = touch.clientY - this.offset.y;
        } else if (e.touches.length === 2) {
            this.mapPressMoved = true;
            e.preventDefault();
            this.isTouching = true;
            this.isDragging = false;

            this.touchStartDist = this.getTouchDistance(e);
            this.startZoom = this.zoom;

            // Центр между пальцами в координатах canvas
            const rect = this.canvas.getBoundingClientRect();
            const touchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
            };

            this.lastTouchCenter = touchCenter;
        }
    }

    // === Перемещение ===
    onTouchMove(e) {
        if (e.touches.length === 1 && this.isDragging) {
            // перемещение одним пальцем
            const touch = e.touches[0];
            this.trackMapPress(touch);
            this.offset.x = touch.clientX - this.dragStart.x;
            this.offset.y = touch.clientY - this.dragStart.y;
            this.limitPan();

        } else if (e.touches.length === 2 && this.isTouching) {
            e.preventDefault();

            const newDist = this.getTouchDistance(e);
            const zoomChange = newDist / this.touchStartDist;
            const newZoom = this.startZoom * zoomChange;

            // центр pinch в координатах canvas
            const rect = this.canvas.getBoundingClientRect();
            const touchCenter = {
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
            };

            // пересчитать смещение так, чтобы масштабирование было относительно точки касания
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            const worldX = (touchCenter.x - cx - this.offset.x) / this.zoom;
            const worldY = (touchCenter.y - cy - this.offset.y) / this.zoom;

            this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, newZoom));

            this.offset.x = touchCenter.x - cx - worldX * this.zoom;
            this.offset.y = touchCenter.y - cy - worldY * this.zoom;

            this.limitPan();
        }
    }

    // === Завершение касания ===
    onTouchEnd(e) {
        if (e.touches.length === 0) {
            if (this.mapPressMoved) this.suppressMapClickUntil = performance.now() + 500;
            this.isDragging = false;
            this.isTouching = false;
            this.canvas.style.cursor = "grab";
        } else if (e.touches.length === 1 && this.isTouching) {
            const touch = e.touches[0];
            this.isTouching = false;
            this.isDragging = true;
            this.dragStart.x = touch.clientX - this.offset.x;
            this.dragStart.y = touch.clientY - this.offset.y;
            this.canvas.style.cursor = "grabbing";
        }
    }

    // === Масштабирование колесиком ===
    onWheel(event) {
        const wheel = event.originalEvent || event;
        if (!Number.isFinite(wheel.deltaY) || wheel.deltaY === 0) return;
        event.preventDefault();
        this.cancelZoomAnimation();
        const zoomFactor = 1.1;
        const oldZoom = this.zoom;
        if (wheel.deltaY < 0) this.zoom *= zoomFactor;
        else this.zoom /= zoomFactor;
        this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom));

        // центрирование под курсором
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left - this.canvas.width / 2;
        const mouseY = event.clientY - rect.top - this.canvas.height / 2;
        this.offset.x -= (mouseX - this.offset.x) * (this.zoom / oldZoom - 1);
        this.offset.y -= (mouseY - this.offset.y) * (this.zoom / oldZoom - 1);

        this.limitPan();
    }

    // === Перемещение мышью ===
    onMouseDown(e) {
        if (e.button !== 0) return;
        this.mapPress = { x: e.clientX, y: e.clientY };
        this.mapPressMoved = false;
        this.isDragging = true;
        this.canvas.style.cursor = "grabbing";
        this.dragStart.x = e.clientX - this.offset.x;
        this.dragStart.y = e.clientY - this.offset.y;
        this.velocity = { x: 0, y: 0 };
        this.lastDrag = { x: e.clientX, y: e.clientY, time: performance.now() };
        this.inertiaActive = false;
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.canvas.style.cursor = "grab";
    }

    onMouseDrag(e) {
        if (!this.isDragging) return;
        this.offset.x = e.clientX - this.dragStart.x;
        this.offset.y = e.clientY - this.dragStart.y;
        this.limitPan();
    }

    onMouseMove(e) {
        if (!this.isDragging) {
            this.canvas.style.cursor = this.findMapObject(e) ? "pointer" : "grab";
            return;
        }
        this.trackMapPress(e);

        const now = performance.now();
        const dx = e.clientX - this.lastDrag.x;
        const dy = e.clientY - this.lastDrag.y;
        const dt = (now - this.lastDrag.time) / 16.67; // нормализуем к ~60fps

        this.offset.x = e.clientX - this.dragStart.x;
        this.offset.y = e.clientY - this.dragStart.y;
        this.limitPan();

        // скорость в пикселях/кадр
        this.velocity.x = dx / dt;
        this.velocity.y = dy / dt;

        this.lastDrag = { x: e.clientX, y: e.clientY, time: now };
    }

    trackMapPress(point) {
        if (this.mapPress && Math.hypot(point.clientX - this.mapPress.x, point.clientY - this.mapPress.y) > 6) {
            this.mapPressMoved = true;
        }
    }

    registerMapObject(kind, id, x, y, radius, extra = {}) {
        this.mapObjects.push({ kind, id: Number(id),
            x: this.canvas.width / 2 + this.offset.x + x * this.zoom,
            y: this.canvas.height / 2 + this.offset.y + y * this.zoom,
            radius: Math.max(12, radius * this.zoom), ...extra });
    }

    findMapObject(event) {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const x = (event.clientX - rect.left) * this.canvas.width / rect.width;
        const y = (event.clientY - rect.top) * this.canvas.height / rect.height;
        // В обратном порядке отрисовки: флот/планета поверх пояса и обломков.
        return this.mapObjects.slice().reverse().find(object => {
            const distance = Math.hypot(x - object.x, y - object.y);
            const hit = distance <= object.radius && distance >= (object.innerRadius || 0);
            const label = object.label;
            return hit || (label && x >= label.left && x <= label.right && y >= label.top && y <= label.bottom);
        }) || null;
    }

    onMapClick(event) {
        if (!this.pageActive || !this.SystemShow || this.mapPressMoved || performance.now() < this.suppressMapClickUntil) return;
        const object = this.findMapObject(event);
        if (object) this.openObjectMenu(object.kind, object.id, event);
        else this.closeObjectMenu();
    }

    // === Ограничение перемещения (границы панорамирования) ===
    limitPan() {
        const contentRect = this.$Content[0].getBoundingClientRect();
        const maxDistance = Math.max(
            Number(this.System?.max_distance) || 0,
            ...((this.Orbits || []).map((orbit) => Number(orbit.distance) || 0))
        );
        const systemRadius = this.orbitUeToPx(maxDistance || 12000) * this.zoom;
        const viewportHalfWidth = contentRect.width / 2;
        const viewportHalfHeight = Math.max(0, contentRect.height - 30) / 2;
        const edgeMargin = 70;

        // При увеличении разрешаем довести края системы до видимой области,
        // но не потерять её полностью за пределами canvas.
        const maxPanX = Math.max(0, systemRadius - viewportHalfWidth + edgeMargin);
        const maxPanY = Math.max(0, systemRadius - viewportHalfHeight + edgeMargin);

        this.offset.x = Math.max(-maxPanX, Math.min(maxPanX, this.offset.x));
        this.offset.y = Math.max(-maxPanY, Math.min(maxPanY, this.offset.y));
    }

    getSafeZoom() {
        return Math.max(Number(this.zoom) || 0, 0.00001);
    }

    // Экранные размеры объектов меняются мягче орбитальных расстояний:
    // система полноценно масштабируется, но планеты не превращаются в точки.
    getVisualScale() {
        const zoom = this.getSafeZoom();
        const fitZoom = Math.max(Number(this.fitZoom) || zoom, 0.00001);
        return Math.min(1.65, Math.max(0.82, Math.pow(zoom / fitZoom, 0.22)));
    }

    screenToWorld(pixels) {
        return pixels / this.getSafeZoom();
    }

    // === Размер планеты (нелинейный, в экранных пикселях) ===
    getPlanetSizePx(size_km) {
        const min_km = 3000;
        const max_km = 90000;
        const min_px = 22;
        const max_px = 48;
        const gamma = 0.55;
        const size = Number(size_km) || min_km;
        const norm = Math.min(1, Math.max(0, (size - min_km) / (max_km - min_km)));
        return (min_px + (max_px - min_px) * Math.pow(norm, gamma)) * this.getVisualScale();
    }

    getStarSizePx() {
        const starSize = Number(this.System?.star_size) || 10;
        const desiredSize = Math.min(108, Math.max(62, 54 + starSize * 2.2)) * this.getVisualScale();
        const nearestOrbitRadius = Math.min(
            ...((this.Orbits || [])
                .map((orbit) => this.orbitUeToPx(Number(orbit.distance)))
                .filter(Number.isFinite))
        );

        if (!Number.isFinite(nearestOrbitRadius)) return desiredSize;

        // Диаметр звезды не должен доходить до первой орбиты даже на minZoom.
        const maxSizeByOrbit = nearestOrbitRadius * this.getSafeZoom() * 1.25;
        return Math.max(12, Math.min(desiredSize, maxSizeByOrbit));
    }

    getGasGiantImageKey(orbitId, variant = null) {
        const generatedVariant = Number(variant);
        if (Number.isInteger(generatedVariant) && generatedVariant >= 1 && generatedVariant <= 6) {
            return `gas_${generatedVariant}`;
        }

        const galaxy = Number(this.System?.galaxy) || 0;
        const system = Number(this.System?.system) || 0;
        const orbit = Number(orbitId) || 0;
        return `gas_${((galaxy * 31 + system * 17 + orbit) % 6) + 1}`;
    }

    getGasGiantRingKey(orbitId, variant = null) {
        const generatedVariant = Number(variant);
        if (Number.isInteger(generatedVariant) && generatedVariant >= 1 && generatedVariant <= 3) {
            return `gas_ring_${generatedVariant}`;
        }

        const galaxy = Number(this.System?.galaxy) || 0;
        const system = Number(this.System?.system) || 0;
        const orbit = Number(orbitId) || 0;
        return `gas_ring_${((galaxy * 13 + system * 7 + orbit) % 3) + 1}`;
    }

    getResourceSitesForOrbit(orbitId) {
        return this.resourceSitesByOrbit?.[Number(orbitId)] || [];
    }

    getCurrentResourceSiteAngle(site) {
        const anchorAngle = Number(site?.anchor_angle) || 0;
        const speed = Number(site?.speed) || 0;
        const positionTime = Number(site?.position_time) || GameServerTime.now();
        const elapsedHours = Math.max(0, GameServerTime.now() - positionTime) / 3600;
        const direction = Number(site?.rotation) === 0 ? -1 : 1;
        let angle = (anchorAngle + direction * elapsedHours * speed * (this.SpeedPlanets / 24)) % 360;
        if (angle < 0) angle += 360;
        return angle;
    }

    /**
     * Перевод орбитальных единиц (у.е.) в пиксели
     * так, чтобы 600 у.е. = 480 px + offset
     * и масштаб был пропорционален.
     *
     * @param {number} orbit_ue - расстояние орбиты в у.е.
     * @param {Object} opts
     *   opts.minOrbitUE = 600
     *   opts.maxOrbitUE = 12000
     *   opts.minOrbitPx = 480    // радиус в пикселях для орбиты 600 у.е.
     *   opts.offsetPx = 80       // зазор от звезды в пикселях
     *   opts.maxOrbitPx = 8000   // радиус внешней орбиты (для 12000 у.е.)
     *   opts.mode = "linear"     // "linear" | "log" | "gamma"
     *   opts.gamma = 0.8         // если mode = "gamma"
    */
    orbitUeToPx(orbit_ue, opts = {}) {
        const systemMinDistance = Number(this.System?.min_distance) || 500;
        const visibleMaxDistance = Math.max(
            Number(this.System?.max_distance) || 20000,
            ...((this.Orbits || []).map((orbit) => Number(orbit.distance) || 0))
        );
        const {
            minOrbitUE = Math.max(1, Math.min(500, systemMinDistance)),
            maxOrbitUE = Math.max(minOrbitUE + 1, visibleMaxDistance),
            minOrbitPx = 480,
            offsetPx = 80,
            maxOrbitPx = 10480,
            mode = "linear",
            gamma = 0.8,
        } = opts;

        // clamp
        const ue = Math.min(maxOrbitUE, Math.max(minOrbitUE, orbit_ue));

        // нормализуем орбиту в диапазоне [0,1]
        let t;
        if (mode === "log") {
            t = (Math.log(ue) - Math.log(minOrbitUE)) /
                (Math.log(maxOrbitUE) - Math.log(minOrbitUE));
        } else {
            t = (ue - minOrbitUE) / (maxOrbitUE - minOrbitUE);
            if (mode === "gamma") t = Math.pow(t, gamma);
        }

        // линейная интерполяция
        return ((minOrbitPx + offsetPx) +
            (maxOrbitPx - (minOrbitPx + offsetPx)) * t) / 2;
    }

    getFleetCoordinatePhysicalPoint(coordinate, atTime) {
        if (!coordinate) return null;

        const type = Number(coordinate.type);
        if (type === 3) {
            return this.getFleetCoordinatePhysicalPoint(coordinate.lastKnownPosition, atTime);
        }

        const galaxy = Number(coordinate.galaxy);
        const system = Number(coordinate.system);
        if (galaxy !== Number(this.System.galaxy) || system !== Number(this.System.system)) {
            return null;
        }

        if (type === 2) {
            const distance = Number(coordinate.distance);
            const angle = Number(coordinate.angle);
            return Number.isFinite(distance) && Number.isFinite(angle)
                ? { distance, angle }
                : null;
        }

        if (type !== 1) return null;

        const orbit = this.orbitMap?.[Number(coordinate.orbit)];
        if (!orbit) return null;

        if (coordinate.objectType === undefined || coordinate.objectType === null) {
            const angle = Number(coordinate.angle);
            return Number.isFinite(angle)
                ? { distance: Number(orbit.distance), angle }
                : null;
        }
        if ([4, 5].includes(Number(coordinate.objectType))) {
            const site = this.ResourceSites.find(site => Number(site.id) === Number(coordinate.siteId));
            if (!site) return null;
            const direction = Number(site.rotation) === 0 ? -1 : 1;
            const angle = Number(site.anchor_angle) + direction * (Number(atTime) - Number(site.position_time)) / 3600
                * Number(site.speed) * (Number(this.SpeedPlanets) / 24);
            return { distance: Number(orbit.distance), angle: ((angle % 360) + 360) % 360 };
        }

        const planet = (this.Planets || []).find(item =>
            Number(item.planet) === Number(coordinate.orbit) && Number(item.planet_type) === 1
        );
        if (!planet) return null;

        const elapsedHours = Math.max(0, Number(atTime) - Number(planet.update_time)) / 3600;
        const direction = Number(planet.rotation) === 0 ? -1 : 1;
        let angle = Number(planet.deg)
            + direction * elapsedHours * Number(planet.speed) * (Number(this.SpeedPlanets) / 24);
        angle %= 360;
        if (angle < 0) angle += 360;

        return {
            distance: Number(orbit.distance),
            angle
        };
    }

    interpolateFleetPhysicalPoint(start, end, progress) {
        const startAngle = start.angle * Math.PI / 180;
        const endAngle = end.angle * Math.PI / 180;
        const startX = start.distance * Math.cos(startAngle);
        const startY = start.distance * Math.sin(startAngle);
        const endX = end.distance * Math.cos(endAngle);
        const endY = end.distance * Math.sin(endAngle);
        const x = startX + (endX - startX) * progress;
        const y = startY + (endY - startY) * progress;

        return {
            distance: Math.hypot(x, y),
            angle: Math.atan2(y, x) * 180 / Math.PI
        };
    }

    mapFleetPhysicalPoint(point) {
        const minDistance = Math.max(1, Math.min(500, Number(this.System?.min_distance) || 500));
        const innerRadius = this.orbitUeToPx(minDistance);
        const radius = point.distance < minDistance
            ? innerRadius * Math.max(0, point.distance) / minDistance
            : this.orbitUeToPx(point.distance);
        const angle = point.angle * Math.PI / 180;
        return {
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        };
    }

    isFleetStationary(fleet) {
        return Boolean(fleet.blocked_reason) || ["OBSERVE", "DEFEND", "RESEARCH"].includes(fleet.command?.key);
    }

    placeFleetMarker(x, y, labelWidth, occupied) {
        const halfWidth = Math.max(12, labelWidth / 2) + 4;
        const bounds = (x, y) => ({ left: x - halfWidth, right: x + halfWidth, top: y - 28, bottom: y + 14 });
        const fits = box => box.left >= 4 && box.right <= this.canvas.width - 4
            && box.top >= 4 && box.bottom <= this.canvas.height - 4
            && !occupied.some(other => box.left < other.right && box.right > other.left
                && box.top < other.bottom && box.bottom > other.top);
        let position = { x, y };
        // Ищем ближайшее свободное место только для значка/подписи, не для координат флота.
        search: for (let radius = 0; radius <= 192; radius += 24) {
            for (let step = 0; step < (radius ? 8 : 1); step++) {
                const angle = -Math.PI / 2 + step * Math.PI / 4;
                const candidate = { x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius };
                if (fits(bounds(candidate.x, candidate.y))) {
                    position = candidate;
                    break search;
                }
            }
        }
        occupied.push(bounds(position.x, position.y));
        return position;
    }

    drawFleetPath(ctx, start, end, color) {
        ctx.beginPath();
        for (let step = 0; step <= 24; step++) {
            const point = this.mapFleetPhysicalPoint(this.interpolateFleetPhysicalPoint(start, end, step / 24));
            if (step === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        }
        ctx.setLineDash([5, 6].map(value => this.screenToWorld(value)));
        ctx.strokeStyle = color.replace("0.95", "0.42");
        ctx.lineWidth = this.screenToWorld(1.3);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawFleetMarker(ctx, point, direction, stationary, fleetLabel, color) {
        const markerSize = this.screenToWorld(8);
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(direction);
        ctx.beginPath();
        if (stationary) {
            ctx.rect(-markerSize * .65, -markerSize * .7, markerSize * .45, markerSize * 1.4);
            ctx.rect(markerSize * .2, -markerSize * .7, markerSize * .45, markerSize * 1.4);
        } else {
            ctx.moveTo(markerSize, 0);
            ctx.lineTo(-markerSize * 0.75, markerSize * 0.62);
            ctx.lineTo(-markerSize * 0.35, 0);
            ctx.lineTo(-markerSize * 0.75, -markerSize * 0.62);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = this.screenToWorld(7);
        ctx.fill();
        ctx.rotate(-direction);
        ctx.shadowBlur = 0;
        ctx.font = `600 ${this.screenToWorld(11)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.lineWidth = this.screenToWorld(3);
        ctx.strokeStyle = "rgba(3,10,20,0.9)";
        ctx.strokeText(fleetLabel, 0, -this.screenToWorld(10));
        ctx.fillStyle = color;
        ctx.fillText(fleetLabel, 0, -this.screenToWorld(10));
        ctx.restore();
    }

    drawFlyingFleets(ctx, serverNow) {
        const orbitalSlots = new Map();
        const canvasRect = this.canvas.getBoundingClientRect();
        const occupied = this.$System.find(".GalaxyPlanetCaption").get().map(element => {
            const rect = element.getBoundingClientRect();
            return { left: (rect.left - canvasRect.left) * this.canvas.width / canvasRect.width,
                right: (rect.right - canvasRect.left) * this.canvas.width / canvasRect.width,
                top: (rect.top - canvasRect.top) * this.canvas.height / canvasRect.height,
                bottom: (rect.bottom - canvasRect.top) * this.canvas.height / canvasRect.height,
                visible: rect.width > 0 && rect.height > 0 };
        }).filter(box => box.visible);
        for (const fleet of this.FlyingFleets) {
            // Защита от старого snapshot: скрыта сама экспедиция, но не MOVE к ней/обратно.
            if (fleet.command?.key === "EXPEDITION") continue;
            const stationary = this.isFleetStationary(fleet);
            const startTime = Number(fleet.start_time);
            const endTime = Number(fleet.end_time);
            if (!stationary && (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime)) {
                continue;
            }

            const start = this.getFleetCoordinatePhysicalPoint(fleet.segment_start, stationary ? serverNow : startTime);
            const end = stationary ? start : this.getFleetCoordinatePhysicalPoint(fleet.segment_end, endTime);
            if (!start || !end) continue;

            const progress = stationary ? 0 : Math.max(0, Math.min(1, (serverNow - startTime) / (endTime - startTime)));
            const isIncoming = Boolean(fleet.is_incoming);
            const color = isIncoming
                ? (fleet.is_hostile ? "rgba(255,90,90,0.95)" : "rgba(110,235,125,0.95)")
                : (fleet.blocked_reason || fleet.is_return ? "rgba(255,190,85,0.95)" : "rgba(70,225,255,0.95)");
            const fleetLabel = isIncoming
                ? `${fleet.owner_name || "Чужой флот"} #${fleet.id}`
                : (fleet.name || `Флот #${fleet.id}`);

            ctx.save();
            ctx.strokeStyle = color.replace("0.95", "0.42");
            ctx.lineWidth = this.screenToWorld(1.3);
            if (!stationary) this.drawFleetPath(ctx, start, end, color);

            const current = this.mapFleetPhysicalPoint(
                this.interpolateFleetPhysicalPoint(start, end, progress)
            );
            const anchor = { ...current };
            // Только визуальное смещение: не перекрываем планету/луну и
            // разделяем стоящие у одной орбиты флоты. Физический anchor неизменен.
            if (stationary && Number(fleet.segment_start?.type) === 1
                && [1, 3].includes(Number(fleet.segment_start.objectType))) {
                const orbit = Number(fleet.segment_start.orbit);
                const slot = orbitalSlots.get(orbit) || 0;
                orbitalSlots.set(orbit, slot + 1);
                current.x -= this.screenToWorld(40);
                current.y -= this.screenToWorld(12 + slot * 30);
            }
            // Название над маркером тоже является целью клика.
            const labelWidth = Math.max(44, fleetLabel.length * 7);
            const preferredX = this.canvas.width / 2 + this.offset.x + current.x * this.zoom;
            const preferredY = this.canvas.height / 2 + this.offset.y + current.y * this.zoom;
            const { x: markerX, y: markerY } = this.placeFleetMarker(preferredX, preferredY, labelWidth, occupied);
            current.x += this.screenToWorld(markerX - preferredX);
            current.y += this.screenToWorld(markerY - preferredY);
            if (Math.hypot(current.x - anchor.x, current.y - anchor.y) > .001) {
                ctx.beginPath();
                ctx.moveTo(anchor.x, anchor.y);
                ctx.lineTo(current.x, current.y);
                ctx.stroke();
            }
            this.registerMapObject("fleet", fleet.id, current.x, current.y, this.screenToWorld(12), {
                label: { left: markerX - labelWidth / 2, right: markerX + labelWidth / 2, top: markerY - 25, bottom: markerY - 8 }
            });
            const next = this.mapFleetPhysicalPoint(
                this.interpolateFleetPhysicalPoint(start, end, Math.min(1, progress + 0.002))
            );
            const direction = stationary ? 0 : Math.atan2(next.y - anchor.y, next.x - anchor.x);
            this.drawFleetMarker(ctx, current, direction, stationary, fleetLabel, color);
            ctx.restore();
        }
        return occupied;
    }


    // === Автоматический расчет размера canvas ===
    adjustCanvasSize() {
        const contentRect = this.$Content?.[0]?.getBoundingClientRect();
        const width = Math.max(320, Math.round(contentRect?.width || window.innerWidth));
        const height = Math.max(320, Math.round(contentRect?.height || window.innerHeight) - 30);

        // Орбитальные координаты масштабируются через ctx.scale(this.zoom),
        // поэтому backing buffer соответствует viewport, а не диаметру мира.
        // Даже присваивание прежнего размера очищает backing buffer canvas.
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;

    }

    // === Загрузка изображений ===
    async loadPlanetImages(planets) {
        const promises = [];
        this.planetImages = this.planetImages || {};
        this.asteroidSprites = this.asteroidSprites || {};
        this.starSprites = this.starSprites || {};
        this.gasGiantSprites = this.gasGiantSprites || {};
        this.gasGiantRingSprites = this.gasGiantRingSprites || {};
        if (!this.debrisSprite) {
            const image = new Image();
            promises.push(new Promise(resolve => { image.onload = resolve; image.onerror = resolve; }));
            image.src = "/images/planets/galaxy/debris-ring-v2.png";
            this.debrisSprite = image;
        }

        // === Загрузка планет ===
        for (const p of planets) {
            if (!p.image) continue;
            const key = p.image;
            if (!this.planetImages[key]) {
                const img = new Image(128, 128);
                const promise = new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
                img.src = `/images/planets/galaxy/${key}.png`;
                this.planetImages[key] = img;
                promises.push(promise);
            }
        }

        // === Загрузка газовых гигантов ===
        for (const orbit of this.Orbits || []) {
            if (Number(orbit.type) !== 2) continue;
            const site = this.getResourceSitesForOrbit(orbit.orbit)
                .find((item) => Number(item.site_type) === this.resourceSiteTypes.GAS_GIANT);
            const key = this.getGasGiantImageKey(orbit.orbit, site?.visual_variant);
            if (!this.gasGiantSprites[key]) {
                const img = new Image(128, 128);
                const promise = new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
                img.src = `/images/planets/galaxy/${key}.png`;
                this.gasGiantSprites[key] = img;
                promises.push(promise);
            }

            const ringKey = this.getGasGiantRingKey(orbit.orbit, site?.ring_variant);
            if (!this.gasGiantRingSprites[ringKey]) {
                const ringImg = new Image(512, 256);
                const ringPromise = new Promise((resolve) => {
                    ringImg.onload = resolve;
                    ringImg.onerror = resolve;
                });
                ringImg.src = `/images/planets/galaxy/${ringKey}.png`;
                this.gasGiantRingSprites[ringKey] = ringImg;
                promises.push(ringPromise);
            }
        }

        // === Загрузка звезды (солнца) ===
        const starType = this.System.star_type || "G"; // дефолтная звезда, если не указано
        const starKey = `star_${starType}`;
        if (!this.starSprites[starKey]) {
            const img = new Image(128, 128);
            const promise = new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            });
            img.src = `/images/stars/${starKey}.png`;
            this.starSprites[starKey] = img;
            promises.push(promise);
        }

        // === Загрузка астероидов ===
        for (const [id, [w, h]] of Object.entries(this.asteroidSpriteSizes)) {
            const starKey = `asteroid_${id}`;
            if (this.asteroidSprites[id]) continue; // уже загружено
            const img = new Image(w, h);
            const promise = new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
            });
            img.src = `/images/asteroids/${starKey}.png`;
            this.asteroidSprites[id] = img;
            promises.push(promise);
        }

        await Promise.all(promises);
    }

    isImageLoaded(image) {
        return Boolean(image?.complete && image.naturalWidth > 0);
    }


    generateAsteroidBelt(orbitId, options) {

        const { radius, beltWidth, sites = [] } = options;
        const motionSite = sites.find(
            (site) => Number(site.site_type) === this.resourceSiteTypes.ASTEROID_SECTOR
        ) || null;
        const previous = this.asteroidBelts[orbitId];
        if (previous?.radius === radius && previous.beltWidth === beltWidth) {
            // Меняем authoritative опору движения, но не случайные частицы/фазу.
            previous.motionSite = motionSite;
            return;
        }

        const baseDensity = 0.25;
        // Тысячи отдельных drawImage на каждом кадре блокируют UI при смене
        // системы. Плотность пояса сохраняется, но число визуальных объектов
        // ограничено практически достаточным значением.
        const count = Math.min(
            500,
            Math.floor(2 * Math.PI * radius * baseDensity * (0.8 + Math.random() * 0.4))
        );

        // список доступных ключей спрайтов астероидов
        const spriteKeys = Object.keys(this.asteroidSprites);
        const asteroids = [];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r = radius + (Math.random() - 0.5) * beltWidth;

            // выбираем случайный спрайт по ключу
            const spriteKey = spriteKeys[Math.floor(Math.random() * spriteKeys.length)];

            const sizeRand = 1.6 + Math.random() * 0.8; // немного разных размеров
            const alpha = 0.7 + Math.random() * 0.3; // постоянная прозрачность (без мерцания)
            // вращение вокруг собственной оси
            const rotation = Math.random() * Math.PI * 2;
            const rotationSpeed = (Math.random() * 0.02 + 0.01) * (Math.random() < 0.5 ? -1 : 1);

            asteroids.push({
                angle, r, spriteKey, sizeRand,
                alpha,
                rotation, rotationSpeed
            });
        }

        this.asteroidBelts[orbitId] = {
            radius,
            asteroids,
            motionSite,
            beltWidth,
            // Игровая позиция секторов остаётся серверной. visualRotation
            // относится только к декоративным частицам, чтобы пояс не
            // выглядел неподвижной картинкой при медленном орбитальном ходе.
            globalRotation: Math.random() * Math.PI * 2,
            visualRotation: 0,
            visualSpeed: (0.22 + Math.random() * 0.12) * Math.PI / 180,
            lastFrameTime: performance.now()
        };
    }

    drawAsteroidBelt(orbitId) {
        const ctx = this.ctx;
        const beltData = this.asteroidBelts[orbitId];
        if (!beltData) return;

        const { asteroids } = beltData;
        const frameTime = performance.now();
        const deltaSeconds = Math.min(0.1, Math.max(0, (frameTime - beltData.lastFrameTime) / 1000));
        beltData.lastFrameTime = frameTime;

        const direction = Number(beltData.motionSite?.rotation) === 0 ? -1 : 1;
        beltData.visualRotation += direction * beltData.visualSpeed * deltaSeconds;
        const authoritativeRotation = beltData.motionSite
            ? this.getCurrentResourceSiteAngle(beltData.motionSite) * Math.PI / 180
            : beltData.globalRotation;
        beltData.globalRotation = authoritativeRotation;

        const visualScale = this.getVisualScale();

        ctx.save();
        // Дополнительная фаза используется только для декоративных частиц.
        // Сектора ниже отрисовываются строго по server-authoritative углам.
        ctx.rotate(authoritativeRotation + beltData.visualRotation);

        for (const a of asteroids) {
            // Частицы — только визуальное наполнение пояса. Их угловое
            // положение относительно пояса постоянно; весь пояс движется по
            // server-authoritative орбите.
            a.rotation += a.rotationSpeed * 1; // вращаем вокруг оси

            const x = a.r * Math.cos(a.angle);
            const y = a.r * Math.sin(a.angle);

            const img = this.asteroidSprites[a.spriteKey];
            const [w, h] = this.asteroidSpriteSizes[a.spriteKey.replace("asteroid_", "")] || [64, 64];


            const maxSpriteSide = Math.max(w, h);
            const screenSize = (2.5 + a.sizeRand * 1.35) * visualScale;
            const scaledW = this.screenToWorld(screenSize * (w / maxSpriteSide));
            const scaledH = this.screenToWorld(screenSize * (h / maxSpriteSide));

            ctx.globalAlpha = a.alpha;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a.rotation * 0.1); // вращаем сам спрайт

            if (!this.isImageLoaded(img)) {
                ctx.beginPath();
                ctx.arc(0, 0, this.screenToWorld(1.5 * a.sizeRand), 0, 2 * Math.PI);
                ctx.fillStyle = "gray";
                ctx.fill();
            } else {
                ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
                //ctx.drawImage(img, x - scaledW / 2, y - scaledH / 2, scaledW, scaledH);

                /*
                ctx.globalCompositeOperation = "source-atop"; // красим только непрозрачные пиксели
                ctx.fillStyle = "hsla(30, 90%, 45%, 1.00)"; // можно задать любой оттенок — например коричнево-серый
                ctx.fillRect(-scaledW / 2, -scaledH / 2, scaledW, scaledH);
                ctx.globalCompositeOperation = "source-over";
                */
            }
            ctx.restore();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    drawAsteroidSectors(orbitId, radius) {
        const sites = this.getResourceSitesForOrbit(orbitId)
            .filter((site) => Number(site.site_type) === this.resourceSiteTypes.ASTEROID_SECTOR)
            .sort((left, right) => Number(left.sector) - Number(right.sector));
        if (!sites.length) return;

        const ctx = this.ctx;
        const beltWidth = Number(this.asteroidBelts?.[orbitId]?.beltWidth) || 64;
        const innerRadius = Math.max(0, radius - beltWidth / 2);
        const outerRadius = radius + beltWidth / 2;

        for (let index = 0; index < sites.length; index++) {
            const site = sites[index];
            const center = this.getCurrentResourceSiteAngle(site) * Math.PI / 180;
            const halfWidth = Math.max(0, Number(site.arc_width) || 0) * Math.PI / 360;
            if (halfWidth <= 0) continue;

            const start = center - halfWidth;
            const end = center + halfWidth;
            const alpha = index % 2 === 0 ? 0.22 : 0.12;
            const fill = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
            fill.addColorStop(0, "rgba(91, 205, 230, 0.015)");
            fill.addColorStop(0.18, `rgba(91, 205, 230, ${alpha * 0.72})`);
            fill.addColorStop(0.5, `rgba(91, 205, 230, ${alpha})`);
            fill.addColorStop(0.82, `rgba(91, 205, 230, ${alpha * 0.72})`);
            fill.addColorStop(1, "rgba(91, 205, 230, 0.015)");

            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, outerRadius, start, end);
            ctx.arc(0, 0, innerRadius, end, start, true);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.restore();
        }
    }

    drawAsteroidSectorLabels(orbitId, radius) {
        const sites = this.getResourceSitesForOrbit(orbitId)
            .filter((site) => Number(site.site_type) === this.resourceSiteTypes.ASTEROID_SECTOR)
            .sort((left, right) => Number(left.sector) - Number(right.sector));
        if (!sites.length) return;

        const ctx = this.ctx;
        const beltWidth = Number(this.asteroidBelts?.[orbitId]?.beltWidth) || 64;
        const labelRadius = radius + beltWidth * 0.32;
        const fontSize = this.screenToWorld(9 * this.getVisualScale());

        for (const site of sites) {
            const center = this.getCurrentResourceSiteAngle(site) * Math.PI / 180;

            const x = labelRadius * Math.cos(center);
            const y = labelRadius * Math.sin(center);
            ctx.save();
            ctx.font = `600 ${fontSize}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = this.screenToWorld(2.2);
            ctx.strokeStyle = "rgba(3, 10, 18, 0.82)";
            ctx.strokeText(`С${site.sector}`, x, y);
            ctx.fillStyle = "rgba(183, 231, 242, 0.72)";
            ctx.fillText(`С${site.sector}`, x, y);
            ctx.restore();
            this.registerMapObject("sector", site.id, x, y, this.screenToWorld(13));
        }
    }

    generateGasGiant(orbitId, options) {
        const {
            radius,        // расстояние от звезды
            name = "Gas Giant",
            color = "rgba(100,180,255,1)",
            ringColor = "rgba(180,200,255,0.35)",
            ringInner = 1.8,   // внутр. радиус кольца (в кратных радиусах планеты)
            ringOuter = 1.8,   // ширина ring-спрайта (в диаметрах планеты)
            size = 60000,      // диаметр планеты (в км, для getPlanetSizePx)
            speed = 0.3,       // скорость вращения
            rotation = 1,      // направление вращения (0 или 1)
            site = null
        } = options;

        // сохраняем как отдельный объект для отрисовки
        this.gasGiants ??= {};
        this.gasGiants[orbitId] = {
            orbitId,
            radius,
            name,
            color,
            ringColor,
            ringInner,
            ringOuter,
            size,
            speed,
            rotation,
            site,
            imageKey: options.imageKey || this.getGasGiantImageKey(orbitId, site?.visual_variant),
            ringImageKey: options.ringImageKey || this.getGasGiantRingKey(orbitId, site?.ring_variant),
            ringRotation: ((((Number(orbitId) || 0) * 37) % 31) - 15) * Math.PI / 180,
            // Fallback для старого server response. При наличии site угол на
            // каждом кадре рассчитывается из server time.
            deg: this.gasGiants[orbitId]?.deg ?? Math.random() * 360
        };
    }

    drawGasGiantRingHalf(giant, x, y, planetDiameter, front) {
        const ctx = this.ctx;
        const image = this.gasGiantRingSprites?.[giant.ringImageKey];
        if (!this.isImageLoaded(image)) return false;

        const sourceHalf = Math.floor(image.naturalHeight / 2);
        const sourceY = front ? sourceHalf : 0;
        const sourceHeight = front ? image.naturalHeight - sourceHalf : sourceHalf;
        const ringWidth = planetDiameter * giant.ringOuter;
        const ringHeight = ringWidth * image.naturalHeight / image.naturalWidth;
        const destinationY = front ? 0 : -ringHeight / 2;
        const destinationHeight = ringHeight / 2;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(giant.ringRotation);
        ctx.drawImage(
            image,
            0,
            sourceY,
            image.naturalWidth,
            sourceHeight,
            -ringWidth / 2,
            destinationY,
            ringWidth,
            destinationHeight
        );
        ctx.restore();

        return true;
    }

    drawGasGiant(giant) {
        const ctx = this.ctx;
        const diameter = this.screenToWorld(this.getPlanetSizePx(giant.size));
        const radius = diameter / 2;

        // вычисляем положение по орбите
        const angle = giant.site
            ? this.getCurrentResourceSiteAngle(giant.site)
            : giant.deg;
        const rad = (angle * Math.PI) / 180;
        const x = giant.radius * Math.cos(rad);
        const y = giant.radius * Math.sin(rad);
        this.registerMapObject("gas", giant.orbitId, x, y, radius + this.screenToWorld(5));

        // Дальняя половина отдельного ring-спрайта рисуется за планетой.
        const hasRingSprite = this.drawGasGiantRingHalf(giant, x, y, diameter, false);
        if (!hasRingSprite) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(giant.ringRotation);
            ctx.beginPath();
            ctx.ellipse(0, 0, radius * giant.ringOuter, radius * giant.ringInner, 0, 0, 2 * Math.PI);
            ctx.strokeStyle = giant.ringColor;
            ctx.lineWidth = this.screenToWorld(1.5);
            ctx.stroke();
            ctx.restore();
        }

        // Сам гигант использует тот же sprite pipeline, что и обычные планеты.
        const image = this.gasGiantSprites?.[giant.imageKey];
        if (this.isImageLoaded(image)) {
            ctx.drawImage(image, x - radius, y - radius, diameter, diameter);
        } else {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            const gradient = ctx.createRadialGradient(
                x - radius * 0.35,
                y - radius * 0.35,
                radius * 0.1,
                x,
                y,
                radius
            );
            gradient.addColorStop(0, "rgba(225,240,255,1)");
            gradient.addColorStop(0.28, giant.color);
            gradient.addColorStop(1, "rgba(28,55,125,1)");
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Ближняя половина проходит перед планетой и завершает объём колец.
        if (hasRingSprite) this.drawGasGiantRingHalf(giant, x, y, diameter, true);

        // Старый response без ResourceSites сохраняет прежнюю локальную
        // анимацию. Для нового контракта положение всегда выводится из site.
        if (!giant.site) {
            const direction = Number(giant.rotation) === 0 ? -1 : 1;
            giant.deg += giant.speed * direction * 0.1;
        }
    }

    // === Отрисовка ===
    renderPlanets() {

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        this.mapObjects = [];

        ctx.clearRect(0, 0, w, h);

        // Локальная подсветка системы поверх общего звёздного фона страницы.
        const ambient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.72);
        ambient.addColorStop(0, "rgba(22,48,82,0.24)");
        ambient.addColorStop(0.42, "rgba(8,22,42,0.10)");
        ambient.addColorStop(1, "rgba(0,0,0,0.18)");
        ctx.fillStyle = ambient;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(cx + this.offset.x, cy + this.offset.y);
        ctx.scale(this.zoom, this.zoom);

        // солнце
        const starType = this.System.star_type || "G"; // дефолтная звезда, если не указано
        const starKey = `star_${starType}`;
        const star = this.starSprites[starKey];

        const star_size = this.screenToWorld(this.getStarSizePx());
        const starRadius = star_size / 2;
        const nearestOrbitRadius = Math.min(
            ...((this.Orbits || [])
                .map((orbit) => this.orbitUeToPx(Number(orbit.distance)))
                .filter(Number.isFinite))
        );
        const starGlowRadius = Number.isFinite(nearestOrbitRadius)
            ? Math.min(starRadius * 1.6, nearestOrbitRadius * 0.82)
            : starRadius * 1.6;
        const starGlow = ctx.createRadialGradient(0, 0, starRadius * 0.35, 0, 0, starGlowRadius);
        starGlow.addColorStop(0, this.System.color || "rgba(255,225,155,0.9)");
        starGlow.addColorStop(0.45, "rgba(255,205,100,0.24)");
        starGlow.addColorStop(1, "rgba(255,180,70,0)");
        ctx.beginPath();
        ctx.arc(0, 0, starGlowRadius, 0, 2 * Math.PI);
        ctx.fillStyle = starGlow;
        ctx.fill();

        if (this.isImageLoaded(star)) {
            ctx.drawImage(star, star_size / 2 * -1, star_size / 2 * -1, star_size, star_size);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, star_size / 2, 0, 2 * Math.PI);
            ctx.fillStyle = this.System.color;
            ctx.fill();
        }

        for (const orbit of this.Orbits) {
            const dist = this.orbitUeToPx(orbit.distance);
            const rad = dist;
            if (orbit.type == 1) {
                this.drawAsteroidSectors(orbit.orbit, rad);
                this.drawAsteroidBelt(orbit.orbit);
                this.drawAsteroidSectorLabels(orbit.orbit, rad);
            } else if (orbit.type == 2) {
                ctx.beginPath();
                ctx.arc(0, 0, rad, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(104,151,207,0.36)";
                ctx.lineWidth = this.screenToWorld(1.1);
                ctx.stroke();

                const giant = this.gasGiants?.[orbit.orbit];
                if (giant) this.drawGasGiant(giant);

            } else if (orbit.type == 3 || orbit.type == 4) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, rad, 0, 2 * Math.PI);
                ctx.setLineDash((orbit.type == 3 ? [12, 8] : [3, 7]).map(value => this.screenToWorld(value)));
                ctx.strokeStyle = orbit.type == 3
                    ? "rgba(90,180,255,0.45)"
                    : "rgba(190,110,255,0.55)";
                ctx.lineWidth = this.screenToWorld(orbit.type == 3 ? 1.4 : 1.6);
                ctx.stroke();
                ctx.restore();

            } else {
                const isFree = this.freeOrbitsOpen && this.freeOrbitIds.has(Number(orbit.orbit));
                const isSelected = isFree && Number(orbit.orbit) === this.selectedFreeOrbit;
                ctx.save();
                ctx.beginPath();
                ctx.arc(0, 0, rad, 0, 2 * Math.PI);
                ctx.strokeStyle = isSelected ? "rgba(130,235,145,0.95)"
                    : isFree ? "rgba(102,187,106,0.45)" : "rgba(180,215,255,0.22)";
                ctx.lineWidth = this.screenToWorld(isSelected ? 2.2 : isFree ? 1.1 : 0.85);
                if (isSelected) {
                    ctx.shadowColor = "rgba(102,187,106,0.65)";
                    ctx.shadowBlur = 6;
                }
                ctx.stroke();
                ctx.restore();
            }
        }

        this.drawSpaceDebris(ctx);

        // === Получаем текущее серверное время ===
        const serverNow = GameServerTime.now(); // float, например 1761326451.2070699


        for (const p of this.Planets) {
            if (Number(p.planet_type) === 3) continue;
            const orbit = this.orbitMap[p.planet];
            if (!orbit) continue;
            const dist = this.orbitUeToPx(orbit.distance);

            const rotationDir = (p.rotation === 0) ? -1 : 1;

            /// --- Расчёт угла в градусах ---
            const deltaHours = (serverNow - p.update_time) / 3600; // сколько часов прошло

            const degShift = deltaHours * p.speed * (this.SpeedPlanets / 24);
            let deg = (p.deg + rotationDir * degShift) % 360;
            if (deg < 0) deg += 360;

            const rad = deg * Math.PI / 180;
            const x = dist * Math.cos(rad);
            const y = dist * Math.sin(rad);

            const diameter = this.screenToWorld(this.getPlanetSizePx(p.size));
            const radius = diameter / 2;
            // Центральная область планеты имеет приоритет над кольцом обломков.

            const img = this.planetImages[p.image];
            this.drawPlanetDebris(ctx, p, x, y, radius);
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius + this.screenToWorld(p.OwnPlanet ? 3.5 : 2), 0, 2 * Math.PI);
            ctx.fillStyle = p.OwnPlanet ? "rgba(80,205,255,0.22)" : "rgba(150,190,230,0.10)";
            ctx.fill();
            ctx.strokeStyle = p.OwnPlanet ? "rgba(100,225,255,0.92)" : "rgba(175,210,240,0.38)";
            ctx.lineWidth = this.screenToWorld(p.OwnPlanet ? 1.5 : 0.8);
            ctx.stroke();

            if (this.isImageLoaded(img))
                ctx.drawImage(img, x - radius, y - radius, diameter, diameter);
            else {
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = "gray";
                ctx.fill();
            }
            ctx.restore();

            this.registerMapObject("planet", p.id, x, y, radius + this.screenToWorld(3));
            this.drawPlanetMoon(ctx, p, x, y, radius);

            this.renderPlanetsNamePosition(p, x, y, radius, cx, cy)

        }

        const fleetLabels = this.drawFlyingFleets(ctx, serverNow);
        this.drawSensorContacts(ctx, serverNow, fleetLabels);

        ctx.restore();
    }

    drawSpaceDebris(ctx) {
        for (const field of this.SpaceDebris) {
            const position = this.mapFleetPhysicalPoint(field.coordinate);
            if (!position || Number(field.metal) + Number(field.crystal) <= 0) continue;
            const unit = this.screenToWorld(1);
            ctx.save();
            ctx.translate(position.x, position.y);
            ctx.scale(unit, unit);
            const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 17);
            glow.addColorStop(0, "rgba(170,190,215,.28)");
            glow.addColorStop(1, "rgba(170,190,215,0)");
            ctx.fillStyle = glow;
            ctx.fillRect(-17, -17, 34, 34);
            [[-7, -3, 4], [1, -6, 3], [6, 1, 4], [-3, 5, 3], [4, 7, 2]].forEach(([x, y, r], i) => {
                ctx.beginPath();
                ctx.moveTo(x - r, y);
                ctx.lineTo(x - r / 3, y - r);
                ctx.lineTo(x + r, y - r / 2);
                ctx.lineTo(x + r / 2, y + r);
                ctx.closePath();
                ctx.fillStyle = i % 2 ? "#94bdd9" : "#bdad91";
                ctx.fill();
                ctx.strokeStyle = "rgba(220,230,240,.65)";
                ctx.lineWidth = .6;
                ctx.stroke();
            });
            ctx.font = "10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#d9e3ee";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 3;
            ctx.fillText(Lang.debris.Title, 0, 25);
            ctx.restore();
            this.registerMapObject("space_debris", field.id, position.x, position.y, this.screenToWorld(15));
        }
    }

    getPlanetMoon(planet) {
        if (Number(planet.planet_type) !== 1) return null;
        return this.Planets.find(item => Number(item.planet_type) === 3
            && Number(item.galaxy) === Number(planet.galaxy) && Number(item.system) === Number(planet.system)
            && Number(item.planet) === Number(planet.planet)) || null;
    }

    drawPlanetMoon(ctx, planet, x, y, radius) {
        const moon = this.getPlanetMoon(planet);
        if (!moon) return;
        const moonRadius = this.screenToWorld(6);
        const moonX = x + radius + moonRadius + this.screenToWorld(5);
        const moonY = y - radius * .6;
        const image = this.planetImages[moon.image];
        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#abb5bd";
        ctx.fill();
        if (this.isImageLoaded(image)) ctx.drawImage(image, moonX - moonRadius, moonY - moonRadius, moonRadius * 2, moonRadius * 2);
        ctx.strokeStyle = moon.OwnPlanet ? "#64e1ff" : "#aebed0";
        ctx.lineWidth = this.screenToWorld(1);
        ctx.stroke();
        ctx.restore();
        // Смещение только визуальное: физические координаты остаются координатами планеты.
        this.registerMapObject("planet", moon.id, moonX, moonY, moonRadius);
    }

    drawPlanetDebris(ctx, planet, x, y, radius) {
        if (Number(planet.planet_type) !== 1
            || !(Number(planet.Debris?.metal || 0) + Number(planet.Debris?.crystal || 0) > 0)) return;
        // Графический слой принадлежит планете: тот же x/y, без отдельной скорости.
        // Прозрачный центр занимает около 70% диаметра спрайта.
        // Фрагменты располагаются снаружи планеты и её рамки, не под ними.
        const outerRadius = (radius + this.screenToWorld(6)) / 0.7;
        const width = outerRadius * 2;
        this.registerMapObject("debris", planet.id, x, y, outerRadius + this.screenToWorld(3), {
            innerRadius: (radius + this.screenToWorld(3)) * this.zoom
        });
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.92;
        if (this.isImageLoaded(this.debrisSprite)) {
            ctx.drawImage(this.debrisSprite, -outerRadius, -outerRadius, width, width);
        } else {
            ctx.fillStyle = "#c3a989";
            for (let i = 0; i < 20; i++) {
                const angle = i * Math.PI * 2 / 20;
                const orbitRadius = radius + this.screenToWorld(6 + i % 3);
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * orbitRadius, Math.sin(angle) * orbitRadius,
                    this.screenToWorld(0.8 + (i % 3) * 0.2), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // === Вычисление минимального зума, чтобы система влезала в div + 50px ===
    calculateZoomFit() {
        // --- 1. Размер контейнера ---
        const contentRect = this.$System[0].getBoundingClientRect();
        const availableWidth = contentRect.width;
        const availableHeight = contentRect.height;

        // --- 2. Находим максимальную орбиту ---
        const maxOrbit = this.System.max_distance || 12000;

        // --- 3. Получаем радиус в пикселях ---
        const maxOrbitPx = this.orbitUeToPx(maxOrbit);

        // --- 4. Вычисляем масштаб, чтобы система влезла ---
        const zoomByWidth = (availableWidth / 2) / (maxOrbitPx + 100); // +100 запас
        const zoomByHeight = (availableHeight / 2) / (maxOrbitPx + 100);

        // --- 5. Берём минимальное значение ---
        let fitZoom = Math.min(zoomByWidth, zoomByHeight) * 0.9; // небольшой отступ от краёв

        // --- 6. Устанавливаем ограничения ---
        this.fitZoom = fitZoom;
        this.minZoom = fitZoom * 0.5;
        this.maxZoom = fitZoom * 10;
        //this.zoom = this.minZoom;            // стартовое значение

        console.log("Zoom calculated:", {
            fitZoom,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom,
            maxOrbitPx
        });

        // Плавный переход к целевому масштабу
        this.smoothZoomTo(fitZoom, 1200);

    }

    smoothZoomTo(targetZoom, duration = 1000) {
        this.cancelZoomAnimation();

        const startZoom = this.zoom;
        const delta = targetZoom - startZoom;
        const startTime = performance.now();
        // Snapshot той же системы не отменяет zoom. Его жизненный цикл
        // меняется только при отмене/замене анимации, смене системы и Hide.
        const zoomVersion = this.zoomAnimationVersion;

        const animateZoom = (now) => {
            if (zoomVersion !== this.zoomAnimationVersion) return;

            const progress = Math.min((now - startTime) / duration, 1);
            // плавная интерполяция (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);

            this.zoom = startZoom + delta * eased;
            this.renderPlanets();

            if (progress < 1) {
                this.zoomAnimationFrameId = requestAnimationFrame(animateZoom);
            } else {
                this.zoom = targetZoom;
                this.zoomAnimationFrameId = null;
            }
        };

        this.zoomAnimationFrameId = requestAnimationFrame(animateZoom);
    }

    cancelZoomAnimation() {
        ++this.zoomAnimationVersion;
        if (this.zoomAnimationFrameId !== null) {
            cancelAnimationFrame(this.zoomAnimationFrameId);
            this.zoomAnimationFrameId = null;
        }
    }

    // === Анимация ===
    animate() {
        const now = performance.now();
        if (!this.lastFrameTime) this.lastFrameTime = now;
        const delta = now - this.lastFrameTime;

        if (delta > 50 && !this.zoomAnimationFrameId) { // до 20 FPS; zoom рисует своим loop
            this.renderPlanets();
            this.lastFrameTime = now;
        }

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    // === Остановка анимации ===
    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    Hide() {
        this.navigationTarget = null;
        this.sensorContactPositions.clear();
        this.phalanxPending = null;
        this.stopPhalanxClock();
        this.closeObjectMenu();
        $(document).off("click.galaxyObjectMenu keydown.galaxyObjectMenu");
        $(window).off("resize.galaxyObjectMenu");
        this.setFreeOrbitsOpen(false);
        this.$System[0].removeEventListener("wheel", this.wheelHandler);
        ToolTip.$Tip[0].removeEventListener("wheel", this.wheelHandler);
        if (this.$System[0].contains(ToolTip.parent)) ToolTip.hide();
        super.Hide();
        this.renderVersion += 1;
        this.stopAnimation();
        this.cancelZoomAnimation();
        this.$System?.stop(true, true).hide();
    }

    NavigationEvent(e) {

        if ($(e.currentTarget).attr("disabled")) {
            return false;
        }

        const target = e.currentTarget;
        const id = target.id;

        let Galaxy = Number(this.$Content.Navigation.Galaxy.Input.val());
        let System = Number(this.$Content.Navigation.System.Input.val());

        switch (id) {
            case "NavigationGalaxyNext":
                Galaxy += 1;
                break;
            case "NavigationGalaxyPrev":
                Galaxy -= 1;
                break;
            case "NavigationSystemNext":
                System += 1;
                break;
            case "NavigationSystemPrev":
                System -= 1;
                break;
            case "NavigationOrbit":
            case "NavigationGalaxyInput":
            case "NavigationSystemInput":
                break;
            default:
                return;
        }

        if (!Number.isFinite(Galaxy) || !Number.isFinite(System)) return;
        Galaxy = Math.max(1, Math.min(this.MaxGalaxy, Math.trunc(Galaxy)));
        System = Math.max(1, Math.min(this.MaxSystem, Math.trunc(System)));
        this.$Content.Navigation.Galaxy.Input.val(Galaxy);
        this.$Content.Navigation.System.Input.val(System);
        this.renderNavigation();

        const navigationTarget = `${Galaxy}:${System}`;
        if (this.navigationTarget === navigationTarget
            || (id !== "NavigationOrbit" && this.navigationTarget === null
                && Number(this.System.galaxy) === Galaxy && Number(this.System.system) === System)) return;
        this.navigationTarget = navigationTarget;

        this.closeObjectMenu();
        this.setFreeOrbitsOpen(false);
        this.smoothZoomTo(this.minZoom, 250);
        this.stopAnimation();
        this.SystemShow = false;
        this.$System.stop(true, true).fadeOut(250, () => {
            this.SystemShow = false;
        });

        GameEvents.emit("SendServer", {
            mode: "galaxy",
            // Карта уже скрывается сама. Отправка не должна зависеть от
            // callback общего Overlay, который может отменить фоновый render.
            NotOverlay: true,
            //action: act,
            data: {
                'galaxy': Galaxy,
                'system': System
            },
            onSuccess: (message) => {
                this.navigationTarget = null;
                ShowPage.Show(message.mode, message);
            },
            onError: (error) => {
                this.navigationTarget = null;
                Dialog.ErrorLoad(error.message);
            },
            ...this.getRequestOptions({ latestKey: "galaxy" })
        });
    }

    CreateNavigation() {
        //this.$Content.Buttons = {};
        this.$Content.Navigation = $("<div>").addClass("Navigation");

        const coordinateInput = (event) => {
            this.renderNavigation();
            // Кнопка сама применит поля: blur перед её click не должен делать
            // лишний переход (особенно перед переходом стрелкой).
            if (event.type === "blur" && !$(event.relatedTarget).is(
                "#NavigationOrbit, #NavigationGalaxyBlock button, #NavigationSystemBlock button"
            )) this.NavigationEvent(event);
        };
        const coordinateKeydown = (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            this.NavigationEvent(event);
        };

        const navigationButton = (id, icon, label, onClick = this.NavigationEvent.bind(this)) => {
            const $button = $("<button>", {
                type: "button", id, class: `btn-box ${icon}`, "aria-label": label
            }).ToolTip(label, { "max-width": "220px", "pointer-events": "none" });
            return $button.on(isTouch ? "confirmed-click.galaxy" : "click.galaxy", onClick);
        };

        this.$Content.Navigation.Galaxy = this.createDiv("", "NavigationGalaxyBlock", "GalaxyBlock");

        this.$Content.Navigation.Galaxy.Prev = navigationButton(
            "NavigationGalaxyPrev", "btn-box-left", "Предыдущая галактика");

        this.$Content.Navigation.Galaxy.Next = navigationButton(
            "NavigationGalaxyNext", "btn-box-right", "Следующая галактика");

        this.$Content.Navigation.Galaxy.Input = this.createInput(
            'number', 'NavigationGalaxyInput', '', "InputNumber", coordinateInput, this.System.galaxy, { min: 1, max: () => this.MaxGalaxy });
        this.$Content.Navigation.Galaxy.Input.attr("aria-label", "Номер галактики");
        this.$Content.Navigation.Galaxy.Input.on("keydown.galaxy", coordinateKeydown);

        this.$Content.Navigation.Galaxy.append(
            this.createDiv("Галактика", "", "GalaxyNavLabel"),
            this.$Content.Navigation.Galaxy.Prev,
            this.$Content.Navigation.Galaxy.Input,
            this.$Content.Navigation.Galaxy.Next
        );


        this.$Content.Navigation.System = this.createDiv("", "NavigationSystemBlock", "SystemBlock");

        this.$Content.Navigation.System.Prev = navigationButton(
            "NavigationSystemPrev", "btn-box-left", "Предыдущая система");

        this.$Content.Navigation.System.Next = navigationButton(
            "NavigationSystemNext", "btn-box-right", "Следующая система");

        this.$Content.Navigation.System.Input = this.createInput(
            'number', 'NavigationSystemInput', '', "InputNumber", coordinateInput, this.System.system, { min: 1, max: () => this.MaxSystem });
        this.$Content.Navigation.System.Input.attr("aria-label", "Номер системы");
        this.$Content.Navigation.System.Input.on("keydown.galaxy", coordinateKeydown);

        this.$Content.Navigation.System.append(
            this.createDiv("Система", "", "GalaxyNavLabel"),
            this.$Content.Navigation.System.Prev,
            this.$Content.Navigation.System.Input,
            this.$Content.Navigation.System.Next
        );

        this.$Content.Navigation.Buttons = this.createDiv("", "NavigationButtonsBlock", "ButtonsBlock");

        this.$Content.Navigation.Buttons.Orbit = navigationButton(
            "NavigationOrbit", "btn-box-orbit", "Показать систему");
        this.$Content.Navigation.Buttons.Fit = navigationButton(
            "NavigationFit", "GalaxyMapFit", "Центрировать карту", () => {
            this.offset.x = 0;
            this.offset.y = 0;
            this.calculateZoomFit();
        });
        this.$Content.Navigation.Buttons.append(
            this.createDiv("Карта", "", "GalaxyNavLabel"),
            this.$Content.Navigation.Buttons.Orbit, this.$Content.Navigation.Buttons.Fit
        );

        this.$Content.Navigation.append(this.$Content.Navigation.Galaxy, this.$Content.Navigation.System, this.$Content.Navigation.Buttons);


        this.$Content.prepend(this.$Content.Navigation);


    }

    renderNavigation() {
        if (!this.$Content?.Navigation) {
            this.CreateNavigation();
        }

        console.log("renderNavigation");
        const CurrentGalaxy = this.$Content.Navigation.Galaxy.Input.val();
        this.$Content.Navigation.Galaxy.Prev.attr('disabled', CurrentGalaxy <= 1);
        this.$Content.Navigation.Galaxy.Next.attr('disabled', CurrentGalaxy >= this.MaxGalaxy);

        const CurrentSystem = this.$Content.Navigation.System.Input.val();
        this.$Content.Navigation.System.Prev.attr('disabled', CurrentSystem <= 1);
        this.$Content.Navigation.System.Next.attr('disabled', CurrentSystem >= this.MaxSystem);


    }

    formatGalaxyNumber(value, maximumFractionDigits = 2) {
        const number = Number(value);
        if (!Number.isFinite(number)) return "—";
        return new Intl.NumberFormat("ru-RU", { maximumFractionDigits }).format(number);
    }

    getFreeOrbits() {
        const occupied = new Set((this.Planets || []).map(planet => Number(planet.planet)));
        // GalaxyOrbits: EMPTY=0. Тип орбиты не заменяет проверку
        // занятости: в старых системах реальная планета могла остаться на EMPTY.
        return (this.Orbits || []).filter(orbit => {
            const id = Number(orbit.orbit);
            return Number.isInteger(id) && id > 0 && id <= Number(this.System.max_orbits)
                && Number(orbit.type) === 0
                && !occupied.has(id);
        }).sort((a, b) => Number(a.orbit) - Number(b.orbit));
    }

    setFreeOrbitsOpen(open) {
        if (open) this.closeObjectMenu();
        this.freeOrbitsOpen = Boolean(open);
        if (!this.freeOrbitsOpen) this.selectedFreeOrbit = null;
        this.$FreeOrbitsToggle.attr("aria-expanded", String(this.freeOrbitsOpen));
        this.$FreeOrbitsBody.toggle(this.freeOrbitsOpen);
        this.renderFreeOrbitSelection();
    }

    renderFreeOrbits() {
        this.freeOrbits = this.getFreeOrbits();
        this.freeOrbitIds = new Set(this.freeOrbits.map(orbit => Number(orbit.orbit)));
        if (!this.freeOrbitIds.has(this.selectedFreeOrbit)) this.selectedFreeOrbit = null;
        const existing = new Map(this.$FreeOrbitList.children().get().map(button => [Number(button.dataset.orbit), button]));
        for (const [index, orbit] of this.freeOrbits.entries()) {
            const id = Number(orbit.orbit);
            const $button = existing.has(id) ? $(existing.get(id)) : $("<button>", {
                type: "button", text: id, class: "GalaxyFreeOrbitButton",
                "data-orbit": id, "aria-label": `Свободная орбита ${id}`
            }).on("click.galaxyFreeOrbits", () => {
                if (!this.freeOrbitsOpen || !this.freeOrbitIds.has(id)) return;
                this.selectedFreeOrbit = id;
                this.renderFreeOrbitSelection();
            });
            if (this.$FreeOrbitList[0].children[index] !== $button[0]) this.$FreeOrbitList[0].insertBefore($button[0], this.$FreeOrbitList[0].children[index] || null);
            existing.delete(id);
        }
        existing.forEach(button => $(button).remove());
        this.renderFreeOrbitSelection();
    }

    renderFreeOrbitSelection() {
        this.$FreeOrbitList.find(".GalaxyFreeOrbitButton").each((_, button) => {
            const selected = Number(button.dataset.orbit) === this.selectedFreeOrbit;
            $(button).toggleClass("selected", selected).attr("aria-pressed", String(selected));
        });
        if (!this.$FreeOrbitSelection.children().length) {
            this.$FreeOrbitSelection.append(
                this.createDiv("", "", "GalaxyFreeOrbitTitle"),
                $("<button>", { type: "button", text: "Колонизировать",
                    class: "GalaxyPlanetTooltipMission Mission_COLONIZE GalaxyFreeOrbitColonize" })
                    .on("click.galaxyFreeOrbits", () => {
                        const id = this.selectedFreeOrbit;
                        const mission = (this.FleetMissions || []).find(item => item.key === "COLONIZE");
                        if (!mission || !this.freeOrbitsOpen || !this.getFreeOrbits().some(item => Number(item.orbit) === id)) return;
                        this.openFleetTarget({ galaxy: Number(this.System.galaxy), system: Number(this.System.system), planet: id, planet_type: 1 }, Number(mission.id));
                    }),
                this.createDiv("Доступность миссии проверяется для выбранного флота", "", "GalaxyFreeOrbitHint")
            );
        }
        const orbit = this.freeOrbits.find(item => Number(item.orbit) === this.selectedFreeOrbit);
        const mission = (this.FleetMissions || []).find(item => item.key === "COLONIZE");
        this.$FreeOrbitSelection.find(".GalaxyFreeOrbitTitle").text(orbit
            ? `Свободная орбита [${this.System.galaxy}:${this.System.system}:${orbit.orbit}]`
            : this.freeOrbits.length ? "Выберите орбиту" : "В системе нет свободных орбит");
        this.$FreeOrbitSelection.find(".GalaxyFreeOrbitColonize").toggle(Boolean(orbit))
            .attr("data-mission-id", mission?.id).prop("disabled", !mission);
        this.$FreeOrbitSelection.find(".GalaxyFreeOrbitHint").toggle(Boolean(orbit));
    }

    renderSystemInfo() {
        if (!this.$SystemInfo || !this.$Legend) return;

        const info = this.SystemInfo || {};
        const star = info.star || {};
        const orbits = info.orbits || {};
        // Canvas имеет направленную вниз ось Y: рост угла визуально означает
        // движение по часовой стрелке.
        const direction = Number(info.rotation) === 0 ? "против часовой" : "по часовой";

        const row = (label, value) =>
            this.createDiv("", "", "GalaxySystemInfoRow").append(
                this.createDiv(label, "", "GalaxySystemInfoLabel"),
                this.createDiv(value, "", "GalaxySystemInfoValue")
            );

        if (!this.$SystemInfo.children().length) this.$SystemInfo.append($("<summary>").append(
            this.createDiv("", "", "GalaxySystemInfoTitle"),
            this.createDiv("", "", "GalaxySystemInfoSubtitle")
        ), this.createDiv("", "", "GalaxySystemInfoBody"));
        this.$SystemInfo.find(".GalaxySystemInfoTitle").text(
            this.System.name
                ? `${this.System.name} · ${this.System.galaxy}:${this.System.system}`
                : `Система ${this.System.galaxy}:${this.System.system}`);
        this.$SystemInfo.find(".GalaxySystemInfoSubtitle").text(`Звезда ${star.type || this.System.star_type || "—"} · ${orbits.occupied ?? this.Planets.length} / ${orbits.ordinary ?? this.System.max_orbits ?? "—"} планет`);
        const values = [
            ["Звезда", `${star.name ? `${star.name} · ` : ""}${star.type || this.System.star_type || "—"}`],
            ["Температура", `${this.formatGalaxyNumber(star.temperature, 0)} K`],
            ["Масса", `${this.formatGalaxyNumber(star.mass)} M☉`],
            ["Радиус", `${this.formatGalaxyNumber(star.radius)} R☉`],
            ["Светимость", `${this.formatGalaxyNumber(star.luminosity)} L☉`],
            ["Планеты", `${orbits.occupied ?? this.Planets.length} / ${orbits.ordinary ?? this.System.max_orbits ?? "—"}`],
            ["Вращение", direction]
        ];
        const $body = this.$SystemInfo.find(".GalaxySystemInfoBody");
        values.forEach(([label, value], index) => {
            let $row = $body.children().eq(index);
            if (!$row.length) $body.append($row = row(label, value));
            $row.find(".GalaxySystemInfoValue").text(value);
        });

        const legendItem = (className, label) =>
            this.createDiv("", "", "GalaxyLegendItem").append(
                this.createDiv("", "", `GalaxyLegendMark ${className}`),
                this.createDiv(label, "", "GalaxyLegendLabel")
            );

        if (!this.$Legend.children().length) this.$Legend.append(
            $("<summary>").text("Обозначения"),
            this.createDiv("", "", "GalaxyLegendBody").append(
                legendItem("GalaxyLegendPlanet", "Планета"),
                legendItem("GalaxyLegendDebris", Lang.debris.Title),
                legendItem("GalaxyLegendAsteroids", "Пояс астероидов"),
                legendItem("GalaxyLegendAsteroidSector", "Ресурсный сектор"),
                legendItem("GalaxyLegendGas", "Газовый гигант"),
                legendItem("GalaxyLegendFleet", "Свой флот"),
                legendItem("GalaxyLegendIncomingFleet", "Входящий флот"),
                legendItem("GalaxyLegendEdge", "Граница системы"),
                legendItem("GalaxyLegendExpedition", "Орбита экспедиции")
            )
        );
        this.$Legend.find(".GalaxyLegendDebris").next().text(Lang.debris.Title);
    }

    getObjectMenuData(kind, id) {
        if (kind === "planet" || kind === "debris") {
            const planet = (this.Planets || []).find(item => Number(item.id) === id);
            if (kind === "debris" && !(Number(planet?.Debris?.metal || 0) + Number(planet?.Debris?.crystal || 0) > 0)) return null;
            return planet || null;
        }
        if (kind === "space_debris") return this.SpaceDebris.find(item => Number(item.id) === id) || null;
        if (kind === "fleet") return this.FlyingFleets.find(item => Number(item.id) === id) || null;
        if (kind === "contact") return this.SensorContacts.find(item => Number(item.id) === id && Number(item.retainUntil) > GameServerTime.now()) || null;
        if (kind === "gas") return this.gasGiants?.[id] || null;
        if (kind === "sector") return this.ResourceSites.find(item => Number(item.id) === id) || null;
        return null;
    }

    openObjectMenu(kind, id, event) {
        event?.stopPropagation();
        id = Number(id);
        if (!this.pageActive || !this.SystemShow || !this.getObjectMenuData(kind, id)) return;
        if (this.selectedMapObject?.kind === kind && this.selectedMapObject.id === id) {
            this.closeObjectMenu();
            return;
        }
        this.setFreeOrbitsOpen(false);
        if (this.$System[0].contains(ToolTip.parent)) ToolTip.hide();
        this.selectedMapObject = { kind, id };
        this.objectMenuTrigger = event?.currentTarget || null;
        this.objectMenuAnchor = {
            x: event?.clientX || this.objectMenuTrigger?.getBoundingClientRect().right || this.$System[0].getBoundingClientRect().right - 300,
            y: event?.clientY || this.objectMenuTrigger?.getBoundingClientRect().top || this.$System[0].getBoundingClientRect().top + 20
        };
        this.renderObjectMenu();
        if (event?.detail === 0) this.$ObjectMenu.find("button").first().trigger("focus");
    }

    closeObjectMenu(restoreFocus = false) {
        this.selectedMapObject = null;
        this.$ObjectMenu?.hide();
        this.$System.find(".GalaxyPlanetName").attr("aria-expanded", "false").removeClass("GalaxyPlanetSelected");
        if (restoreFocus && this.objectMenuTrigger?.isConnected) this.objectMenuTrigger.focus({ preventScroll: true });
    }

    positionObjectMenu() {
        if (!this.selectedMapObject || !this.$ObjectMenu?.is(":visible")) return;
        const rect = this.$System[0].getBoundingClientRect();
        const left = Math.max(0, rect.left) + 10;
        const right = Math.min(innerWidth, rect.right) - 10;
        const top = Math.max(0, rect.top) + 10;
        const bottom = Math.min(innerHeight, rect.bottom) - 10;
        this.$ObjectMenu.css("max-height", Math.max(100, bottom - top));
        const width = this.$ObjectMenu.outerWidth();
        const height = this.$ObjectMenu.outerHeight();
        let x = this.objectMenuAnchor.x + 18;
        if (x + width > right) x = this.objectMenuAnchor.x - width - 18;
        x = Math.max(left, Math.min(right - width, x));
        const y = Math.max(top, Math.min(bottom - height, this.objectMenuAnchor.y - 35));
        this.$ObjectMenu.css({ left: x - rect.left, top: y - rect.top });
    }

    renderObjectMenu() {
        if (!this.selectedMapObject) return;
        const { kind, id } = this.selectedMapObject;
        const object = this.getObjectMenuData(kind, id);
        if (!object) { this.closeObjectMenu(); return; }
        const key = `${kind}:${id}`;
        const $existing = this.objectMenuKey === key ? this.$ObjectMenuBody.children().first() : null;
        let $content;
        if (kind === "planet") $content = this.createPlanetCard(object, $existing);
        else if (kind === "debris") $content = this.createDebrisCard(object, $existing);
        else if (kind === "space_debris") $content = this.createSpaceDebrisCard(object, $existing);
        else if (kind === "fleet") $content = this.createFleetCard(object, $existing);
        else if (kind === "contact") {
            $content = this.createSensorContactCard(object, $existing);
            this.cardField($content, "intercept", "button", "btn-info GalaxyPlanetTooltipPlayerAction", "Перехват")
                .attr("type", "button").prop("disabled", !this.sensorContactFresh(object))
                .off("click.galaxy").on("click.galaxy", () => this.openFleetTarget({ type: 3, fleetId: Number(object.id) }, 1));
            this.$ObjectMenu.data("sensorFresh", this.sensorContactFresh(object));
        }
        else $content = this.createResourceSiteCard(kind, object, $existing);
        if (!$existing) this.$ObjectMenuBody.empty().append($content);
        this.objectMenuKey = key;
        this.$ObjectMenu.css("display", "flex");
        this.$System.find(".GalaxyPlanetName").each((_, element) => {
            const selected = kind === "planet" && Number(element.dataset.planetId) === id;
            $(element).attr("aria-expanded", String(selected)).toggleClass("GalaxyPlanetSelected", selected);
        });
        this.positionObjectMenu();
    }

    createDebrisCard(planet, $card = null) {
        const coordinate = `[${planet.galaxy}:${planet.system}:${planet.planet}]`;
        $card ||= $("<div>").addClass("GalaxyObjectCard DebrisTooltip");
        this.cardField($card, "type", "div", "GalaxyObjectCardType", Lang.debris.Title);
        this.cardField($card, "title", "div", "GalaxyObjectCardTitle", coordinate);
        for (const [id, amount] of [[901, planet.Debris.metal], [902, planet.Debris.crystal]]) {
            this.cardField($card, id, "div", `ResBox icon${id}`, `${Lang.tech[id]}: ${humanNumber(amount, true, 3)}`);
        }
        this.cardField($card, "recycle", "button", "GalaxyPlanetTooltipMission Mission_RECYCLE", Lang.debris.ChooseTarget)
                .attr("type", "button").off("click.galaxy").on("click.galaxy", () => {
                    const mission = (this.FleetMissions || []).find(item => item.key === "RECYCLE");
                    this.openFleetTarget({ ...planet, planet_type: 2 }, mission?.id ?? null);
                });
        return $card;
    }

    createSpaceDebrisCard(field, $card = null) {
        const point = field.coordinate;
        $card ||= $("<div>", { class: "GalaxyObjectCard DebrisTooltip" });
        this.cardField($card, "type", "div", "GalaxyObjectCardType", Lang.debris.Title);
        this.cardField($card, "title", "div", "GalaxyObjectCardTitle", `[${point.galaxy}:${point.system}] ${number_format(point.distance, 2)} / ${number_format(point.angle, 2)}°`);
        for (const [id, amount] of [[901, field.metal], [902, field.crystal]]) {
            this.cardField($card, id, "div", `ResBox icon${id}`, `${Lang.tech[id]}: ${humanNumber(amount, true, 3)}`);
        }
        this.cardField($card, "recycle", "button", "GalaxyPlanetTooltipMission Mission_RECYCLE", Lang.debris.ChooseTarget)
                .attr("type", "button").off("click.galaxy").on("click.galaxy", () => {
                    const mission = (this.FleetMissions || []).find(item => item.key === "RECYCLE");
                    this.openFleetTarget(point, mission?.id ?? null);
                });
        return $card;
    }

    createResourceSiteCard(kind, object, $card = null) {
        const orbit = kind === "gas" ? object.orbitId : object.orbit;
        const site = kind === "gas" ? object.site : object;
        const survey = site?.survey;
        $card ||= $("<div>", { class: "GalaxyObjectCard" });
        this.cardField($card, "type", "div", "GalaxyObjectCardType", "Ресурсный объект");
        this.cardField($card, "title", "div", "GalaxyObjectCardTitle", kind === "gas"
                ? (site?.name || object.name || "Газовый гигант")
                : `${site?.name || "Пояс астероидов"} · сектор ${object.sector}`);
        this.cardField($card, "coordinates", "div", "GalaxyPlanetTooltipCoordinates", `[${this.System.galaxy}:${this.System.system}:${orbit}]`);
        this.cardField($card, "survey", "div", "GalaxyObjectCardNote", survey
                ? `Изучено: ${number_format(survey.coverage * 100, 2)}% · ${formatTimestamp(survey.observedAt, "datetime")}${survey.stale ? " · снимок устарел" : ""}`
                : "Объект не обследован. Запасы неизвестны.");
        for (const id of [901, 902, 903]) {
            const amount = survey?.reserve?.[id] || 0;
            this.cardField($card, id, "div", "ResBox icon" + id, `${Lang.tech[id]}: ${number_format(amount)} · личный известный резерв`).toggle(amount > 0);
        }
        const target = { type: 1, galaxy: Number(this.System.galaxy), system: Number(this.System.system),
            orbit: Number(orbit), objectType: kind === "gas" ? 4 : 5, siteId: Number(site?.id) };
        const action = (key, mission, label, visible) => this.cardField($card, key, "button", `GalaxyPlanetTooltipMission Mission_${mission}`, label)
            .attr("type", "button").toggle(Boolean(visible)).off("click.galaxy")
            .on("click.galaxy", () => this.openFleetTarget(target, ({ RESEARCH: 25, MINING: 50, RELOCATE: 11, CAPTURE: 45, SPY: 20 })[mission]));
        action("surveyAction", "RESEARCH", "Обследовать", site);
        const control = site?.control;
        this.cardField($card, "control", "div", "GalaxyObjectCardNote", control ? `Контроль: ${control.ownerName}${control.isOwn ? " · ваша база" : ""}` : "Свободный ресурсный объект").toggle(Boolean(site?.basesEnabled));
        action("mining", "MINING", "Добывать", site?.basesEnabled && (!control || control.isOwn) && survey?.coverage > 0);
        action("base", control?.isOwn ? "RELOCATE" : "CAPTURE", control?.isOwn ? "Передислоцировать" : control ? "Захватить" : "Занять базу", site?.basesEnabled);
        action("spy", "SPY", "Шпионить", site?.basesEnabled && control && !control.isOwn);
        this.cardField($card, "hint", "small", "GalaxyObjectCardNote", site?.basesEnabled
            ? "Добыча — в пределах обследованного резерва. Чужую базу добыча автоматически не атакует." : "Добыча и захват пока недоступны.");
        return $card;
    }

    getSensorCourseLine(contact) {
        if (typeof contact.course !== "number" || !Number.isFinite(contact.course)) return null;
        const point = contact.position, angle = point.angle * Math.PI / 180;
        const x = point.distance * Math.cos(angle), y = point.distance * Math.sin(angle);
        const course = contact.course * Math.PI / 180, dx = Math.cos(course), dy = Math.sin(course);
        const radius = Math.max(1, point.distance, Number(this.System?.max_distance) || 0,
            ...(this.Orbits || []).map(orbit => Number(orbit.distance) || 0));
        const projection = x * dx + y * dy;
        const half = Math.sqrt(Math.max(0, projection * projection + radius * radius - x * x - y * y));
        const polar = (x, y) => ({ distance: Math.hypot(x, y), angle: Math.atan2(y, x) * 180 / Math.PI });
        // Концы — пересечения линии курса с краем отображения, НЕ цель/старт флота.
        return { start: polar(x + dx * (-projection - half), y + dy * (-projection - half)),
            end: polar(x + dx * (-projection + half), y + dy * (-projection + half)), next: polar(x + dx, y + dy) };
    }

    getSensorContactPosition(contact, now) {
        const route = this.sensorContactRoute(contact);
        const key = route ? `${contact.observedAt}:${route.startsAt}:${route.endsAt}` : null;
        const previous = this.sensorContactPositions.get(Number(contact.id));
        if (!route) {
            this.sensorContactPositions.delete(Number(contact.id));
            return contact.position;
        }
        // Потеря контакта замораживает уже показанную точку, а не откатывает её.
        if (!this.sensorContactFresh(contact)) return previous?.key === key ? previous.position : contact.position;
        const until = Math.min(Number(now), Number(contact.freshUntil), Number(route.endsAt));
        const progress = Math.max(0, Math.min(1, (until - Number(route.startsAt)) / (Number(route.endsAt) - Number(route.startsAt))));
        const position = this.interpolateFleetPhysicalPoint(route.motionStart, route.motionEnd, progress);
        this.sensorContactPositions.set(Number(contact.id), { key, position });
        return position;
    }

    drawSensorContacts(ctx, now, occupied = []) {
        const retained = new Set(this.SensorContacts.filter(c => Number(c.retainUntil) > now).map(c => Number(c.id)));
        for (const id of this.sensorContactPositions.keys()) if (!retained.has(id)) this.sensorContactPositions.delete(id);
        // Уже открытая карточка тоже стареет без нового server response.
        if (this.selectedMapObject?.kind === "contact") {
            const contact = this.getObjectMenuData("contact", this.selectedMapObject.id);
            if (!contact || this.$ObjectMenu.data("sensorFresh") !== this.sensorContactFresh(contact)) this.renderObjectMenu();
        }
        for (const contact of this.SensorContacts) {
            if (Number(contact.retainUntil) <= now || this.FlyingFleets.some(f => Number(f.id) === Number(contact.id))) continue;
            const fresh = this.sensorContactFresh(contact);
            const color = fresh ? "rgba(234,196,90,0.95)" : "rgba(155,163,177,0.95)";
            const route = this.sensorContactRoute(contact);
            const position = this.getSensorContactPosition(contact, now);
            const line = route ? { start: route.motionStart, end: route.motionEnd, next: route.motionEnd } : this.getSensorCourseLine(contact);
            const current = this.mapFleetPhysicalPoint(position), anchor = { ...current };
            const label = `${contact.owner_name || "Контакт"} #${contact.id}${fresh ? "" : " · отметка"}`;
            const labelWidth = Math.max(44, label.length * 7);
            const preferredX = this.canvas.width / 2 + this.offset.x + current.x * this.zoom;
            const preferredY = this.canvas.height / 2 + this.offset.y + current.y * this.zoom;
            const marker = this.placeFleetMarker(preferredX, preferredY, labelWidth, occupied);
            current.x += this.screenToWorld(marker.x - preferredX);
            current.y += this.screenToWorld(marker.y - preferredY);
            ctx.save();
            ctx.strokeStyle = color.replace("0.95", "0.42");
            ctx.lineWidth = this.screenToWorld(1.3);
            if (line) this.drawFleetPath(ctx, line.start, line.end, color);
            if (Math.hypot(current.x - anchor.x, current.y - anchor.y) > .001) {
                ctx.beginPath();ctx.moveTo(anchor.x, anchor.y);ctx.lineTo(current.x, current.y);ctx.stroke();
            }
            const next = line ? this.mapFleetPhysicalPoint(line.next) : anchor;
            const direction = line ? Math.atan2(next.y - anchor.y, next.x - anchor.x) : 0;
            this.drawFleetMarker(ctx, current, direction, !line, label, color);
            ctx.restore();
            this.registerMapObject("contact", contact.id, current.x, current.y, this.screenToWorld(12), {
                label: { left: marker.x - labelWidth / 2, right: marker.x + labelWidth / 2, top: marker.y - 25, bottom: marker.y - 8 }
            });
        }
    }

    createFleetCard(fleet, $card = null) {
        const mission = (this.FleetMissions || []).find(item => Number(item.id) === Number(fleet.mission));
        const coordinate = point => point?.orbit ? `[${point.galaxy}:${point.system}:${point.orbit}]` : "—";
        const state = fleet.blocked_reason ? `Приостановлен: ${fleet.blocked_reason}`
            : this.isFleetStationary(fleet) ? "Стоянка / удержание"
                : `${fleet.is_return ? "Возврат" : "К цели"} · прибытие на участок: ${formatTimestamp(fleet.end_time, "timedate")}`;
        $card ||= $("<div>", { class: "GalaxyObjectCard" });
        this.cardField($card, "type", "div", "GalaxyObjectCardType", fleet.is_incoming ? "Входящий флот" : "Свой флот");
        this.cardField($card, "title", "div", "GalaxyObjectCardTitle", fleet.name || `Флот #${fleet.id}`);
        this.cardField($card, "owner", "div", "", fleet.owner_name || "—");
        this.cardField($card, "mission", "div", "", mission ? Lang[mission.lang] : "—");
        this.cardField($card, "route", "div", "GalaxyObjectCardRoute", `${coordinate(fleet.mission_start)} → ${coordinate(fleet.mission_target)}`);
        this.cardField($card, "state", "div", "GalaxyObjectCardNote", state);
        this.cardField($card, "open", "button", "GalaxyPlanetTooltipPlayerAction", "Открыть страницу флота")
                .attr("type", "button").toggle(Boolean(fleet.is_own)).off("click.galaxy").on("click.galaxy", () => {
                    this.closeObjectMenu();
                    GameEvents.emit("SendServer", { mode: "fleets" });
                });
        this.cardField($card, "intercept", "button", "btn-info GalaxyPlanetTooltipPlayerAction", "Перехват")
            .attr("type", "button").toggle(!fleet.is_own && Boolean(fleet.is_incoming) && Number(fleet.command?.type) === 10 && !fleet.battle)
            .off("click.galaxy").on("click.galaxy", () => this.openFleetTarget({ type: 3, fleetId: Number(fleet.id) }, 1));
        return $card;
    }

    CreatePlanetsNames() {
        this.$Content.PlanetsNames = {};
        for (const p of this.Planets.filter(planet => Number(planet.planet_type) !== 3)) {
            /*const orbit = this.orbitMap[p.planet];
            if (!orbit) continue;*/
            //const dist = this.orbitUeToPx(orbit.distance);

            if (!this.$Content.PlanetsNames[p.planet]) {
                this.CreatePlanetsName(p);
            }
        }
    }

    CreatePlanetsName(planet) {
        /*const orbit = this.orbitMap[planet.planet];
        if (!orbit) return;*/

        const $name = this.createDiv(
            "",
            'PlanetName' + planet.planet,
            `PlanetName${planet.OwnPlanet ? " OwnPlanet" : ""}`
        );
        $name.Caption = $("<div>", { class: "GalaxyPlanetCaption" });
        $name.Player = this.createDiv("", "", "GalaxyPlayerName");
        $name.Planet = $("<button>", { type: "button", class: "GalaxyPlanetName", "data-planet-id": planet.id,
            "aria-controls": "GalaxyObjectMenu", "aria-expanded": "false" })
            .on("click.galaxy", event => this.openObjectMenu("planet", Number(event.currentTarget.dataset.planetId), event));
        $name.Player.append($("<span>", { class: "GalaxyPlayerIcon mdi mdi-account", "aria-hidden": "true" }), this.createPlayerName(planet));
        $name.Planet.append($("<span>", { class: "GalaxyPlanetOrbit" }), $("<span>", { class: "GalaxyPlanetLabel" }));
        $name.Caption.append($name.Planet, $name.Player);
        $name.append($name.Caption);

        this.$Content.PlanetsNames[planet.planet] = $name;

        this.$System.append($name);
        this.renderPlanetsName(planet);
    }

    renderPlanetsNames() {
        if (!this.$Content?.PlanetsNames) {
            this.CreatePlanetsNames();
        }

        const planets = this.Planets.filter(planet => Number(planet.planet_type) !== 3);
        const existingPlanetIds = new Set(planets.map(p => Number(p.planet)));
        // Не теряем hover у подписи, которая осталась в новом snapshot.
        for (const [orbit, $name] of Object.entries(this.$Content.PlanetsNames)) {
            if (!existingPlanetIds.has(Number(orbit))) $name.hide();
        }

        for (const p of planets) {
            /*const orbit = this.orbitMap[p.planet];
            if (!orbit) continue;*/

            if (!this.$Content.PlanetsNames[p.planet]) {
                this.CreatePlanetsName(p);
            } else {
                this.renderPlanetsName(p);
            }

            // всегда показываем актуальные подписи
            this.$Content.PlanetsNames[p.planet].show();
        }

    }

    renderPlanetsName(p, x = null, y = null) {
        /*const orbit = this.orbitMap[p.planet];
        if (!orbit) return;*/

        const $name = this.$Content.PlanetsNames[p.planet];
        $name.toggleClass("OwnPlanet", Boolean(p.OwnPlanet));
        $name.Planet.attr("data-planet-id", p.id);
        this.createPlayerName(p, $name.Player.find(".GalaxyPlayerLabel"));
        $name.Planet.find(".GalaxyPlanetOrbit").text(p.planet);
        $name.Planet.find(".GalaxyPlanetLabel").text(p.name);
        $name.Planet.toggleClass("GalaxyPlanetActive", p.Activity?.status === "active")
            .toggleClass("GalaxyPlanetRecent", p.Activity?.status === "recent");
        this.renderPlanetDebris($name, p);
    }

    renderPlanetDebris($name, planet) {
        if (!$name.Debris) {
            $name.Debris = $("<button>", { type: "button", class: "GalaxyDebris" })
                .append($("<span>").addClass("GalaxyDebrisSymbol").attr("aria-hidden", "true"));
            $name.append($name.Debris);
        }
        const debris = planet.Debris;
        const metal = Math.max(0, Number(debris?.metal) || 0);
        const crystal = Math.max(0, Number(debris?.crystal) || 0);
        const visible = metal + crystal > 0;
        $name.Debris.toggle(visible);
        $name.Debris.off("click.galaxy confirmed-click.galaxy");
        if (!visible) {
            $name.Debris.removeData("tooltip");
            if (ToolTip?.parent === $name.Debris[0]) ToolTip.hide();
            return;
        }
        const coordinate = `[${planet.galaxy}:${planet.system}:${planet.planet}]`;
        $name.Debris.attr("aria-label", `${Lang.debris.ChooseTarget} ${coordinate}`);
        $name.Debris.on("click.galaxy", event => this.openObjectMenu("debris", planet.id, event));
    }

    createPlanetCard(planet, $tooltip = null) {
        $tooltip ||= this.createDiv("", "", "GalaxyPlanetTooltip");
        const coordinates = `${planet.galaxy}:${planet.system}:${planet.planet}`;
        const missionIds = new Set(planet.AvailableMissions || []);
        const missions = (this.FleetMissions || []).filter((mission) =>
            missionIds.has(mission.id)
        );

        const field = (...args) => this.cardField(...args);
        const $header = field($tooltip, "header", "div", "GalaxyPlanetTooltipHeader");
        const image = this.planetImages[planet.image];
        const imageSource = image?.src || (planet.image ? `/images/planets/galaxy/${planet.image}.png` : null);
        field($header, "image", "img", "GalaxyPlanetTooltipImage").attr({ src: imageSource || undefined, alt: "" }).toggle(Boolean(imageSource));
        const $heading = field($header, "heading", "div", "GalaxyPlanetTooltipHeading");
        field($heading, "type", "div", "GalaxyPlanetTooltipType", Number(planet.planet_type) === 3 ? (planet.OwnPlanet ? "Своя луна" : "Луна") : (planet.OwnPlanet ? "Своя планета" : "Планета"));
        field($heading, "title", "div", "GalaxyPlanetTooltipTitle", planet.name || "—");
        field($heading, "coordinates", "div", "GalaxyPlanetTooltipCoordinates", `[${coordinates}]`);
        const moon = this.getPlanetMoon(planet);
        field($tooltip, "moon", "button", "GalaxyPlanetTooltipPlayerAction GalaxyPlanetMoonAction", `☾ ${moon?.name || "Луна"}`)
            .attr("type", "button").toggle(Boolean(moon)).off("click.galaxy").on("click.galaxy", event => { if (moon) this.openObjectMenu("planet", moon.id, event); });

        // Публичные сведения о планете — как в Nova. Физические параметры
        // остаются в модели для canvas, но не раскрываются в карточке.
        const $details = field($tooltip, "details", "div", "GalaxyPlanetTooltipDetails");
        field($details, "ownerLabel", "div", "GalaxyPlanetTooltipDetailLabel", "Владелец");
        const $owner = field($details, "owner", "div", "GalaxyPlanetTooltipDetailValue");
        if (!$owner.children().length) $owner.append(this.createPlayerName(planet));
        else this.createPlayerName(planet, $owner.children().first());
        const statuses = (Array.isArray(planet.PlayerStatus) ? planet.PlayerStatus : [])
            .filter(status => Object.hasOwn(this.playerStatusLabels, status));
        field($details, "statusLabel", "div", "GalaxyPlanetTooltipDetailLabel", "Статус").toggle(Boolean(statuses.length));
        field($details, "status", "div", "GalaxyPlanetTooltipStatus", this.playerStatusLabels[statuses.at(-1)]?.label || "").toggle(Boolean(statuses.length));
        const active = planet.Activity?.status === "active" || planet.Activity?.status === "recent";
        field($details, "activityLabel", "div", "GalaxyPlanetTooltipDetailLabel", "Активность").toggle(active);
        field($details, "activity", "div", `GalaxyPlanetTooltipDetailValue ${planet.Activity?.status === "active" ? "GalaxyPlayerActive" : "GalaxyPlayerRecent"}`,
            planet.Activity?.status === "active" ? "*" : `${planet.Activity?.minutes || 0} мин.`).toggle(active);
        field($tooltip, "missionsLabel", "div", "GalaxyPlanetTooltipSection", "Доступные миссии").toggle(Boolean(missions.length));
        const $missions = field($tooltip, "missions", "div", "GalaxyPlanetTooltipMissions").toggle(Boolean(missions.length));
            for (const mission of missions) {
                field($missions, mission.id, "button", `GalaxyPlanetTooltipMission Mission_${mission.key}`, Lang[mission.lang])
                    .attr({ type: "button", "data-mission-id": mission.id }).off("click.galaxy").on("click.galaxy", () => this.openFleetTarget(planet, mission.id));
            }
        $missions.children().each((_, button) => { if (!missionIds.has(Number(button.dataset.missionId))) $(button).remove(); });
        field($tooltip, "phalanx", "button", "GalaxyPlanetTooltipPlayerAction GalaxyPhalanxAction", `Сканировать фалангой · ${number_format(this.messageData.data.Page?.Phalanx?.cost || 0)} дейтерия`)
            .attr("type", "button").toggle(Boolean(planet.PhalanxAvailable)).off("click.galaxy").on("click.galaxy", () => this.openPhalanx(planet));

        const isCurrentPlayer = Number(planet.owner_id) === Number(this.messageData.data.Page?.UserId);
        const showPlayer = !isCurrentPlayer && Number(planet.owner_id) > 0;
        field($tooltip, "actionsLabel", "div", "GalaxyPlanetTooltipSection", "Действия с игроком").toggle(showPlayer);
        const $actions = field($tooltip, "actions", "div", "GalaxyPlanetTooltipPlayerActions").toggle(showPlayer);
        field($actions, "player", "button", "GalaxyPlanetTooltipPlayerAction", "Об игроке")
            .attr("type", "button").off("click.galaxy").on("click.galaxy", () => this.showPlayerCard(planet));
            const state = planet.Friendship?.state || "none";
            const labels = { none: "Предложить дружбу", outgoing: "Заявка отправлена", incoming: "Входящая заявка", friends: "У вас в друзьях" };
        field($actions, "friend", "button", "GalaxyPlanetTooltipPlayerAction GalaxyFriendAction", labels[state] || labels.none)
            .attr({ type: "button", "data-friendship": state }).off("click.galaxy").on("click.galaxy", () => state === "none" ? this.openFriendRequest(planet) : this.openFriends());
        return $tooltip;
    }

    openPhalanx(planet) {
        if (!this.pageActive || this.phalanxPending || !planet.PhalanxAvailable) return;
        this.closeObjectMenu();
        const $content = $("<section>").addClass("PhalanxScan");
        Dialog.create($content, "Сенсорная фаланга", [
            { text: "Сканировать снова · 5 000 дейтерия", class: ["btn-info"], action: () => this.scanPhalanx(planet, $content) },
            { text: Lang.Close, class: ["btn-warning"], action: () => Dialog.close() }
        ], { width: 680, overlay: true });
        this.scanPhalanx(planet, $content);
    }

    scanPhalanx(planet, $content) {
        if (!this.pageActive || this.phalanxPending || !$.contains(Dialog.dialogDiv, $content[0])) return;
        this.stopPhalanxClock();
        const token = crypto.randomUUID();
        const pending = { token, $content, sourceId: Number(this.messageData.data.Page.Phalanx.sourceId) };
        this.phalanxPending = pending;
        $content.empty().append($("<p>").text("Сканирование принято в обработку…"));
        const fail = message => {
            if (this.phalanxPending !== pending) return;
            this.phalanxPending = null;
            clearTimeout(pending.timer); this.ownedTimers.delete(pending.timer);
            if ($.contains(Dialog.dialogDiv, $content[0])) $content.empty().append($("<p>").addClass("red_text").text(message));
        };
        pending.timer = setTimeout(() => {
            this.ownedTimers.delete(pending.timer);
            fail("Ответ сканирования не получен. Запрос не повторяется автоматически; проверьте состояние соединения.");
        }, 30000);
        this.ownedTimers.add(pending.timer);
        WS.Submit("galaxy", "PhalanxScan", { targetId: Number(planet.id), scanToken: token }, {
            scope: this.requestScope, kind: "write", onError: error => fail(error.message),
            // ACK не является результатом скана. Результат приходит в обычном ActualData.
            onSuccess: () => {}
        });
    }

    renderPhalanxScan() {
        const pending = this.phalanxPending;
        const scan = this.messageData.data.Page?.PhalanxScan;
        if (!pending || scan?.token !== pending.token) return;
        this.phalanxPending = null;
        clearTimeout(pending.timer); this.ownedTimers.delete(pending.timer);
        const $content = pending.$content;
        if (!this.pageActive || !$.contains(Dialog.dialogDiv, $content[0])
            || Number(this.messageData.data.PlanetList?.current_planet) !== pending.sourceId) return;
        $content.empty();
        if (scan.error) { $content.append($("<p>").addClass("red_text").text(scan.error)); return; }
        const coordinate = (c, compact = false) => {
            if (!c) return "—";
            if (Number(c.type) === 1) {
                const coords = `[${c.galaxy}:${c.system}:${c.orbit}]`;
                return compact ? coords : `${coords} ${Number(c.objectType) === 5 && c.sector ? `Сектор пояса ${c.sector}`
                    : { 1: "Планета", 2: "Обломки", 3: "Луна", 4: "Газовый гигант", 5: "Сектор пояса" }[c.objectType] || "Орбита"}`;
            }
            if (Number(c.type) === 3) return `Флот #${c.fleetId}`;
            return `[${c.galaxy}:${c.system}] ${number_format(c.distance || 0)}${compact ? "" : ` / ${Number(c.angle || 0).toFixed(1)}°`}`;
        };
        $content.append($("<h3>").text(`${scan.targetName} ${coordinate(scan.coordinates)}`),
            $("<p>").addClass("PhalanxScanNote").text(`Снимок на ${new Date(scan.scannedAt * 1000).toLocaleString("ru-RU")}. Стоимость: ${number_format(scan.cost)} дейтерия. Не обновляется без нового скана.`));
        if (!scan.fleets?.length) $content.append($("<p>").text("Доступных для фаланги перелётов не обнаружено."));
        const $list = $("<div>").addClass("OverviewFleetEventsList PhalanxFleetList");
        for (const fleet of scan.fleets || []) {
            const mission = this.messageData.data.Page.FleetMissions.find(item => Number(item.id) === Number(fleet.mission));
            const missionName = Lang[mission?.lang] || "Перелёт";
            const name = `${fleet.name || `Флот #${fleet.id}`} · ${fleet.ownerName}`;
            const $tooltip = $("<div>").addClass("OverviewFleetTooltip").append(
                $("<strong>").addClass("OverviewFleetTooltipTitle").text(`${name} · ${missionName}`),
                $(this.createFleetCompositionTooltip(fleet))
            );
            const endsAt = Number(fleet.holdingUntil || fleet.arrivesAt);
            const $countdown = $("<strong>").addClass("OverviewFleetEventCountdown")
                .data({ endsAt, estimated: Boolean(fleet.estimated) })
                .ToolTip(`${fleet.holdingUntil ? "Удержание до" : "Прибытие по снимку"}: ${endsAt > 0 ? `${fleet.estimated ? "≈ " : ""}${formatTimestamp(endsAt, "timedate")}` : "не определено"}`);
            const $intercept = $("<span>").addClass("PhalanxIntercept")
                .ToolTip("Атака на сам обнаруженный флот. Доступность и встреча будут проверены для выбранного флота.")
                .append($("<button>", { type: "button", disabled: fleet.interceptable !== true, text: "Перехват", class: "PhalanxInterceptButton" })
                    .on("click", () => { Dialog.close(); this.openFleetTarget({ type: 3, fleetId: Number(fleet.id) }, 1); }));
            $list.append($("<article>").addClass("OverviewFleetEvent PhalanxFleet")
                .toggleClass("Returning", Boolean(fleet.returning)).append(
                    $("<span>").addClass("OverviewFleetEventTime").append(
                        $countdown,
                        $("<span>").addClass("OverviewFleetEventStatus").text(fleet.holdingUntil ? "Удержание" : fleet.returning ? "Возврат" : "К цели")
                    ),
                    $("<span>").addClass("OverviewFleetEventBody").append(
                        $("<span>").addClass("OverviewFleetEventTitle").text(`${name} · ${missionName}`)
                            .ToolTip($tooltip.prop("outerHTML"), { "max-width": "min(320px, calc(100vw - 24px))", "pointer-events": "none" }),
                        $("<span>").addClass("OverviewFleetEventRoute PhalanxFleetRoute")
                            .text(`${coordinate(fleet.from, true)} → ${coordinate(fleet.to, true)}`)
                            .ToolTip(`${coordinate(fleet.from)} → ${coordinate(fleet.to)}`)
                    ),
                    $intercept
                ));
        }
        $content.append($list);
        this.updatePhalanxClock($content, true);
        Dialog.dialogDiv.style.height = "auto";
        Dialog.dialogDiv.style.minHeight = "0";
        Dialog.centerDialog();
    }

    stopPhalanxClock() {
        this.clearPageTimeout(this.phalanxTimer);
        this.phalanxTimer = null;
        if (ToolTip.parent?.closest?.(".PhalanxScan")) {
            ToolTip.hide();
            ToolTip.parent = null;
        }
    }

    updatePhalanxClock($content, initial = false) {
        this.clearPageTimeout(this.phalanxTimer);
        this.phalanxTimer = null;
        if (!this.pageActive || !$.contains(Dialog.dialogDiv, $content[0]) || (!initial && !$(Dialog.dialogDiv).is(":visible"))) {
            this.stopPhalanxClock();
            return;
        }
        const $clocks = $content.find(".OverviewFleetEventCountdown");
        const now = GameServerTime.now();
        $clocks.each((_, element) => {
            const $clock = $(element);
            const { endsAt, estimated } = $clock.data();
            const remaining = endsAt - now;
            $clock.text(!Number.isFinite(endsAt) || endsAt <= 0 ? "—" : remaining > 0
                ? `${estimated ? "≈ " : ""}${this.formatFleetDuration(remaining)}` : "Событие");
        });
        if ($clocks.length) this.phalanxTimer = this.setPageTimeout(() => this.updatePhalanxClock($content), 1000);
    }

    async openFriendRequest(planet) {
        this.closeObjectMenu();
        ToolTip.hide();
        const FriendPage = window.FriendsPageClass || await ShowPage._loadPageClass("friends", "FriendsPageClass");
        if (!this.pageActive || !FriendPage) return;
        FriendPage.openRequest({ userId: Number(planet.owner_id), name: planet.UserName,
            coordinates: { galaxy: planet.galaxy, system: planet.system, orbit: planet.planet } }, {
            scope: this.requestScope, maxLength: this.messageData.data.Page?.FriendRequestMaxLength || 500,
            onSuccess: message => {
                if (!this.pageActive) return;
                const row = message.getData("Page")?.Friends?.find(friend => Number(friend.userId) === Number(planet.owner_id));
                if (!row) return;
                for (const item of this.Planets) if (Number(item.owner_id) === Number(planet.owner_id)) {
                    item.Friendship = { id: row.id, state: row.accepted ? "friends" : (row.incoming ? "incoming" : "outgoing") };
                }
                this.renderObjectMenu();
            }
        });
    }

    openFriends() {
        this.closeObjectMenu();
        this.setActiveMode("friends");
    }

    createPlayerName(planet, $name = $("<span>", { class: "GalaxyPlayerLabel" })) {
        const statuses = (Array.isArray(planet.PlayerStatus) ? planet.PlayerStatus : [])
            .filter(status => Object.hasOwn(this.playerStatusLabels, status));
        if (!$name.children().length) $name.append($("<span>", { class: "GalaxyPlayerUsername" }), $("<span>", { class: "GalaxyPlayerStatus" }));
        $name.attr("class", "GalaxyPlayerLabel").find(".GalaxyPlayerUsername").text(planet.UserName || "—");
        for (const status of statuses) $name.addClass(`GalaxyPlayer-${status}`);
        const $status = $name.find(".GalaxyPlayerStatus");
        $status.toggle(Boolean(statuses.length));
        if (!$status.children().length) $status.append(document.createTextNode("("), $("<span>"), document.createTextNode(")"));
        const $values = $status.children().first();
        const old = new Map($values.children().get().map(element => [element.dataset.status, element]));
        statuses.forEach((status, index) => {
            const $value = old.has(status) ? $(old.get(status)) : $("<span>").attr("data-status", status);
            $value.attr("class", `GalaxyPlayer-${status}`).text(`${index ? " " : ""}${this.playerStatusLabels[status].short}`);
            if ($values[0].children[index] !== $value[0]) $values[0].insertBefore($value[0], $values[0].children[index] || null);
            old.delete(status);
        });
        old.forEach(element => $(element).remove());
        $name.attr("aria-label", [planet.UserName || "—", ...statuses.map(status => this.playerStatusLabels[status].label)].join(", "));
        return $name;
    }

    showPlayerCard(planet) {
        this.closeObjectMenu();
        ToolTip.hide();
        const $content = this.createDiv("", "", "GalaxyPlayerCard").append(this.createPlayerName(planet));
        Dialog.create($content, "Об игроке", [{ text: Lang.Close, action: () => Dialog.close() }]);
    }

    openFleetTarget(planet, missionType = null) {
        this.closeObjectMenu();
        ToolTip.hide();
        Overlay.Show(null, 250, () => {
            this.$Content.stop(true, true).fadeOut(250, () => {
                this.$Content.Show = false;
                GameEvents.emit("SendServer", {
                    mode: "fleets",
                    data: {
                        target: Number(planet.type) === 3 ? { type: 3, fleetId: Number(planet.fleetId) }
                            : Number(planet.type) === 2 ? { type: 2, galaxy: Number(planet.galaxy), system: Number(planet.system),
                                distance: Number(planet.distance), angle: Number(planet.angle) } : {
                            type: 1,
                            galaxy: Number(planet.galaxy),
                            system: Number(planet.system),
                            orbit: Number(planet.orbit ?? planet.planet),
                            objectType: Number(planet.objectType ?? planet.planet_type) || 1,
                            ...(planet.siteId ? { siteId: Number(planet.siteId) } : {})
                        }
                    },
                    onSuccess: (message) => {
                        // Контекст перехода UI, не поле Coordinate и не
                        // изменение серверного протокола. Доступность миссии
                        // затем проверяется сервером для выбранного Fleet.
                        message.setData("Page", {
                            ...message.getData("Page"),
                            NavigationMissionType: missionType
                        });
                        ShowPage.Show(message.mode, message);
                    }
                });
            });
        });
    }

    renderPlanetsNamePosition(p, x, y, radius, cx, cy) {
        if (!this.$Content?.PlanetsNames) return;

        const $name = this.$Content.PlanetsNames[p.planet];
        if (!$name || !$name.length) return;

        // получаем размер и позицию canvas внутри $System
        const canvasRect = this.canvas.getBoundingClientRect();
        const systemRect = this.$System[0].getBoundingClientRect();

        // координаты canvas относительно $System
        const canvasOffsetX = canvasRect.left - systemRect.left;
        const canvasOffsetY = canvasRect.top - systemRect.top;

        // координаты планеты внутри canvas с учетом смещения и зума
        const planetX = cx + this.offset.x + x * this.zoom;
        const planetY = cy + this.offset.y + y * this.zoom;



        const textScale = Math.min(1.12, Math.max(0.88, this.getVisualScale()));
        const labelOffset = radius * this.zoom + 6;

        // переводим в координаты $System
        const systemX = canvasOffsetX + planetX;
        const systemY = canvasOffsetY + planetY;

        // Подпись крайней видимой планеты не должна обрезаться краем карты.
        // Смещаем только текст, физическая позиция объекта остаётся прежней.
        const viewWidth = this.$System.innerWidth();
        const viewHeight = this.$System.innerHeight();
        const labelHalfWidth = $name.Caption.outerWidth() * textScale / 2;
        const labelShiftX = systemX >= 0 && systemX <= viewWidth
            ? Math.max(labelHalfWidth + 6, Math.min(viewWidth - labelHalfWidth - 6, systemX)) - systemX
            : 0;
        const labelAbove = systemY + labelOffset + $name.Caption.outerHeight() * textScale > viewHeight - 6;

        $name.css({
            position: "absolute",
            left: `${systemX}px`,
            top: `${systemY}px`,
            transform: "translate(-50%, -50%)",
            transformOrigin: "center",
            pointerEvents: "auto",
        });

        $name.Caption.css({
            position: "absolute",
            left: `calc(50% + ${labelShiftX}px)`,
            top: `${labelAbove ? -labelOffset : labelOffset}px`,
            transform: `translate(-50%, ${labelAbove ? "-100%" : "0"}) scale(${textScale})`,
            transformOrigin: labelAbove ? "bottom center" : "top center",
        });
        $name.Debris?.css({
            position: "absolute",
            left: `${radius * this.zoom + $name.Debris.outerWidth() / 2 + 3}px`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            transformOrigin: "center",
        });
    }


    // === Основной рендер ===
    async render(generation = this.renderGeneration) {
        const renderVersion = ++this.renderVersion;
        if (!await super.render(generation)) return;
        this.renderPhalanxScan();

        const nextSystem = this.messageData.data.Page?.System || {};
        if (Number(this.System?.galaxy) !== Number(nextSystem.galaxy)
            || Number(this.System?.system) !== Number(nextSystem.system)) {
            this.sensorContactPositions.clear();
            this.closeObjectMenu();
            this.setFreeOrbitsOpen(false);
        }
        const preserveView = this.SystemShow
            && Number(this.System?.galaxy) === Number(nextSystem.galaxy)
            && Number(this.System?.system) === Number(nextSystem.system);

        if (!preserveView) {
            this.stopAnimation();
            this.cancelZoomAnimation();
        }

        this.System = this.messageData.data.Page?.System || {};
        this.SystemInfo = this.messageData.data.Page?.SystemInfo || {};
        this.Orbits = this.messageData.data.Page?.Orbits || [];
        this.Planets = this.messageData.data.Page?.Planets || [];
        this.ResourceSites = this.messageData.data.Page?.ResourceSites || [];
        this.SpaceDebris = Object.values(this.messageData.data.Page?.SpaceDebris || {});
        const flyingFleets = this.messageData.data.Page?.FlyingFleets || [];
        this.SensorContacts = Object.values(this.messageData.data.Page?.SensorContacts || {});
        this.FlyingFleets = Array.isArray(flyingFleets)
            ? flyingFleets
            : Object.values(flyingFleets);
        this.resourceSitesByOrbit = this.ResourceSites.reduce((result, site) => {
            const orbit = Number(site.orbit);
            if (!Number.isInteger(orbit) || orbit <= 0) return result;
            (result[orbit] ??= []).push(site);
            return result;
        }, {});

        this.orbitMap = Object.fromEntries(this.Orbits.map(o => [o.orbit, o]));

        this.MaxGalaxy = parseInt(this.messageData.data.Page?.MaxGalaxy || 9);
        this.MaxSystem = parseInt(this.messageData.data.Page?.MaxSystem || 256);

        this.SpeedPlanets = this.messageData.data.Page?.SpeedPlanets ?? 24;
        this.FleetMissions = this.messageData.data.Page?.FleetMissions ?? [];
        if (!preserveView) {
            this.asteroidBelts = {};
            this.gasGiants = {};
        }
        for (const orbit of Object.keys(this.asteroidBelts)) {
            if (this.orbitMap[orbit]?.type !== 1) delete this.asteroidBelts[orbit];
        }
        for (const orbit of Object.keys(this.gasGiants)) {
            if (this.orbitMap[orbit]?.type !== 2) delete this.gasGiants[orbit];
        }

        this.renderNavigation();
        this.renderPlanetsNames();
        this.renderSystemInfo();
        this.renderFreeOrbits();

        // Ввод навигации — намерение игрока, а не состояние системы. Фоновый
        // snapshot той же системы не должен стирать ещё не отправленные цифры.
        if (!preserveView) {
            this.$Content.Navigation?.Galaxy.Input.val(this.System.galaxy);
            this.$Content.Navigation?.System.Input.val(this.System.system);
        }

        this.renderNavigation();

        await this.loadPlanetImages(this.Planets);

        if (renderVersion !== this.renderVersion || !this.isRenderCurrent(generation)) return;


        // вычисляем оптимальный размер canvas
        this.adjustCanvasSize();

        // вычисляем минимальный зум так, чтобы система влезала целиком


        // где-то после загрузки данных, перед this.animate()
        for (const orbit of this.Orbits) {
            if (orbit.type === 1) { // пояс астероидов
                //const distNorm = (orbit.distance - 600) / (12000 - 600);
                //const orbita = 80 + distNorm * (this.canvas.width / 3);

                this.generateAsteroidBelt(orbit.orbit, {
                    radius: this.orbitUeToPx(orbit.distance),
                    beltWidth: 64,
                    sites: this.getResourceSitesForOrbit(orbit.orbit)
                });
            } else if (orbit.type === 2) {
                // газовый гигант
                const site = this.getResourceSitesForOrbit(orbit.orbit)
                    .find((item) => Number(item.site_type) === this.resourceSiteTypes.GAS_GIANT) || null;
                this.generateGasGiant(orbit.orbit, {
                    radius: this.orbitUeToPx(orbit.distance),
                    name: orbit.name || site?.name || "Газовый гигант",
                    site,
                    imageKey: this.getGasGiantImageKey(orbit.orbit, site?.visual_variant),
                    ringImageKey: this.getGasGiantRingKey(orbit.orbit, site?.ring_variant),
                    color: "rgba(90,160,255,1)",
                    ringColor: "rgba(200,220,255,0.35)",
                    size: Number(site?.size) || 90000,
                    speed: Number(site?.speed) || 0.4,
                    rotation: Number(site?.rotation) === 0 ? 0 : 1
                });
            }
        }

        // Snapshot заменяет данные карточки; удалённый объект закрывает её.
        this.renderObjectMenu();

        // центрируем изначально
        if (!preserveView) {
            this.offset.x = 0;
            this.offset.y = 0;
        }

        //await this.loadAsteroidSprites();
        if (!this.animationFrameId) this.animate();

        if (!preserveView) {
            this.$System.stop(true, true).fadeIn(250, () => {
                if (renderVersion !== this.renderVersion || !this.isRenderCurrent(generation)) return;
                this.calculateZoomFit();
                this.SystemShow = true;
            });
        }
    }
};
