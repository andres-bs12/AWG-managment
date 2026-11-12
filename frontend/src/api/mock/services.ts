import { forgetFormToken, rememberFormToken } from '../formTokens'
import { validatePhoto } from '../../lib/photoValidation'
import type { Api, BuyMetric } from '../contracts'
import type { Photo } from '../../domain/types'
import { aggregateStats, demoWebMetrics, type MetricRow } from '../../lib/stats'
import { viennaDate } from '../../lib/sales'
import { paymentSummary } from '../../lib/paymentSummary'
import {
  searchOrders, attentionOrders, listSales, statsSource,
  createMockCheckout, abandonMockCheckout,
  currentPrices, updatePrices, listInventory, updateInventory, paintingDay, updatePaintingDay, joinWaitlist, confirmWaitlist, unsubscribeWaitlist,
  checkCapacity,
  cancelOrder,
  mockChangePassword,
  createSale,
  findMoveSuggestion,
  getAgendaDay,
  getForm,
  getOrder,
  getOrderBundle,
  getOrderByCode,
  getTrackByCode,
  listAgendaDays,
  deleteMarket,
  deleteMarketDay,
  listMarketDays,
  listMarkets,
  saveMarket,
  mockLogin,
  mockLogout,
  mockMe,
  moveBlock,
  setItemStatus,
  setHandedOver,
  setPaymentState,
  submitForm,
} from './store'

declare global {
  interface Window {
    /** Observable mock events for development and tests; never persisted. */
    __awgMetrics?: BuyMetric[]
  }
}

/** Dated copies of the anonymous metrics sent in this tab, for the mock Statistics page. */
const metricLog: MetricRow[] = []

function later<T>(fn: () => T, ms = 180): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try {
        resolve(fn())
      } catch (err) {
        reject(err)
      }
    }, ms)
  })
}

async function fileToPhoto(file: File): Promise<Photo> {
  const type = await validatePhoto(file)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read photo'))
    reader.readAsDataURL(file.slice(0, file.size, type))
  })
  return {
    id: `pho-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name,
    dataUrl,
  }
}

function nextDeliveryDates(itemCount: number) {
  const out: { date: string; weekday: string }[] = []
  const day = new Date(); day.setHours(12, 0, 0, 0)
  while (out.length < 6) {
    day.setDate(day.getDate() + 1)
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    if (iso > '2026-12-24') break
    if (iso < '2026-11-30') continue
    const stall = listMarketDays().some(row => row.date === iso && listMarkets().some(m => m.id === row.marketId && m.kind === 'market'))
    if (iso === '2026-12-24' || day.getDay() === 3 || (day.getDay() === 5 && !stall)) {
      let available = 0; const paint = new Date(); paint.setHours(12, 0, 0, 0)
      while (paint < day) {
        const date = `${paint.getFullYear()}-${String(paint.getMonth() + 1).padStart(2, '0')}-${String(paint.getDate()).padStart(2, '0')}`
        const setting = paintingDay(date); if (setting.open) available += Math.max(0, setting.maxPaintings - setting.booked)
        paint.setDate(paint.getDate() + 1)
      }
      if (available >= itemCount) out.push({ date: iso, weekday: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(day) })
    }
  }
  return out
}

const hhmm = (hour: number) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`

/** Stall days from the mock markets with enough painting capacity before them (mirrors ShopService.pickupDays). */
function nextPickupDays(itemCount: number) {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return listMarketDays()
    .flatMap(row => { const market = listMarkets().find(m => m.id === row.marketId && m.kind === 'market'); return market ? [{ row, market }] : [] })
    .filter(({ row }) => row.date > iso(today) && row.date <= '2026-12-24' && row.closeHour - row.openHour >= 1)
    .sort((a, b) => a.row.date.localeCompare(b.row.date))
    .filter(({ row }) => {
      let available = 0; const paint = new Date(today)
      while (iso(paint) < row.date) { const setting = paintingDay(iso(paint)); if (setting.open) available += Math.max(0, setting.maxPaintings - setting.booked); paint.setDate(paint.getDate() + 1) }
      return available >= itemCount
    })
    .slice(0, 12)
    .map(({ row, market }) => ({ date: row.date, weekday: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(`${row.date}T12:00:00`)), marketName: market.name, stall: market.stall, openTime: hhmm(row.openHour), closeTime: hhmm(row.closeHour) }))
}

