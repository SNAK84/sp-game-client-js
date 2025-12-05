class IconSelector extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // создаём style отдельно, чтобы потом легко добавлять кнопки
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      :host([vertical]) {
        flex-direction: column;
      }

      button {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: #1b1d20;
        border: 2px solid #2a2c30;
        border-radius: 10px;
        padding: 0px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 64px;
        min-height: 64px;
        user-select: none;
      }

      button[selected] {
        border-color: #00aaff;
        background: #004466;
        box-shadow: 0 0 6px #00aaff99;
      }

      button img {
        width: 48px;
        height: 48px;
        object-fit: contain;
        pointer-events: none;
        opacity: 0.9;
      }

      button[selected] img {
        opacity: 1;
      }

      button .label {
        font-size: 12px;
        color: #ccc;
        opacity: 0.9;
        margin-top: 4px;
        text-align: center;
        pointer-events: none;
      }
    `;

    this.shadowRoot.appendChild(style);
  }

  connectedCallback() {
    if (!this.hasAttribute("single")) this.single = true;
    if (!this.hasAttribute("vertical")) this.vertical = false;

    this.shadowRoot.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) this.toggleSelection(btn);
    });
  }

  set items(data) {
    this._items = data || {};

    // 1️⃣ Удаляем лишние кнопки
    const existing = Array.from(this.shadowRoot.querySelectorAll("button"));
    for (const btn of existing) {
      const key = btn.dataset.key;
      if (!(key in this._items)) btn.remove();
    }

    // 2️⃣ Добавляем недостающие кнопки
    for (const [key, item] of Object.entries(this._items)) {
      let btn = this.shadowRoot.querySelector(`button[data-key="${key}"]`);
      if (!btn) {
        btn = document.createElement("button");
        btn.dataset.key = key;
        this.shadowRoot.appendChild(btn);
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
      const btn = this.shadowRoot.querySelector(`button[data-key="${key}"]`);
      if (!btn) continue;

      // классы
      if (item.class) btn.className = item.class;

      // value
      btn.setAttribute("value", item.value ?? key);

      // иконка
      let img = btn.querySelector("img");
      if (item.icon) {
        if (!img) {
          img = document.createElement("img");
          btn.prepend(img);
        }
        img.src = item.icon;
        img.alt = item.label || "";
      } else if (img) {
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
    }

    this.syncSelectionFromValue();
  }

  toggleSelection(button) {
    const value = button.getAttribute("value");

    if (this.single) {
      this.value = value;
      this.shadowRoot.querySelectorAll("button").forEach((btn) =>
        btn.toggleAttribute("selected", btn === button)
      );
    } else {
      button.toggleAttribute("selected");
      const selected = [...this.shadowRoot.querySelectorAll("button[selected]")].map((btn) =>
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

    this.shadowRoot.querySelectorAll("button").forEach((btn) => {
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
