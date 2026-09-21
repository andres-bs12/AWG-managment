import type { Api } from '../contracts'
import type { Photo } from '../../domain/types'
import {
  checkCapacity,
  createSale,
  getAgendaDay,
  getForm,
  getOrder,
  getOrderBundle,
  getOrderByCode,
  getTrackByCode,
  listAgendaDays,
  listMarketDays,
  listMarkets,
  mockLogin,
  mockLogout,
  mockMe,
  moveBlock,
  setItemStatus,
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

export const mockApi: Api = {
  auth: {
    login: (email, password) => later(() => mockLogin(email, password), 280),
    me: (token) => later(() => mockMe(token), 40),
    logout: () => later(() => mockLogout(), 40),
  },
  markets: {
    listMarkets: () => later(() => listMarkets()),
    listMarketDays: (marketId) => later(() => listMarketDays(marketId)),
  },
  agenda: {
    listDays: () => later(() => listAgendaDays()),
    getDay: (date) => later(() => getAgendaDay(date)),
    moveBlock: (blockId, date, startHour) =>
      later(() => {
        moveBlock(blockId, date, startHour)
      }),
    checkCapacity: (input) => later(() => checkCapacity(input), 120),
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
}
