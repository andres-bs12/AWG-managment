/**
 * Demo agenda data — Rathausplatz, 12:00–19:00.
 * Exposes window.AWG_DATA for agenda-calendar.js and the shell.
 */
(function () {
  "use strict";

  var MARKET = "Rathausplatz";
  var HOURS = { start: 12, end: 19 };

  /** Market → day ids available for market pickup (coherent with `days` above). */
  var MARKET_PICKUP_DAYS = {
    Rathausplatz: ["2025-11-28", "2025-11-29", "2025-11-30", "2025-12-01"],
    "Christkindlmarkt Spittelberg": ["2025-11-29", "2025-11-30", "2025-12-01"],
  };

  /** Fixed "now" line on the day marked isToday (15:10). */
  var DEMO_NOW = 15 + 10 / 60;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  /** Decimal hour (12.5 → 12:30) to HH:MM string. */
  function fmt(h) {
    var hh = Math.floor(h);
    var mm = Math.round((h - hh) * 60);
    if (mm === 60) {
      hh += 1;
      mm = 0;
    }
    return pad(hh) + ":" + pad(mm);
  }

  function dayLabel(weekday, day, month) {
    return weekday + " " + day + " " + month + " · " + MARKET;
  }

  var days = [
    {
      id: "2025-11-28",
      dateKey: "2025-11-28",
      label: dayLabel("Saturday", 28, "Nov"),
      weekdayShort: "Sat",
      market: MARKET,
      isToday: true,
      marketHours: { start: HOURS.start, end: HOURS.end },
      slots: [
        {
          id: "s-281-1",
          orderId: "ord-111",
          ornamentId: "orn-milo-1",
          name: "MILO",
          code: "ABS111",
          start: 12,
          end: 13,
          status: "in_progress",
          delivery: { type: "pickup", pickupHour: 14 },
        },
        {
          id: "s-281-2a",
          orderId: "ord-118",
          ornamentId: "orn-lena-1",
          name: "LENA",
          code: "ABS118",
          start: 13,
          end: 14.25,
          status: "in_progress",
          delivery: { type: "pickup", pickupHour: 15 },
        },
        {
          id: "s-281-2b",
          orderId: "ord-118",
          ornamentId: "orn-lena-2",
          name: "BRUNO",
          code: "ABS118",
          start: 15.5,
          end: 16.5,
          status: "done",
          delivery: { type: "pickup", pickupHour: 17 },
        },
        {
          id: "s-281-3",
          orderId: "ord-122",
          ornamentId: "orn-felix-1",
          name: "FELIX",
          code: "ABS122",
          start: 14.5,
          end: 15.5,
          urgent: true,
          status: "not_started",
          delivery: { type: "pickup", pickupHour: 16.25 },
        },
        {
          id: "s-281-4",
          orderId: "ord-130",
          ornamentId: "orn-otto-1",
          name: "OTTO",
          code: "ABS130",
          start: 16,
          end: 17,
          status: "in_progress",
          delivery: { type: "pickup", pickupHour: 12, pickupDayId: "2025-11-29" },
        },
        {
          id: "s-281-5",
          orderId: "ord-131",
          ornamentId: "orn-anna-1",
          name: "ANNA",
          code: "ABS131",
          start: 17.25,
          end: 19,
          status: "not_started",
          delivery: { type: "home", weekdayLabel: "Friday" },
        },
      ],
    },
    {
      id: "2025-11-29",
      dateKey: "2025-11-29",
      label: dayLabel("Sunday", 29, "Nov"),
      weekdayShort: "Sun",
      market: MARKET,
      isToday: false,
      marketHours: { start: HOURS.start, end: HOURS.end },
      slots: [
        {
          id: "s-291-1",
          orderId: "ord-140",
          name: "LUKA",
          code: "ABS140",
          start: 12.5,
          end: 14,
          status: "done",
          delivery: { type: "pickup", pickupHour: 14 },
        },
        {
          id: "s-291-2",
          orderId: "ord-141",
          name: "SOFIA",
          code: "ABS141",
          start: 15,
          end: 16.25,
          status: "in_progress",
          delivery: { type: "home", weekdayLabel: "Wednesday" },
        },
      ],
    },
    {
      id: "2025-11-30",
      dateKey: "2025-11-30",
      label: dayLabel("Monday", 30, "Nov"),
      weekdayShort: "Mon",
      market: MARKET,
      isToday: false,
      marketHours: { start: HOURS.start, end: HOURS.end },
      slots: [
        {
          id: "s-301-1",
          orderId: "ord-150",
          name: "EMIL",
          code: "ABS150",
          start: 12,
          end: 13.5,
          urgent: true,
          status: "done",
          delivery: { type: "pickup", pickupHour: 13.5 },
        },
        {
          id: "s-301-2",
          orderId: "ord-151",
          name: "NORA",
          code: "ABS151",
          start: 12.75,
          end: 14,
          status: "not_started",
          delivery: { type: "pickup", pickupHour: 14.5 },
        },
        {
          id: "s-301-3",
          orderId: "ord-152",
          name: "PAUL",
          code: "ABS152",
          start: 14.25,
          end: 15.5,
          status: "in_progress",
          delivery: { type: "home", weekdayLabel: "Friday" },
        },
        {
          id: "s-301-4",
          orderId: "ord-153",
          name: "MIA",
          code: "ABS153",
          start: 15.75,
          end: 17.5,
          status: "not_started",
          delivery: { type: "pickup", pickupHour: 17.5 },
        },
        {
          id: "s-301-5",
          orderId: "ord-154",
          name: "JONAS",
          code: "ABS154",
          start: 17.5,
          end: 19,
          status: "done",
          delivery: { type: "pickup", pickupHour: 19 },
        },
      ],
    },
    {
      id: "2025-12-01",
      dateKey: "2025-12-01",
      label: dayLabel("Tuesday", 1, "Dec"),
      weekdayShort: "Tue",
      market: MARKET,
      isToday: false,
      marketHours: { start: HOURS.start, end: HOURS.end },
      slots: [
        {
          id: "s-011-1",
          orderId: "ord-160",
          name: "LEO",
          code: "ABS160",
          start: 13,
          end: 14,
          status: "in_progress",
          delivery: { type: "pickup", pickupHour: 15 },
        },
        {
          id: "s-011-2",
          orderId: "ord-161",
          name: "ELLA",
          code: "ABS161",
          start: 14.5,
          end: 16,
          status: "not_started",
          delivery: { type: "home", weekdayLabel: "Wednesday", pickupHour: 18 },
        },
        {
          id: "s-011-3",
          orderId: "ord-162",
          name: "MAX",
          code: "ABS162",
          start: 16.5,
          end: 17.75,
          status: "done",
          delivery: { type: "pickup", pickupHour: 18 },
        },
      ],
    },
  ];

  function getDay(id) {
    for (var i = 0; i < days.length; i++) {
      if (days[i].id === id) return days[i];
    }
    return null;
  }

  function getDayIndex(id) {
    for (var i = 0; i < days.length; i++) {
      if (days[i].id === id) return i;
    }
    return -1;
  }

  function getTodayDay() {
    for (var i = 0; i < days.length; i++) {
      if (days[i].isToday) return days[i];
    }
    return days[0] || null;
  }

  function weekdayShort(day) {
    if (!day) return "";
    if (day.weekdayShort) return day.weekdayShort;
    var m = day.label && day.label.match(/^(\w+)/);
    return m ? m[1].slice(0, 3) : "";
  }

  function pickupDayLabel(pickupDayId, paintDayId) {
    var pickupDay = pickupDayId ? getDay(pickupDayId) : getDay(paintDayId);
    if (!pickupDay) return "today";
    if (pickupDay.isToday) return "today";
    return weekdayShort(pickupDay);
  }

  /** Calendar day id when the customer picks up / receives (not paint day). */
  function getPickupDayId(slot, paintDayId) {
    if (!slot) return paintDayId || null;
    var d = slot.delivery || {};
    if (d.type === "pickup") {
      return d.pickupDayId || paintDayId || null;
    }
    if (d.type === "home") {
      return d.pickupDayId || null;
    }
    return paintDayId || null;
  }

  /** Exact pickup hour for market; null for home (Wed/Fri, no clock). */
  function getPickupHour(slot) {
    if (!slot) return null;
    var d = slot.delivery || {};
    if (d.type === "home") return null;
    if (d.pickupHour != null) return d.pickupHour;
    return slot.end != null ? slot.end : null;
  }

  function getPickupSortKey(slot, paintDayId) {
    var d = (slot && slot.delivery) || {};
    var dayId = getPickupDayId(slot, paintDayId) || paintDayId || "";
    var hour;
    if (d.type === "home") {
      hour = 50 + (d.weekdayLabel === "Friday" ? 1 : 0);
    } else {
      hour = getPickupHour(slot);
      if (hour == null) hour = 99;
    }
    return { dayId: dayId || "home:" + (d.weekdayLabel || "Wed"), hour: hour };
  }

  function pickupSummaryDayLabel(dayId) {
    var day = dayId ? getDay(dayId) : null;
    if (!day) return "today";
    if (day.isToday) return "today";
    var m = day.label && day.label.match(/^(\w+)\s+(\d+)/);
    if (m) return m[1].slice(0, 3) + " " + m[2];
    return weekdayShort(day);
  }

  function marketDayOptionLabel(dayId) {
    var day = getDay(dayId);
    if (!day) return dayId;
    var m = day.label && day.label.match(/^(\w+)\s+(\d+)\s+(\w+)/);
    if (m) return m[1].slice(0, 3) + " " + m[2] + " " + m[3];
    return day.label || dayId;
  }

  /** Paint calendar day: "today" or "Mon 1 Dec". */
  function paintDayLabel(dayId) {
    var day = dayId ? getDay(dayId) : null;
    if (!day) return "";
    if (day.isToday) return "today";
    return marketDayOptionLabel(dayId);
  }

  /** e.g. "today · 10:30–12:15" or "Mon 1 Dec · 10:30–12:15". */
  function formatPaintWindow(paintDayId, start, end) {
    var range = fmt(start) + "–" + fmt(end);
    var dayPart = paintDayLabel(paintDayId);
    return dayPart ? dayPart + " · " + range : range;
  }

  /**
   * Production status for list badges (aligned with Sales tracking).
   * Values: "not_started" | "started" | "finished"
   */
  function resolveProductionStatus(ornament, slot) {
    var raw =
      (ornament && ornament.status) ||
      (slot && slot.status) ||
      "";
    if (raw === "done" || raw === "finished") return "finished";
    if (raw === "in_progress" || raw === "started") return "started";
    return "not_started";
  }

  function productionStatusLabel(status) {
    if (status === "finished") return "Finished";
    if (status === "started") return "Started";
    return "Not started";
  }

  function productionStatusBadgeClass(status) {
    if (status === "finished") return "status-badge--prod-done";
    if (status === "started") return "status-badge--prod-started";
    return "status-badge--prod-not";
  }

  function productionStatusBadgeHtml(ornament, slot) {
    var status = resolveProductionStatus(ornament, slot);
    return (
      '<span class="status-badge ' +
      productionStatusBadgeClass(status) +
      '" title="Production">' +
      productionStatusLabel(status) +
      "</span>"
    );
  }

  function getMarketPickupDays(market) {
    if (market && MARKET_PICKUP_DAYS[market]) return MARKET_PICKUP_DAYS[market].slice();
    return days.map(function (d) {
      return d.id;
    });
  }

  /** Rich order records keyed by orderId (linked from slots via orderId / code). */
  var orders = {
    "ord-111": {
      id: "ord-111",
      code: "ABS111",
      delivered: false,
      customer: {
        name: "Sarah Müller",
        phone: "+43 664 123 4567",
        email: "sarah.mueller@example.com",
      },
      ornaments: [
        {
          id: "orn-milo-1",
          petName: "MILO",
          withName: true,
          backName: "Milo · 2025",
          status: "in_progress",
          slotIds: ["s-281-1"],
          photoUrls: [
            "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=400&fit=crop",
            "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=400&fit=crop",
          ],
        },
      ],
    },
    "ord-118": {
      id: "ord-118",
      code: "ABS118",
      delivered: false,
      customer: {
        name: "Thomas Weber",
        phone: "+43 699 882 1100",
        email: "t.weber@gmail.com",
      },
      ornaments: [
        {
          id: "orn-lena-1",
          petName: "LENA",
          withName: true,
          backName: "Lena ♥",
          status: "in_progress",
          slotIds: ["s-281-2a"],
          photoUrls: [
            "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&h=400&fit=crop",
          ],
        },
        {
          id: "orn-lena-2",
          petName: "BRUNO",
          withName: false,
          status: "done",
          slotIds: ["s-281-2b"],
          photoUrls: [
            "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=400&h=400&fit=crop",
            "https://images.unsplash.com/photo-1558787533-6944a3923bce?w=400&h=400&fit=crop",
          ],
        },
      ],
    },
    "ord-130": {
      id: "ord-130",
      code: "ABS130",
      delivered: false,
      customer: {
        name: "Elena Novak",
        phone: "+43 650 445 9900",
        email: "elena.novak@outlook.at",
      },
      ornaments: [
        {
          id: "orn-otto-1",
          petName: "OTTO",
          withName: true,
          backName: "Otto · Wien",
          status: "in_progress",
          slotIds: ["s-281-4"],
          photoUrls: [
            "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=400&fit=crop",
            "https://images.unsplash.com/photo-1537151622747-8eb927683304?w=400&h=400&fit=crop",
            "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400&h=400&fit=crop",
          ],
        },
      ],
    },
    "ord-122": {
      id: "ord-122",
      code: "ABS122",
      delivered: false,
      customer: {
        name: "Julia Hartmann",
        phone: "+43 676 554 3210",
        email: "julia.h@example.com",
      },
      ornaments: [
        {
          id: "orn-felix-1",
          petName: "FELIX",
          withName: false,
          status: "not_started",
          slotIds: ["s-281-3"],
          photoUrls: [
            "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=400&fit=crop",
          ],
        },
      ],
    },
    "ord-131": {
      id: "ord-131",
      code: "ABS131",
      delivered: false,
      customer: {
        name: "Anna Berger",
        phone: "+43 660 111 2233",
        email: "anna.berger@example.at",
      },
      ornaments: [
        {
          id: "orn-anna-1",
          petName: "ANNA",
          withName: true,
          backName: "Anna",
          status: "not_started",
          slotIds: ["s-281-5"],
          photoUrls: [
            "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&h=400&fit=crop",
          ],
        },
      ],
    },
  };

  function getOrder(orderId) {
    if (!orderId) return null;
    return orders[orderId] || null;
  }

  function getOrderByCode(code) {
    if (!code) return null;
    var keys = Object.keys(orders);
    for (var k = 0; k < keys.length; k++) {
      if (orders[keys[k]].code === code) return orders[keys[k]];
    }
    return null;
  }

  function resolveOrderFromSlot(slot) {
    if (!slot) return null;
    var oid = slot.orderId || slot.id;
    var order = getOrder(oid);
    if (order) return order;
    if (slot.code) {
      order = getOrderByCode(slot.code);
      if (order) return order;
    }
    return {
      id: oid,
      code: slot.code || oid,
      customer: { name: slot.name || "Customer", phone: "—", email: "—" },
      ornaments: [
        {
          id: "orn-" + oid,
          petName: slot.name || "Pet",
          withName: false,
          photoUrls: [],
        },
      ],
    };
  }

  function getOrderSlots(orderId) {
    var out = [];
    var i;
    var j;
    for (i = 0; i < days.length; i++) {
      var day = days[i];
      for (j = 0; j < day.slots.length; j++) {
        var s = day.slots[j];
        var oid = s.orderId || s.id;
        if (oid === orderId) {
          out.push({
            slotId: s.id,
            dayId: day.id,
            dayLabel: day.label,
            weekdayShort: weekdayShort(day),
            slot: s,
          });
        }
      }
    }
    out.sort(function (a, b) {
      if (a.dayId !== b.dayId) return a.dayId < b.dayId ? -1 : 1;
      return a.slot.start - b.slot.start;
    });
    return out;
  }

  /** Hour row height in px; reads --hour-h or defaults to 56. */
  function getHourH() {
    if (typeof document !== "undefined" && document.documentElement) {
      var v = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--hour-h")
      );
      if (!isNaN(v) && v > 0) return v;
    }
    return 56;
  }

  /** Hours of room before paint must finish (pickup/delivery limit − slot.end). */
  var SLACK_EPS = 0.01;

  function paintEndLimit(slot, marketHours) {
    var d = (slot && slot.delivery) || {};
    var endOfDay = marketHours ? marketHours.end : HOURS.end;
    if (d.type === "pickup" && d.pickupHour != null) return d.pickupHour;
    if (d.type === "home") {
      return d.pickupHour != null ? d.pickupHour : endOfDay;
    }
    return endOfDay;
  }

  function slotSlack(slot, marketHours) {
    if (!slot) return Infinity;
    return paintEndLimit(slot, marketHours) - slot.end;
  }

  /** CSS class: at-limit (no room to shift later) vs has-slack. */
  function slotDeadlineClass(slot, marketHours) {
    return slotSlack(slot, marketHours) <= SLACK_EPS ? "at-limit" : "has-slack";
  }

  function findSlotRef(slotId) {
    if (!slotId) return null;
    var i;
    var j;
    for (i = 0; i < days.length; i++) {
      var day = days[i];
      for (j = 0; j < day.slots.length; j++) {
        if (day.slots[j].id === slotId) {
          return { dayId: day.id, day: day, slot: day.slots[j] };
        }
      }
    }
    return null;
  }

  function findOrnament(orderId, ornamentId) {
    var order = getOrder(orderId);
    if (!order || !ornamentId) return null;
    var ornaments = order.ornaments || [];
    var i;
    for (i = 0; i < ornaments.length; i++) {
      if (ornaments[i].id === ornamentId) return ornaments[i];
    }
    return null;
  }

  function getOrnamentSlotIds(ornament, orderId) {
    if (!ornament) return [];
    if (ornament.slotIds && ornament.slotIds.length) {
      return ornament.slotIds.slice();
    }
    var ids = [];
    var i;
    var j;
    for (i = 0; i < days.length; i++) {
      var day = days[i];
      for (j = 0; j < day.slots.length; j++) {
        var slot = day.slots[j];
        if (slot.ornamentId === ornament.id) ids.push(slot.id);
        else if (
          orderId &&
          slot.orderId === orderId &&
          slot.name === ornament.petName &&
          ids.indexOf(slot.id) < 0
        ) {
          ids.push(slot.id);
        }
      }
    }
    return ids;
  }

  function isSlotDone(slot) {
    if (!slot) return false;
    if (slot.status === "done") return true;
    if (slot.ornamentId && slot.orderId) {
      var ornament = findOrnament(slot.orderId, slot.ornamentId);
      if (ornament && ornament.status === "done") return true;
    }
    return false;
  }

  function setOrnamentStatus(orderId, ornamentId, status) {
    var next = status === "done" ? "done" : "in_progress";
    var ornament = findOrnament(orderId, ornamentId);
    if (!ornament) return false;
    ornament.status = next;
    getOrnamentSlotIds(ornament, orderId).forEach(function (slotId) {
      var ref = findSlotRef(slotId);
      if (ref) ref.slot.status = next;
    });
    return true;
  }

  function getPaintTiming(ornament, orderId) {
    if (!ornament) {
      return { status: "in_progress", label: "—", totalMin: 0, elapsedMin: 0, remainingMin: 0 };
    }
    var status = ornament.status === "done" ? "done" : "in_progress";
    if (status === "done") {
      return { status: "done", label: "Done", totalMin: 0, elapsedMin: 0, remainingMin: 0 };
    }

    var slotIds = getOrnamentSlotIds(ornament, orderId);
    var totalMin = 0;
    var elapsedMin = 0;
    var today = getTodayDay();
    var nowH = DEMO_NOW;

    slotIds.forEach(function (slotId) {
      var ref = findSlotRef(slotId);
      if (!ref) return;
      var slot = ref.slot;
      var durMin = Math.round((slot.end - slot.start) * 60);
      totalMin += durMin;
      if (ornament.paintElapsedMin != null) return;
      if (!today || ref.dayId !== today.id) return;
      if (nowH >= slot.end) elapsedMin += durMin;
      else if (nowH > slot.start) elapsedMin += Math.round((nowH - slot.start) * 60);
    });

    if (ornament.paintElapsedMin != null) {
      elapsedMin = Math.max(0, Math.round(ornament.paintElapsedMin));
    }

    var remainingMin = Math.max(0, totalMin - elapsedMin);
    var label =
      remainingMin <= 0
        ? "0 min left"
        : remainingMin + " min left";

    return {
      status: status,
      label: label,
      totalMin: totalMin,
      elapsedMin: elapsedMin,
      remainingMin: remainingMin,
    };
  }

  window.AWG_DATA = {
    MARKET: MARKET,
    MARKET_PICKUP_DAYS: MARKET_PICKUP_DAYS,
    DEMO_NOW: DEMO_NOW,
    HOUR_H: 56,
    days: days,
    orders: orders,
    fmt: fmt,
    getDay: getDay,
    getDayIndex: getDayIndex,
    getTodayDay: getTodayDay,
    getHourH: getHourH,
    getOrder: getOrder,
    getOrderByCode: getOrderByCode,
    resolveOrderFromSlot: resolveOrderFromSlot,
    getOrderSlots: getOrderSlots,
    getMarketPickupDays: getMarketPickupDays,
    marketDayOptionLabel: marketDayOptionLabel,
    paintDayLabel: paintDayLabel,
    formatPaintWindow: formatPaintWindow,
    resolveProductionStatus: resolveProductionStatus,
    productionStatusLabel: productionStatusLabel,
    productionStatusBadgeClass: productionStatusBadgeClass,
    productionStatusBadgeHtml: productionStatusBadgeHtml,
    pickupSummaryDayLabel: pickupSummaryDayLabel,
    getPickupDayId: getPickupDayId,
    getPickupHour: getPickupHour,
    getPickupSortKey: getPickupSortKey,
    weekdayShort: weekdayShort,
    SLACK_EPS: SLACK_EPS,
    slotSlack: slotSlack,
    slotDeadlineClass: slotDeadlineClass,
    findSlotRef: findSlotRef,
    findOrnament: findOrnament,
    getOrnamentSlotIds: getOrnamentSlotIds,
    isSlotDone: isSlotDone,
    setOrnamentStatus: setOrnamentStatus,
    getPaintTiming: getPaintTiming,
    hourToTop: function (h, dayStart) {
      return (h - (dayStart != null ? dayStart : HOURS.start)) * getHourH();
    },
    yToHour: function (y, dayStart, dayEnd) {
      var start = dayStart != null ? dayStart : HOURS.start;
      var end = dayEnd != null ? dayEnd : HOURS.end;
      var h = start + y / getHourH();
      h = Math.round(h * 4) / 4;
      return Math.max(start, Math.min(end, h));
    },
    overlaps: function (a0, a1, b0, b1) {
      return a0 < b1 && a1 > b0;
    },
    deliveryLabel: function (slot, paintDayId) {
      var d = slot.delivery || {};
      if (d.type === "pickup") {
        var hour = d.pickupHour != null ? d.pickupHour : slot.end;
        var pickupDayId = d.pickupDayId || paintDayId;
        var dayPart = pickupDayLabel(pickupDayId, paintDayId);
        return "Pickup " + dayPart + " " + fmt(hour);
      }
      if (d.type === "home") {
        return "Delivery " + (d.weekdayLabel || "Wednesday");
      }
      return "";
    },
    paintEndLimit: paintEndLimit,
  };
})();
