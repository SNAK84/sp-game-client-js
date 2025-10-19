const MS_PER_HOUR = 3600000;

setInterval(() => {
    document.dispatchEvent(new Event("GameTick"));
}, 1000);

const Data = {

    // Настройка режима хранения токена: 'none' | 'session' | 'local'
    storageMode: 'session',
    tokenStorageKey: 'sp_token',
    modeStorageKey: 'sp_mode',

    // 🔹 Определение используемого хранилища
    getStorage() {
        if (this.storageMode === 'local') return window?.localStorage || null;
        if (this.storageMode === 'session') return window?.sessionStorage || null;
        return null; // 'none'
    },

    // 🔹 Работа с токеном
    get token() {
        const storage = this.getStorage();
        if (!storage) return null;
        try {
            return storage.getItem(this.tokenStorageKey);
        } catch (e) {
            console.warn("Ошибка чтения token:", e);
            return null;
        }
    },

    set token(token) {
        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.setItem(this.tokenStorageKey, token);
        } catch (e) {
            console.warn("Ошибка записи token:", e);
        }
    },

    // 🔹 Работа с mode
    get mode() {
        const storage = this.getStorage();
        if (!storage) return null;
        try {
            return storage.getItem(this.modeStorageKey);
        } catch (e) {
            console.warn("Ошибка чтения mode:", e);
            return null;
        }
    },

    set mode(mode) {
        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.setItem(this.modeStorageKey, mode);
        } catch (e) {
            console.warn("Ошибка записи mode:", e);
        }
    },

    // 🔹 Очистка данных (например, при logout)
    clear() {
        const storage = this.getStorage();
        if (!storage) return;
        try {
            storage.removeItem(this.tokenStorageKey);
            storage.removeItem(this.modeStorageKey);
        } catch (e) {
            console.warn("Ошибка очистки Data:", e);
        }
    }
};


$.fn._originalSerializeArray = $.fn.serializeArray;

$.fn.serializeArray = function () {
    const arr = this._originalSerializeArray();

    // Обработка чекбоксов: включаем checked состояния
    this.find('input[type="checkbox"]').each(function () {
        if (!this.name || this.disabled) return;
        // ищем существующую запись
        const idx = arr.findIndex(item => item.name === this.name);
        if (idx >= 0) {
            // если это массив (несколько чекбоксов с тем же именем), можно хранить массив строк
            const cur = arr[idx].value;
            if (Array.isArray(cur)) {
                // push as boolean / or as value?
            } else {
                // replace with boolean
                arr[idx].value = this.checked;
            }
        } else {
            arr.push({ name: this.name, value: this.checked });
        }
    });
    return arr;
};


let Overlay = {
    Show: function (selector, ms, callback) {
        const _selector = selector || "body";
        const _ms = ms || 300;

        let $over = $(_selector).children("overlay");

        if ($over.length === 0) {
            $over = $("<overlay>");
            $(_selector).prepend($over);
        }

        $over.stop(true).fadeTo(_ms, 0.75, function () {
            if (typeof callback === "function") callback();
        });
    },

    Hide: function (selector, ms, callback) {
        const _selector = selector || "body";
        const _ms = ms || 300;

        const $over = $(_selector).children("overlay");
        if ($over.length) {
            $over.stop(true).fadeOut(_ms, function () {
                if (typeof callback === "function") callback();
            });
        }
    },

    Text: function (text, selector) {
        const _selector = selector || "body";
        const $over = $(_selector).children("overlay");

        if ($over.length === 0) return null;

        if (text === undefined) {
            return $over.text();
        } else {
            $over.text(text);
            return $over;
        }
    }
};

let Page = null;

// --- Кэш классов и экземпляров ---
const PageClasses = {};
const PageInstances = {};

