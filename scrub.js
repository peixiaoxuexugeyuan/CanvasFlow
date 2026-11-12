
















(function () {
  'use strict';

  var PX_PER_STEP = 4;      // 每 4px 走一步
  var DRAG_THRESHOLD = 3;   // 超过 3px 才算拖动，否则视为点击（还要能聚焦打字）
  var SHIFT_FACTOR = 5;     // Shift = 粗调
  var wheelRemainders = new WeakMap();

  // One notch is one step; small touchpad deltas accumulate instead of jumping.
  // Ctrl/Meta wheels belong to browser zoom and horizontal wheels to scrolling.
  function wheelSteps(event, target) {
    if (event.ctrlKey || event.metaKey || !event.deltaY || Math.abs(event.deltaX || 0) > Math.abs(event.deltaY)) return null;
    event.preventDefault();
    event.stopPropagation();
    var now = Date.now(), last = wheelRemainders.get(target);
    var pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
    var remainder = last && now - last.time < 300 && Math.sign(last.value) === Math.sign(pixels) ? last.value : 0;
    var value = remainder + pixels, steps = Math.trunc(value / 40);
    wheelRemainders.set(target, { value: value - steps * 40, time: now });
    // Large OS wheel deltas still change only a few fine steps.
    return -Math.max(-5, Math.min(5, steps));
  }

  function decimalsOf(step) {
    // 0.1 → 1 位小数；1 → 0 位；0.25 → 2 位。用字符串数小数点，避开浮点误差。
    var parts = String(step).toLowerCase().split('e');
    return Math.max(0, (parts[0].split('.')[1] || '').length - Number(parts[1] || 0));
  }

  function isScrubbable(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    if (String(el.type).toLowerCase() !== 'number') return false;
    if (el.disabled || el.readOnly) return false;
    if (el.hasAttribute('data-no-scrub')) return false;
    return true;
  }

  function clampToInput(input, value) {
    var min = input.min !== '' ? parseFloat(input.min) : NaN;
    var max = input.max !== '' ? parseFloat(input.max) : NaN;
    var step = parseFloat(input.step);
    if (!isFinite(step) || step <= 0) step = 1;

    // 按步长吸附：从 min 起算（原生 range/number 也是这个规则），没有 min 就从 0 起算。
    var base = isFinite(min) ? min : 0;
    var snapped = base + Math.round((value - base) / step) * step;
    var digits = decimalsOf(step);
    snapped = Number(snapped.toFixed(Math.min(digits + 3, 10)));

    if (isFinite(min) && snapped < min) snapped = min;
    if (isFinite(max) && snapped > max) snapped = max;
    return Number(snapped.toFixed(Math.min(digits + 3, 10)));
  }

  document.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return;          // 只认左键
    var input = event.target && event.target.closest
      ? event.target.closest('input[type=number]')
      : null;
    if (!isScrubbable(input)) return;
    // 点在自己组件的清除按钮上（有些框架会加）就不接管
    if (event.target !== input) return;

    var startX = event.clientX;
    var startValue = parseFloat(input.value);
    if (!isFinite(startValue)) {
      var minFallback = input.min !== '' ? parseFloat(input.min) : 0;
      startValue = isFinite(minFallback) ? minFallback : 0;
    }
    var step = parseFloat(input.step);
    if (!isFinite(step) || step <= 0) step = 1;

    var dragging = false;
    var moved = false;
    var activeId = event.pointerId;

    // 拖动中不让浏览器去选文字 / 不弹原生拖拽
    function beginDrag() {
      dragging = true;
      document.body.classList.add('is-scrubbing');
      document.body.style.cursor = 'ew-resize';
      try { input.setPointerCapture(activeId); } catch (e) { /* 合成事件无活跃指针时忽略 */ }
    }

    function onMove(moveEvent) {
      if (moveEvent.pointerId !== activeId) return;
      var dx = moveEvent.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        beginDrag();
      }
      moved = true;
      moveEvent.preventDefault();

      var factor = moveEvent.shiftKey ? SHIFT_FACTOR : 1;
      var stepsFloat = (dx / PX_PER_STEP) * factor;
      var next = clampToInput(input, startValue + stepsFloat * step);
      input.value = String(next);
      // 实时派发 input，让「边拖边预览」的控件（滑块/数值联动）跟着动
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function onUp(upEvent) {
      if (upEvent && upEvent.pointerId !== undefined && upEvent.pointerId !== activeId) return;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('blur', onUp, true);
      if (!dragging) return;               // 只是点了一下 → 交给原生聚焦，什么都不做
      document.body.classList.remove('is-scrubbing');
      document.body.style.cursor = '';
      try { input.releasePointerCapture(activeId); } catch (e) { /* ignore */ }
      if (moved) {
        // 关键：派发 change，各控件原有的保存逻辑（settings.js 的 PUT、director 的
        // onAxisInput/persist 等）**不需要任何改动**就能收到。
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // 拖动后紧跟一次 click，如果不拦掉会顺带聚焦并全选，视觉上很跳。
      if (moved) {
        var swallow = function (clickEvent) {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          input.removeEventListener('click', swallow, true);
        };
        input.addEventListener('click', swallow, true);
        // 兜底：万一没触发 click，下一帧自己摘掉监听
        setTimeout(function () { input.removeEventListener('click', swallow, true); }, 0);
      }
    }

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('blur', onUp, true);
  }, true);

  document.addEventListener('wheel', function (event) {
    var input = event.target;
    if (!isScrubbable(input) && !(input && input.tagName === 'INPUT' && input.type === 'range' && !input.disabled && !input.readOnly && !input.hasAttribute('data-no-scrub'))) return;
    // Specialized time and axis controls retain their own units and handlers.
    if (input.matches('.dtl-time-scrub,[data-dt-axis]')) return;
    var steps = wheelSteps(event, input);
    if (!steps) return;
    var step = parseFloat(input.step);
    if (!isFinite(step) || step <= 0) step = 1;
    var value = parseFloat(input.value);
    if (!isFinite(value)) value = parseFloat(input.min) || 0;
    var next = clampToInput(input, value + steps * step * (event.shiftKey ? SHIFT_FACTOR : 1));
    if (next === value) return;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { passive: false });

  // 拖动期间禁止文本选择（有些浏览器 pointerdown+move 仍会选）
  document.addEventListener('selectstart', function (event) {
    if (document.body.classList.contains('is-scrubbing')) event.preventDefault();
  }, true);

  window.CanvasFlowScrub = { clampToInput: clampToInput, wheelSteps: wheelSteps, PX_PER_STEP: PX_PER_STEP };
})();
