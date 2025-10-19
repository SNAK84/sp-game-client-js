class LangManager {
    constructor(defaultLang = "ru") {
        this.clientLangs = {};  // клиентские файлы
        this.serverLangs = {};  // серверные тексты
        //this.currentLang = '';  // текущий язык
        this.currentLang = sessionStorage.getItem("lang") || this.defaultLang;
    }

    async waitLangServer() {
        while (!this.isServerSet(this.currentLang)) {
            await new Promise(resolve => setTimeout(resolve, 50)); // ждем 50ms
        }
    } 
    async waitLangClient() {
        while (!this.isLoaded(this.currentLang)) {
            await new Promise(resolve => setTimeout(resolve, 50)); // ждем 50ms
        }
    }
    async waitLangs() {
        await this.waitLangServer();
        await this.waitLangClient();
    }

    async loadClientLang(langCode) {
        if (!this.clientLangs[langCode]) {
            try {
                this.currentLang = langCode;
                const url = LangsLink[langCode];
                const response = await fetch(url);
                if (!response.ok) throw new Error("Файл не найден");
                this.clientLangs[langCode] = await response.json();
                
            } catch (e) {
                console.error(`Ошибка загрузки клиентского языка ${langCode}:`, e);
                this.clientLangs[langCode] = {};
            }
        }
        
    }

    async setLang(langCode) {
        await this.loadClientLang(langCode);

        if (!this.isServerSet(langCode)) {
            WS.send(new Message()
                .setMode("lang")
                .setAction("get")
                .setData("lang", langCode)
            );
        }

        this.currentLang = langCode;

        await this.waitLangs();

    }

    setServerLang(langCode, serverTexts) {
        // мержим серверные строки
        this.serverLangs[langCode] = {
            ...(this.serverLangs[langCode] || {}),
            ...serverTexts
        };
    }

    /**
     * Получить строку по ключу
     * Сначала проверяет серверные строки, потом клиентские
     */
    t(key) {
        
        const lang = this.currentLang;
        if (!lang) {
            return key;
        }

        return this.serverLangs[lang]?.[key]
            || this.clientLangs[lang]?.[key]
            || key;
    }

    isLoaded(langCode) {
        return !!this.clientLangs[langCode];
    }

    isServerSet(langCode) {
        return !!this.serverLangs[langCode];
    }
}

// создаём Proxy
const LANG_MANAGER = new Proxy(new LangManager(), {
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

    window.Lang = LANG_MANAGER;