// --- Главный контроллер страниц ---
// предполагается, что pageMap и PagesLink уже объявлены (как у тебя)
const ShowPage = {
    // кэши
    _pageClasses: {},      // className -> class (function)
    _pageInstances: {},    // className -> instance
    _loading: {},          // className -> Promise загрузки
    current: null,         // текущий экземпляр страницы

    /**
     * Показать страницу по module (например "overview")
     * @param {string} module
     * @param {object|null} data
     */
    async Show(module, data = null) {
        const safeData = data ?? {};
        window.Mode = safeData.mode ?? module ?? "";

        const className = (pageMap && pageMap[module]) || null;
        if (!className) {
            console.warn("ShowPage: неизвестный модуль:", module);
            return;
        }

        // Скрываем предыдущую страницу, если это другая
        if (Page && Page.Name !== className) {
            try { Page.Hide?.(); } catch (e) { console.warn("Ошибка при Page.Hide():", e); }
            Page = null;
        }

        // Загружаем класс (или берём из кэша)
        let PageClass = this._pageClasses[className] ?? window[className] ?? null;
        if (!PageClass) {
            PageClass = await this._loadPageClass(module, className);
            if (!PageClass) {
                console.error("Не удалось загрузить класс страницы:", className);
                return;
            }
            this._pageClasses[className] = PageClass;
        }

        // Создаём экземпляр (если ещё нет)
        /*if (!this._pageInstances[className]) {
            try {
                // Обёртка на случай, если конструктор кидает — чтобы не ломать приложение
                const inst = new PageClass();
                inst.Name = className;
                this._pageInstances[className] = inst;
            } catch (e) {
                console.error("Ошибка при создании экземпляра страницы:", e);
                return;
            }
        }*/

        // Делай текущим и вызывай Show
        if (!Page || Page.Name !== className)
            Page = new PageClass();//this._pageInstances[className];
        try {
            Page.Show?.(module, safeData);
        } catch (e) {
            console.error("Ошибка при вызове Page.Show():", e);
        }
    },

    /**
     * Загружает скрипт страницы и ждёт появления window[className]
     * Возвращает class (функцию/конструктор) или null
     */
    _loadPageClass(module, className) {
        // если уже загружается — возвращаем промис
        if (this._loading[className]) return this._loading[className];

        // если PagesLink содержит URL по module — берём его
        const url = (PagesLink && (PagesLink[module] || PagesLink[className])) || null;
        if (!url) {
            console.error("ShowPage: нет ссылки в PagesLink для:", module, className);
            return Promise.resolve(null);
        }

        const promise = new Promise((resolve) => {
            // Если класс уже появился в window во время ожидания — возвращаем
            if (window[className]) {
                this._pageClasses[className] = window[className];
                resolve(window[className]);
                return;
            }

            // Создаём тэг скрипта
            const script = document.createElement("script");
            script.src = url;
            script.async = true;

            // Таймаут на случай, если скрипт загрузится, но не объявит класс — 5s
            let timeoutId = setTimeout(() => {
                console.error("ShowPage: загрузка класса превысила таймаут:", className, url);
                resolve(null);
            }, 5000);

            script.onload = () => {
                clearTimeout(timeoutId);
                if (window[className]) {
                    this._pageClasses[className] = window[className];
                    resolve(window[className]);
                } else {
                    // даём небольшой дополнительный интервал, т.к. иногда класс объявляют чуть позже
                    setTimeout(() => {
                        if (window[className]) {
                            this._pageClasses[className] = window[className];
                            resolve(window[className]);
                        } else {
                            console.error("ShowPage: класс не зарегистрирован в window после загрузки:", className, url);
                            resolve(null);
                        }
                    }, 50);
                }
            };

            script.onerror = () => {
                clearTimeout(timeoutId);
                console.error("ShowPage: ошибка загрузки скрипта:", url);
                resolve(null);
            };

            document.head.appendChild(script);
        });

        this._loading[className] = promise;
        // по завершении — удаляем из loading, чтобы при следующем запросе можно было заново (или взять кэш)
        promise.finally(() => { delete this._loading[className]; });

        return promise;
    }
};




/** 
 * Конвертация секунд в читаемое время
 * @param {number} sec - секунды
 * @param {boolean} form - формат отображения (true = читаемый)
 * @param {boolean} ms - показывать миллисекунды
 */
