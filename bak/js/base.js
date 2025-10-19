let Token = null;
let Page = null;

let LoginForm = null;


function E(elm) {
    return document.querySelector(elm);
}

HTMLElement.prototype.html = function (html) {
    if (html === undefined && this.nodeType === 1) {
        return this.innerHTML;
    }
    this.innerHTML = html;
    return this;
};
HTMLElement.prototype.text = function (value) {
    if (value === undefined && this.nodeType === 1) {
        return this.textContent;
    }
    this.textContent = value;
    return this;
};

HTMLElement.prototype.show = function (ms, op) {
    let _ms = ms || 300;
    let _op = op || 1;
    let olddisplay = this.getAttribute("olddisplay");
    if (olddisplay) this.style.display = olddisplay;
    else this.style.display = "";
    this.style.opacity = 0;
    this.setAttribute("show", true);
    setTimeout(() => {
        this.style.transition = "opacity " + _ms + "ms";
        this.style.opacity = _op;
    }, 1);


};
HTMLElement.prototype.hide = function (ms, op) {
    setTimeout(() => {
        let _ms = ms || 300;
        let _op = op || 0;
        this.style.transition = "opacity " + _ms + "ms";
        this.style.opacity = _op;
        this.setAttribute("show", false);
        if (!this.getAttribute("Listener")) {
            this.setAttribute("Listener", "1");
            this.addEventListener('transitionend', function (EventTarget) {
                console.log("transitionend");
                if (EventTarget.target.getAttribute("show") == "true") {
                } else {
                    let styles = window.getComputedStyle(EventTarget.target);
                    EventTarget.target.setAttribute("olddisplay", styles.display);
                    EventTarget.target.style.display = "none";
                }
            });
        }
    }, 10);
};
HTMLFormElement.prototype.serialize = function () {
    var data = new FormData(this);
    var elements = this.querySelectorAll("input, select, textarea");
    for (var i = 0; i < elements.length; ++i) {
        var element = elements[i];
        var name = element.name;
        var value = element.value;
        if (element.name) {
            if (element.type == "checkbox") {
                if (element.checked)
                    value = "on";
                else
                    value = "off";
            }
            data.append(name, value);
        }
    }
    let NewData = {};
    data.forEach((value, key) => (NewData[key] = value));

    return NewData;
}

let Overlay = {
    Show: function (obj, ms) {
        let _obj = obj || "body";
        let _ms = ms || 300;
        let over = E(_obj + " overlay");
        if (!over) {
            over = document.createElement("overlay");
            E(_obj).prepend(over);
        }
        over.show(_ms, 0.75);
    },
    Hide: function (obj, ms) {
        let _obj = obj || "body";
        let _ms = ms || 300;
        let over = E(_obj + " overlay");
        if (over)
            over.hide(_ms, 0);
    },
    Text: function (Text, obj) {
        let _obj = obj || "body";
        let over = E(_obj + " overlay");
        if (over)
            if (Text === undefined && over.nodeType === 1) {
                return over.textContent;
            }
        over.textContent = Text;
        return over;
    }
}



class LoginClass {

    LoginForm = null;
    EmailForm = null;
    PassForm = null;
    PassCont = null;
    LoginBtn = null;

    EmailValid = false;
    PassValid = false;

    EMAIL_REGEXP = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/iu;

    destructor() {
        // This function is called when the object is destroyed
       console.log(`${this.name} is destroyed`);
     }

    isFormValid() {
        if (this.EmailValid && this.PassValid) {
            this.LoginBtn.disabled = false;
        } else {
            this.LoginBtn.disabled = true;
        }
    }

    isEmailValid(EmainInput) {
        this.EmailValid = true;// this.EMAIL_REGEXP.test(EmainInput.value);
        if (this.EmailValid) {
            EmainInput.classList.add("lime_border");
            EmainInput.classList.remove("red_border");
        } else {
            EmainInput.classList.remove("lime_border");
            EmainInput.classList.add("red_border");
        }
        this.isFormValid();
        return this.EmailValid;
    }

    isPassValid(PassInput) {
        this.PassValid = PassInput.value.length > 5;
        if (this.PassValid) {
            PassInput.classList.add("lime_border");
            PassInput.classList.remove("red_border");
        } else {
            PassInput.classList.remove("lime_border");
            PassInput.classList.add("red_border");
        }
        this.isFormValid();
        return this.PassValid;
    }

    GetPasswordContainer(PasID) {

        let PassCont = document.createElement("div");
        PassCont.id = "PasswordContainer";

        let PassView = document.createElement("div");

        PassView.setAttribute("tooltip", "Показать/скрыть пароль");
        PassView.setAttribute("for", PasID);
        PassView.classList.add("vpas");
        PassView.addEventListener("click", function () {
            this.classList.toggle("view");
            let For = E("#" + this.getAttribute("for"));
            For.type = For.type === "password" ? "text" : "password";
        })

        this.PassForm = document.createElement("input");
        this.PassForm.type = "password";
        this.PassForm.id = PasID;
        this.PassForm.name = PasID;
        this.PassForm.placeholder = "Password";
        this.PassForm.addEventListener('input', function () { LoginForm.isPassValid(this) });
        PassCont.appendChild(this.PassForm);
        PassCont.appendChild(PassView);

        return PassCont;
    }

    CreateLoginForm() {
        this.LoginForm = document.createElement("form");
        this.LoginForm.id = "LoginForm";
        let label = document.createElement("label");
        label.innerText = "Логин:";
        label.setAttribute("for", "LoginMail");
        this.LoginForm.appendChild(label);

        this.EmailForm = document.createElement("input");
        this.EmailForm.type = "text";
        this.EmailForm.addEventListener('input', function () { LoginForm.isEmailValid(this) });
        this.EmailForm.id = "LoginMail";
        this.EmailForm.name = "LoginMail";
        this.EmailForm.placeholder = "E-Mail";
        this.LoginForm.appendChild(this.EmailForm);

        let labelp = document.createElement("label");
        labelp.innerText = "Пароль:";
        labelp.setAttribute("for", "LoginPass");

        let spanbtn = document.createElement("span");

        this.LoginBtn = document.createElement("input");
        this.LoginBtn.type = "submit";
        this.LoginBtn.value = "Login";
        this.LoginBtn.disabled = true;

        let RegBtn = document.createElement("input");
        RegBtn.type = "button";
        RegBtn.value = "Registration";

        spanbtn.appendChild(this.LoginBtn);
        spanbtn.appendChild(RegBtn);

        this.LoginForm.appendChild(labelp);
        this.LoginForm.appendChild(this.GetPasswordContainer("LoginPass"));
        this.LoginForm.append(document.createElement("span"));
        this.LoginForm.appendChild(spanbtn);

        this.LoginForm.addEventListener('submit', this.SendLoginForm)

    }

    SendLoginForm(event) {
        Overlay.Show();
        //console.log(event.target);
        event.preventDefault();
        //console.log(event.target.serialize());
        //alert('Случился submit');
        let Data = event.target.serialize();
        Data.mode = 'login';
        WS.Send(Data);
    }

    ShowLoginForm() {
        E("#content").html("")
        this.LoginForm.style.display = "none";
        E(".wrapper").append(this.LoginForm);
        this.LoginForm.show(1000);
    }

    HideLoginForm() { 
        this.LoginForm.remove();
    }

}

function ShowPageGame() {

}