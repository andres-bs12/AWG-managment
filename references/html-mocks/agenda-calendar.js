/**
 * Calendario de agenda AWG (vanilla JS).
 * Depende de window.AWG_DATA.
 *
 * Clases CSS esperadas (el shell las define o reutiliza):
 *   .cal-wrap      — contenedor del panel calendario
 *   .cal-header    — fila superior con título y navegación
 *   .cal-day-label — nombre del día / mercado
 *   .cal-day-meta  — horario del mercado
 *   .cal-nav       — grupo de botones ← Hoy →
 *   .cal           — grid de 2 columnas (horas + rejilla)
 *   .hours         — columna de etiquetas horarias
 *   .grid          — área de slots (position:relative)
 *   .existing      — slot ocupado existente (siempre arrastrable)
 *   .existing.at-limit / .existing.has-slack — slack vs límite pickup/delivery
 *   .existing.done — ornament finished (overrides deadline tint)
 *   .draft         — borrador de la venta en curso (getDraftBlocks)
 *   .drag-preview  — preview mientras se arrastra hueco vacío
 *   .now-line      — línea horizontal de hora actual
 *   .now-label     — etiqueta junto a la línea "ahora"
 *
 * API pública: window.AWG_CAL — ver final del archivo.
 */
(function () {
  "use strict";

  var DATA = window.AWG_DATA;
  if (!DATA) {
    console.error("agenda-calendar.js requiere agenda-data.js (window.AWG_DATA)");
    return;
  }

  var CLICK_THRESHOLD = 6;

  var state = {
    root: null,
    opts: {},
    selectedDayId: null,
    els: {},
    createDrag: null,
    moveDrag: null,
    slotTap: null,
    nowTimer: null,
    focusTimer: null,
    focusedSlotId: null,
  };

  function $(sel, root) {
    return (root || state.root).querySelector(sel);
  }

  function fmt(h) {
    return DATA.fmt(h);
  }

  function getHourH() {
    return DATA.getHourH();
  }

  function getDay() {
    return DATA.getDay(state.selectedDayId);
  }

  function hourToTop(h, day) {
    return DATA.hourToTop(h, day.marketHours.start);
  }

  function yToHour(y, day) {
    return DATA.yToHour(y, day.marketHours.start, day.marketHours.end);
  }

  function overlaps(a0, a1, b0, b1) {
    return DATA.overlaps(a0, a1, b0, b1);
  }

  function toast(msg) {
    if (state.opts.onToast) state.opts.onToast(msg);
  }

  function getDraftBlocks() {
    if (typeof state.opts.getDraftBlocks === "function") {
      return state.opts.getDraftBlocks() || [];
    }
    return [];
  }

  function slotDuration(slot) {
    return slot.end - slot.start;
  }

  function slotDeadlineClass(slot, marketHours) {
    if (typeof DATA.slotDeadlineClass === "function") {
      return DATA.slotDeadlineClass(slot, marketHours);
    }
    return "has-slack";
  }

  function isSlotDone(slot) {
    if (typeof DATA.isSlotDone === "function") return DATA.isSlotDone(slot);
    return slot && slot.status === "done";
  }

  function cardHtml(title, start, end, deliveryLabel) {
    var delivery = deliveryLabel
      ? '<span class="delivery">' + deliveryLabel + "</span>"
      : "";
    return (
      '<div class="slot-head">' +
      "<b>" +
      title +
      "</b>" +
      delivery +
      "</div>" +
      '<div class="meta">' +
      fmt(start) +
      "–" +
      fmt(end) +
      "</div>"
    );
  }

  function slotHtml(slot, paintDayId) {
    return cardHtml(
      slot.name + " · " + slot.code,
      slot.start,
      slot.end,
      DATA.deliveryLabel(slot, paintDayId)
    );
  }

  function draftHtml(bl) {
    var delivery = bl.delivery ? DATA.deliveryLabel(bl, bl.dayId) : "";
    return cardHtml(bl.label || "Draft order", bl.start, bl.end, delivery);
  }

  function getNowHour(day) {
    if (!day.isToday) return null;
    if (state.opts.realNow) {
      var d = new Date();
      return d.getHours() + d.getMinutes() / 60;
    }
    return DATA.DEMO_NOW;
  }

  function buildHoursColumn(el, day) {
    el.innerHTML = "";
    for (var h = day.marketHours.start; h < day.marketHours.end; h++) {
      var div = document.createElement("div");
      div.textContent = fmt(h);
      el.appendChild(div);
    }
  }

  function paintExisting(grid, day) {
    grid.querySelectorAll(".existing").forEach(function (n) {
      n.remove();
    });
    day.slots.forEach(function (slot) {
      var el = document.createElement("div");
      var deadline = slotDeadlineClass(slot, day.marketHours);
      el.className = "existing " + deadline;
      if (isSlotDone(slot)) el.classList.add("done");
      if (state.focusedSlotId === slot.id) el.classList.add("focused");
      el.dataset.slotId = slot.id;
      el.dataset.deadline = deadline;
      el.style.top = hourToTop(slot.start, day) + "px";
      el.style.height = slotDuration(slot) * getHourH() - 4 + "px";
      el.innerHTML = slotHtml(slot, day.id);
      el.style.pointerEvents = "auto";
      el.style.cursor = "grab";
      grid.appendChild(el);
    });
  }

  function paintDrafts(grid, day) {
    grid.querySelectorAll(".draft").forEach(function (n) {
      n.remove();
    });
    getDraftBlocks().forEach(function (bl) {
      if (bl.dayId !== day.id) return;
      var el = document.createElement("div");
      el.className = "draft";
      el.dataset.blockId = bl.id;
      el.style.top = hourToTop(bl.start, day) + "px";
      el.style.height = (bl.end - bl.start) * getHourH() - 4 + "px";
      el.innerHTML =
        '<div class="draft-swipe-track">' +
        '<div class="draft-swipe-content">' +
        draftHtml(bl) +
        "</div>" +
        '<button type="button" class="draft-swipe-delete" aria-label="Delete draft">Delete</button>' +
        "</div>";
      grid.appendChild(el);
      if (typeof state.opts.onBindDraft === "function") {
        state.opts.onBindDraft(el, bl);
      }
    });
  }

  function paintNowLine(grid, day) {
    grid.querySelectorAll(".now-line").forEach(function (n) {
      n.remove();
    });
    var nowH = getNowHour(day);
    if (nowH == null) return;
    var mh = day.marketHours;
    if (nowH < mh.start || nowH > mh.end) return;

    var line = document.createElement("div");
    line.className = "now-line";
    line.style.top = hourToTop(nowH, day) + "px";
    line.innerHTML = '<span class="now-label">Now · ' + fmt(nowH) + "</span>";
    grid.appendChild(line);
  }

  function updateHeader(day) {
    state.els.label.textContent = day.label;
    state.els.meta.textContent =
      fmt(day.marketHours.start) +
      " – " +
      fmt(day.marketHours.end) +
      " · 60 / 75 min blocks";
  }

  function conflictsWithOthers(day, start, end, ignoreSlotId, ignoreDraftIndex) {
    var i;
    for (i = 0; i < day.slots.length; i++) {
      var s = day.slots[i];
      if (ignoreSlotId && s.id === ignoreSlotId) continue;
      if (overlaps(start, end, s.start, s.end)) return true;
    }
    var drafts = getDraftBlocks();
    for (i = 0; i < drafts.length; i++) {
      if (ignoreDraftIndex != null && i === ignoreDraftIndex) continue;
      var d = drafts[i];
      if (d.dayId !== day.id) continue;
      if (overlaps(start, end, d.start, d.end)) return true;
    }
    return false;
  }

  function validateSlotMove(day, slot, newStart, newEnd) {
    var mh = day.marketHours;
    if (newStart < mh.start || newEnd > mh.end) {
      return "Outside market hours";
    }
    var limit = DATA.paintEndLimit(slot, mh);
    if (newEnd > limit + (DATA.SLACK_EPS || 0.01)) {
      return "Cannot move past pickup/delivery time.";
    }
    if (conflictsWithOthers(day, newStart, newEnd, slot.id, null)) {
      return "Overlaps another order";
    }
    return null;
  }

  function validateCreateRange(day, start, end) {
    var mh = day.marketHours;
    if (start < mh.start || end > mh.end) {
      return "Outside market hours";
    }
    if (end - start < 0.25) {
      return "Block is too short";
    }
    if (conflictsWithOthers(day, start, end, null, null)) {
      return "That slot overlaps another order";
    }
    return null;
  }

  function clearCreatePreview(grid) {
    grid.querySelector("#cal-drag-preview")?.remove();
  }

  function drawCreatePreview(grid, day) {
    clearCreatePreview(grid);
    if (!state.createDrag) return;
    var el = document.createElement("div");
    el.className = "draft drag-preview";
    el.id = "cal-drag-preview";
    el.style.top = hourToTop(state.createDrag.start, day) + "px";
    el.style.height =
      (state.createDrag.end - state.createDrag.start) * getHourH() - 4 + "px";
    el.innerHTML = cardHtml(
      "New slot",
      state.createDrag.start,
      state.createDrag.end,
      ""
    );
    grid.appendChild(el);
  }

  function findSlot(day, id) {
    for (var i = 0; i < day.slots.length; i++) {
      if (day.slots[i].id === id) return day.slots[i];
    }
    return null;
  }

  function openOrderFromSlot(slot, dayId) {
    var payload = {
      slot: slot,
      orderId: slot.orderId || slot.id,
      dayId: dayId,
    };
    if (typeof state.opts.onOpenOrder === "function") {
      state.opts.onOpenOrder(slot, dayId);
      return;
    }
    document.dispatchEvent(
      new CustomEvent("awg:open-order", { detail: payload, bubbles: true })
    );
  }

  function bindGrid(grid) {
    grid.addEventListener("pointerdown", onGridPointerDown);
    grid.addEventListener("pointermove", onGridPointerMove);
    grid.addEventListener("pointerup", onGridPointerUp);
    grid.addEventListener("pointercancel", onGridPointerCancel);
  }

  function onGridPointerDown(e) {
    var existing = e.target.closest(".existing");
    var grid = state.els.grid;
    var day = getDay();
    if (!day) return;

    if (existing) {
      var slotId = existing.dataset.slotId;
      var slot = findSlot(day, slotId);
      if (!slot) return;
      e.preventDefault();
      state.slotTap = {
        slotId: slotId,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        el: existing,
      };
      state.moveDrag = {
        slotId: slotId,
        pointerId: e.pointerId,
        origStart: slot.start,
        origEnd: slot.end,
        grabOffset: e.clientY - existing.getBoundingClientRect().top,
        el: existing,
        pending: true,
      };
      existing.style.zIndex = "5";
      grid.setPointerCapture(e.pointerId);
      return;
    }

    if (e.target.closest(".draft") || e.target.closest(".now-line")) return;

    var rect = grid.getBoundingClientRect();
    var y = e.clientY - rect.top;
    var start = yToHour(y, day);
    start = Math.max(day.marketHours.start, Math.min(day.marketHours.end - 0.25, start));
    state.createDrag = {
      start: start,
      end: start + 0.25,
      pointerId: e.pointerId,
    };
    grid.setPointerCapture(e.pointerId);
    drawCreatePreview(grid, day);
  }

  function onGridPointerMove(e) {
    var grid = state.els.grid;
    var day = getDay();
    if (!day) return;

    if (state.slotTap && state.slotTap.pointerId === e.pointerId) {
      var dx = e.clientX - state.slotTap.startX;
      var dy = e.clientY - state.slotTap.startY;
      if (Math.abs(dx) > CLICK_THRESHOLD || Math.abs(dy) > CLICK_THRESHOLD) {
        state.slotTap.moved = true;
      }
    }

    if (state.moveDrag && state.moveDrag.pointerId === e.pointerId) {
      var md = state.moveDrag;
      if (state.slotTap && state.slotTap.moved && md.pending) {
        md.pending = false;
        md.el.style.cursor = "grabbing";
      }
      if (md.pending) return;
      var slot = findSlot(day, md.slotId);
      if (!slot) return;
      var rect = grid.getBoundingClientRect();
      var topY = e.clientY - rect.top - md.grabOffset;
      var newStart = yToHour(topY, day);
      var dur = md.origEnd - md.origStart;
      newStart = Math.round(newStart * 4) / 4;
      var newEnd = newStart + dur;
      if (newStart < day.marketHours.start) {
        newStart = day.marketHours.start;
        newEnd = newStart + dur;
      }
      if (newEnd > day.marketHours.end) {
        newEnd = day.marketHours.end;
        newStart = newEnd - dur;
      }
      md.el.style.top = hourToTop(newStart, day) + "px";
      md.el.style.opacity = validateSlotMove(day, slot, newStart, newEnd) ? "0.55" : "1";
      md.previewStart = newStart;
      md.previewEnd = newEnd;
      return;
    }

    if (state.createDrag && state.createDrag.pointerId === e.pointerId) {
      var rect2 = grid.getBoundingClientRect();
      var end = yToHour(e.clientY - rect2.top, day);
      end = Math.max(state.createDrag.start + 0.25, Math.min(day.marketHours.end, end));
      state.createDrag.end = end;
      drawCreatePreview(grid, day);
    }
  }

  function onGridPointerUp(e) {
    var grid = state.els.grid;
    var day = getDay();
    if (!day) return;

    if (state.slotTap && state.slotTap.pointerId === e.pointerId) {
      var tap = state.slotTap;
      var tapSlot = findSlot(day, tap.slotId);
      var wasTap = !tap.moved;
      state.slotTap = null;

      if (state.moveDrag && state.moveDrag.pointerId === e.pointerId) {
        var md = state.moveDrag;
        md.el.style.cursor = "grab";
        md.el.style.zIndex = "";
        md.el.style.opacity = "";
        state.moveDrag = null;

        if (wasTap && tapSlot) {
          openOrderFromSlot(tapSlot, day.id);
          return;
        }

        if (!tapSlot) return;
        var newStart = md.previewStart != null ? md.previewStart : tapSlot.start;
        var newEnd = md.previewEnd != null ? md.previewEnd : tapSlot.end;
        var err = validateSlotMove(day, tapSlot, newStart, newEnd);
        if (err) {
          toast(err);
          refresh();
          return;
        }
        tapSlot.start = newStart;
        tapSlot.end = newEnd;
        if (state.opts.onSlotMoved) {
          state.opts.onSlotMoved(tapSlot, day.id);
        }
        refresh();
        return;
      }

      if (wasTap && tapSlot) {
        openOrderFromSlot(tapSlot, day.id);
      }
      return;
    }

    if (state.createDrag && state.createDrag.pointerId === e.pointerId) {
      var cd = state.createDrag;
      clearCreatePreview(grid);
      var start = cd.start;
      var end = cd.end;
      state.createDrag = null;
      var errCreate = validateCreateRange(day, start, end);
      if (errCreate) {
        toast(errCreate);
        return;
      }
      if (state.opts.onCreateRange) {
        state.opts.onCreateRange(start, end, day.id);
      }
    }
  }

  function onGridPointerCancel() {
    state.createDrag = null;
    state.moveDrag = null;
    state.slotTap = null;
    refresh();
  }

  function setDay(id) {
    var day = DATA.getDay(id);
    if (!day) return false;
    state.selectedDayId = id;
    refresh();
    if (state.opts.onDayChange) state.opts.onDayChange(id);
    return true;
  }

  function goDay(delta) {
    var idx = DATA.getDayIndex(state.selectedDayId);
    if (idx < 0) idx = 0;
    var next = idx + delta;
    if (next < 0 || next >= DATA.days.length) return;
    setDay(DATA.days[next].id);
  }

  function goToday() {
    var today = DATA.getTodayDay();
    if (today) setDay(today.id);
  }

  function render() {
    var day = getDay();
    if (!day || !state.root) return;

    updateHeader(day);
    buildHoursColumn(state.els.hours, day);

    var span = day.marketHours.end - day.marketHours.start;
    state.els.grid.style.minHeight = span * getHourH() + "px";

    paintExisting(state.els.grid, day);
    paintDrafts(state.els.grid, day);
    paintNowLine(state.els.grid, day);
  }

  function refresh() {
    render();
  }

  function getSelectedDayId() {
    return state.selectedDayId;
  }

  function clearSlotFocus() {
    state.focusedSlotId = null;
    if (state.els.grid) {
      state.els.grid.querySelectorAll(".existing.focused").forEach(function (n) {
        n.classList.remove("focused");
      });
    }
  }

  function focusSlot(dayId, slotId) {
    if (!slotId) return false;
    state.focusedSlotId = slotId;
    if (dayId && dayId !== state.selectedDayId) {
      setDay(dayId);
    } else {
      refresh();
    }
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        var el = state.els.grid && state.els.grid.querySelector(
          '.existing[data-slot-id="' + slotId + '"]'
        );
        if (!el) return;
        el.classList.add("focused");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        clearTimeout(state.focusTimer);
        state.focusTimer = setTimeout(clearSlotFocus, 3200);
      });
    });
    return true;
  }

  function injectNowLineStyles() {
    if (document.getElementById("awg-cal-now-styles")) return;
    var style = document.createElement("style");
    style.id = "awg-cal-now-styles";
    style.textContent =
      ".now-line{position:absolute;left:0;right:0;height:0;border-top:2px solid #c44;padding:0;z-index:4;pointer-events:none}" +
      ".now-line .now-label{position:absolute;right:8px;top:-10px;background:#c44;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;white-space:nowrap}" +
      ".existing.dragging{opacity:.85;box-shadow:0 4px 12px rgba(0,0,0,.12)}" +
      ".existing.focused{outline:2px solid #7a9cc4;box-shadow:0 0 0 3px rgba(122,156,196,.35);z-index:6}" +
      ".drag-preview{pointer-events:none;opacity:.92}" +
      ".draft{pointer-events:auto;cursor:default;overflow:hidden;padding:0}" +
      ".draft-swipe-track{display:flex;height:100%;width:calc(100% + 64px);transform:translateX(0);transition:transform .2s ease;touch-action:pan-y}" +
      ".draft.open .draft-swipe-track{transform:translateX(-64px)}" +
      ".draft-swipe-content{flex:0 0 100%;padding:6px 10px;min-width:0}" +
      ".draft-swipe-delete{flex:0 0 64px;border:0;background:var(--danger,#9a3b3b);color:#fff;font-size:11px;font-weight:600;cursor:pointer;padding:0 4px}";
    document.head.appendChild(style);
  }

  function buildDom(rootEl) {
    rootEl.innerHTML =
      '<div class="cal-wrap">' +
      '  <div class="day-head cal-header">' +
      '    <div>' +
      '      <strong class="cal-day-label"></strong>' +
      '      <div class="tiny cal-day-meta"></div>' +
      "    </div>" +
      '    <div class="cal-nav">' +
      '      <button type="button" class="btn ghost sm cal-prev" aria-label="Previous day">←</button>' +
      '      <button type="button" class="btn ghost sm cal-today">Today</button>' +
      '      <button type="button" class="btn ghost sm cal-next" aria-label="Next day">→</button>' +
      "    </div>" +
      "  </div>" +
      '  <div class="cal">' +
      '    <div class="hours"></div>' +
      '    <div class="grid" aria-label="Day calendar"></div>' +
      "  </div>" +
      '  <div class="legend cal-legend">' +
      '    <span><i class="swatch swatch-at-limit"></i>At pickup limit</span>' +
      '    <span><i class="swatch swatch-has-slack"></i>Can shift earlier</span>' +
      '    <span><i class="swatch swatch-done"></i>Finished</span>' +
      '    <span><i class="swatch swatch-draft"></i>Your reservation / draft</span>' +
      "  </div>" +
      "</div>";

    return {
      label: rootEl.querySelector(".cal-day-label"),
      meta: rootEl.querySelector(".cal-day-meta"),
      hours: rootEl.querySelector(".hours"),
      grid: rootEl.querySelector(".grid"),
      prev: rootEl.querySelector(".cal-prev"),
      next: rootEl.querySelector(".cal-next"),
      today: rootEl.querySelector(".cal-today"),
    };
  }

  function mount(rootEl, opts) {
    if (!rootEl) return null;
    state.root = rootEl;
    state.opts = opts || {};
    injectNowLineStyles();
    state.els = buildDom(rootEl);

    state.els.prev.addEventListener("click", function () {
      goDay(-1);
    });
    state.els.next.addEventListener("click", function () {
      goDay(1);
    });
    state.els.today.addEventListener("click", goToday);

    bindGrid(state.els.grid);

    if (!state._awgStatusListener) {
      state._awgStatusListener = true;
      document.addEventListener("awg:ornament-status-changed", function () {
        refresh();
      });
    }

    var initial =
      (opts && opts.initialDayId) ||
      (DATA.getTodayDay() && DATA.getTodayDay().id) ||
      (DATA.days[0] && DATA.days[0].id);
    state.selectedDayId = initial;

    render();

    if (state.opts.realNow && !state.nowTimer) {
      state.nowTimer = setInterval(function () {
        var day = getDay();
        if (day && day.isToday) paintNowLine(state.els.grid, day);
      }, 60000);
    }

    return window.AWG_CAL;
  }

  window.AWG_CAL = {
    mount: mount,
    refresh: refresh,
    getSelectedDayId: getSelectedDayId,
    setDay: setDay,
    focusSlot: focusSlot,
    clearSlotFocus: clearSlotFocus,
  };
})();
