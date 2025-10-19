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

        // Настройка режима хранения токена: 'none' | 'session' | 'local'
        this.tokenStorageMode = (window && window.TOKEN_STORAGE_MODE) || 'session';
        this.tokenStorageKey = 'sp_token';

        // Восстановление токена из выбранного хранилища
        const storage = this._getStorage();
        if (storage) {
            try {
                const saved = storage.getItem(this.tokenStorageKey);
                if (saved) {
                    this.token = saved;
                }
            } catch (e) {
                // игнорируем ошибки доступа к storage
            }
        }

        // ✅ Создаём сервис пинга
        this.pingService = new PingService(this);
        this.pingService.onUpdate((ping, avg) => {
            //console.log(`%c📡 Ping: ${ping} ms (avg ${avg} ms)`, "color: limegreen");
            $("#ping-indicator").text(`📡${ping} ms (${avg} ms)`);

            // UI.updatePing(ping, avg); // можно отрисовать в интерфейсе
        });

        this.connect();

        GameEvents.on("SendServer", (e) => {
            const { mode, action, hide, data } = e.detail;
            // Показываем Overlay, если это не ping/handshake/reconnect
            if (mode !== "connect" && action !== "ping" && action !== "handshake" && action !== "reconnect") {
                Overlay.Show(null, 250, () => this.Submit(mode, action, data));
                this.waitOverlayAction = hide || action; // запоминаем, при каком action нужно будет скрыть
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
                .setMode((this.reconnect) ? Mode : "connect")
                .setAction((this.reconnect) ? "reconnect" : "handshake")
                .setData("info", "init")
            );
            this.reconnect = false;

            // 🔄 Запускаем сервис пинга
            this.pingService.start(1000); // каждые 15 секунд

            /*this.heartbeatInterval = setInterval(() => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.sendPing = new Date();
                    this.send(new Message()
                        .setMode("connect")
                        .setAction("ping")
                    );
                }
            }, 30000);*/
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

            if (msg.status === 'ok' && msg.getData('token')) {
                this.token = msg.getData('token');
                // Сохраняем токен в выбранное хранилище
                const storage = this._getStorage();
                if (storage) {
                    try { storage.setItem(this.tokenStorageKey, this.token); } catch (e) { }
                }
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

        if (this.token) {
            msg.setToken(this.token);
        }

        //console.log("send(msg) token", this.token);

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
                case "reconnect":
                    // системный ответ после (re)connect — прячем overlay
                    console.log("Overlay.Hide() on handshake/reconnect");
                    Overlay.Hide();
                    return;
            }
        }

        console.log("handleMessage", msg);

        // --- SERVER TIME SYNC --- //
        if (msg.serverTime) {
            try { GameServerTime.update(msg.serverTime); } catch (e) { /* silent */ }
        }

        // --- TOKEN UPDATE (без побочных эффектов) --- //
        if (msg.status === "ok" && msg.token) {
            this.token = msg.token;
            const storage = this._getStorage();
            if (storage) {
                try { storage.setItem(this.tokenStorageKey, this.token); } catch (e) { }
            }
            console.log("🔑 Token обновлён");
        }

        // --- LANG: сервер присылает набор переводов --- //
        // Обрабатываем только реальные ответы от сервера на запрос lang
        if (msg.mode === "lang" && msg.action === "get") {
            // ожидаем, что сервер вернул { lang: "ru", texts: {...} }
            try {
                LANG_MANAGER.setServerLang(msg.lang, msg.getData("texts"));
                console.log("🌍 Загружен языковой файл от сервера:", msg.lang);
            } catch (e) {
                console.error("Ошибка при установке server lang:", e);
            }
            // если мы ждали Overlay по этому действию — спрячем
            if (this.waitOverlayAction && this.waitOverlayAction === msg.action) {
                Overlay.Hide();
                this.waitOverlayAction = null;
            }
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
        if (this.waitOverlayAction && msg.action === this.waitOverlayAction) {
            try { Overlay.Hide(); } catch (e) { }
            this.waitOverlayAction = null;
        }

        // --- LANGUAGE TAG IN NON-LANG MESSAGES: только подгружаем клиентский файл ---
        // НЕ вызываем LANG_MANAGER.setLang() тут (это может отправлять запрос на сервер и вызывать петлю).
        if (msg.lang && LANG_MANAGER.currentLang !== msg.lang) {
            LANG_MANAGER.currentLang = msg.lang;
            // подгружаем клиентский файл (не блокируем основной поток)
            LANG_MANAGER.loadClientLang(msg.lang).catch(err => {
                console.warn("Не удалось загрузить клиентский язык:", err);
            });
        }

        // --- ROUTING TO PAGES (не для системных модов) --- //
        if (msg.mode && msg.action !== "ping" && msg.mode !== "connect" && msg.mode !== "lang" && msg.mode !== "GetContent") {
            // перед показом страницы мы уже обновили локальный lang (если нужен)
            if (!GameLayer) GameLayer = new GameLayerClass();
            GameLayer.RenderLeftMenu(msg.mode);
            
            ShowPage.Show(msg.mode, msg);
            return;
        }

    }

    // Вспомогательное: выбрать хранилище по режиму
    _getStorage() {
        if (this.tokenStorageMode === 'local') return window?.localStorage || null;
        if (this.tokenStorageMode === 'session') return window?.sessionStorage || null;
        return null; // 'none'
    }
}

const WS = new WebSocketClass();