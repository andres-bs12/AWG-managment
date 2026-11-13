import type {
  InventoryItem, PaintingDay, Prices, PricesUpdate,
  AgendaDay,
  CapacityResult,
  CreateSaleInput,
  CustomerFormPayload,
  CustomerFormView,
  Market,
  MarketDay,
  SaveMarketInput,
  MoveSuggestion,
  Order,
  Photo,
  PaymentMethod,
  PaymentState,
  ShopCheckoutInput,
  ShopCheckoutResult,
  ShopConfig,
  ShopDeliveryDate,
  ShopPickupDay,
  ShopItemInput,
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
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export type MarketService = {
  listMarkets: () => Promise<Market[]>
  listMarketDays: (marketId?: string) => Promise<MarketDay[]>
  saveMarket: (input: SaveMarketInput) => Promise<{ market: Market; days: MarketDay[] }>
  deleteMarket: (id: string) => Promise<void>
  deleteMarketDay: (id: string) => Promise<void>
}

export type AgendaService = {
  listDays: () => Promise<AgendaDay[]>
  getDay: (date: string) => Promise<AgendaDay>
  moveBlock: (blockId: string, date: string, startHour: number) => Promise<void>
  checkCapacity: (input: {
    date: string
    durationHours: number
    afterHour?: number
    beforeHour?: number
    extraBusy?: { startHour: number; endHour: number }[]
  }) => Promise<CapacityResult>
  findMoveSuggestion: (input: {
    date: string
    durationHours: number
    handoffDate: string
    beforeHour?: number
  }) => Promise<MoveSuggestion | null>
}

export type OrderService = {
  listSales: (filters: import('../domain/types').SalesFilters) => Promise<import('../domain/types').SalesPage>
  search: (query: string) => Promise<import('../domain/types').OrderSummary[]>
  attention: () => Promise<import('../domain/types').OrderSummary[]>
  getOrder: (id: string) => Promise<Order>
  getOrderByCode: (code: string) => Promise<Order | null>
  getOrderBundle: (id: string) => Promise<{
    order: Order
    customer: import('../domain/types').Customer
    items: import('../domain/types').OrderItem[]
    blocks: import('../domain/types').TimeBlock[]
  }>
  createSale: (input: CreateSaleInput, idempotencyKey: string) => Promise<Order>
  cancelOrder: (orderId: string, reason?: string) => Promise<void>
  setItemStatus: (
    orderId: string,
    itemId: string,
    status: import('../domain/types').ProductionStatus,
  ) => Promise<void>
  /** Mark (or undo) market pickup / Vienna handoff — Track becomes `delivered`. */
  setHandedOver: (orderId: string, handedOver: boolean, itemIds?: string[]) => Promise<void>
}

export type PaymentService = {
  setPaymentState: (
    orderId: string,
    state: PaymentState,
    method?: PaymentMethod | null,
    amountPaid?: number,
  ) => Promise<Order>
}

export type TrackingService = {
  getByCode: (code: string) => Promise<TrackView>
}

export type FormService = {
  getForm: (token: string) => Promise<CustomerFormView>
  /** Shared staff devices submit with rememberToken=false, including after signing out. */
  submitForm: (token: string, payload: CustomerFormPayload, options?: { rememberToken?: boolean }) => Promise<{ orderCode: string }>
}

export type UploadService = {
  toPhoto: (file: File) => Promise<Photo>
}

export type ShopService = {
  confirmWaitlist: (token: string) => Promise<void>
  unsubscribeWaitlist: (token: string) => Promise<void>
  joinWaitlist: (email: string, locale: 'de' | 'en') => Promise<void>
  getConfig: () => Promise<ShopConfig>
  listDeliveryDates: (items: Pick<ShopItemInput, 'kind' | 'withName'>[]) => Promise<ShopDeliveryDate[]>
  listPickupDays: (items: Pick<ShopItemInput, 'kind' | 'withName'>[]) => Promise<ShopPickupDay[]>
  /** Creates the order and a Stripe Checkout session; the browser then redirects to `checkoutUrl`. */
  checkout: (input: ShopCheckoutInput) => Promise<ShopCheckoutResult>
  abandonCheckout: (code: string) => Promise<void>
}

export type BuyMetric = { event: 'buy_view' | 'home_view' | 'track_view' | 'form_view' | 'buy_step' | 'buy_choice' | 'buy_photo_added' | 'buy_validation_error' | 'buy_pay_click' | 'buy_seq'; step?: 'design' | 'delivery' | 'details' | 'review'; field?: string; code?: 'required' | 'invalid'; value?: string }

export type Api = {
  metrics: { track: (metric: BuyMetric) => Promise<void> }
  /** Staff only. Vienna dates, both inclusive (max 400 days). */
  stats: { get: (from: string, to: string) => Promise<import('../domain/types').Stats> }
  inventory: { list: () => Promise<InventoryItem[]>; update: (id: string, quantity: number, expectedQuantity?: number) => Promise<InventoryItem> }
  prices: { get: () => Promise<Prices>; update: (input: PricesUpdate) => Promise<Prices> }
  paintingDays: { list: (from: string, to: string) => Promise<PaintingDay[]>; update: (date: string, open: boolean, maxPaintings: number, hours?: { openHour: number; closeHour: number }) => Promise<PaintingDay> }
  auth: AuthService
  markets: MarketService
  agenda: AgendaService
  orders: OrderService
  payments: PaymentService
  tracking: TrackingService
  forms: FormService
  uploads: UploadService
  shop: ShopService
}
