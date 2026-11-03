// Справочная страница в существующем Dialog: основная Page остаётся получателем ActualData.
window.InformationPageClass = class InformationPageClass {
    sequence = 0;
    $content = null;

    async show(id, history = []) {
        const sequence = ++this.sequence;
        const owner = Page;
        const scope = owner?.requestScope;
        await Lang.waitLangs();
        if (sequence !== this.sequence || Page !== owner || !owner?.pageActive) return;

        const path = history.length ? history : [Number(id)];
        const text = Lang.information;
        const $content = $("<article>").addClass("InformationPage");
        this.$content = $content;
        $content.append($("<div>").addClass("InformationNotice").text(text.Loading));
        Dialog.create($content, text.Title, [
            ...(path.length > 1 ? [{ text: text.Back, action: () => this.show(path[path.length - 2], path.slice(0, -1)), class: ["btn-info"] }] : []),
            { text: text.Refresh, action: () => this.show(id, path), class: ["btn-info"] },
            { text: Lang.Close, action: () => { ++this.sequence; Dialog.close(); }, class: ["btn-warning"] }
        ], { width: 760, overlay: true });

        const isCurrent = () => sequence === this.sequence && Page === owner && owner.pageActive
            && owner.requestScope === scope && $.contains(Dialog.dialogDiv, $content[0]);
        WS.Submit("information", "get", { id }, {
            scope, latestKey: "information", kind: "read",
            onSuccess: response => {
                if (!isCurrent()) return;
                const info = response.data?.Page;
                if (!info || Number(info.planetId) !== Number(owner.messageData.data?.PlanetList?.current_planet)) {
                    $content.empty().append($("<div>").addClass("InformationNotice").text(text.ContextChanged));
                    return;
                }
                this.render($content, info, path);
                // Dialog измерил высоту по короткому loading-состоянию.
                Dialog.dialogDiv.style.height = "auto";
                Dialog.dialogDiv.style.minHeight = "0";
                Dialog.centerDialog();
            },
            onError: error => {
                if (isCurrent()) $content.empty().append($("<div>").addClass("InformationNotice red_text").text(error.message));
            }
        });
    }

    number(value) {
        return Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
    }

    link(id, history) {
        return $("<button>", { type: "button", text: Lang.tech[id] || `#${id}` })
            .addClass("InformationLink").on("click", () => this.show(id, [...history.slice(-19), id]));
    }

    section($root, title, $body) {
        $root.append($("<section>").addClass("InformationSection").append($("<h3>").text(title), $body));
    }

    table(headers, rows) {
        const $table = $("<table>").addClass("InformationTable");
        $table.append($("<thead>").append($("<tr>").append(headers.map(label => $("<th>", { scope: "col", text: label })))));
        const $body = $("<tbody>");
        rows.forEach(row => $body.append(row));
        $table.append($body);
        return $("<div>").addClass("InformationTableScroll").attr("tabindex", 0).append($table);
    }

    cell(value, className = "") {
        return $("<td>").addClass(className).append(value);
    }

    render($root, info, history) {
        const text = Lang.information;
        const levelled = info.kind === "building" || info.kind === "research";
        const name = Lang.tech[info.id] || info.name;
        const imageUrl = (info.imageGroup === "techs" && globalThis.ResearchImagesLink?.[info.name])
            || (info.imageGroup === "fleets" && globalThis.FleetImagesLink?.[info.name])
            || `/images/${info.imageGroup}/${info.name}.gif`;
        $root.empty().attr("data-element-id", info.id);
        const $intro = $("<div>").addClass("InformationIntro").append(
            $("<h2>").text(name),
            $("<div>").addClass("InformationContext").text(`${info.planetName} · ${text.Kinds[info.kind]}`),
            $("<div>").addClass("InformationCurrent").text(`${levelled ? Lang.build.level : Lang.build.count}: ${this.number(info.current)}${info.maxLevel ? ` / ${this.number(info.maxLevel)}` : ""}`),
            $("<p>").addClass("InformationDescription").text(Lang.longDescription?.[info.id] || text.NoDescription)
        );
        $root.append($("<div>").addClass("InformationHero").append(
            $("<img>", { src: imageUrl, alt: name }).attr({ width: 120, height: 120 }), $intro
        ));

        const $cost = $("<div>").addClass("InformationCost");
        if (info.atMaximum) {
            $cost.append($("<span>").text(Lang.build.maxLevel));
        } else {
            Object.entries(info.price).forEach(([id, value]) => {
                $cost.append($("<span>").addClass(`ResBox icon${id}`).text(this.number(value)).ToolTip(Lang.tech[id]));
            });
            $cost.append($("<span>").addClass("InformationDuration").text(`${Lang.build.Time}: ${secondToTime(info.duration, true)}`));
        }
        this.section($root, levelled ? `${text.LevelPrice} ${info.targetLevel}` : text.UnitPrice, $cost);
        $cost.append($("<p>").addClass("InformationNote").text(text.TimeNote));

        const $requirements = info.requirements.length ? this.table(
            [text.Object, text.Required, text.Own],
            info.requirements.map(req => $("<tr>").append(this.cell(this.link(req.id, history)),
                this.cell(this.number(req.required)), this.cell(this.number(req.current), req.met ? "lime_text" : "red_text")))
        ) : $("<p>").addClass("InformationNote").text(text.NoRequirements);
        this.section($root, Lang.build.requirements, $requirements);

        const bonusEntries = Object.entries(info.bonuses || {});
        if (bonusEntries.length) {
            const $bonuses = $("<ul>").addClass("InformationBonuses");
            bonusEntries.forEach(([key, bonus]) => {
                const value = Number(bonus[0]) * (Number(bonus[1]) === 0 ? 100 : 1);
                $bonuses.append($("<li>").text(`${value > 0 ? "+" : ""}${this.number(value)}${Number(bonus[1]) === 0 ? "%" : ""} ${Lang.bonus[key] || key}`));
            });
            this.section($root, levelled ? text.BonusPerLevel : text.BonusPerUnit, $bonuses);
        }

        if (Object.keys(info.stats).length) {
            const hasCurrent = Object.values(info.stats).some(stat => stat.current !== undefined);
            const rows = Object.entries(info.stats).map(([key, stat]) => $("<tr>").append(
                this.cell(text.Stats[key]), this.cell(this.number(stat.base)),
                ...(hasCurrent ? [this.cell(stat.current === undefined ? "—" : this.number(stat.current))] : [])
            ));
            const $stats = $("<div>").append(this.table([text.Parameter, text.Base, ...(hasCurrent ? [text.WithTechnologies] : [])], rows));
            if (info.engine) $stats.append($("<div>").addClass("InformationNote").append(`${text.Engine}: `, this.link(info.engine, history)));
            $stats.append($("<p>").addClass("InformationNote").text(text.StatsNote));
            this.section($root, text.Characteristics, $stats);
        }

        if (info.rows.length) {
            const baseline = info.rows.find(row => Number(row.level) === Number(info.current));
            const valueClass = value => value > 0 ? "lime_text" : value < 0 ? "red_text" : "";
            const productionLabel = id => {
                const consuming = info.rows.some(row => Number(row.production[id]) < 0);
                if (Number(id) === 911) return consuming ? text.EnergyConsumption : text.EnergyProduction;
                if (info.planetProduction) return text.ProductionPerHour;
                if (info.productionResources.filter(resource => Number(resource) !== 911).length === 1 && !consuming) return text.ProductionPerHour;
                return `${consuming ? text.Consumption : text.Production}: ${Lang.tech[id]}${text.PerHour}`;
            };
            const columns = [
                ...info.productionResources.map(id => ({ group: "production", id, label: productionLabel(id) })),
                ...info.storageResources.map(id => ({ group: "storage", id, label: `${Lang.Capacity}: ${Lang.tech[id]}` })),
                ...(info.effects || []).map(effect => ({ group: "effects", id: effect.key, lowerIsBetter: effect.lowerIsBetter,
                    type: effect.type, difference: effect.difference,
                    label: `${effect.key.startsWith("bonus:") ? `${text.ObjectBonus}: ${Lang.bonus[effect.key.slice(6)] || effect.key.slice(6)}` : text.Effects[effect.key]}${effect.unit ? `, ${effect.unit}` : ""}` }))
            ];
            const showDifference = column => levelled && column.difference !== false;
            const headers = [...(levelled ? [Lang.build.level] : []),
                ...columns.flatMap(column => [column.label, ...(showDifference(column) ? [text.Difference] : [])])];
            const formatValue = (value, column) => column.type === "boolean" ? (value ? text.Available : text.Unavailable)
                : column.group === "effects" ? value.toLocaleString("ru-RU", { maximumSignificantDigits: 6 }) : this.number(value);
            const rows = info.rows.map(row => $("<tr>").toggleClass("InformationCurrentRow", levelled && Number(row.level) === Number(info.current)).append(
                ...(levelled ? [this.cell(this.number(row.level))] : []),
                ...columns.flatMap(column => {
                    const value = Number(row[column.group][column.id]);
                    const difference = value - Number(baseline?.[column.group][column.id] ?? value);
                    return [this.cell(formatValue(value, column), column.type === "boolean" ? (value ? "lime_text" : "red_text") : valueClass(value)),
                        ...(showDifference(column) ? [this.cell(formatValue(difference, column), valueClass(column.lowerIsBetter ? -difference : difference))] : [])];
                })
            ));
            const $levels = $("<div>").append(this.table(headers, rows));
            if (levelled) $levels.append($("<p>").addClass("InformationNote").text(text.DifferenceNote));
            if (info.productionResources.length) {
                $levels.append($("<p>").addClass("InformationNote").text(info.planetProduction
                    ? text.PlanetProductionNote : `${text.ProductionNote} ${text.Efficiency}: ${info.efficiency}%.`));
            }
            if (info.effects?.length) $levels.append($("<p>").addClass("InformationNote").text(text.EffectsNote));
            if (info.id === 124) $levels.append($("<p>").addClass("InformationNote").text(text.PlanetLimitNote));
            this.section($root, levelled ? text.LevelTable : text.UnitProduction, $levels);
        }

        ["to", "from"].forEach(direction => {
            if (!info.rapidfire[direction].length) return;
            this.section($root, direction === "to" ? text.RapidfireTo : text.RapidfireFrom,
                this.table([text.Object, text.Multiplier], info.rapidfire[direction].map(row => $("<tr>").append(
                    this.cell(this.link(row.id, history)), this.cell(`×${this.number(row.value)}`)
                )))
            );
        });
        if (info.unlocks.length) this.section($root, text.Unlocks, this.table(
            [text.Object, text.Required], info.unlocks.map(item => $("<tr>").append(
                this.cell(this.link(item.id, history)), this.cell(this.number(item.required), item.met ? "lime_text" : "red_text")
            ))
        ));
    }
};

$(function () {
    window.InformationPage = new InformationPageClass();
    GameEvents.on("ShowInfoPanel.information", event => InformationPage.show(event.detail.data?.id));
    GameEvents.on("SendServer.information", event => {
        if (event.detail.action === "planetselect") {
            ++InformationPage.sequence;
            if (InformationPage.$content && $.contains(Dialog.dialogDiv, InformationPage.$content[0])) Dialog.close();
        }
    });
});
