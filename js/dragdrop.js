/**
 * ===========================================================
 *  ✦ Minimal jQuery UI-like Draggable + Droppable
 *  ✦ Работает на ПК и мобильных устройствах
 *  ✦ API 95% совместим с jQuery UI
 * ===========================================================
 */
(function ($) {
    let dragging = false;
    let activeTouch = false;
    let originalPos = { left: 0, top: 0 };
    const _events = {
        start: 'mousedown touchstart',
        move: 'mousemove touchmove',
        end: 'mouseup touchend'
    };


    // --------------------------------------
    // 🧱 DRAGGABLE
    // --------------------------------------
    $.fn.draggable = function (options) {
        const settings = $.extend({
            helper: 'original', // 'clone' | 'original'
            axis: null, // 'x' | 'y'
            containment: null, // selector, element, or [x1,y1,x2,y2]
            delay: 0,
            revert: false,
            revertDuration: 200,
            cursor: 'grab',
            start: null,
            drag: null,
            stop: null,
            data: {}
        }, options);

        return this.each(function () {
            const $el = $(this);
            let dragging = false;
            let startX, startY, offsetX, offsetY;
            let $helper = null;
            let dragTimer = null;

            $el.css('cursor', settings.cursor);

            function getPos(e) {
                if (e.touches && e.touches.length) {
                    return { x: e.touches[0].pageX, y: e.touches[0].pageY };
                }
                if (e.changedTouches && e.changedTouches.length) {
                    return { x: e.changedTouches[0].pageX, y: e.changedTouches[0].pageY };
                }
                return { x: e.pageX, y: e.pageY };
            }

            $el.on(_events.start, function (e) {
                const pos = getPos(e);
                startX = pos.x;
                startY = pos.y;
                const offset = $el.offset();
                offsetX = startX - offset.left;
                offsetY = startY - offset.top;

                const posO = $el.position(); // позиция относительно offsetParent
                originalPos = { left: posO.left, top: posO.top };

                // задержка перед стартом (delay)
                if (settings.delay > 0) {
                    dragTimer = setTimeout(() => startDrag(e), settings.delay);
                } else {
                    startDrag(e);
                }

                e.preventDefault();
            });

            function startDrag(e) {
                if (dragging) return; // уже тащим — игнор
                if (e.type === 'mousedown' && activeTouch) return; // уже запущено touch
                if (e.type === 'touchstart') activeTouch = true;

                dragging = true;


                // создаём helper
                if (settings.helper === 'clone') {
                    $helper = $el.clone().addClass('ui-draggable-helper').css({
                        position: 'absolute',
                        zIndex: 9999,
                        left: $el.offset().left,
                        top: $el.offset().top,
                        pointerEvents: 'none',
                        opacity: 0.85
                    }).appendTo('body');
                } else {


                    $helper = $el;
                    $el.addClass('ui-dragging');
                }

                if (typeof settings.start === 'function') {
                    settings.start.call($el[0], e, { helper: $helper, data: settings.data });
                }

                $(document).on(_events.move, doDrag);
                $(document).on(_events.end, stopDrag);
            }

            function doDrag(e) {
                if (!dragging) return;
                const pos = getPos(e);

                const parentOffset = $helper.offsetParent().offset() || { left: 0, top: 0 };

                let left = pos.x - offsetX - parentOffset.left;
                let top = pos.y - offsetY - parentOffset.top;


                // ограничение по осям
                if (settings.axis === 'x') top = $helper.position().top;
                if (settings.axis === 'y') left = $helper.position().left;

                // ограничение containment
                if (settings.containment) {
                    let bounds;
                    if (Array.isArray(settings.containment)) {
                        bounds = settings.containment;
                    } else if (typeof settings.containment === 'string') {
                        const $c = $(settings.containment);
                        const off = $c.offset();
                        bounds = [off.left, off.top, off.left + $c.outerWidth(), off.top + $c.outerHeight()];
                    }
                    if (bounds) {
                        // приведение bounds к координатам offsetParent
                        const relLeft = bounds[0] - parentOffset.left;
                        const relTop = bounds[1] - parentOffset.top;
                        const relRight = bounds[2] - parentOffset.left - $helper.outerWidth();
                        const relBottom = bounds[3] - parentOffset.top - $helper.outerHeight();

                        left = Math.max(relLeft, Math.min(left, relRight));
                        top = Math.max(relTop, Math.min(top, relBottom));
                    }
                }


                $helper.css({ left, top });

                if (typeof settings.drag === 'function') {
                    settings.drag.call($el[0], e, { helper: $helper, position: { left, top } });
                }

                e.preventDefault();
            }

            function stopDrag(e) {
                clearTimeout(dragTimer);
                dragging = false;
                activeTouch = false;

                $(document).off('.drag');

                if (settings.revert) {
                    if (settings.helper === 'clone' && $helper) {
                        $helper.animate(
                            { left: $el.offset().left, top: $el.offset().top },
                            settings.revertDuration,
                            () => $helper.remove()
                        );
                    } else if (settings.helper === 'original') {
                        // отменяем любые текущие анимации и плавно возвращаем
                        $helper.stop(true).animate(
                            { left: originalPos.left, top: originalPos.top },
                            settings.revertDuration,
                            () => $helper.removeClass('ui-dragging') // удаляем класс после анимации
                        );
                    }
                } else if (settings.helper === 'clone' && $helper) {
                    $helper.remove();
                } else if (settings.helper === 'original') {
                    $helper.removeClass('ui-dragging'); // если revert не нужен — просто убираем класс
                }

                if (typeof settings.stop === 'function') {
                    settings.stop.call($el[0], e, { helper: $helper, data: settings.data });
                }

                //$el.removeClass('ui-dragging');
            }
        });
    };

    // --------------------------------------
    // 🎯 DROPPABLE
    // --------------------------------------
    $.fn.droppable = function (options) {
        const settings = $.extend({
            accept: '*',
            activeClass: 'ui-drop-active',
            hoverClass: 'ui-drop-hover',
            tolerance: 'intersect',
            over: null,
            out: null,
            drop: null
        }, options);

        return this.each(function () {
            const $drop = $(this);
            $drop.addClass(settings.activeClass);

            $(document).on(_events.end, function (e) {
                const touch = e.originalEvent?.changedTouches ? e.originalEvent.changedTouches[0] : e;
                const x = touch.pageX, y = touch.pageY;
                const el = document.elementFromPoint(x - window.scrollX, y - window.scrollY);

                if (el && ($drop[0] === el || $.contains($drop[0], el))) {
                    if (typeof settings.drop === 'function') settings.drop.call($drop[0], e, { target: $drop });
                }
            });

            $drop.on('dragover', function (e) {
                e.preventDefault();
                $drop.addClass(settings.hoverClass);
                if (typeof settings.over === 'function') settings.over.call($drop[0], e);
            });

            $drop.on('dragleave', function (e) {
                $drop.removeClass(settings.hoverClass);
                if (typeof settings.out === 'function') settings.out.call($drop[0], e);
            });

            $drop.on('drop', function (e) {
                e.preventDefault();
                $drop.removeClass(settings.hoverClass);
                if (typeof settings.drop === 'function') settings.drop.call($drop[0], e);
            });
        });
    };
})(jQuery);
