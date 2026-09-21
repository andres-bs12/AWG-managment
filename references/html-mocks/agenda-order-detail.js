/**
 * AWG_ORDER — Order detail screen for Gaby (mock).
 *
 *   mount(rootEl, opts)
 *     rootEl: #screen-order-detail (or inner mount point)
 *     opts: { onShowScreen, onToast }
 *
 *   open(orderId | slot, dayId?)
 *     Opens order detail for an orderId string or slot object.
 *
 * Listens for awg:open-order if not handled by calendar opts.onOpenOrder.
 * Dispatches awg:inspect-ornament when user taps Inspect on an item row.
 */
(function () {
  "use strict";

  var DATA = window.AWG_DATA;
  var state = {
    root: null,
    opts: {},
    current: null,
  };

  function noop() {}

  function $(sel, root) {
    return (root || state.root || document).querySelector(sel);
  }

  function showScreen(name) {
    (state.opts.onShowScreen || noop)(name);
  }

  function fmtHour(h) {
    if (DATA && typeof DATA.fmt === "function") return DATA.fmt(h);
    var hh = Math.floor(h);
    var mm = Math.round((h - hh) * 60);
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  function resolveOrder(input) {
    if (!input) return null;
    if (typeof input === "string") {
      if (DATA && typeof DATA.getOrder === "function") {
        var byId = DATA.getOrder(input);
        if (byId) return byId;
      }
      return null;
    }
    if (input.orderId || input.code || input.name) {
      if (DATA && typeof DATA.resolveOrderFromSlot === "function") {
        return DATA.resolveOrderFromSlot(input);
      }
    }
    return null;
  }

  function resolveOrderId(input) {
    if (typeof input === "string") return input;
    if (input && input.orderId) return input.orderId;
    if (input && input.id && !input.customer) return input.id;
    return null;
  }

  function paintingLines(orderId) {
    if (!DATA || typeof DATA.getOrderSlots !== "function") return [];
    return DATA.getOrderSlots(orderId).map(function (entry) {
      var s = entry.slot;
      if (typeof DATA.formatPaintWindow === "function") {
        return DATA.formatPaintWindow(entry.dayId, s.start, s.end);
      }
      return (
        entry.weekdayShort +
        " · " +
        fmtHour(s.start) +
        "–" +
        fmtHour(s.end)
      );
    });
  }

  function deliveryLines(orderId) {
    if (!DATA || typeof DATA.getOrderSlots !== "function") return [];
    var seen = {};
    var out = [];
    DATA.getOrderSlots(orderId).forEach(function (entry) {
      var label =
        DATA.deliveryLabel && typeof DATA.deliveryLabel === "function"
          ? DATA.deliveryLabel(entry.slot, entry.dayId)
          : "";
      if (!label || seen[label]) return;
      seen[label] = true;
      out.push(label);
    });
    return out;
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

  function thumbHtml(url) {
    if (!url) {
      return '<span class="order-item-thumb placeholder" aria-hidden="true"></span>';
    }
    return (
      '<img class="order-item-thumb" src="' +
      url +
      '" alt="" loading="lazy" />'
    );
  }

  function ornamentRowHtml(ornament, order) {
    var photos = ornament.photoUrls || [];
    var thumb = thumbHtml(photos[0]);
    var nameLine = ornament.withName
      ? "Name on back" + (ornament.backName ? ': "' + ornament.backName + '"' : "")
      : "No name on back";
    var photoCount =
      photos.length > 1
        ? '<span class="order-item-photo-count">' + photos.length + " photos</span>"
        : "";

    return (
      '<button type="button" class="order-item-row" data-ornament-id="' +
      ornament.id +
      '">' +
      thumb +
      '<div class="order-item-body">' +
      "<b>" +
      ornament.petName +
      "</b>" +
      '<span class="muted">' +
      nameLine +
      "</span>" +
      photoCount +
      "</div>" +
      '<span class="order-item-action">Inspect →</span>' +
      "</button>"
    );
  }

  function render() {
    if (!state.root || !state.current) return;
    var order = state.current.order;
    var orderId = state.current.orderId;

    var titleEl = $("#orderDetailTitle", state.root);
    var subEl = $("#orderDetailSub", state.root);
    var customerEl = $("#orderDetailCustomer", state.root);
    var contactEl = $("#orderDetailContact", state.root);
    var deliveryEl = $("#orderDetailDelivery", state.root);
    var paintEl = $("#orderDetailPaint", state.root);
    var itemsEl = $("#orderDetailItems", state.root);

    if (titleEl) titleEl.textContent = order.code + " · " + petTitle(order);
    if (subEl) {
      subEl.textContent =
        (order.ornaments || []).length +
        " ornament" +
        ((order.ornaments || []).length === 1 ? "" : "s") +
        " · " +
        (order.customer && order.customer.name ? order.customer.name : "Customer");
    }

    var cust = order.customer || {};
    if (customerEl) customerEl.textContent = cust.name || "—";
    if (contactEl) {
      contactEl.innerHTML =
        (cust.phone ? '<div><span class="label">Phone</span> ' + cust.phone + "</div>" : "") +
        (cust.email ? '<div><span class="label">Email</span> ' + cust.email + "</div>" : "");
    }

    var deliveries = deliveryLines(orderId);
    if (deliveryEl) {
      if (!deliveries.length) {
        deliveryEl.innerHTML = '<p class="muted">No delivery info</p>';
      } else if (deliveries.length === 1) {
        deliveryEl.innerHTML = "<p>" + deliveries[0] + "</p>";
      } else {
        deliveryEl.innerHTML =
          "<ul class=\"order-delivery-list\">" +
          deliveries.map(function (d) {
            return "<li>" + d + "</li>";
          }).join("") +
          "</ul>";
      }
    }

    var paint = paintingLines(orderId);
    if (paintEl) {
      paintEl.innerHTML = paint.length
        ? paint.map(function (p) {
            return "<div>" + p + "</div>";
          }).join("")
        : '<span class="muted">—</span>';
    }

    if (itemsEl) {
      var ornaments = order.ornaments || [];
      itemsEl.innerHTML = ornaments.length
        ? ornaments.map(function (o) {
            return ornamentRowHtml(o, order);
          }).join("")
        : '<p class="muted">No ornaments listed.</p>';

      itemsEl.querySelectorAll(".order-item-row").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var ornId = btn.dataset.ornamentId;
          var ornament = null;
          for (var i = 0; i < ornaments.length; i++) {
            if (ornaments[i].id === ornId) {
              ornament = ornaments[i];
              break;
            }
          }
          if (!ornament) return;
          document.dispatchEvent(
            new CustomEvent("awg:inspect-ornament", {
              detail: {
                ornament: ornament,
                order: order,
                orderId: orderId,
                returnScreen: "order-detail",
              },
              bubbles: true,
            })
          );
        });
      });
    }
  }

  function open(input, dayId) {
    var orderId = resolveOrderId(input);
    var order = resolveOrder(input);
    if (!order && orderId && DATA && typeof DATA.getOrder === "function") {
      order = DATA.getOrder(orderId);
    }
    if (!order) {
      console.warn("AWG_ORDER.open: unknown order", input);
      return false;
    }
    if (!orderId) orderId = order.id;

    state.current = { order: order, orderId: orderId, dayId: dayId || null };
    render();
    showScreen("order-detail");
    return true;
  }

  function mount(rootEl, opts) {
    if (!rootEl) return null;
    state.root = rootEl;
    state.opts = opts || {};

    var backBtn = $("#btnOrderDetailBack", rootEl);
    if (backBtn && !backBtn._awgBound) {
      backBtn._awgBound = true;
      backBtn.addEventListener("click", function () {
        showScreen("agenda");
      });
    }

    if (!state._awgOpenListener) {
      state._awgOpenListener = true;
      document.addEventListener("awg:open-order", function (e) {
        var d = e.detail || {};
        if (d.slot) open(d.slot, d.dayId);
        else if (d.orderId) open(d.orderId, d.dayId);
      });
    }

    window.AWG_ORDER = {
      mount: mount,
      open: open,
      render: render,
    };
    return window.AWG_ORDER;
  }

  window.AWG_ORDER = {
    mount: mount,
    open: open,
    render: render,
  };
})();
