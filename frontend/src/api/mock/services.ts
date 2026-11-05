import type { Api } from '../contracts'
import type { Photo } from '../../domain/types'
import {
  createMockCheckout, abandonMockCheckout,
  listInventory, updateInventory, paintingDay, updatePaintingDay, joinWaitlist,
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
  updateViennaAddress,
} from './store'

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
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read photo'))
    reader.readAsDataURL(file)
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

const saleKeys = new Map<string, import('../../domain/types').Order>()

export const mockApi: Api = {
  inventory: { list: () => later(() => listInventory().map(row => ({ ...row }))), update: (id, quantity, expectedQuantity) => later(() => updateInventory(id, quantity, expectedQuantity)) },
  paintingDays: { list: (from, to) => later(() => { const dates = []; const d = new Date(`${from}T12:00:00Z`); while (d.toISOString().slice(0, 10) <= to && dates.length < 62) { dates.push(paintingDay(d.toISOString().slice(0, 10))); d.setUTCDate(d.getUTCDate() + 1) } return dates }), update: (date, open, max) => later(() => updatePaintingDay(date, open, max)) },
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
    getOrder: (id) => later(() => getOrder(id)),
    getOrderByCode: (code) => later(() => getOrderByCode(code)),
    getOrderBundle: (id) => later(() => getOrderBundle(id)),
    createSale: (input, key) => later(() => { const existing = saleKeys.get(key); if (existing) return existing; const order = createSale(input); saleKeys.set(key, order); return order }, 320),
    cancelOrder: (id) => later(() => cancelOrder(id)),
    setItemStatus: (orderId, itemId, status) =>
      later(() => {
        setItemStatus(orderId, itemId, status)
      }),
    setHandedOver: (orderId, handedOver) =>
      later(() => {
        setHandedOver(orderId, handedOver)
      }),
  },
  payments: {
    setPaymentState: (orderId, state, method, amountPaid) => later(() => setPaymentState(orderId, state, method, amountPaid)),
  },
  tracking: {
    getByCode: (code) => later(() => getTrackByCode(code), 420),
    updateViennaAddress: (code, address) => later(() => updateViennaAddress(code, address)),
  },
  forms: {
    getForm: (token) => later(() => getForm(token)),
    submitForm: (token, payload) => later(() => submitForm(token, payload), 400),
  },
  uploads: {
    toPhoto: (file) => fileToPhoto(file),
  },
  shop: {
    abandonCheckout: (code) => later(() => abandonMockCheckout(code)),
    joinWaitlist: (email) => later(() => joinWaitlist(email)),
    getConfig: () =>
      later(() => ({
        enabled: true,
        seasonEnd: '2026-12-24',
        seasonOver: new Date() >= new Date('2026-12-25T00:00:00'),
        customPrice: 49.99,
        nameExtra: 12.99,
        deliveryFee: 0,
        maxItems: 10,
        colors: [
          ...listInventory().filter(row => row.kind === 'custom' && row.color).map(row => ({ color: row.color!, inStock: row.quantity > 0 })),
        ],
      }), 80),
    listDeliveryDates: (items) => later(() => (items.length ? nextDeliveryDates(items.length) : []), 120),
    checkout: (input) =>
      later(() => {
        if (!input.items.length) throw new Error('Add at least one ornament.')
        if (input.items.some((item) => item.kind !== 'custom')) throw new Error('Only custom ornaments can be ordered online.')
        if (!input.acceptTerms) throw new Error('Please accept the terms.')
        if (!input.deliveryDate) throw new Error('Choose a delivery day.')
        return createMockCheckout(input)
      }, 500),
  },
}
