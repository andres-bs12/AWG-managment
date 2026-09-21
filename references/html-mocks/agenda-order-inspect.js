/**
 * AWG_INSPECT — Ornament / pet photo inspection (staff visual QA).
 *
 * Exposes `window.AWG_INSPECT`:
 *   mount(rootEls, opts)  — opts: { onShowScreen, onToast }
 *   open(detail)          — { ornament, order, orderId?, returnScreen? }
 *   close()               — back to order detail / return screen
 *
 * Listens for:
 *   awg:inspect-ornament  — detail: { ornament, order, returnScreen? }
 *
 * Dispatches:
 *   awg:ornament-status-changed — { ornament, order, orderId, status, slotIds }
 *   awg:close-ornament-inspect
 */
(function () {
  "use strict";

  var DATA = window.AWG_DATA;
  var rootEls = {};
  var opts = {};
  var els = {};
  var state = {
    ornament: null,
    order: null,
    orderId: null,
    photoIndex: 0,
    returnScreen: "agenda",
    lightboxOpen: false,
  };
  var swipeStore = { current: null };
  var lightboxSwipeStore = { current: null };
  var SWIPE_THRESHOLD = 48;
  var timingTimer = null;

  function noop() {}

  function toast(msg) {
    if (typeof opts.onToast === "function") {
      opts.onToast(msg);
    }
  }

  function showScreen(name) {
    (opts.onShowScreen || noop)(name);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveOrderId() {
    if (state.orderId) return state.orderId;
    if (state.order && state.order.id) return state.order.id;
    return null;
  }

  function ensureMarkup() {
    var screen =
      rootEls.screenOrnamentInspect ||
      document.getElementById("screen-ornament-inspect");
    if (screen) return screen;

    var host =
      rootEls.root ||
      document.querySelector("main.wrap") ||
      document.body;
    screen = document.createElement("section");
    screen.id = "screen-ornament-inspect";
    screen.className = "screen inspect-screen";
    screen.innerHTML =
      '<div class="inspect-top">' +
      '  <button type="button" class="btn ghost sm" id="btnInspectBack">← Back to order</button>' +
      '  <span class="inspect-order-code" id="inspectOrderCode"></span>' +
      "</div>" +
      '<div class="inspect-meta">' +
      '  <div class="inspect-pet-name" id="inspectPetName"></div>' +
      '  <div class="inspect-back-name" id="inspectBackName" hidden></div>' +
      '  <div class="inspect-time-wrap" id="inspectTimeWrap">' +
      '    <span class="inspect-label">Time left</span>' +
      '    <span class="inspect-time-value" id="inspectTimeRemaining">—</span>' +
      "  </div>" +
      "</div>" +
      '<div class="inspect-viewer" id="inspectViewer">' +
      '  <button type="button" class="inspect-nav inspect-prev" id="btnInspectPrev" aria-label="Previous photo">‹</button>' +
      '  <div class="inspect-stage" id="inspectStage">' +
      '    <button type="button" class="inspect-photo-hit" id="btnInspectPhotoOpen" aria-label="Open photo full screen">' +
      '      <img class="inspect-photo" id="inspectPhoto" alt="" />' +
      "    </button>" +
      '    <div class="inspect-empty" id="inspectEmpty" hidden>No photos uploaded</div>' +
      "  </div>" +
      '  <button type="button" class="inspect-nav inspect-next" id="btnInspectNext" aria-label="Next photo">›</button>' +
      '  <div class="inspect-counter" id="inspectCounter"></div>' +
      "</div>" +
      '<div class="inspect-thumbs" id="inspectThumbs" hidden></div>' +
      '<div class="inspect-actions">' +
      '  <button type="button" class="btn" id="btnInspectToggleDone">Mark as finished</button>' +
      "</div>" +
      '<div class="inspect-lightbox" id="inspectLightbox" hidden aria-hidden="true">' +
      '  <button type="button" class="inspect-lightbox-close" id="btnInspectLightboxClose" aria-label="Close full screen">×</button>' +
      '  <button type="button" class="inspect-nav inspect-prev inspect-lightbox-prev" id="btnInspectLightboxPrev" aria-label="Previous photo">‹</button>' +
      '  <div class="inspect-lightbox-stage" id="inspectLightboxStage">' +
      '    <img class="inspect-lightbox-photo" id="inspectLightboxPhoto" alt="" />' +
      "  </div>" +
      '  <button type="button" class="inspect-nav inspect-next inspect-lightbox-next" id="btnInspectLightboxNext" aria-label="Next photo">›</button>' +
      '  <div class="inspect-counter inspect-lightbox-counter" id="inspectLightboxCounter"></div>' +
      "</div>";

    host.appendChild(screen);
    return screen;
  }

  function resolveEls() {
    ensureMarkup();
    els.screen = document.getElementById("screen-ornament-inspect");
    els.btnBack = document.getElementById("btnInspectBack");
    els.orderCode = document.getElementById("inspectOrderCode");
    els.petName = document.getElementById("inspectPetName");
    els.backName = document.getElementById("inspectBackName");
    els.timeWrap = document.getElementById("inspectTimeWrap");
    els.timeRemaining = document.getElementById("inspectTimeRemaining");
    els.viewer = document.getElementById("inspectViewer");
    els.stage = document.getElementById("inspectStage");
    els.btnPhotoOpen = document.getElementById("btnInspectPhotoOpen");
    els.photo = document.getElementById("inspectPhoto");
    els.empty = document.getElementById("inspectEmpty");
    els.btnPrev = document.getElementById("btnInspectPrev");
    els.btnNext = document.getElementById("btnInspectNext");
    els.counter = document.getElementById("inspectCounter");
    els.thumbs = document.getElementById("inspectThumbs");
    els.btnToggleDone = document.getElementById("btnInspectToggleDone");
    els.lightbox = document.getElementById("inspectLightbox");
    els.btnLightboxClose = document.getElementById("btnInspectLightboxClose");
    els.btnLightboxPrev = document.getElementById("btnInspectLightboxPrev");
    els.btnLightboxNext = document.getElementById("btnInspectLightboxNext");
    els.lightboxStage = document.getElementById("inspectLightboxStage");
    els.lightboxPhoto = document.getElementById("inspectLightboxPhoto");
    els.lightboxCounter = document.getElementById("inspectLightboxCounter");
  }

  function seedFromOrnament(ornament, order) {
    var parts = [
      ornament && ornament.id,
      ornament && ornament.petName,
      ornament && ornament.name,
      order && order.code,
      order && order.id,
    ].filter(Boolean);
    return parts.join("-") || "awg-pet";
  }

  function placeholderPhotos(ornament, order, count) {
    var seed = seedFromOrnament(ornament, order);
    var n = Math.max(1, count || 3);
    var urls = [];
    var i;
    for (i = 0; i < n; i++) {
      urls.push(
        "https://picsum.photos/seed/" +
          encodeURIComponent(seed + "-" + i) +
          "/1200/1200"
      );
    }
    return urls;
  }

  function normalizePhotos(ornament, order) {
    if (!ornament) return placeholderPhotos(null, order, 2);

    var raw =
      ornament.photos ||
      ornament.petPhotos ||
      ornament.photoUrls ||
      ornament.images ||
      [];

    if (typeof raw === "string") raw = [raw];

    var urls = raw
      .map(function (item) {
        if (!item) return "";
        if (typeof item === "string") return item;
        return item.url || item.src || item.href || "";
      })
      .filter(Boolean);

    if (urls.length) return urls;

    var count =
      ornament.photosCount ||
      ornament.photoCount ||
      (order && order.photosCount) ||
      2;

    return placeholderPhotos(ornament, order, count);
  }

  function petLabel(ornament, order) {
    return (
      (ornament && (ornament.petName || ornament.pet)) ||
      (order && order.petName) ||
      (order && order.name) ||
      (ornament && ornament.name) ||
      "Unnamed pet"
    );
  }

  function backLabel(ornament) {
    if (!ornament) return "";
    var name = String(ornament.backName || ornament.nameOnBack || "").trim();
    if (name) return name;
    if (ornament.withName && ornament.name) return String(ornament.name).trim();
    return "";
  }

  function orderCode(order, ornament) {
    return (
      (order && (order.code || order.orderCode)) ||
      (ornament && ornament.orderCode) ||
      "—"
    );
  }

  function ornamentStatus() {
    var ornament = state.ornament || {};
    return ornament.status === "done" ? "done" : "in_progress";
  }

  function getPaintTiming() {
    if (DATA && typeof DATA.getPaintTiming === "function") {
      return DATA.getPaintTiming(state.ornament, resolveOrderId());
    }
    if (ornamentStatus() === "done") {
      return { status: "done", label: "Done" };
    }
    return { status: "in_progress", label: "—" };
  }

  function photoCount() {
    var photos = state.photos || [];
    return photos.length;
  }

  function clampIndex(index) {
    var total = photoCount();
    if (!total) return 0;
    if (index < 0) return 0;
    if (index >= total) return total - 1;
    return index;
  }

  function setPhotoIndex(index) {
    state.photoIndex = clampIndex(index);
    renderPhoto();
  }

  function stepPhoto(delta) {
    var total = photoCount();
    if (total <= 1) return;
    var next = state.photoIndex + delta;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;
    setPhotoIndex(next);
  }

  function renderMeta() {
    var ornament = state.ornament || {};
    var order = state.order || {};
    var pet = petLabel(ornament, order);
    var back = backLabel(ornament);
    var code = orderCode(order, ornament);

    if (els.petName) {
      els.petName.innerHTML =
        '<span class="inspect-label">Pet</span>' +
        '<span class="inspect-value">' +
        escapeHtml(pet) +
        "</span>";
    }

    if (els.backName) {
      if (back) {
        els.backName.hidden = false;
        els.backName.innerHTML =
          '<span class="inspect-label">Back name</span>' +
          '<span class="inspect-value">' +
          escapeHtml(back) +
          "</span>";
      } else {
        els.backName.hidden = true;
        els.backName.textContent = "";
      }
    }

    if (els.orderCode) {
      els.orderCode.textContent = code;
    }
  }

  function renderTiming() {
    var timing = getPaintTiming();
    var done = timing.status === "done";

    if (els.timeRemaining) {
      els.timeRemaining.textContent = timing.label || "—";
    }
    if (els.timeWrap) {
      els.timeWrap.classList.toggle("is-done", done);
    }
    if (els.btnToggleDone) {
      els.btnToggleDone.textContent = done
        ? "Mark as not finished"
        : "Mark as finished";
      els.btnToggleDone.classList.toggle("ghost", done);
      els.btnToggleDone.classList.toggle("done-action", done);
    }
  }

  function renderThumbs() {
    if (!els.thumbs) return;
    var photos = state.photos || [];
    if (photos.length <= 1) {
      els.thumbs.hidden = true;
      els.thumbs.innerHTML = "";
      return;
    }

    els.thumbs.hidden = false;
    els.thumbs.innerHTML = photos
      .map(function (url, i) {
        var active = i === state.photoIndex ? " active" : "";
        return (
          '<button type="button" class="inspect-thumb' +
          active +
          '" data-index="' +
          i +
          '" aria-label="Photo ' +
          (i + 1) +
          '">' +
          '<img src="' +
          escapeHtml(url) +
          '" alt="" loading="lazy" />' +
          "</button>"
        );
      })
      .join("");

    els.thumbs.querySelectorAll(".inspect-thumb").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setPhotoIndex(Number(btn.dataset.index) || 0);
      });
    });
  }

  function renderPhoto() {
    var photos = state.photos || [];
    var total = photos.length;
    var hasPhotos = total > 0;
    var url = hasPhotos ? photos[state.photoIndex] : "";
    var alt = petLabel(state.ornament, state.order) + " photo";
    var counterText = hasPhotos
      ? state.photoIndex + 1 + " / " + total
      : "";

    if (els.photo) {
      els.photo.hidden = !hasPhotos;
      if (hasPhotos) {
        els.photo.src = url;
        els.photo.alt = alt;
      } else {
        els.photo.removeAttribute("src");
      }
    }

    if (els.btnPhotoOpen) {
      els.btnPhotoOpen.hidden = !hasPhotos;
      els.btnPhotoOpen.disabled = !hasPhotos;
    }

    if (els.empty) els.empty.hidden = hasPhotos;

    if (els.counter) els.counter.textContent = counterText;

    if (els.btnPrev) els.btnPrev.disabled = !hasPhotos || total <= 1;
    if (els.btnNext) els.btnNext.disabled = !hasPhotos || total <= 1;

    if (els.thumbs) {
      els.thumbs.querySelectorAll(".inspect-thumb").forEach(function (btn) {
        btn.classList.toggle(
          "active",
          Number(btn.dataset.index) === state.photoIndex
        );
      });
    }

    if (state.lightboxOpen && els.lightboxPhoto) {
      if (hasPhotos) {
        els.lightboxPhoto.src = url;
        els.lightboxPhoto.alt = alt;
      } else {
        els.lightboxPhoto.removeAttribute("src");
      }
    }
    if (els.lightboxCounter) els.lightboxCounter.textContent = counterText;
    if (els.btnLightboxPrev) {
      els.btnLightboxPrev.disabled = !hasPhotos || total <= 1;
    }
    if (els.btnLightboxNext) {
      els.btnLightboxNext.disabled = !hasPhotos || total <= 1;
    }
  }

  function openLightbox() {
    if (!photoCount()) return;
    state.lightboxOpen = true;
    if (els.lightbox) {
      els.lightbox.hidden = false;
      els.lightbox.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("inspect-lightbox-open");
    renderPhoto();
  }

  function closeLightbox() {
    state.lightboxOpen = false;
    if (els.lightbox) {
      els.lightbox.hidden = true;
      els.lightbox.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("inspect-lightbox-open");
  }

  function toggleDone() {
    var orderId = resolveOrderId();
    var ornament = state.ornament;
    if (!ornament || !orderId) {
      toast("Cannot update status — order not linked");
      return;
    }

    var next = ornamentStatus() === "done" ? "in_progress" : "done";
    if (DATA && typeof DATA.setOrnamentStatus === "function") {
      DATA.setOrnamentStatus(orderId, ornament.id, next);
    } else {
      ornament.status = next;
    }

    var slotIds =
      DATA && typeof DATA.getOrnamentSlotIds === "function"
        ? DATA.getOrnamentSlotIds(ornament, orderId)
        : ornament.slotIds || [];

    document.dispatchEvent(
      new CustomEvent("awg:ornament-status-changed", {
        detail: {
          ornament: ornament,
          order: state.order,
          orderId: orderId,
          status: next,
          slotIds: slotIds,
        },
        bubbles: true,
      })
    );

    renderTiming();
    toast(next === "done" ? "Marked as finished" : "Marked as not finished");
  }

  function startTimingTicker() {
    stopTimingTicker();
    timingTimer = window.setInterval(function () {
      if (!els.screen || !els.screen.classList.contains("on")) return;
      renderTiming();
    }, 30000);
  }

  function stopTimingTicker() {
    if (timingTimer) {
      window.clearInterval(timingTimer);
      timingTimer = null;
    }
  }

  function render() {
    resolveEls();
    state.photos = normalizePhotos(state.ornament, state.order);
    state.photoIndex = clampIndex(state.photoIndex);
    renderMeta();
    renderTiming();
    renderThumbs();
    renderPhoto();
  }

  function bindSwipe(container, store, onSwipe) {
    if (!container || container._awgInspectSwipeBound) return;
    container._awgInspectSwipeBound = true;

    container.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest(".inspect-nav, .inspect-thumb, .inspect-lightbox-close")) {
        return;
      }
      store.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    });

    container.addEventListener("pointermove", function (e) {
      if (!store.current || store.current.pointerId !== e.pointerId) return;
      var dx = e.clientX - store.current.startX;
      var dy = Math.abs(e.clientY - store.current.startY);
      if (Math.abs(dx) > 10 && Math.abs(dx) > dy) {
        store.current.moved = true;
        e.preventDefault();
      }
    });

    function finishSwipe(e) {
      if (!store.current || store.current.pointerId !== e.pointerId) return;
      var dx = e.clientX - store.current.startX;
      if (store.current.moved) {
        if (dx <= -SWIPE_THRESHOLD) onSwipe(1);
        else if (dx >= SWIPE_THRESHOLD) onSwipe(-1);
      }
      store.current = null;
    }

    container.addEventListener("pointerup", finishSwipe);
    container.addEventListener("pointercancel", finishSwipe);
  }

  function bindViewerEvents() {
    bindSwipe(els.viewer, swipeStore, stepPhoto);
    bindSwipe(els.lightboxStage, lightboxSwipeStore, stepPhoto);
  }

  function bindEvents() {
    resolveEls();
    bindViewerEvents();

    if (els.btnBack && !els.btnBack._awgInspectBound) {
      els.btnBack._awgInspectBound = true;
      els.btnBack.addEventListener("click", close);
    }

    if (els.btnPrev && !els.btnPrev._awgInspectBound) {
      els.btnPrev._awgInspectBound = true;
      els.btnPrev.addEventListener("click", function () {
        stepPhoto(-1);
      });
    }

    if (els.btnNext && !els.btnNext._awgInspectBound) {
      els.btnNext._awgInspectBound = true;
      els.btnNext.addEventListener("click", function () {
        stepPhoto(1);
      });
    }

    if (els.btnPhotoOpen && !els.btnPhotoOpen._awgInspectBound) {
      els.btnPhotoOpen._awgInspectBound = true;
      els.btnPhotoOpen.addEventListener("click", openLightbox);
    }

    if (els.btnLightboxClose && !els.btnLightboxClose._awgInspectBound) {
      els.btnLightboxClose._awgInspectBound = true;
      els.btnLightboxClose.addEventListener("click", closeLightbox);
    }

    if (els.btnLightboxPrev && !els.btnLightboxPrev._awgInspectBound) {
      els.btnLightboxPrev._awgInspectBound = true;
      els.btnLightboxPrev.addEventListener("click", function () {
        stepPhoto(-1);
      });
    }

    if (els.btnLightboxNext && !els.btnLightboxNext._awgInspectBound) {
      els.btnLightboxNext._awgInspectBound = true;
      els.btnLightboxNext.addEventListener("click", function () {
        stepPhoto(1);
      });
    }

    if (els.lightbox && !els.lightbox._awgInspectBound) {
      els.lightbox._awgInspectBound = true;
      els.lightbox.addEventListener("click", function (e) {
        if (e.target === els.lightbox) closeLightbox();
      });
    }

    if (els.btnToggleDone && !els.btnToggleDone._awgInspectBound) {
      els.btnToggleDone._awgInspectBound = true;
      els.btnToggleDone.addEventListener("click", toggleDone);
    }

    if (!document._awgInspectKeyBound) {
      document._awgInspectKeyBound = true;
      document.addEventListener("keydown", function (e) {
        if (!els.screen || !els.screen.classList.contains("on")) return;
        if (state.lightboxOpen) {
          if (e.key === "Escape") {
            e.preventDefault();
            closeLightbox();
            return;
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            stepPhoto(-1);
            return;
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            stepPhoto(1);
            return;
          }
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          stepPhoto(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          stepPhoto(1);
        } else if (e.key === "Escape") {
          close();
        }
      });
    }
  }

  function bindGlobalEvents() {
    if (document._awgInspectEventBound) return;
    document._awgInspectEventBound = true;

    document.addEventListener("awg:inspect-ornament", function (e) {
      open(e.detail || {});
    });
  }

  function mockPayload() {
    return {
      returnScreen: "agenda",
      orderId: "ord-demo",
      order: { id: "ord-demo", code: "ABS999", name: "MILO" },
      ornament: {
        id: "orn-demo",
        petName: "MILO",
        backName: "MILO",
        withName: true,
        status: "in_progress",
        photosCount: 3,
      },
    };
  }

  function open(detail) {
    detail = detail || {};
    if (!detail.ornament && !detail.order) {
      detail = mockPayload();
      toast("Inspect mock · order detail not wired yet");
    }

    closeLightbox();
    state.ornament = detail.ornament || null;
    state.order = detail.order || null;
    state.orderId = detail.orderId || (detail.order && detail.order.id) || null;
    state.returnScreen = detail.returnScreen || "agenda";
    state.photoIndex = 0;

    bindEvents();
    render();
    startTimingTicker();
    showScreen("ornament-inspect");
  }

  function close() {
    closeLightbox();
    stopTimingTicker();
    document.dispatchEvent(
      new CustomEvent("awg:close-ornament-inspect", {
        detail: { ornament: state.ornament, order: state.order },
      })
    );
    showScreen(state.returnScreen || "agenda");
  }

  function mount(roots, options) {
    rootEls = roots || {};
    opts = options || {};
    ensureMarkup();
    bindEvents();
    bindGlobalEvents();
  }

  window.AWG_INSPECT = {
    mount: mount,
    open: open,
    close: close,
    _mockPayload: mockPayload,
  };
})();
