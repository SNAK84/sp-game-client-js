window.FleetsPageClass = class FleetsPageClass extends BasePageClass {

    Name = "FleetsPageClass";

    $Fleets = null;
    $FleetsPlanet = null;

    LastFleetId = 0;

    draggableDelay = 500;

    constructor() {
        super();

        this.$Layer.toggleClass("accauntlayer", false);
        this.$Layer.toggleClass("gamelayer", true);

        this.$Content.addClass("FleetsPage");

        const event = (e) => {
            const { action, ...data } = e.detail;

            if (action === "max") {
                console.log("max");
                const count = this.getMaxConstructibleElements(id, e.detail.Price);
                this.$Ships[id][0].Input.val(count);
                this.renderNewFleetBlock();
                return;
            }
            if (action === "info") {
                console.log(`ℹ️ Инфо по ${id}`);
                GameEvents.emit("ShowInfoPanel", { data: { 'id': id } });
                return;
            }

            Overlay.Show(null, 250, () => {
                let act = null;
                switch (action) {
                    case "MoveShip":
                        act = "MoveShip";
                        break;
                    case "DisbandFleet":
                        act = "DisbandFleet";
                        break;
                    case "cancel":
                        act = "cancel";
                        break;
                }

                if (["MoveShip", "DisbandFleet", "cancel"].includes(act)) {

                    GameEvents.emit("SendServer", {
                        mode: "fleets",
                        action: act,
                        //hide: "ActualData",
                        data: data
                    });
                }
            });
        };

        GameEvents.off("BuildAction");
        GameEvents.on("BuildAction", event);
    }

    getMaxConstructibleElements(Element, Price) {

        return this.messageData.data.Page?.PlanetShips[Element].count;

    }

    showTaskFleet(event) {
        let FleetId = event?.target ? $(event.target).parent()[0].FleetId : event;
        if (!FleetId) return;

        const Fleet = this.messageData.data.Page?.FleetList[FleetId];
        if (!Fleet) return;

        const Commands = this.messageData.data.Page?.FleetList[FleetId]?.Commands;


        // Создаем базовую оболочку
        const $panel = $("<div>").addClass("FleetTaskPanel");
        $panel.append(this.createSpan(`🚀 Текущие задания:`), "<br><br>");


        if (Commands) {


        } else {
            $panel.append("-= Комманды отсутствуют =-", "<br><br>");

            const $sendPanel = this.createDiv("", "sendPanel");

            // === Панель ввода координат как в OGame ===
            const $coordPanel = $("<div>").addClass("FleetCoordsPanel");

            // Поля ввода координат
            const $galaxy = this.createSpan("", "GalaxyBlock", "GalaxyBlock");
            $galaxy.append(
                "Галактика",
                this.createInput(
                    'number', 'NavigationGalaxyInput', '', "InputNavigation", null, 1,
                    { min: 1, max: () => 1 }));


            const $system = this.createSpan("", "GalaxyBlock", "GalaxyBlock");
            $system.append(
                "Система",
                this.createInput(
                    'number', 'NavigationSystemInput', '', "InputNavigation", null, 1,
                    { min: 1, max: () => 128 })
            );

            const $orbit = this.createSpan("", "GalaxyBlock", "GalaxyBlock");
            $orbit.append(
                "Орбита",
                this.createInput(
                    'number', 'NavigationOrbitInput', '', "InputNavigation", null, 1,
                    { min: 1, max: () => 16 })
            );

            const $distance = this.createSpan("", "GalaxyBlock", "GalaxyBlock");
            $distance.append(
                "Расстояние",
                this.createInput(
                    'number', 'Navigationdistance Input', '', "InputNavigation", null, 1,
                    { min: 1, max: () => 16000 })
            ).hide();

            const $deg = this.createSpan("", "GalaxyBlock", "GalaxyBlock");
            $deg.append(
                "Угол",
                this.createInput(
                    'number', 'Navigationdistance Input', '', "InputNavigation", null, 1,
                    { min: 1, max: () => 360 })
            ).hide();

            let selectedType = "planet";

            // создаём элемент
            const $iconSelector = $("<icon-selector>");

            // берём сам DOM-элемент (для обращения к свойствам класса)
            const selector = $iconSelector[0];

            selector.setTooltipHandler((button, item) => {
                $(button).ToolTip(item.tooltip, item.tooltipCss);
            });

            selector.items = {
                1: { label: "Планета", value: 1, class: "NavType", imgClass: "NavTypeImg NavTypePlanet", tooltip: "Планета" },
                2: { label: "Луна", value: 3, class: "NavType", imgClass: "NavTypeImg NavTypeMoon", tooltip: "Луна" },
                3: { label: "Обломки", value: 2, class: "NavType", imgClass: "NavTypeImg NavTypeDedris", tooltip: "Обломки" },
                4: { label: "Свобод", value: 4, class: "NavType", imgClass: "NavTypeImg NavTypeFree", tooltip: "Свободные координаты" }
            };

            selector.single = true;
            selector.vertical = false;

            // --- Реакция на выбор типа ---
            selector.addEventListener("change", e => {
                selectedType = Number(e.detail.value);
                toggleFreeCoords(selectedType === 4);
            });

            function toggleFreeCoords(isFree) {
                if (isFree) {
                    $orbit.fadeOut(100, () => {
                        $distance.fadeIn(100);
                        $deg.fadeIn(100);
                    });
                } else {
                    $distance.fadeOut(100);
                    $deg.fadeOut(100, () => {
                        $orbit.fadeIn(100);
                    });
                }
            }


            // --- Сборка панели ---
            $coordPanel.append(
                $("<div>").text("Координаты назначения:"),
                $iconSelector, "<br>",
                $galaxy, $system, "<br>", $orbit,
                $distance, " ", $deg
            );

            $sendPanel.append($coordPanel);

            $panel.append($sendPanel);
        }

        // === Выбор миссии через icon-selector ===
        const $missionSelector = $("<icon-selector>");
        const missionSelector = $missionSelector[0];

        // Подключаем tooltip
        missionSelector.setTooltipHandler((button, item) => {
            $(button).ToolTip(item.tooltip, item.tooltipCss);
        });

        // Готовим список миссий (из серверных данных)
        const FleetMissions = this.messageData.data.Page?.FleetMissions;

        const mItems = {};
        if (FleetMissions) {
            for (const m of FleetMissions) {
                mItems[m.id] = {
                    label: "121",//Lang[m.lang],
                    value: m.id,
                    class: "NavType",
                    imgClass: "NavMissionImg Mission_" + m.id,   // css под иконку
                    tooltip: Lang[m.lang]
                };
            }
        }

        missionSelector.items = mItems;

        missionSelector.single = true;
        missionSelector.vertical = false;

        // Текущее выбранное задание
        let selectedMission = null;

        missionSelector.addEventListener("change", e => {
            selectedMission = Number(e.detail.value);
        });

        const $commandsList = $("<div>").addClass("FleetCommandsList");
        const $addCmdBtn = this.createButton("AddCmd", "Добавить команду", () => addCommandRow());
        const $sendBtn = this.createButton("SendCmds", "Отправить", () => sendFleetCommands());
        const $clearBtn = this.createButton("ClearCmds", "Очистить", () => $commandsList.empty());

        $panel.append($("<div>").text("Тип миссии:"), $missionSelector, "<br>", $commandsList, "<br>", $addCmdBtn, $clearBtn, $sendBtn);


        Dialog.create($panel, `🚀 Управление флотом #${FleetId}`, [
            { text: Lang.Close, action: () => Dialog.close(), class: ["btn-warning"] }
        ], {
            width: 460,
            overlay: true,
            drag: true,
            position: { my: 'center bottom', at: 'center center', of: "#Planet" }
        });

        // Загружаем список миссий с сервера
        /*GameEvents.emit("SendServer", {
            mode: "fleets",
            action: "GetMissions",
            data: {},
            onSuccess: (res) => {
                
            }
        });*/

        // Загружаем текущие команды флота
        /* GameEvents.emit("SendServer", {
             mode: "fleets",
             action: "GetFleetCommands",
             data: { fleet_id: FleetId },
             onSuccess: (res) => {
                 res.forEach(c => addCommandRow(c.type, c.params));
             }
         });*/

        function addCommandRow(type = null, params = {}) {
            const $row = $("<div>").addClass("FleetCmdRow");

            const $cmdSelect = $("<select>").addClass("CmdSelect");
            for (const t in Lang.fleet_command) {
                const $opt = $("<option>").val(t).text(Lang.fleet_command[t]);
                if (t == type) $opt.attr("selected", true);
                $cmdSelect.append($opt);
            }

            const $paramInput = $("<input>")
                .addClass("CmdParams")
                .attr("placeholder", "params (JSON)")
                .val(JSON.stringify(params));

            const $del = $("<button>")
                .addClass("btn btn-danger btn-xs")
                .text("✖")
                .on("click", () => $row.remove());

            $row.append($cmdSelect, $paramInput, $del);
            $commandsList.append($row);
        }

        function sendFleetCommands() {
            const commands = [];
            $commandsList.find(".FleetCmdRow").each(function () {
                const type = $(this).find(".CmdSelect").val();
                let params = {};
                try {
                    params = JSON.parse($(this).find(".CmdParams").val());
                } catch (e) { console.warn("Bad JSON", e); }
                commands.push({ type: parseInt(type), params });
            });

            GameEvents.emit("SendServer", {
                mode: "fleets",
                action: "SetFleetCommands",
                data: {
                    fleet_id: FleetId,
                    start_time: Date.now() / 1000,
                    commands
                },
                onSuccess: () => {
                    Dialog.close();
                    Overlay.Show(Lang.fleets.CommandsSaved, 1000);
                }
            });
        }
    }


    DisbandFleet(event) {
        let FleetId;

        // Если передан объект события
        if (event && event.target) {
            FleetId = $(event.target).parent()[0].FleetId;
        } else {
            // Если передан просто id
            FleetId = event;
        }

        if (!FleetId) return;

        const Fleet = this.messageData.data.Page?.FleetList[FleetId];


        const content = this.createSpan("Расформирование флота ");
        content.append(this.createSpan(`Флот #${Fleet.id}`), "<br><br>");
        content.append(
            this.createDiv("Если флот будет расформирован, потеряется весь прогресс"),
            "<br>"
        );

        Dialog.create(content, Lang.overview.PlanetMenu,
            [
                { text: Lang.Close, action: () => Dialog.close(), class: ["btn-warning"] }
            ],
            {
                width: 360,
                overlay: true,
                drag: true,
                position: { my: 'center bottom', at: 'center center', of: "#Planet" }
            });
    }

    createFleetMoreDetails(FleetId) {
        console.log("createFleetMoreDetails");

        this.$FleetMoreDetails = $(".FleetMoreDetails");

        if (this.$FleetMoreDetails.length === 0) {
            this.$FleetMoreDetails = $("<div>").addClass("box FleetMoreDetails");
        }

        this.$FleetMoreDetails.Ships = {};
        const FleetShips = this.messageData.data.Page?.FleetList[FleetId].ships;


        /*$.each(FleetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createFleetShip(id, ship);
            }
        });*/

        this.$FleetMoreDetails.hide();
        /*this.$Content.append(this.$ShipsBlock);*/
        //console.log(this.$FleetMoreDetails);
    }

    createFleetShip(id, ship) {
        console.log("createFleetShip");

        this.$FleetMoreDetails.Ships[id] = $("#fleetsDetails" + id);

        if (this.$FleetMoreDetails.Ships[id].length === 0) {
            this.$FleetMoreDetails.Ships[id] = $("<game-build>");
            this.$FleetMoreDetails.Ships[id][0].images = (id > 400) ? "defenses" : "fleets";
            this.$FleetMoreDetails.Ships[id][0].type = 'fleetsDetails';
            this.$FleetMoreDetails.Ships[id][0].FleetId = this.LastFleetId;
            //this.$FleetMoreDetails.Ships[id][0].OnInput = () => this.renderNewFleetBlock();
            this.$FleetMoreDetails.Ships[id][0].data = ship;
            this.$FleetMoreDetails.append(this.$FleetMoreDetails.Ships[id]);
        } else {
            this.$FleetMoreDetails.Ships[id][0].FleetId = this.LastFleetId;
            this.$FleetMoreDetails.Ships[id][0].data = ship;
        }

        const self = this;


        this.$FleetMoreDetails.Ships[id].draggable({
            helper: "clone",
            revert: 'invalid',
            delay: this.draggableDelay,
            axis: null, opacity: 0.8,
            cursorAt: { top: 50, left: 50 },
            containment: "#Content"
        }).off("mousedown.cursor touchstart.cursor").on("mousedown.cursor touchstart.cursor", function () {
            const $this = $(this);
            $this.data("holdTimer", setTimeout(() => {
                $this.css("cursor", "grabbing"); // показать "готов к движению" по истечении задержки
            }, self.draggableDelay)); // совпадает с delay
        }).off("mouseup.cursor mouseleave.cursor touchend.cursor touchcancel.cursor").on("mouseup.cursor mouseleave.cursor touchend.cursor touchcancel.cursor", function () {
            const $this = $(this);
            clearTimeout($this.data("holdTimer"));
            $this.css("cursor", "grab"); // вернуть нормальный курсор
        });;

    }

    renderFleetMoreDetails(Fleet) {

        let FleetId;

        // Если передан объект события
        if (Fleet && Fleet.target) {
            FleetId = $(Fleet.target).parent()[0].FleetId;
        } else {
            // Если передан просто id
            FleetId = Fleet;
        }

        if (!FleetId) return;

        if (!this.$FleetMoreDetails)
            this.createFleetMoreDetails(FleetId);

        if (this.LastFleetId !== FleetId) {
            this.$FleetMoreDetails.hide(100, () => {
                this.LastFleetId = FleetId;

                this.renderFleetMoreDetailsShips(FleetId);

                this.$FleetMoreDetails.show(100);
            });
        } else this.renderFleetMoreDetailsShips(FleetId);
    }

    renderFleetMoreDetailsShips(FleetId) {

        if (!this.$FleetMoreDetails)
            this.createFleetMoreDetails(FleetId);

        if (!this.$Fleets[FleetId]) return;

        this.$Fleets[FleetId].append(this.$FleetMoreDetails);

        const FleetShips = this.messageData.data.Page?.FleetList[FleetId].ships;

        $.each(FleetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createFleetShip(id, ship);
            } else if (ship.count > 0) {
                this.$FleetMoreDetails.Ships[id][0].data = ship;
            }
        });

        // Удаляем исчезнувшие
        for (const id in this.$FleetMoreDetails.Ships) {
            if ((!FleetShips[id] || FleetShips[id].count <= 0) && this.$FleetMoreDetails.Ships[id].length > 0) {
                //this.$Ships[id].fadeOut(250, () => {
                this.$FleetMoreDetails.Ships[id].remove();
                delete this.$FleetMoreDetails.Ships[id];
                //});
            }
        }

        const shipsArray = Object.entries(this.$FleetMoreDetails.Ships);
        shipsArray.sort((a, b) => a[0] - b[0]);

        let last = null;
        shipsArray.forEach(([id, $ship]) => {
            if (last === null) {
                this.$FleetMoreDetails.prepend($ship);
            } else {
                last.after($ship);
            }
            last = $ship;
        });

    }

    createNewFleet() {
        let items = {};
        $.each(this.$Ships, (id, Ship) => {
            if (Ship[0]?.Input) {
                const count = Ship[0].Input.val();
                if (count > 0) items[id] = count;
            }
        });

        GameEvents.emit("SendServer", {
            mode: Data.mode,
            action: "toOrbit",
            hide: "ActualData",
            data: { 'items': items }
        });

        this.clearSelectElements();
    }

    clearSelectElements() {
        $.each(this.$Ships, (id, Ship) => {
            Ship[0].Input.val(0);
        });

        this.renderNewFleetBlock();
    }

    moveShip(toFleetId, fromFleetId, shipId, count) {
        const FleetList = this.messageData.data.Page?.FleetList;
        const PlanetShips = this.messageData.data.Page?.PlanetShips;

        let fromFleet, fromShip, isPlanetSource = false;

        // 🌍 Источник — планета
        if (!fromFleetId || fromFleetId === 0) {
            isPlanetSource = true;
            fromFleet = PlanetShips;
            fromShip = fromFleet[shipId];
        } else {
            fromFleet = FleetList[fromFleetId];
            fromShip = fromFleet?.ships?.[shipId];
        }

        if (!fromShip) return;

        // 🧮 Корректируем количество
        if (count > fromShip.count) count = fromShip.count;


        GameEvents.emit("BuildAction", {
            action: "MoveShip",
            fromFleetId: fromFleetId,
            toFleetId: toFleetId,
            shipId: shipId,
            count: count,
        });

        // 🔄 Обновляем интерфейс
        this.renderFleetsPlanet();
        this.renderShips();

    }

    createFleetsPlanet() {
        this.$FleetsPlanet = $("<div>").addClass("box FleetsPlanet");
        this.$FleetsPlanet.BlockTitle = $("<div>").addClass("box FleetsPlanet BlockTitle").text("Флотов у планеты ");
        this.$FleetsPlanet.BlockTitle.Count = $("<span>");
        this.$FleetsPlanet.BlockTitle.Max = $("<span>");
        this.$FleetsPlanet.BlockTitle.append(
            this.$FleetsPlanet.BlockTitle.Count,
            " из ",
            this.$FleetsPlanet.BlockTitle.Max
        );

        this.$FleetsPlanet.append(this.$FleetsPlanet.BlockTitle);

        const FleetList = this.messageData.data.Page?.FleetList;


        this.$Fleets = {};
        $.each(FleetList, (id, fleet) => {
            this.$Fleets[id] = this.createInfoFleet();
            this.$Fleets[id][0].FleetId = parseInt(id);
            this.$Fleets[id].droppable({
                drop: (event, ui) => this.dropShip(event, ui)
            });
            this.$FleetsPlanet.append(this.$Fleets[id]);
        });


        this.$Content.append(this.$FleetsPlanet);
    }

    renderFleetsPlanet() {

        const FleetList = this.messageData.data.Page?.FleetList;
        if (!FleetList) return;

        if (!this.$FleetsPlanet)
            this.createFleetsPlanet();

        const fleetIds = Object.keys(FleetList);
        this.$FleetsPlanet.BlockTitle.Count.text(fleetIds.length);
        this.$FleetsPlanet.BlockTitle.Max.text(10);

        $.each(FleetList, (fid, fleet) => {

            if (!this.$Fleets[fid] || this.$Fleets[fid].length === 0) {
                this.$Fleets[fid] = this.createInfoFleet();
                this.$Fleets[fid][0].FleetId = parseInt(fid);
                this.$Fleets[fid].droppable({
                    drop: (event, ui) => this.dropShip(event, ui)
                });
                this.$FleetsPlanet.append(this.$Fleets[fid]);
            }
            //this.$Fleets[fid] = $fleet;
            const $fleet = this.$Fleets[fid];

            let count = 0;
            let types = 0;
            let consumption = 0;
            let capacity = 0;
            let experience = 0;
            let speeds = [];
            $.each(fleet.ships, (id, Ship) => {
                count += Ship.count;

                types++;
                speeds.push(Ship.speed);
                consumption += Ship.consumption * Ship.count;
                capacity += Ship.capacity * Ship.count;
                experience += Ship.experience;

            });
            const speed = speeds.length ? Math.min(...speeds) : 0;

            let Cargo = 0;
            let ResourcesTable = this.createDiv("", null, "CargoTable");
            //const Resources = {};
            $.each(fleet.resources, (res, resource) => {
                //Resources[resource.id] = resource.count;
                if (resource.count > 0) {
                    Cargo += resource.count;
                    const Res = this.createDiv(humanNumber(resource.count, true, 4), "Res_" + res, `ResBox icon${res}`);
                    ResourcesTable.append(Res);
                }
            });

            // Название и данные
            $fleet.Name.text(`Флот #${fleet.id}`);
            $fleet.ShipsCount.text(humanNumber(count, true, 2));
            $fleet.ShipsTypes.text(types);
            $fleet.ShipsSpeed.text(humanNumber(speed, true, 2));
            $fleet.ShipsCapacity.text(humanNumber(capacity, true, 2));
            $fleet.ShipsСonsumption.text(humanNumber(consumption, true, 2));
            $fleet.ShipsExperience.text(humanNumber(experience, true, 2));
            $fleet.ShipsFuel.text(humanNumber(fleet.fuel, true, 2));
            $fleet.ShipsCargo.text(humanNumber(Cargo, true, 2)).ToolTip(ResourcesTable, { 'max-width': '300px' });
            $fleet.Buttons.MoreDetails[0].FleetId = fleet.id;
            $fleet.Buttons[0].FleetId = fleet.id;

        });

        // Удаляем исчезнувшие
        for (const id in this.$Fleets) {
            if ((!FleetList[id] || FleetList[id].count <= 0) && this.$Fleets[id].length > 0) {
                //this.$Ships[id].fadeOut(250, () => {
                this.$Fleets[id].remove();
                delete this.$Fleets[id];
                //});
            }
        }

        this.renderFleetMoreDetails(this.LastFleetId);
    }

    renderFleets() {
        if (!this.$Fleets) this.$Fleets = {};
    }

    dropShip(event, ui) {
        const FleetList = this.messageData.data.Page?.FleetList;
        const PlanetShips = this.messageData.data.Page?.PlanetShips;

        const shipId = ui.draggable[0]._data.id;
        const toFleetId = event.target.FleetId;
        const fromFleetId = ui.draggable[0].FleetId;
        if (toFleetId == fromFleetId) {
            ui.draggable.draggable("option", "revert", true);
            return false;
        } else {
            // Если флот тот же — выключаем revert
            ui.draggable.draggable("option", "revert", false);
        }

        const content = this.createSpan("Перемещение корабля ");
        content.append(this.createSpan(Lang.tech[shipId]), "<br><br>");

        let fromFleet, fromShip, isPlanetSource = false;

        // 🌍 Источник — планета
        if (!fromFleetId || fromFleetId === 0) {
            isPlanetSource = true;
            fromFleet = PlanetShips;
            fromShip = fromFleet[shipId];
        } else {
            fromFleet = FleetList[fromFleetId];
            fromShip = fromFleet?.ships?.[shipId];

            if (fromFleet.types < 2) {
                content.append(
                    this.createDiv("Если флот останется без кораблей он будет расформирован и потеряет весь прогресс"),
                    "<br>"
                );
            }

        }

        const MoveForm = this.createDiv("", "MoveForm");
        const MoveInput = Page.createInput('number', 'MoveCount', null, "btn-box btn-input", null, fromShip.count, {
            min: 0,
            max: fromShip.count
        });
        MoveForm.append(MoveInput);
        content.append(MoveForm);

        Dialog.create(content, Lang.overview.PlanetMenu,
            [
                {
                    text: '25%', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(fromShip.count / 4))
                        Dialog.close();
                    }
                },
                {
                    text: '50%', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(fromShip.count / 2))
                        Dialog.close();
                    }
                },
                {
                    text: '75%', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(fromShip.count / 4 * 3))
                        Dialog.close();
                    }
                },
                {
                    text: '100%', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(fromShip.count))
                        Dialog.close();
                    }
                },
                {
                    text: 'Перести', action: () => {
                        this.moveShip(toFleetId, fromFleetId, shipId, Math.floor(MoveInput.val()))
                        Dialog.close();
                    }
                },
                { text: Lang.Cancel, action: () => Dialog.close(), class: ["btn-warning"] }
            ],
            {
                width: 360,
                overlay: true,
                drag: true,
                position: { my: 'center bottom', at: 'center center', of: "#Planet" }
            });

        console.log('toFleetId', toFleetId, 'fromFleetId', fromFleetId, event, ui);
    }

    createShips() {
        const PlanetShips = this.messageData.data.Page?.PlanetShips;
        if (!PlanetShips) return;

        this.$ShipsBlock = $("<div>").addClass("box ShipsBlock");
        this.$ShipsPlanet = $("<div>").addClass("box ShipsPlanet");
        this.$ShipsPlanet[0].FleetId = 0

        this.$ShipsPlanet.droppable({
            drop: (event, ui) => this.dropShip(event, ui)
        });

        this.$Ships = {};
        $.each(PlanetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createShip(id, ship);
            }
        });

        this.$ShipsBlock.append(this.$ShipsPlanet);
        this.$Content.append(this.$ShipsBlock);
    }

    createShip(id, ship) {
        this.$Ships[id] = $("#fleets" + id);

        if (this.$Ships[id].length === 0) {
            this.$Ships[id] = $("<game-build>");
            this.$Ships[id][0].images = (id > 400) ? "defenses" : "fleets";
            this.$Ships[id][0].type = 'fleets';
            this.$Ships[id][0].FleetId = 0;
            this.$Ships[id][0].OnInput = () => this.renderNewFleetBlock();
            this.$Ships[id][0].data = ship;
            this.$ShipsPlanet.append(this.$Ships[id]);
        } else {
            this.$Ships[id][0].data = ship;
        }

        const self = this;

        this.$Ships[id].draggable({
            handle: ".head, .image",
            cancel: ".btn-box, input",
            helper: "clone",
            revert: 'invalid',
            delay: this.draggableDelay,
            axis: null, opacity: 0.8,
            cursorAt: { top: 50, left: 50 },
            containment: "#Content"
        }).off("mousedown.cursor touchstart.cursor").on("mousedown.cursor touchstart.cursor", function () {
            const $this = $(this);
            $this.data("holdTimer", setTimeout(() => {
                $this.css("cursor", "grabbing"); // показать "готов к движению" по истечении задержки
            }, self.draggableDelay)); // совпадает с delay
        }).off("mouseup.cursor mouseleave.cursor touchend.cursor touchcancel.cursor").on("mouseup.cursor mouseleave.cursor touchend.cursor touchcancel.cursor", function () {
            const $this = $(this);
            clearTimeout($this.data("holdTimer"));
            $this.css("cursor", "grab"); // вернуть нормальный курсор
        });;

        this.$Ships[id].off("click").on("click", ".btn-box-max", (e) => {
            const count = this.getMaxConstructibleElements(id, e.detail.Price);
            this.$Ships[id][0].Input.val(count);
            this.renderNewFleetBlock();

            console.log("Кнопка info нажата для", id);
        });

    }

    createInfoFleet() {

        const $InfoFleet = $("<div>").addClass("box InfoFleet");

        $InfoFleet.Name = $("<div>").addClass("Name");

        $InfoFleet.ShipsCount = $("<span>").addClass("ShipsCount");
        $InfoFleet.ShipsTypes = $("<span>").addClass("ShipsTypes");
        $InfoFleet.ShipsSpeed = $("<span>").addClass("ShipsSpeed");
        $InfoFleet.ShipsCapacity = $("<span>").addClass("ShipsCapacity");
        $InfoFleet.ShipsExperience = $("<span>").addClass("ShipsExperience");
        $InfoFleet.ShipsFuel = $("<span>").addClass("ShipsFuel");
        $InfoFleet.ShipsCargo = $("<span>").addClass("ShipsCargo");
        $InfoFleet.ShipsСonsumption = $("<span>").addClass("ShipsСonsumption");


        $InfoFleet.Buttons = $("<div>").addClass("Buttons");

        $InfoFleet.Buttons.MoreDetails = this.createButton(
            "ButtonsFleet", Lang.fleets.MoreDetails, this.renderFleetMoreDetails.bind(this), false, null, 'btn-info');

        $InfoFleet.Buttons.Task = this.createButton(
            "ButtonsFleet", Lang.fleets.Task, this.showTaskFleet.bind(this), false, null, 'btn-info');

        $InfoFleet.Buttons.Disband = this.createButton(
            "ButtonsFleet", Lang.fleets.Disband, this.DisbandFleet.bind(this), false, null, 'btn-danger');

        $InfoFleet.Buttons.append(
            $InfoFleet.Buttons.MoreDetails,
            $InfoFleet.Buttons.Task,
            $InfoFleet.Buttons.Disband
        );


        $InfoFleet.append(
            $InfoFleet.Name,
            $("<div>").append(Lang.fleets.Count + ": ", $InfoFleet.ShipsCount).addClass("Count"),
            $("<div>").append(Lang.fleets.Types + ": ", $InfoFleet.ShipsTypes).addClass("Types"),
            $("<div>").append(Lang.fleets.Speed + ": ", $InfoFleet.ShipsSpeed).addClass("Speed"),
            $("<div>").append(Lang.fleets.Capacity + ": ", $InfoFleet.ShipsCapacity).addClass("Capacity"),
            $("<div>").append(Lang.fleets.Experience + ": ", $InfoFleet.ShipsExperience).addClass("Experience"),
            $("<div>").append(Lang.fleets.Fuel + ": ", $InfoFleet.ShipsFuel).addClass("Fuel"),
            $("<div>").append(Lang.fleets.Cargo + ": ", $InfoFleet.ShipsCargo).addClass("Cargo"),
            $("<div>").append(Lang.fleets.Сonsumption + ": ", $InfoFleet.ShipsСonsumption).addClass("Сonsumption"),
            $InfoFleet.Buttons
        );

        return $InfoFleet;

    }

    createNewFleetBlock() {

        this.$ShipsBlock.NewFleetBlock = $("<div>").addClass("NewFleetBlock");

        if (!this.$ShipsBlock.InfoFleet) {
            this.$ShipsBlock.InfoFleet = this.createInfoFleet();
            this.$ShipsBlock.NewFleetBlock.append(this.$ShipsBlock.InfoFleet);
        }

        this.$ShipsBlock.NewFleetButtons = $("<div>").addClass("NewFleetButtons");
        this.$ShipsBlock.NewFleetButtons.ToOrbit = this.createButton(
            "ButtonsBuild", Lang.fleets.ToOrbit, this.createNewFleet.bind(this), false, null, 'btn-success');
        this.$ShipsBlock.NewFleetButtons.Clear = this.createButton(
            "ButtonsBuild", Lang.fleets.Clear, this.clearSelectElements.bind(this), false, null, 'btn-warning');
        this.$ShipsBlock.NewFleetButtons.append(this.$ShipsBlock.NewFleetButtons.ToOrbit, this.$ShipsBlock.NewFleetButtons.Clear);

        this.$ShipsBlock.NewFleetBlock.append(this.$ShipsBlock.NewFleetButtons);


        this.$ShipsBlock.append(this.$ShipsBlock.NewFleetBlock);
    }

    renderNewFleetBlock() {
        if (!this.$ShipsBlock.NewFleetBlock) {
            this.createNewFleetBlock();
        }



        let count = 0;
        let types = 0;
        let consumption = 0;
        let capacity = 0;
        let speeds = [];
        $.each(this.$Ships, (id, Ship) => {
            const ships = parseInt(Ship[0].Input.val());
            count += ships;
            if (ships > 0) {
                types++;
                speeds.push(Ship[0]._data.speed);
                consumption += Ship[0]._data.consumption * ships;
                capacity += Ship[0]._data.capacity * ships;
            }
        });

        this.$ShipsBlock.InfoFleet.ShipsCount.text(humanNumber(count, true, 2));
        this.$ShipsBlock.InfoFleet.ShipsTypes.text(humanNumber(types, true, 2));
        this.$ShipsBlock.InfoFleet.ShipsSpeed.text(humanNumber(speeds.length ? Math.min(...speeds) : 0, true, 2));
        this.$ShipsBlock.InfoFleet.ShipsCapacity.text(humanNumber(capacity, true, 2));
        this.$ShipsBlock.InfoFleet.ShipsСonsumption.text(humanNumber(consumption, true, 2));

        this.$ShipsBlock.InfoFleet.Name.hide();
        this.$ShipsBlock.InfoFleet.ShipsExperience.parent().hide();
        this.$ShipsBlock.InfoFleet.ShipsFuel.parent().hide();

        this.$ShipsBlock.InfoFleet.Buttons.hide();

        this.$ShipsBlock.NewFleetButtons.ToOrbit.attr('disabled', count === 0);
        this.$ShipsBlock.NewFleetButtons.Clear.attr('disabled', count === 0);
    }

    renderShips() {
        if (!this.$Ships) this.createShips();

        const PlanetShips = this.messageData.data.Page?.PlanetShips;

        $.each(PlanetShips, (id, ship) => {
            if (ship.count > 0) {
                this.createShip(id, ship);
            } else if (ship.count > 0) {
                this.$Ships[id][0].data = ship;
            }
        });



        // Удаляем исчезнувшие
        for (const id in this.$Ships) {
            if ((!PlanetShips[id] || PlanetShips[id].count <= 0) && this.$Ships[id].length > 0) {
                //this.$Ships[id].fadeOut(250, () => {
                this.$Ships[id].remove();
                delete this.$Ships[id];
                //});
            }
        }

        const shipsArray = Object.entries(this.$Ships);
        shipsArray.sort((a, b) => a[0] - b[0]);

        let last = null;
        shipsArray.forEach(([id, $ship]) => {
            if (last === null) {
                this.$ShipsPlanet.prepend($ship);
            } else {
                last.after($ship);
            }
            last = $ship;
        });

        this.renderNewFleetBlock();



    }

    async render() {
        await super.render();

        this.renderFleetsPlanet();
        this.renderShips();
    }
}
