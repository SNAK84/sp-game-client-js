let GameLayer = null;
window.LANG = null;         // сами строки
window.LANG_CODE = "";      // код языка
window.Mode = "";

$("#gamelayer").hide();
$("#accauntlayer").hide();

setInterval(() => {
    document.dispatchEvent(new Event("GameTick"));
}, 1000);

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
    /*
        // Обработка чекбоксов, чтобы возвращать true/false
        this.find('input[type="checkbox"]').each(function () {
            const exists = arr.find(item => item.name === this.name);
            if (exists) {
                exists.value = this.checked;
            } else {
                arr.push({ name: this.name, value: this.checked });
            }
        });
    */
    return arr;
};

/*
let ShowPage = {
    Page: null,



    Login: function (module, data = null) {
        this.Show("LoginPageClass", module, data);
    },
    OverView: function (module, data) {
        this.Show("OverViewPageClass", module, data);
    },
    Builds: function (module, data) {
        this.Show("BuildsPageClass", module, data);
    },
    Researchs: function (module, data) {
        this.Show("ResearchsPageClass", module, data);
    },
    Shipyard: function (module, data) {
        this.Show("OverViewPageClass", module, data);
    },
    Defense: function (module, data) {
        this.Show("OverViewPageClass", module, data);
    },

    // Вспомогательная функция для управления страницами
    Show: function (pageClassName, module, data = null) {

        // Защита: data может быть null — используем безопасный объект
        const safeData = data ?? {};

        // записываем mode безопасно
        window.Mode = safeData.mode ?? "";

        // Если у нас уже есть страница другого типа — скрываем и сбрасываем
        if (this.Page && this.Page.Name !== pageClassName) {
            try { this.Page.Hide(); } catch (e) { console.warn("Ошибка при Hide():", e); }
            this.Page = null;
        }

        // Загружаем/инициализируем класс страницы
        loadPageClass(pageClassName, (LoadedClass) => {
            if (!LoadedClass) {
                console.error("loadPageClass вернул пустой класс для", pageClassName);
                return;
            }

            if (!this.Page) {
                try {
                    this.Page = new LoadedClass(); // создаём экземпляр класса
                } catch (e) {
                    console.error("Ошибка при создании страницы:", e);
                    return;
                }
                this.Page.Name = pageClassName;

                if (typeof this.Page.Show === "function") {
                    this.Page.Show(module, safeData);
                } else {
                    console.warn("Loaded page has no Show method:", pageClassName);
                }
            } else {
                try {
                    this.Page.Show(module, safeData);
                } catch (e) {
                    console.error("Ошибка при вызове Page.Show:", e);
                }
            }
        });
    },
}
*/

const ShowPage = {
    Page: null,
    pageMap: {
        login: "LoginPageClass",
        overview: "OverViewPageClass",
        over: "OverViewPageClass",
        buildings: "BuildsPageClass",
        researchs: "ResearchsPageClass",
        shipyard: "ShipyardPageClass",
        defense: "DefensePageClass",
    },

    /**
     * Универсальный метод показа страницы.
     * @param {string} module - Имя модуля (mode из сообщения)
     * @param {object|null} data - Данные от сервера
     */
    Show(module, data = null) {
        const safeData = data ?? {};
        window.Mode = safeData.mode ?? module ?? "";

        const pageClassName = this.pageMap[module];
        if (!pageClassName) {
            console.warn("⚠️ Неизвестный модуль:", module);
            return;
        }

        // Если уже открыта другая страница — скрываем
        if (this.Page && this.Page.Name !== pageClassName) {
            try {
                this.Page.Hide?.();
            } catch (e) {
                console.warn("Ошибка при Page.Hide():", e);
            }
            this.Page = null;
        }

        // Загружаем класс страницы асинхронно
        loadPageClass(pageClassName, (LoadedClass) => {
            if (!LoadedClass) {
                console.error("❌ Не удалось загрузить класс страницы:", pageClassName);
                return;
            }

            // Если страницы ещё нет — создаём
            if (!this.Page) {
                try {
                    this.Page = new LoadedClass();
                    this.Page.Name = pageClassName;
                } catch (e) {
                    console.error("Ошибка при создании экземпляра страницы:", e);
                    return;
                }
            }

            // Показываем страницу
            try {
                this.Page.Show?.(module, safeData);
            } catch (e) {
                console.error("Ошибка при вызове Page.Show():", e);
            }
        });
    },
};


