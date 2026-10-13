window.GalaxyPageClass = class GalaxyPageClass extends BasePageClass {

    Name = "GalaxyPageClass";

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
    ResourceSites = [];
    FlyingFleets = [];
    resourceSitesByOrbit = {};
    resourceSiteTypes = Object.freeze({ GAS_GIANT: 1, ASTEROID_SECTOR: 2 });


    asteroidBelts = {};
    asteroidSpriteSizes = {
        1: [69, 58], 2: [122, 74], 3: [139, 116], 4: [210, 168],
        5: [252, 210], 6: [252, 266], 7: [253, 137], 8: [483, 327]
    };

    SystemShow = false;

    // === Сенсорное управление ===
    isTouching = false;
    touchStartDist = 0;
    startZoom = 1;
    lastTouchCenter = { x: 0, y: 0 };
    renderVersion = 0;
    zoomAnimationFrameId = null;

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

        this.$SystemInfo = this.createDiv("", "GalaxySystemInfo", "GalaxySystemInfo box");
        this.$Legend = this.createDiv("", "GalaxyLegend", "GalaxyLegend box");
        this.$System.append(this.$SystemInfo, this.$Legend);

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

        $(this.canvas).off("wheel.canvas").on("wheel.canvas", (e) => this.onWheel(e));
        $(this.canvas).off("mousedown.canvas").on("mousedown.canvas", (e) => this.onMouseDown(e));
        $(this.canvas).off("mouseup.canvas").on("mouseup.canvas", (e) => this.onMouseUp(e));
        $(this.canvas).off("mouseleave.canvas").on("mouseleave.canvas", (e) => this.onMouseUp(e));
        $(this.canvas).off("mousemove.canvas").on("mousemove.canvas", (e) => this.onMouseMove(e));



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
            // Однопальцевое перемещение
            this.isDragging = true;
            this.canvas.style.cursor = "grabbing";
            const touch = e.touches[0];
            this.dragStart.x = touch.clientX - this.offset.x;
            this.dragStart.y = touch.clientY - this.offset.y;
        } else if (e.touches.length === 2) {
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
        event.preventDefault();
        this.cancelZoomAnimation();
        const zoomFactor = 1.1;
        const oldZoom = this.zoom;
        if (event.originalEvent.deltaY < 0) this.zoom *= zoomFactor;
        else this.zoom /= zoomFactor;
        this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom));

        // центрирование под курсором
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left - this.canvas.width / 2;
        const mouseY = event.clientY - rect.top - this.canvas.height / 2;
        this.offset.x -= mouseX * (this.zoom / oldZoom - 1);
        this.offset.y -= mouseY * (this.zoom / oldZoom - 1);

        this.limitPan();
    }

    // === Перемещение мышью ===
    onMouseDown(e) {
        if (e.button !== 0) return;
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
        if (!this.isDragging) return;

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

        const planet = (this.Planets || []).find(item =>
            Number(item.planet) === Number(coordinate.orbit)
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

    drawFlyingFleets(ctx, serverNow) {
        for (const fleet of this.FlyingFleets) {
            const startTime = Number(fleet.start_time);
            const endTime = Number(fleet.end_time);
            if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
                continue;
            }

            const start = this.getFleetCoordinatePhysicalPoint(fleet.segment_start, startTime);
            const end = this.getFleetCoordinatePhysicalPoint(fleet.segment_end, endTime);
            if (!start || !end) continue;

            const progress = Math.max(0, Math.min(1, (serverNow - startTime) / (endTime - startTime)));
            const isIncoming = Boolean(fleet.is_incoming);
            const color = isIncoming
                ? (fleet.is_hostile ? "rgba(255,90,90,0.95)" : "rgba(110,235,125,0.95)")
                : (fleet.is_return ? "rgba(255,190,85,0.95)" : "rgba(70,225,255,0.95)");
            const fleetLabel = isIncoming
                ? `${fleet.owner_name || "Чужой флот"} #${fleet.id}`
                : `Флот #${fleet.id}`;

            ctx.save();
            ctx.beginPath();
            for (let step = 0; step <= 24; step++) {
                const point = this.mapFleetPhysicalPoint(
                    this.interpolateFleetPhysicalPoint(start, end, step / 24)
                );
                if (step === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            }
            ctx.setLineDash([5, 6].map(value => this.screenToWorld(value)));
            ctx.strokeStyle = color.replace("0.95", "0.42");
            ctx.lineWidth = this.screenToWorld(1.3);
            ctx.stroke();
            ctx.setLineDash([]);

            const current = this.mapFleetPhysicalPoint(
                this.interpolateFleetPhysicalPoint(start, end, progress)
            );
            const next = this.mapFleetPhysicalPoint(
                this.interpolateFleetPhysicalPoint(start, end, Math.min(1, progress + 0.002))
            );
            const direction = Math.atan2(next.y - current.y, next.x - current.x);
            const markerSize = this.screenToWorld(8);

            ctx.translate(current.x, current.y);
            ctx.rotate(direction);
            ctx.beginPath();
            ctx.moveTo(markerSize, 0);
            ctx.lineTo(-markerSize * 0.75, markerSize * 0.62);
            ctx.lineTo(-markerSize * 0.35, 0);
            ctx.lineTo(-markerSize * 0.75, -markerSize * 0.62);
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
    }


    // === Автоматический расчет размера canvas ===
    adjustCanvasSize() {
        const contentRect = this.$Content?.[0]?.getBoundingClientRect();
        const width = Math.max(320, Math.round(contentRect?.width || window.innerWidth));
        const height = Math.max(320, Math.round(contentRect?.height || window.innerHeight) - 30);

        // Орбитальные координаты масштабируются через ctx.scale(this.zoom),
        // поэтому backing buffer соответствует viewport, а не диаметру мира.
        this.canvas.width = width;
        this.canvas.height = height;

    }

    // === Загрузка изображений ===
    async loadPlanetImages(planets) {
        const promises = [];
        this.planetImages = this.planetImages || {};
        this.asteroidSprites = this.asteroidSprites || {};
        this.starSprites = this.starSprites || {};
        this.gasGiantSprites = this.gasGiantSprites || {};
        this.gasGiantRingSprites = this.gasGiantRingSprites || {};

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

        const motionSite = sites.find(
            (site) => Number(site.site_type) === this.resourceSiteTypes.ASTEROID_SECTOR
        ) || null;
        this.asteroidBelts[orbitId] = {
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
            deg: Math.random() * 360
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
                ctx.strokeStyle = "rgba(0,0,255,0.55)";
                ctx.lineWidth = this.screenToWorld(1.8);
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
                ctx.beginPath();
                ctx.arc(0, 0, rad, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(180,215,255,0.22)";
                ctx.lineWidth = this.screenToWorld(0.85);
                ctx.stroke();
            }
        }

        // === Получаем текущее серверное время ===
        const serverNow = GameServerTime.now(); // float, например 1761326451.2070699


        for (const p of this.Planets) {
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

            const img = this.planetImages[p.image];
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

            this.renderPlanetsNamePosition(p, x, y, radius, cx, cy)

        }

        this.drawFlyingFleets(ctx, serverNow);

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
        const renderVersion = this.renderVersion;

        const animateZoom = (now) => {
            if (renderVersion !== this.renderVersion) return;

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
        if (this.zoomAnimationFrameId) {
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

        this.smoothZoomTo(this.minZoom, 250);
        this.stopAnimation();
        this.SystemShow = false;
        this.$System.stop(true, true).fadeOut(250, () => {
            this.SystemShow = false;
        });

        const target = e.currentTarget;
        const id = target.id;


        let Galaxy = this.System.galaxy;
        let System = this.System.system;

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
                Galaxy = this.$Content.Navigation.Galaxy.Input.val();
                System = this.$Content.Navigation.System.Input.val();
                break;
            default:
                return;
                break;
        }


        Galaxy = Math.max(1, Math.min(this.MaxGalaxy, Galaxy));
        System = Math.max(1, Math.min(this.MaxSystem, System));


        GameEvents.emit("SendServer", {
            mode: "galaxy",
            //action: act,
            data: {
                'galaxy': Galaxy,
                'system': System
            },
            onSuccess: (message) => ShowPage.Show(message.mode, message),
            ...this.getRequestOptions({ latestKey: "galaxy" })
        });
    }

    CreateNavigation() {
        //this.$Content.Buttons = {};
        this.$Content.Navigation = $("<div>").addClass("Navigation");

        this.$Content.Navigation.Galaxy = this.createDiv("", "NavigationGalaxyBlock", "GalaxyBlock");

        this.$Content.Navigation.Galaxy.Prev = this.createDiv(
            "", "NavigationGalaxyPrev", 'btn-box btn-box-left', this.NavigationEvent.bind(this));

        this.$Content.Navigation.Galaxy.Next = this.createDiv(
            "", "NavigationGalaxyNext", 'btn-box btn-box-right', this.NavigationEvent.bind(this));

        this.$Content.Navigation.Galaxy.Input = this.createInput(
            'number', 'NavigationGalaxyInput', '', "InputNumber", this.renderNavigation.bind(this), this.System.galaxy, { min: 1, max: () => this.MaxGalaxy });

        this.$Content.Navigation.Galaxy.append(
            this.$Content.Navigation.Galaxy.Prev,
            this.$Content.Navigation.Galaxy.Input,
            this.$Content.Navigation.Galaxy.Next
        );


        this.$Content.Navigation.System = this.createDiv("", "NavigationSystemBlock", "SystemBlock");

        this.$Content.Navigation.System.Prev = this.createDiv(
            "", "NavigationSystemPrev", 'btn-box btn-box-left', this.NavigationEvent.bind(this));

        this.$Content.Navigation.System.Next = this.createDiv(
            "", "NavigationSystemNext", 'btn-box btn-box-right', this.NavigationEvent.bind(this));

        this.$Content.Navigation.System.Input = this.createInput(
            'number', 'NavigationSystemInput', '', "InputNumber", this.renderNavigation.bind(this), this.System.system, { min: 1, max: () => this.MaxSystem });

        this.$Content.Navigation.System.append(
            this.$Content.Navigation.System.Prev,
            this.$Content.Navigation.System.Input,
            this.$Content.Navigation.System.Next
        );

        this.$Content.Navigation.Buttons = this.createDiv("", "NavigationButtonsBlock", "ButtonsBlock");

        this.$Content.Navigation.Buttons.Orbit = this.createDiv(
            "", "NavigationOrbit", 'btn-box btn-box-orbit', this.NavigationEvent.bind(this));
        this.$Content.Navigation.Buttons.append(this.$Content.Navigation.Buttons.Orbit)

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

        this.$SystemInfo.empty().append(
            this.createDiv(`Система ${this.System.galaxy}:${this.System.system}`, "", "GalaxySystemInfoTitle"),
            row("Звезда", `${star.type || this.System.star_type || "—"}`),
            row("Температура", `${this.formatGalaxyNumber(star.temperature, 0)} K`),
            row("Масса", `${this.formatGalaxyNumber(star.mass)} M☉`),
            row("Радиус", `${this.formatGalaxyNumber(star.radius)} R☉`),
            row("Светимость", `${this.formatGalaxyNumber(star.luminosity)} L☉`),
            row("Планеты", `${orbits.occupied ?? this.Planets.length} / ${orbits.ordinary ?? this.System.max_orbits ?? "—"}`),
            row("Вращение", direction)
        );

        const legendItem = (className, label) =>
            this.createDiv("", "", "GalaxyLegendItem").append(
                this.createDiv("", "", `GalaxyLegendMark ${className}`),
                this.createDiv(label, "", "GalaxyLegendLabel")
            );

        this.$Legend.empty().append(
            legendItem("GalaxyLegendPlanet", "Планета"),
            legendItem("GalaxyLegendAsteroids", "Пояс астероидов"),
            legendItem("GalaxyLegendAsteroidSector", "Ресурсный сектор"),
            legendItem("GalaxyLegendGas", "Газовый гигант"),
            legendItem("GalaxyLegendFleet", "Свой флот"),
            legendItem("GalaxyLegendEdge", "Граница системы"),
            legendItem("GalaxyLegendExpedition", "Орбита экспедиции")
        );
    }

    CreatePlanetsNames() {
        this.$Content.PlanetsNames = {};
        for (const p of this.Planets) {
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
        $name.Player = this.createDiv(planet.UserName || "", "", "GalaxyPlayerName box");
        $name.Planet = this.createDiv(planet.name, "", "GalaxyPlanetName box");
        $name.append($name.Player, $name.Planet);
        $name.Player.ToolTip(this.createPlayerTooltip(planet), { "max-width": "260px", placement: "cursor", interactive: true });
        $name.Planet.ToolTip(this.createPlanetTooltip(planet), { "max-width": "260px", placement: "cursor", interactive: true });
        $name.Planet.off(isTouch ? "confirmed-click.galaxy" : "click.galaxy")
            .on(isTouch ? "confirmed-click.galaxy" : "click.galaxy", () => this.openFleetTarget(planet));

        this.$Content.PlanetsNames[planet.planet] = $name;

        this.$System.append($name);
    }

    renderPlanetsNames() {
        if (!this.$Content?.PlanetsNames) {
            this.CreatePlanetsNames();
        }

        const existingPlanetIds = new Set(this.Planets.map(p => p.planet));

        // Скрываем подписи планет, которых больше нет
        $(".PlanetName").hide();

        for (const p of this.Planets) {
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
        $name.Player.text(p.UserName || "");
        $name.Planet.text(p.name);
        $name.Player.ToolTip(this.createPlayerTooltip(p), { "max-width": "260px", placement: "cursor", interactive: true });
        $name.Planet.ToolTip(this.createPlanetTooltip(p), { "max-width": "260px", placement: "cursor", interactive: true });
    }

    createPlanetTooltip(planet) {
        const $tooltip = this.createDiv("", "", "GalaxyPlanetTooltip");
        const coordinates = `${planet.galaxy}:${planet.system}:${planet.planet}`;
        const missionIds = new Set(planet.AvailableMissions || []);
        const missions = (this.FleetMissions || []).filter((mission) =>
            missionIds.has(mission.id)
        );

        $tooltip.append(
            this.createDiv("Планета", "", "GalaxyPlanetTooltipTitle"),
            this.createDiv(`${planet.name || "-"} [${coordinates}]`, "", "GalaxyPlanetTooltipOwner")
        );

        const $details = this.createDiv("", "", "GalaxyPlanetTooltipDetails");
        const detail = (label, value) => $details.append(
            this.createDiv(label, "", "GalaxyPlanetTooltipDetailLabel"),
            this.createDiv(value, "", "GalaxyPlanetTooltipDetailValue")
        );
        detail("Владелец", planet.UserName || "—");
        detail("Орбита", `${planet.planet} · ${this.formatGalaxyNumber(planet.distance, 0)} у.е.`);
        detail("Диаметр", `${this.formatGalaxyNumber(planet.size, 0)} км`);
        detail("Поля", this.formatGalaxyNumber(planet.fields, 0));
        detail("Температура", `${this.formatGalaxyNumber(planet.temp_min, 0)}…${this.formatGalaxyNumber(planet.temp_max, 0)} °C`);
        $tooltip.append($details);

        if (missions.length) {
            const $missions = this.createDiv("", "", "GalaxyPlanetTooltipMissions");
            for (const mission of missions) {
                $missions.append(this.createDiv(Lang[mission.lang], "", "GalaxyPlanetTooltipMission"));
            }
            $tooltip.append($missions);
        }

        $tooltip.append(this.createDiv("Нажмите, чтобы открыть отправку флота", "", "GalaxyPlanetTooltipAction"));
        return $tooltip;
    }

    createPlayerTooltip(planet) {
        const $tooltip = $("<table>", { class: "GalaxyPlayerTooltip", css: { width: "240px" } });
        const $body = $("<tbody>");
        const isCurrentPlayer = Number(planet.owner_id) === Number(this.messageData.data.Page?.UserId);

        $body.append($("<tr>").append($("<th>", { colspan: 2, text: `Игрок ${planet.UserName || "-"}` })));
        if (planet.Activity?.status === "active") {
            $body.append($("<tr>").append($("<td>", { colspan: 2, text: "Активен сейчас", class: "GalaxyPlayerActive" })));
        } else if (planet.Activity?.status === "recent") {
            $body.append($("<tr>").append($("<td>", {
                colspan: 2,
                text: `Активность ${planet.Activity.minutes} мин. назад`,
                class: "GalaxyPlayerRecent"
            })));
        }
        if (!isCurrentPlayer) {
            const $profileButton = $("<button>", { type: "button", text: "Об игроке" })
                .on("click", () => this.showPlayerCard(planet));
            $body.append($("<tr>").append($("<td>").append($profileButton)));
        }

        return $tooltip.append($body);
    }

    showPlayerCard(planet) {
        const $content = this.createDiv(planet.UserName || "-", "", "GalaxyPlayerCard");
        Dialog.create($content, "Об игроке", [{ text: Lang.Close, action: () => Dialog.close() }]);
    }

    openFleetTarget(planet) {
        Overlay.Show(null, 250, () => {
            this.$Content.stop(true, true).fadeOut(250, () => {
                this.$Content.Show = false;
                GameEvents.emit("SendServer", {
                    mode: "fleets",
                    data: {
                        target: {
                            type: 1,
                            galaxy: Number(planet.galaxy),
                            system: Number(planet.system),
                            orbit: Number(planet.planet),
                            objectType: 1
                        }
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

        $name.css({
            position: "absolute",
            left: `${systemX}px`,
            top: `${systemY}px`,
            transform: "translate(-50%, -50%)",
            transformOrigin: "center",
            pointerEvents: "auto",
        });

        $name.Player.css({
            position: "absolute",
            left: "50%",
            top: `${-labelOffset}px`,
            transform: `translate(-50%, -100%) scale(${textScale})`,
            transformOrigin: "bottom center",
        });

        $name.Planet.css({
            position: "absolute",
            left: "50%",
            top: `${labelOffset}px`,
            transform: `translate(-50%, 0) scale(${textScale})`,
            transformOrigin: "top center",
        });
    }


    // === Основной рендер ===
    async render(generation = this.renderGeneration) {
        const renderVersion = ++this.renderVersion;
        if (!await super.render(generation)) return;

        this.stopAnimation(); // <-- Сначала останавливаем предыдущую анимацию
        this.cancelZoomAnimation();

        this.System = this.messageData.data.Page?.System || {};
        this.SystemInfo = this.messageData.data.Page?.SystemInfo || {};
        this.Orbits = this.messageData.data.Page?.Orbits || [];
        this.Planets = this.messageData.data.Page?.Planets || [];
        this.ResourceSites = this.messageData.data.Page?.ResourceSites || [];
        const flyingFleets = this.messageData.data.Page?.FlyingFleets || [];
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
        this.asteroidBelts = {};
        this.gasGiants = {};

        this.renderNavigation();
        this.renderPlanetsNames();
        this.renderSystemInfo();

        this.$Content.Navigation?.Galaxy.Input.val(this.System.galaxy);
        this.$Content.Navigation?.System.Input.val(this.System.system);

        this.renderNavigation();

        await this.loadPlanetImages(this.Planets);

        if (renderVersion !== this.renderVersion) return;


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

        // центрируем изначально
        this.offset.x = 0;
        this.offset.y = 0;

        //await this.loadAsteroidSprites();
        this.animate();

        this.$System.stop(true, true).fadeIn(250, () => {
            this.calculateZoomFit();
            this.SystemShow = true;
        });
    }
};