function secondToTime(sec, form = true, ms = false) {
    const origSec = Number(sec);

    let remaining = sec;

    const d = Math.floor(remaining / 86400);
    remaining %= 86400;

    const h = Math.floor(remaining / 3600);
    remaining %= 3600;

    const m = Math.floor(remaining / 60);
    const s = Math.floor(remaining % 60);

    const msVal = ms ? Math.floor((origSec - Math.floor(origSec)) * 1000) : 0;

    //const msVal = ms ? Math.floor((remaining - Math.floor(remaining)) * 1000) : 0;

    if (form) {
        // Читаемый формат
        let parts = [];
        if (d > 0) parts.push(`${d}д `);
        if (h > 0 || d > 0) parts.push(`${String(h).padStart(2, '0')}ч `);
        if (m > 0 || h > 0 || d > 0) parts.push(`${String(m).padStart(2, '0')}м `);
        parts.push(`${String(s).padStart(2, '0')}с`);
        if (ms) parts.push(` ${String(msVal).padStart(3, '0')}мс`);
        return parts.join('');
    } else {
        // Формат для программ (например 01:02:03.456)
        let parts = [];
        if (d > 0) parts.push(`${d} `);
        if (h > 0 || d > 0) parts.push(`${String(h).padStart(2, '0')}:`);
        if (m > 0 || h > 0 || d > 0) parts.push(`${String(m).padStart(2, '0')}:`);
        parts.push(String(s).padStart(2, '0'));
        if (ms) parts.push(`.${String(msVal).padStart(3, '0')}`);
        return parts.join('');
    }
}

/**
 * Преобразует timestamp (в секундах) в строку формата времени/даты.
 * @param {number} timestamp - время в секундах (microtime(true))
 * @param {"time"|"date"|"datetime"|"timedate"} format - формат вывода
 * @param {boolean} fullYear - false = полный год (2025), false = короткий год (25)
 * @returns {string}
 */
function formatTimestamp(timestamp, format = "time", fullYear = false) {
    const date = new Date(timestamp * 1000);
    const pad = (n) => String(n).padStart(2, "0");

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const timeStr = `${hours}:${minutes}:${seconds}`;

    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    let year = date.getFullYear();
    if (!fullYear) year = String(year).slice(-2);
    const dateStr = `${day}.${month}.${year}`;

    switch (format) {
        case "time": return timeStr;
        case "date": return dateStr;
        case "datetime": return `${dateStr} ${timeStr}`;
        case "timedate": return `${timeStr} ${dateStr}`;
        default: return timeStr;
    }
}


// Форматируем число с разделением тысяч и фиксированным количеством знаков после запятой
function number_format(number, decimals = 0) {
    if (!isFinite(number)) number = 0;
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(number);
}

// Преобразуем число в удобочитаемый вид с суффиксами K, M, G и т.д.
function humanNumber(value, shortly = false, min = 1, forHTML = true) {
    const prefs = ["", "K", "M", "B", "T", "Q", "Q+", "S", "S+", "O", "N"];
    let steps = 0;

    // guard: ensure numeric
    value = Number(value) || 0;

    if (shortly) {
        const maxWithoutSuffix = Math.pow(10, min * 3);
        while (Math.abs(value) >= maxWithoutSuffix && steps < prefs.length - 1) {
            value /= 1000;
            steps++;
        }
    }

    let suffix = prefs[steps] || "";
    if (forHTML && suffix) suffix = " " + suffix;

    // show 2 decimals when shortened, otherwise no decimals
    const decimals = (shortly && steps > 0) ? 2 : 0;
    return number_format(value, 0) + suffix;
}

// Убираем экспоненциальную запись (например 1.23e+6 → 1230000)
function removeE(num) {
    if (!Number.isFinite(num)) return String(num);
    let str = String(num);
    if (!str.includes('e')) return str;

    // Используем BigInt для больших чисел
    try {
        return BigInt(Math.floor(num)).toString();
    } catch {
        // fallback для очень больших чисел, где BigInt не нужен
        return num.toPrecision(21).replace(/\.?0+$/, '');
    }
}


class TimerController {
    /**
     * Создаёт или обновляет таймер на элементе
     * @param {HTMLElement} element - элемент, к которому привязан таймер
     * @param {number} milliseconds - длительность в миллисекундах
     * @param {object} options - настройки таймера
     */
    constructor(element, milliseconds, options = {}) {
        // Если на элементе уже есть таймер — просто обновляем
        if (element._timerController instanceof TimerController) {
            element._timerController.updateSettings(milliseconds, options);
            return element._timerController;
        }

        this.element = element;
        this.milliseconds = milliseconds;

        // Настройки
        this.form = options.form ?? true;
        this.ms = options.ms ?? false;
        this.template = options.template || "{time}";
        this.onTick = options.onTick || null;
        this.onEnd = options.onEnd || null;
        this.formatter = options.formatter || null;
        this.startTime = Date.now();
        this.endTime = this.startTime + milliseconds;
        this._isActive = true;

        // Привязка к элементу
        element._timerController = this;

        // Регистрируем в глобальном менеджере
        TimerController._register(this);

        // Первое обновление
        //this._updateDisplay();
    }

