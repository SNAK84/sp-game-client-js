window.LoginPageClass = class LoginPageClass extends BasePageClass {

    Name = "LoginPageClass";
    hasMainData = false;

    CurrentForm = null;

    LoginForm = null;
    PasswordForm = null;
    RegisterForm = null;
    VerifyEmailForm = null;



    LoginValid = false;
    PassValid = false;
    MailValid = false;

    FieldsForm = {
        login: [
            {
                label: "Добро пожаловать",
                type: "label"
            },
            {
                label: "Логин",
                name: "login",
                onInput: (event) => this.isLoginValid(event.target)
            },
            {
                label: "Пароль",
                name: "password",
                onInput: (event) => this.isPassValid(event.target, false)
            },
            {
                value: "Войти",
                name: "submit",
                type: "submit"
            },
            {
                label: "",
                value: "Регистрация",
                name: "register",
                type: "button",
                onInput: (event) => this.Show("register")
            },
            {
                label: "",
                value: "Восстановление Пароля",
                name: "repassword",
                type: "button",
            },
        ],
        register: [
            {
                label: "Регистрация",
                type: "label"
            }, {
                label: "Логин",
                name: "login",
                onInput: (event) => this.isLoginValid(event.target)
            }, {
                label: "Пароль",
                name: "password",
                onInput: (event) => this.isPassValid(event.target, true)
            }, {
                label: "E-Mail",
                name: "email",
                onInput: (event) => this.isEMailValid(event.target)
            }, {
                value: "Регистрация",
                name: "submit",
                type: "submit"
            }, {
                label: "",
                value: "Отмена",
                name: "cancel",
                type: "button",
                onInput: (event) => this.Show("login")
            }

        ],
        verify_email: [
            {
                label: "Введите пин код из письма",
                name: "head",
                type: "label"
            },
            {
                type: "pin",
                name: "PinCode",
                //onInput: (event) => this.isLoginValid(event.target)
            }, {
                value: "Подтвердить",
                name: "submit",
                type: "submit"
            }, {
                label: "",
                value: "Отправить код",
                name: "SendPIN",
                type: "button",
                timer: {
                    time: (this.CoolDownEmail * 1000),
                    template: "Отправить код через {time}",
                    onEnd: (element) => element.disabled = false
                },
                onInput: (event) => {
                    Overlay.Show(null, 250, () => {
                        WS.Submit("login", "send_verify_email");
                    });
                }
            }, {
                label: "",
                value: "Отмена",
                name: "cancel",
                type: "button",
                onInput: (event) => this.Show("login")
            }

        ],

        password: [
            {
                label: "Придумайте новый пароль",
                type: "label"
            },
            {
                label: "Новый пароль",
                name: "password",
                onInput: (event) => this.isPassValid(event.target, true)
            },
            {
                value: "Сменить пароль",
                name: "submit",
                type: "submit"
            },
            {
                value: "change",
                name: "auth",
                type: "hidden",
            }
        ]
    };

    constructor() {
        super();

        this.$Layer.toggleClass("accauntlayer", true);
        this.$Layer.toggleClass("gamelayer", false);
    }

    CreateLoginForm() {
        if (this.LoginForm) {
            console.log("return LoginForm");
            return this.LoginForm;
        }
        this.LoginForm = $("#LoginForm");

        if (this.LoginForm.length === 0) {

            console.log("Create LoginForm");

            this.LoginForm = this.createForm(this.FieldsForm.login, "LoginForm", "login", "login");
            this.LoginForm.addClass("box").hide();
            this.$Layer.append(this.LoginForm);
        } else {
            console.log("render LoginForm");
            this.renderForm(this.LoginForm, this.FieldsForm.login);
        }

        return this.LoginForm;
    }

    CreateRegisterForm() {
        if (this.RegisterForm) {
            console.log("return RegisterForm");
            return this.RegisterForm;
        }


        this.RegisterForm = $("#RegisterForm");
        if (this.RegisterForm.length === 0) {
            console.log("Create RegisterForm");

            this.RegisterForm = this.createForm(this.FieldsForm.register, "RegisterForm", "login", "register");
            this.RegisterForm.addClass("box").hide();

            this.$Layer.append(this.RegisterForm);
        } else {
            console.log("render RegisterForm");
            this.renderForm(this.RegisterForm, this.FieldsForm.register);
        }

        this.isFormValid();
        return this.RegisterForm;
    }

    CreateVerifyEmailForm() {

        if (this.VerifyEmailForm) {
            this.CoolDownEmail = this.messageData?.getData?.("cooldown") ?? 60;
            this.FieldsForm.verify_email[3].timer.time = this.CoolDownEmail * 1000;
            this.renderForm(this.VerifyEmailForm, this.FieldsForm.verify_email);
            return this.VerifyEmailForm;
        }

        this.VerifyEmailForm = $("#VerifyEmailForm");
        if (this.VerifyEmailForm.length === 0) {

            this.FieldsForm.verify_email[3].timer.time = this.CoolDownEmail * 1000;

            this.VerifyEmailForm = this.createForm(this.FieldsForm.verify_email, "VerifyEmailForm", "login", "verify_email");
            this.VerifyEmailForm.addClass("box").hide();
            this.$Layer.append(this.VerifyEmailForm);
        } else {
            this.CoolDownEmail = this.messageData?.getData?.("cooldown") ?? 60;
            this.FieldsForm.verify_email[3].timer.time = this.CoolDownEmail * 1000;
            this.renderForm(this.VerifyEmailForm, this.FieldsForm.verify_email);
        }

        return this.VerifyEmailForm;
    }

    CreatePasswordForm() {
        if (this.PasswordForm) return this.PasswordForm;
        console.log('LoginPageClass CreatePasswordForm');

        this.PasswordForm = this.createForm(mergeUrlParams(this.urls[0]), this.FieldsForm.password, "PasswordForm");
        this.PasswordForm.addClass("box").hide();
        this.$Layer.append(this.PasswordForm);
        return this.PasswordForm;
    }

    RenderData(module) {

        console.log("RenderData " + module);
        // скрываем текущую форму
        if (this.CurrentForm) $(this.CurrentForm).hide(200);

        switch (module) {
            case "loginok":
                this.GotoGame();
                break;

            case "register":
                this.CurrentForm = this.CreateRegisterForm();
                this.CurrentForm.show(300);
                break;

            case "verify_email":
                this.CoolDownEmail = this.messageData?.getData?.("cooldown") ?? 60;
                this.FieldsForm.verify_email[3].timer.time = this.CoolDownEmail * 1000;
                this.CurrentForm = this.CreateVerifyEmailForm();
                $(this.CurrentForm).show(300);
                break;

            case "send_verify_email":
                this.CoolDownEmail = this.messageData?.getData?.("cooldown") ?? 60;
                this.FieldsForm.verify_email[3].timer.time = this.CoolDownEmail * 1000;
                this.renderForm(this.VerifyEmailForm, this.FieldsForm.verify_email);
                break;

            default:
                this.CurrentForm = this.CreateLoginForm();
                $(this.CurrentForm).show(300);
                break;
        }

        this.isFormValid();
        //}
    }

    // Проверка валидности логина
    isLoginValid(loginInput) {
        const $input = $(loginInput);
        const value = $input.val();

        this.LoginValid = value.length > 3;

        this.updateInputClass($input, this.LoginValid);
        this.isFormValid();

        return this.LoginValid;
    }

    // Проверка валидности пароля
    isPassValid(passInput, isChangePassword = false) {
        const $input = $(passInput);
        if (!$input.length) return false;

        const password = $input.val();
        let isValid = false;

        // Используем статическую функцию для проверки пароля
        if (isChangePassword) {
            // Статическая проверка пароля (должна вернуть { isValid: boolean, message: string })
            const validation = this.validatePassword(password);
            isValid = validation.isValid;

            // Подсказка о требованиях к паролю
            const $hint = $input.closest('.input-wrapper').next('.password-hint');
            this.updatePasswordHint($hint, validation);
        } else {
            isValid = password.length > 5;
        }

        this.PassValid = isValid;

        // Обновляем классы поля
        this.updateInputClass($input, isValid);

        this.isFormValid();



        return this.PassValid;
    }

    isEMailValid(mailInput) {
        const $input = $(mailInput);
        const value = $input.val();

        //var reg = new RegExp("[0-9a-z_]+@[0-9a-z_^.]+\\.[a-z]", 'i');
        const reg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

        this.MailValid = reg.test(value);

        this.updateInputClass($input, this.MailValid);
        this.isFormValid();

        return this.MailValid;
    }
    // Обновление подсказки о требованиях к паролю
    updatePasswordHint($hint, requirements) {
        if (!$hint || !$hint.length) return;

        const requirementsList = [
            { condition: requirements.hasMinLength, text: 'Минимум 6 символов' },
            { condition: requirements.hasUpperCase, text: 'Большая буква' },
            { condition: requirements.hasLowerCase, text: 'Маленькая буква' },
            { condition: requirements.hasNumber, text: 'Цифра' },
            { condition: requirements.hasSymbol, text: 'Символ (!@#$%^&*-_)' },
            { condition: requirements.hasOnlyAllowedChars, text: 'Только разрешенные символы' }
        ];


        const fulfilledRequirements = requirementsList.filter(req => req.condition);
        const unfulfilledRequirements = requirementsList.filter(req => !req.condition);



        if (unfulfilledRequirements.length > 0) {
            const html = unfulfilledRequirements.map(req =>
                `<span style="color: #ff4444;">✗ ${req.text}</span>`
            ).join('<br>') + '<br>' +
                fulfilledRequirements.map(req =>
                    `<span style="color: #44aa44;">✓ ${req.text}</span>`
                ).join('<br>');

            $hint.html(html).show();

        } else {
            $hint.hide();
        }

    }
    // функция для проверки пароля
    validatePassword(password) {
        // Проверяем длину пароля
        const hasMinLength = password.length >= 6;

        // Проверяем наличие большой буквы
        const hasUpperCase = /[A-ZА-Я]/.test(password);

        // Проверяем наличие маленькой буквы
        const hasLowerCase = /[a-zа-я]/.test(password);

        // Проверяем наличие цифры
        const hasNumber = /\d/.test(password);

        // Проверяем наличие символа из списка "!@#$%^&*"
        const hasSymbol = /[!@#$%^&*_-]/.test(password);

        // Проверяем, что пароль содержит только разрешенные символы
        const hasOnlyAllowedChars = /^[A-Za-zА-Яа-я0-9!@#$%^&*_-]+$/.test(password);

        return {
            isValid: hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSymbol && hasOnlyAllowedChars,
            hasMinLength,
            hasUpperCase,
            hasLowerCase,
            hasNumber,
            hasSymbol,
            hasOnlyAllowedChars
        };
    }

    // Проверка валидности формы
    isFormValid() {
        if (!this.CurrentForm) return;

        const submitButton = this.CurrentForm['submit'] || this.CurrentForm.data('submit') || this.CurrentForm.find("#" + 'submit');
        if (!submitButton[0]) return;

        if (this.CurrentForm === this.LoginForm) {
            submitButton[0].disabled = !(this.LoginValid && this.PassValid);
        } else if (this.CurrentForm === this.RegisterForm) {
            submitButton[0].disabled = !(this.LoginValid && this.PassValid && this.MailValid);
        } else if (this.CurrentForm === this.PasswordForm) {
            submitButton[0].disabled = !(this.PassValid);
        }

    }

    // Обновление классов для инпутов в зависимости от их валидности
    updateInputClass($input, isValid) {
        $input.toggleClass("green_border", isValid);
        $input.toggleClass("red_border", !isValid);
    }

    render() { }

    GotoGame() {
        if ('credentials' in navigator && Data.login) {
            const cred = new PasswordCredential({
                id: Data.login.login,
                name: Data.login.login,
                password: Data.login.password
            });
            navigator.credentials.store(cred).catch(console.error);
        }

        $("#LoginForm").remove();
        $("#PasswordForm").remove();
        $("#RegisterForm").remove();
        $("#VerifyEmailForm").remove();


        Data.login = null;
        Data.mode = "overview";
        this.$Layer.stop(true, true).fadeOut(250, () => {
            GameEvents.emit("SendServer", {
                mode: Data.mode
            });
        });
    }

    Show(module, data = null) {


        super.Show(module, data);

        this.$Content.Show = true;
        this.$Content.stop(true, true).hide();

        module = data?.action ?? module;

        // Рендерим актуальную форму
        this.RenderData(module);

        // Скрываем Overlay после показа
        Overlay.Hide(null, 300);

    }

    Hide() {
        $(this.CurrentForm).hide();
    }
}
