// Архивный snapshot не изменяет Page, её request routing и локальное игровое состояние.
window.BattleReportsUI = new class {
    sequence = 0;
    linkedOpened = false;

    text() { return { ...Lang.battleReport, ...Lang.battleReportView }; }
    number(value) { return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 }); }
    coordinate(value) {
        if (!value) return "—";
        if (value.orbit != null) return `[${value.galaxy}:${value.system}:${value.orbit}]`;
        const system = `[${value.galaxy}:${value.system}]`;
        if (value.distance != null && value.angle != null) {
            return `${system} ${this.number(value.distance)} / ${this.number(value.angle)}°`;
        }
        return system;
    }
    link(id) {
        const url = new URL("/", window.location.origin);
        url.searchParams.set("battle", id);
        return url.href;
    }

    openLinkedReport() {
        if (this.linkedOpened || !Data.token || !Page || Page.Name === "LoginPageClass") return;
        const id = new URL(window.location.href).searchParams.get("battle");
        if (!id) return;
        this.linkedOpened = true;
        this.show(id);
    }

    async dialog(title, request, render) {
        const sequence = ++this.sequence;
        const owner = Page;
        await Lang.waitLangs();
        if (sequence !== this.sequence || Page !== owner || !owner?.pageActive) return;
        const $root = $("<article>").addClass("BattleReport").text(this.text().Loading);
        Dialog.create($root, title(), [{ text: Lang.Close, action: () => { ++this.sequence; Dialog.close(); },
            class: ["btn-warning"] }], { width: Math.min(980, window.innerWidth - 24), overlay: true });
        const current = () => sequence === this.sequence && Page === owner && owner.pageActive
            && $.contains(Dialog.dialogDiv, $root[0]);
        const receive = response => {
            if (!current()) return;
            $root.empty();
            render($root, response.data.Page, current);
            Dialog.dialogDiv.style.height = "auto";
            Dialog.dialogDiv.style.minHeight = "0";
            Dialog.centerDialog();
        };
        WS.Submit("battlereport", request.action, request.data, {
            scope: owner.requestScope, latestKey: "battle-report", kind: "read", onSuccess: receive,
            onError: error => { if (current()) $root.text(error.message).addClass("red_text"); }
        });
    }

    show(id) {
        return this.dialog(() => this.text().Title, { action: "get", data: { id } },
            ($root, data, current) => this.render($root, data, current));
    }

    saved(page = 1) {
        return this.dialog(() => this.text().SavedTitle, { action: "list", data: { page } }, ($root, data) => {
            const text = this.text();
            if (!data.reports.length) $root.append($("<p>").text(text.Empty));
            data.reports.forEach(item => {
                const summary = item.summary;
                $root.append($("<button>", { type: "button" }).addClass("BattleReportSavedRow").append(
                    $("<span>").text(`${summary.TargetCoordinate} · ${Lang["notifications." + summary.lang.Outcome]}`),
                    $("<time>").text(formatTimestamp(item.createdAt, "datetime"))
                ).on("click", () => this.show(item.id)));
            });
            const $nav = $("<nav>").addClass("BattleReportActions");
            if (data.page > 1) $nav.append($("<button>", { type: "button", text: text.Previous }).on("click", () => this.saved(data.page - 1)));
            $nav.append($("<span>").text(`${text.Page} ${data.page}`));
            if (data.hasMore) $nav.append($("<button>", { type: "button", text: text.Next }).on("click", () => this.saved(data.page + 1)));
            $root.append($nav);
        });
    }

    groupName(group) { return Lang.tech[group.type] || `#${group.type}`; }

    // Только соответствие существующим изображениям, не игровые характеристики/правила.
    unitImages = {
        202: "small_ship_cargo", 203: "big_ship_cargo", 204: "light_hunter", 205: "heavy_hunter",
        206: "crusher", 207: "battle_ship", 208: "colonizer", 209: "recycler", 210: "spy_sonde",
        211: "bomber_ship", 212: "solar_satelit", 213: "destructor", 214: "dearth_star", 215: "battleship",
        216: "lune_noir", 217: "ev_transporter", 219: "giga_recykler",
        401: "misil_launcher", 402: "small_laser", 403: "big_laser", 404: "gauss_canyon", 405: "ionic_canyon",
        406: "buster_canyon", 407: "small_protection_shield", 408: "big_protection_shield",
        409: "planet_protector", 410: "graviton_canyon", 411: "orbital_station"
    };

    visual(group) {
        const $visual = $("<div>").addClass("BattleReportUnitVisual").attr("aria-hidden", "true").append(
            $("<i>").addClass(`mdi ${group.kind === "defense" ? "mdi-shield-outline" : "mdi-rocket-launch-outline"}`)
        );
        const name = this.unitImages[group.type];
        if (name) $visual.append($("<img>", { src: `/images/${group.kind === "defense" ? "defenses" : "fleets"}/${name}.gif`,
            alt: "", loading: "lazy", decoding: "async", width: 72, height: 72 }).on("error", event => $(event.currentTarget).remove()));
        return $visual;
    }

    participantName(participant) {
        const text = this.text();
        return `${participant.userName || `${text.Player} #${participant.userId}`} · ${participant.fleetId
            ? participant.fleetName || `${text.Fleet} #${participant.fleetId}` : participant.fleetName} ${this.coordinate(participant.coordinate)}`;
    }

    resources(values) {
        const $row = $("<div>").addClass("BattleReportResources");
        Object.entries(values).forEach(([id, count]) => $row.append($("<div>").addClass("BattleReportResource").append(
            $("<span>").addClass(`ResBox icon${Number(id)}`).attr("aria-hidden", "true"),
            $("<span>").addClass("BattleReportResourceName").text(Lang.tech[id] || id),
            $("<strong>").text(this.number(count))
        )));
        return $row;
    }

    metric(label, value, className = "") {
        return $("<div>").addClass(`BattleReportMetric ${className}`).append(
            $("<dt>").text(label), $("<dd>").text(value));
    }

    sideTotals(report, side) {
        return Object.values(report.groups).filter(group => group.side === side).reduce((total, group) => ({
            before: total.before + group.before, survived: total.survived + group.survived,
            restored: total.restored + group.restored, lost: total.lost + group.lost,
            experience: total.experience + group.experienceGained
        }), { before: 0, survived: 0, restored: 0, lost: 0, experience: 0 });
    }

    survivalBar(total) {
        const text = this.text();
        const $bar = $("<div>").addClass("BattleReportSurvival").attr({ role: "img",
            "aria-label": `${text.Survived}: ${this.number(total.survived)}, ${text.Restored}: ${this.number(total.restored)}, ${text.Lost}: ${this.number(total.lost)}` });
        if (!total.before) return $bar.addClass("BattleReportSurvivalEmpty");
        [["survived", total.survived], ["restored", total.restored], ["lost", total.lost]].forEach(([key, value]) => {
            $bar.append($("<span>").addClass(`BattleReportSurvival-${key}`).css("width", `${value / total.before * 100}%`));
        });
        return $bar;
    }

    unit(group) {
        const text = this.text();
        const $unit = $("<article>").addClass("BattleReportUnit").attr("data-unit-type", group.type)
            .toggleClass("BattleReportUnitDestroyed", group.before > 0 && group.survived + group.restored === 0);
        const $head = $("<div>").addClass("BattleReportUnitHead").append(
            $("<strong>").text(this.groupName(group)),
            $("<span>").addClass("BattleReportUnitKind").text(group.kind === "defense" ? text.DefenseUnits : text.Ships)
        );
        const $count = $("<div>").addClass("BattleReportUnitCount").append(
            $("<span>").addClass("BattleReportUnitBefore").append($("<small>").text(text.BeforeBattle), $("<strong>").text(this.number(group.before))),
            $("<span>").addClass("BattleReportCountArrow").text("→").attr("aria-hidden", "true"),
            $("<span>").addClass("BattleReportUnitAfter").append($("<small>").text(text.AfterBattle),
                $("<strong>").text(this.number(group.survived + group.restored)))
        );
        const $changes = $("<div>").addClass("BattleReportUnitChanges");
        if (group.lost > 0) $changes.append($("<span>").addClass("BattleReportLoss").text(`${text.Lost}: −${this.number(group.lost)}`));
        else $changes.append($("<span>").addClass("BattleReportNoLoss").text(text.NoLosses));
        if (group.restored > 0) $changes.append($("<span>").addClass("BattleReportRepair").text(`${text.Restored}: +${this.number(group.restored)}`));
        if (group.experienceGained > 0) $changes.append($("<span>").addClass("BattleReportExperience").text(`+${this.number(group.experienceGained)} ${text.Experience}`));
        const $stats = $("<details>").addClass("BattleReportUnitStats").append(
            $("<summary>").text(text.GroupExperience),
            $("<dl>").addClass("BattleReportStatGrid").append(
                this.metric(text.ExperienceBefore, this.number(group.experienceBefore)),
                this.metric(text.ExperienceAfter, this.number(group.experienceAfter)), this.metric(text.ExperienceLost, this.number(group.experienceLost))
            )
        );
        return $unit.append(this.visual(group), $("<div>").addClass("BattleReportUnitBody").append($head, $count, $changes),
            $("<dl>").addClass("BattleReportCombatStats").attr("aria-label", text.UnitStats).append(
                this.metric(text.Attack, this.number(group.attack)), this.metric(text.Shield, this.number(group.shield)),
                this.metric(text.Hull, this.number(group.hull))
            ), $stats);
    }

    side(report, side) {
        const text = this.text();
        const total = this.sideTotals(report, side);
        const $side = $("<section>").addClass(`BattleReportSide BattleReportSide-${side}`);
        const $badge = $("<span>").addClass("BattleReportSideBadge").text(report.outcome === side ? text.Winner
            : report.outcome === "draw" ? text.Outcomes.draw : text.Defeated);
        $side.append($("<header>").addClass("BattleReportSideHeader").append(
            $("<i>").addClass(`mdi ${side === "attacker" ? "mdi-sword-cross" : "mdi-shield-outline"}`).attr("aria-hidden", "true"),
            $("<h3>").text(text[side === "attacker" ? "Attacker" : "Defender"]), $badge
        ), $("<dl>").addClass("BattleReportSideNumbers").append(
            this.metric(text.Committed, this.number(total.before)),
            this.metric(text.AfterBattle, this.number(total.survived + total.restored)),
            this.metric(text.Lost, this.number(total.lost), total.lost ? "BattleReportLoss" : "")
        ), this.survivalBar(total), $("<div>").addClass("BattleReportSideCost").append(
            $("<span>").text(text.LossCost), $("<strong>").text(this.number(report.totals.losses[side]))
        ));
        Object.entries(report.participants).filter(([, participant]) => participant.side === side).forEach(([id, participant]) => {
            const groups = Object.values(report.groups).filter(group => group.participant === id);
            const $participant = $("<section>").addClass("BattleReportParticipant").attr("data-report-participant", id);
            const name = participant.userName || `${text.Player} #${participant.userId}`;
            const fleet = participant.fleetName || (participant.fleetId ? `${text.Fleet} #${participant.fleetId}` : text.Planet);
            $participant.append($("<header>").addClass("BattleReportParticipantHeader").append(
                $("<strong>").text(name), $("<span>").text(fleet),
                $("<small>").text(this.coordinate(participant.coordinate)),
                ...(participant.joinedRound > 1 ? [$("<span>").addClass("BattleReportReinforcement").text(`${text.JoinedRound}: ${participant.joinedRound}`)] : [])
            ));
            if (groups.length) $participant.append($("<div>").addClass("BattleReportUnits").append(groups.map(group => this.unit(group))));
            else $participant.append($("<p>").addClass("BattleReportEmpty").text(text.NoUnits));
            if (groups.length && groups.every(group => group.survived === 0 && group.restored === 0)) {
                $participant.append($("<p>").addClass("BattleReportDestroyed").text(text.GroupDestroyed));
            }
            $side.append($participant);
        });
        return $side;
    }

    roundSide(report, round, index, side) {
        const previous = report.rounds[index - 1]?.[side] || {};
        const shots = round[side === "attacker" ? "shotsAttacker" : "shotsDefender"] || {};
        const rows = Object.entries(round[side]).map(([id, snapshot]) => {
            const group = report.groups[id];
            const before = previous[id]?.count ?? group.before;
            return { id, group, snapshot, lost: Math.max(0, before - snapshot.count),
                joined: index > 0 && previous[id] === undefined ? group.before : 0,
                shots: Object.values(shots[id] || {}).reduce((sum, value) => sum + Number(value), 0) };
        });
        return { rows, lost: rows.reduce((sum, row) => sum + row.lost, 0),
            joined: rows.reduce((sum, row) => sum + row.joined, 0),
            remaining: rows.reduce((sum, row) => sum + row.snapshot.count, 0),
            shots: rows.reduce((sum, row) => sum + row.shots, 0) };
    }

    round(report, round, index) {
        const text = this.text();
        const sides = Object.fromEntries(["attacker", "defender"].map(side => [side, this.roundSide(report, round, index, side)]));
        const $round = $("<details>").addClass("BattleReportRound");
        const $summary = $("<summary>").append($("<span>").addClass("BattleReportRoundNumber").text(round.number),
            $("<strong>").text(`${text.Round} ${round.number}`),
            $("<div>").addClass("BattleReportRoundPreview"));
        ["attacker", "defender"].forEach(side => {
            const value = sides[side];
            $summary.find(".BattleReportRoundPreview").append($("<span>").addClass(`BattleReportRoundPreview-${side}`)
                .text(`${text[side === "attacker" ? "Attacker" : "Defender"]}: ${value.lost ? `−${this.number(value.lost)}` : text.NoLosses}${value.joined ? ` · +${this.number(value.joined)}` : ""}`));
        });
        const $body = $("<div>").addClass("BattleReportRoundBody");
        ["attacker", "defender"].forEach(side => {
            const value = sides[side];
            const $side = $("<section>").addClass(`BattleReportRoundSide BattleReportSide-${side}`).append(
                $("<h4>").text(text[side === "attacker" ? "Attacker" : "Defender"]),
                $("<dl>").addClass("BattleReportSideNumbers").append(
                    this.metric(text.Remaining, this.number(value.remaining)), this.metric(text.Shots, this.number(value.shots)),
                    this.metric(text.Lost, this.number(value.lost), value.lost ? "BattleReportLoss" : "")
                )
            );
            if (value.joined) $side.append($("<p>").addClass("BattleReportReinforcement").text(`${text.Reinforcements}: +${this.number(value.joined)}`));
            value.rows.forEach(row => {
                const participant = report.participants[row.group.participant];
                const $row = $("<div>").addClass("BattleReportRoundUnit").attr("data-group-key", row.id).append(
                    this.visual(row.group),
                    $("<div>").append($("<strong>").text(this.groupName(row.group)),
                        $("<small>").text(this.participantName(participant))),
                    $("<div>").addClass("BattleReportRoundCount").append($("<small>").text(text.Remaining),
                        $("<strong>").text(this.number(row.snapshot.count)),
                        $("<span>").addClass(row.lost ? "BattleReportLoss" : "BattleReportNoLoss").text(row.lost ? `−${this.number(row.lost)}` : text.NoLosses))
                );
                $row.toggleClass("BattleReportUnitDestroyed", row.snapshot.count === 0);
                $side.append($row);
            });
            if (value.rows.length && value.remaining === 0) $side.append($("<p>").addClass("BattleReportDestroyed").text(text.ForcesDestroyed));
            if (!value.rows.length) $side.append($("<p>").addClass("BattleReportEmpty").text(text.NoUnits));
            const $technical = $("<details>").addClass("BattleReportTechnical").append($("<summary>").text(text.Technical));
            value.rows.forEach(row => $technical.append($("<div>").addClass("BattleReportTechnicalUnit").append(
                $("<strong>").text(`${this.groupName(row.group)} · ${this.participantName(report.participants[row.group.participant])}`),
                $("<dl>").addClass("BattleReportStatGrid").append(this.metric(text.HullRemaining, this.number(row.snapshot.hull)),
                    this.metric(text.ShieldRemaining, this.number(row.snapshot.shield)), this.metric(text.Shots, this.number(row.shots)))
            )));
            if (value.rows.length) $side.append($technical);
            $body.append($side);
        });
        return $round.append($summary, $body);
    }

    render($root, data, current) {
        const text = this.text();
        const report = data.report;
        if (!report) { $root.append($("<p>").text(text.Expired)); return; }
        if (report.version !== 1) { $root.append($("<p>").text(text.Unsupported)); return; }
        $root.attr("data-battle-id", report.battleId);
        $root.append($("<header>").addClass(`BattleReportHeader BattleReportOutcome-${report.outcome}`).append(
            $("<span>").addClass("BattleReportHeroIcon mdi mdi-flag-checkered").attr("aria-hidden", "true"),
            $("<div>").addClass("BattleReportHeroText").append(
                $("<span>").addClass("BattleReportEyebrow").text(text.Title),
                $("<h2>").text(text.Outcomes[report.outcome]),
                $("<p>").text(`${report.target.name} ${this.coordinate(report.target.coordinate)}`)
            ),
            $("<div>").addClass("BattleReportHeroMeta").append(
                $("<time>").text(formatTimestamp(report.finishedAt, "datetime")),
                $("<span>").text(`${text.Rounds}: ${report.rounds.length} / ${report.roundLimit}`),
                $("<small>").text(text.Reasons[report.reason] || report.reason)
            )
        ));
        const $save = $("<button>", { type: "button", text: data.savedByMe ? text.Unsave : text.Save })
            .addClass(data.savedByMe ? "btn-warning" : "btn-success").attr("data-report-save", report.battleId);
        const $status = $("<p>").addClass("BattleReportNotice").text(data.expiresAt === null ? text.Kept
            : `${text.Expires}: ${formatTimestamp(data.expiresAt, "datetime")}`);
        $save.on("click", () => {
            if (data.savedByMe && !window.confirm(text.UnsaveConfirm)) return;
            $save.prop("disabled", true);
            WS.Submit("battlereport", data.savedByMe ? "unsave" : "save", { id: report.battleId }, {
                scope: Page.requestScope, kind: "mutation",
                onSuccess: response => { if (current()) { $root.empty(); this.render($root, response.data.Page, current); } },
                onError: error => { if (current()) { $save.prop("disabled", false); $status.text(error.message).addClass("red_text"); } }
            });
        });
        const $url = $("<input>", { type: "text", readonly: true, value: this.link(report.battleId), "aria-label": text.Link })
            .addClass("BattleReportLink").on("click", event => event.currentTarget.select());
        const $copy = $("<button>", { type: "button", text: text.Copy }).addClass("btn-info").on("click", async () => {
            try { await navigator.clipboard.writeText($url.val()); $copy.text(text.Copied); }
            catch (_) { $url[0].select(); }
        });
        $root.append($("<nav>").addClass("BattleReportActions").attr("aria-label", text.ReportActions).append($save, $copy,
            $("<button>", { type: "button", text: text.SavedTitle }).on("click", () => this.saved())));
        $root.append($("<div>").addClass("BattleReportSides").append(this.side(report, "attacker"), this.side(report, "defender")));
        $root.append($("<div>").addClass("BattleReportRewards").append(
            $("<section>").addClass("BattleReportReward").append($("<h3>").text(text.Loot), this.resources(report.totals.loot)),
            $("<section>").addClass("BattleReportReward").append($("<h3>").text(text.Debris), this.resources(report.totals.debris))
        ));
        if (report.moon && !(report.destruction || []).length) {
            const moon = report.moon;
            const $moon = $("<section>").addClass("BattleReportMoon").toggleClass("Created", Boolean(moon.created));
            $moon.append($("<span>").addClass("mdi mdi-moon-waning-crescent").attr("aria-hidden", "true"),
                $("<div>").append($("<h3>").text(moon.created ? text.MoonCreated : text.MoonNotCreated),
                    $("<p>").text(`${text.MoonChance}: ${this.number(moon.chance)}%`)));
            if (moon.created) $moon.find("div").append($("<p>").text(`${moon.name} · ${text.MoonDiameter}: ${this.number(moon.diameter)} ${text.Kilometers}`));
            if (moon.reason === "existing_moon" || moon.reason === "not_planet") {
                $moon.find("div").append($("<p>").text(moon.reason === "existing_moon" ? text.MoonExists : text.MoonTarget));
            }
            if (Object.values(moon.consumedDebris || {}).some(amount => Number(amount) > 0)) {
                $moon.find("div").append($("<p>").addClass("BattleReportNotice").text(text.MoonDebrisConsumed));
            }
            $root.append($moon);
        }
        (report.destruction || []).forEach(attempt => {
            const $result = $("<section>").addClass("BattleReportMoon").append(
                $("<div>").append($("<h3>").text(`${text.Destruction} · ${text.Fleet} #${attempt.fleetId}`),
                    $("<p>").text(attempt.attempted
                        ? `${attempt.moonDestroyed ? text.MoonDestroyed : text.MoonSurvived} · ${text.Chance} ${this.number(attempt.moonChance)}%`
                        : text.DestructionNotAttempted)));
            if (attempt.attempted) $result.find("div").append($("<p>").text(
                `${attempt.fleetDestroyed ? text.DestructionFleetLost : text.DestructionFleetSurvived} · ${text.Risk} ${this.number(attempt.fleetChance)}%`));
            $root.append($result);
        });
        const $expand = $("<button>", { type: "button", text: text.ExpandRounds }).addClass("BattleReportExpandRounds")
            .attr("aria-expanded", "false").on("click", () => {
                const rounds = $root.find(".BattleReportRound").toArray();
                const expand = rounds.some(round => !round.open);
                rounds.forEach(round => { round.open = expand; });
                $expand.text(expand ? text.CollapseRounds : text.ExpandRounds).attr("aria-expanded", String(expand));
            });
        $root.append($("<section>").addClass("BattleReportTimeline").append(
            $("<div>").addClass("BattleReportTimelineHeading").append($("<h3>").text(text.RoundDetails),
                ...(report.rounds.length ? [$expand] : [])),
            $("<p>").addClass("BattleReportNotice").text(report.rounds.length ? text.RoundHint : text.NoRounds),
            ...report.rounds.map((round, index) => this.round(report, round, index))
        ));
        $root.append($("<details>").addClass("BattleReportAbout").append($("<summary>").text(text.LinkAndStorage),
            $("<div>").addClass("BattleReportShare").append($url), $status,
            $("<p>").addClass("BattleReportNotice").text(text.PublicNotice),
            $("<p>").addClass("BattleReportNotice").text(text.StatsNote)));
    }
}();