    /** Обновление настроек */
    updateSettings(milliseconds, options = {}) {
        if (milliseconds !== undefined) {
            this.milliseconds = milliseconds;
            this.startTime = Date.now();
            this.endTime = this.startTime + milliseconds;
        }

        if (options.form !== undefined) this.form = options.form;
        if (options.ms !== undefined) this.ms = options.ms;
        if (options.template !== undefined) this.template = options.template;
        if (options.onTick !== undefined) this.onTick = options.onTick;
        if (options.onEnd !== undefined) this.onEnd = options.onEnd;
        if (options.formatter !== undefined) this.formatter = options.formatter;

        this._updateDisplay();
    }

    /** Сброс с новым временем */
    reset(milliseconds) {
        this.startTime = Date.now();
        this.milliseconds = milliseconds;
        this.endTime = this.startTime + milliseconds;
        this._isActive = true;
        this._updateDisplay();
    }

    /** Остановить таймер */
    stop() {
        this._isActive = false;
        TimerController._unregister(this);
    }

    /** Сколько миллисекунд осталось */
    getRemainingMilliseconds() {
        return Math.max(0, this.endTime - Date.now());
    }

    /** Внутренний тик (вызывается при событии GameTick) */
    _tick() {
        if (!this._isActive) return;

        const remainingMs = this.getRemainingMilliseconds();

        this._updateDisplay();

        if (this.onTick) this.onTick(remainingMs, this.element);

        if (remainingMs <= 0) {
            this._isActive = false;
            TimerController._unregister(this);
            if (this.onEnd) this.onEnd(this.element);
        }
    }

    /** Обновление отображения */
    _updateDisplay() {
        const remainingMs = this.getRemainingMilliseconds();
        const remainingSec = remainingMs / 1000;

        let timeStr = this.formatter
            ? this.formatter(remainingSec)
            : secondToTime(remainingSec, this.form, this.ms);

        const output = this.template.replace("{time}", timeStr);

        if (this.element.tagName === "INPUT" || this.element.tagName === "BUTTON") {
            this.element.value = output;
        } else {
            this.element.textContent = output;
        }
    }

    // === STATIC ===

    /** Глобальный список активных таймеров */
    static _timers = new Set();

    /** Регистрирует таймер */
    static _register(timer) {
        this._timers.add(timer);
    }

    /** Удаляет таймер */
    static _unregister(timer) {
        this._timers.delete(timer);
    }

    /** Вызывается при каждом GameTick */
    static _onGameTick() {
        for (const timer of this._timers) {
            timer._tick();
        }
    }
}

// Глобальная подписка на игровой тик
document.addEventListener("GameTick", () => TimerController._onGameTick());

class ServerTime {
    constructor() {
        this.serverMicrotime = 0;  // Последнее значение microtime(true) с сервера
        this.localTimestamp = 0;   // Локальное время (Date.now()/1000) в момент получения
        this.offset = 0;           // Разница между сервером и клиентом (секунды)
        this.displayElement = null;
        this.updateInterval = null;
    }

    /**
     * Обновление времени с сервера
     * @param {number} serverMicrotime - время с сервера (в секундах, float)
     */
    update(serverMicrotime) {
        this.serverMicrotime = serverMicrotime;
        this.localTimestamp = Date.now() / 1000;
        this.offset = serverMicrotime - this.localTimestamp;
    }

    /**
     * Получение текущего серверного времени
     */
    now() {
        return (Date.now() / 1000) + this.offset;
    }

    /**
     * Возвращает серверное время в виде форматированной строки
     */
    getFormattedTime() {
        return formatTimestamp(this.now(), 'timedate');
        const date = new Date(this.now() * 1000);


        const h = String(date.getHours()).padStart(2, "0");
        const m = String(date.getMinutes()).padStart(2, "0");
        const s = String(date.getSeconds()).padStart(2, "0");
        return `${h}:${m}:${s}`;
    }


