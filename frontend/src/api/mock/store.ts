import type {
  Address,
  AgendaDay,
  AgendaDelivery,
  AgendaSlot,
  CapacityResult,
  CreateSaleInput,
  Customer,
  CustomerFormPayload,
  CustomerFormView,
  MarketDay,
  Order,
  OrderItem,
  PaymentMethod,
  PaymentState,
  ProductionStatus,
  StaffUser,
  TimeBlock,
  TrackView,
  TrackWhen,
} from '../../domain/types'
import { itemCost } from '../../lib/money'
import { hasPaintOverlap } from '../../lib/slots'
import { formatHour, formatMinutes, hoursOverlap, utcWeekday } from '../../lib/time'
import { createSeed, DEMO_NOW_HOUR, STAFF_ACCOUNTS, STORAGE_KEY, type MockState } from './seed'

let state: MockState = load()
let version = 0
const listeners = new Set<() => void>()

function load(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockState
  } catch {
    /* use seed */
  }
  return createSeed()
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota */
  }
}

function emit() {
  version += 1
  persist()
  listeners.forEach((fn) => fn())
}

export function subscribeStore(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getStoreVersion(): number {
  return version
}

export function resetStore() {
  state = createSeed()
  emit()
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

function requireOrder(id: string): Order {
  const order = state.orders.find((o) => o.id === id)
  if (!order) throw new Error(`Order ${id} not found`)
  return order
}

function todayDay(): MarketDay {
  return state.marketDays.find((d) => d.isToday) ?? state.marketDays[0]
}

function dayByDate(date: string, marketId?: string): MarketDay | undefined {
  return state.marketDays.find((d) => d.date === date && (!marketId || d.marketId === marketId))
}

function blocksForDay(dayId: string): TimeBlock[] {
  return state.blocks
    .filter((b) => b.marketDayId === dayId)
    .slice()
    .sort((a, b) => a.startHour - b.startHour)
}

export function findFreeSlot(
  date: string,
  durationHours: number,
  afterHour?: number,
  marketId?: string,
  extraBusy: { startHour: number; endHour: number }[] = [],
): CapacityResult {
  const day = dayByDate(date, marketId) ?? dayByDate(date)
  if (!day) {
    return { ok: false, slot: null, remainingHours: 0, message: 'No market day on that date.' }
  }
  const floor =
    day.isToday && afterHour == null
      ? Math.max(day.openHour, DEMO_NOW_HOUR)
      : Math.max(day.openHour, afterHour ?? day.openHour)
  const busy = [
    ...blocksForDay(day.id),
    ...extraBusy.map((b, i) => ({
      id: `draft-${i}`,
      marketDayId: day.id,
      orderItemId: null,
      startHour: b.startHour,
      endHour: b.endHour,
      status: 'not_started' as const,
    })),
  ].sort((a, b) => a.startHour - b.startHour)
  let cursor = floor
  const tryPlace = (start: number): CapacityResult | null => {
    const end = start + durationHours
    if (end > day.closeHour + 0.001) return null
    const clash = busy.some((b) => hoursOverlap(start, end, b.startHour, b.endHour))
    if (clash) return null
    return {
      ok: true,
      slot: { date: day.date, startHour: start, endHour: end },
      remainingHours: day.closeHour - end,
      message: `Suggested ${formatHour(start)}–${formatHour(end)}`,
    }
  }

  for (const b of busy) {
    if (b.endHour <= cursor) {
      cursor = Math.max(cursor, b.endHour)
      continue
    }
    if (b.startHour - cursor >= durationHours - 0.001) {
      const placed = tryPlace(cursor)
      if (placed) return placed
    }
    cursor = Math.max(cursor, b.endHour)
  }
  const tail = tryPlace(cursor)
  if (tail) return tail

  const remaining = Math.max(0, day.closeHour - cursor)
  return {
    ok: false,
    slot: null,
    remainingHours: remaining,
    message: `No free ${formatMinutes(Math.round(durationHours * 60))} slot on this day.`,
  }
}

export function mockLogin(email: string, password: string): { token: string; user: StaffUser } {
  const row = STAFF_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password,
  )
  if (!row) throw new Error('Unknown account. Use Gaby or Andres.')
  const user: StaffUser = { id: row.id, name: row.name, email: row.email }
  const token = `mock.${user.id}.${uid('tok')}`
  sessionStorage.setItem('awg-auth-user', JSON.stringify({ token, user }))
  return { token, user }
}

export function mockMe(token: string): StaffUser {
  if (!token.startsWith('mock.')) throw new Error('Invalid session')
  const id = token.split('.')[1]
  const user = state.staff.find((s) => s.id === id)
  if (!user) throw new Error('Invalid session')
  return user
}

export function mockLogout() {
  sessionStorage.removeItem('awg-auth-user')
}

export function listMarkets() {
  return state.markets.slice()
}

export function listMarketDays(marketId?: string) {
  return state.marketDays.filter((d) => !marketId || d.marketId === marketId)
}

function slotView(block: TimeBlock): AgendaSlot {
  const item = block.orderItemId ? state.items.find((i) => i.id === block.orderItemId) ?? null : null
  const order = item ? state.orders.find((o) => o.id === item.orderId) ?? null : null
  const customer = order ? state.customers.find((c) => c.id === order.customerId) ?? null : null
  return { block, order, item, customer }
}

function marketDayDate(marketDayId?: string | null): string | null {
  if (!marketDayId) return null
  return state.marketDays.find((d) => d.id === marketDayId)?.date ?? null
}

/** Calendar date this ornament is handed off — market pickup day, or Vienna mapped to a day. */
function deliveryDateForItem(item: OrderItem): string | null {
  if (item.delivery.kind === 'market') {
    return marketDayDate(item.delivery.marketDayId)
  }
  if (item.delivery.marketDayId) return marketDayDate(item.delivery.marketDayId)
  const block = state.blocks.find((b) => b.orderItemId === item.id)
  if (block) return marketDayDate(block.marketDayId)
  return null
}

function viennaBelongsToDate(item: OrderItem, date: string): boolean {
  if (item.delivery.kind !== 'vienna') return false
  if (item.delivery.marketDayId) return marketDayDate(item.delivery.marketDayId) === date
  const weekday = utcWeekday(date)
  return weekday === 3 || weekday === 5
}

function deliveriesForDate(date: string): AgendaDelivery[] {
  const rows: AgendaDelivery[] = []
  for (const item of state.items) {
    const order = state.orders.find((o) => o.id === item.orderId)
    const customer = order ? state.customers.find((c) => c.id === order.customerId) : null
    if (!order || !customer) continue
    const title = item.petName || customer.name || 'Ornament'
    const photoUrl = item.photos[0]?.dataUrl
    if (item.delivery.kind === 'market') {
      if (deliveryDateForItem(item) !== date) continue
      const hour = item.delivery.pickupHour ?? null
      rows.push({
        orderId: order.id,
        orderCode: order.code,
        itemId: item.id,
        title,
        productionStatus: item.productionStatus,
        deliveryKind: 'market',
        pickupHour: hour,
        methodLabel: 'Market pickup',
        timeLabel: hour != null ? formatHour(hour) : null,
        photoUrl,
      })
    } else if (item.delivery.kind === 'vienna') {
      if (!viennaBelongsToDate(item, date)) continue
      rows.push({
        orderId: order.id,
        orderCode: order.code,
        itemId: item.id,
        title,
        productionStatus: item.productionStatus,
        deliveryKind: 'vienna',
        pickupHour: null,
        methodLabel: 'Vienna · Wed/Fri',
        timeLabel: null,
        photoUrl,
      })
    }
  }
  rows.sort((a, b) => {
    if (a.deliveryKind !== b.deliveryKind) return a.deliveryKind === 'market' ? -1 : 1
    return (a.pickupHour ?? 99) - (b.pickupHour ?? 99)
  })
  return rows
}

export function getAgendaDay(date: string): AgendaDay {
  const marketDay = dayByDate(date) ?? todayDay()
  const market = state.markets.find((m) => m.id === marketDay.marketId)
  if (!market) throw new Error('Market missing')
  return {
    marketDay,
    market,
    slots: blocksForDay(marketDay.id).map(slotView),
    deliveries: deliveriesForDate(marketDay.date),
  }
}

export function listAgendaDays(): AgendaDay[] {
  const marketDays = state.marketDays
    .filter((d) => d.marketId === 'mkt-rathaus')
    .sort((a, b) => a.date.localeCompare(b.date))
  return marketDays.map((md) => getAgendaDay(md.date))
}

export function moveBlock(blockId: string, date: string, startHour: number) {
  const block = state.blocks.find((b) => b.id === blockId)
  if (!block) throw new Error('Block not found')
  const duration = block.endHour - block.startHour
  const day = dayByDate(date)
  if (!day) throw new Error('No market day')
  const end = startHour + duration
  if (startHour < day.openHour || end > day.closeHour) {
    throw new Error('Outside market hours')
  }
  if (hasPaintOverlap(blocksForDay(day.id), startHour, end, blockId)) {
    throw new Error('That time overlaps another block')
  }
  block.marketDayId = day.id
  block.startHour = startHour
  block.endHour = end
  emit()
}

export function getOrder(id: string): Order {
  return requireOrder(id)
}

export function getOrderByCode(code: string): Order | null {
  const needle = code.trim().toUpperCase()
  return state.orders.find((o) => o.code.toUpperCase() === needle) ?? null
}

export function getOrderBundle(id: string) {
  const order = requireOrder(id)
  const customer = state.customers.find((c) => c.id === order.customerId)
  if (!customer) throw new Error('Customer missing')
  const items = state.items.filter((i) => i.orderId === order.id)
  const blocks = state.blocks.filter((b) => items.some((i) => i.id === b.orderItemId))
  return { order, customer, items, blocks }
}

export function createSale(input: CreateSaleInput): Order {
  const rows = input.items ?? []
  if (!rows.length) throw new Error('Add at least one ornament')

  const customer: Customer = {
    id: uid('cus'),
    name: (input.customerName ?? '').trim() || 'Walk-in',
    phone: (input.phone ?? '').trim(),
    email: (input.email ?? '').trim(),
  }
  const orderId = uid('ord')
  const code = `AWG${Math.floor(100 + Math.random() * 900)}`
  const createdItems: OrderItem[] = []
  const createdBlocks: TimeBlock[] = []

  for (const row of rows) {
    const itemId = uid('orn')
    const withName = row.kind === 'custom' && row.withName
    const cost = itemCost(row.kind, withName)
    createdItems.push({
      id: itemId,
      orderId,
      kind: row.kind,
      petName: '',
      withName,
      backName: '',
      note: '',
      cost,
      productionStatus: 'not_started',
      photos: [],
      formComplete: false,
      delivery: {
        kind: row.deliveryKind,
        marketId: row.marketId,
        marketDayId: row.marketDayId,
        pickupHour: row.pickupHour ?? null,
        address: row.address ?? null,
      },
    })

    if (row.kind === 'custom') {
      if (row.paintDate == null || row.paintStart == null || row.paintEnd == null) {
        throw new Error('Custom ornament needs a paint slot')
      }
      const md = dayByDate(row.paintDate, row.marketId) ?? dayByDate(row.paintDate)
      if (!md) throw new Error('Cannot place paint block: no market day')
      const clashExisting = blocksForDay(md.id).some((b) =>
        hoursOverlap(row.paintStart!, row.paintEnd!, b.startHour, b.endHour),
      )
      const clashNew = createdBlocks.some(
        (b) => b.marketDayId === md.id && hoursOverlap(row.paintStart!, row.paintEnd!, b.startHour, b.endHour),
      )
      if (clashExisting || clashNew) throw new Error('That hour is taken · change / place on board')
      createdBlocks.push({
        id: uid('blk'),
        marketDayId: md.id,
        orderItemId: itemId,
        startHour: row.paintStart,
        endHour: row.paintEnd,
        status: 'not_started',
      })
    }
  }

  const order: Order = {
    id: orderId,
    customerId: customer.id,
    code,
    trackToken: uid('trk'),
    formToken: uid('frm'),
    paymentState: 'unpaid',
    paymentMethod: null,
    total: createdItems.reduce((sum, item) => sum + item.cost, 0),
    createdAt: new Date().toISOString(),
    itemIds: createdItems.map((item) => item.id),
  }

  state.customers.push(customer)
  state.orders.push(order)
  state.items.push(...createdItems)
  state.blocks.push(...createdBlocks)
  emit()
  return order
}

export function setPaymentState(orderId: string, paymentState: PaymentState, method?: PaymentMethod | null) {
  const order = requireOrder(orderId)
  order.paymentState = paymentState
  if (method !== undefined) order.paymentMethod = method
  emit()
  return order
}

export function setItemStatus(orderId: string, itemId: string, status: ProductionStatus) {
  const item = state.items.find((i) => i.id === itemId && i.orderId === orderId)
  if (!item) throw new Error('Item not found')
  item.productionStatus = status
  state.blocks
    .filter((b) => b.orderItemId === itemId)
    .forEach((b) => {
      b.status = status
    })
  emit()
}

function trackStatusFor(items: OrderItem[]): TrackView['status'] {
  if (items.every((i) => i.productionStatus === 'finished')) return 'ready'
  return 'preparing'
}

export function getTrackByCode(code: string): TrackView {
  const order = getOrderByCode(code)
  if (!order) throw new Error('Order not found. Check the code.')
  const customer = state.customers.find((c) => c.id === order.customerId)
  const items = state.items.filter((i) => i.orderId === order.id)
  const first = items[0]
  const market = first?.delivery.marketId
    ? state.markets.find((m) => m.id === first.delivery.marketId)
    : undefined
  const day = first?.delivery.marketDayId
    ? state.marketDays.find((d) => d.id === first.delivery.marketDayId)
    : undefined
  const when: TrackWhen =
    first?.delivery.kind === 'vienna'
      ? { kind: 'vienna', date: null, fromHour: null, marketName: null, untilHour: null }
      : day
        ? {
            kind: 'market',
            date: day.date,
            fromHour: first.delivery.pickupHour ?? null,
            marketName: market?.name ?? null,
            untilHour: day.closeHour,
          }
        : { kind: 'unknown', date: null, fromHour: null, marketName: null, untilHour: null }

  return {
    code: order.code,
    status: trackStatusFor(items),
    customerName: customer?.name.split(' ')[0] ?? 'there',
    items: items.map((i) => ({
      petName: i.petName,
      kind: i.kind,
      productionStatus: i.productionStatus,
      withName: i.withName,
      backName: i.backName,
    })),
    delivery: first?.delivery ?? { kind: 'market' },
    when,
  }
}

export function updateViennaAddress(code: string, address: Address): TrackView {
  const order = getOrderByCode(code)
  if (!order) throw new Error('Order not found')
  state.items
    .filter((i) => i.orderId === order.id && i.delivery.kind === 'vienna')
    .forEach((i) => {
      i.delivery = { ...i.delivery, address }
    })
  emit()
  return getTrackByCode(code)
}

export function getForm(token: string): CustomerFormView {
  const order = state.orders.find((o) => o.formToken === token)
  if (!order) throw new Error('This form link is not valid.')
  const customer = state.customers.find((c) => c.id === order.customerId)
  const items = state.items.filter((i) => i.orderId === order.id)
  const item = items.find((i) => i.kind === 'custom') ?? items[0]
  if (!customer || !item) throw new Error('Form data missing')
  return {
    token,
    orderCode: order.code,
    withName: items.some((i) => i.withName),
    alreadySubmitted: items.every((i) => i.formComplete),
    customer,
    item,
  }
}

export function submitForm(token: string, payload: CustomerFormPayload): { orderCode: string } {
  const order = state.orders.find((o) => o.formToken === token)
  if (!order) throw new Error('This form link is not valid.')
  const customer = state.customers.find((c) => c.id === order.customerId)
  const items = state.items.filter((i) => i.orderId === order.id)
  const item = items.find((i) => i.kind === 'custom') ?? items[0]
  const nameItem = items.find((i) => i.withName) ?? item
  if (!customer || !item) throw new Error('Form data missing')
  customer.name = payload.customerName.trim()
  customer.phone = payload.phone.trim()
  customer.email = payload.email.trim()
  item.petName = payload.petName.trim()
  item.note = payload.note?.trim() ?? ''
  if (nameItem.withName) nameItem.backName = (payload.backName ?? '').trim().slice(0, 6).toUpperCase()
  item.photos = payload.photos
  items.forEach((row) => {
    row.formComplete = true
  })
  emit()
  return { orderCode: order.code }
}

export function checkCapacity(input: {
  date: string
  durationHours: number
  afterHour?: number
  extraBusy?: { startHour: number; endHour: number }[]
}): CapacityResult {
  return findFreeSlot(input.date, input.durationHours, input.afterHour, undefined, input.extraBusy)
}
