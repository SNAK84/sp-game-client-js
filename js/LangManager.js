class LangManager {
    constructor(defaultLang = "ru") {
        this.clientLangs = {};  // клиентские файлы
        this.serverLangs = {};  // серверные тексты
        //this.currentLang = '';  // текущий язык
        this.currentLang = sessionStorage.getItem("lang") || this.defaultLang;

        // промисы для ожидания загрузки языков
        this.serverPromises = {};
        this.clientPromises = {};
    }

    async waitLangServer(lang = this.currentLang) {
        if (this.isServerSet(lang)) return;
        if (!this.serverPromises[lang]) {
            // создаём промис, который будет резолвиться при получении серверного языка
            this.serverPromises[lang] = new Promise(resolve => {
                const check = () => {
                    if (this.isServerSet(lang)) resolve();
                    else setTimeout(check, 50);
                };
                check();
            });
        }
        return this.serverPromises[lang];
    }

    async waitLangClient(lang = this.currentLang) {
        if (this.isLoaded(lang)) return;
        if (!this.clientPromises[lang]) {
            this.clientPromises[lang] = new Promise(resolve => {
                const check = () => {
                    if (this.isLoaded(lang)) resolve();
                    else setTimeout(check, 50);
                };
                check();
            });
        }
        return this.clientPromises[lang];
    }

    async waitLangs(lang = this.currentLang) {
        await Promise.all([this.waitLangClient(lang), this.waitLangServer(lang)]);
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

        //this.clientPromises[langCode]?.();
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

        const getByPath = (obj, path) =>
            path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);

        return getByPath(this.serverLangs[lang], key)
            || getByPath(this.clientLangs[lang], key)
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


