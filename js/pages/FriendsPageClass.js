window.FriendsPageClass = class FriendsPageClass extends BasePageClass {
    Name = "FriendsPageClass";

    constructor() {
        super();
        this.$Layer.removeClass("accauntlayer").addClass("gamelayer");
        this.$Content.addClass("FriendsPage");
    }

    async render(generation = this.renderGeneration) {
        if (!await super.render(generation)) return;
        const page = this.messageData?.data?.Page;
        // ACK/bootstrap при reconnect может ещё не содержать snapshot страницы.
        if (!page) return;
        if (!this.$panel) {
            this.$panel = $("<section>").addClass("box FriendsPanel");
            this.$panel.append($("<header>").addClass("FriendsHeader").append($("<h2>").text("Друзья"),
                $("<button>", { type: "button", text: "Открыть галактику" }).addClass("btn-info")
                    .on("click", () => this.openGalaxy())));
            this.$panel.append($("<p>").addClass("FriendsHint").text("Чтобы добавить игрока, откройте его планету в галактике и выберите «Предложить дружбу»."));
            this.$Content.append(this.$panel);
        }
        for (const [index, [title, filter]] of [["Входящие заявки", x => !x.accepted && x.incoming], ["Друзья", x => x.accepted],
            ["Исходящие заявки", x => !x.accepted && !x.incoming]].entries()) {
            const rows = (page.Friends || []).filter(filter);
            let $section = this.$panel.children(".FriendsSection").eq(index);
            if (!$section.length) this.$panel.append($section = $("<section>").addClass("FriendsSection").append(
                $("<h3>").append(document.createTextNode(title), $("<span>").addClass("FriendsCount")),
                $("<p>").addClass("FriendsEmpty").text("Список пуст")));
            $section.find(".FriendsCount").text(rows.length);
            $section.find(".FriendsEmpty").toggle(!rows.length);
            for (const [position, friend] of rows.entries()) {
                let $row = this.$panel.find(`.FriendsRow[data-friend-id="${Number(friend.id)}"]`);
                if (!$row.length) $row = $("<article>").addClass("FriendsRow").attr("data-friend-id", friend.id).append(
                    $("<div>").addClass("FriendsInfo").append(
                        $("<strong>").addClass("FriendName"), $("<button>", { type: "button", class: "FriendCoordinates" }),
                        $("<span>").addClass("FriendOnline"), $("<time>").addClass("FriendRequestDate")),
                    $("<div>").addClass("FriendsActions").append(
                        $("<button>", { type: "button", class: "btn-success", text: "Принять" }),
                        $("<button>", { type: "button", class: "btn-danger" })),
                    $("<blockquote>").addClass("FriendRequestText"));
                $row.find(".FriendName").text(friend.name);
                const c = friend.coordinates;
                $row.find(".FriendCoordinates").toggle(Boolean(c)).text(c ? `[${c.galaxy}:${c.system}:${c.orbit}]` : "")
                    .attr("aria-label", `Показать ${friend.name} в галактике`).off("click.friend").on("click.friend", () => this.openGalaxy(c));
                $row.find(".FriendOnline").attr("class", `FriendOnline FriendOnline-${friend.online || "unknown"}`)
                    .text({ online: "В сети", recent: "Недавно в сети", offline: "Не в сети" }[friend.online] || "Активность неизвестна").toggle(Boolean(friend.accepted));
                $row.find(".FriendRequestDate").text(friend.createdAt ? formatTimestamp(friend.createdAt, "datetime") : "")
                    .toggle(!friend.accepted && Boolean(friend.createdAt));
                $row.find(".btn-success").toggle(!friend.accepted && Boolean(friend.incoming))
                    .off("click.friend").on("click.friend", () => this.change("accept", friend.id));
                $row.find(".btn-danger").text(friend.accepted ? "Удалить из друзей" : friend.incoming ? "Отклонить" : "Отменить заявку")
                    .off("click.friend").on("click.friend", () => this.removeFriend(friend));
                $row.find(".FriendRequestText").text(friend.text || "").toggle(!friend.accepted && Boolean(friend.text));
                const before = $section.children(".FriendsRow")[position];
                if (before !== $row[0]) this.placeElement($section[0], $row[0], before || null);
            }
        }
        const ids = new Set((page.Friends || []).map(friend => Number(friend.id)));
        this.$panel.find(".FriendsRow").each((_, row) => { if (!ids.has(Number(row.dataset.friendId))) $(row).remove(); });
    }

    openGalaxy(coordinates = null) {
        this.setActiveMode("galaxy", false);
        // Та же последовательность перехода, что в меню: прежняя страница
        // скрывается до ответа, иначе её fadeOut может очистить новую Galaxy.
        Overlay.Show(null, 250, () => {
            if (!this.pageActive) return;
            this.$Content.stop(true, true).fadeOut(250, () => {
                if (!this.pageActive) return;
                this.$Content.Show = false;
                GameEvents.emit("SendServer", { mode: "galaxy", data: coordinates
                    ? { galaxy: Number(coordinates.galaxy), system: Number(coordinates.system) } : {} });
            });
        });
    }

    removeFriend(friend) {
        if (!friend.accepted) { this.change("remove", friend.id); return; }
        const $content = $("<p>").text(`Удалить ${friend.name} из друзей? Оборона между вами станет недоступна; удерживаемые флоты начнут возврат после выхода из боя.`);
        Dialog.create($content, "Удалить из друзей", [
            { text: "Удалить", class: ["btn-danger"], action: () => { Dialog.close(); this.change("remove", friend.id); } },
            { text: "Отмена", action: () => Dialog.close() }
        ], { width: Math.min(400, Math.max(0, innerWidth - 20)), overlay: true });
    }

    /** Общий диалог вызывается и из галактики, не переключая открытую страницу. */
    static openRequest(player, { scope, maxLength = 500, onSuccess } = {}) {
        const userId = Number(player.userId);
        if (!Number.isSafeInteger(userId) || userId <= 0) return;
        const limit = Math.max(1, Math.trunc(Number(maxLength) || 500));
        const $form = $("<form>", { id: "FriendRequestForm" }).addClass("FriendRequestForm");
        const c = player.coordinates;
        const $recipient = $("<div>").addClass("FriendRequestRecipient").append($("<strong>").text(player.name || "Игрок"));
        if (c) $recipient.append($("<span>").addClass("FriendRequestCoordinates").text(`[${c.galaxy}:${c.system}:${c.orbit}]`));
        const $text = $("<textarea>", { id: "FriendRequestText", rows: 5, maxlength: limit * 2,
            placeholder: "Напишите игроку несколько слов…", "aria-label": "Текст заявки" });
        const $counter = $("<span>").addClass("FriendRequestCounter").text(`0 / ${limit}`);
        // JS/maxlength считают UTF-16 units, сервер — Unicode-символы.
        $text.on("input compositionend", event => {
            if (event.originalEvent?.isComposing) return;
            const characters = Array.from(String($text.val()));
            if (characters.length > limit) $text.val(characters.slice(0, limit).join(""));
            $counter.text(`${Math.min(characters.length, limit)} / ${limit}`);
        });
        const $feedback = $("<p>", { role: "status", "aria-live": "polite" }).addClass("FriendRequestFeedback").hide();
        const $send = $("<button>", { type: "submit", text: "Отправить заявку" }).addClass("btn-info");
        const $label = $("<label>", { for: "FriendRequestText" }).append(document.createTextNode("Сообщение"),
            $("<span>").text("необязательно"));
        $form.append($("<div>").addClass("FriendRequestBody").append($recipient, $label, $text, $counter, $feedback),
            $("<div>").addClass("FriendRequestButtons").append($send,
                $("<button>", { type: "button", text: "Закрыть" }).on("click", () => Dialog.close())));
        let pending = false;
        $form.on("submit", event => {
            event.preventDefault();
            if (pending) return;
            pending = true; $send.prop("disabled", true); $feedback.hide();
            GameEvents.emit("SendServer", { mode: "friends", action: "request", data: { id: userId, text: String($text.val()) },
                NotOverlay: true, scope, kind: "command",
                onSuccess: message => {
                    if (document.getElementById("FriendRequestForm") === $form[0]) {
                        $send.text("Отправлено"); $text.prop("disabled", true);
                        $feedback.removeClass("danger_text").addClass("success_text").text("Заявка отправлена. Ответ появится в разделе «Друзья».").show();
                    }
                    onSuccess?.(message);
                },
                onError: error => {
                    pending = false; $send.prop("disabled", false);
                    $feedback.removeClass("success_text").addClass("danger_text").text(error?.message || "Не удалось отправить заявку.").show();
                }
            });
        });
        // Кнопки уже находятся в форме: пустой footer диалога здесь не нужен.
        Dialog.create($form, "Заявка в друзья", null, { width: Math.min(420, Math.max(0, innerWidth - 20)), overlay: true });
    }

    change(action, id) {
        if (this.submitting) return;
        if (!Number.isSafeInteger(id) || id <= 0) return;
        this.submitting = true;
        this.$Content.find("button").prop("disabled", true);
        const finish = () => { this.submitting = false; this.$Content.find("button").prop("disabled", false); };
        GameEvents.emit("SendServer", { mode: "friends", action, data: { id }, NotOverlay: true,
            ...this.getRequestOptions({ kind: "command" }),
            onSuccess: message => { finish(); this.Show("friends", message); },
            onError: error => { finish(); Dialog.ErrorLoad(error?.message || "Не удалось изменить список друзей."); }
        });
    }
};