    createDisplay() {
        this.displayElement = document.createElement("div");
        this.displayElement.classList.add("server-time");
        this.displayElement.style.cssText = `
            position: absolute;
            top: 10px;
            right: 20px;
            font-family: monospace;
            color: #8af;
            background: rgba(0, 0, 0, 0.3);
            padding: 4px 8px;
            border-radius: 6px;
        `;
        document.body.appendChild(this.displayElement);

    }
    /**
     * Создает DOM элемент для отображения серверного времени
     */
    renderDisplay() {

        if (!this.displayElement) this.createDisplay();

        this.displayElement.textContent = this.getFormattedTime();

        this.updateInterval = setInterval(() => {
            this.displayElement.textContent = this.getFormattedTime();
        }, 1000);
    }
}

class GameEventsClass extends EventTarget {
    emit(name, detail = {}) {
        var event = $.Event(name, { detail });
        $(this).trigger(event);
        return this;
    }

    on(name, callback) {
        $(this).on(name, callback);
        //this.addEventListener(name, callback);
        return this;
    }

    off(name, callback) {
        if (callback)
            $(this).off(name, callback);
        else
            $(this).off(name);
        return this;
    }
}

class Message {
    constructor(raw = null) {
        if (raw) {
            this.status = raw.status || 'ok';
            this.requestId = raw.requestId || Message.generateRequestId();
            this.token = raw.token || '';
            this.mode = raw.mode || '';
            this.action = raw.action || '';
            this.lang = raw.lang || '';
            this.serverTime = raw.serverTime || 0;
            this.data = raw.data || {};
            this.error = raw.error || { code: '', message: '' };
        } else {
            this.status = 'ok';
            this.requestId = Message.generateRequestId();
            this.token = '';
            this.mode = '';
            this.action = '';
            this.lang = '';
            this.serverTime = 0;
            this.data = {};
            this.error = { code: '', message: '' };
        }

    }

    // Генерация уникального requestId (UUID v4)
    static generateRequestId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    setToken(token) {
        this.token = token;
        return this;
    }

    setMode(mode) {
        this.mode = mode;
        return this;
    }

    setAction(action) {
        this.action = action;
        return this;
    }

    setData(key, value) {
        this.data[key] = value;
        return this;
    }

    clearData() {
        this.data = {};
        return this;
    }

    setError(code, message) {
        this.status = 'error';
        this.error.code = code;
        this.error.message = message;
        return this;
    }

    getData(key, defaultValue = null) {
        return this.data.hasOwnProperty(key) ? this.data[key] : defaultValue;
    }

    toJSON() {
        const obj = {
            status: this.status,
            requestId: this.requestId
        };
        if (this.token) obj.token = this.token;
        if (this.mode) obj.mode = this.mode;
        if (this.action) obj.action = this.action;
        if (this.lang) obj.lang = this.lang;
        if (Object.keys(this.data).length > 0) obj.data = this.data;
        if (this.status === 'error') obj.error = this.error;
        return obj;
    }

    toString() {
        return JSON.stringify(this.toJSON());
    }
}

class PingService {
    constructor(wsInstance) {
        this.ws = wsInstance;          // ссылка на WebSocketClass
        this.samples = [];              // последние измерения
        this.maxSamples = 10;           // сколько хранить
        this.lastPingTime = null;       // время последнего пинга
        this.interval = null;           // ID таймера
        this.currentPing = null;        // последнее значение
        this.listeners = [];            // подписчики
    }

    // 🔹 Запуск измерения пинга
    start(periodMs = 10000) {
        this.stop();
        this._sendPing(); // первый сразу
        this.interval = setInterval(() => this._sendPing(), periodMs);
    }

    // 🔹 Остановка
    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    // 🔹 Отправка ping на сервер
    _sendPing() {
        if (!this.ws || this.ws.ws.readyState !== WebSocket.OPEN) return;
        this.lastPingTime = performance.now();
        this.ws.send(new Message().setMode("connect").setAction("ping"));
    }

    // 🔹 Ответ от сервера (pong)
    onPong() {
        if (!this.lastPingTime) return;

        const now = performance.now();
        const ping = Math.round(now - this.lastPingTime);
        this.lastPingTime = null;

        this.currentPing = ping;
        this.samples.push(ping);
        if (this.samples.length > this.maxSamples) this.samples.shift();

        const avg = this.averagePing();

        // вывод в лог


        // уведомляем слушателей
        this.listeners.forEach(cb => cb(ping, avg));
    }

