/**
 * AWG_SALE — Venta y reserva de slots (mock Agenda → Venta).
 *
 * Expone `window.AWG_SALE`:
 *
 *   mount(rootEls, opts)
 *     rootEls: { screenSale?, screenDelivery?, modalConfirm? }
 *     opts: { onToast, onStayOnAgenda, onOpenSale, onPickOtherSlot, onShowScreen,
 *             onGenerateQR, onFillHere }
 *
 *   promptSlot({ dayId, start, end, mode? })
 *     mode: "new" (default) | "add-block"
 *     · "new" — fresh sale (replaces any previous draft), then open or stay
 *     · "add-block" — append to current sale (pick-mode / same-order path)
 *
 *   openWithBlock(block)   — inicia venta con un bloque y navega a venta
 *   openEmptySale()        — borrador vacío (solo productos terminados, sin slot)
 *   addBlock(block)        — añade bloque al borrador sin navegar
 *   render()               — repinta pantalla venta / entrega
 *   getDraftBlocks()       — bloques del borrador actual ([])
 *   removeDraftBlock(id)   — quita un bloque del borrador; reset si queda vacío
 *   reset()                — sale = null
 *
 * Modelo:
 *   sale = { id, blocks:[{ id, dayId, start, end, minutes }], ornaments:[...] } | null
 *   ornament = { id, kind:'custom'|'finished', blockId, blockIds[], blockAllocations:[...],
 *                segments[], name, withName, minutes, paintStart, paintEnd,
 *                deliveryMethod:'pickup'|'home', pickup, pickupDayId, deliveryDay }
 *   · kind "finished" — €39.99 ready-made, no paint slot / no block capacity
 */