// Кэш для уже загруженных классов
const PageClasses = {};

function loadPageClass(globalClassName, callback) {
    if (PageClasses[globalClassName]) {
        callback(PageClasses[globalClassName]);
        return;
    }
    // Если класс уже есть в window (например, PagePassClass)
    if (window[globalClassName]) {
        PageClasses[globalClassName] = window[globalClassName];
        callback(window[globalClassName]);
        return;
    }
    // Загружаем скрипт
    const url = PagesLink[globalClassName];
    if (!url) {
        alert("Нет ссылки для страницы " + globalClassName);
        return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = function () {
        if (window[globalClassName]) {
            PageClasses[globalClassName] = window[globalClassName];
            callback(window[globalClassName]);
        } else {
            alert("Класс " + globalClassName + " не найден после загрузки " + url);
        }
    };
    script.onerror = function () {
        alert("Ошибка загрузки скрипта: " + url);
    };
    document.head.appendChild(script);
}


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
     * @param {HTMLElement} element - Элемент, к которому привязан таймер
     * @param {number} milliseconds - Время таймера в миллисекундах
     * @param {object} options - Настройки таймера
     *      template: шаблон текста с {time} (по умолчанию "{time}")
     *      form: формат отображения (true = читаемый)
     *      ms: показывать миллисекунды
     *      tickInterval: частота обновления в мс
     *      onTick: функция вызова при каждом тикe
     *      onEnd: функция вызова по окончании
     *      formatter: кастомная функция форматирования времени
     */
    constructor(element, milliseconds, options = {}) {
        // Если на элементе уже есть таймер, обновляем настройки
        if (element._timerController instanceof TimerController) {
            const existing = element._timerController;
            existing.updateSettings(milliseconds, options);
            return existing;
        }

        this.element = element;
        this.milliseconds = milliseconds; // Храним время таймера в мс

        // Настройки с умолчаниями
        this.form = options.form ?? true;
        this.ms = options.ms ?? false;
        this.template = options.template || "{time}";
        this.tickInterval = options.tickInterval ?? 1000; // частота обновления
        this.onTick = options.onTick || null;
        this.onEnd = options.onEnd || null;
        this.formatter = options.formatter || null; // кастомное форматирование

        this.endTime = 0; // Время окончания таймера в ms
        this.timer = null; // ID текущего setTimeout

        // Привязываем таймер к элементу, чтобы избежать дублирования
        element._timerController = this;

        // Стартуем таймер
        this.start(this.milliseconds);
    }

    /** 
     * Обновление таймера и настроек, перезапуск
     * @param {number} milliseconds - Новое время таймера
     * @param {object} options - Новые настройки
     */
    updateSettings(milliseconds, options = {}) {
        this.milliseconds = milliseconds ?? this.milliseconds;
        this.updateOptions(options);
        this.restart();
    }

    /**
     * Обновление только опций без изменения оставшегося времени
     * @param {object} options
     */
    updateOptions(options = {}) {
        if (options.form !== undefined) this.form = options.form;
        if (options.ms !== undefined) this.ms = options.ms;
        if (options.template !== undefined) this.template = options.template;
        if (options.tickInterval !== undefined) this.tickInterval = options.tickInterval;
        if (options.onTick !== undefined) this.onTick = options.onTick;
        if (options.onEnd !== undefined) this.onEnd = options.onEnd;
        if (options.formatter !== undefined) this.formatter = options.formatter;

        // Обновляем отображение сразу
        this._updateDisplay();
    }

    /**
     * Запуск таймера с заданным временем
     * @param {number} milliseconds
     */
    start(milliseconds) {
        this.endTime = Date.now() + milliseconds; // вычисляем время окончания
        this.stop(); // очищаем предыдущий таймер
        this._tick(); // запускаем тик
    }

    /** Остановка текущего таймера */
    stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    /** Перезапуск таймера с текущим оставшимся временем */
    restart() {
        const remaining = this.getRemainingMilliseconds();
        this.start(remaining);
    }

    /** Сброс таймера на новое время и запуск */
    reset(milliseconds) {
        this.milliseconds = milliseconds;
        this.start(this.milliseconds);
    }

    /** Получение оставшегося времени в миллисекундах */
    getRemainingMilliseconds() {
        return Math.max(0, this.endTime - Date.now());
    }

    /** Внутренний метод — один тик таймера */
    _tick = () => {
        const remainingMs = this.getRemainingMilliseconds();

        // Обновляем отображение
        this._updateDisplay();

        // Вызов callback на каждый тик
        if (this.onTick) this.onTick(remainingMs, this.element);

        // Если таймер закончился
        if (remainingMs <= 0) {
            if (this.onEnd) this.onEnd(this.element);
            return; // прекращаем дальнейшие тики
        }

        // Планируем следующий тик
        this.timer = setTimeout(this._tick, this.tickInterval);
    }

    /** Обновление текста/значения элемента согласно шаблону и формату */
    _updateDisplay() {
        const remainingMs = this.getRemainingMilliseconds();
        const remainingSec = remainingMs / 1000; // конвертируем в секунды для secondToTime

        let timeStr = this.formatter
            ? this.formatter(remainingSec)
            : secondToTime(remainingSec, this.form, this.ms);

        const output = this.template.replace("{time}", timeStr);

        // В зависимости от типа элемента выводим текст или value
        if (this.element.tagName === "INPUT" || this.element.tagName === "BUTTON") {
            this.element.value = output;
        } else {
            this.element.textContent = output;
        }
    }
}

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

