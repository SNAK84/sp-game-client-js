class DialogClass {
    constructor() {
        this.dialogDiv = document.createElement('dialog-main');
        this.dialogDiv.id = 'dialog';
        $(this.dialogDiv).hide();

        document.body.appendChild(this.dialogDiv);

        this.overlay = document.createElement('dialog-overlay');
        $(this.overlay).hide();

        document.body.appendChild(this.overlay);

        this.handleEsc = this.handleEsc.bind(this);
        this.escEnabled = false;
        this.showFrame = null;

        window.addEventListener('resize', () => {
            if (this.dialogDiv.style.display !== "none") this.centerDialog();
        });

        // Drag & Drop
        this.dragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        // Resize
        this.resizing = false;
        this.startWidth = 0;
        this.startHeight = 0;
        this.startX = 0;
        this.startY = 0;

        this.minWidth = 0;
        this.minHeight = 0;

        this.ShowOverlay = false;

        this.position = null;
    }

    handleEsc(event) {
        if (event.key === "Escape" && this.escEnabled) this.close();
    }

    centerDialog() {
        const { width: viewportWidth } = this.getViewportSize();
        const maxDialogWidth = Math.max(0, viewportWidth - 20);
        const currentWidth = this.dialogDiv.getBoundingClientRect().width;
        if (currentWidth > maxDialogWidth) {
            this.minWidth = Math.min(Number(this.minWidth) || 0, maxDialogWidth);
            this.dialogDiv.style.width = maxDialogWidth + 'px';
            this.dialogDiv.style.minWidth = maxDialogWidth + 'px';
        }

        const pos = this.calculatePosition();

        this.dialogDiv.style.top = pos.top + 'px';
        this.dialogDiv.style.left = pos.left + 'px';
    }

    getViewportSize() {
        return {
            width: window.visualViewport?.width || window.innerWidth,
            height: window.visualViewport?.height || window.innerHeight
        };
    }

    create(
        content,
        title = 'Информация',
        buttons = [{ text: 'OK', action: () => this.close() }],
        options = {}
    ) {
        const {
            width = this.minWidth,
            height = 'auto',
            CloseButton = true,
            escEnabled = true,
            overlay = false,
            position = null,
            drag = true,
        } = options;

        this.ShowOverlay = overlay;
        this.position = position;

        this.minHeight = 0;
        this.minWidth = width;
        this.dialogDiv.innerHTML = '';

        // Заголовок
        const titleElem = document.createElement('dialog-title');
        titleElem.textContent = title;
        this.dialogDiv.appendChild(titleElem);
        this.dialogDiv.titleElem = titleElem;

        // Контент
        const contentElem = document.createElement('dialog-content');
        if (typeof content === 'string') contentElem.innerHTML = content.replace(/\n/g, '<br>');
        else $(contentElem).append(content);
        this.dialogDiv.appendChild(contentElem);

        // Кнопки
        if (buttons) {
            contentElem.style.marginBottom = '40px'
            const buttonContainer = document.createElement('dialog-buttons');
            buttonContainer.style.textAlign = 'right';
            buttonContainer.style.marginTop = '10px';
            buttons.forEach(btn => {
                const buttonElem = document.createElement('button');
                buttonElem.textContent = btn.text;
                buttonElem.style.margin = '0 5px';
                if (btn.class) btn.class.forEach(cls => buttonElem.classList.add(cls));
                buttonElem.onclick = btn.action;
                buttonContainer.appendChild(buttonElem);
            });
            this.dialogDiv.appendChild(buttonContainer);
        }
        // Крестик
        if (CloseButton) {
            const closeButton = document.createElement('dialog-close-button');
            closeButton.innerHTML = '&#10006;';
            closeButton.onclick = () => this.close();
            this.dialogDiv.appendChild(closeButton);
        }

        // Resize handle
        const resizeHandle = document.createElement('div');
        Object.assign(resizeHandle.style, {
            width: '15px',
            height: '15px',
            position: 'absolute',
            bottom: '0px',
            right: '0px',
            cursor: 'se-resize',
            background: 'transparent'
        });
        this.dialogDiv.appendChild(resizeHandle);

        this.dialogDiv.style.width = typeof width === 'number' ? width + 'px' : width;
        this.dialogDiv.style.height = typeof height === 'number' ? height + 'px' : height;

        this.escEnabled = escEnabled;

        if (drag) this.initDrag(titleElem);
        this.initResize(resizeHandle);

        this.show();
    }

    initDrag(handle) {

        handle.style.cursor = 'move';
        handle.onmousedown = (e) => {
            this.dragging = true;
            this.transitionProperty = this.dialogDiv.style.transitionProperty;
            this.dialogDiv.style.transitionProperty = 'none'
            const rect = this.dialogDiv.getBoundingClientRect();
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
            document.onmousemove = (ev) => {
                if (!this.dragging) return;
                const viewport = this.getViewportSize();
                let newLeft = ev.clientX - this.dragOffsetX;
                let newTop = ev.clientY - this.dragOffsetY;

                // Ограничение по экрану
                newLeft = Math.max(0, Math.min(newLeft, viewport.width - rect.width));
                newTop = Math.max(0, Math.min(newTop, viewport.height - rect.height));

                this.dialogDiv.style.left = newLeft + 'px';
                this.dialogDiv.style.top = newTop + 'px';
            };
            document.onmouseup = () => {
                this.dialogDiv.style.transitionProperty = this.transitionProperty;
                this.dragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    }

    initResize(handle) {
        handle.onmousedown = (e) => {
            e.preventDefault();
            this.transitionProperty = this.dialogDiv.style.transitionProperty;
            this.dialogDiv.style.transitionProperty = 'none'
            this.resizing = true;
            const rect = this.dialogDiv.getBoundingClientRect();
            this.startWidth = rect.width;
            this.startHeight = rect.height;
            this.startX = e.clientX;
            this.startY = e.clientY;

            document.onmousemove = (ev) => {
                if (!this.resizing) return;
                const viewport = this.getViewportSize();
                let newWidth = this.startWidth + (ev.clientX - this.startX);
                let newHeight = this.startHeight + (ev.clientY - this.startY);

                // Ограничения
                newWidth = Math.max(this.minWidth, Math.min(newWidth, viewport.width - rect.left));
                newHeight = Math.max(this.minHeight, Math.min(newHeight, viewport.height - rect.top));

                this.dialogDiv.style.width = newWidth + 'px';
                this.dialogDiv.style.height = newHeight + 'px';
            };

            document.onmouseup = () => {
                this.dialogDiv.style.transitionProperty = this.transitionProperty;
                this.resizing = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    }

    // Переиспользуемая утилита: парсит "left top", "center", "right bottom" и т.д.
    parsePair(token) {
        if (!token) return ['center', 'center'];
        const parts = token.trim().toLowerCase().split(/\s+/);
        if (parts.length === 1) {
            if (['left', 'center', 'right'].includes(parts[0])) return [parts[0], 'center'];
            if (['top', 'center', 'bottom'].includes(parts[0])) return ['center', parts[0]];
        }
        return [parts[0] || 'center', parts[1] || 'center'];
    }

    calculatePosition() {

        const rectDialog = this.dialogDiv.getBoundingClientRect();
        const viewport = this.getViewportSize();

        // Если не задано — центр по экрану
        if (!this.position || !this.position.of) {
            const top = Math.max((viewport.height - rectDialog.height) / 3, 10);
            const left = Math.max((viewport.width - rectDialog.width) / 2, 10);
            return { top, left };
        }

        const targetEl = $(this.position.of).get(0);
        if (!targetEl) {
            // fallback на центр
            return {
                top: Math.max((viewport.height - rectDialog.height) / 3, 10),
                left: Math.max((viewport.width - rectDialog.width) / 2, 10)
            };
        }

        const rectTarget = targetEl.getBoundingClientRect();

        // parse my / at
        const [myX, myY] = this.parsePair(this.position.my || 'center center');
        const [atX, atY] = this.parsePair(this.position.at || 'center center');

        // compute anchor (at) coordinates on target (absolute viewport coords)
        let anchorX = rectTarget.left;
        if (atX === 'center') anchorX += rectTarget.width / 2;
        else if (atX === 'right') anchorX += rectTarget.width;

        let anchorY = rectTarget.top;
        if (atY === 'center') anchorY += rectTarget.height / 2;
        else if (atY === 'bottom') anchorY += rectTarget.height;

        // compute offset inside dialog according to my
        let offsetX = 0;
        if (myX === 'center') offsetX = rectDialog.width / 2;
        else if (myX === 'right') offsetX = rectDialog.width;

        let offsetY = 0;
        if (myY === 'center') offsetY = rectDialog.height / 2;
        else if (myY === 'bottom') offsetY = rectDialog.height;

        // top-left for dialog
        let left = anchorX - offsetX;
        let top = anchorY - offsetY;

        // clamp to viewport with margin 10
        left = Math.max(10, Math.min(left, viewport.width - rectDialog.width - 10));
        top = Math.max(10, Math.min(top, viewport.height - rectDialog.height - 10));

        return { top, left };
    }

    stopAnimations() {
        if (this.showFrame !== null) {
            cancelAnimationFrame(this.showFrame);
            this.showFrame = null;
            this.dialogDiv.style.transitionProperty = this.transitionProperty;
        }
        // Старые fadeOut/показ не должны менять уже следующее окно.
        $(this.dialogDiv).stop(true, true);
        $(this.overlay).stop(true, true);
    }

    show() {
        this.stopAnimations();
        // 1) prepare: make visible for layout but hidden to user
        this.transitionProperty = this.dialogDiv.style.transitionProperty;
        this.dialogDiv.style.transitionProperty = 'none';
        this.dialogDiv.style.visibility = 'hidden';
        this.dialogDiv.style.display = 'block';
        this.dialogDiv.style.opacity = '0';

        // 2) force layout so initial children sizes are applied
        void this.dialogDiv.offsetWidth;

        // 3) measure logical pieces and apply min sizes
        const titleEl = $(this.dialogDiv).find('dialog-title')[0];
        const contentEl = $(this.dialogDiv).find('dialog-content')[0];
        const buttonsEl = $(this.dialogDiv).find('dialog-buttons')[0];

        const rectTitle = titleEl ? titleEl.getBoundingClientRect() : { width: 0, height: 0 };
        const rectContent = contentEl ? contentEl.getBoundingClientRect() : { width: 0, height: 0 };
        const rectButtons = buttonsEl ? buttonsEl.getBoundingClientRect() : { width: 0, height: 0 };

        //if (this.minWidth > window.innerWidth) this.minWidth = window.innerWidth - 40;

        const maxDialogWidth = Math.max(0, this.getViewportSize().width - 20);
        this.minWidth = Math.min(
            maxDialogWidth,
            Math.max(Number(this.minWidth) || 0, Math.ceil(rectTitle.width + 50))
        );
        this.minHeight = Math.max(this.minHeight || 0, Math.ceil(rectTitle.height + rectContent.height + rectButtons.height + 40));

        // apply minWidth (this likely changes layout)
        this.dialogDiv.style.width = this.minWidth + 'px';
        this.dialogDiv.style.height = this.minHeight + 'px';

        this.dialogDiv.style.minWidth = this.minWidth + 'px';
        this.dialogDiv.style.minHeight = this.minHeight + 'px';

        // optionally set minHeight if you want:
        // this.dialogDiv.style.height = Math.max(parseFloat(getComputedStyle(this.dialogDiv).height), this.minHeight) + 'px';

        // 4) wait next frame to ensure new width is applied, then measure final dialog rect
        this.showFrame = requestAnimationFrame(() => {
            this.showFrame = null;
            // force style recalc
            void this.dialogDiv.offsetWidth;

            const rectDialogFinal = this.dialogDiv.getBoundingClientRect();

            // 5) compute correct position using final rect
            const pos = this.calculatePosition();

            this.dialogDiv.style.top = pos.top + 'px';
            this.dialogDiv.style.left = pos.left + 'px';

            // 6) show with animation (no layout jumps now)
            // I prefer animating opacity only (avoid hide()/fadeIn() quirks)
            $(this.dialogDiv).css({ visibility: 'visible', opacity: 0, display: 'block' })
                .animate({ opacity: 1 }, 300, () => {
                    this.dialogDiv.style.transitionProperty = this.transitionProperty;
                });

            $(this.overlay).toggle(Boolean(this.ShowOverlay));
            document.addEventListener('keydown', this.handleEsc);
        });
    }


    close() {
        this.stopAnimations();
        $(this.dialogDiv).fadeOut(250);
        $(this.overlay).fadeOut(250);
        document.removeEventListener('keydown', this.handleEsc);
        this.escEnabled = false;
    }

    alert(message, callback) {
        this.create(
            `<div style="text-align:center;">${message}</div>`,
            'Внимание',
            [{
                text: Lang.Close,
                action: () => {
                    this.close();
                    if (typeof callback === 'function') callback();
                }
            }],
            true
        );
    }


    ErrorLoad(msg, error = false, reload = false) {
        const content = document.createElement("div");
        content.style.textAlign = "center";
        content.style.color = "red";
        content.style.whiteSpace = "pre-line";
        content.textContent = String(msg ?? "");

        this.create(
            content,
            "Ошибка" + (error ? " №" + error : ""),
            [{
                text: Lang.Close,
                action: () => this.close()
            }],
            {
                overlay: true,
                escEnabled: false,
                width: 350,
                drag: true,
                position: { my: "center center", of: "document" }
            }
        );
    }

    error(message, errorCode, callback) {
        const content = document.createElement("div");
        content.style.textAlign = "center";
        content.style.color = "red";
        content.style.whiteSpace = "pre-line";
        content.textContent = String(message ?? "");

        this.create(
            content,
            "Ошибка" + (errorCode ? " №" + errorCode : ""),
            [{
                text: "Закрыть",
                action: () => {
                    this.close();
                    if (typeof callback === "function") callback();
                }
            }],
            false
        );
    }
}
