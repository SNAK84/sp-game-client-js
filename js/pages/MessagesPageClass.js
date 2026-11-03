window.MessagesPageClass = class MessagesPageClass extends BasePageClass {


    Name = "MessagesPageClass";

    CurrentShowType = 99;
    SelectedIds = new Set();
    ExpandedIds = new Set();
    PendingReadIds = new Set();
    DeletingIds = new Set();
    ListPage = 1;
    PageSize = 20;
    deleteSubmitting = false;

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
                    this.markRead(e.detail.ReadId);
                    break;
            };
        };

        GameEvents.off("MessagesAction");
        GameEvents.on("MessagesAction", event);
    }

    CreateTypes() {
        const Types = this.messageData.data.Page?.messageTypes;
        if (!Types) return;
        this.$Content.Panel = $("<section>").addClass("box MessagesPanel");
        this.$Content.HeadingCount = $("<span>").addClass("MessagesHeadingCount");
        this.$Content.Panel.append($("<header>").addClass("MessagesHeading").append(
            $("<h2>").text(Lang.messages.Title), this.$Content.HeadingCount,
            $("<button>", { type: "button", text: Lang.battleReport.SavedTitle })
                .addClass("btn-info MessagesSavedReports").on("click", () => BattleReportsUI.saved())
        ));
        this.$Content.Types = $("<div>").addClass("MessageTypesBox");
        $.each([...Types].sort((a, b) => (b.id === 99) - (a.id === 99)), (index, value) => {
            this.$Content.Types[value.id] = $("<button>", { type: "button", "data-message-type": value.id }).addClass("MessageTypeBox");

            this.$Content.Types[value.id].Name = $("<span>");
            this.$Content.Types[value.id].Count = $("<span>").addClass("MessageTypeCount");

            this.$Content.Types[value.id].append(this.$Content.Types[value.id].Name, this.$Content.Types[value.id].Count);

            this.$Content.Types[value.id].off("click").on("click", () => {
                GameEvents.emit("MessagesAction", { action: "show", type: value.id });
            });

            this.$Content.Types.append(this.$Content.Types[value.id]);
        });
        this.$Content.SelectAll = $("<input>", { type: "checkbox", "aria-label": Lang.messages.SelectPage })
            .on("change", event => {
                this.visibleMessages().forEach(message => {
                    if (this.DeletingIds.has(message.id)) return;
                    if (event.target.checked) this.SelectedIds.add(message.id);
                    else this.SelectedIds.delete(message.id);
                });
                this.$Content.MessagesBox.find(".MessageCheckbox").each((_, element) => {
                    element.checked = this.SelectedIds.has(Number(element.dataset.messageId));
                });
                this.updateSelectionControls();
            });
        this.$Content.SelectionCount = $("<span>").addClass("MessagesSelectionCount");
        this.$Content.DeleteSelected = $("<button>", { type: "button" }).addClass("btn-danger MessagesDeleteSelected")
            .on("click", () => this.confirmDelete([...this.SelectedIds]));
        const $toolbar = $("<div>").addClass("MessagesToolbar").append(
            $("<label>").addClass("MessagesSelectAll").append(this.$Content.SelectAll,
                $("<span>").text(Lang.messages.SelectPage)),
            this.$Content.SelectionCount, this.$Content.DeleteSelected
        );
        this.$Content.Panel.append(this.$Content.Types, $toolbar);
        this.$Content.append(this.$Content.Panel);
        this.CreateMessagesBox();
        this.$Content.Pagination = $("<nav>", { "aria-label": Lang.messages.Pages }).addClass("MessagesPagination");
        this.$Content.Panel.append(this.$Content.Pagination);

    }

    renderTypes() {
        if (!this.$Content.children(".MessagesPanel").length) {
            this.CreateTypes();
        }

        const messages = this.getMessages();
        const unread = messages.filter(message => message.read === 0).length;
        this.$Content.HeadingCount.text(`${Lang.messages.New}: ${unread} · ${Lang.messages.Total}: ${messages.length}`);
        $.each(this.messageData.data.Page?.messageTypes, (index, value) => {
            const countAll = (value.id === 99) ?
                messages.length : messages.filter(msg => msg.type === value.id).length;
            const countUnRead = (value.id === 99) ?
                unread : messages.filter(msg => msg.type === value.id && msg.read === 0).length;

            this.$Content.Types[value.id].Name.text(Lang.notifications.types[value.key]);
            this.$Content.Types[value.id].Count.text(countUnRead + "/" + countAll);
            this.$Content.Types[value.id].toggleClass("MessageTypeActive", value.id === this.CurrentShowType)
                .toggleClass("MessageTypeHasUnread", countUnRead > 0)
                .attr("aria-pressed", String(value.id === this.CurrentShowType));
        });
    }

    CreateMessagesBox() {
        this.$Content.MessagesBox = $("<div>").addClass("MessagesBox");

        this.$Content.Panel.append(this.$Content.MessagesBox);
    }

    CreateMessage(Message, $existing = null) {
        const Subject = (Message.from_id === 0 ? Lang['notifications.' + Message.subject] : Message.subject)
            || Lang.messages.NoSubject;
        const From = (Message.from_id === 0 ? Lang['notifications.' + Message.from] : Message.from)
            || Lang.messages.System;
        if ($existing) {
            $existing.toggleClass("MessageUnread", Message.read === 0);
            $existing.find(".MessageSubject").text(Subject);
            $existing.find(".MessageFrom").text(From);
            $existing.find(".MessageDate").text(formatTimestamp(Message.time, "datetime"));
            $existing.find(".MessageCheckbox").prop("checked", this.SelectedIds.has(Message.id))
                .attr("aria-label", `${Lang.messages.Select}: ${Subject}`);
            $existing.find(".MessageOpen").attr("aria-expanded", String(this.ExpandedIds.has(Message.id)));
            $existing.find(".MessageText").toggle(this.ExpandedIds.has(Message.id));
            return $existing;
        }
        const $Message = this.createDiv("", "Message" + Message.id, "Message")
            .attr("data-message-id", Message.id).toggleClass("MessageUnread", Message.read === 0);
        const $checkbox = $("<input>", { type: "checkbox", "aria-label": `${Lang.messages.Select}: ${Subject}` })
            .addClass("MessageCheckbox").attr("data-message-id", Message.id)
            .prop("checked", this.SelectedIds.has(Message.id)).on("change", event => {
                if (event.target.checked) this.SelectedIds.add(Message.id);
                else this.SelectedIds.delete(Message.id);
                this.updateSelectionControls();
            });
        const expanded = this.ExpandedIds.has(Message.id);
        const $open = $("<button>", { type: "button", "aria-expanded": String(expanded),
            "aria-controls": "MessageText" + Message.id }).addClass("MessageOpen");
        $open.append($("<span>").addClass("MessageSubject").text(Subject),
            $("<span>").addClass("MessageMeta").append(
                $("<span>").addClass("MessageFrom").text(From),
                $("<time>").addClass("MessageDate").text(formatTimestamp(Message.time, "datetime"))));
        const $delete = $("<button>", { type: "button", "aria-label": Lang.messages.Delete })
            .addClass("MessageDelete mdi mdi-trash-can-outline")
            .on("click", () => this.confirmDelete([Message.id]));
        if (!isTouch) $delete.ToolTip(Lang.messages.Delete);
        const $Head = $("<header>").addClass("MessageHead").append($checkbox, $open, $delete);

        const $Text = this.createDiv("", "MessageText" + Message.id, "MessageText");
        if (Message.text) {
            $Text.text(String(Message.text));
        } else try {
            const data = { ...(typeof Message.data === "string" ? JSON.parse(Message.data || "{}") : Message.data || {}) };
            // В старых сообщениях имени ещё нет: не подставляем новое имя в историю.
            if (data.FleetId !== undefined && !data.FleetName) data.FleetName = `Флот #${data.FleetId}`;
            const template = String(Lang.notifications.sample[Message.sample] || Lang.messages.UnavailableBody);
            // Старые уведомления не хранят сведения о технологии на момент остановки.
            const replaceData = Message.sample === "FleetFuelStopped" ? { CargoRefuelAdvice: "" } : {};

            $.each(data, (index, value) => {
                if (index === "lang") {
                    $.each(value, (key, val) => {
                        if (typeof val === "string" && val.startsWith("Element.")) {
                            replaceData[key] = Lang.tech[Number(val.split(".")[1])];
                        } else if (typeof val === "string" && val.startsWith("fleet_command.")) {
                            replaceData[key] = Lang[val];
                        } else {
                            replaceData[key] = Lang["notifications." + val];
                        }
                    });
                } else if (index === "SpyReport") {
                    replaceData[index] = this.createSpyReport(value);
                } else if (index.startsWith("Resources")) {
                    const resources = this.createDiv("", index + Message.id, "box Message" + index);
                    $.each(value, (res, valres) => {
                        const itemsStorage = this.createDiv(
                            humanNumber(valres, true, 3),
                            "Res_" + res,
                            "ResBox icon" + res
                        );
                        resources.append(itemsStorage);
                    });
                    replaceData[index] = resources;
                } else {
                    replaceData[index] = String(value);
                }
            });

            if (Message.sample === "FleetExpeditionSummary" && Lang.notifications.expeditionReport) {
                $Text.append(this.createExpeditionReport(data));
            } else template.split(/(\{\w+\})/g).forEach(part => {
                const match = part.match(/^\{(\w+)\}$/);
                if (!match) {
                    $Text.append(document.createTextNode(part));
                    return;
                }

                const value = replaceData[match[1]];
                if (value && value.jquery) {
                    $Text.append(value);
                } else {
                    $Text.append(document.createTextNode(value ?? part));
                }
            });
            if (["FleetBattleReport", "FleetExpeditionResult", "FleetExpeditionSummary"].includes(Message.sample) && Number(data.ReportVersion) === 1) {
              const battleIds = [...new Set(Array.isArray(data.BattleIds) ? data.BattleIds : [data.BattleId])]
                  .filter(id => typeof id === "string" && /^[a-f0-9]{32}$/.test(id));
              battleIds.forEach((battleId, index) => {
                $Text.append($("<a>", { href: BattleReportsUI.link(battleId), text: Lang.battleReport.Open + (battleIds.length > 1 ? ` ${index + 1}` : "") })
                    .addClass("MessageBattleReport btn-info").on("click", event => {
                        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        BattleReportsUI.show(battleId);
                    }));
              });
            }
        } catch (error) {
            $Text.text(Lang.messages.UnavailableBody);
            console.warn("Не удалось прочитать данные сообщения", Message.id);
        }
        $Text.toggle(expanded);
        $open.on("click", () => {
            const show = !this.ExpandedIds.has(Message.id);
            if (show) this.ExpandedIds.add(Message.id);
            else this.ExpandedIds.delete(Message.id);
            $Text.toggle(show);
            $open.attr("aria-expanded", String(show));
            if (show && this.getMessages().find(item => item.id === Message.id)?.read === 0) this.markRead([Message.id]);
        });
        return $Message.append($Head, $Text);
    }

    createSpyReport(report) {
        const $report = $("<div>").addClass("SpyReport");
        const labels = Lang.notifications.spy;
        const isResourceBase = report?.targetKind === "resource_base";
        if (isResourceBase) {
            const snapshotTime = report.snapshotAt ? ` · ${formatTimestamp(report.snapshotAt, "datetime")}` : "";
            $report.append($("<div>").addClass("box SpyReportSection").text(`${labels.ResourceBaseSnapshot}${snapshotTime}`));
        }
        const sections = isResourceBase ? ["ships", "research"] : ["resources", "ships", "defense", "buildings", "research"];
        sections.forEach(section => {
            const $section = $("<div>").addClass("box SpyReportSection");
            $section.append($("<div>").addClass("SpyReportHeading").text(labels[section]));
            const values = report?.sections?.[section];
            if (!values) {
                $section.append($("<span>").text(labels.Unknown));
            } else {
                const $values = $("<div>").addClass("SpyReportValues");
                Object.entries(values).forEach(([id, count]) => {
                    $values.append($("<span>").text(Lang.tech?.[Number(id)] || id),
                        $("<span>").text(humanNumber(Number(count), true, 3)));
                });
                $section.append($values);
            }
            $report.append($section);
        });
        if (report?.destroyed && report?.debris) {
            const $debris = $("<div>").addClass("SpyReportDebris box").append($("<div>").text(labels.Debris));
            Object.entries(report.debris).forEach(([id, count]) =>
                $debris.append($("<span>").addClass(`ResBox icon${id}`).text(humanNumber(Number(count), true, 3))));
            $report.append($debris);
        }
        $report.append($("<div>").text(`${labels.CounterChance}: ${Number(report?.counterChance) || 0}%`));
        return $report;
    }

    createExpeditionReport(data) {
        const labels = Lang.notifications.expeditionReport;
        const format = (text, values) => String(text).replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
        const $report = $("<div>").addClass("ExpeditionReport");
        $report.append($("<p>").addClass("ExpeditionReportIntro").text(format(labels.Intro, data)));
        const resources = Object.entries(data.ResourcesFound || {}).filter(([, count]) => Number(count) > 0);
        const hasShips = !!data.ShipsFound && data.ShipsFound !== "—";
        const factor = Number(data.TimeFactor);
        const timeText = Number.isFinite(factor) && factor > 0 && factor !== 1
            ? format(factor > 1 ? labels.TimeSlower : labels.TimeFaster,
                { Factor: humanNumber(factor > 1 ? factor : 1 / factor, true, 2) }) : "";
        // Старые сообщения не содержат EventCounts: их итоги и находки тоже доступны.
        const counts = data.EventCounts;
        if (counts && typeof counts === "object") {
            Object.entries(counts).forEach(([event, count]) => {
                let key = event;
                if (event === "resources" && !resources.some(([id]) => Number(id) !== 921)) key = "resourcesEmpty";
                if (event === "ships" && !hasShips) key = "shipsEmpty";
                const text = event === "time" && timeText ? timeText : labels.events[key];
                if (!text || Number(count) <= 0) return;
                const $event = $("<p>").addClass("ExpeditionReportEvent").text(text);
                if (Number(count) > 1) $event.append($("<span>").addClass("ExpeditionReportRepeat").text(` ×${count}`));
                $report.append($event);
            });
        } else if (data.EventsSummary) {
            $report.append($("<p>").text(data.EventsSummary));
        }
        const addResources = (title, values) => {
            const entries = Object.entries(values || {}).filter(([, count]) => Number(count) > 0);
            if (!entries.length) return;
            const $section = $("<section>").addClass("ExpeditionReportFinds")
                .append($("<div>").addClass("ExpeditionReportLabel").text(title));
            const $values = $("<div>").addClass("ExpeditionReportResources");
            entries.forEach(([id, count]) => $values.append($("<span>").addClass(`ResBox icon${Number(id)}`)
                .text(humanNumber(Number(count), true, 3))));
            $report.append($section.append($values));
        };
        addResources(labels.ResourcesFound, data.ResourcesFound);
        if (hasShips) $report.append($("<section>").addClass("ExpeditionReportFinds").append(
            $("<div>").addClass("ExpeditionReportLabel").text(labels.ShipsFound),
            $("<div>").text(data.ShipsFound)));
        if (timeText && !counts?.time) $report.append($("<p>").text(timeText));
        const state = data.lang?.FleetState;
        if (state !== "expedition.destroyed") addResources(labels.ResourcesOnboard, data.ResourcesOnboard);
        if (state) $report.append($("<p>").addClass("ExpeditionReportState")
            .toggleClass("ExpeditionReportLost", state === "expedition.destroyed")
            .text(Lang["notifications." + state]));
        return $report;
    }

    getMessages() {
        return this.messageData.data.Page?.allMessages || [];
    }

    filteredMessages() {
        return this.getMessages().filter(message => this.CurrentShowType === 99 || message.type === this.CurrentShowType);
    }

    visibleMessages() {
        return this.filteredMessages().slice((this.ListPage - 1) * this.PageSize, this.ListPage * this.PageSize);
    }

    renderMessages(type = this.CurrentShowType) {
        if (this.CurrentShowType !== type) {
            this.CurrentShowType = type;
            this.ListPage = 1;
            this.SelectedIds.clear();
        }
        this.renderTypes();
        const total = this.filteredMessages().length;
        const pages = Math.max(1, Math.ceil(total / this.PageSize));
        this.ListPage = Math.min(this.ListPage, pages);
        const existing = new Map(this.$Content.MessagesBox.children(".Message").get().map(row => [Number(row.dataset.messageId), row]));
        this.visibleMessages().forEach((message, index) => {
            const old = existing.get(Number(message.id));
            const $row = this.CreateMessage(message, old ? $(old) : null);
            const before = this.$Content.MessagesBox.children(".Message")[index];
            if (before !== $row[0]) this.placeElement(this.$Content.MessagesBox[0], $row[0], before || null);
            existing.delete(Number(message.id));
        });
        existing.forEach(row => { if (row.contains(ToolTip.parent)) ToolTip.hide(); $(row).remove(); });
        let $empty = this.$Content.MessagesBox.children(".MessagesEmpty");
        if (!$empty.length) this.$Content.MessagesBox.append($empty = $("<div>").addClass("MessagesEmpty"));
        $empty.text(Lang.messages.Empty).toggle(!total);
        this.$Content.Pagination.toggle(total > this.PageSize);
        if (!this.$Content.Pagination.children().length) {
            const button = (text, delta, disabled) => $("<button>", { type: "button", text, disabled })
                .on("click", () => { this.ListPage += delta; this.renderMessages(); });
            this.$Content.Pagination.append(button(Lang.messages.Previous, -1, true),
                $("<span>"), button(Lang.messages.Next, 1, true));
        }
        this.$Content.Pagination.children("button").first().text(Lang.messages.Previous).prop("disabled", this.ListPage === 1);
        this.$Content.Pagination.children("span").text(`${this.ListPage} / ${pages}`);
        this.$Content.Pagination.children("button").last().text(Lang.messages.Next).prop("disabled", this.ListPage === pages);
        this.updateSelectionControls();
    }

    updateSelectionControls() {
        const visible = this.visibleMessages().filter(message => !this.DeletingIds.has(message.id));
        const selected = visible.filter(message => this.SelectedIds.has(message.id)).length;
        this.$Content.SelectAll.prop({ checked: visible.length > 0 && selected === visible.length,
            indeterminate: selected > 0 && selected < visible.length,
            disabled: visible.length === 0 || this.deleteSubmitting });
        this.$Content.SelectionCount.text(this.SelectedIds.size ? `${Lang.messages.Selected}: ${this.SelectedIds.size}` : Lang.messages.CountHint);
        this.$Content.DeleteSelected.text(this.deleteSubmitting || this.DeletingIds.size
            ? Lang.messages.Deleting : `${Lang.messages.DeleteSelected}${this.SelectedIds.size ? ` (${this.SelectedIds.size})` : ""}`)
            .prop("disabled", this.SelectedIds.size === 0 || this.deleteSubmitting || this.DeletingIds.size > 0);
        this.$Content.MessagesBox.find(".Message").each((_, element) => {
            const disabled = this.deleteSubmitting || this.DeletingIds.has(Number(element.dataset.messageId));
            $(element).toggleClass("MessageDeleting", this.DeletingIds.has(Number(element.dataset.messageId)))
                .find(".MessageCheckbox, .MessageDelete").prop("disabled", disabled);
        });
    }

    markRead(ids) {
        const unread = ids.filter(id => !this.PendingReadIds.has(id));
        if (!unread.length) return;
        unread.forEach(id => this.PendingReadIds.add(id));
        GameEvents.emit("SendServer", { mode: "messages", action: "read", NotOverlay: true,
            data: { ReadId: unread }, ...this.getRequestOptions({ kind: "command" }),
            onSuccess: () => {},
            onError: error => {
                unread.forEach(id => this.PendingReadIds.delete(id));
                Dialog.ErrorLoad(error?.message || Lang.messages.ActionFailed);
            }
        });
    }

    confirmDelete(ids) {
        if (this.deleteSubmitting || this.DeletingIds.size) return;
        const available = new Set(this.getMessages().map(message => message.id));
        ids = [...new Set(ids)].filter(id => available.has(id));
        if (!ids.length) return;
        const $content = $("<div>").addClass("MessagesDeleteConfirm")
            .text(Lang.messages.ConfirmText.replace("{count}", ids.length));
        Dialog.create($content, Lang.messages.ConfirmTitle, [
            { text: Lang.messages.Delete, class: ["btn-danger"], action: () => {
                if (!this.pageActive) return;
                Dialog.close();
                this.deleteMessages(ids);
            } },
            { text: Lang.Cancel, action: () => Dialog.close() }
        ], { width: Math.min(340, document.documentElement.clientWidth - 20), overlay: true });
    }

    deleteMessages(ids) {
        this.deleteSubmitting = true;
        ids.forEach(id => this.DeletingIds.add(id));
        this.updateSelectionControls();
        const batchSize = Math.min(10, Number(this.messageData.data.Page?.deleteBatchSize) || 10);
        const send = offset => {
            const batch = ids.slice(offset, offset + batchSize);
            GameEvents.emit("SendServer", { mode: "messages", action: "delete", NotOverlay: true,
                data: { Ids: batch }, ...this.getRequestOptions({ kind: "command" }),
                onSuccess: () => {
                    if (offset + batchSize < ids.length) send(offset + batchSize);
                    else { this.deleteSubmitting = false; this.updateSelectionControls(); }
                },
                onError: error => {
                    ids.slice(offset).forEach(id => this.DeletingIds.delete(id));
                    this.deleteSubmitting = false;
                    this.updateSelectionControls();
                    Dialog.ErrorLoad(error?.message || Lang.messages.ActionFailed);
                }
            });
        };
        send(0);
    }

    async render(generation = this.renderGeneration) {

        if (!await super.render(generation)) return;

        const existing = new Map(this.getMessages().map(message => [message.id, message]));
        for (const set of [this.SelectedIds, this.ExpandedIds, this.DeletingIds]) {
            for (const id of set) if (!existing.has(id)) set.delete(id);
        }
        for (const id of this.PendingReadIds) if (!existing.has(id) || existing.get(id).read !== 0) this.PendingReadIds.delete(id);
        const scrollTop = this.$Content.scrollTop();
        this.renderMessages();
        this.$Content.scrollTop(scrollTop);

    }

    Hide() {
        this.SelectedIds.clear();
        this.ExpandedIds.clear();
        this.PendingReadIds.clear();
        this.DeletingIds.clear();
        this.deleteSubmitting = false;
        super.Hide();
    }

}