window.GameServerTime = new ServerTime();

class GameBuild extends HTMLElement {


    _data = null;

    _type = "builds";
    _images = "builds";
    created = false;

    queues = false;

    EventActive = false;
    _boundRender = null;

    constructor() {
        super();
        //this.attachShadow({ mode: "open" }); // изоляция стилей
    }

    set images(images) {
        this._images = images;
    }
    get images() {
        return this._images;
    }

    set type(elementType) {
        this._type = elementType;
    }
    get type() {
        return this._type;
    }

    set data(buildData) {
        this._data = buildData;
        this.render();
    }

    get data() {
        return this._data;
    }


    // Универсальная функция для создания элемента с классом и текстом
    createElement(tag, className = "", text = "") {
        return $("<" + tag + ">").addClass(className).text(text);
    }

    // Создаем таблицу ресурсов
    createResourceTable(resources, tableElement, itemsStorage) {
        $.each(resources, (res, value) => {
            itemsStorage[res] = this.createElement("div", `ResBox icon${res}`).attr("id", "Res_" + res);
            tableElement.append(itemsStorage[res]);
        });
    }

    // Обновляем таблицу ресурсов
    updateResourceTable(resources, itemsStorage, conditionFn, production = false) {
        let $result = true;
        $.each(resources, (res, value) => {
            const el = itemsStorage[res];
            if (!el) return;
            el.text(humanNumber(value, true, 2));
            if (production) {
                el.toggleClass("lime_text", value > 0).toggleClass("red_text", value <= 0);
            } else {
                if (!conditionFn(value, res)) $result = false;
                el.toggleClass("lime_text", conditionFn(value, res)).toggleClass("red_text", !conditionFn(value, res));
            }
        });
        return $result;
    }

    createTooltip({ headText, nameText, levelNum, timeNum, timeLabel, priceResources, prod, isDismantle = false }) {
        const tooltip = this.createElement("div", this._type);

        // Время с контейнером
        const timeContainer = this.createElement("div", "timeBuild", timeLabel + ": ");
        timeContainer.append(timeNum);

        tooltip.append(
            this.createElement("div", "head yellow_text", headText),
            this.createElement("div", "tooltip-empty"),
            this.createElement("div", "name orange_text", nameText),
            this.createElement("div", "level", Lang.build.level + ": ").append(levelNum),
            this.createElement("div", "tooltip-empty"),
            this.createElement("div", "tooltip-empty"),
            this.createElement("div", "description", Lang.longDescription[this._data.id])
        );

        if (prod && prod.resources) {
            tooltip.append(this.createElement("div", "tooltip-empty"),
                this.createElement("div", "priceBuild", prod.title),
                prod.table);
            //this.createResourceTable(prod.resources, prod.table, prod.items);
        }

        tooltip.append(
            this.createElement("div", "tooltip-empty"),
            timeContainer,
            this.createElement("div", "tooltip-empty"),
            this.createElement("div", "priceBuild", isDismantle ? Lang.build.priceDestroy : (this._data.level > 0 ? Lang.build.priceUpgrade : Lang.build.priceBuild)),
            priceResources
        );

        return tooltip;
    }

