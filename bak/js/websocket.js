

class WebSocketClass {

    constructor() {
        Overlay.Show();
        Overlay.Text("Connecting");
        this.connect();
    }
    
    connect() {
        this.ws = new WebSocket("wss://spserver.snak84.ru");
        this.ws.onopen = function () {
            console.log("Соединение установлено.");

            WS.Send({ "mode": "connect" });
        };

        this.ws.onclose = function (event) {
            if (event.wasClean) {
                console.log('Соединение закрыто чисто');
            } else {
                console.log('Обрыв соединения'); // например, "убит" процесс сервера
            }
            console.log('Код: ' + event.code + ' причина: ' + event.reason);
            Overlay.Show();
            setTimeout(() => {
                WS.connect();
            }, 5000);

        };

        this.ws.onmessage = function (event) {
            let data;
            let error = false;
            try {
                data = JSON.parse(event.data);
                console.log("Получены данные", data);
            } catch (err) {
                error = true;
                console.log("Ошибка парсинга данных", event.data);
            }

            if (error) return;

            Token = data.Token;

            if (!Token || Token.length != 128) {
                if (!LoginForm) {
                    LoginForm = new LoginClass();
                    LoginForm.CreateLoginForm();
                }
                LoginForm.ShowLoginForm();
            } else {
                console.log("Token ok");
                LoginForm.HideLoginForm()
                ShowPageGame();
            }
            //Overlay.Hide();
        };

        this.ws.onerror = function (error) {
            console.log(error);
            console.log("Ошибка " + error.message);
        };
    }

    Send(data) {

        let Data = {
            "Token": Token,
            "Page": Page
        };

        Object.assign(Data, data);

        console.log(Data);
        this.ws.send(JSON.stringify(Data));
    }

}

WS = new WebSocketClass();