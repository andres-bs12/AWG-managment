/** Domain types aligned with FigJam Entities (19:2599) and docs/README.md */

export type PaymentState = 'unpaid' | 'deposit' | 'paid'
export type PaymentMethod = 'cash' | 'card'
export type OrnamentColor = 'red' | 'grey' | 'green' | 'white' | 'beige'
export type CustomFinish = 'shiny' | 'matte'
export type ItemKind = 'custom' | 'finished'
export type ProductionStatus = 'not_started' | 'in_progress' | 'finished'
export type DeliveryKind = 'market' | 'vienna'
export type MarketKind = 'market' | 'home'
export type TrackStatus = 'preparing' | 'ready' | 'delivered' | 'cancelled'

export type StaffUser = {
  id: string
  name: string
  email: string
}

export type Customer = {
  id: string
  name: string
  phone: string
  email: string
}

export type Address = {
  line1: string
  line2?: string
  city: string
  postalCode: string
}

export type Photo = {
  id: string
  name: string
  dataUrl: string
}

export type OrderItem = {
  id: string
  orderId: string
  kind: ItemKind
  petName: string
  withName: boolean
  color?: OrnamentColor
  finish?: CustomFinish
  backName: string
  note: string
  cost: number
  productionStatus: ProductionStatus
  handedOver?: boolean
  photos: Photo[]
  formComplete: boolean
  delivery: {
    kind: DeliveryKind
    marketId?: string
    marketDayId?: string
    pickupHour?: number | null
    deliveryDate?: string
    address?: Address | null
  }
}

export type CheckoutStatus = 'pending' | 'review' | 'confirmed'

export type OrderSummary = {
  id: string; code: string; customerName: string; phone: string; createdAt: string
  paymentState: PaymentState; checkoutStatus: CheckoutStatus | null; total: number
  items: number; nextHandoffDate: string | null; handedOver: boolean
  source?: 'stall' | 'web'; status?: 'ACTIVE' | 'CANCELLED'
}

export type SalesFilters = {
  state?: PaymentState | 'pending' | 'review'
  source?: 'stall' | 'web'
  from?: string
  to?: string
  query?: string
  page?: number
  size?: number
}
export type SalesPage = { orders: OrderSummary[]; page: number; size: number; totalElements: number; totalPages: number }

export type Order = {
  status?: 'ACTIVE' | 'CANCELLED'
  cancelledAt?: string | null
  cancellationReason?: string | null
  checkoutStatus?: CheckoutStatus | null
  source?: 'web' | 'stall'

  id: string
  customerId: string
  code: string
  trackToken: string
  formToken: string
  paymentState: PaymentState
  paymentMethod: PaymentMethod | null
  total: number
  amountPaid?: number
  createdAt: string
  itemIds: string[]
  /** True once staff marks market pickup / Vienna handoff as done. Drives Track `delivered`. */
  handedOver: boolean
  handedOverAt?: string
  paymentReview?: boolean
  /** Append-only payment entries. Older records may not have this field yet. */
  paymentEntries?: PaymentEntry[]
  /** Previously recorded amount from legacy orders without individual receipts. */
  paymentOpeningBalance?: number
}

export type PaymentEntry = {
  id: string
  amount: number
  method: PaymentMethod
  recordedAt: string
}

export type Market = {
  id: string
  name: string
  kind: MarketKind
  totalCost: number
  /** Season bounds for a stall. Null for home painting. */
  startDate: string | null
  finishDate: string | null
  /** Stall number at the market. Null for home painting. */
  stall: number | null
}

export type SaveMarketDayInput = {
  date: string
  openHour: number
  closeHour: number
}

export type SaveMarketInput = {
  id?: string
  name: string
  startDate: string
  finishDate: string
  totalCost: number
  stall: number
  days: SaveMarketDayInput[]
}

export type MarketDay = {
  id: string
  marketId: string
  date: string
  openHour: number
  closeHour: number
  isToday: boolean
}

export type TimeBlock = {
  id: string
  marketDayId: string
  orderItemId: string | null
  startHour: number
  endHour: number
  status: ProductionStatus
}

export type AgendaSlot = {
  held?: boolean
  holdUntil?: string | null
  block: TimeBlock
  order: Order | null
  item: OrderItem | null
  customer: Customer | null
}

export type AgendaDelivery = {
  remaining?: number
  paymentState?: PaymentState
  customerName?: string
  color?: OrnamentColor
  finish?: CustomFinish
  backName?: string
  orderId: string
  orderCode: string
  itemId: string
  title: string
  productionStatus: ProductionStatus
  handedOver: boolean
  deliveryKind: DeliveryKind
  pickupHour: number | null
  methodLabel: string
  timeLabel: string | null
  phone: string
  addressLabel: string | null
  photoUrl?: string
  source?: 'stall' | 'web'
}

