window.OverViewPageClass = class OverViewPageClass extends BasePageClass {


    Name = "OverViewPageClass";

    constructor() {

        console.log("constructor OverViewPageClass");

        super();

        this.$Layer.toggleClass("accauntlayer", false);
        this.$Layer.toggleClass("gamelayer", true);
        //this.GeneretContainer();

        //if (!GameLayer) GameLayer = new GameLayerClass();

        //GameLayer.Show();

        this.$Content.addClass("OverView");



    }

    CreateQueues() {
        const queues = this.messageData.data.Page?.Queues;
        this.$Content.Queues = $("<div>").addClass("Queues").hide();
        this.$Content.Queues.Build = {};
        this.$Content.Queues.Tech = {};
        this.$Content.Queues.Hangar = {};

        // Создание элементов для очереди
        $.each(queues, (Type, queue) => {
            const build = $("<game-build>").hide();;
            build[0].type = "over_queues";
            build[0].images = (Type === "Build") ? "builds" : (Type === "Tech") ? "techs" : (queue.id > 400) ? "defenses" : "fleets";
            build[0].data = queue;

            this.$Content.Queues[Type] = build;
            this.$Content.Queues.append(build);

        });

        this.$Content.append(this.$Content.Queues);
    }

    renderQueues() {
        const queues = this.messageData.data.Page?.Queues;

        if (!this.$Content?.Queues) {
            this.CreateQueues();
        }

        if (!queues) {
            this.$Content.Queues.fadeOut(250);
        } else {
            this.$Content.Queues.fadeIn(250);
        }


        if (queues.Build.length === 0) {
            this.$Content.Queues.Build.fadeOut(250);
        } else {
            this.$Content.Queues.Build.fadeIn(250);
        }

        if (queues.Tech.length === 0) {
            this.$Content.Queues.Tech.fadeOut(250);
        } else {
            this.$Content.Queues.Tech.fadeIn(250);
        }

        if (queues.Hangar.length === 0) {
            this.$Content.Queues.Hangar.fadeOut(250);
        } else {
            this.$Content.Queues.Hangar.fadeIn(250);
        }

        $.each(queues, (Type, queue) => {
            this.$Content.Queues[Type][0].type = "over_queues";
            this.$Content.Queues[Type][0].images = (Type === "Build") ? "builds" : (Type === "Tech") ? "techs" : (queue.id > 400) ? "defenses" : "fleets";
            this.$Content.Queues[Type][0].data = queue;
        });
    }

    CreateData() {

        this.$Content.Name = $("<div>", { id: "UserName" }).text("UserName");
        this.$Content.Planet = $("<div>", { id: "Planet" }).addClass("box");
        this.$Content.Planet["Name"] = $("<div>", { id: "PlanetName" }).addClass("box");
        this.$Content.Planet["Info"] = $("<div>", { id: "PlanetInfo" }).addClass("box");
        this.$Content.Planet["Image"] = $("<div>", { id: "PlanetImage" });
        this.$Content.Planet["Debris"] = $("<div>", { id: "PlanetDebris" }).hide();
        this.$Content.Planet["DebrisNoSel"] = $("<div>", { id: "PlanetDebrisNoSel" });


        this.$Content.Planet.Info["LDiameter"] = $("<span>", { id: "PlanetInfoLDiameter" });
        this.$Content.Planet.Info["Size"] = $("<span>", { id: "PlanetInfoSize" });
        this.$Content.Planet.Info["LTemperature"] = $("<span>", { id: "PlanetInfoLTemperature" });
        this.$Content.Planet.Info["Temp"] = $("<span>", { id: "PlanetInfoTemp" });
        this.$Content.Planet.Info["LPosition"] = $("<span>", { id: "PlanetInfoLPosition" });
        this.$Content.Planet.Info["Position"] = $("<span>", { id: "PlanetInfoPosition" });

        this.$Content.Planet.Info.append(this.$Content.Planet.Info.LDiameter);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.Size);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.LTemperature);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.Temp);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.LPosition);
        this.$Content.Planet.Info.append(this.$Content.Planet.Info.Position);

        this.$Content.Planet.append(this.$Content.Planet.Name);
        this.$Content.Planet.append(this.$Content.Planet.Info);
        this.$Content.Planet.append(this.$Content.Planet.Image);
        this.$Content.Planet.append(this.$Content.Planet.Debris);
        this.$Content.Planet.append(this.$Content.Planet.DebrisNoSel);

        this.$Content.append(this.$Content.Name);
        this.$Content.append(this.$Content.Planet);


        this.$Content.Planet.Name.off("click.overview").on("click.overview", () => {

            const content = this.createSpan(Lang.overview.RenameTitle);
            content.append("<br><br>");

            const FormName = this.createDiv("", "RenamePlanet");
            const InputName = this.createInput("text", "NewPlanetName", Lang.overview.New_name_planet);
            const InfoName = this.createSpan("", "InfoPlanetName", "mdi mdi-help-box-outline").ToolTip(Lang.overview.InfoRenamePlanet);
            const ButtonName = this.createButton("NewPlanetNameBtn", Lang.overview.Rename).prop("disabled", true);
            FormName.append(InputName, InfoName, ButtonName);

            InputName[0].addEventListener("input", () => {
                const value = InputName[0].value;

                if (value.length > 20) {
                    InputName[0].value = value.slice(0, 20);
                }

                // Проверка длины
                if (value.length < 2 || value.length > 20) {
                    InputName[0].setCustomValidity("Название должно быть от 2 до 20 символов");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Проверка разрешенных символов
                if (!/^[\p{L}\p{N} _-]+$/u.test(value)) {
                    InputName[0].setCustomValidity("Использованы недопустимые символы");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Проверка начала/конца на спецсимволы
                if (/^[-_ ]|[-_ ]$/.test(value)) {
                    InputName[0].setCustomValidity("Название не может начинаться или заканчиваться спецсимволом");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Проверка на подряд идущие спецсимволы
                if (/[-_ ]{2,}/.test(value)) {
                    InputName[0].setCustomValidity("Спецсимволы не могут идти подряд");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Проверка количества спецсимволов (не более 3)
                const countSpecial = (value.match(/[-_ ]/g) || []).length;
                if (countSpecial > 3) {
                    InputName[0].setCustomValidity("Слишком много спецсимволов");
                    ButtonName.prop("disabled", true);
                    return;
                }

                // Всё ок
                InputName[0].setCustomValidity("");
                ButtonName.prop("disabled", false);
            });

            ButtonName.on("click", () => {

                if (Dialog) Dialog.close();
                //Overlay.Show(null, 250, () => {
                    //this.$Content.stop(true, true).fadeOut(250, () => {
                        //this.$Content.Show = false;
                        GameEvents.emit("SendServer", {
                            mode: Data.mode,
                            action: "RenamePlanet",
                            NotOverlay: false,
                            data: { Name: InputName.val() }
                        });
                   // });
                //});
            });

            content.append(FormName);

            Dialog.create(content, Lang.overview.PlanetMenu,
                [{ text: Lang.Close, action: () => Dialog.close() }],
                {
                    width: 350,
                    drag: true,
                    position: { my: 'center bottom', at: 'center center', of: "#Planet" }
                });
        });
    }

    renderData() {

        if (!this.$Content?.Planet) {
            this.CreateData();
        }

        this.$Content.Name.text(this.messageData.data.Page?.UserName);
        this.$Content.Planet.Name.text(this.messageData.data.Page?.PlanetName);

        this.$Content.Planet.Debris.ToolTip("tooltip");

        this.$Content.Planet.Info.LDiameter.text(Lang.Diameter);
        this.$Content.Planet.Info.LTemperature.text(Lang.Temperature);
        this.$Content.Planet.Info.LPosition.text(Lang.Position);

        this.$Content.Planet.Info.Size.text(this.messageData.data.Page?.diameter + '' + Lang.km + ' (' + this.messageData.data.Page?.field_used + '/' + this.messageData.data.Page?.field_current + ')');
        this.$Content.Planet.Info.Temp.text(Lang.from + " " + this.messageData.data.Page?.TempMin + '°C ' + Lang.to + ' ' + this.messageData.data.Page?.TempMax + '°C');
        this.$Content.Planet.Info.Position.text('[' + this.messageData.data.Page?.galaxy + ':' + this.messageData.data.Page?.system + ':' + this.messageData.data.Page?.planet + ']');


        this.$Content.Planet.Image.attr("style", "background:url('/images/planets/overview/" + this.messageData.data.Page?.PlanetImage + ".png') no-repeat;background-size:100%");
    }

    async render() {

        if (Dialog) Dialog.close();

        await super.render();

        this.renderData();
        this.renderQueues();




    }


}