    // 🔹 Среднее значение
    averagePing() {
        if (this.samples.length === 0) return 0;
        const sum = this.samples.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.samples.length);
    }

    // 🔹 Подписка на обновления пинга
    onUpdate(callback) {
        this.listeners.push(callback);
    }
}

class WebSocketClass {

    reconnect = false;

    constructor(url = "wss://spserver.snak84.ru") {

        this.url = url;

        this.token = null;
        this.ws = null;

        this.heartbeatInterval = null;
        this.reconnectTimeout = null;
        this.reconnectDelay = 5000;

        this.sendPing = 0;

        this.messageQueue = []; // очередь сообщений при обрыве

        // ✅ Создаём сервис пинга
        this.pingService = new PingService(this);
        this.pingService.onUpdate((ping, avg) => {
            //console.log(`%c📡 Ping: ${ping} ms (avg ${avg} ms)`, "color: limegreen");
            $("#ping-indicator").text(`📡${ping} ms (${avg} ms)`);
        });

        this.connect();

        GameEvents.on("SendServer", (e) => {
            const { mode, action, NotOverlay, data } = e.detail;
            // Показываем Overlay, если это не ping/handshake/reconnect
            if (mode !== "connect" && action !== "ping" && action !== "handshake" && action !== "reconnect" && !NotOverlay) {
                Overlay.Show(null, 250, () => this.Submit(mode, action, data));
                //this.waitOverlayAction = hide || action; // запоминаем, при каком action нужно будет скрыть
            } else
                this.Submit(mode, action, data);
        });
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            console.log("WS уже подключается/подключен");
            return;
        }

        console.log("Подключение к серверу:", this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log("✅ Соединение установлено");

            // отправляем queued сообщения
            this.flushQueue();

            this.send(new Message()
                .setMode((this.reconnect) ? Data.mode : "connect")
                .setAction((this.reconnect) ? "reconnect" : "handshake")
            );
            this.reconnect = false;

            // 🔄 Запускаем сервис пинга
            this.pingService.start(1000); // каждые 15 секунд

        };

        this.ws.onmessage = (event) => {
            let msg;
            try {
                msg = new Message(JSON.parse(event.data));
                //console.log("📩 Получены данные:", JSON.parse(event.data));
            } catch (err) {
                console.error("Ошибка парсинга данных", event.data, err);
                return;
            }

            if (msg.serverTime) GameServerTime.update(msg.serverTime);

            if (msg.status === 'ok' && msg.token) {
                Data.token = msg.token;
            }

            this.handleMessage(msg);
        };

        this.ws.onerror = (error) => {
            console.error("❌ Ошибка WebSocket:", error && (error.message || error) || error);
        };

