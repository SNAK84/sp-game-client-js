class ToolTipClass {
	static $Tip = null;   // общий <tool-tip>

	fade = 100;
	fadeRun = false;

	parent = null;
	content = null;
	css = {};

	fadeOut = false;

	constructor() {
		if (!this.$Tip) {
			this.$Tip = $("<tool-tip>").addClass("tip").hide();
			$("body").append(this.$Tip);
		}
	}

	bindEvents(object) {

		if (object === this.parent) this.Render(object, true);

		if ($(object).data('tooltip-bound')) return;

		$(object).data('tooltip-bound', true);

		$(object).on("mouseenter", (e) => this.show(e));
		$(object).on("mousemove", (e) => this.move(e));
		$(object).on("mouseleave", () => this.hide());
	}

	RenderText(newContent) {
		if (newContent instanceof jQuery || newContent instanceof HTMLElement) {
			this.$Tip.empty().append(newContent);
		} else {
			this.$Tip.html(newContent ?? "");
		}

		this.setCss();
	}

	Render(parent, fast = false, e = null) {
		if (parent === null) return;

		const newContent = $(parent).data('tooltip');
		if (!newContent) return;

		this.css = $(parent).data('tooltip-css');
		// Проверяем, изменился ли контент
		const currentContent = this.$Tip.contents().toArray(); // текущие дочерние элементы
		let changed = false;

		if (newContent instanceof jQuery || newContent instanceof HTMLElement) {
			changed = !$(currentContent).is(newContent);
		} else if (typeof newContent === "string") {
			changed = this.$Tip.html() !== newContent;
		}

		if (!changed) {
			// Если не изменилось, просто применяем CSS
			this.setCss();
			return;
		}

		// Плавная смена текста
		this.fadeOut = true;
		this.fadeRun = true;

		if (fast) {
			this.RenderText(newContent);
		} else
			this.$Tip.fadeOut(this.fade, () => {
				this.fadeOut = false;

				this.RenderText(newContent);
				this.$Tip.fadeIn(this.fade, () => {
					this.fadeRun = false;

					if (e) this.setPosition(e);
				});
			});
	}

	show(e) {
		this.parent = e.target;

		this.Render(this.parent, false, e);

		this.setPosition(e);

		if (!this.fadeRun) {
			this.fadeRun = true;
			this.$Tip.fadeIn(this.fade, () => {
				this.fadeRun = false;
				this.setPosition(e);
			});
		} else
			this.setPosition(e);
	}

	move(e) {
		this.parent = e.target;

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

	setPosition(e) {
		if (!e) return;

		let mousex = e.pageX + 15;
		let mousey = e.pageY + 15;

		const tipWidth = this.$Tip.outerWidth();
		const tipHeight = this.$Tip.outerHeight();

		if (mousex + tipWidth > $(document).width() - 10) {
			mousex = e.pageX - tipWidth - 15;
		}
		if (mousey + tipHeight > $(document).height() - 10) {
			mousey = e.pageY - tipHeight - 15;
		}

		this.$Tip.css({ top: mousey, left: mousex });
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



class MToolTip extends HTMLElement {

	button = "";
	parent = null;
	constructor() {
		super();
	}
	Update() {
		if (this.parent !== null) {
			$(this).html($(this.parent).attr('tooltip'));
			$(this).append("<br>" + this.button);
		}
	}
	SetParent(parent) {
		this.parent = parent;
	}
	UnSetParent() {
		this.parent = null;
	}
	Button(button) {
		this.button = button;
	}


}
customElements.define('m-tool-tip', MToolTip);

let tip_move = false;
$.fn.ToolTipLast = function (content, css = null) {
	let t = false, m = false;
	if ($('tool-tip').length !== 0)
		//if (this == $('tool-tip')[0].parent)
		t = true;

	if ($('m-tool-tip').length !== 0)
		//if (this == $('m-tool-tip')[0].parent)
		m = true;

	if (content instanceof jQuery || content instanceof HTMLElement) {
		$(this).data('tooltip-html', content);
		//$(this).removeAttr('tooltip');
	} else {
		//$(this).attr('tooltip', content);
		$(this).removeData('tooltip-html');
	}

	$(this).attr('tooltip', content);

	$.each(css, (key, value) => {
		$(this).attr('tooltip-' + key, value);
	})


	if (t) $('tool-tip')[0].Update();
	if (m) $('m-tool-tip')[0].Update();
	return this;
}

function SetPosition(tip, e) {

	var mousex = e.pageX + 20;
	var mousey = e.pageY + 20;

	var tipWidth = tip.width();
	var tipHeight = tip.height();

	if (tip.length > 0 && tip[0].localName == "m-tool-tip") {
		mousex -= tipHeight / 2;
		mousey -= tipHeight / 2;
	}

	var tipVisX = $(document).width() - (mousex + tipWidth);
	var tipVisY = $(document).height() - (mousey + tipHeight);

	if (tipVisX < 20) { mousex = e.pageX - tipWidth - 20; };
	if (mousex < 20) { mousex = 20; };
	if (tipVisY < 20) { mousey = e.pageY - tipHeight - 20; };

	if (mousex + tipWidth > $(document).width() - 20) mousex = 20;

	if (mousey < 20) mousey = 20;

	tip.css({ top: mousey, left: mousex });
}

$(document).ready(function () {


	window.ToolTip = new ToolTipClass();




	$("body").on('mouseenter', '[tooltip_sticky]', function (e) {
		var tip = $('tooltip_sticky');
		tip.html($(this).attr('tooltip_sticky'));
		tip.addClass('tooltip_sticky_div');
		tip.css({ bottom: '', top: e.pageY - tip.outerHeight() / 2, left: e.pageX - tip.outerWidth() / 2 });
		tip.show();
	});
	$("body").on('mouseleave', '.tooltip_sticky_div', function () {
		var tip = $('tooltip_sticky');
		tip.removeClass('tooltip_sticky_div');
		tip.hide();
	});

});