const saleKeys = new Map<string, import('../../domain/types').Order>()

export const mockApi: Api = {
  prices: { get: () => later(() => currentPrices()), update: (input) => later(() => updatePrices(input)) },
  inventory: { list: () => later(() => listInventory().map(row => ({ ...row }))), update: (id, quantity, expectedQuantity) => later(() => updateInventory(id, quantity, expectedQuantity)) },
  paintingDays: { list: (from, to) => later(() => { const dates = []; const d = new Date(`${from}T12:00:00Z`); while (d.toISOString().slice(0, 10) <= to && dates.length < 63) { dates.push(paintingDay(d.toISOString().slice(0, 10))); d.setUTCDate(d.getUTCDate() + 1) } return dates }), update: (date, open, max, hours) => later(() => updatePaintingDay(date, open, max, hours)) },
  auth: {
    login: (email, password) => later(() => mockLogin(email, password), 280),
    me: (token) => later(() => mockMe(token), 40),
    logout: () => later(() => mockLogout(), 40),
    changePassword: (current, next) => later(() => mockChangePassword(current, next)),
  },
  markets: {
    listMarkets: () => later(() => listMarkets()),
    listMarketDays: (marketId) => later(() => listMarketDays(marketId)),
    saveMarket: (input) => later(() => saveMarket(input)),
    deleteMarket: (id) =>
      later(() => {
        deleteMarket(id)
      }),
    deleteMarketDay: (id) =>
      later(() => {
        deleteMarketDay(id)
      }),
  },
  agenda: {
    listDays: () => later(() => listAgendaDays()),
    getDay: (date) => later(() => getAgendaDay(date)),
    moveBlock: (blockId, date, startHour) =>
      later(() => {
        moveBlock(blockId, date, startHour)
      }),
    checkCapacity: (input) => later(() => checkCapacity(input), 120),
    findMoveSuggestion: (input) => later(() => findMoveSuggestion(input), 120),
  },
  orders: {
    listSales: (filters) => later(() => listSales(filters)),
    search: (query) => later(() => searchOrders(query)),
    attention: () => later(() => attentionOrders()),
    getOrder: (id) => later(() => getOrder(id)),
    getOrderByCode: (code) => later(() => getOrderByCode(code)),
    getOrderBundle: (id) => later(() => getOrderBundle(id)),
    createSale: (input, key) => later(() => { const existing = saleKeys.get(key); if (existing) return existing; const order = createSale(input); saleKeys.set(key, order); return order }, 320),
    cancelOrder: (id, reason) => later(() => cancelOrder(id, reason)),
    setItemStatus: (orderId, itemId, status) =>
      later(() => {
        setItemStatus(orderId, itemId, status)
      }),
    setHandedOver: (orderId, handedOver, itemIds) =>
      later(() => {
        setHandedOver(orderId, handedOver, itemIds)
      }),
  },
  payments: {
    setPaymentState: (orderId, state, method, amountPaid) => later(() => setPaymentState(orderId, state, method, amountPaid)),
  },
  tracking: {
    getByCode: (code) => later(() => getTrackByCode(code), 420),
  },
  forms: {
    getForm: (token) => later(() => getForm(token)),
    submitForm: (token, payload, options) => later(() => {
      const result = submitForm(token, payload)
      rememberFormToken(result.orderCode, token, options?.rememberToken)
      return result
    }, 400),
  },
  uploads: {
    toPhoto: (file) => fileToPhoto(file),
  },
  stats: {
    get: (from, to) => later(() => {
      const { orders, items } = statsSource()
      const today = viennaDate(new Date())
      // A web order counts as paid in the funnel once its checkout is confirmed, as the webhook records it.
      const paidWeb: MetricRow[] = orders.filter(order => order.source === 'web' && order.status !== 'CANCELLED' && (order.checkoutStatus ?? 'confirmed') === 'confirmed' && !order.paymentReview)
        .map(order => ({ date: viennaDate(order.createdAt), event: 'buy_paid', count: 1 }))
      return aggregateStats({ from, to, orders, items, metrics: [...demoWebMetrics(from, to, today), ...metricLog, ...paidWeb], viennaDay: viennaDate, received: order => paymentSummary(order).paid })
    }),
  },
  metrics: {
    track: async (metric) => {
      metricLog.push({ ...metric, date: viennaDate(new Date()), count: 1 })
      if (import.meta.env.DEV || import.meta.env.MODE === 'test' || import.meta.env.MODE === 'mock') {
        // Preserve the whole payload so privacy tests also catch unexpected fields.
        (window.__awgMetrics ??= []).push(structuredClone(metric))
      }
    },
  },
  shop: {
    abandonCheckout: (code) => later(() => { abandonMockCheckout(code); forgetFormToken(code) }),
    confirmWaitlist: (token) => later(() => confirmWaitlist(token)),
    unsubscribeWaitlist: (token) => later(() => unsubscribeWaitlist(token)),
    joinWaitlist: (email) => later(() => joinWaitlist(email)),
    getConfig: () =>
      later(() => ({
        enabled: true,
        seasonEnd: '2026-12-24',
        deliveriesFrom: '2026-11-30',
        deliveryWindowStart: '18:00',
        deliveryWindowEnd: '20:00',
        // The demo shows the confirmation line; no e-mail is actually sent in mock mode.
        confirmationEmail: true,
        seasonOver: new Date() >= new Date('2026-12-25T00:00:00'),
        ...currentPrices(),
        deliveryFee: 0,
        maxItems: 10,
        colors: [
          ...listInventory().filter(row => row.kind === 'custom' && row.color && row.finish && ['red', 'green', 'beige'].includes(row.color)).map(row => ({ color: row.color!, finish: row.finish!, inStock: row.quantity > 0 })),
        ],
      }), 80),
    listDeliveryDates: (items) => later(() => (items.length ? nextDeliveryDates(items.length) : []), 120),
    listPickupDays: (items) => later(() => (items.length ? nextPickupDays(items.length) : []), 120),
    checkout: (input) =>
      later(() => {
        if (!input.items.length) throw new Error('Add at least one ornament.')
        if (input.items.some((item) => item.kind !== 'custom')) throw new Error('Only custom ornaments can be ordered online.')
        if (!input.acceptTerms) throw new Error('Please accept the terms.')
        if (!input.deliveryDate) throw new Error('Choose a delivery day.')
        if (input.deliveryKind === 'market') {
          const day = nextPickupDays(input.items.length).find(entry => entry.date === input.deliveryDate)
          if (!day) throw Object.assign(new Error('Choose an available market day.'), { code: 'PICKUP_DAY_INVALID', field: 'deliveryDate' })
          const time = input.pickupTime ?? ''
          if (!/^\d{2}:(00|30)$/.test(time) || time < day.openTime || time > hhmm(Number(day.closeTime.slice(0, 2)) + Number(day.closeTime.slice(3)) / 60 - 0.5)) throw Object.assign(new Error('Choose an arrival time while the stall is open.'), { code: 'PICKUP_TIME_INVALID', field: 'pickupTime' })
          return createMockCheckout(input)
        }
        if (!input.address) throw Object.assign(new Error('Address is required.'), { code: 'VALIDATION', field: 'address' })
        return createMockCheckout(input)
      }, 500),
  },
}
