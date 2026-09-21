/**
 * AWG_SALES — sales ledger + tracking tab (mock).
 *
 * Tracks custom vs finished products, amounts, and partial payments
 * (deposit / balance on delivery / paid in full).
 *
 *   mount(rootEl, opts)
 *   open()
 *   recordSale(salePayload)
 *   render()
 */
(function () {
  "use strict";

  var CUSTOM_PRICE = 49.99;
  var NAME_EXTRA = 12.99;
  var FINISHED_PRICE = 39.99;

  var state = {
    root: null,
    opts: {},
    sales: [],
  };

  function noop() {}

  function $(sel, root) {
    return (root || state.root || document).querySelector(sel);
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(16).slice(2, 6);
  }

  function fmtMoney(n) {
    return "€" + Number(n || 0).toFixed(2);
  }

  function dayKeyFromIso(iso) {
    if (!iso) return "—";
    return String(iso).slice(0, 10);
  }

  function dayLabel(key) {
    if (!key || key === "—") return "—";
    try {
      var d = new Date(key + "T12:00:00");
      return d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch (e) {
      return key;
    }
  }

  function seedSales() {
    return [
      {
        id: "sale-demo-1",
        code: "ABS111",
        date: "2025-11-28",
        customer: "Anna M.",
        items: [
          { kind: "custom", label: "MILO · custom", price: CUSTOM_PRICE, withName: false },
        ],
        total: CUSTOM_PRICE,
        paid: CUSTOM_PRICE / 2,
        paymentStatus: "deposit",
        productionStatus: "started",
        deliveryStatus: "not_delivered",
      },
      {
        id: "sale-demo-2",
        code: "ABS118",
        date: "2025-11-28",
        customer: "Lena K.",
        items: [
          { kind: "custom", label: "LENA · custom + name", price: CUSTOM_PRICE + NAME_EXTRA, withName: true },
          { kind: "custom", label: "BRUNO · custom", price: CUSTOM_PRICE, withName: false },
        ],
        total: CUSTOM_PRICE + NAME_EXTRA + CUSTOM_PRICE,
        paid: CUSTOM_PRICE + NAME_EXTRA + CUSTOM_PRICE,
        paymentStatus: "paid",
        productionStatus: "started",
        deliveryStatus: "not_delivered",
      },
      {
        id: "sale-demo-3",
        code: "ABS200",
        date: "2025-11-29",
        customer: "Otto R.",
        items: [
          { kind: "finished", label: "Finished ornament", price: FINISHED_PRICE, withName: false },
          { kind: "finished", label: "Finished ornament", price: FINISHED_PRICE, withName: false },
        ],
        total: FINISHED_PRICE * 2,
        paid: FINISHED_PRICE,
        paymentStatus: "deposit",
        productionStatus: "finished",
        deliveryStatus: "not_delivered",
      },
      {
        id: "sale-demo-4",
        code: "ABS201",
        date: "2025-11-30",
        customer: "Sofia P.",
        items: [
          { kind: "custom", label: "Custom ornament", price: CUSTOM_PRICE, withName: false },
          { kind: "finished", label: "Finished ornament", price: FINISHED_PRICE, withName: false },
        ],
        total: CUSTOM_PRICE + FINISHED_PRICE,
        paid: CUSTOM_PRICE + FINISHED_PRICE,
        paymentStatus: "paid",
        productionStatus: "finished",
        deliveryStatus: "delivered",
      },
      {
        id: "sale-demo-5",
        code: "ABS202",
        date: "2025-12-01",
        customer: "Max W.",
        items: [{ kind: "custom", label: "Custom + name", price: CUSTOM_PRICE + NAME_EXTRA, withName: true }],
        total: CUSTOM_PRICE + NAME_EXTRA,
        paid: 0,
        paymentStatus: "unpaid",
        productionStatus: "not_started",
        deliveryStatus: "not_delivered",
      },
      {
        id: "sale-demo-6",
        code: "ABS122",
        date: "2025-11-28",
        customer: "Julia H.",
        items: [
          { kind: "custom", label: "FELIX · custom", price: CUSTOM_PRICE, withName: false },
        ],
        total: CUSTOM_PRICE,
        paid: CUSTOM_PRICE / 2,
        paymentStatus: "deposit",
        productionStatus: "started",
        deliveryStatus: "not_delivered",
      },
    ];
  }

  function linePrice(item) {
    if (item.kind === "finished") return FINISHED_PRICE;
    return CUSTOM_PRICE + (item.withName ? NAME_EXTRA : 0);
  }

  function syncTotals(sale) {
    sale.total = (sale.items || []).reduce(function (s, it) {
      return s + (it.price != null ? it.price : linePrice(it));
    }, 0);
    if (sale.paid > sale.total) sale.paid = sale.total;
    var due = Math.max(0, sale.total - sale.paid);
    if (due < 0.01 && sale.paid > 0) sale.paymentStatus = "paid";
    else if (sale.paid < 0.01) sale.paymentStatus = "unpaid";
    else if (due >= 0.01) sale.paymentStatus = "deposit";
    sale.due = due;
  }

  function statusLabel(sale) {
    syncTotals(sale);
    if (sale.paymentStatus === "paid") return "Paid in full";
    if (sale.paymentStatus === "deposit") return "Deposit · " + fmtMoney(sale.due) + " due";
    return "Unpaid";
  }

  function productMix(sale) {
    var custom = 0;
    var finished = 0;
    (sale.items || []).forEach(function (it) {
      if (it.kind === "finished") finished += 1;
      else custom += 1;
    });
    var parts = [];
    if (custom) parts.push(custom + " custom");
    if (finished) parts.push(finished + " finished");
    return parts.join(" · ") || "—";
  }

  function aggregateByDay() {
    var map = {};
    state.sales.forEach(function (sale) {
      syncTotals(sale);
      var key = dayKeyFromIso(sale.date);
      if (!map[key]) {
        map[key] = {
          key: key,
          sold: 0,
          collected: 0,
          custom: 0,
          finished: 0,
        };
      }
      map[key].sold += sale.total;
      map[key].collected += sale.paid;
      (sale.items || []).forEach(function (it) {
        if (it.kind === "finished") map[key].finished += 1;
        else map[key].custom += 1;
      });
    });
    return Object.keys(map)
      .sort()
      .map(function (k) {
        return map[k];
      });
  }

  function totals() {
    var sold = 0;
    var collected = 0;
    var due = 0;
    var custom = 0;
    var finished = 0;
    state.sales.forEach(function (sale) {
      syncTotals(sale);
      sold += sale.total;
      collected += sale.paid;
      due += sale.due;
      (sale.items || []).forEach(function (it) {
        if (it.kind === "finished") finished += 1;
        else custom += 1;
      });
    });
    return { sold: sold, collected: collected, due: due, custom: custom, finished: finished };
  }

  function chartHtml(days) {
    if (!days.length) {
      return '<p class="muted">No sales yet.</p>';
    }
    var max = 1;
    days.forEach(function (d) {
      if (d.sold > max) max = d.sold;
    });
    var bars = days
      .map(function (d) {
        var h = Math.max(8, Math.round((d.sold / max) * 120));
        return (
          '<div class="sales-bar-col" title="' +
          dayLabel(d.key) +
          ": sold " +
          fmtMoney(d.sold) +
          ", collected " +
          fmtMoney(d.collected) +
          '">' +
          '<div class="sales-bar" style="height:' +
          h +
          'px"></div>' +
          '<span class="sales-bar-label">' +
          dayLabel(d.key) +
          "</span>" +
          '<span class="sales-bar-val">' +
          fmtMoney(d.sold) +
          "</span>" +
          "</div>"
        );
      })
      .join("");
    return '<div class="sales-chart">' + bars + "</div>";
  }

  function resolveProductionStatus(sale) {
    if (sale.productionStatus) return sale.productionStatus;
    var DATA = window.AWG_DATA;
    if (DATA && typeof DATA.getOrderByCode === "function") {
      var order = DATA.getOrderByCode(sale.code);
      if (order && order.ornaments && order.ornaments.length) {
        var done = 0;
        var started = 0;
        order.ornaments.forEach(function (o) {
          if (o.status === "done") done += 1;
          else if (o.status === "in_progress") started += 1;
        });
        if (done === order.ornaments.length) return "finished";
        if (done > 0 || started > 0) return "started";
        return "not_started";
      }
    }
    var hasFinished = (sale.items || []).some(function (it) {
      return it.kind === "finished";
    });
    return hasFinished ? "finished" : "not_started";
  }

  function resolveDeliveryStatus(sale) {
    if (sale.deliveryStatus === "delivered" || sale.deliveryStatus === "picked_up") {
      return sale.deliveryStatus;
    }
    var DATA = window.AWG_DATA;
    if (DATA && typeof DATA.getOrderByCode === "function") {
      var order = DATA.getOrderByCode(sale.code);
      if (order && order.delivered) return "delivered";
    }
    return "not_delivered";
  }

  function productionBadge(sale) {
    var s = resolveProductionStatus(sale);
    var label =
      s === "finished" ? "Finished" : s === "started" ? "Started" : "Not started";
    var cls =
      s === "finished"
        ? "status-badge--prod-done"
        : s === "started"
          ? "status-badge--prod-started"
          : "status-badge--prod-not";
    return (
      '<span class="status-badge ' +
      cls +
      '" title="Production">' +
      label +
      "</span>"
    );
  }

  function deliveryBadge(sale) {
    var s = resolveDeliveryStatus(sale);
    var label =
      s === "delivered" || s === "picked_up" ? "Delivered" : "Not delivered";
    var cls =
      s === "delivered" || s === "picked_up"
        ? "status-badge--del-yes"
        : "status-badge--del-no";
    return (
      '<span class="status-badge ' +
      cls +
      '" title="Delivery">' +
      label +
      "</span>"
    );
  }

  function rowHtml(sale) {
    syncTotals(sale);
    return (
      '<div class="sales-row card" data-sale-id="' +
      sale.id +
      '">' +
      '<div class="row">' +
      "<div><b>" +
      sale.code +
      "</b> · " +
      (sale.customer || "Customer") +
      '<div class="muted">' +
      dayLabel(sale.date) +
      " · " +
      productMix(sale) +
      "</div></div>" +
      '<div class="sales-row-money">' +
      "<b>" +
      fmtMoney(sale.total) +
      "</b>" +
      '<span class="sales-pay-label">' +
      statusLabel(sale) +
      "</span></div>" +
      "</div>" +
      '<div class="sales-status-row">' +
      productionBadge(sale) +
      deliveryBadge(sale) +
      "</div>" +
      "</div>"
    );
  }

  function render() {
    if (!state.root) return;
    var t = totals();
    var days = aggregateByDay();

    var soldEl = $("#salesSoldTotal", state.root);
    var collectedEl = $("#salesCollectedTotal", state.root);
    var dueEl = $("#salesDueTotal", state.root);
    var mixEl = $("#salesProductMix", state.root);
    var chartEl = $("#salesChart", state.root);
    var listEl = $("#salesList", state.root);

    if (soldEl) soldEl.textContent = fmtMoney(t.sold);
    if (collectedEl) collectedEl.textContent = fmtMoney(t.collected);
    if (dueEl) dueEl.textContent = fmtMoney(t.due);
    if (mixEl) {
      mixEl.textContent =
        t.custom + " custom · " + t.finished + " finished (ready-made)";
    }
    if (chartEl) chartEl.innerHTML = chartHtml(days);
    if (listEl) {
      if (!state.sales.length) {
        listEl.innerHTML = '<p class="muted">No sales recorded yet.</p>';
      } else {
        listEl.innerHTML = state.sales
          .slice()
          .sort(function (a, b) {
            return String(b.date).localeCompare(String(a.date));
          })
          .map(rowHtml)
          .join("");
      }
    }
  }

  function applyPay(saleId, mode) {
    var sale = null;
    for (var i = 0; i < state.sales.length; i++) {
      if (state.sales[i].id === saleId) {
        sale = state.sales[i];
        break;
      }
    }
    if (!sale) return null;
    syncTotals(sale);
    if (mode === "deposit") {
      sale.paid = Math.round(sale.total * 50) / 100;
    } else if (mode === "balance" || mode === "full") {
      sale.paid = sale.total;
      if (mode === "balance" || mode === "full") {
        sale.deliveryStatus = "delivered";
      }
    }
    syncTotals(sale);
    render();
    if (window.AWG_DELIVERIES && typeof window.AWG_DELIVERIES.render === "function") {
      window.AWG_DELIVERIES.render();
    }
    (state.opts.onToast || noop)(
      mode === "deposit"
        ? "Deposit recorded · " + fmtMoney(sale.due) + " left on delivery"
        : "Payment complete · " + sale.code
    );
    return sale;
  }

  function findByCode(code) {
    if (!code) return null;
    var i;
    for (i = 0; i < state.sales.length; i++) {
      if (state.sales[i].code === code) return state.sales[i];
    }
    return null;
  }

  function recordSale(payload) {
    payload = payload || {};
    var items = (payload.items || payload.ornaments || []).map(function (o) {
      var kind = o.kind === "finished" ? "finished" : "custom";
      var price =
        kind === "finished"
          ? FINISHED_PRICE
          : CUSTOM_PRICE + (o.withName ? NAME_EXTRA : 0);
      return {
        kind: kind,
        label:
          kind === "finished"
            ? "Finished ornament"
            : (o.name || o.petName || "Custom") + (o.withName ? " + name" : ""),
        price: price,
        withName: !!o.withName,
      };
    });
    if (!items.length) return null;

    var sale = {
      id: uid("sale-"),
      code: payload.code || "ABS" + String(Math.floor(100 + Math.random() * 900)),
      date: payload.date || new Date().toISOString().slice(0, 10),
      customer: payload.customer || payload.customerName || "Walk-in",
      items: items,
      total: 0,
      paid: 0,
      paymentStatus: "unpaid",
      productionStatus: payload.productionStatus || "not_started",
      deliveryStatus: payload.deliveryStatus || "not_delivered",
    };
    syncTotals(sale);
    if (payload.paymentStatus === "deposit") {
      sale.paid = Math.round(sale.total * 50) / 100;
    } else if (payload.paymentStatus === "paid") {
      sale.paid = sale.total;
    }
    syncTotals(sale);
    state.sales.unshift(sale);
    render();
    return sale;
  }

  function open() {
    (state.opts.onShowScreen || noop)("sales");
    render();
  }

  function mount(rootEl, opts) {
    if (!rootEl) return null;
    state.root = rootEl;
    state.opts = opts || {};
    if (!state.sales.length) state.sales = seedSales();

    var back = $("#btnSalesBack", rootEl);
    if (back && !back._awgBound) {
      back._awgBound = true;
      back.addEventListener("click", function () {
        (state.opts.onShowScreen || noop)("agenda");
      });
    }

    window.AWG_SALES = api;
    render();
    return api;
  }

  var api = {
    mount: mount,
    open: open,
    render: render,
    recordSale: recordSale,
    applyPayment: applyPay,
    findByCode: findByCode,
    getSales: function () {
      return state.sales.slice();
    },
    PRICES: {
      custom: CUSTOM_PRICE,
      nameExtra: NAME_EXTRA,
      finished: FINISHED_PRICE,
    },
  };

  window.AWG_SALES = api;
})();
