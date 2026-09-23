import type { Api } from '../contracts'

const hint =
  'HTTP API is not wired yet. Keep VITE_DATA_SOURCE=mock, or implement fetch calls in src/api/http/services.ts (see docs/frontend-api-swap.md).'

function notWired(): never {
  throw new Error(hint)
}

export const httpApi: Api = {
  auth: {
    login: async () => notWired(),
    me: async () => notWired(),
    logout: async () => notWired(),
  },
  markets: {
    listMarkets: async () => notWired(),
    listMarketDays: async () => notWired(),
    saveMarket: async () => notWired(),
    deleteMarket: async () => notWired(),
    deleteMarketDay: async () => notWired(),
  },
  agenda: {
    listDays: async () => notWired(),
    getDay: async () => notWired(),
    moveBlock: async () => notWired(),
    checkCapacity: async () => notWired(),
    findMoveSuggestion: async () => notWired(),
  },
  orders: {
    getOrder: async () => notWired(),
    getOrderByCode: async () => notWired(),
    getOrderBundle: async () => notWired(),
    createSale: async () => notWired(),
    setItemStatus: async () => notWired(),
    setHandedOver: async () => notWired(),
  },
  payments: {
    setPaymentState: async () => notWired(),
    recordPayment: async () => notWired(),
  },
  tracking: {
    getByCode: async () => notWired(),
    updateViennaAddress: async () => notWired(),
  },
  forms: {
    getForm: async () => notWired(),
    submitForm: async () => notWired(),
  },
  uploads: {
    toPhoto: async () => notWired(),
  },
}