    create() {
        if (this._type === 'queues') this.queues = true;

        this.Image = this.createElement("div", "image")
            .css({
                'background': `url("/images/${this._images}/${this._data.name}.gif") no-repeat`,
                'background-size': 'contain'
            });

        this.Header = {
            container: this.createElement("div", "head"),
            Name: this.createElement("div", "name", Lang.tech?.[this._data.id] || this._data.name),
            Level: this.createElement("div", "level"),
            Number: this.createElement("span", "LevelNumber")
        };

        this.Header.Level.append(this.Header.Number).prepend(Lang.build.level + ": ");
        this.Header.container.append(this.Header.Name, this.Header.Level);

        if (this._type === 'queues') {
            this.Header.Label = this.createElement("div", "label").text(
                (this._images == 'builds') ?
                    ((this._data.action === 'build') ? Lang.queues.building : Lang.queues.destruction) :
                    Lang.queues.research

            );
            this.Header.Name.addClass("yellow_text");

            this.Header.LastTime = this.createElement("div", "LastTime");
            this.Header.LastTimeText = this.createElement("span", "LastTimeText").text(Lang.build.timeBuild + ": ");
            this.Header.LastTimeNumber = this.createElement("span", "LastTimeNumber");
            this.Header.LastTime.append(this.Header.LastTimeNumber).prepend(this.Header.LastTimeText);


            this.Header.EndTime = this.createElement("div", "EndTime");
            this.Header.EndTimeText = this.createElement("span", "EndTimeText").text(Lang.queues.endsIn + " ");
            this.Header.EndTimeNumber = this.createElement("span", "EndTimeNumber");
            this.Header.EndTime.append(this.Header.EndTimeText, this.Header.EndTimeNumber);
            this.Header.container.prepend(this.Header.Label).append(this.Header.LastTime);
            if (this._images == 'techs') {
                this.Header.container.prepend(this.Header.Label).append(
                    this.createElement("div", "Planet", this._data.planet.name + " [" + this._data.planet.galaxy + ":" + this._data.planet.system + "]")
                );

            } else {
                this.Header.container.prepend(this.Header.Label).append(
                    this.createElement("div")
                );

            }

            this.Header.container.prepend(this.Header.Label).append(this.Header.EndTime);

            this.Header.Progress = $("<div>", { class: "tooltip-progress" }).hide();
            this.Header.ProgressBar = $("<div>", { class: `tooltip-progress-bar lime` }).css("width", "0%");
            this.Header.Progress.append(this.Header.ProgressBar);
            this.Header.container.append(this.Header.Progress);

            this.Buttons = { Cancel: this.createElement("div", "btn-box btn-box-cancel") };
            this.ToolTipCancel = this.createElement("div");
            this.ToolTipCancel.append(this.createElement("span", "", Lang.interrupt));

            this.ToolTipCancel.Progress = this.createElement("div", "ProgressCancel").hide();
            this.ToolTipCancel.Progress.Text = this.createElement("span", "ProgressCancel", Lang.queues.willBeReturned + " ");
            this.ToolTipCancel.Progress.Text.append(
                this.ToolTipCancel.ProgressNum = this.createElement("span", "ProgressCancelNum lime_text"),
                this.createElement("span", "lime_text", "%"),
                " " + Lang.queues.resourcesSpent
            ).addClass("yellow_text");

            this.ToolTipCancel.Progress.append(this.createElement("div", "tooltip-empty"), this.ToolTipCancel.Progress.Text);
            this.ToolTipCancel.append(this.ToolTipCancel.Progress);

            this.Buttons.Cancel.ToolTip(this.ToolTipCancel);
            $(this).append(this.Buttons.Cancel);

            this.Buttons.Cancel.off("click").on("click", () => {
                GameEvents.emit("BuildAction", {
                    action: "cancel",
                    id: this._data.qid
                });
            });
        }

        if (this._type !== 'queues') {
            this.Buttons = {
                Up: this.createElement("div", "btn-box btn-box-up"),
                Down: this.createElement("div", "btn-box btn-box-down"),
                Info: this.createElement("div", "btn-box btn-box-info")
            };

            this.ToolTip = {
                levelBuildNum: this.createElement("span", "levelNum lime_text"),
                levelDismantleNum: this.createElement("span", "levelNum lime_text"),
                timeBuildNum: this.createElement("span", "timeBuildNum lime_text"),
                timeDismantleNum: this.createElement("span", "timeBuildNum lime_text"),
                priceBuildTable: this.createElement("div", "priceBuildTable"),
                priceBuildTableItems: {},
                priceDismantleTable: this.createElement("div", "priceBuildTable"),
                priceDismantleTableItems: {},
                ProdNextTable: this.createElement("div", "priceBuildTable"),
                ProdNextTableItems: {},
                ProdPreviousTable: this.createElement("div", "priceBuildTable"),
                ProdPreviousTableItems: {}
            };

            this.createResourceTable(this._data.costResources, this.ToolTip.priceBuildTable, this.ToolTip.priceBuildTableItems);
            this.createResourceTable(this._data.destroyResources, this.ToolTip.priceDismantleTable, this.ToolTip.priceDismantleTableItems);

            if (this._data.Prod?.Next) this.createResourceTable(this._data.Prod.Next, this.ToolTip.ProdNextTable, this.ToolTip.ProdNextTableItems);
            if (this._data.Prod?.Previous) this.createResourceTable(this._data.Prod.Previous, this.ToolTip.ProdPreviousTable, this.ToolTip.ProdPreviousTableItems);

            this.ToolTipBuild = this.createElement("div", "ToolTipBuildBuild");

            this.ToolTipBuild.MaxLevel = this.createElement("div", "ToolTipBuildMaxLevel red_text", Lang.build.maxLevel).hide();
            this.ToolTipBuild.QueueFull = this.createElement("div", "ToolTipBuildQueueFull red_text").hide()
                .append(
                    this.createElement("div", "", Lang.queues.full),
                    this.createElement("div", "tooltip-empty")
                );

            this.ToolTipBuild.IsBusy = this.createElement("div", "ToolTipBuildIsBusy red_text").hide()
                .append(
                    this.createElement("div", "", (this._images == 'builds') ? Lang.build.IsBusyReseach :Lang.build.IsBuildReseach),
                    this.createElement("div", "tooltip-empty")
                );

            this.ToolTipBuild.Build = this.createTooltip({
                headText: this._data.level > 0 ? Lang.build.upgrade : Lang.build.build,
                nameText: Lang.tech?.[this._data.id] || this._data.name,
                levelNum: this.ToolTip.levelBuildNum,
                timeNum: this.ToolTip.timeBuildNum,
                timeLabel: Lang.build.timeBuild,
                priceResources: this.ToolTip.priceBuildTable,
                prod: { title: Lang.build.productionIncrease, table: this.ToolTip.ProdNextTable, items: this.ToolTip.ProdNextTableItems, resources: this._data.Prod?.Next }
            }).hide();



            this.ToolTipBuild.append(this.ToolTipBuild.IsBusy, this.ToolTipBuild.QueueFull, this.ToolTipBuild.Build, this.ToolTipBuild.MaxLevel);
            //this.ToolTipBuild.prepend(this.ToolTip.maxLevel);

            this.ToolTipDismantle = this.createElement("div", "ToolTipDismantle");

            this.ToolTipDismantle.Build = this.createTooltip({
                headText: Lang.build.dismantle,
                nameText: Lang.tech?.[this._data.id] || this._data.name,
                levelNum: this.ToolTip.levelDismantleNum,
                timeNum: this.ToolTip.timeDismantleNum,
                timeLabel: Lang.build.timeDestroy,
                priceResources: this.ToolTip.priceDismantleTable,
                prod: { title: Lang.build.productionDecrease, table: this.ToolTip.ProdPreviousTable, items: this.ToolTip.ProdPreviousTableItems, resources: this._data.Prod?.Previous },
                isDismantle: true
            });

            this.ToolTipDismantle.QueueFull = $(this.ToolTipBuild.QueueFull[0].cloneNode(true)).hide();
            this.ToolTipDismantle.IsBusy = $(this.ToolTipBuild.IsBusy[0].cloneNode(true)).hide();

            this.ToolTipDismantle.append(this.ToolTipDismantle.IsBusy, this.ToolTipDismantle.QueueFull, this.ToolTipDismantle.Build);

            this.ToolTipInfo = this.createElement("div", this._type);
            this.ToolTipInfo.append(this.createElement("div", "head yellow_text", Lang.fcm_info));

            if (this._data.requirements && Object.keys(this._data.requirements).length > 0) {
                this.ToolTip.requirements = this.createElement("div", "requirements", Lang.build.requirements + ":");
                this.ToolTip.requirementsTable = this.createElement("div", "requirementsTable");
                this.ToolTip.requirementsTableItems = {};

                $.each(this._data.requirements, (id, value) => {
                    const row = this.createElement("div");
                    row.append(
                        this.createElement("span", "", Lang.tech?.[id] || value.name),
                        this.createElement("span", "", ` ${value.own} ${Lang.from} ${value.count}`)
                    );
                    this.ToolTip.requirementsTableItems[id] = row;
                    this.ToolTip.requirementsTable.append(row);
                });

                this.ToolTipInfo.append(this.createElement("div", "tooltip-empty"), this.ToolTip.requirements, this.ToolTip.requirementsTable);
            }

            this.Buttons.Up.ToolTip(this.ToolTipBuild, { 'max-width': '350px' });
            this.Buttons.Down.ToolTip(this.ToolTipDismantle, { 'max-width': '350px' });
            this.Buttons.Info.ToolTip(this.ToolTipInfo, { 'max-width': '350px' });

            this.Buttons.Up.off("click").on("click", () => {
                if (!this._data.accessible) return;
                GameEvents.emit("BuildAction", { action: "upgrade", id: this._data.id });
            });

            this.Buttons.Down.off("click").on("click", () => {
                if (this._data.level <= 0) return;
                GameEvents.emit("BuildAction", { action: "dismantle", id: this._data.id });
            });

            this.Buttons.Info.off("click").on("click", () => {
                GameEvents.emit("BuildAction", { action: "info", id: this._data.id });
            });

            $(this).append(this.Buttons.Up, this.Buttons.Down, this.Buttons.Info)
        }

        this.Image.ToolTip(Lang.shortDescription[this._data.id], { 'max-width': '250px' });
        $(this).append(this.Header.container, this.Image);

        this.created = true;
    }