export type AgendaDay = {
  marketDay: MarketDay
  market: Market
  slots: AgendaSlot[]
  deliveries: AgendaDelivery[]
}

export type TrackItemView = {
  color?: OrnamentColor
  finish?: CustomFinish
  cost?: number
  petName: string
  kind: ItemKind
  productionStatus: ProductionStatus
  withName: boolean
  backName: string
}

/**
 * Structured handoff info so the UI can localise it. `market` means "collect at the stall";
 * `unknown` covers orders whose handoff has not been scheduled yet.
 */
export type TrackWhen = {
  kind: 'market' | 'vienna' | 'unknown'
  /** ISO date of the handoff day, when known. */
  date: string | null
  /** Decimal hour the customer can collect from. */
  fromHour: number | null
  marketName: string | null
  /** Decimal hour the stall packs up that day. */
  untilHour: number | null
}

export type TrackView = {
  total?: number
  paymentState?: PaymentState
  code: string
  status: TrackStatus
  customerName: string
  items: TrackItemView[]
  delivery: OrderItem['delivery']
  when: TrackWhen
}

export type CustomerFormView = {
  needsAddress: boolean
  address: Address | null
  editable: boolean
  handoffs?: TrackWhen[]
  total?: number
  paymentState?: PaymentState
  items?: OrderItem[]
  token: string
  orderCode: string
  withName: boolean
  alreadySubmitted: boolean
  customer: Customer
  item: OrderItem
}

export type ItemFormPayload = {
  orderItemId: string
  petName: string
  backName?: string
  note?: string
  photos: Photo[]
}

export type CustomerFormPayload = {
  address?: Address
  customerName: string
  phone: string
  email: string
  items: ItemFormPayload[]
}

export type CreateSaleItemInput = {
  kind: ItemKind
  withName: boolean
  color?: OrnamentColor
  finish?: CustomFinish
  paintDate?: string
  paintStart?: number
  paintEnd?: number
  deliveryKind: DeliveryKind
  marketId?: string
  marketDayId?: string
  pickupHour?: number | null
  address?: Address | null
}

export type CreateSaleInput = {
  plannedMove?: MoveSuggestion
  /** Optional: staff does not collect these; the customer form does. */
  customerName?: string
  phone?: string
  email?: string
  items: CreateSaleItemInput[]
  movedAnotherSell?: boolean
}

export type CapacityResult = {
  ok: boolean
  slot: { date: string; startHour: number; endHour: number } | null
  remainingHours: number
  message: string
}

export type MoveSuggestion = {
  blockId: string
  orderCode: string
  title: string
  from: { date: string; startHour: number; endHour: number }
  to: { date: string; startHour: number; endHour: number }
  freedSlot: { date: string; startHour: number; endHour: number }
}

export type InventoryItem = { id: string; kind: ItemKind; color: OrnamentColor | null; finish?: CustomFinish | null; quantity: number }
export type PaintingDay = { date: string; open: boolean; maxPaintings: number; booked: number; openHour: number; closeHour: number }

export type ShopConfig = {
  seasonEnd: string
  deliveriesFrom: string | null
  seasonOver: boolean
  enabled: boolean
  customPrice: number
  finishedPrice: number
  nameExtra: number
  deliveryFee: number
  maxItems: number
  colors: ShopColorOption[]
}

export type ShopColorOption = { color: OrnamentColor; finish: CustomFinish; inStock: boolean }

export type ShopDeliveryDate = { date: string; weekday: string }

/** A stall day the customer can pick a web order up at (painting happens before it). */
export type ShopPickupDay = { date: string; weekday: string; marketName: string; stall?: number | null; openTime: string; closeTime: string }

export type ShopItemInput = {
  kind: 'custom'
  withName: boolean
  color?: OrnamentColor
  finish?: CustomFinish
  petName?: string
  backName?: string
  note?: string
  photos: Photo[]
}

export type ShopCheckoutInput = {
  customerName: string
  email: string
  phone: string
  /** Required for Vienna delivery; omitted for market pickup. */
  address?: Address
  deliveryDate: string
  deliveryKind?: DeliveryKind
  /** Arrival time at the stall ('HH:mm'), market pickup only. */
  pickupTime?: string
  acceptTerms: boolean
  items: ShopItemInput[]
}

export type ShopCheckoutResult = { orderCode: string; formToken: string; checkoutUrl: string }
