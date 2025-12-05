class IconSelector extends HTMLElement {
  constructor() {
    super();

  }

  tooltipHandler = null;

  setTooltipHandler(fn) {
    this.tooltipHandler = fn;
  }

  connectedCallback() {
    if (!this.hasAttribute("single")) this.single = true;
    if (!this.hasAttribute("vertical")) this.vertical = false;

    this.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) this.toggleSelection(btn);
    });
  }

  set items(data) {
    this._items = data || {};

    // 1️⃣ Удаляем лишние кнопки
    const existing = Array.from(this.querySelectorAll("button"));
    for (const btn of existing) {
      const key = btn.dataset.key;
      if (!(key in this._items)) btn.remove();
    }

    // 2️⃣ Добавляем недостающие кнопки
    for (const [key, item] of Object.entries(this._items)) {
      let btn = this.querySelector(`button[data-key="${key}"]`);
      if (!btn) {
        btn = document.createElement("button");
        btn.dataset.key = key;
        this.appendChild(btn);
      }
    }

    // 3️⃣ Обновляем содержимое
    this.render();
  }

  get items() {
    return this._items;
  }

  render() {
    if (!this._items) return;

    for (const [key, item] of Object.entries(this._items)) {
      const btn = this.querySelector(`button[data-key="${key}"]`);
      if (!btn) continue;

      // классы
      btn.className = item.class ?? "";

      // value
      btn.setAttribute("value", item.value ?? key);

      // иконка
      let img = btn.querySelector("img");
      let imgFon = btn.querySelector("div");
      if (item.icon) {
        if (!img) {
          img = document.createElement("img");
          btn.prepend(img);
        }

        if (item.icon) img.src = item.icon;
        img.alt = item.label || "";

        img.className = item.imgClass ?? "";

      } else if (!item.icon && item.imgClass) {
        if (!imgFon) {
          imgFon = document.createElement("div");
          btn.prepend(imgFon);
        }
        imgFon.className = item.imgClass ?? "";
      }


      if (!item.icon && img) {
        img.remove();
      }
      if (!item.imgClass && imgFon) {
        img.remove();
      }

      // подпись
      let label = btn.querySelector(".label");
      if (item.label) {
        if (!label) {
          label = document.createElement("span");
          label.className = "label";
          btn.appendChild(label);
        }
        label.textContent = item.label;
      } else if (label) {
        label.remove();
      }

      // === TOOLTIP ===
      if (item.tooltip) {

        // Если есть кастомный обработчик tooltip
        if (this.tooltipHandler) {

          // предотвращаем повторное навешивание
          if (!btn._tooltipBound) {
            this.tooltipHandler(btn, item);
            btn._tooltipBound = true;
          }

        } else {
          // fallback → обычный title
          btn.title = typeof item.tooltip === "string" ? item.tooltip : "";
        }

      } else {
        // если tooltip отключён
        btn.removeAttribute("title");

        // удаляем флаг
        btn._tooltipBound = false;
      }

    }



    this.syncSelectionFromValue();
  }

  toggleSelection(button) {
    const value = button.getAttribute("value");

    if (this.single) {
      this.value = value;
      this.querySelectorAll("button").forEach((btn) =>
        btn.toggleAttribute("selected", btn === button)
      );
    } else {
      button.toggleAttribute("selected");
      const selected = [...this.querySelectorAll("button[selected]")].map((btn) =>
        btn.getAttribute("value")
      );
      this.value = selected;
    }

    this.dispatchEvent(new CustomEvent("change", { detail: { value: this.value } }));
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = v;
    this.setAttribute("value", Array.isArray(v) ? v.join(",") : v);
  }

  static get observedAttributes() {
    return ["value", "single", "vertical"];
  }

  attributeChangedCallback(name) {
    if (name === "value") this.syncSelectionFromValue();
  }

  syncSelectionFromValue() {
    const valueAttr = this.getAttribute("value") || "";
    const selectedValues = valueAttr.split(",").map((v) => v.trim());

    this.querySelectorAll("button").forEach((btn) => {
      const val = btn.getAttribute("value");
      btn.toggleAttribute(
        "selected",
        this.single ? val === valueAttr : selectedValues.includes(val)
      );
    });
  }

  get single() {
    return this.hasAttribute("single") ? this.getAttribute("single") !== "false" : true;
  }
  set single(val) {
    if (val) this.setAttribute("single", "");
    else this.removeAttribute("single");
  }

  get vertical() {
    return this.hasAttribute("vertical");
  }
  set vertical(val) {
    if (val) this.setAttribute("vertical", "");
    else this.removeAttribute("vertical");
  }
}

customElements.define("icon-selector", IconSelector);
