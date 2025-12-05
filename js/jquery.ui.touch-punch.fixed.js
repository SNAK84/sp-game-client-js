/*!
 * jQuery UI Touch Punch 2.0.1 — совместимость тачей с jQuery UI
 * Работает с jQuery UI 1.13–1.14, поддерживает multitouch и passive:false
 * © 2024 OpenJS Foundation / модификации: snak84 fix
 */
; (function ($) {
  if (!$.ui) return;

  // Настройка: включить/выключить
  var touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  //if (!touchSupported) return; // нет тачей — ничего не делаем

  // Список событий мыши, которые нужно подменить
  var mouseProto = $.ui.mouse.prototype,
    _mouseInit = mouseProto._mouseInit,
    _mouseDestroy = mouseProto._mouseDestroy,
    touchHandled;

  function simulateMouseEvent(event, simulatedType) {
    // Игнорировать мультитач
    if (event.originalEvent.touches.length > 1) return;

    var touch = event.originalEvent.changedTouches[0],
      simulatedEvent = new MouseEvent(simulatedType, {
        bubbles: true,
        cancelable: true,
        view: window,
        detail: 1,
        screenX: touch.screenX,
        screenY: touch.screenY,
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0
      });

    event.target.dispatchEvent(simulatedEvent);
  }

  function handleTouchStart(event) {
    var self = this;

    if (touchHandled) return;
    // Если _mouseCapture отсутствует — считаем, что можно
    if (self._mouseCapture && !self._mouseCapture(event.originalEvent.changedTouches[0])) return;

    touchHandled = true;
    self._touchMoved = false;

    simulateMouseEvent(event, 'mouseover');
    simulateMouseEvent(event, 'mousemove');
    simulateMouseEvent(event, 'mousedown');
  }

  function handleTouchMove(event) {
    if (!touchHandled) return;
    simulateMouseEvent(event, 'mousemove');
    event.preventDefault(); // запрет скролла страницы при драге
  }

  function handleTouchEnd(event) {
    if (!touchHandled) return;
    simulateMouseEvent(event, 'mouseup');
    simulateMouseEvent(event, 'mouseout');
    if (!this._touchMoved) simulateMouseEvent(event, 'click'); // эмулируем клик
    touchHandled = false;
  }

  mouseProto._mouseInit = function () {
    var self = this;

    // оригинальная инициализация
    _mouseInit.call(self);

    // привязываем обработчики тача
    self.element
      .on('touchstart.ui-touch', handleTouchStart)
      .on('touchmove.ui-touch', handleTouchMove)
      .on('touchend.ui-touch touchcancel.ui-touch', handleTouchEnd);
  };

  mouseProto._mouseDestroy = function () {
    var self = this;
    self.element.off('.ui-touch');
    _mouseDestroy.call(self);
  };

})(jQuery);
