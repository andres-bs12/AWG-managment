import type {
  Address,
  AgendaDay,
  CapacityResult,
  CreateSaleInput,
  CustomerFormPayload,
  CustomerFormView,
  Market,
  MarketDay,
  Order,
  Photo,
  PaymentMethod,
  PaymentState,
  StaffUser,
  TrackView,
} from '../domain/types'

export type AuthResult = {
  token: string
  user: StaffUser
}

export type AuthService = {
  login: (email: string, password: string) => Promise<AuthResult>
  me: (token: string) => Promise<StaffUser>
  logout: () => Promise<void>
}

export type MarketService = {
  listMarkets: () => Promise<Market[]>
  listMarketDays: (marketId?: string) => Promise<MarketDay[]>
}

export type AgendaService = {
  listDays: () => Promise<AgendaDay[]>
  getDay: (date: string) => Promise<AgendaDay>
  moveBlock: (blockId: string, date: string, startHour: number) => Promise<void>
  checkCapacity: (input: {
    date: string
    durationHours: number
    afterHour?: number
    extraBusy?: { startHour: number; endHour: number }[]
  }) => Promise<CapacityResult>
}

export type OrderService = {
  getOrder: (id: string) => Promise<Order>
  getOrderByCode: (code: string) => Promise<Order | null>
  getOrderBundle: (id: string) => Promise<{
    order: Order
    customer: import('../domain/types').Customer
    items: import('../domain/types').OrderItem[]
    blocks: import('../domain/types').TimeBlock[]
  }>
  createSale: (input: CreateSaleInput) => Promise<Order>
  setItemStatus: (
    orderId: string,
    itemId: string,
    status: import('../domain/types').ProductionStatus,
  ) => Promise<void>
}

export type PaymentService = {
  setPaymentState: (
    orderId: string,
    state: PaymentState,
    method?: PaymentMethod | null,
  ) => Promise<Order>
}

export type TrackingService = {
  getByCode: (code: string) => Promise<TrackView>
  updateViennaAddress: (code: string, address: Address) => Promise<TrackView>
}

export type FormService = {
  getForm: (token: string) => Promise<CustomerFormView>
  submitForm: (token: string, payload: CustomerFormPayload) => Promise<{ orderCode: string }>
}

export type UploadService = {
  toPhoto: (file: File) => Promise<Photo>
}

export type Api = {
  auth: AuthService
  markets: MarketService
  agenda: AgendaService
  orders: OrderService
  payments: PaymentService
  tracking: TrackingService
  forms: FormService
  uploads: UploadService
}
