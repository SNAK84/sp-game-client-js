window.GalaxyPageClass = class GalaxyPageClass extends BasePageClass {

    Name = "GalaxyPageClass";

    // Параметры зума
    zoom = 0.00001;
    minZoom = 0.001;
    maxZoom = 3;

    offset = { x: 0, y: 0 };
    isDragging = false;
    dragStart = { x: 0, y: 0 };

    // Контейнеры изображений
    planetImages = {};
    asteroidSprites = {};
    starSprites = {};


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
        $(this.canvas).off("mousemove.canvas").
            on("mousemove.canvas", (e) => this.onMouseMove(e)).
            on("mousemove.canvas", (e) => this.onMouseDrag(e));



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
        }
    }

    // === Масштабирование колесиком ===
    onWheel(event) {
        event.preventDefault();
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
        const systemRadius = (this.canvas.width / 2) * this.zoom;

        const maxPanX = Math.max(0, systemRadius);
        const maxPanY = Math.max(0, systemRadius);

        this.offset.x = Math.max(-maxPanX, Math.min(maxPanX, this.offset.x));
        this.offset.y = Math.max(-maxPanY, Math.min(maxPanY, this.offset.y));
    }

    // === Размер планеты (нелинейный) ===
    getPlanetSizePx(size_km) {
        const min_km = 3000;
        const max_km = 40000;
        const min_px = 32;
        const max_px = 128;
        const gamma = 0.9;
        const norm = (size_km - min_km) / (max_km - min_km);
        return min_px + (max_px - min_px) * Math.pow(norm, gamma);
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
        const {
            minOrbitUE = 500,
            maxOrbitUE = 20000,
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


    // === Автоматический расчет размера canvas ===
    adjustCanvasSize(maxDistance) {
        const canvasSize = this.orbitUeToPx(maxDistance);
        this.canvas.width = canvasSize;
        this.canvas.height = this.canvas.width;

    }

    // === Загрузка изображений ===
    async loadPlanetImages(planets) {
        const promises = [];
        this.planetImages = this.planetImages || {};
        this.asteroidSprites = this.asteroidSprites || {};
        this.starSprites = this.starSprites || {};

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


    generateAsteroidBelt(orbitId, options) {

        const { radius, beltWidth } = options;

        const baseDensity = 0.25;
        const count = Math.floor(2 * Math.PI * radius * baseDensity * (0.8 + Math.random() * 0.4));

        // список доступных ключей спрайтов астероидов
        const spriteKeys = Object.keys(this.asteroidSprites);
        const asteroids = [];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r = radius + (Math.random() - 0.5) * beltWidth;

            // выбираем случайный спрайт по ключу
            const spriteKey = spriteKeys[Math.floor(Math.random() * spriteKeys.length)];

            const sizeRand = 1.6 + Math.random() * 0.8; // немного разных размеров
            const speed = (Math.random() * 0.5 + 0.5) * 0.02; // индивидуальная скорость вращения
            const direction = Math.random() < 0.5 ? -1 : 1;   // часть вращается в другую сторону
            const alpha = 0.7 + Math.random() * 0.3; // постоянная прозрачность (без мерцания)
            // вращение вокруг собственной оси
            const rotation = Math.random() * Math.PI * 2;
            const rotationSpeed = (Math.random() * 0.02 + 0.01) * (Math.random() < 0.5 ? -1 : 1);

            asteroids.push({
                angle, r, spriteKey, sizeRand,
                speed, direction, alpha,
                rotation, rotationSpeed
            });
        }

        this.asteroidBelts[orbitId] = {
            asteroids,
            globalRotation: Math.random() * Math.PI * 2, // общий угол вращения
            globalSpeed: 0.0002 + Math.random() * 0.0003 // общая скорость вращения
        };
    }

    drawAsteroidBelt(orbitId) {
        const ctx = this.ctx;
        const beltData = this.asteroidBelts[orbitId];
        if (!beltData) return;

        const { asteroids } = beltData;
        beltData.globalRotation += beltData.globalSpeed; // вращаем весь пояс

        const baseScale = 0.025; // общий масштаб спрайтов, регулируй визуально
        const zoomFactor = 1 / this.zoom; // компенсируем зум, чтобы астероиды не «распухали» при приближении

        ctx.save();
        ctx.rotate(beltData.globalRotation); // вращаем систему координат для общего движения

        for (const a of asteroids) {
            // вращаем астероиды
            a.angle += a.speed * a.direction * 0.05;
            a.rotation += a.rotationSpeed * 1; // вращаем вокруг оси

            const x = a.r * Math.cos(a.angle);
            const y = a.r * Math.sin(a.angle);

            const img = this.asteroidSprites[a.spriteKey];
            const [w, h] = this.asteroidSpriteSizes[a.spriteKey.replace("asteroid_", "")] || [64, 64];


            const scaledW = w * baseScale * 1 * a.sizeRand;
            const scaledH = h * baseScale * 1 * a.sizeRand;

            ctx.globalAlpha = a.alpha;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a.rotation * 0.1); // вращаем сам спрайт

            if (!img || !img.complete) {
                ctx.beginPath();
                ctx.arc(x, y, 2 * a.sizeRand, 0, 2 * Math.PI);
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

    generateGasGiant(orbitId, options) {
        const {
            radius,        // расстояние от звезды
            name = "Gas Giant",
            color = "rgba(100,180,255,1)",
            ringColor = "rgba(180,200,255,0.35)",
            ringInner = 1.8,   // внутр. радиус кольца (в кратных радиусах планеты)
            ringOuter = 2.5,   // внеш. радиус кольца (в кратных радиусах планеты)
            size = 60000,      // диаметр планеты (в км, для getPlanetSizePx)
            speed = 0.3,       // скорость вращения
            rotation = 1       // направление вращения (1 или -1)
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
            deg: Math.random() * 360 // случайная стартовая позиция
        };
    }

    drawGasGiant(giant) {
        const ctx = this.ctx;
        const diameter = this.getPlanetSizePx(giant.size);
        const radius = diameter / 2;

        // вычисляем положение по орбите
        const rad = (giant.deg * Math.PI) / 180;
        const x = giant.radius * Math.cos(rad);
        const y = giant.radius * Math.sin(rad);

        // кольца
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rad / 2); // небольшой наклон

        // кольцо
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * giant.ringOuter, radius * giant.ringInner, 0, 0, 2 * Math.PI);
        ctx.strokeStyle = giant.ringColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();

        // сам гигант
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = giant.color;
        ctx.fill();

        // обновляем угол
        giant.deg += giant.speed * giant.rotation * 0.1;
    }

    // === Отрисовка ===
    renderPlanets() {

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(cx + this.offset.x, cy + this.offset.y);
        ctx.scale(this.zoom, this.zoom);

        // солнце
        const starType = this.System.star_type || "G"; // дефолтная звезда, если не указано
        const starKey = `star_${starType}`;
        const star = this.starSprites[starKey];

        const star_size = this.System.star_size * 16;
        if (star && star.complete) {
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
                this.drawAsteroidBelt(orbit.orbit);


            } else if (orbit.type == 2) {

                ctx.beginPath();
                ctx.arc(0, 0, rad, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(0,0,255,0.55)";
                ctx.lineWidth = 6;

                /*const giant = this.gasGiants?.[orbit.orbit];
                if (giant) this.drawGasGiant(giant);*/

            } else {
                ctx.beginPath();
                ctx.arc(0, 0, rad, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.lineWidth = 3;
            }
            ctx.stroke();
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

            const diameter = this.getPlanetSizePx(p.size);
            const radius = diameter / 2;

            const img = this.planetImages[p.image];
            if (img && img.complete)
                ctx.drawImage(img, x - radius, y - radius, diameter, diameter);
            else {
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = "gray";
                ctx.fill();
            }

            this.renderPlanetsNamePosition(p, x, y, radius, cx, cy)

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
        this.minZoom = fitZoom * 0.5;   // можно приближать в 2 раза
        this.maxZoom = fitZoom * 10;     // можно отдалять в 3 раза
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
        const startZoom = this.zoom;
        const delta = targetZoom - startZoom;
        const startTime = performance.now();

        const animateZoom = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            // плавная интерполяция (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);

            this.zoom = startZoom + delta * eased;
            this.renderPlanets();

            if (progress < 1) {
                requestAnimationFrame(animateZoom);
            } else {
                this.zoom = targetZoom;
            }
        };

        requestAnimationFrame(animateZoom);
    }

    // === Анимация ===
    animate() {
        const now = performance.now();
        if (!this.lastFrameTime) this.lastFrameTime = now;
        const delta = now - this.lastFrameTime;

        if (delta > 16) { // ~60 FPS
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

    NavigationEvent(e) {

        if ($(e.currentTarget).attr("disabled")) {
            return false;
        }

        this.smoothZoomTo(this.minZoom, 250);
            this.stopAnimation();
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
            }
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

        this.$Content.PlanetsNames[planet.planet] = this.createDiv(
            planet.UserName, 'PlanetName' + planet.planet, "PlanetName box"
        );

        this.$System.append(this.$Content.PlanetsNames[planet.planet]);
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

        this.$Content.PlanetsNames[p.planet].text(p.UserName);
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



        // --- Нелинейный масштаб текста ---
        const maxZoom = this.maxZoom;
        const minZoom = this.minZoom;
        const zoomRatio = (this.zoom - minZoom) / (maxZoom - minZoom); // [0..1]

        // Пример функции: при минимальном zoom текст увеличен, при максимальном zoom равен канвасу
        const textScale = this.zoom + (1 - zoomRatio) * 0.5; // регулируй множитель 0.7

        // переводим в координаты $System
        const systemX = canvasOffsetX + planetX;
        const systemY = canvasOffsetY + planetY + radius * this.zoom + 2 * textScale; // + отступ

        $name.css({
            position: "absolute",
            left: `${systemX}px`,
            top: `${systemY}px`,
            transform: `translate(-50%, 0) scale(${textScale})`,
            transformOrigin: "top center",
            pointerEvents: "none",
        });
    }


    // === Основной рендер ===
    async render() {
        await super.render();

        this.stopAnimation(); // <-- Сначала останавливаем предыдущую анимацию

        this.System = this.messageData.data.Page?.System || {};
        this.Orbits = this.messageData.data.Page?.Orbits || [];
        this.Planets = this.messageData.data.Page?.Planets || [];

        this.orbitMap = Object.fromEntries(this.Orbits.map(o => [o.orbit, o]));

        this.MaxGalaxy = parseInt(this.messageData.data.Page?.MaxGalaxy || 9);
        this.MaxSystem = parseInt(this.messageData.data.Page?.MaxSystem || 256);

        this.SpeedPlanets = this.messageData.data.Page?.SpeedPlanets ?? 24;

        this.renderNavigation();
        this.renderPlanetsNames();

        this.$Content.Navigation?.Galaxy.Input.val(this.System.galaxy);
        this.$Content.Navigation?.System.Input.val(this.System.system);

        this.renderNavigation();

        await this.loadPlanetImages(this.Planets);


        // вычисляем оптимальный размер canvas
        //this.adjustCanvasSize(this.System.max_distance || 12000);
        this.adjustCanvasSize(25000);

        // вычисляем минимальный зум так, чтобы система влезала целиком


        // где-то после загрузки данных, перед this.animate()
        for (const orbit of this.Orbits) {
            if (orbit.type === 1) { // пояс астероидов
                //const distNorm = (orbit.distance - 600) / (12000 - 600);
                //const orbita = 80 + distNorm * (this.canvas.width / 3);

                this.generateAsteroidBelt(orbit.orbit, {
                    radius: this.orbitUeToPx(orbit.distance),
                    beltWidth: 64
                });
            } else if (orbit.type === 2) {
                // газовый гигант
                this.generateGasGiant(orbit.orbit, {
                    radius: 350,
                    color: "rgba(90,160,255,1)",
                    ringColor: "rgba(200,220,255,0.35)",
                    size: 90000,
                    speed: 0.4,
                    rotation: 1
                });
            }
        }

        // центрируем изначально
        this.offset.x = 0;
        this.offset.y = 0;

        //await this.loadAsteroidSprites();
        this.animate();

        if (!this.SystemShow)
            this.$System.stop(true, true).fadeIn(250, () => {
                this.calculateZoomFit();
                this.SystemShow = true;
            });
    }
};