    render() {
        if (!this._data) return;
        if (!this.created) this.create();

        $(this).removeClass().addClass(this._type);
        this.Header.Number.text(this._data.level);

        if (this._type === 'queues') {
            $(this).toggleClass("active", this._data.status == "active");
            $(this).toggleClass("queued", this._data.status == "queued");

            let remaining = 0;

            if (this._data.status == "active") {
                this.Header.Progress.show();

                const now = GameServerTime.now();
                const totalTime = this._data.end_time - this._data.start_time;
                const elapsed = Math.max(0, now - this._data.start_time); // не меньше 0

                let progress = 0;
                if (totalTime > 0) {
                    progress = Math.round((elapsed / totalTime) * 100);
                    progress = Math.min(progress, 100); // не больше 100%
                }

                this.Header.ProgressBar.css("width", progress + "%");


                this.ToolTipCancel.Progress.show();
                this.ToolTipCancel.ProgressNum.text(100 - progress);

                remaining = Math.max(0, Math.round(this._data.end_time - GameServerTime.now()));

            } else {
                this.ToolTipCancel.Progress.hide();
                this.Header.Progress.hide();
                remaining = Math.max(0, Math.round(this._data.end_time - this._data.start_time));
            }

            this.Header.LastTimeNumber.text(secondToTime(remaining));
            this.Header.EndTimeNumber.text(formatTimestamp(this._data.end_time, 'timedate'));
        } else {
            this.ToolTip.levelBuildNum.text(this._data.levelToBuild + 1);
            this.ToolTip.timeBuildNum.text(secondToTime(this._data.elementTime, true, this._data.elementTime < 10));
            this.ToolTip.levelDismantleNum.text(this._data.levelToBuild);
            this.ToolTip.timeDismantleNum.text(secondToTime(this._data.destroyTime, true, this._data.destroyTime < 10));

            const $resBul = this.updateResourceTable(this._data.costResources, this.ToolTip.priceBuildTableItems, (v, res) => GameLayer.Resources[res]?.count >= v);
            const $resDest = this.updateResourceTable(this._data.destroyResources, this.ToolTip.priceDismantleTableItems, (v, res) => GameLayer.Resources[res]?.count >= v);

            // Update production
            if (this._data.Prod?.Next) this.updateResourceTable(this._data.Prod.Next, this.ToolTip.ProdNextTableItems, null, true);
            if (this._data.Prod?.Previous) this.updateResourceTable(this._data.Prod.Previous, this.ToolTip.ProdPreviousTableItems, null, true);

            this.Buttons.Down.toggle(this._data.level > 0 && this._images == 'builds');
            this.Buttons.Up.toggle(this._data.accessible);

            this.Buttons.Up.Dis = false;
            this.Buttons.Down.Dis = false;

            if (this._data.CountQueue >= this._data.MaxQueue || this._data.working) {
                this.Buttons.Up.Dis = true;
                this.Buttons.Down.Dis = true;
            }

            if (!$resBul && !this._data.CountQueue) this.Buttons.Up.Dis = true;
            if (!$resDest && !this._data.CountQueue) this.Buttons.Down.Dis = true;
            if (this._data.levelToBuild >= this._data.maxLevel) this.Buttons.Up.Dis = true;

            this.ToolTipBuild.Build.toggle(!(this._data.levelToBuild >= this._data.maxLevel));
            this.ToolTipBuild.MaxLevel.toggle((this._data.levelToBuild >= this._data.maxLevel));
            this.ToolTipBuild.QueueFull.toggle(this._data.CountQueue >= this._data.MaxQueue);
            this.ToolTipBuild.IsBusy.toggle(this._data.working);

            this.ToolTipDismantle.QueueFull.toggle(this._data.CountQueue >= this._data.MaxQueue);
            this.ToolTipDismantle.IsBusy.toggle(this._data.working);


            this.Buttons.Up.attr('disabled', this.Buttons.Up.Dis);
            this.Buttons.Down.attr('disabled', this.Buttons.Down.Dis);

            if (this._data.requirements && this.ToolTip?.requirementsTableItems) {
                $.each(this._data.requirements, (id, value) => {
                    if (!this.ToolTip?.requirementsTableItems[id]) return;
                    const row = this.ToolTip?.requirementsTableItems[id];
                    if (!row) return;

                    // Обновляем текст
                    const spans = row.children("span");
                    spans.eq(0).text(Lang.tech?.[id] || value.name);           // название
                    spans.eq(1).text(` ${value.own} из ${value.count}`);      // уровень / количество

                    // Цвет: lime если достаточно, orange если не хватает
                    row.toggleClass("lime_text", value.own >= value.count)
                        .toggleClass("orange_text", value.own < value.count);
                });
            }
        }




        if (!this._data.accessible) {
            if (this._type !== 'queues') $(this).addClass("disabled");
        } else {
            $(this).removeClass("disabled");
        }
    }

