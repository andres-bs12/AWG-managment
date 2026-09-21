/**
 * AWG_FORM — Customer phone form mock (Agenda → Sale flow).
 *
 * Exposes `window.AWG_FORM`:
 *   mount(rootEls, opts)  — opts: { onToast, onShowScreen }
 *   open(detail?)         — show #screen-customer-form
 *   close()               — back to sale screen
 *
 * Listens for:
 *   awg:open-customer-form  — from QR modal «Open customer form»
 *   awg:fill-here           — «Fill in here» on sale screen
 *   awg:generate-qr         — stores sale context (optional)
 *
 * Submit stores payload on `window.AWG_LAST_FORM` and navigates to sale.
 */
(function () {
  "use strict";

  let rootEls = {};
  let opts = {};
  let els = {};
  let saleContext = null;
  let fallbackToastTimer = null;

  const NAME_EXTRA = 12.99;

  function noop() {}

  function toast(msg) {
    if (typeof opts.onToast === "function") {
      opts.onToast(msg);
      return;
    }
    let node = document.getElementById("toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "toast";
      node.className = "toast";
      document.body.appendChild(node);
    }
    node.textContent = msg;
    node.classList.add("on");
    clearTimeout(fallbackToastTimer);
    fallbackToastTimer = setTimeout(function () {
      node.classList.remove("on");
    }, 2200);
  }

  function showScreen(name) {
    (opts.onShowScreen || noop)(name);
  }

  function ensureMarkup() {
    let screen =
      rootEls.screenCustomerForm ||
      document.getElementById("screen-customer-form");
    if (screen) return screen;

    const host =
      rootEls.root ||
      document.querySelector("main.wrap") ||
      document.body;
    screen = document.createElement("section");
    screen.id = "screen-customer-form";
    screen.className = "screen";
    screen.innerHTML = `
      <h1>Customer details</h1>
      <p class="sub">Fill in customer and pet information for this order.</p>
      <form id="customerForm" class="customer-form" novalidate>
        <div class="cols customer-form-cols">
          <div>
            <div class="panel form-section">
              <h2>Customer</h2>
              <div class="field">
                <label for="cfFullName">Full name *</label>
                <input type="text" id="cfFullName" name="fullName" required autocomplete="name" />
              </div>
              <div class="field">
                <label for="cfPhone">Phone *</label>
                <input type="tel" id="cfPhone" name="phone" required autocomplete="tel" />
              </div>
              <div class="field">
                <label for="cfEmail">Email</label>
                <input type="email" id="cfEmail" name="email" autocomplete="email" />
              </div>
            </div>
            <div class="panel form-section">
              <h2>Pet</h2>
              <div class="field">
                <label for="cfPetName">Pet name *</label>
                <input type="text" id="cfPetName" name="petName" required />
              </div>
              <div class="field">
                <label for="cfPhotos">Photos</label>
                <input type="file" id="cfPhotos" name="photos" multiple accept="image/*" />
                <p class="tiny muted" id="cfPhotosHint">Mock upload — files are not sent anywhere.</p>
              </div>
              <div class="field ornament-name-opt">
                <label class="checkbox-row">
                  <input type="checkbox" id="cfOrnamentName" name="ornamentNameOnBack" />
                  Add name on the back — +€12.99
                </label>
                <div class="name-on-back-input" id="cfBackNameWrap" hidden>
                  <label for="cfBackName">Name on back</label>
                  <input type="text" id="cfBackName" name="backName" maxlength="6" placeholder="max 6 characters" />
                </div>
              </div>
            </div>
          </div>
          <aside class="panel form-aside">
            <h2>Summary</h2>
            <div class="form-aside-stack">
              <section class="form-aside-section">
                <h3 class="form-aside-label">Order</h3>
                <div id="formAsideOrder" class="form-aside-body muted">Linked to the current sale draft.</div>
              </section>
              <section class="form-aside-section">
                <h3 class="form-aside-label">Customer</h3>
                <div id="formAsideCustomer" class="form-aside-body">
                  <div class="form-aside-row"><span>Name</span><span class="val form-aside-placeholder" data-aside="name">—</span></div>
                  <div class="form-aside-row"><span>Phone</span><span class="val form-aside-placeholder" data-aside="phone">—</span></div>
                  <div class="form-aside-row"><span>Email</span><span class="val form-aside-placeholder" data-aside="email">—</span></div>
                </div>
              </section>
              <section class="form-aside-section">
                <h3 class="form-aside-label">Delivery</h3>
                <div id="formAsideDelivery" class="form-aside-body muted">—</div>
              </section>
              <div id="formAsideNameExtra" class="form-aside-extra" hidden></div>
            </div>
          </aside>
        </div>
        <div class="actions form-actions">
          <button class="btn ghost" type="button" id="btnFormCancel">← Back to order</button>
          <button class="btn" type="submit">Submit →</button>
        </div>
      </form>`;
    host.appendChild(screen);
    return screen;
  }

  function resolveEls() {
    const screen = ensureMarkup();
    els = {
      screen,
      form: screen.querySelector("#customerForm"),
      fullName: screen.querySelector("#cfFullName"),
      phone: screen.querySelector("#cfPhone"),
      email: screen.querySelector("#cfEmail"),
      petName: screen.querySelector("#cfPetName"),
      photos: screen.querySelector("#cfPhotos"),
      photosHint: screen.querySelector("#cfPhotosHint"),
      ornamentName: screen.querySelector("#cfOrnamentName"),
      backNameWrap: screen.querySelector("#cfBackNameWrap"),
      backName: screen.querySelector("#cfBackName"),
      asideOrder: screen.querySelector("#formAsideOrder"),
      asideCustomer: screen.querySelector("#formAsideCustomer"),
      asideDelivery: screen.querySelector("#formAsideDelivery"),
      asideNameExtra: screen.querySelector("#formAsideNameExtra"),
      btnCancel: screen.querySelector("#btnFormCancel"),
    };
  }

  function timeFmt(h) {
    if (window.AWG_DATA && typeof window.AWG_DATA.fmt === "function") {
      return window.AWG_DATA.fmt(h);
    }
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  function resolveSaleContext(detail) {
    if (detail && (detail.blocks || detail.ornaments)) return detail;
    const fromSale =
      window.AWG_SALE && typeof window.AWG_SALE._getSale === "function"
        ? window.AWG_SALE._getSale()
        : null;
    if (fromSale) return fromSale;
    return saleContext || null;
  }

  function getPaintDayId(o, blocks) {
    const ids =
      o.blockIds && o.blockIds.length
        ? o.blockIds
        : o.blockId
          ? [o.blockId]
          : [];
    let latest = null;
    ids.forEach(function (bid) {
      const bl = blocks.find(function (b) {
        return b.id === bid;
      });
      if (bl && (!latest || bl.dayId > latest)) latest = bl.dayId;
    });
    return latest || (blocks[0] && blocks[0].dayId) || null;
  }

  function pickupSummaryDayLabel(dayId, paintDayId) {
    const DATA = window.AWG_DATA;
    if (DATA && typeof DATA.pickupSummaryDayLabel === "function") {
      return DATA.pickupSummaryDayLabel(dayId || paintDayId);
    }
    return "today";
  }

  function ensureOrnamentDelivery(o, blocks) {
    if (!o.deliveryMethod) o.deliveryMethod = "pickup";
    if (!o.deliveryDay) o.deliveryDay = "Wednesday";
    if (o.pickup == null && o.paintEnd != null) o.pickup = o.paintEnd;
    if (o.deliveryMethod === "pickup" && !o.pickupDayId) {
      o.pickupDayId = getPaintDayId(o, blocks);
    }
  }

  function formatOrnamentDelivery(o, blocks) {
    ensureOrnamentDelivery(o, blocks);
    if (o.deliveryMethod === "home") {
      return "Home · " + (o.deliveryDay || "Wednesday");
    }
    const dayPart = pickupSummaryDayLabel(
      o.pickupDayId || getPaintDayId(o, blocks),
      getPaintDayId(o, blocks)
    );
    return "Pickup " + dayPart + " · " + timeFmt(o.pickup);
  }

  function deliveryGroupKey(o, blocks) {
    ensureOrnamentDelivery(o, blocks);
    if (o.deliveryMethod === "home") {
      return "home:" + (o.deliveryDay || "Wednesday");
    }
    return (
      "pickup:" +
      (o.pickupDayId || getPaintDayId(o, blocks)) +
      ":" +
      timeFmt(o.pickup)
    );
  }

  function renderOrderAside(blocks, ornaments) {
    if (!blocks || !blocks.length) {
      return "No reserved slot linked — fill in anyway for demo.";
    }
    const blockLines = blocks
      .map(function (bl, i) {
        const label = blocks.length > 1 ? "Block " + (i + 1) + " " : "Reserved block ";
        return (
          label +
          "<b>" +
          timeFmt(bl.start) +
          "–" +
          timeFmt(bl.end) +
          "</b>"
        );
      })
      .join("<br>");
    const count = ornaments && ornaments.length ? ornaments.length : 0;
    const countLine =
      count === 1 ? "1 ornament" : count + " ornaments";
    return blockLines + (count ? "<br><span class='muted'>" + countLine + "</span>" : "");
  }

  function renderDeliveryAside(ornaments, blocks) {
    if (!ornaments || !ornaments.length) {
      return "Delivery not set yet.";
    }
    const groups = [];
    const seen = {};
    ornaments.forEach(function (o) {
      const key = deliveryGroupKey(o, blocks);
      if (seen[key]) {
        seen[key].count += 1;
        return;
      }
      seen[key] = {
        label: formatOrnamentDelivery(o, blocks),
        count: 1,
      };
      groups.push(seen[key]);
    });
    if (groups.length === 1) {
      return "<b>1 delivery:</b> " + escapeHtml(groups[0].label);
    }
    const head = "<b>" + groups.length + " deliveries</b>";
    const list =
      "<ul class='form-aside-delivery-list'>" +
      groups
        .map(function (g) {
          const suffix = g.count > 1 ? " · ×" + g.count : "";
          return "<li>" + escapeHtml(g.label) + suffix + "</li>";
        })
        .join("") +
      "</ul>";
    return head + list;
  }

  function setAsideField(key, value) {
    if (!els.asideCustomer) return;
    const node = els.asideCustomer.querySelector('[data-aside="' + key + '"]');
    if (!node) return;
    const text = (value || "").trim();
    if (text) {
      node.textContent = text;
      node.classList.remove("form-aside-placeholder");
    } else {
      node.textContent = "—";
      node.classList.add("form-aside-placeholder");
    }
  }

  function renderNameExtraAside(ornaments) {
    if (!els.asideNameExtra) return;
    const fromForm = !!els.ornamentName?.checked;
    const fromSale =
      ornaments &&
      ornaments.some(function (o) {
        return !!o.withName;
      });
    if (!fromForm && !fromSale) {
      els.asideNameExtra.hidden = true;
      els.asideNameExtra.textContent = "";
      return;
    }
    const backName = (els.backName?.value || "").trim();
    const saleName =
      ornaments &&
      ornaments.find(function (o) {
        return o.withName && (o.name || o.backName);
      });
    const nameText =
      backName ||
      (saleName && String(saleName.name || saleName.backName || "").trim()) ||
      "";
    els.asideNameExtra.hidden = false;
    els.asideNameExtra.innerHTML =
      "<b>Name on back</b> · +€" +
      NAME_EXTRA.toFixed(2) +
      (nameText ? "<br><span class='muted'>" + escapeHtml(nameText.toUpperCase()) + "</span>" : "");
  }

  function updateAsideSummary() {
    const ctx = saleContext || null;
    const blocks = ctx && ctx.blocks ? ctx.blocks : [];
    const ornaments = ctx && ctx.ornaments ? ctx.ornaments : [];

    if (els.asideOrder) {
      els.asideOrder.innerHTML = renderOrderAside(blocks, ornaments);
    }
    setAsideField("name", els.fullName?.value || "");
    setAsideField("phone", els.phone?.value || "");
    setAsideField("email", els.email?.value || "");
    if (els.asideDelivery) {
      els.asideDelivery.innerHTML = renderDeliveryAside(ornaments, blocks);
    }
    renderNameExtraAside(ornaments);
  }

  function resetForm() {
    if (!els.form) return;
    els.form.reset();
    if (els.ornamentName) els.ornamentName.checked = false;
    if (els.backNameWrap) els.backNameWrap.hidden = true;
    if (els.backName) els.backName.value = "";
    if (els.photosHint) els.photosHint.textContent = "Mock upload — files are not sent anywhere.";
  }

  function applySalePrefill() {
    if (!saleContext || !saleContext.ornaments || !saleContext.ornaments.length) return;
    const ornament = saleContext.ornaments[0];
    const withName = !!ornament.withName;

    if (els.ornamentName) els.ornamentName.checked = withName;
    if (els.backNameWrap) els.backNameWrap.hidden = !withName;

    if (withName && els.backName) {
      const existing = String(ornament.backName || ornament.name || "").trim();
      if (existing) els.backName.value = existing.toUpperCase().slice(0, 6);
    }
  }

  function bindFormEvents() {
    resolveEls();
    if (!els.form || els.form._awgFormBound) return;
    els.form._awgFormBound = true;

    els.ornamentName?.addEventListener("change", function (e) {
      const on = e.target.checked;
      if (els.backNameWrap) els.backNameWrap.hidden = !on;
      if (!on && els.backName) els.backName.value = "";
      if (on && els.backName) els.backName.focus();
      updateAsideSummary();
    });

    els.backName?.addEventListener("input", function (e) {
      e.target.value = e.target.value.toUpperCase().slice(0, 6);
      updateAsideSummary();
    });

    ["input", "change"].forEach(function (evt) {
      els.fullName?.addEventListener(evt, updateAsideSummary);
      els.phone?.addEventListener(evt, updateAsideSummary);
      els.email?.addEventListener(evt, updateAsideSummary);
    });

    els.photos?.addEventListener("change", function (e) {
      const count = e.target.files ? e.target.files.length : 0;
      if (!els.photosHint) return;
      if (!count) {
        els.photosHint.textContent = "Mock upload — files are not sent anywhere.";
        return;
      }
      els.photosHint.textContent =
        count + " photo(s) selected (mock only).";
    });

    els.btnCancel?.addEventListener("click", function () {
      close();
    });

    els.form.addEventListener("submit", handleSubmit);
  }

  function validateForm() {
    const fullName = (els.fullName?.value || "").trim();
    const phone = (els.phone?.value || "").trim();
    const petName = (els.petName?.value || "").trim();
    const withBack = !!els.ornamentName?.checked;
    const backName = (els.backName?.value || "").trim();

    if (!fullName) {
      toast("Full name is required");
      els.fullName?.focus();
      return null;
    }
    if (!phone) {
      toast("Phone is required");
      els.phone?.focus();
      return null;
    }
    if (!petName) {
      toast("Pet name is required");
      els.petName?.focus();
      return null;
    }
    if (withBack && !backName) {
      toast("Name on back is required when checked");
      els.backName?.focus();
      return null;
    }

    const files = els.photos?.files;
    const photoNames = files
      ? Array.from(files).map(function (f) {
          return f.name;
        })
      : [];

    return {
      submittedAt: new Date().toISOString(),
      saleId: saleContext && saleContext.id ? saleContext.id : null,
      customer: {
        fullName: fullName,
        phone: phone,
        email: (els.email?.value || "").trim(),
      },
      pet: {
        name: petName,
        photosCount: photoNames.length,
        photoNames: photoNames,
        ornamentNameOnBack: withBack,
        backName: withBack ? backName.toUpperCase().slice(0, 6) : "",
      },
    };
  }

  function tryApplyToSale(data) {
    const SALE = window.AWG_SALE;
    if (!SALE) return false;

    const hooks = [
      "applyCustomerForm",
      "applyForm",
      "setCustomer",
      "applyFormData",
    ];
    for (let i = 0; i < hooks.length; i++) {
      const fn = SALE[hooks[i]];
      if (typeof fn === "function") {
        fn(data);
        if (typeof SALE.render === "function") SALE.render();
        return true;
      }
    }
    return false;
  }

  function updateSummaryDOM(data) {
    const summaryList = document.getElementById("summaryList");
    if (!summaryList) return;

    summaryList.querySelectorAll(".customer-summary").forEach(function (n) {
      n.remove();
    });

    const card = document.createElement("div");
    card.className = "card customer-summary";
    const emailLine = data.customer.email
      ? " · " + data.customer.email
      : "";
    card.innerHTML =
      '<div class="row"><b>Customer</b><span>' +
      escapeHtml(data.customer.fullName) +
      "</span></div>" +
      '<div class="muted" style="margin-top:4px">' +
      escapeHtml(data.customer.phone) +
      emailLine +
      "</div>" +
      '<div class="muted" style="margin-top:4px">Pet: <b>' +
      escapeHtml(data.pet.name) +
      "</b>" +
      (data.pet.photosCount
        ? " · " + data.pet.photosCount + " photo(s)"
        : "") +
      "</div>";
    summaryList.insertBefore(card, summaryList.firstChild);

    if (data.pet.ornamentNameOnBack && data.pet.backName) {
      const firstOrnament = document.querySelector("#ornaments .ornament");
      const checkbox = firstOrnament?.querySelector('[data-field="withName"]');
      if (checkbox) checkbox.checked = true;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function handleSubmit(e) {
    e.preventDefault();
    const data = validateForm();
    if (!data) return;

    window.AWG_LAST_FORM = data;

    tryApplyToSale(data);

    toast(
      "Saved · " +
        data.customer.fullName +
        " & " +
        data.pet.name
    );
    showScreen("sale");
    if (window.AWG_SALE && typeof window.AWG_SALE.render === "function") {
      window.AWG_SALE.render();
    }
    updateSummaryDOM(data);
  }

  function bindGlobalEvents() {
    if (document._awgFormEventsBound) return;
    document._awgFormEventsBound = true;

    document.addEventListener("awg:open-customer-form", function (e) {
      open(e.detail);
    });
    document.addEventListener("awg:fill-here", function (e) {
      open(e.detail);
    });
    document.addEventListener("awg:generate-qr", function (e) {
      saleContext = e.detail || null;
    });
  }

  function open(detail) {
    saleContext = resolveSaleContext(detail);
    resolveEls();
    resetForm();
    applySalePrefill();
    updateAsideSummary();
    showScreen("customer-form");
  }

  function close() {
    showScreen("sale");
  }

  function mount(roots, options) {
    rootEls = roots || {};
    opts = options || {};
    resolveEls();
    bindFormEvents();
    bindGlobalEvents();
  }

  window.AWG_FORM = {
    mount: mount,
    open: open,
    close: close,
  };
})();