(function () {
  "use strict";

  const PRICE = 49.99;
  const NAME_EXTRA = 12.99;
  const FINISHED_PRICE = 39.99;
  const DAY_START = 12;
  const DAY_END = 19;
  const DURATION_OPTS = [30, 45, 60, 90, 120, 150];

  let sale = null;
  let rootEls = {};
  let opts = {};
  let els = {};
  let pendingSlot = null;
  let modalOwned = false;

  function noop() {}

  function toast(msg) {
    (opts.onToast || noop)(msg);
  }

  function getSaleDetail() {
    if (!sale) return null;
    const copy = JSON.parse(JSON.stringify(sale));
    copy.ornaments.forEach((o) => {
      migrateOrnament(o);
      if (!o.kind) o.kind = "custom";
      o.withName = !!o.withName;
      o.name = o.name || "";
    });
    return copy;
  }

  function formCode() {
    if (!sale) return "";
    return sale.id.replace(/^sale-/, "").slice(0, 8).toUpperCase();
  }

  function orderCode() {
    const raw = formCode().replace(/\D/g, "");
    const num = raw ? parseInt(raw.slice(0, 3), 10) : Math.floor(100 + Math.random() * 900);
    return "ABS" + String(num).padStart(3, "0");
  }

  function fmtMoney(n) {
    return "€" + Number(n).toFixed(2);
  }

  function saleDateFromBlocks() {
    const DATA = window.AWG_DATA;
    let dayId = null;
    if (sale?.blocks?.length) {
      dayId = sale.blocks[0].dayId;
    } else if (sale?.ornaments?.length) {
      const o = sale.ornaments.find((x) => x.pickupDayId) || sale.ornaments[0];
      dayId = o.pickupDayId;
    }
    if (dayId && DATA?.getDay) {
      const day = DATA.getDay(dayId);
      if (day?.dateKey) return day.dateKey;
    }
    return new Date().toISOString().slice(0, 10);
  }

  function recordCompletedSale() {
    if (!sale || sale.ornaments.length === 0) return null;
    const form = window.AWG_LAST_FORM;
    const customer = form?.customer?.fullName || "Walk-in";
    const ornaments = sale.ornaments.map((o, i) => ({
      kind: isFinished(o) ? "finished" : "custom",
      name: getOrnamentDisplayName(o, i),
      petName: o.name || form?.pet?.name || "",
      withName: !!o.withName,
    }));
    const payload = {
      code: orderCode(),
      customer,
      customerName: customer,
      date: saleDateFromBlocks(),
      ornaments,
      items: ornaments,
      paymentStatus: "unpaid",
    };
    if (window.AWG_SALES?.recordSale) {
      return window.AWG_SALES.recordSale(payload);
    }
    dispatchSaleEvent("awg:sale-complete", getSaleDetail());
    return null;
  }

  function dispatchSaleEvent(name, detail) {
    document.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true })
    );
  }

  function showScreen(name) {
    (opts.onShowScreen || noop)(name);
  }

  function fmt(h) {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function timeInputToHour(val) {
    if (!val) return null;
    const parts = val.split(":");
    const hh = +parts[0];
    const mm = +parts[1];
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh + mm / 60;
  }

  function isFinished(o) {
    return o && o.kind === "finished";
  }

  function isCustom(o) {
    return !isFinished(o);
  }

  function getOrnamentPrice(o) {
    if (isFinished(o)) return FINISHED_PRICE;
    return PRICE + (o.withName ? NAME_EXTRA : 0);
  }

  function defaultPickupDayId() {
    const DATA = window.AWG_DATA;
    const day = DATA?.getTodayDay?.() || DATA?.days?.[0];
    return day?.id || "day-1";
  }

  function defaultPickupHour() {
    return 14;
  }

  function migrateOrnament(o) {
    if (isFinished(o)) {
      o.blockAllocations = o.blockAllocations || [];
      o.blockIds = o.blockIds || [];
      return o;
    }
    if (o.blockAllocations && o.blockAllocations.length) {
      o.blockIds = o.blockAllocations.map((a) => a.blockId);
      if (!o.blockId) o.blockId = o.blockIds[0];
      return o;
    }
    if (o.blockId) {
      o.blockAllocations = [{ blockId: o.blockId, minutes: o.minutes }];
      o.blockIds = [o.blockId];
    } else {
      o.blockAllocations = o.blockAllocations || [];
      o.blockIds = o.blockIds || [];
    }
    return o;
  }

  function getAllocations(o) {
    migrateOrnament(o);
    return o.blockAllocations;
  }

  function ornamentBlockIds(o) {
    migrateOrnament(o);
    return o.blockIds && o.blockIds.length ? o.blockIds : [o.blockId];
  }

  function getPaintEndFloor(o) {
    migrateOrnament(o);
    if (isFinished(o)) return defaultPickupHour();
    if (o.segments && o.segments.length) {
      return Math.max(...o.segments.map((s) => s.paintEnd));
    }
    if (!sale) return o.paintEnd;
    let floor = o.paintEnd;
    ornamentBlockIds(o).forEach((bid) => {
      const bl = sale.blocks.find((b) => b.id === bid);
      if (bl) floor = Math.max(floor, bl.end);
    });
    return floor;
  }

  function getPaintDayId(o) {
    if (isFinished(o)) return o.pickupDayId || defaultPickupDayId();
    if (!sale) return null;
    const ids = ornamentBlockIds(o);
    let latestDayId = o.blockId ? sale.blocks.find((b) => b.id === o.blockId)?.dayId : null;
    let latestEnd = o.paintEnd ?? 0;
    ids.forEach((bid) => {
      const bl = sale.blocks.find((b) => b.id === bid);
      if (!bl) return;
      const end = bid === o.blockId && o.paintEnd != null ? o.paintEnd : bl.end;
      if (end >= latestEnd) {
        latestEnd = end;
        latestDayId = bl.dayId;
      }
    });
    return latestDayId;
  }

  function getOrnamentMarket(o) {
    const DATA = window.AWG_DATA;
    const paintDayId = getPaintDayId(o);
    if (paintDayId && DATA?.getDay) {
      const day = DATA.getDay(paintDayId);
      if (day?.market) return day.market;
    }
    return DATA?.MARKET || "Rathausplatz";
  }

  function getMarketPickupDayIds(o) {
    const DATA = window.AWG_DATA;
    const market = getOrnamentMarket(o);
    if (DATA?.getMarketPickupDays) return DATA.getMarketPickupDays(market);
    return (DATA?.days || []).map((d) => d.id);
  }

  function marketDayOptionLabel(dayId) {
    const DATA = window.AWG_DATA;
    if (DATA?.marketDayOptionLabel) return DATA.marketDayOptionLabel(dayId);
    return dayId;
  }

  function pickupSummaryDayLabel(dayId) {
    const DATA = window.AWG_DATA;
    if (DATA?.pickupSummaryDayLabel) return DATA.pickupSummaryDayLabel(dayId);
    const day = DATA?.getDay?.(dayId);
    if (day?.isToday) return "today";
    return day?.weekdayShort || "today";
  }

  function ensurePickupDayId(o) {
    const allowed = getMarketPickupDayIds(o);
    const paintDayId = getPaintDayId(o);
    if (!o.pickupDayId || !allowed.includes(o.pickupDayId)) {
      o.pickupDayId =
        paintDayId && allowed.includes(paintDayId) ? paintDayId : allowed[0] || paintDayId;
    }
  }

  function renderMarketDayOptions(o) {
    const allowed = getMarketPickupDayIds(o);
    ensurePickupDayId(o);
    return allowed
      .map((dayId) => {
        const selected = dayId === o.pickupDayId ? " selected" : "";
        return `<option value="${dayId}"${selected}>${marketDayOptionLabel(dayId)}</option>`;
      })
      .join("");
  }

  function ensureOrnamentDelivery(o) {
    if (!o.deliveryMethod) o.deliveryMethod = "pickup";
    if (!o.deliveryDay) o.deliveryDay = "Wednesday";
    if (o.pickup == null) o.pickup = getPaintEndFloor(o);
    if (o.deliveryMethod === "pickup") ensurePickupDayId(o);
  }

  function syncOrnamentPickup(o) {
    ensureOrnamentDelivery(o);
    if (o.deliveryMethod === "home") return;
    const floor = getPaintEndFloor(o);
    if (o.pickup == null || o.pickup < floor) o.pickup = floor;
  }

  function formatDeliverySummary(o) {
    ensureOrnamentDelivery(o);
    if (o.deliveryMethod === "home") {
      return `Delivery ${o.deliveryDay || "Wednesday"}`;
    }
    const dayPart = pickupSummaryDayLabel(o.pickupDayId || getPaintDayId(o));
    return `Pickup ${dayPart} · ${fmt(o.pickup)}`;
  }

  function uid(prefix) {
    return prefix + Date.now() + Math.random().toString(16).slice(2, 6);
  }

  function ensureSale() {
    if (!sale) {
      sale = { id: uid("sale-"), blocks: [], ornaments: [] };
    }
    return sale;
  }

  function usedInBlock(bl) {
    if (!sale) return 0;
    return sale.ornaments.reduce((s, o) => {
      if (isFinished(o)) return s;
      const alloc = getAllocations(o).find((a) => a.blockId === bl.id);
      return s + (alloc ? alloc.minutes : 0);
    }, 0);
  }

  function syncOrnamentTiming(o) {
    migrateOrnament(o);
    if (isFinished(o)) {
      syncOrnamentPickup(o);
      return;
    }
    const allocs = o.blockAllocations;
    o.blockIds = allocs.map((a) => a.blockId);
    o.blockId = o.blockIds[0] || null;
    o.minutes = allocs.reduce((s, a) => s + a.minutes, 0);

    o.segments = allocs.map((a) => {
      const bl = sale.blocks.find((b) => b.id === a.blockId);
      let paintStart;
      if (allocs.length === 1 && o._paintStartByBlock?.[a.blockId] != null) {
        paintStart = o._paintStartByBlock[a.blockId];
      } else if (bl) {
        paintStart = bl.start;
      } else {
        paintStart = o.paintStart || 0;
      }
      const paintEnd = paintStart + a.minutes / 60;
      return { blockId: a.blockId, minutes: a.minutes, paintStart, paintEnd };
    });

    if (o.segments.length) {
      o.paintStart = Math.min(...o.segments.map((s) => s.paintStart));
      o.paintEnd = Math.max(...o.segments.map((s) => s.paintEnd));
    }
    syncOrnamentPickup(o);
  }

  function reflowAll() {
    if (!sale) return;
    sale.blocks.forEach((bl) => {
      let cursor = bl.start;
      sale.ornaments.forEach((o) => {
        const allocs = getAllocations(o);
        if (allocs.length !== 1) return;
        const alloc = allocs.find((a) => a.blockId === bl.id);
        if (!alloc) return;
        o._paintStartByBlock = o._paintStartByBlock || {};
        o._paintStartByBlock[bl.id] = cursor;
        cursor += alloc.minutes / 60;
      });
    });
    sale.ornaments.forEach((o) => {
      syncOrnamentTiming(o);
      delete o._paintStartByBlock;
    });
  }

  function formatReservedTime(o) {
    migrateOrnament(o);
    if (o.segments && o.segments.length > 1) {
      return `${o.minutes} min · ${o.segments.map((s) => `${fmt(s.paintStart)}–${fmt(s.paintEnd)}`).join(" + ")}`;
    }
    const seg = o.segments?.[0];
    if (seg) return `${o.minutes} min · ${fmt(seg.paintStart)}–${fmt(seg.paintEnd)}`;
    return `${o.minutes} min · ${fmt(o.paintStart)}–${fmt(o.paintEnd)}`;
  }

  function formatPaintRange(o) {
    migrateOrnament(o);
    if (o.segments && o.segments.length > 1) {
      return o.segments.map((s) => `${fmt(s.paintStart)}–${fmt(s.paintEnd)}`).join(" + ");
    }
    return `${fmt(o.paintStart)}–${fmt(o.paintEnd)}`;
  }

  function linkBlockToOrnament(ornamentId, blockId) {
    const o = sale.ornaments.find((x) => x.id === ornamentId);
    const bl = sale.blocks.find((b) => b.id === blockId);
    if (!o || !bl) return false;
    migrateOrnament(o);
    if (getAllocations(o).some((a) => a.blockId === blockId)) return true;
    const free = bl.minutes - usedInBlock(bl);
    if (free <= 0) {
      toast(`Block ${fmt(bl.start)}–${fmt(bl.end)} has no free time`);
      return false;
    }
    o.blockAllocations.push({ blockId, minutes: free });
    reflowAll();
    return true;
  }

  function unlinkBlockFromOrnament(ornamentId, blockId) {
    const o = sale.ornaments.find((x) => x.id === ornamentId);
    if (!o) return false;
    migrateOrnament(o);
    if (o.blockAllocations.length <= 1) {
      toast("Ornament needs at least one reserved block");
      return false;
    }
    if (blockId === o.blockId) {
      toast("Primary block cannot be removed");
      return false;
    }
    o.blockAllocations = o.blockAllocations.filter((a) => a.blockId !== blockId);
    reflowAll();
    return true;
  }

  function mergeOrnamentsIntoOne() {
    if (!sale) return false;
    const custom = sale.ornaments.filter(isCustom);
    if (custom.length < 2) return false;
    const first = custom[0];
    migrateOrnament(first);
    custom.slice(1).forEach((o) => {
      migrateOrnament(o);
      o.blockAllocations.forEach((a) => {
        if (!first.blockAllocations.some((x) => x.blockId === a.blockId)) {
          first.blockAllocations.push({ ...a });
        }
      });
    });
    const finished = sale.ornaments.filter(isFinished);
    sale.ornaments = [first, ...finished];
    reflowAll();
    toast("Merged custom ornaments · paint can span non-contiguous slots");
    return true;
  }

  function renderBlockLinkOptions(o) {
    migrateOrnament(o);
    const linked = new Set(getAllocations(o).map((a) => a.blockId));
    const primaryId = o.blockId;
    const rows = sale.blocks
      .map((bl, idx) => {
        const isLinked = linked.has(bl.id);
        const isPrimary = bl.id === primaryId;
        const free = bl.minutes - usedInBlock(bl);
        if (!isLinked && free <= 0) return "";
        const disabled = isPrimary ? " disabled" : "";
        const checked = isLinked ? " checked" : "";
        const tag = isPrimary ? " (primary)" : isLinked ? "" : ` · ${free} min free`;
        return `<label class="checkbox-row block-link-row">
          <input type="checkbox" data-block-id="${bl.id}"${checked}${disabled} />
          Block ${idx + 1} · ${fmt(bl.start)}–${fmt(bl.end)}${tag}
        </label>`;
      })
      .filter(Boolean)
      .join("");
    if (!rows || sale.blocks.length < 2) return "";
    return `<div class="field block-links">
      <label>Use additional reserved block</label>
      <p class="tiny muted">Paint time can be split across non-contiguous slots for one ornament.</p>
      <div class="block-link-list">${rows}</div>
    </div>`;
  }

  function validateBlock(block) {
    const { start, minutes } = block;
    const end = block.end != null ? block.end : start + minutes / 60;
    if (start < DAY_START || end > DAY_END) {
      toast("Outside market hours (12:00–19:00)");
      return false;
    }
    return true;
  }

  function normalizeBlock(block) {
    const minutes = block.minutes;
    const start = block.start;
    const end = block.end != null ? block.end : start + minutes / 60;
    return {
      id: block.id || uid("b"),
      dayId: block.dayId || "day-1",
      start,
      end,
      minutes,
    };
  }

  function closestDuration(mins) {
    const all = [...DURATION_OPTS];
    if (!all.includes(mins)) all.push(mins);
    all.sort((a, b) => a - b);
    let best = all[0];
    all.forEach((v) => {
      if (Math.abs(v - mins) < Math.abs(best - mins)) best = v;
    });
    return best;
  }

  function addOrnament(blockId, minutes) {
    if (!sale) return false;
    const bl = sale.blocks.find((b) => b.id === blockId);
    if (!bl) return false;
    const used = usedInBlock(bl);
    if (used + minutes > bl.minutes) {
      toast(`Won't fit: ${bl.minutes - used} min left in the block`);
      return false;
    }
    sale.ornaments.push({
      id: uid("o"),
      kind: "custom",
      blockId,
      blockIds: [blockId],
      blockAllocations: [{ blockId, minutes }],
      name: "",
      withName: false,
      minutes,
      paintStart: bl.start,
      paintEnd: bl.start + minutes / 60,
      deliveryMethod: "pickup",
      deliveryDay: "Wednesday",
      pickupDayId: bl.dayId,
      pickup: bl.start + minutes / 60,
    });
    reflowAll();
    return true;
  }

  function addFinishedProduct() {
    ensureSale();
    const dayId = defaultPickupDayId();
    sale.ornaments.push({
      id: uid("o"),
      kind: "finished",
      blockId: null,
      blockIds: [],
      blockAllocations: [],
      name: "",
      withName: false,
      minutes: 0,
      deliveryMethod: "pickup",
      deliveryDay: "Wednesday",
      pickupDayId: dayId,
      pickup: defaultPickupHour(),
    });
    return true;
  }

  function maybeSeedFirstOrnament(block) {
    if (sale.ornaments.length > 0) return;
    addOrnament(block.id, block.minutes);
  }

  function removeOrnament(ornamentId) {
    if (!sale) return false;
    if (sale.ornaments.length <= 1) {
      toast("At least one ornament is required");
      return false;
    }
    const idx = sale.ornaments.findIndex((o) => o.id === ornamentId);
    if (idx === -1) return false;
    sale.ornaments.splice(idx, 1);
    reflowAll();
    toast("Ornament removed");
    return true;
  }

  function bindQrModalEvents(modal) {
    if (!modal || modal._awgQrBound) return;
    modal._awgQrBound = true;
    modal.querySelector("#btnCloseQrModal")?.addEventListener("click", closeQrModal);
    modal.querySelector("#btnOpenCustomerForm")?.addEventListener("click", () => {
      dispatchSaleEvent("awg:open-customer-form", getSaleDetail());
      closeQrModal();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeQrModal();
    });
  }

  function ensureQrModal() {
    let modal = rootEls.modalGenerateQr || document.getElementById("modalGenerateQr");
    if (modal) {
      bindQrModalEvents(modal);
      return modal;
    }

    modal = document.createElement("div");
    modal.className = "modal-back";
    modal.id = "modalGenerateQr";
    modal.innerHTML = `
      <div class="modal qr-modal">
        <h3>Customer form · QR</h3>
        <p class="muted" style="margin-bottom:14px">Scan or share this link so the customer can fill in their details.</p>
        <div class="qr-stub" id="qrStub" aria-hidden="true"></div>
        <p class="qr-link" id="qrLinkText"></p>
        <div class="actions">
          <button class="btn ghost" id="btnCloseQrModal" type="button">Close</button>
          <button class="btn" id="btnOpenCustomerForm" type="button">Open customer form</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    bindQrModalEvents(modal);
    return modal;
  }

  function openQrModal() {
    const code = formCode();
    const url = `https://awg.demo/f/${code}`;
    const modal = ensureQrModal();
    const linkEl = modal.querySelector("#qrLinkText");
    if (linkEl) linkEl.textContent = url;
    modal.classList.add("on");
  }

  function closeQrModal() {
    const modal = document.getElementById("modalGenerateQr");
    if (modal) modal.classList.remove("on");
  }

  function handleGenerateQR() {
    if (!sale || sale.ornaments.length === 0) {
      toast("Add at least one product first");
      return;
    }
    ensureSale();
    const detail = getSaleDetail();
    (opts.onGenerateQR || noop)(detail);
    dispatchSaleEvent("awg:generate-qr", detail);
    openQrModal();
  }

  function handleFillHere() {
    if (!sale || sale.ornaments.length === 0) {
      toast("Add at least one product first");
      return;
    }
    ensureSale();
    const detail = getSaleDetail();
    (opts.onFillHere || noop)(detail);
    dispatchSaleEvent("awg:fill-here", detail);
  }

  function bindSaleEvents() {
    if (!els.btnAddInBlock || els.btnAddInBlock._awgBound) return;
    els.btnAddInBlock._awgBound = true;

    els.btnAddInBlock.addEventListener("click", () => {
      if (!sale) return;
      const bl = sale.blocks.find((b) => usedInBlock(b) < b.minutes);
      if (!bl) {
        toast("Blocks full · use «Add slot in calendar»");
        return;
      }
      const left = bl.minutes - usedInBlock(bl);
      if (left <= 0) {
        toast("No time left in this block");
        return;
      }
      addOrnament(bl.id, left);
      render();
      toast("Ornament added in the same block");
    });

    els.btnAddFinished?.addEventListener("click", () => {
      addFinishedProduct();
      render();
      toast("Finished product added · €" + FINISHED_PRICE.toFixed(2));
    });

    els.btnPickOtherSlot?.addEventListener("click", () => {
      ensureSale();
      (opts.onPickOtherSlot || noop)();
    });

    els.btnBackAgenda?.addEventListener("click", () => {
      showScreen("agenda");
    });

    els.btnToDelivery?.addEventListener("click", () => {
      showScreen("delivery");
      renderDelivery();
    });

    els.btnBackSale?.addEventListener("click", () => {
      showScreen("sale");
      render();
    });

    els.btnDone?.addEventListener("click", () => {
      const recorded = recordCompletedSale();
      if (recorded) {
        toast("Order recorded · " + recorded.code + " · " + fmtMoney(recorded.total));
      } else {
        toast("Flow validated ✓ · ready to continue in Figma");
      }
      reset();
      showScreen("agenda");
    });

    els.btnGenerateQR?.addEventListener("click", handleGenerateQR);
    els.btnFillHere?.addEventListener("click", handleFillHere);

    els.btnMergeOrnaments?.addEventListener("click", () => {
      if (!sale) return;
      mergeOrnamentsIntoOne();
      render();
    });
  }

  function bindOrnamentDeliveryEvents(el, o) {
    const methodSel = el.querySelector('[data-field="deliveryMethod"]');
    const pickupField = el.querySelector(".pickup-time-field");
    const pickupInput = el.querySelector('[data-field="pickup"]');
    const marketDayField = el.querySelector(".market-day-field");
    const marketDaySel = el.querySelector('[data-field="pickupDayId"]');
    const dayField = el.querySelector(".delivery-day-field");
    const daySel = el.querySelector('[data-field="deliveryDay"]');
    const floorNote = el.querySelector(".pickup-floor-note");

    function refreshFloorNote() {
      if (!floorNote) return;
      floorNote.textContent = isFinished(o)
        ? "Any time during market hours (12:00–19:00)"
        : `Earliest: after painting · ${fmt(getPaintEndFloor(o))}`;
    }

    function refreshPickupFields() {
      const isPickup = o.deliveryMethod !== "home";
      if (pickupField) pickupField.hidden = !isPickup;
      if (marketDayField) marketDayField.hidden = !isPickup;
      if (dayField) dayField.hidden = isPickup;
    }

    if (methodSel) {
      methodSel.addEventListener("change", (e) => {
        o.deliveryMethod = e.target.value;
        refreshPickupFields();
        if (o.deliveryMethod === "pickup") {
          ensurePickupDayId(o);
          syncOrnamentPickup(o);
          if (pickupInput) pickupInput.value = fmt(o.pickup);
          if (marketDaySel) marketDaySel.value = o.pickupDayId;
          refreshFloorNote();
        }
        renderSummaryOnly();
      });
    }

    if (pickupInput) {
      pickupInput.addEventListener("change", (e) => {
        const h = timeInputToHour(e.target.value);
        if (h == null) return;
        o.pickup = h;
        if (!isFinished(o)) {
          const floor = getPaintEndFloor(o);
          if (h < floor - 0.001) {
            toast(`Pickup is before painting ends (${fmt(floor)})`);
          }
        }
        renderSummaryOnly();
      });
    }

    if (marketDaySel) {
      marketDaySel.addEventListener("change", (e) => {
        o.pickupDayId = e.target.value;
        renderSummaryOnly();
      });
    }

    if (daySel) {
      daySel.addEventListener("change", (e) => {
        o.deliveryDay = e.target.value;
        renderSummaryOnly();
      });
    }
  }

  function renderDeliveryFields(o) {
    ensureOrnamentDelivery(o);
    const isPickup = o.deliveryMethod !== "home";
    const floorNote = isFinished(o)
      ? "Any time during market hours (12:00–19:00)"
      : `Earliest: after painting · ${fmt(getPaintEndFloor(o))}`;
    return `<div class="delivery-fields">
      <div class="field">
        <label>Delivery method</label>
        <select data-field="deliveryMethod">
          <option value="pickup"${isPickup ? " selected" : ""}>Market pickup</option>
          <option value="home"${!isPickup ? " selected" : ""}>Home delivery · Wed / Fri only</option>
        </select>
        <p class="tiny muted" style="margin:6px 0 0">Only market pickup or home delivery on Wednesday / Friday.</p>
      </div>
      <div class="field market-day-field"${!isPickup ? " hidden" : ""}>
        <label>Market day</label>
        <select data-field="pickupDayId">${renderMarketDayOptions(o)}</select>
      </div>
      <div class="field pickup-time-field"${!isPickup ? " hidden" : ""}>
        <label>Pickup time (at the market)</label>
        <input type="time" data-field="pickup" step="900" value="${fmt(o.pickup)}" />
        <p class="tiny muted pickup-floor-note">${floorNote}</p>
      </div>
      <div class="field delivery-day-field"${isPickup ? " hidden" : ""}>
        <label>Home delivery day (no exact time)</label>
        <select data-field="deliveryDay">
          <option value="Wednesday"${o.deliveryDay !== "Friday" ? " selected" : ""}>Wednesday</option>
          <option value="Friday"${o.deliveryDay === "Friday" ? " selected" : ""}>Friday</option>
        </select>
      </div>
    </div>`;
  }

  function getOrnamentDisplayName(o, index) {
    const form = window.AWG_LAST_FORM;
    const formBack =
      form?.pet?.backName && index === 0 ? form.pet.backName : "";
    const name = (o.name || formBack || "").trim();
    if (name) return name;
    if (o.withName) return "Name on back";
    return "No name";
  }

  function applyCustomerForm(data) {
    if (!sale || !data?.pet) return;
    const pet = data.pet;
    if (sale.ornaments.length > 0) {
      const o = sale.ornaments[0];
      if (pet.backName) o.name = pet.backName;
      if (pet.ornamentNameOnBack) o.withName = true;
    }
  }

  function renderSummaryOnly() {
    if (!sale || !els.summaryList) return;
    let total = 0;
    let customCount = 0;
    let finishedCount = 0;
    let paintMinutes = 0;
    const customerCard = els.summaryList.querySelector(".customer-summary");
    els.summaryList.innerHTML = sale.ornaments
      .map((o, i) => {
        ensureOrnamentDelivery(o);
        const price = getOrnamentPrice(o);
        total += price;
        if (isFinished(o)) {
          finishedCount += 1;
        } else {
          customCount += 1;
          paintMinutes += o.minutes || 0;
        }
        const kindLabel = isFinished(o) ? "Finished" : "Custom";
        const namePart = isCustom(o) ? getOrnamentDisplayName(o, i) : "";
        const title =
          isFinished(o) || namePart === "No name"
            ? `${i + 1}. ${kindLabel}`
            : `${i + 1}. ${kindLabel} · ${namePart}`;
        const meta = isFinished(o)
          ? `Ready-made · ${formatDeliverySummary(o)}`
          : `${formatPaintRange(o)} · ${formatDeliverySummary(o)}`;
        return `<div class="card">
          <div class="row"><b>${title}</b><span>€${price.toFixed(2)}</span></div>
          <div class="muted">${meta}</div>
        </div>`;
      })
      .join("");
    if (customerCard) els.summaryList.insertBefore(customerCard, els.summaryList.firstChild);
    if (els.totalEur) els.totalEur.textContent = "€" + total.toFixed(2);
    if (els.totalMeta) {
      const metaParts = [`${sale.ornaments.length} ornament(s)`];
      if (customCount && finishedCount) {
        metaParts.push(`${customCount} custom · ${finishedCount} finished`);
      } else if (finishedCount && !customCount) {
        metaParts.push(`${finishedCount} finished`);
      }
      if (paintMinutes) metaParts.push(`${paintMinutes} min`);
      els.totalMeta.textContent = metaParts.join(" · ");
    }
  }

  function renderOrnamentSaleCard(o, i) {
    ensureOrnamentDelivery(o);
    syncOrnamentTiming(o);
    const removeBtn =
      sale.ornaments.length > 1
        ? `<div class="actions" style="margin-top:0;margin-bottom:10px">
            <button class="btn ghost sm" type="button" data-action="remove-ornament">Remove</button>
          </div>`
        : "";

    if (isFinished(o)) {
      return `<div class="ornament ornament-finished" data-id="${o.id}">
        <h3>Finished product ${i + 1} · €${FINISHED_PRICE.toFixed(2)}
          <span class="pill" style="margin-left:6px">Ready-made</span>
        </h3>
        <p class="tiny muted" style="margin:0 0 10px">No paint slot · fixed price · delivery only</p>
        ${removeBtn}
        ${renderDeliveryFields(o)}
      </div>`;
    }

    const blockLabel =
      o.segments && o.segments.length > 1
        ? `${o.segments.length} blocks`
        : `block ${formatPaintRange(o)}`;
    return `<div class="ornament" data-id="${o.id}">
      <h3>Custom ornament ${i + 1} · ${o.minutes} min
        <span class="tiny"> · ${blockLabel}</span>
      </h3>
      <div class="field">
        <label>Reserved time (from calendar)</label>
        <input type="text" readonly value="${formatReservedTime(o)}" />
      </div>
      ${renderBlockLinkOptions(o)}
      <div class="field ornament-name-opt">
        <label class="checkbox-row">
          <input type="checkbox" data-field="withName"${o.withName ? " checked" : ""} />
          Add name on the back (+€${NAME_EXTRA.toFixed(2)})
        </label>
      </div>
      ${removeBtn}
      ${renderDeliveryFields(o)}
    </div>`;
  }

  function bindOrnamentSaleEvents(el, o) {
    const id = el.dataset.id;
    const checkbox = el.querySelector('[data-field="withName"]');

    if (checkbox) {
      checkbox.addEventListener("change", (e) => {
        o.withName = e.target.checked;
        renderSummaryOnly();
      });
    }

    bindOrnamentDeliveryEvents(el, o);

    el.querySelector('[data-action="remove-ornament"]')?.addEventListener("click", () => {
      if (removeOrnament(id)) render();
    });

    el.querySelectorAll(".block-link-row input[type='checkbox']").forEach((input) => {
      input.addEventListener("change", (e) => {
        const blockId = e.target.dataset.blockId;
        if (e.target.checked) {
          if (!linkBlockToOrnament(o.id, blockId)) {
            e.target.checked = false;
            return;
          }
        } else if (!unlinkBlockFromOrnament(o.id, blockId)) {
          e.target.checked = true;
          return;
        }
        render();
      });
    });
  }

  function renderSale() {
    bindSaleEvents();
    if (!els.screenSale) return;

    if (!sale) {
      if (els.saleHint) {
        els.saleHint.textContent =
          "Use «+ Create order» or reserve a slot from Agenda to start a sale.";
      }
      if (els.blockSummary) els.blockSummary.textContent = "No block.";
      if (els.ornaments) els.ornaments.innerHTML = "";
      if (els.summaryList) els.summaryList.innerHTML = "";
      if (els.btnToDelivery) els.btnToDelivery.disabled = true;
      if (els.btnAddInBlock) els.btnAddInBlock.disabled = true;
      if (els.btnAddFinished) els.btnAddFinished.disabled = true;
      if (els.btnGenerateQR) els.btnGenerateQR.disabled = true;
      if (els.btnFillHere) els.btnFillHere.disabled = true;
      return;
    }

    const hasBlocks = sale.blocks.length > 0;
    const hasOrnaments = sale.ornaments.length > 0;

    if (els.saleHint) {
      if (!hasBlocks && !hasOrnaments) {
        els.saleHint.textContent =
          "Add a finished product (no slot needed) or reserve a paint slot from Agenda.";
      } else if (!hasBlocks && hasOrnaments) {
        els.saleHint.textContent =
          "Finished-only order — no paint slot. You can still add custom ornaments after reserving a slot.";
      } else {
        els.saleHint.innerHTML = `
          Reserved slots are linked below. One custom ornament can use <b>multiple non-contiguous blocks</b>.
          Finished products do not use paint capacity. Set delivery per item.
        `;
      }
    }

    if (els.blockSummary) {
      if (!hasBlocks) {
        els.blockSummary.textContent = "No paint slot reserved (finished-only order is OK).";
      } else {
        els.blockSummary.innerHTML = sale.blocks
          .map((bl, i) => {
            const used = usedInBlock(bl);
            const left = bl.minutes - used;
            return `<div style="margin-bottom:8px">
              <span class="pill">Block ${i + 1}</span>
              <b> ${fmt(bl.start)}–${fmt(bl.end)}</b>
              <span class="muted"> · ${used}/${bl.minutes} min · ${left} left</span>
            </div>`;
          })
          .join("");
      }
    }

    const totalCap = sale.blocks.reduce((s, b) => s + b.minutes, 0);
    const totalUsed = sale.ornaments.reduce(
      (s, o) => s + (isFinished(o) ? 0 : o.minutes),
      0
    );
    if (els.capLabel) {
      els.capLabel.textContent = hasBlocks
        ? `${totalUsed} / ${totalCap} min used`
        : "No paint capacity used";
    }
    if (els.capBar) {
      const pct = totalCap ? Math.min(100, (totalUsed / totalCap) * 100) : 0;
      const span = els.capBar.querySelector("span");
      if (span) span.style.width = pct + "%";
      els.capBar.classList.toggle("warn", pct >= 80 && pct < 100);
      els.capBar.classList.toggle("full", pct >= 100);
    }

    if (els.ornaments) {
      els.ornaments.innerHTML = sale.ornaments
        .map((o, i) => renderOrnamentSaleCard(o, i))
        .join("");
      els.ornaments.querySelectorAll(".ornament").forEach((el) => {
        const o = sale.ornaments.find((x) => x.id === el.dataset.id);
        if (o) bindOrnamentSaleEvents(el, o);
      });
    }

    if (els.btnMergeOrnaments) {
      const customCount = sale.ornaments.filter(isCustom).length;
      els.btnMergeOrnaments.hidden = customCount < 2;
      els.btnMergeOrnaments.disabled = customCount < 2;
    }

    renderSummaryOnly();
    if (els.btnToDelivery) els.btnToDelivery.disabled = !hasOrnaments;
    if (els.btnAddInBlock) {
      els.btnAddInBlock.disabled =
        !hasBlocks || !sale.blocks.some((bl) => usedInBlock(bl) < bl.minutes);
    }
    if (els.btnAddFinished) els.btnAddFinished.disabled = false;
    if (els.btnGenerateQR) els.btnGenerateQR.disabled = !hasOrnaments;
    if (els.btnFillHere) els.btnFillHere.disabled = !hasOrnaments;
  }

  function renderDelivery() {
    if (!els.deliveryList || !sale) return;
    els.deliveryList.innerHTML = sale.ornaments
      .map((o, i) => {
        ensureOrnamentDelivery(o);
        syncOrnamentTiming(o);
        if (isFinished(o)) {
          return `<div class="ornament ornament-finished" data-id="${o.id}">
            <h3>Finished product ${i + 1} · €${FINISHED_PRICE.toFixed(2)}</h3>
            <p class="tiny muted" style="margin:0 0 8px">Ready-made · no paint slot</p>
            ${renderDeliveryFields(o)}
            <p class="tiny muted delivery-summary-line">${formatDeliverySummary(o)}</p>
          </div>`;
        }
        const displayName = getOrnamentDisplayName(o, i);
        const nameSuffix = displayName !== "No name" ? " · " + displayName : "";
        return `<div class="ornament" data-id="${o.id}">
          <h3>Custom ornament ${i + 1}${nameSuffix} · ${o.minutes} min</h3>
          <div class="reserved-box">Paint slot · ${formatPaintRange(o)}</div>
          ${renderDeliveryFields(o)}
          <p class="tiny muted delivery-summary-line">${formatDeliverySummary(o)}</p>
        </div>`;
      })
      .join("");

    els.deliveryList.querySelectorAll(".ornament").forEach((el) => {
      const o = sale.ornaments.find((x) => x.id === el.dataset.id);
      if (!o) return;
      bindOrnamentDeliveryEvents(el, o);
      const methodSel = el.querySelector('[data-field="deliveryMethod"]');
      const marketDaySel = el.querySelector('[data-field="pickupDayId"]');
      const daySel = el.querySelector('[data-field="deliveryDay"]');
      const pickupInput = el.querySelector('[data-field="pickup"]');
      const summaryLine = el.querySelector(".delivery-summary-line");
      function refreshSummaryLine() {
        if (summaryLine) summaryLine.textContent = formatDeliverySummary(o);
      }
      if (methodSel) methodSel.addEventListener("change", refreshSummaryLine);
      if (marketDaySel) marketDaySel.addEventListener("change", refreshSummaryLine);
      if (daySel) daySel.addEventListener("change", refreshSummaryLine);
      if (pickupInput) pickupInput.addEventListener("change", refreshSummaryLine);
    });
  }

  function ensureSaleMarkup() {
    let screenSale = rootEls.screenSale || document.getElementById("screen-sale");
    if (screenSale) return screenSale;

    const host = rootEls.root || document.querySelector("main.wrap") || document.body;
    screenSale = document.createElement("section");
    screenSale.id = "screen-sale";
    screenSale.className = "screen";
    screenSale.innerHTML = `
      <h1>New order</h1>
      <div class="steps">
        <span class="on">1 Ornaments</span>
        <span>2 Delivery</span>
        <span>3 Payment & QR</span>
      </div>
      <div class="hint" id="saleHint"></div>
      <div class="cols">
        <div>
          <div class="panel" style="margin-bottom:16px">
            <h2>Reserved block</h2>
            <div id="blockSummary" class="muted">No block yet.</div>
            <div class="capacity">
              <span id="capLabel">0 / 0 min used</span>
              <div class="bar" id="capBar"><span></span></div>
            </div>
            <div class="actions">
              <button class="btn sm" id="btnAddInBlock" type="button">+ Ornament in this block</button>
              <button class="btn ghost sm" id="btnAddFinished" type="button">+ Finished product (fixed price)</button>
              <button class="btn ghost sm" id="btnPickOtherSlot" type="button">+ Add slot in calendar</button>
              <button class="btn ghost sm" id="btnMergeOrnaments" type="button" hidden>Merge into one ornament</button>
            </div>
          </div>
          <div id="ornaments"></div>
          <div class="actions">
            <button class="btn ghost" id="btnBackAgenda" type="button">← Back to agenda</button>
            <button class="btn" id="btnToDelivery" type="button" disabled>Choose delivery →</button>
          </div>
        </div>
        <aside class="panel">
          <h2>Order summary</h2>
          <div class="card" style="margin-bottom:12px">
            <div class="row"><b>Total</b><b id="totalEur">€0</b></div>
            <div class="muted" id="totalMeta" style="margin-top:6px">0 ornaments</div>
          </div>
          <div class="list" id="summaryList"></div>
          <div class="actions staff-actions" id="saleStaffActions">
            <button class="btn sm ghost" id="btnGenerateQR" type="button" disabled>Generate QR</button>
            <button class="btn sm" id="btnFillHere" type="button" disabled>Fill in here</button>
          </div>
        </aside>
      </div>`;
    host.appendChild(screenSale);
    return screenSale;
  }

  function ensureDeliveryMarkup() {
    let screenDelivery = rootEls.screenDelivery || document.getElementById("screen-delivery");
    if (screenDelivery) return screenDelivery;

    const host = rootEls.root || document.querySelector("main.wrap") || document.body;
    screenDelivery = document.createElement("section");
    screenDelivery.id = "screen-delivery";
    screenDelivery.className = "screen";
    screenDelivery.innerHTML = `
      <h1>Delivery</h1>
      <div class="steps">
        <span>1 Ornaments</span>
        <span class="on">2 Delivery</span>
        <span>3 Payment & QR</span>
      </div>
      <p class="sub">Pickup is scheduled <b>after</b> the reserved painting time.</p>
      <div id="deliveryList"></div>
      <div class="actions">
        <button class="btn ghost" id="btnBackSale" type="button">← Ornaments</button>
        <button class="btn" id="btnDone" type="button">Simulate payment / QR</button>
      </div>`;
    host.appendChild(screenDelivery);
    return screenDelivery;
  }

  function resolveEls() {
    const screenSale = ensureSaleMarkup();
    const screenDelivery = ensureDeliveryMarkup();

    els = {
      screenSale,
      screenDelivery,
      saleHint: screenSale?.querySelector("#saleHint") || document.getElementById("saleHint"),
      blockSummary: screenSale?.querySelector("#blockSummary") || document.getElementById("blockSummary"),
      capLabel: screenSale?.querySelector("#capLabel") || document.getElementById("capLabel"),
      capBar: screenSale?.querySelector("#capBar") || document.getElementById("capBar"),
      btnAddInBlock: screenSale?.querySelector("#btnAddInBlock") || document.getElementById("btnAddInBlock"),
      btnAddFinished: screenSale?.querySelector("#btnAddFinished") || document.getElementById("btnAddFinished"),
      btnPickOtherSlot: screenSale?.querySelector("#btnPickOtherSlot") || document.getElementById("btnPickOtherSlot"),
      btnMergeOrnaments: screenSale?.querySelector("#btnMergeOrnaments") || document.getElementById("btnMergeOrnaments"),
      ornaments: screenSale?.querySelector("#ornaments") || document.getElementById("ornaments"),
      btnBackAgenda: screenSale?.querySelector("#btnBackAgenda") || document.getElementById("btnBackAgenda"),
      btnToDelivery: screenSale?.querySelector("#btnToDelivery") || document.getElementById("btnToDelivery"),
      totalEur: document.getElementById("totalEur"),
      totalMeta: document.getElementById("totalMeta"),
      summaryList: document.getElementById("summaryList"),
      saleStaffActions: screenSale?.querySelector("#saleStaffActions") || document.getElementById("saleStaffActions"),
      btnGenerateQR: screenSale?.querySelector("#btnGenerateQR") || document.getElementById("btnGenerateQR"),
      btnFillHere: screenSale?.querySelector("#btnFillHere") || document.getElementById("btnFillHere"),
      deliveryList: screenDelivery?.querySelector("#deliveryList") || document.getElementById("deliveryList"),
      btnBackSale: screenDelivery?.querySelector("#btnBackSale") || document.getElementById("btnBackSale"),
      btnDone: screenDelivery?.querySelector("#btnDone") || document.getElementById("btnDone"),
    };
  }

  function ensureModal() {
    let modal = rootEls.modalConfirm || document.getElementById("modalConfirm");
    if (modal) {
      modal.innerHTML = buildModalInner();
      bindModalEvents(modal);
      return modal;
    }

    modalOwned = true;
    modal = document.createElement("div");
    modal.className = "modal-back";
    modal.id = "modalConfirm";
    modal.innerHTML = buildModalInner();
    document.body.appendChild(modal);
    bindModalEvents(modal);
    return modal;
  }

  function buildModalInner() {
    const optsHtml = DURATION_OPTS.map(
      (v) => `<option value="${v}">${v} min</option>`
    ).join("");
    return `
      <div class="modal">
        <h3>Reserve time</h3>
        <p id="modalText">Confirm block duration.</p>
        <div class="field">
          <label>Duration</label>
          <select id="modalDuration">${optsHtml}</select>
        </div>
        <div class="actions">
          <button class="btn ghost" id="modalCancel" type="button">Cancel</button>
          <button class="btn ghost" id="modalStay" type="button">Add another slot to this order</button>
          <button class="btn" id="modalOpen" type="button">Done · open sale</button>
        </div>
      </div>`;
  }

  function bindModalEvents(modal) {
    const cancel = modal.querySelector("#modalCancel");
    const stay = modal.querySelector("#modalStay");
    const open = modal.querySelector("#modalOpen");

    cancel.onclick = closeModal;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    stay.onclick = () => commitSlot(false);
    open.onclick = () => commitSlot(true);
  }

  function closeModal() {
    pendingSlot = null;
    const modal = document.getElementById("modalConfirm");
    if (modal) modal.classList.remove("on");
  }

  function openModal() {
    const modal = ensureModal();
    modal.classList.add("on");
  }

  function replaceDraftIfNeeded() {
    if (!sale) return;
    toast("Previous draft replaced");
    reset();
  }

  function commitSlot(openSale) {
    if (!pendingSlot) return;
    const modal = document.getElementById("modalConfirm");
    const sel = modal?.querySelector("#modalDuration");
    const minutes = sel ? +sel.value : pendingSlot.draggedMinutes;
    const { dayId, start, mode } = pendingSlot;
    const slotMode = mode || "new";
    const end = start + minutes / 60;

    const block = normalizeBlock({ dayId, start, end, minutes });
    if (!validateBlock(block)) return;

    closeModal();

    if (slotMode === "new") {
      replaceDraftIfNeeded();
      if (openSale) {
        openWithBlock(block);
      } else {
        sale = { id: uid("sale-"), blocks: [block], ornaments: [] };
        maybeSeedFirstOrnament(block);
        render();
        (opts.onStayOnAgenda || noop)({ mode: "new" });
      }
      return;
    }

    ensureSale();
    sale.blocks.push(block);
    maybeSeedFirstOrnament(block);
    render();
    if (openSale) {
      (opts.onOpenSale || noop)();
    } else {
      (opts.onStayOnAgenda || noop)({ mode: "add-block" });
    }
  }

  function promptSlot({ dayId, start, end, mode = "new" }) {
    const draggedMinutes = Math.round((end - start) * 60);
    pendingSlot = { dayId, start, end, draggedMinutes, mode };

    ensureModal();
    const modal = document.getElementById("modalConfirm");
    const text = modal.querySelector("#modalText");
    const sel = modal.querySelector("#modalDuration");

    if (text) {
      text.textContent = `Free slot: ${fmt(start)} – ${fmt(end)} (${draggedMinutes} min dragged). Choose block duration.`;
    }

    const best = closestDuration(draggedMinutes);
    sel.querySelectorAll("[data-dragged]").forEach((n) => n.remove());
    if (!DURATION_OPTS.includes(draggedMinutes)) {
      const opt = document.createElement("option");
      opt.value = String(draggedMinutes);
      opt.textContent = `${draggedMinutes} min (dragged)`;
      opt.dataset.dragged = "1";
      sel.insertBefore(opt, sel.firstChild);
    }
    sel.value = String(best);

    openModal();
  }

  function addBlock(block) {
    const bl = normalizeBlock(block);
    if (!validateBlock(bl)) return null;
    ensureSale();
    sale.blocks.push(bl);
    return bl;
  }

  function openWithBlock(block) {
    const bl = normalizeBlock(block);
    if (!validateBlock(bl)) return null;
    sale = { id: uid("sale-"), blocks: [bl], ornaments: [] };
    maybeSeedFirstOrnament(bl);
    render();
    (opts.onOpenSale || noop)();
    return bl;
  }

  function openEmptySale() {
    sale = { id: uid("sale-"), blocks: [], ornaments: [] };
    render();
    return sale;
  }

  function getDraftBlocks() {
    return sale ? sale.blocks.map((b) => ({ ...b })) : [];
  }

  function removeDraftBlock(blockId) {
    if (!sale) return false;
    const idx = sale.blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return false;

    sale.ornaments = sale.ornaments.filter((o) => {
      if (isFinished(o)) return true;
      migrateOrnament(o);
      const allocs = getAllocations(o);
      return !(allocs.length === 1 && allocs[0].blockId === blockId);
    });

    sale.ornaments.forEach((o) => {
      if (isFinished(o)) return;
      migrateOrnament(o);
      o.blockAllocations = o.blockAllocations.filter((a) => a.blockId !== blockId);
      if (o.blockId === blockId && o.blockAllocations.length > 0) {
        o.blockId = o.blockAllocations[0].blockId;
      }
    });

    sale.ornaments = sale.ornaments.filter(
      (o) => isFinished(o) || getAllocations(o).length > 0
    );
    sale.blocks.splice(idx, 1);

    if (sale.blocks.length === 0) {
      if (sale.ornaments.length === 0) {
        reset();
      } else {
        render();
      }
      return true;
    }

    reflowAll();
    render();
    return true;
  }

  function reset() {
    sale = null;
    pendingSlot = null;
    render();
  }

  function mount(roots, options) {
    rootEls = roots || {};
    opts = options || {};
    resolveEls();
    ensureModal();
    ensureQrModal();
    bindSaleEvents();
    render();
  }

  function render() {
    resolveEls();
    renderSale();
  }

  window.AWG_SALE = {
    mount,
    promptSlot,
    openWithBlock,
    openEmptySale,
    addBlock,
    render,
    getDraftBlocks,
    removeDraftBlock,
    reset,
    applyCustomerForm,
    PRICES: { custom: PRICE, nameExtra: NAME_EXTRA, finished: FINISHED_PRICE },
    /** Solo para depuración del shell */
    _getSale: () => (sale ? JSON.parse(JSON.stringify(sale)) : null),
  };
})();