    connectedCallback() {
        this.render();

        if (!this.EventActive) {
            this.EventActive = true;
            // сохраняем связанный метод для правильного удаления
            this._boundRender = this.render.bind(this);
            document.addEventListener("GameTick", this._boundRender);
        }
    }

    disconnectedCallback() {
        this.Buttons.Up?.off("click");
        this.Buttons.Down?.off("click");
        this.Buttons.Info?.off("click");
        this.Buttons.Cancel?.off("click");
        if (this.EventActive && this._boundRender) {
            document.removeEventListener("GameTick", this._boundRender);
            this.EventActive = false;
        }
    }
}

customElements.define("game-build", GameBuild);

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

class GameEventsClassJS extends EventTarget {
    constructor() {
        super();
        this._listeners = new Map(); // name => Set(callback)
    }

    emit(name, detail = {}) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
        return this;
    }

    on(name, callback, options) {
        this.addEventListener(name, callback, options);
        if (!this._listeners.has(name)) this._listeners.set(name, new Set());
        this._listeners.get(name).add(callback);
        return this;
    }

    off(name, callback = undefined, options) {
        if (callback) {
            this.removeEventListener(name, callback, options);
            const set = this._listeners.get(name);
            if (set) {
                set.delete(callback);
                if (set.size === 0) this._listeners.delete(name);
            }
        } else {
            // убрать всех слушателей для имени
            const set = this._listeners.get(name);
            if (set) {
                for (const cb of set) {
                    this.removeEventListener(name, cb, options);
                }
                this._listeners.delete(name);
            }
        }
        return this;
    }

    // Утилиты для отладки
    listeners(name) {
        return Array.from(this._listeners.get(name) || []);
    }
}


// создаем глобальный объект
window.GameEvents = new GameEventsClass();