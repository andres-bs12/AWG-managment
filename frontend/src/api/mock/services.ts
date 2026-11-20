import { mockMarketStock } from './marketStock'
import { forgetFormToken, rememberFormToken } from '../formTokens'
import { validatePhoto } from '../../lib/photoValidation'
import type { Api, BuyMetric } from '../contracts'
import type { Photo } from '../../domain/types'
import { aggregateStats, demoWebMetrics, type MetricRow } from '../../lib/stats'
import { viennaDate } from '../../lib/sales'
import { paymentSummary } from '../../lib/paymentSummary'
import { addUtcDays } from '../../lib/time'
import { pickupTimes } from '../../lib/pickupTimes'
import {
  searchOrders, attentionOrders, listSales, statsSource,
  createMockCheckout, abandonMockCheckout, getShippingQuote, getShippingWindow, listCollectionDays, setCollectionDay, makeRoom, makeRoomForBlock,
  currentPrices, updatePrices, listInventory, updateInventory, paintingDay, updatePaintingDay, joinWaitlist, confirmWaitlist, unsubscribeWaitlist,
  checkCapacity,
  cancelStaffOrder,
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
  listMarketDays, marketDaysOn, webPickupDay,
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

function later<T>(fn: () => T | PromiseLike<T>, ms = 180): Promise<T> {
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

const deliveriesFrom = '2026-11-30'

function firstDeliveryDay(): string {
  const tomorrow = addUtcDays(viennaDate(new Date()), 1)
  return tomorrow > deliveriesFrom ? tomorrow : deliveriesFrom
}
const hhmm = (hour: number) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`

/** Stall days from the mock markets with enough painting capacity before them (mirrors ShopService.pickupDays). */
function nextPickupDays(itemCount: number) {
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dates = [...new Set(listMarketDays().map(day => day.date))].sort()
  const first = firstDeliveryDay()
  const markets = listMarkets()
  return dates
    .filter(date => date >= first && date <= '2026-12-24')
    .flatMap(date => {
      const row = webPickupDay(date)
      const market = row && markets.find(m => m.id === row.marketId)
      return row && market && pickupTimes({ openTime: hhmm(row.openHour), closeTime: hhmm(row.closeHour) }).length
        ? [{ row, market }] : []
    })
    .filter(({ row }) => {
      let available = 0; const paint = new Date(today)
      while (iso(paint) < row.date) { const setting = paintingDay(iso(paint)); if (setting.open) available += Math.max(0, setting.maxPaintings - setting.booked); paint.setDate(paint.getDate() + 1) }
      return available >= itemCount
    })
    .slice(0, 12)
    .map(({ row, market }) => ({ date: row.date, marketDayId: row.id, weekday: new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(`${row.date}T12:00:00`)), marketName: market.name, stall: market.stall, openTime: hhmm(row.openHour), closeTime: hhmm(row.closeHour) }))
}

const saleKeys = new Map<string, Promise<import('../../domain/types').Order>>()

export const mockApi: Api = {
  prices: { get: () => later(() => currentPrices()), update: (input) => later(() => updatePrices(input)) },
  marketStock: mockMarketStock,
  inventory: { list: () => later(() => listInventory().map(row => ({ ...row }))), update: (id, quantity, expectedQuantity) => later(() => updateInventory(id, quantity, expectedQuantity)) },
  paintingDays: { list: (from, to) => later(() => { const dates = []; const d = new Date(`${from}T12:00:00Z`); while (d.toISOString().slice(0, 10) <= to && dates.length < 63) { dates.push(paintingDay(d.toISOString().slice(0, 10))); d.setUTCDate(d.getUTCDate() + 1) } return dates }), update: (date, open, settings) => later(() => updatePaintingDay(date, open, settings)) },
  shipping: {
    window: (readyOn) => later(() => getShippingWindow(readyOn), 80),
    collectionDays: (from, to) => later(() => listCollectionDays(from, to)),
    setCollectionDay: (date, open) => later(() => setCollectionDay(date, open)),
  },
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
    makeRoomForBlock: (itemId) => later(() => makeRoomForBlock(itemId), 120),
    makeRoom: (input, key) => later(() => makeRoom(input, key), 160),
  },
  orders: {
    listSales: (filters) => later(() => listSales(filters)),
    search: (query) => later(() => searchOrders(query)),
    attention: () => later(() => attentionOrders()),
    getOrder: (id) => later(() => getOrder(id)),
    getOrderByCode: (code) => later(() => getOrderByCode(code)),
    getOrderBundle: (id) => later(() => getOrderBundle(id)),
    createSale: (input, key) => {
      const existing = saleKeys.get(key)
      if (existing) return existing
      const pending = later(() => createSale(input), 320).catch(error => {
        saleKeys.delete(key)
        throw error
      })
      saleKeys.set(key, pending)
      return pending
    },
    cancelOrder: (id, reason) => later(() => cancelStaffOrder(id, reason)),
    setItemStatus: (orderId, itemId, status) =>
      later(() => {
        setItemStatus(orderId, itemId, status)
      }),
    setHandedOver: (orderId, handedOver, itemIds, trackingNumber) =>
      later(() => {
        setHandedOver(orderId, handedOver, itemIds, trackingNumber)
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
      later(() => {
        const prices = currentPrices()
        return {
          enabled: true,
          seasonEnd: '2026-12-24',
          deliveriesFrom,
          deliveryWindowStart: '18:00',
          deliveryWindowEnd: '20:00',
          // The demo shows the confirmation line; no e-mail is actually sent in mock mode.
          confirmationEmail: true,
          seasonOver: new Date() >= new Date('2026-12-25T00:00:00'),
          ...prices,
          deliveryFee: prices.shippingFee,
          maxItems: 10,
          colors: [
            ...listInventory().filter(row => row.kind === 'custom' && row.color && row.finish && ['red', 'green', 'beige'].includes(row.color)).map(row => ({ color: row.color!, finish: row.finish!, inStock: row.quantity > 0 })),
          ],
        }
      }, 80),
    shippingQuote: (items) => later(() => getShippingQuote(items), 120),
    listPickupDays: (items) => later(() => (items.length ? nextPickupDays(items.length) : []), 120),
    checkout: (input) =>
      later(() => {
        if (!input.items.length) throw new Error('Add at least one ornament.')
        if (input.items.some((item) => item.kind !== 'custom')) throw new Error('Only custom ornaments can be ordered online.')
        if (!input.acceptTerms) throw new Error('Please accept the terms.')
        if (input.deliveryKind === 'market') {
          if (!input.deliveryDate) throw Object.assign(new Error('Choose a pickup day.'), { code: 'VALIDATION', field: 'deliveryDate' })
          const day = nextPickupDays(input.items.length).find(entry => entry.date === input.deliveryDate)
          const wrongMarket = input.marketDayId ? day?.marketDayId !== input.marketDayId : marketDaysOn(input.deliveryDate).length > 1
          if (!day || wrongMarket) throw Object.assign(new Error('Choose an available market day.'), { code: 'PICKUP_DAY_INVALID', field: 'deliveryDate', status: 400 })
          const time = input.pickupTime ?? ''
          if (!pickupTimes(day).includes(time)) throw Object.assign(new Error('Choose an arrival time while the stall is open.'), { code: 'PICKUP_TIME_INVALID', field: 'pickupTime', status: 400 })
          return createMockCheckout({ ...input, marketDayId: day.marketDayId })
        }
        return createMockCheckout(input)
      }, 500),
  },
}
