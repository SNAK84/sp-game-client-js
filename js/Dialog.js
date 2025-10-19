const Dialog = {
    head_info: 'Информация',
    defaultDiv: '#popup',
    defaultButtons: {
        OK: function () { $(Dialog.defaultDiv).dialog('close'); }
    },

    /**
     * Универсальное создание диалога
     * @param {Object} buttons - объект кнопок { "Название": callback }
     * @param {String} div - селектор диалога
     * @param {Object} options - дополнительные опции jQuery UI
     */
    create(buttons = null, div = null, options = {}) {
        div = div || this.defaultDiv;

        if ($(div).length === 0) {
            $('body').append('<div id="' + div.replace('#','') + '"></div>');
        }

        const defaultOptions = {
            autoOpen: false,
            modal: true,
            width: 650,
            buttons: buttons || this.defaultButtons,
        };

        $(div).dialog($.extend(defaultOptions, options));
    },

    close(div = null) {
        div = div || this.defaultDiv;
        $(div).dialog('close');
    },

    alert(msg, callback = null, head = null) {
        const div = '#alert';
        this.create({
            "Закрыть": function () {
                $(div).dialog('close');
                if (typeof callback === "function") callback();
            }
        }, div);

        $(div).html('<div style="text-align:center;">' + msg.replace(/\n/g, '<br>') + '</div>')
            .dialog('option', 'position', { my: "center", of: document })
            .dialog('option', 'title', head || this.head_info)
            .dialog('open');
    },

    ErrorLoad(msg, error = false, reload = false) {
        const div = '#ErrorDialog';
        const buttons = {
            "Закрыть": function () {
                $(div).dialog('close');
                if (reload) location.reload();
            }
        };

        this.create(buttons, div);
        $(div).html('<div style="text-align:center;">' + msg.replace(/\n/g, '<br>') + '</div>')
            .dialog("option", "closeText", "hide")
            .dialog("option", "closeOnEscape", false)
            .dialog('option', 'position', { my: "center", of: document })
            .dialog('option', 'title', "Ошибка" + (error ? " №" + error : ""))
            .dialog('open');
    },

    Infos(id) {
        const div = '#Infos';
        this.create({}, div, {
            width: $("#content").width() - 40,
            position: { my: "center", of: $("#content") }
        });

        $(div).html('');
        $(div).dialog('open');
        Overlay.Show(div);

        const data = new FormData();
        data.append('ajax', '1');

        const ajax = new AjaxLoadClass("/info/" + id, data, (response, status) => {
            const res = ParseAjaxResult(response, status);
            if (res[0] > 0) {
                $(div).dialog('close');
                this.ErrorLoad(QError.Msg, QError.Code);
            } else {
                $(div).Tpl('Information');
                InfosParse(res[1].PageData);
                $(div + ' #info_name').hide();

                $(div).dialog('option', 'title', $(div + ' #info_name').text());

                // Автоцентрирование, если верх экрана слишком близко
                if ($(div).offset().top < 10) {
                    $(div).dialog('option', 'position', { my: "center", of: document });
                }
            }

            Overlay.Hide(div);
        });

        ajax.send();
        return false;
    },

    Rules() {
        const div = '#Rules';
        if (!tpls['Rules']) LoadTemplate('Rules');

        this.create({}, div, {
            width: $(document).width() - 100,
            height: $(document).height() - 100,
            title: "Правила игры",
            position: { my: "center", of: document },
            open: function () {
                Overlay.Hide();
            }
        });

        $(div).html(tpls['Rules']).dialog('open');
        return false;
    },

    ConfAccount() {
        const div = '#UserConfig';
        if (!tpls['UserConfig']) LoadTemplate('UserConfig');

        this.create({}, div, {
            width: 600,
            height: 'auto',
            title: "Настройки Аккаунта",
            position: { my: "center", of: document },
            open: function () {
                Overlay.Hide();
            }
        });

        $(div).html(tpls['UserConfig']);
        $('#cpassword,#new_password,#re_password').val("");
        ChPassButton();
        CheckLogin();

        $(div).dialog('open');
        return false;
    }
};

// Автоцентрирование всех открытых диалогов при ресайзе окна
$.ui.dialog.prototype.options.autoReposition = true;
$(window).resize(function () {
    $(".ui-dialog-content:visible").each(function () {
        if ($(this).dialog('option', 'autoReposition')) {
            $(this).dialog('option', 'position', $(this).dialog('option', 'position'));
        }
    });
});
