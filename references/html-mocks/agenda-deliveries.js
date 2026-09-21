/**
 * AWG_DELIVERIES — “View all deliveries” list for the agenda mock.
 *
 *   mount(rootEl, opts)
 *     rootEl: #screen-deliveries
 *     opts: { onShowScreen, getSelectedDayId, onOpenOrder }
 *
 *   open(opts?)
 *     opts: { scope?: "day" | "all" }
 */
(function () {
  "use strict";

  var DATA = window.AWG_DATA;
  var state = {
    root: null,
    opts: {},
    query: "",
    dayFilter: null,
    readyFilter: "all",
  };

  function noop() {}

  function $(sel, root) {
    return (root || state.root || document).querySelector(sel);
  }

  function showScreen(name) {
    (state.opts.onShowScreen || noop)(name);
  }

  function getSelectedDayId() {
    if (typeof state.opts.getSelectedDayId === "function") {
      return state.opts.getSelectedDayId();
    }
    if (DATA && typeof DATA.getTodayDay === "function") {
      var today = DATA.getTodayDay();
      return today ? today.id : null;
    }
    return DATA && DATA.days && DATA.days[0] ? DATA.days[0].id : null;
  }

  function resolveOrder(slot) {
    if (!slot) return null;
    if (DATA && typeof DATA.resolveOrderFromSlot === "function") {
      return DATA.resolveOrderFromSlot(slot);
    }
    return null;
  }

  function dayChipLabel(day) {
    if (!day) return "";
    if (day.isToday) return "Today";
    if (DATA && typeof DATA.pickupSummaryDayLabel === "function") {
      return DATA.pickupSummaryDayLabel(day.id);
    }
    return day.weekdayShort || day.id;
  }

  function isOrnamentDone(ornament, orderId) {
    if (!ornament) return false;
    if (ornament.status === "done") return true;
    if (
      DATA &&
      typeof DATA.getOrnamentSlotIds === "function" &&
      typeof DATA.isSlotDone === "function"
    ) {
      var slotIds = DATA.getOrnamentSlotIds(ornament, orderId);
      if (slotIds.length) {
        var i;
        for (i = 0; i < slotIds.length; i++) {
          var ref =
            typeof DATA.findSlotRef === "function" ? DATA.findSlotRef(slotIds[i]) : null;
          if (!ref || !DATA.isSlotDone(ref.slot)) return false;
        }
        return true;
      }
    }
    return false;
  }

  function isOrderReady(order) {
    if (!order) return false;
    var ornaments = order.ornaments || [];
    if (!ornaments.length) return false;
    var orderId = order.id;
    var i;
    for (i = 0; i < ornaments.length; i++) {
      if (!isOrnamentDone(ornaments[i], orderId)) return false;
    }
    return true;
  }

  function petTitle(order) {
    var names = (order.ornaments || []).map(function (o) {
      return o.petName;
    });
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + " & " + names[1];
    if (names.length > 2) return names[0] + " + " + (names.length - 1) + " more";
    return order.customer && order.customer.name ? order.customer.name : "Order";
  }

  function firstThumbUrl(order) {
    var ornaments = order.ornaments || [];
    var i;
    for (i = 0; i < ornaments.length; i++) {
      var urls = ornaments[i].photoUrls || [];
      if (urls[0]) return urls[0];
    }
    return null;
  }

  function deliverySummaryForSlot(slot, dayId) {
    if (DATA && typeof DATA.deliveryLabel === "function") {
      return DATA.deliveryLabel(slot, dayId);
    }
    return "";
  }

  function deliverySummariesForOrder(orderId, dayId) {
    if (!DATA || typeof DATA.getOrderSlots !== "function") return [];
    var seen = {};
    var out = [];
    DATA.getOrderSlots(orderId).forEach(function (entry) {
      if (dayId && entry.dayId !== dayId) return;
      var label = deliverySummaryForSlot(entry.slot, entry.dayId);
      if (!label || seen[label]) return;
      seen[label] = true;
      out.push(label);
    });
    return out;
  }

  function paintDayIdForSlot(slot) {
    if (!DATA || !DATA.days || !slot) return null;
    var i;
    var j;
    for (i = 0; i < DATA.days.length; i++) {
      var day = DATA.days[i];
      for (j = 0; j < (day.slots || []).length; j++) {
        if (day.slots[j].id === slot.id) return day.id;
      }
    }
    return null;
  }

  function resolvePickupDayId(slot, paintDayId) {
    if (DATA && typeof DATA.getPickupDayId === "function") {
      return DATA.getPickupDayId(slot, paintDayId) || paintDayId;
    }
    var d = (slot && slot.delivery) || {};
    if (d.type === "pickup") return d.pickupDayId || paintDayId;
    return paintDayId;
  }

  function sectionKeyForSlot(slot, paintDayId) {
    var d = (slot && slot.delivery) || {};
    if (d.type === "home") {
      return "home:" + (d.weekdayLabel || "Wednesday");
    }
    return resolvePickupDayId(slot, paintDayId) || paintDayId || "unknown";
  }

  function collectEntries(dayFilter) {
    var out = [];
    var seen = {};
    var days = DATA && DATA.days ? DATA.days : [];
    var i;
    var j;

    for (i = 0; i < days.length; i++) {
      var paintDay = days[i];
      var slots = paintDay.slots || [];
      for (j = 0; j < slots.length; j++) {
        var slot = slots[j];
        var orderId = slot.orderId || slot.id;
        var sectionKey = sectionKeyForSlot(slot, paintDay.id);
        var pickupDayId =
          (slot.delivery && slot.delivery.type === "home"
            ? null
            : resolvePickupDayId(slot, paintDay.id)) || paintDay.id;

        if (dayFilter) {
          if (slot.delivery && slot.delivery.type === "home") continue;
          if (pickupDayId !== dayFilter) continue;
        }

        var key = dayFilter ? orderId : sectionKey + ":" + orderId;
        if (seen[key]) continue;
        seen[key] = true;

        var order = resolveOrder(slot);
        if (!order) continue;

        var pickupDay =
          pickupDayId && DATA && typeof DATA.getDay === "function"
            ? DATA.getDay(pickupDayId)
            : null;

        out.push({
          orderId: order.id || orderId,
          order: order,
          slot: slot,
          paintDayId: paintDay.id,
          dayId: pickupDayId || paintDay.id,
          sectionKey: sectionKey,
          dayLabel: pickupDay ? pickupDay.label : paintDay.label,
          weekdayShort: pickupDay
            ? pickupDay.weekdayShort || ""
            : paintDay.weekdayShort || "",
          isHomeSection: !!(slot.delivery && slot.delivery.type === "home"),
          homeWeekday:
            slot.delivery && slot.delivery.type === "home"
              ? slot.delivery.weekdayLabel || "Wednesday"
              : null,
        });
      }
    }

    out.sort(function (a, b) {
      if (a.sectionKey !== b.sectionKey) {
        if (a.isHomeSection && !b.isHomeSection) return 1;
        if (!a.isHomeSection && b.isHomeSection) return -1;
        return a.sectionKey < b.sectionKey ? -1 : 1;
      }
      var pa = earliestPickupSortKey(a);
      var pb = earliestPickupSortKey(b);
      if (pa !== pb) return pa - pb;
      return (a.order.code || "").localeCompare(b.order.code || "");
    });

    return out;
  }

  /** Numeric key for sorting by exact pickup clock (home deliveries after timed pickups). */
  function pickupSortKeyFromSlot(slot) {
    if (!slot) return 99;
    if (DATA && typeof DATA.getPickupSortKey === "function") {
      return DATA.getPickupSortKey(slot).hour;
    }
    var d = slot.delivery || {};
    if (d.type === "home") return 50 + (d.weekdayLabel === "Friday" ? 1 : 0);
    if (d.pickupHour != null) return d.pickupHour;
    return slot.end != null ? slot.end : 99;
  }

  function earliestPickupSortKey(entry) {
    var pairs = schedulePairsForEntry(entry);
    if (!pairs.length) return pickupSortKeyFromSlot(entry.slot);
    var min = Infinity;
    pairs.forEach(function (p) {
      min = Math.min(min, pickupSortKeyFromSlot(p.slot));
    });
    return min === Infinity ? 99 : min;
  }

  function matchesQuery(entry, query) {
    if (!query) return true;
    var q = query.trim().toUpperCase();
    if (!q) return true;
    var code = (entry.order.code || "").toUpperCase();
    return code.indexOf(q) !== -1;
  }

  function matchesReadyFilter(entry) {
    if (state.readyFilter === "all") return true;
    var ready = isOrderReady(entry.order);
    return state.readyFilter === "ready" ? ready : !ready;
  }

  function thumbHtml(url) {
    /* Fixed 48×48 box — never let intrinsic photo size blow the row */
    if (!url) {
      return (
        '<span class="dlv-thumb" aria-hidden="true">' +
        '<span class="order-item-thumb placeholder"></span>' +
        "</span>"
      );
    }
    return (
      '<span class="dlv-thumb">' +
      '<img class="order-item-thumb" src="' +
      url +
      '" alt="" width="48" height="48" loading="lazy" />' +
      "</span>"
    );
  }

  function sectionDayTitle(entry) {
    if (entry.isHomeSection) {
      return "Home · " + (entry.homeWeekday || "Wed/Fri");
    }
    var day =
      DATA && typeof DATA.getDay === "function" ? DATA.getDay(entry.dayId) : null;
    if (day && day.isToday) return "Today";
    if (day && day.label) {
      return String(day.label).split("·")[0].trim();
    }
    return entry.weekdayShort || entry.dayLabel || entry.dayId || "Day";
  }

  function sectionDayMeta(entry) {
    if (entry.isHomeSection) {
      return "No exact clock · Wednesday / Friday routes";
    }
    var day =
      DATA && typeof DATA.getDay === "function" ? DATA.getDay(entry.dayId) : null;
    if (!day) return "";
    var parts = [];
    if (day.market) parts.push(day.market);
    parts.push("sorted by pickup time");
    return parts.join(" · ");
  }

  function dayDividerHtml(entry) {
    var title = sectionDayTitle(entry);
    var meta = sectionDayMeta(entry);
    return (
      '<div class="delivery-day-section" role="separator" aria-label="' +
      title +
      '">' +
      "<h3>" +
      title +
      "</h3>" +
      (meta ? '<p class="delivery-day-meta">' + meta + "</p>" : "") +
      "</div>"
    );
  }

  function fmtRange(start, end) {
    if (DATA && typeof DATA.fmt === "function") {
      return DATA.fmt(start) + "–" + DATA.fmt(end);
    }
    return start + "–" + end;
  }

  /** Paint window with day: "today · 10:30–12:15" or "Mon 1 Dec · …". */
  function formatPaintWithDay(paintDayId, start, end) {
    if (DATA && typeof DATA.formatPaintWindow === "function") {
      return DATA.formatPaintWindow(paintDayId, start, end);
    }
    return fmtRange(start, end);
  }

  function prodBadgeHtml(ornament, slot) {
    if (DATA && typeof DATA.productionStatusBadgeHtml === "function") {
      return DATA.productionStatusBadgeHtml(ornament || null, slot || null);
    }
    return '<span class="status-badge status-badge--prod-not">Not started</span>';
  }

  /** Exact HH:MM when available; null for home without a clock. */
  function exactPickupClock(slot) {
    if (!slot) return null;
    var d = slot.delivery || {};
    if (d.type === "home") {
      if (d.pickupHour == null) return null;
      return DATA && typeof DATA.fmt === "function" ? DATA.fmt(d.pickupHour) : null;
    }
    var hour =
      DATA && typeof DATA.getPickupHour === "function"
        ? DATA.getPickupHour(slot)
        : d.pickupHour != null
          ? d.pickupHour
          : slot.end;
    if (hour != null && DATA && typeof DATA.fmt === "function") {
      return DATA.fmt(hour);
    }
    return null;
  }

  function isHomeSlot(slot) {
    return !!(slot && slot.delivery && slot.delivery.type === "home");
  }

  /** Right-column method label (Wed/Fri home only). */
  function rightMethodLabel(slot) {
    if (isHomeSlot(slot)) {
      var wd = (slot.delivery && slot.delivery.weekdayLabel) || "Wednesday";
      if (wd !== "Friday" && wd !== "Wednesday") wd = "Wednesday";
      return "Delivery " + wd;
    }
    return "Market pickup";
  }

  /** Left meta: paint window only. */
  function metaLine(paintText) {
    if (!paintText || paintText === "—") return "";
    return "Paint " + paintText;
  }

  /**
   * Right column: method label (muted) + exact time (calmer primary).
   * Market → "Market pickup" + HH:MM; home → "Delivery Wed/Fri" (+ time if set).
   */
  function rightAsideHtml(slot, pickupClock) {
    var home = isHomeSlot(slot);
    var method = rightMethodLabel(slot);
    var time = pickupClock || null;
    var aria =
      time != null ? method + " " + time : method;
    return (
      '<div class="dlv-aside' +
      (home ? " dlv-aside--home" : "") +
      '" aria-label="' +
      aria +
      '">' +
      '<span class="dlv-aside-method">' +
      method +
      "</span>" +
      (time
        ? '<span class="dlv-aside-time">' + time + "</span>"
        : "") +
      "</div>"
    );
  }

  /** Paint + pickup pairs for this order on the relevant days. */
  function schedulePairsForEntry(entry) {
    var pairs = [];
    if (DATA && typeof DATA.getOrderSlots === "function") {
      DATA.getOrderSlots(entry.orderId).forEach(function (ref) {
        if (!ref.slot) return;
        var paintDayId = ref.dayId;
        var section = sectionKeyForSlot(ref.slot, paintDayId);
        if (section !== entry.sectionKey) return;
        pairs.push({
          ornamentId: ref.slot.ornamentId || null,
          paintDayId: paintDayId,
          paint: formatPaintWithDay(paintDayId, ref.slot.start, ref.slot.end),
          pickupClock: exactPickupClock(ref.slot),
          sortKey: pickupSortKeyFromSlot(ref.slot),
          home: isHomeSlot(ref.slot),
          slot: ref.slot,
        });
      });
    }
    if (!pairs.length && entry.slot) {
      pairs.push({
        ornamentId: entry.slot.ornamentId || null,
        paintDayId: entry.paintDayId || entry.dayId,
        paint: formatPaintWithDay(
          entry.paintDayId || entry.dayId,
          entry.slot.start,
          entry.slot.end
        ),
        pickupClock: exactPickupClock(entry.slot),
        sortKey: pickupSortKeyFromSlot(entry.slot),
        home: isHomeSlot(entry.slot),
        slot: entry.slot,
      });
    }
    pairs.sort(function (a, b) {
      return a.sortKey - b.sortKey;
    });
    return pairs;
  }

  function ornamentScheduleMap(entry) {
    var map = {};
    schedulePairsForEntry(entry).forEach(function (p) {
      var key = p.ornamentId;
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    (entry.order.ornaments || []).forEach(function (o) {
      if (map[o.id] && map[o.id].length) return;
      var ids = o.slotIds || [];
      ids.forEach(function (sid) {
        var ref =
          typeof DATA.findSlotRef === "function" ? DATA.findSlotRef(sid) : null;
        if (!ref || !ref.slot) return;
        var section = sectionKeyForSlot(ref.slot, ref.dayId);
        if (section !== entry.sectionKey) return;
        if (!map[o.id]) map[o.id] = [];
        map[o.id].push({
          ornamentId: o.id,
          paintDayId: ref.dayId,
          paint: formatPaintWithDay(ref.dayId, ref.slot.start, ref.slot.end),
          pickupClock: exactPickupClock(ref.slot),
          sortKey: pickupSortKeyFromSlot(ref.slot),
          home: isHomeSlot(ref.slot),
          slot: ref.slot,
        });
      });
    });
    Object.keys(map).forEach(function (k) {
      map[k].sort(function (a, b) {
        return a.sortKey - b.sortKey;
      });
    });
    return map;
  }

  function ornamentLineHtml(ornament, pair) {
    var urls = ornament.photoUrls || [];
    var paint = pair ? pair.paint : "";
    var pickup = pair ? pair.pickupClock : null;
    var slot = pair ? pair.slot : null;
    var paintMeta = metaLine(paint);
    var badge = prodBadgeHtml(ornament, slot);
    /* Same row as unitary .dlv-main: thumb | body | method+time RIGHT */
    return (
      '<div class="dlv-line delivery-ornament-row">' +
      thumbHtml(urls[0]) +
      '<div class="dlv-body delivery-ornament-body">' +
      '<div class="dlv-title">' +
      ornament.petName +
      "</div>" +
      (paintMeta ? '<div class="dlv-meta">' + paintMeta + "</div>" : "") +
      '<div class="dlv-status">' +
      badge +
      "</div>" +
      "</div>" +
      rightAsideHtml(slot, pickup) +
      "</div>"
    );
  }

  function rowHtml(entry) {
    var order = entry.order;
    var ornaments = order.ornaments || [];
    var code = order.code || entry.orderId;
    var dataAttrs =
      ' data-order-id="' +
      entry.orderId +
      '" data-day-id="' +
      entry.dayId +
      '"';
    var pairs = schedulePairsForEntry(entry);
    var byOrnament = ornamentScheduleMap(entry);

    if (ornaments.length <= 1) {
      var ornament = ornaments[0];
      var thumb = thumbHtml(
        ornament ? (ornament.photoUrls || [])[0] : firstThumbUrl(order)
      );
      var title = ornament ? ornament.petName : petTitle(order);
      var pair = pairs[0] || {
        paint: "",
        pickupClock: null,
        home: false,
        slot: entry.slot,
      };
      var slot = pair.slot || entry.slot;
      var paintMeta = metaLine(pair.paint);
      var badge = prodBadgeHtml(ornament, slot);
      return (
        '<div class="dlv-card delivery-row"' +
        dataAttrs +
        ">" +
        '<button type="button" class="dlv-main">' +
        thumb +
        '<div class="dlv-body">' +
        '<div class="dlv-title">' +
        code +
        " · " +
        title +
        "</div>" +
        (paintMeta ? '<div class="dlv-meta">' + paintMeta + "</div>" : "") +
        '<div class="dlv-status">' +
        badge +
        "</div>" +
        "</div>" +
        rightAsideHtml(slot, pair.pickupClock) +
        "</button>" +
        "</div>"
      );
    }

    var sortedOrnaments = ornaments.slice().sort(function (a, b) {
      var pa =
        (byOrnament[a.id] && byOrnament[a.id][0] && byOrnament[a.id][0].sortKey) ||
        99;
      var pb =
        (byOrnament[b.id] && byOrnament[b.id][0] && byOrnament[b.id][0].sortKey) ||
        99;
      return pa - pb;
    });

    return (
      '<div class="dlv-card delivery-row dlv-card--multi"' +
      dataAttrs +
      ">" +
      '<button type="button" class="dlv-main dlv-main--multi">' +
      '<div class="dlv-head">' +
      '<span class="dlv-title">' +
      code +
      "</span>" +
      '<span class="dlv-meta">' +
      ornaments.length +
      " ornaments · by pickup</span>" +
      "</div>" +
      '<div class="dlv-lines">' +
      sortedOrnaments
        .map(function (o) {
          var list = byOrnament[o.id] || [];
          return ornamentLineHtml(o, list[0] || null);
        })
        .join("") +
      "</div>" +
      "</button>" +
      "</div>"
    );
  }

  function listHtml(entries) {
    var groupByDay = state.dayFilter === null;
    var html = "";
    var lastKey = null;
    var i;
    for (i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var key = entry.sectionKey || entry.dayId;
      if (groupByDay && key !== lastKey) {
        html += dayDividerHtml(entry);
        lastKey = key;
      }
      html += rowHtml(entry);
    }
    return html;
  }

  function subtitleText() {
    var parts = [];
    if (state.dayFilter === null) {
      parts.push("All days");
    } else {
      var day = DATA && typeof DATA.getDay === "function" ? DATA.getDay(state.dayFilter) : null;
      parts.push(day ? dayChipLabel(day) : "Selected day");
    }
    if (state.readyFilter === "ready") parts.push("ready only");
    else if (state.readyFilter === "not_ready") parts.push("not ready only");
    parts.push("market pickup or home Wed/Fri only");
    return parts.join(" · ");
  }

  function emptyMessage() {
    if (state.query) {
      return "No orders match “" + state.query.trim() + "”.";
    }
    if (state.readyFilter === "ready") return "No ready orders for this filter.";
    if (state.readyFilter === "not_ready") return "No not-ready orders for this filter.";
    if (state.dayFilter === null) return "No deliveries in the demo data.";
    return "No deliveries for this day.";
  }

  function syncFilterChips() {
    var readyEl = $("#deliveriesReadyFilter", state.root);
    if (readyEl) {
      readyEl.querySelectorAll(".filter-chip").forEach(function (btn) {
        var on = btn.dataset.ready === state.readyFilter;
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    var dayEl = $("#deliveriesDayFilter", state.root);
    if (dayEl) {
      dayEl.querySelectorAll(".filter-chip").forEach(function (btn) {
        var day = btn.dataset.day || null;
        var on = day === (state.dayFilter || null);
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
  }

  function buildDayFilters(container) {
    if (!container || container._awgBuilt) return;
    container._awgBuilt = true;

    var chips =
      '<button type="button" class="filter-chip" data-day="" role="tab" aria-selected="false">All days</button>';
    var days = DATA && DATA.days ? DATA.days : [];
    days.forEach(function (day) {
      chips +=
        '<button type="button" class="filter-chip" data-day="' +
        day.id +
        '" role="tab" aria-selected="false">' +
        dayChipLabel(day) +
        "</button>";
    });
    container.innerHTML = chips;

    container.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-chip");
      if (!btn) return;
      state.dayFilter = btn.dataset.day || null;
      render();
    });
  }

  function render() {
    if (!state.root) return;

    var subEl = $("#deliveriesSub", state.root);
    var listEl = $("#deliveriesList", state.root);
    var searchEl = $("#deliveriesSearch", state.root);

    if (subEl) subEl.textContent = subtitleText();
    if (searchEl && searchEl.value !== state.query) searchEl.value = state.query;
    syncFilterChips();

    if (!listEl) return;

    var entries = collectEntries(state.dayFilter)
      .filter(function (entry) {
        return matchesQuery(entry, state.query);
      })
      .filter(matchesReadyFilter);

    if (!entries.length) {
      listEl.innerHTML = '<p class="muted">' + emptyMessage() + "</p>";
      return;
    }

    listEl.innerHTML = listHtml(entries);

    listEl.querySelectorAll(".delivery-row").forEach(function (card) {
      var main = card.querySelector(".dlv-main");
      if (main && !main._awgBound) {
        main._awgBound = true;
        main.addEventListener("click", function () {
          var orderId = card.dataset.orderId;
          var dayId = card.dataset.dayId;
          if (typeof state.opts.onOpenOrder === "function") {
            state.opts.onOpenOrder(orderId, dayId);
            return;
          }
          document.dispatchEvent(
            new CustomEvent("awg:open-order", {
              detail: { orderId: orderId, dayId: dayId },
              bubbles: true,
            })
          );
        });
      }
    });
  }

  function open(opts) {
    opts = opts || {};
    state.dayFilter = opts.scope === "all" ? null : getSelectedDayId();
    state.readyFilter = "all";
    state.query = "";
    showScreen("deliveries");
    render();
  }

  function mount(rootEl, opts) {
    if (!rootEl) return null;
    state.root = rootEl;
    state.opts = opts || {};

    var backBtn = $("#btnDeliveriesBack", rootEl);
    if (backBtn && !backBtn._awgBound) {
      backBtn._awgBound = true;
      backBtn.addEventListener("click", function () {
        showScreen("agenda");
      });
    }

    var searchEl = $("#deliveriesSearch", rootEl);
    if (searchEl && !searchEl._awgBound) {
      searchEl._awgBound = true;
      searchEl.addEventListener("input", function () {
        state.query = searchEl.value;
        render();
      });
    }

    buildDayFilters($("#deliveriesDayFilter", rootEl));

    var readyEl = $("#deliveriesReadyFilter", rootEl);
    if (readyEl && !readyEl._awgBound) {
      readyEl._awgBound = true;
      readyEl.addEventListener("click", function (e) {
        var btn = e.target.closest(".filter-chip");
        if (!btn) return;
        state.readyFilter = btn.dataset.ready || "all";
        render();
      });
    }

    var sidebarBtn = document.getElementById("btnViewAllDeliveries");
    if (sidebarBtn && !sidebarBtn._awgBound) {
      sidebarBtn._awgBound = true;
      sidebarBtn.addEventListener("click", function () {
        open({ scope: "all" });
      });
    }

    window.AWG_DELIVERIES = {
      mount: mount,
      open: open,
      render: render,
      refreshDay: function () {
        if (state.dayFilter !== null) {
          state.dayFilter = getSelectedDayId();
        }
        if (state.root && state.root.classList.contains("on")) {
          render();
        }
      },
    };
    return window.AWG_DELIVERIES;
  }

  window.AWG_DELIVERIES = {
    mount: mount,
    open: open,
    render: render,
    refreshDay: function () {
      if (state.dayFilter !== null) {
        state.dayFilter = getSelectedDayId();
      }
    },
  };
})();
