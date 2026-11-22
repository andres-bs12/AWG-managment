import type { MarketOrnament, MarketPaintStatus } from '../domain/marketStock'
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
  MakeRoomInput,
  MakeRoomResult,
  MoveSuggestion,
  PostCollectionDay,
  Order,
  Photo,
  PaymentMethod,
  PaymentState,
  ShopCheckoutInput,
  ShopCheckoutResult,
  ShopConfig,
  ShippingQuote,
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
    handoffMarketDayId?: string
  }) => Promise<CapacityResult>
  findMoveSuggestion: (input: {
    date: string
    durationHours: number
    handoffDate: string
    beforeHour?: number
    handoffMarketDayId?: string
  }) => Promise<MoveSuggestion | null>
  /** Moves one movable paint session to the next slot before its handoff. 409 SESSION_NOT_MOVABLE / NO_SLOT_KEEPS_PROMISE. */
  makeRoomForBlock: (itemId: string) => Promise<MakeRoomResult>
  /** Frees `minutes` on `date` by moving sessions; `key` is the Idempotency-Key. 409 NO_MOVABLE_SESSION with `reason`. */
  makeRoom: (input: MakeRoomInput, key: string) => Promise<MakeRoomResult>
}

export type ShippingService = {
  /** Staff New sale: the Post collection and arrival window for ornaments ready on `readyOn`. */
  window: (readyOn: string) => Promise<ShippingQuote>
  collectionDays: (from: string, to: string) => Promise<PostCollectionDay[]>
  /** `open` adds or cancels a collection on that date; `null` clears the override. */
  setCollectionDay: (date: string, open: boolean | null) => Promise<void>
}

export type OrderService = {
  listSales: (filters: import('../domain/types').SalesFilters) => Promise<import('../domain/types').SalesPage>
  search: (query: string) => Promise<import('../domain/types').OrderSummary[]>
  attention: () => Promise<import('../domain/types').OrderSummary[]>
  /** Staff confirms a new web order was seen; it leaves "Needs attention". */
  markReviewed: (id: string) => Promise<Order>
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
  /** Mark (or undo) market pickup / Post shipping / Vienna handoff — Track becomes `delivered`. */
  /** `trackingNumber`: Post parcel number stored on the order when present (blank clears it). */
  /** `collectMethod`: record the rest as paid in the same step, so the customer gets one e-mail. */
  setHandedOver: (orderId: string, handedOver: boolean, itemIds?: string[], trackingNumber?: string | null, collectMethod?: PaymentMethod) => Promise<void>
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
  shippingQuote: (items: Pick<ShopItemInput, 'kind' | 'withName'>[]) => Promise<ShippingQuote>
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
  marketStock: {
    list: () => Promise<MarketOrnament[]>
    photo: (id: string) => Promise<string | null>
    changeStatus: (id: string, status: MarketPaintStatus, revision: number) => Promise<MarketOrnament>
    savePhoto: (id: string, photo: Blob, revision: number) => Promise<MarketOrnament>
  }
  inventory: { list: () => Promise<InventoryItem[]>; update: (id: string, quantity: number, expectedQuantity?: number) => Promise<InventoryItem> }
  prices: { get: () => Promise<Prices>; update: (input: PricesUpdate) => Promise<Prices> }
  paintingDays: { list: (from: string, to: string) => Promise<PaintingDay[]>; update: (date: string, open: boolean | undefined, settings?: { openHour?: number; closeHour?: number; paintingMarketId?: string | null }) => Promise<PaintingDay> }
  shipping: ShippingService
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