        this.ws.onclose = (event) => {
            console.warn("⚠️ Соединение закрыто:", event.code, event.reason);

            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;


            Overlay.Show();
            // Переподключение
            this.reconnectTimeout = setTimeout(() => {
                this.reconnect = true;
                console.log("🔄 Повторное подключение...");
                this.connect();
            }, this.reconnectDelay);
        };

    }

    send(msg) {
        if (!(msg instanceof Message)) {
            msg = new Message(msg);
        }

        if (Data.token) {
            msg.setToken(Data.token);
        }

        if (msg.mode !== "connect" && msg.action !== "ping" && msg.action !== "handshake" && msg.action !== "reconnect")
            console.log("send(msg) ", msg);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (msg.mode !== "connect")
                console.log("📤 Отправка:", msg.toJSON());
            this.ws.send(msg.toString());
        } else {
            if (msg.mode !== "connect")
                console.log("📦 Добавлено в очередь:", msg.toJSON());
            this.messageQueue.push(msg);
        }

    }

    flushQueue() {
        if (this.messageQueue.length > 0) {
            console.log(`🚚 Отправка ${this.messageQueue.length} сообщений из очереди`);
            this.messageQueue.forEach(msg => this.send(msg));
            this.messageQueue = [];
        }
    }

    Submit(mode, action, data) {
        const msg = new Message()
            .setMode(mode)
            .setAction(action);

        $.each(data, (name, value) => {
            msg.setData(name, value);
        });

        this.send(msg);
    }

    handleMessage(msg) {

        // --- SYSTEM RESPONSES (connect namespace) --- //
        if (msg.mode === "connect") {
            switch (msg.action) {
                case "ping":
                    // обновляем пинг и ничего не трогаем с Overlay
                    this.pingService.onPong();
                    return;

                case "handshake":
                    // системный ответ после (re)connect — прячем overlay
                    console.log("Overlay.Hide() on handshake/reconnect");
                    //Overlay.Hide();
                    GameEvents.emit("SendServer", {
                        mode: Data.mode,
                        //action: "list",
                        //data: {}
                    });
                    return;
                case "reconnect":
                    // системный ответ после (re)connect — прячем overlay
                    console.log("Overlay.Hide() on handshake/reconnect");
                    Overlay.Hide();
                    return;
            }
        }

        console.log("handleMessage", msg);

        if (msg.lang) {//} && msg.mode !== "login") {
            console.log("🌍 Установлен язык:", msg.lang);
            Lang.setLang(msg.lang);
        }
        // --- SERVER TIME SYNC --- //
        if (msg.serverTime) {
            try { GameServerTime.update(msg.serverTime); } catch (e) { /* silent */ }
        }

        // --- TOKEN UPDATE (без побочных эффектов) --- //
        if (msg.status === "ok" && msg.token) {
            Data.token = msg.token;
            console.log("🔑 Token обновлён");
        }

        // --- LANG: сервер присылает набор переводов --- //
        // Обрабатываем только реальные ответы от сервера на запрос lang
        if (msg.mode === "lang" && msg.action === "get") {
            // ожидаем, что сервер вернул { lang: "ru", texts: {...} }
            try {
                Lang.setServerLang(msg.lang, msg.getData("texts"));
                console.log("🌍 Загружен языковой файл от сервера:", msg.lang);
            } catch (e) {
                console.error("Ошибка при установке server lang:", e);
            }
            // если мы ждали Overlay по этому действию — спрячем
            //if (this.waitOverlayAction && this.waitOverlayAction === msg.action) {
            //Overlay.Hide();
            //   this.waitOverlayAction = null;
            //}
            return;
        }



        // --- ERROR HANDLING --- //
        if (msg.status === "error") {
            try { Overlay.Hide(); } catch (e) { }
            if (msg.error?.code === "missing_token" || msg.error?.code === "108") {
                console.warn("❌ Ошибка авторизации:", msg.error);
                msg.mode = "login";
            } else {
                Dialog.ErrorLoad(`${msg.error?.code}: ${msg.error?.message}`);
            }
        }



        // --- HIDE OVERLAY LOGIC по ранее сохраненному ожиданию --- //
        /*if (this.waitOverlayAction && msg.action === this.waitOverlayAction) {
            try { Overlay.Hide(); } catch (e) { }
            this.waitOverlayAction = null;
        }*/

        // --- LANGUAGE TAG IN NON-LANG MESSAGES: только подгружаем клиентский файл ---
        // НЕ вызываем LANG_MANAGER.setLang() тут (это может отправлять запрос на сервер и вызывать петлю).
        if (msg.lang && Lang.currentLang !== msg.lang) {
            Lang.setLang(msg.lang);
            console.log("🌍 Изменён язык на:", Lang.currentLang);
        }

        // --- ROUTING TO PAGES (не для системных модов) --- //
        if (msg.mode && msg.action !== "ping" && msg.mode !== "connect" && msg.mode !== "lang") {
            // перед показом страницы мы уже обновили локальный lang (если нужен)
            ShowPage.Show(msg.mode, msg);
            return;
        }

    }


}

let isTouch;
$(document).ready(() => {
    isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    window.Lang = new Proxy(new LangManager(), {
        get(target, prop) {
            if (typeof prop === 'string') {
                // если свойство существует у объекта — вернуть его
                if (prop in target) return target[prop];
                // иначе пробуем вернуть строку из текущего языка
                return target.t(prop);
            }
            return target[prop];
        }
    });


    window.GameEvents = new GameEventsClass();
    window.GameServerTime = new ServerTime();

    window.WS = new WebSocketClass();

    document.addEventListener('mouseup', (e) => {
        if (!Page.$LeftMenu[0].contains(e.target) && !$("#MenuBtn")[0].contains(e.target)) {
            Page.$LeftMenu.removeClass("menu_open");
            $("#MenuBtn").removeClass("menu-open");
            $("#MenuBtn").ToolTip('Показать Меню');
        }
    });

});


