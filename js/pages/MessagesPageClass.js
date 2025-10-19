window.MessagesPageClass = class MessagesPageClass extends BasePageClass {


    Name = "MessagesPageClass";

    CurrentShowType = 0;

    constructor() {

        console.log("constructor MessagesPageClass");

        super();

        this.$Layer.toggleClass("accauntlayer", false);
        this.$Layer.toggleClass("gamelayer", true);
        //this.GeneretContainer();

        //if (!GameLayer) GameLayer = new GameLayerClass();

        //GameLayer.Show();

        this.$Content.addClass("Messages");

        const event = (e) => {

            const action = e.detail.action;
            switch (action) {
                case "show":
                    this.renderMessages(e.detail.type);
                    break;
                case "read":
                    GameEvents.emit("SendServer", {
                        mode: "messages",
                        action: "read",
                        NotOverlay: true,
                        data: { ReadId: e.detail.ReadId }
                    });

                    break;
            };
        };

        GameEvents.off("MessagesAction");
        GameEvents.on("MessagesAction", event);
    }

    CreateTypes() {
        const Types = this.messageData.data.Page?.messageTypes;
        if (!Types) return;
        this.$Content.Types = $("<div>").addClass("MessageTypesBox");
        $.each(Types, (index, value) => {
            this.$Content.Types[value.id] = $("<div>").addClass("box MessageTypeBox");

            this.$Content.Types[value.id].Name = $("<div>").text(Lang[value.label]);
            this.$Content.Types[value.id].Count = $("<div>").text('0/0');

            this.$Content.Types[value.id].append(this.$Content.Types[value.id].Name, this.$Content.Types[value.id].Count);

            this.$Content.Types[value.id].off("click").on("click", () => {
                GameEvents.emit("MessagesAction", { action: "show", type: value.id });
            });

            this.$Content.Types.append(this.$Content.Types[value.id]);
        });
        this.$Content.append(this.$Content.Types);

    }

    renderTypes() {
        if (!this.$Content?.Types || this.$Content.Types.length === 0) {
            this.CreateTypes();
        }

        $.each(this.messageData.data.Page?.messageTypes, (index, value) => {
            const countAll = (value.id === 99) ?
                this.messageData.data.Page?.allMessages.length :
                $.grep(this.messageData.data.Page?.allMessages, msg => msg.type === value.id).length;
            const countUnRead = (value.id === 99) ?
                $.grep(this.messageData.data.Page?.allMessages, msg => msg.read === 0).length :
                $.grep(this.messageData.data.Page?.allMessages, msg => msg.type === value.id && msg.read === 0).length;

            this.$Content.Types[value.id].Name.text(Lang.notifications.types[value.key]);
            this.$Content.Types[value.id].Count.text(countUnRead + "/" + countAll);
        });
    }

    CreateMessagesBox() {
        this.$Content.MessagesBox = $("<div>").addClass("box MessagesBox").hide();

        this.$Content.append(this.$Content.MessagesBox);
    }

    CreateMessage(Message) {
        let $Message = this.createDiv("", "Message" + Message.id, "box Message");

        let $Head = this.createDiv("", "MessageHead" + Message.id, "MessageHead");
        let $Date = this.createSpan(formatTimestamp(Message.time, "datetime"), "MessageDate" + Message.id, "box MessageDate");

        let Subject = (Message.from_id === 0) ? Lang['notifications.' + Message.subject] : "";
        let From = (Message.from_id === 0) ? Lang['notifications.' + Message.from] : "";

        let $From = this.createSpan(Lang.From + ": " + From, "MessageFrom" + Message.id, "box MessageFrom");
        let $Subject = this.createSpan(Lang.Subject + ": " + Subject, "MessageSubject" + Message.id, "box MessageSubject");

        $Head.append($Date, $From, $Subject);

        let Text = Message.text;
        if (!Text) {
            const data = JSON.parse(Message.data);
            Text = Lang.notifications.sample[Message.sample]

            let replaceData = {};
            $.each(data, (index, value) => {
                if (index === 'lang') {
                    $.each(value, (key, val) => {
                        if (typeof val === "string" && val.startsWith("Element.")) {
                            replaceData[key] = Lang.tech[Number(val.split('.')[1])];
                        } else {
                            replaceData[key] = Lang['notifications.' + val];

                        }
                    });

                } else if (index.startsWith("Resources")) {
                    let Resources = this.createDiv("", index + Message.id, "box Message" + index);
                    $.each(value, (res, valres) => {
                        let itemsStorage = this.createDiv(humanNumber(valres, true, 3), "Res_" + res, `ResBox icon${res}`);
                        Resources.append(itemsStorage);
                    });
                    replaceData[index] = Resources.html();
                } else {
                    replaceData[index] = "" + value;
                }
            });
            Text = Text.replace(/\{(\w+)\}/g, (_, key) => replaceData[key] || `{${key}}`);
        }
        let $Text = this.createDiv("", "MessageText" + Message.id, "MessageText").html(Text);

        return $Message.append($Head, $Text);
    }

    renderMessages(type) {
        if (!this.$Content?.MessagesBox || this.$Content.MessagesBox.length === 0) {
            this.CreateMessagesBox();
        }

        this.CurrentShowType = type;
        let ReadId = [];
        this.$Content.MessagesBox.stop(true, true).fadeOut(250, () => {
            this.$Content.MessagesBox.empty()

            const Messages = (type === 99) ? this.messageData.data.Page?.allMessages : $.grep(this.messageData.data.Page?.allMessages, msg => msg.type === type)

            if (!Messages || Messages.length === 0) return;

            $.each(Messages, (index, Message) => {
                this.$Content.MessagesBox.append(this.CreateMessage(Message));
                if (Message.read === 0) ReadId.push(Message.id);
            });


            GameEvents.emit("MessagesAction", { action: "read", ReadId: ReadId });

            this.$Content.MessagesBox.stop(true, true).fadeIn(250);

        });
    }


    async render() {

        await super.render();

        this.renderTypes();

    }


}