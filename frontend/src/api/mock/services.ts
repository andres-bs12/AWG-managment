import type { Api } from '../contracts'
import type { Photo } from '../../domain/types'
import {
  checkCapacity,
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

function nextDeliveryDates(count: number): { date: string; weekday: string }[] {
  const out: { date: string; weekday: string }[] = []
  const day = new Date()
  day.setHours(12, 0, 0, 0)
  while (out.length < count) {
    day.setDate(day.getDate() + 1)
    const dow = day.getDay()
    if (dow === 3 || dow === 5) {
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
      out.push({ date: iso, weekday: dow === 3 ? 'Wednesday' : 'Friday' })
    }
  }
  return out
}

export const mockApi: Api = {
  auth: {
    login: (email, password) => later(() => mockLogin(email, password), 280),
    me: (token) => later(() => mockMe(token), 40),
    logout: () => later(() => mockLogout(), 40),
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
    createSale: (input) => later(() => createSale(input), 320),
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
    setPaymentState: (orderId, state, method) => later(() => setPaymentState(orderId, state, method)),
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
    getConfig: () =>
      later(() => ({
        enabled: true,
        customPrice: 49.99,
        nameExtra: 12.99,
        deliveryFee: 0,
        maxItems: 10,
        colors: [
          { color: 'red', inStock: true },
          { color: 'grey', inStock: true },
          { color: 'green', inStock: false },
          { color: 'white', inStock: false },
        ],
      }), 80),
    listDeliveryDates: (items) => later(() => (items.length ? nextDeliveryDates(6) : []), 120),
    checkout: (input) =>
      later(() => {
        if (!input.items.length) throw new Error('Add at least one ornament.')
        if (input.items.some((item) => item.kind !== 'custom')) throw new Error('Only custom ornaments can be ordered online.')
        if (!input.acceptTerms) throw new Error('Please accept the terms.')
        if (!input.deliveryDate) throw new Error('Choose a delivery day.')
        const code = `WEB${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
        return { orderCode: code, formToken: `mock-${code}`, checkoutUrl: `/buy/thanks?code=${code}` }
      }, 500),
  },
}
