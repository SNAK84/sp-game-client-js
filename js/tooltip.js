class ToolTipClass {
	static $Tip = null;   // общий <tool-tip>

	fade = 100;
	fadeRun = false;
	fadeOut = false;

	parent = null;
	content = null;
	css = {};

	resizeObserver = null;
	mutationObserver = null;

	LastCursorX = 0;
	LastCursorY = 0;


	constructor() {
		if (!this.$Tip) {
			this.$Tip = $("<tool-tip>").addClass("tip").hide();
			$("body").append(this.$Tip);
		}

		this.initResizeObserver();
		this.initMutationObserver();
		this.updatePositionOnResize();
	}

	bindEvents(object) {

		if (object === this.parent) this.Render(object, true);
		if ($(object).data('tooltip-bound')) return;
		$(object).data('tooltip-bound', true);

		if (isTouch) {

			// --- Мобильный вариант (двойной тап) ---
			$(object).off("click.tooltip").on("click.tooltip", (e) => this.touch(e));
		} else {

			$(object)
				.off("mouseenter.tooltip").on("mouseenter.tooltip", (e) => this.show(e))
				.off("mousemove.tooltip").on("mousemove.tooltip", (e) => this.move(e))
				.off("mouseleave.tooltip").on("mouseleave.tooltip", () => this.hide());
		}
	}

	unBindEvents(object) {
		$(object)
			.off("mouseenter.tooltip")
			.off("mousemove.tooltip")
			.off("mouseleave.tooltip")
			.off("click.tooltip");
	}

	RenderText(newContent) {
		if (newContent instanceof jQuery || newContent instanceof HTMLElement) {
			this.$Tip.empty().append(newContent);
		} else {
			this.$Tip.html(newContent.replace(/\n/g, '<br>') ?? "");
		}

		this.setCss();
		//this.setPosition();
	}

	Render(parent, fast = false, e = null) {
		if (!parent) return false;

		const newContent = $(parent).data('tooltip');
		if (!newContent) {
			this.unBindEvents(parent);
			console.log("Render return");
			return false;
		}
		this.css = $(parent).data('tooltip-css');

		// Проверяем, изменился ли контент

		let changed = true;
		const $tip = this.$Tip;
		if (newContent instanceof jQuery || newContent instanceof HTMLElement) {
			// Сравнение по ссылке на DOM-элемент
			const newEl = newContent instanceof jQuery ? newContent[0] : newContent;
			const currentEl = $tip.children().first()[0]; // первый дочерний элемент тултипа
			changed = currentEl !== newEl;
		} else if (typeof newContent === "string") {
			const normalizedNew = newContent.replace(/\n/g, '<br>').trim();
			const normalizedOld = ($tip.html() || '').trim();

			// Сравнение без учёта мелких HTML-разниц
			changed = $('<div>').html(normalizedOld).text().trim() !== $('<div>').html(normalizedNew).text().trim();
		}

		if (!changed) {
			// Если не изменилось, просто применяем CSS
			this.setCss();
			return true;
		}

		// Плавная смена текста
		this.fadeOut = true;
		this.fadeRun = true;

		if (fast) {
			this.RenderText(newContent);
		} else {
			this.$Tip.fadeOut(this.fade, () => {
				this.fadeOut = false;

				this.RenderText(newContent);
				this.$Tip.fadeIn(this.fade, () => {
					this.fadeRun = false;

					//if (e) this.setPosition(e);
				});
			});
		}

		return true;
	}

	touch(e) {
		const touch = e.originalEvent?.touches?.[0] || e.originalEvent?.changedTouches?.[0] || e;
		this.LastCursorX = touch.pageX;
		this.LastCursorY = touch.pageY;

		const newContent = $(e.currentTarget).data('tooltip');
		if (!newContent) {
			this.unBindEvents(e.currentTarget);
			return true;
		}

		// если tooltip уже открыт на этом объекте → выполнить действие
		if (this.$Tip.is(":visible") && this.parent === e.currentTarget) {
			this.hide();
			if ($(e.currentTarget).hasClass("disabled")) {
				return false;
			}
			// Второй тап → триггерим "confirmed-click"
			$(e.currentTarget).trigger("confirmed-click");
			return false;
		}

		e.preventDefault();
		e.stopPropagation();

		this.parent = e.currentTarget;
		this.Render(this.parent, false, e);


		//this.setPosition(e);

		if (!this.fadeRun) {
			this.fadeRun = true;
			this.$Tip.fadeIn(this.fade, () => {
				this.fadeRun = false;
				//this.setPosition(e);
			});
		}

		$(document).one("click.tooltip", () => this.hide());
		return false; // блокируем первый тап
	}

	show(e) {
		this.parent = e.currentTarget;


		this.LastCursorX = e.pageX;
		this.LastCursorY = e.pageY;

		if (!this.Render(this.parent, false, e))
			return;

		//this.setPosition(e);

		if (!this.fadeRun) {
			this.fadeRun = true;
			this.$Tip.fadeIn(this.fade, () => {
				this.fadeRun = false;
				//this.setPosition(e);
			});
		} //else
		//this.setPosition(e);
	}

	move(e) {
		//this.parent = e.target;

		const touch = e;
		this.LastCursorX = touch.pageX;
		this.LastCursorY = touch.pageY;

		this.Render(this.parent, false, e);

		this.setPosition(e);

		/*if (this.fadeOut) {
			this.fadeOut = false; this.$Tip.stop(true, true)
		}
		this.$Tip.fadeIn(250, () => {

		});*/

	}

	hide() {
		this.fadeOut = true;
		this.$Tip.stop(true, true).fadeOut(this.fade, () => {
			this.fadeOut = false;
		});
	}

	setPosition() {
		if (!this.parent) return;
		if (!this.css || typeof this.css !== "object") this.css = {}; // <--- фикс

		const $tip = this.$Tip;

		const winW = $(window).width();
		const winH = $(window).height();
		const scrollTop = $(window).scrollTop();
		const scrollLeft = $(window).scrollLeft();

		const tipW = $tip.outerWidth();
		const tipH = $tip.outerHeight();

		let left = this.LastCursorX - tipW / 2;
		if (left < scrollLeft + 10) left = scrollLeft + 10;
		if (left + tipW > winW + scrollLeft - 10) left = winW + scrollLeft - tipW - 10;

		// сначала сверху
		let top = this.LastCursorY - tipH - 20;
		if (top < scrollTop + 20) top = this.LastCursorY + 20; // если нет места сверху, снизу
		if (top + tipH > winH + scrollTop - 20) top = winH + scrollTop - tipH - 20;

		this.css['top'] = top;
		this.css['left'] = left;
		this.setCss();
	}

	setCss() {
		const keep = ["opacity", "display", "left", "top"];
		//const styles = this.$Tip.attr("style");;
		const styles = this.$Tip[0].style;
		for (let i = styles.length - 1; i >= 0; i--) {
			const prop = styles[i];
			if (!keep.includes(prop)) {
				this.$Tip.css(prop, "");
			}
		}
		if (this.css) this.$Tip.css(this.css);
	}

	// --- Автопозиция при resize ---
	updatePositionOnResize() {
		$(window).off("resize.tooltip").on("resize.tooltip", () => {
			if (this.$Tip.is(":visible")) this.setPosition();
		});
	}

	// --- Отслеживание изменений размеров tooltip ---
	initResizeObserver() {
		if (this.resizeObserver) this.resizeObserver.disconnect();

		this.resizeObserver = new ResizeObserver(() => {
			if (this.$Tip.is(":visible")) this.setPosition();
		});

		this.resizeObserver.observe(this.$Tip[0]);
	}

	// --- Отслеживание изменений контента tooltip ---
	initMutationObserver() {
		if (this.mutationObserver) this.mutationObserver.disconnect();

		this.mutationObserver = new MutationObserver(() => {
			if (this.$Tip.is(":visible")) this.setPosition();
		});

		this.mutationObserver.observe(this.$Tip[0], {
			childList: true,
			subtree: true,
			characterData: true
		});
	}
}

window.ToolTip = null;
// jQuery-обёртка
$.fn.ToolTip = function (content, css = null) {
	return this.each(function () {

		$(this).data("tooltip", content);
		$(this).data("tooltip-css", css);

		//window.ToolTip.Render(parent, css);
		ToolTip.bindEvents(this);

	});
};


$(document).ready(function () {
	window.ToolTip = new ToolTipClass();
});


