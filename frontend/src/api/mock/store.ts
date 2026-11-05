import { paymentSummary } from '../../lib/paymentSummary'
import type {
  InventoryItem, PaintingDay, ShopCheckoutInput,
  Address,
  AgendaDay,
  AgendaDelivery,
  AgendaSlot,
  CapacityResult,
  CreateSaleInput,
  Customer,
  CustomerFormPayload,
  CustomerFormView,
  Market,
  MarketDay,
  SaveMarketInput,
  MoveSuggestion,
  Order,
  OrderItem,
  PaymentMethod,
  PaymentEntry,
  PaymentState,
  ProductionStatus,
  StaffUser,
  TimeBlock,
  TrackView,
  TrackWhen,
} from '../../domain/types'
import { itemCost } from '../../lib/money'
import { marketPickupDates, paintDatesToTry } from '../../lib/calendar'
import { hasPaintOverlap } from '../../lib/slots'
import { formatDateLabel, formatHour, formatMinutes, hoursOverlap, utcWeekday } from '../../lib/time'
import { createSeed, DEMO_NOW_HOUR, SEED_REVISION, STAFF_ACCOUNTS, STORAGE_KEY, type MockState } from './seed'

let state: MockState = load()
let version = 0
const listeners = new Set<() => void>()

function isCurrentSeed(parsed: MockState): boolean {
  return (
    parsed.seedRevision === SEED_REVISION &&
    Array.isArray(parsed.orders)
  )
}

function load(): MockState {
  const fresh = readStored()
  if (fresh) return fresh
  return writeFresh()
}

function readStored(): MockState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MockState
    if (isCurrentSeed(parsed)) {
      for (const order of parsed.orders) { if (/^ABS10[0-7]$/.test(order.code)) order.code = `AWG0${order.code.slice(3)}`; if (order.code === 'AWG000') order.code = 'AWG0000' }
      return parsed
    }
  } catch {
    /* use seed */
  }
  return null
}

function writeFresh(): MockState {
  const fresh = createSeed()
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('awg-mock-store') && key !== STORAGE_KEY) localStorage.removeItem(key)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  } catch {
    /* quota */
  }
  return fresh
}

/** If this tab still has an older demo (ABS111…), replace it so ABS100+ resolve. */
export function ensureDemoSeed() {
  if (isCurrentSeed(state)) return
  state = writeFresh()
  version += 1
  listeners.forEach((fn) => fn())
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

ensureDemoSeed()

export function resetStore() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('awg-mock-store')) localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
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
  const rows = state.marketDays.filter((d) => d.date === date && (!marketId || d.marketId === marketId))
  if (!rows.length) {
    const home = state.markets.find(m => m.kind === 'home')
    if (!home || (marketId && marketId !== home.id)) return undefined
    return { id: `home-${date}`, marketId: home.id, date, openHour: 10, closeHour: 13, isToday: false }
  }
  if (marketId) return rows[0]
  const rank = (day: MarketDay) => (state.markets.find((m) => m.id === day.marketId)?.kind === 'market' ? 0 : 1)
  return rows.slice().sort((a, b) => rank(a) - rank(b))[0]
}

function blocksForDay(dayId: string): TimeBlock[] {
  return state.blocks
    .filter((b) => b.marketDayId === dayId)
    .slice()
    .sort((a, b) => a.startHour - b.startHour)
}

export function listInventory(): InventoryItem[] {
  const rows = state.inventory ??= []
  for (const color of ['red', 'green', 'beige'] as const) for (const finish of ['shiny', 'matte'] as const) {
    if (!rows.some(row => row.kind === 'custom' && row.color === color && row.finish === finish)) {
      const legacy = finish === 'shiny' ? rows.find(row => row.kind === 'custom' && row.color === color && !row.finish) : undefined
      if (legacy) { legacy.finish = finish; legacy.id = `custom-${color}-${finish}` }
      else rows.push({ id: `custom-${color}-${finish}`, kind: 'custom', color, finish, quantity: color === 'red' ? 3 : 0 })
    }
  }
  for (const row of rows) if (row.kind === 'custom' && !row.finish) row.finish = 'shiny'
  if (!rows.some(row => row.kind === 'finished')) rows.push({ id: 'finished', kind: 'finished', color: null, finish: null, quantity: 10 })
  return rows

}
export function updateInventory(id: string, quantity: number, expectedQuantity?: number): InventoryItem {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10000) throw new Error('Quantity must be between 0 and 10000.')
  const item = listInventory().find(row => row.id === id); if (!item) throw new Error('Stock item not found.')
  if (expectedQuantity != null && item.quantity !== expectedQuantity) throw Object.assign(new Error('Stock changed. Reload and try again.'), { code: 'STOCK_CHANGED', status: 409 })
  item.quantity = quantity; emit(); return { ...item }
}
export function paintingDay(date: string): PaintingDay {
  const settings = state.paintingDays?.[date] ?? { open: true, maxPaintings: 2 }
  const ids = new Set(state.marketDays.filter(day => day.date === date).map(day => day.id))
  const booked = state.blocks.filter(block => ids.has(block.marketDayId) && state.items.some(item => item.id === block.orderItemId && item.kind === 'custom')).length
  return { date, ...settings, booked }
}
export function updatePaintingDay(date: string, open: boolean, maxPaintings: number): PaintingDay {
  if (!Number.isInteger(maxPaintings) || maxPaintings < 0 || maxPaintings > 10) throw new Error('Maximum must be between 0 and 10.')
  state.paintingDays ??= {}; state.paintingDays[date] = { open, maxPaintings }; emit(); return paintingDay(date)
}
export function joinWaitlist(email: string) { const token = crypto.randomUUID(); (state.waitlistTokens ??= {})[token] = { email: email.toLowerCase(), confirmed: false }; emit() }
export function confirmWaitlist(token: string) { const entry = state.waitlistTokens?.[token]; if (!entry) throw Object.assign(new Error('Unknown token'), { status: 404 }); entry.confirmed = true; state.waitlist ??= []; if (!state.waitlist.includes(entry.email)) state.waitlist.push(entry.email); emit() }
export function unsubscribeWaitlist(token: string) { const entry = state.waitlistTokens?.[token]; if (entry) { state.waitlist = (state.waitlist ?? []).filter(email => email !== entry.email); delete state.waitlistTokens![token]; emit() } }
export function makeOrderCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code: string
  do { code = 'AWG' + Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('') } while (state.orders.some(order => order.code === code))
  return code
}

export function findFreeSlot(
  date: string,
  durationHours: number,
  afterHour?: number,
  marketId?: string,
  extraBusy: { startHour: number; endHour: number }[] = [],
  ignoreBlockId?: string,
  beforeHour?: number,
): CapacityResult {
  const setting = paintingDay(date)
  const ignored = ignoreBlockId && state.blocks.some(block => block.id === ignoreBlockId && state.marketDays.some(day => day.id === block.marketDayId && day.date === date)) ? 1 : 0
  if (!setting.open || setting.booked - ignored + extraBusy.length >= setting.maxPaintings) return { ok: false, slot: null, remainingHours: 0, message: 'Painting day is closed or full.' }
  const day = dayByDate(date, marketId) ?? dayByDate(date)
  if (!day) {
    return { ok: false, slot: null, remainingHours: 0, message: 'No market day on that date.' }
  }
  const floor =
    day.isToday && afterHour == null
      ? Math.max(day.openHour, DEMO_NOW_HOUR)
      : Math.max(day.openHour, afterHour ?? day.openHour)
  const busy = [
    ...blocksForDay(day.id).filter((block) => block.id !== ignoreBlockId),
    ...extraBusy.map((b, i) => ({
      id: `draft-${i}`,
      marketDayId: day.id,
      orderItemId: null,
      startHour: b.startHour,
      endHour: b.endHour,
      status: 'not_started' as const,
    })),
  ].sort((a, b) => a.startHour - b.startHour)
  const ceiling = Math.min(day.closeHour, beforeHour ?? day.closeHour)
  let cursor = floor
  const tryPlace = (start: number): CapacityResult | null => {
    const end = start + durationHours
    if (end > ceiling + 0.001) return null
    const clash = busy.some((b) => hoursOverlap(start, end, b.startHour, b.endHour))
    if (clash) return null
    return {
      ok: true,
      slot: { date: day.date, startHour: start, endHour: end },
      remainingHours: ceiling - end,
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

  const remaining = Math.max(0, ceiling - cursor)
  return {
    ok: false,
    slot: null,
    remainingHours: remaining,
    message: `No free ${formatMinutes(Math.round(durationHours * 60))} slot on this day.`,
  }
}

const PASSWORDS_KEY = 'awg-mock-passwords'

function mockPasswords(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PASSWORDS_KEY) || '{}') as Record<string, string> } catch { return {} }
}

export function mockChangePassword(currentPassword: string, newPassword: string) {
  const token = localStorage.getItem('awg-staff-token')
  const account = STAFF_ACCOUNTS.find((entry) => token?.startsWith(`mock.${entry.id}.`))
  if (!account || (mockPasswords()[account.id] ?? account.password) !== currentPassword) throw new Error('Current password is wrong.')
  if (newPassword.length < 10) throw new Error('Use at least 10 characters.')
  localStorage.setItem(PASSWORDS_KEY, JSON.stringify({ ...mockPasswords(), [account.id]: newPassword }))
}

export function cancelOrder(id: string) {
  const order = requireOrder(id)
  if (order.handedOver) throw new Error('Cannot cancel an order that has been handed over.')
  const cancelled = state.items.filter(item => item.orderId === id)
  for (const item of cancelled) { const stock = listInventory().find(row => row.kind === item.kind && (item.kind === 'finished' || (row.color === item.color && row.finish === (item.finish ?? 'shiny')))); if (stock) stock.quantity++ }
  const itemIds = new Set(cancelled.map(item => item.id))
  state.blocks = state.blocks.filter((block) => !block.orderItemId || !itemIds.has(block.orderItemId))
  state.items = state.items.filter((item) => item.orderId !== id)
  state.orders = state.orders.filter((entry) => entry.id !== id)
  emit()
}

export function createMockCheckout(input: ShopCheckoutInput) {
  const inventory = listInventory()
  const counts = new Map<string, number>()
  for (const item of input.items) {
    if (!item.finish || !item.color || !['red', 'green', 'beige'].includes(item.color)) throw Object.assign(new Error('Choose a valid colour and finish.'), { code: 'VALIDATION', field: `items[${input.items.indexOf(item)}].${!item.finish ? 'finish' : 'color'}` })
    const id = `custom-${item.color}-${item.finish}`
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  for (const [id, count] of counts) {
    if ((inventory.find(row => row.id === id)?.quantity ?? 0) < count) throw Object.assign(new Error('Out of stock.'), { code: 'OUT_OF_STOCK' })
  }
  const customer: Customer = { id: uid('cus'), name: input.customerName, email: input.email, phone: input.phone }
  const orderId = uid('ord')
  const code = makeOrderCode()
  const token = uid('frm')
  const items: OrderItem[] = input.items.map(item => ({
    id: uid('orn'), orderId, kind: 'custom', petName: item.petName ?? '', withName: item.withName,
    color: item.color ?? 'red', finish: item.finish, backName: item.backName ?? '', note: item.note ?? '',
    cost: itemCost('custom', item.withName), productionStatus: 'not_started', photos: item.photos,
    formComplete: true, delivery: { kind: 'vienna', address: input.address, deliveryDate: input.deliveryDate },
  }))
  const order: Order = { id: orderId, customerId: customer.id, code, trackToken: uid('trk'), formToken: token,
    paymentState: 'paid', paymentMethod: 'card', amountPaid: items.reduce((sum, item) => sum + item.cost, 0), total: items.reduce((sum, item) => sum + item.cost, 0),
    createdAt: new Date().toISOString(), itemIds: items.map(item => item.id), handedOver: false, paymentEntries: [] }
  for (const [id, count] of counts) inventory.find(row => row.id === id)!.quantity -= count
  state.customers.push(customer); state.orders.push(order); state.items.push(...items)
  // The mock checkout redirects directly to success, so it simulates confirmed payment.
  emit()
  try { localStorage.setItem(`awg-form-token:${code}`, token) } catch { /* storage unavailable */ }
  return { orderCode: code, formToken: token, checkoutUrl: `/buy/thanks?code=${code}` }
}

export function abandonMockCheckout(code: string) {
  const token = state.pendingCheckouts?.[code]
  let suppliedToken: string | null = null
  try { suppliedToken = localStorage.getItem(`awg-form-token:${code.toUpperCase()}`) } catch { /* storage unavailable */ }
  if (!token || suppliedToken !== token) return
  const order = state.orders.find(row => row.code === code && row.formToken === token)
  if (!token || !order || order.paymentState !== 'unpaid') return
  delete state.pendingCheckouts![code]
  state.customers = state.customers.filter(row => row.id !== order.customerId)
  cancelOrder(order.id)
}

export function mockLogin(email: string, password: string): { token: string; user: StaffUser } {
  const row = STAFF_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase() && (mockPasswords()[a.id] ?? a.password) === password,
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

function dayIsUsed(dayId: string): boolean {
  return (
    state.items.some((item) => item.delivery.marketDayId === dayId) ||
    state.blocks.some((block) => block.marketDayId === dayId)
  )
}

function hoursConflict(dayId: string, date: string, openHour: number, closeHour: number): string | null {
  const label = formatDateLabel(date)
  const span = `${formatHour(openHour)}–${formatHour(closeHour)}`
  for (const block of state.blocks) {
    if (block.marketDayId !== dayId) continue
    if (block.startHour < openHour || block.endHour > closeHour) {
      return `${label}: a paint session sits outside ${span}`
    }
  }
  for (const item of state.items) {
    if (item.delivery.marketDayId !== dayId) continue
    const hour = item.delivery.pickupHour
    if (hour == null) continue
    if (hour < openHour || hour >= closeHour) {
      return `${label}: a pickup at ${formatHour(hour)} sits outside ${span}`
    }
  }
  return null
}

export function saveMarket(input: SaveMarketInput): { market: Market; days: MarketDay[] } {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  if (!input.startDate || !input.finishDate) throw new Error('Season start and end are required')
  if (input.finishDate < input.startDate) throw new Error('Season end must be on or after the start')
  if (!Number.isFinite(input.totalCost) || input.totalCost < 0) {
    throw new Error('Season cost must be zero or more')
  }
  if (!Number.isInteger(input.stall) || input.stall < 1) {
    throw new Error('Stall number must be a whole number of 1 or more')
  }

  const allowed = new Set(marketPickupDates(input.startDate, input.finishDate))
  if (!allowed.size) throw new Error('No Friday, Saturday, or Sunday in this range')

  const seen = new Set<string>()
  for (const day of input.days) {
    if (seen.has(day.date)) throw new Error(`${formatDateLabel(day.date)} is listed twice`)
    seen.add(day.date)
    if (!allowed.has(day.date)) {
      throw new Error(`${formatDateLabel(day.date)} is not a Friday, Saturday, or Sunday in this season`)
    }
    if (!Number.isFinite(day.openHour) || !Number.isFinite(day.closeHour) || !(day.closeHour > day.openHour)) {
      throw new Error(`${formatDateLabel(day.date)}: close must be after open`)
    }
  }

  const existing = input.id ? state.markets.find((row) => row.id === input.id) : undefined
  if (input.id && (!existing || existing.kind !== 'market')) throw new Error('Market not found')

  for (const day of input.days) {
    const other = state.marketDays.find((row) => {
      if (row.date !== day.date) return false
      if (existing && row.marketId === existing.id) return false
      return state.markets.find((market) => market.id === row.marketId)?.kind === 'market'
    })
    if (!other) continue
    const otherName = state.markets.find((market) => market.id === other.marketId)?.name ?? 'another market'
    throw new Error(`${formatDateLabel(day.date)} already belongs to ${otherName}`)
  }

  if (existing) {
    for (const day of state.marketDays.filter((row) => row.marketId === existing.id)) {
      if (!seen.has(day.date)) {
        if (dayIsUsed(day.id)) {
          throw new Error(`${formatDateLabel(day.date)} has orders and cannot leave the season`)
        }
        continue
      }
      const row = input.days.find((item) => item.date === day.date)
      if (!row) continue
      const conflict = hoursConflict(day.id, day.date, row.openHour, row.closeHour)
      if (conflict) throw new Error(conflict)
    }
  }

  const todayDate = state.marketDays.find((day) => day.isToday)?.date
  const market: Market = existing ?? {
    id: uid('mkt'),
    name,
    kind: 'market',
    totalCost: input.totalCost,
    startDate: input.startDate,
    finishDate: input.finishDate,
    stall: input.stall,
  }
  if (!existing) state.markets.push(market)
  market.name = name
  market.totalCost = input.totalCost
  market.startDate = input.startDate
  market.finishDate = input.finishDate
  market.stall = input.stall

  state.marketDays = state.marketDays.filter((day) => day.marketId !== market.id || seen.has(day.date))
  for (const row of input.days) {
    const current = state.marketDays.find((day) => day.marketId === market.id && day.date === row.date)
    if (current) {
      current.openHour = row.openHour
      current.closeHour = row.closeHour
      continue
    }
    state.marketDays.push({
      id: uid('md'),
      marketId: market.id,
      date: row.date,
      openHour: row.openHour,
      closeHour: row.closeHour,
      isToday: row.date === todayDate,
    })
  }
  state.marketDays.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  emit()
  return {
    market,
    days: state.marketDays.filter((day) => day.marketId === market.id),
  }
}

export function deleteMarketDay(id: string): void {
  const day = state.marketDays.find((row) => row.id === id)
  if (!day) throw new Error('Market day not found')
  const market = state.markets.find((row) => row.id === day.marketId)
  if (!market || market.kind !== 'market') throw new Error('This day cannot be deleted here')
  if (dayIsUsed(day.id)) throw new Error(`${formatDateLabel(day.date)} has orders and cannot be deleted`)
  state.marketDays = state.marketDays.filter((row) => row.id !== id)
  emit()
}

export function deleteMarket(id: string): void {
  const market = state.markets.find((row) => row.id === id)
  if (!market || market.kind !== 'market') throw new Error('Market not found')
  const used = state.marketDays.find((day) => day.marketId === id && dayIsUsed(day.id))
  if (used || state.items.some((item) => item.delivery.marketId === id)) {
    throw new Error(
      used
        ? `${formatDateLabel(used.date)} has orders. This market cannot be deleted`
        : 'This market has orders and cannot be deleted',
    )
  }
  state.marketDays = state.marketDays.filter((day) => day.marketId !== id)
  state.markets = state.markets.filter((row) => row.id !== id)
  emit()
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

function addressLabel(address?: { line1: string; line2?: string; city: string; postalCode: string } | null): string | null {
  if (!address?.line1) return null
  const street = [address.line1, address.line2].filter(Boolean).join(', ')
  const city = [address.postalCode, address.city].filter(Boolean).join(' ')
  return [street, city].filter(Boolean).join(' · ')
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
        customerName: customer.name,
        color: item.color,
        finish: item.finish,
        backName: item.backName,
        title,
        productionStatus: item.productionStatus,
        handedOver: Boolean(order.handedOver),
        deliveryKind: 'market',
        pickupHour: hour,
        methodLabel: 'Market pickup',
        timeLabel: hour != null ? formatHour(hour) : null,
        phone: customer.phone,
        addressLabel: null,
        photoUrl,
      })
    } else if (item.delivery.kind === 'vienna') {
      if (!viennaBelongsToDate(item, date)) continue
      rows.push({
        orderId: order.id,
        orderCode: order.code,
        itemId: item.id,
        customerName: customer.name,
        color: item.color,
        finish: item.finish,
        backName: item.backName,
        title,
        productionStatus: item.productionStatus,
        handedOver: Boolean(order.handedOver),
        deliveryKind: 'vienna',
        pickupHour: null,
        methodLabel: 'Vienna · Wed/Fri',
        timeLabel: null,
        phone: customer.phone,
        addressLabel: addressLabel(item.delivery.address),
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
  const dates = [...new Set(state.marketDays.map((d) => d.date))].sort()
  return dates.map((date) => getAgendaDay(date))
}

export function moveBlock(blockId: string, date: string, startHour: number) {
  const block = state.blocks.find((b) => b.id === blockId)
  if (!block) throw new Error('Block not found')
  if (block.status !== 'not_started') throw new Error('Only not started sessions can be moved')
  const item = block.orderItemId ? state.items.find((row) => row.id === block.orderItemId) : undefined
  if (!item) throw new Error('This session is not linked to an order')
  if (item.productionStatus !== 'not_started') throw new Error('Only not started sessions can be moved')
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
  if (day.isToday && startHour < DEMO_NOW_HOUR) {
    throw new Error('That time has already passed')
  }
  const deliveryDay = item.delivery.marketDayId
    ? state.marketDays.find((row) => row.id === item.delivery.marketDayId)
    : undefined
  if (!deliveryDay || day.date > deliveryDay.date) {
    throw new Error('Painting must stay before pickup')
  }
  if (item.delivery.kind === 'vienna' && day.date >= deliveryDay.date) {
    throw new Error('Vienna orders must be painted before the handoff day')
  }
  if (
    item.delivery.kind === 'market' &&
    day.date === deliveryDay.date &&
    item.delivery.pickupHour != null &&
    end > item.delivery.pickupHour
  ) {
    throw new Error(`This session must finish before pickup at ${formatHour(item.delivery.pickupHour)}`)
  }
  if (!state.marketDays.some(row => row.id === day.id)) state.marketDays.push(day)
  block.marketDayId = day.id
  block.startHour = startHour
  block.endHour = end
  emit()
}

export function getOrder(id: string): Order {
  return requireOrder(id)
}

export function getOrderByCode(code: string): Order | null {
  ensureDemoSeed()
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
  const move = input.plannedMove
  const moving = move ? state.blocks.find((block) => block.id === move.blockId) : undefined
  const destination = move ? dayByDate(move.to.date) : undefined
  if (move) {
    const movedIntoSlot = rows.find((row) => row.paintDate === move.freedSlot.date && row.paintStart === move.freedSlot.startHour)
    const deliveryDay = movedIntoSlot?.marketDayId ? state.marketDays.find((day) => day.id === movedIntoSlot.marketDayId) : undefined
    const beforeHour = movedIntoSlot?.deliveryKind === 'market' && deliveryDay?.date === move.freedSlot.date
      ? movedIntoSlot.pickupHour ?? undefined
      : undefined
    const fresh = findMoveSuggestion({
      date: move.from.date,
      durationHours: move.freedSlot.endHour - move.freedSlot.startHour,
      handoffDate: deliveryDay?.date ?? move.freedSlot.date,
      beforeHour,
    })
    if (!moving || !destination || JSON.stringify(fresh) !== JSON.stringify(move)) {
      throw new Error('Pickup or agenda changed. Recalculate the painting plan.')
    }
  }

  const customer: Customer = {
    id: uid('cus'),
    name: (input.customerName ?? '').trim() || 'Walk-in',
    phone: (input.phone ?? '').trim(),
    email: (input.email ?? '').trim(),
  }
  const orderId = uid('ord')
  const code = makeOrderCode()
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
      color: row.color ?? 'red',
      finish: row.kind === 'custom' ? row.finish ?? 'shiny' : undefined,
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
      if (row.deliveryKind === 'market' && row.pickupHour == null) {
        throw new Error('Choose a pickup hour before planning the painting time')
      }
      if (row.paintDate == null || row.paintStart == null || row.paintEnd == null) {
        throw new Error('Custom ornament needs a paint slot')
      }
      const md = dayByDate(row.paintDate, row.marketId) ?? dayByDate(row.paintDate)
      if (!md) throw new Error('Cannot place paint block: no market day')
      const clashExisting = blocksForDay(md.id).some((b) =>
        b.id !== moving?.id && hoursOverlap(row.paintStart!, row.paintEnd!, b.startHour, b.endHour),
      )
      const deliveryDay = state.marketDays.find((day) => day.id === row.marketDayId)
      if (row.paintEnd <= row.paintStart || row.paintStart < md.openHour || row.paintEnd > md.closeHour ||
        (md.isToday && row.paintStart < DEMO_NOW_HOUR) ||
        !deliveryDay || row.paintDate > deliveryDay.date ||
        (row.paintDate === deliveryDay.date && row.deliveryKind === 'market' && row.pickupHour != null && row.paintEnd > row.pickupHour) ||
        (move && destination?.id === md.id && hoursOverlap(row.paintStart, row.paintEnd, move.to.startHour, move.to.endHour))) {
        throw new Error('Choose a paint time before pickup, within working hours.')
      }
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

  const stockCounts = new Map<InventoryItem, number>()
  for (const item of createdItems) {
    const stock = listInventory().find(row => row.kind === item.kind && (item.kind === 'finished' || (row.color === item.color && row.finish === item.finish)))
    if (!stock) throw Object.assign(new Error('Out of stock.'), { code: 'OUT_OF_STOCK' })
    stockCounts.set(stock, (stockCounts.get(stock) ?? 0) + 1)
  }
  for (const [stock, count] of stockCounts) if (stock.quantity < count) throw Object.assign(new Error('Out of stock.'), { code: 'OUT_OF_STOCK' })
  for (const [stock, count] of stockCounts) stock.quantity -= count

  for (const block of createdBlocks) {
    if (!state.marketDays.some(day => day.id === block.marketDayId)) {
      const date = block.marketDayId.replace(/^home-/, ''); const day = dayByDate(date); if (day) state.marketDays.push(day)
    }
  }
  if (destination && !state.marketDays.some(day => day.id === destination.id)) state.marketDays.push(destination)
  const order: Order = {
    id: orderId,
    customerId: customer.id,
    code,
    trackToken: uid('trk'),
    formToken: uid('frm'),
    paymentState: 'unpaid',
    paymentMethod: null,
    amountPaid: 0,
    total: createdItems.reduce((sum, item) => sum + item.cost, 0),
    createdAt: new Date().toISOString(),
    itemIds: createdItems.map((item) => item.id),
    handedOver: false,
    paymentEntries: [],
  }

  if (moving && destination && move) {
    moving.marketDayId = destination.id
    moving.startHour = move.to.startHour
    moving.endHour = move.to.endHour
  }
  state.customers.push(customer)
  state.orders.push(order)
  state.items.push(...createdItems)
  state.blocks.push(...createdBlocks)
  emit()
  return order
}

export function setPaymentState(orderId: string, paymentState: PaymentState, method?: PaymentMethod | null, amountPaid?: number) {
  const order = requireOrder(orderId)
  const amount = paymentState === 'paid' ? order.total : paymentState === 'unpaid' ? 0 : amountPaid ?? Math.round(order.total * 50) / 100
  if (!Number.isFinite(amount) || (paymentState === 'deposit' && (amount <= 0 || amount >= order.total))) throw new Error('Deposit must be greater than zero and less than the total.')
  order.amountPaid = amount
  order.paymentState = paymentState
  if (method !== undefined) order.paymentMethod = method
  emit()
  return order
}

export function recordPayment(orderId: string, amount: number, method: PaymentMethod): { order: Order; entry: PaymentEntry } {
  const order = requireOrder(orderId)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a payment amount')
  const paid = Math.round(amount * 100) / 100
  const entries = order.paymentEntries ?? []
  const totalPaid = paymentSummary(order).paid
  if (totalPaid + paid > order.total + 0.001) throw new Error('Payment is greater than the remaining balance')
  const entry: PaymentEntry = {
    id: uid('pay'),
    amount: paid,
    method,
    recordedAt: new Date().toISOString(),
  }
  if (!entries.length && totalPaid > 0) order.paymentOpeningBalance = totalPaid
  order.paymentEntries = [...entries, entry]
  const nextPaid = totalPaid + paid
  order.amountPaid = nextPaid
  order.paymentState = nextPaid >= order.total - 0.001 ? 'paid' : 'deposit'
  order.paymentMethod = method
  emit()
  return { order, entry }
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
  const order = state.orders.find((o) => o.id === orderId)
  const siblings = state.items.filter((i) => i.orderId === orderId)
  if (order && order.handedOver && !siblings.every((i) => i.productionStatus === 'finished')) {
    order.handedOver = false
  }
  emit()
}

export function setHandedOver(orderId: string, handedOver: boolean) {
  const order = requireOrder(orderId)
  const items = state.items.filter((i) => i.orderId === orderId)
  if (handedOver && !items.every((i) => i.productionStatus === 'finished')) {
    throw new Error('Finish all ornaments before marking handed over')
  }
  order.handedOver = handedOver
  order.handedOverAt = handedOver ? new Date().toISOString() : undefined
  emit()
}

function trackStatusFor(order: Order, items: OrderItem[]): TrackView['status'] {
  if (order.handedOver) return 'delivered'
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
      ? { kind: 'vienna', date: first.delivery.deliveryDate ?? null, fromHour: null, marketName: null, untilHour: null }
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
    total: order.total,
    paymentState: order.paymentState,
    code: order.code,
    status: trackStatusFor(order, items),
    customerName: customer?.name.split(' ')[0] ?? 'there',
    items: items.map((i) => ({
      color: i.color,
      finish: i.finish,
      cost: i.cost,
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
  if (order.handedOver && order.handedOverAt && Date.now() - Date.parse(order.handedOverAt) >= 30 * 86400000) throw Object.assign(new Error('Form expired.'), { code: 'FORM_EXPIRED', status: 404 })
  const customer = state.customers.find((c) => c.id === order.customerId)
  const items = state.items.filter((i) => i.orderId === order.id)
  const item = items.find((i) => i.kind === 'custom') ?? items[0]
  if (!customer || !item) throw new Error('Form data missing')
  return {
    token,
    orderCode: order.code,
    total: order.total,
    paymentState: order.paymentState,
    items,
    handoffs: items.map((row) => {
      const day = state.marketDays.find((entry) => entry.id === row.delivery.marketDayId)
      const market = state.markets.find((entry) => entry.id === row.delivery.marketId)
      return {
        kind: row.delivery.kind === 'vienna' ? 'vienna' : day ? 'market' : 'unknown',
        date: day?.date ?? null,
        fromHour: row.delivery.pickupHour ?? null,
        marketName: market?.name ?? null,
        untilHour: day?.closeHour ?? null,
      }
    }),
    needsAddress: items.some((i) => i.delivery.kind === 'vienna'),
    address: items.find((i) => i.delivery.kind === 'vienna')?.delivery.address ?? null,
    editable: !order.handedOver && items.filter(i => i.kind === 'custom').every((i) => i.productionStatus === 'not_started'),
    withName: items.some((i) => i.withName),
    alreadySubmitted: items.every((i) => i.formComplete),
    customer,
    item,
  }
}

export function submitForm(token: string, payload: CustomerFormPayload): { orderCode: string } {
  const order = state.orders.find((o) => o.formToken === token)
  if (!order) throw new Error('This form link is not valid.')
  if (order.handedOver && order.handedOverAt && Date.now() - Date.parse(order.handedOverAt) >= 30 * 86400000) throw Object.assign(new Error('Form expired.'), { code: 'FORM_EXPIRED', status: 404 })
  const customer = state.customers.find((c) => c.id === order.customerId)
  const items = state.items.filter((i) => i.orderId === order.id)
  const item = items.find((i) => i.kind === 'custom') ?? items[0]
  if (!customer || !item) throw new Error('Form data missing')
  if (!getForm(token).editable) throw Object.assign(new Error('Form is locked.'), { code: 'FORM_LOCKED', status: 409 })
  if (getForm(token).needsAddress) {
    if (!payload.address?.line1 || !payload.address.city) throw Object.assign(new Error('Address required.'), { code: 'VALIDATION', field: 'address' })
    if (!/^1(0[1-9]|1[0-9]|2[0-3])0$/.test(payload.address.postalCode)) throw Object.assign(new Error('Invalid postal code.'), { code: 'POSTAL_OUTSIDE_VIENNA', field: 'address.postalCode' })
    items.filter(i => i.delivery.kind === 'vienna').forEach(i => { i.delivery.address = payload.address })
  }
  customer.name = payload.customerName.trim()
  customer.phone = payload.phone.trim()
  customer.email = payload.email.trim()
  for (const incoming of payload.items) {
    const row = items.find((entry) => entry.id === incoming.orderItemId)
    if (!row) continue
    row.petName = incoming.petName.trim()
    row.note = incoming.note?.trim() ?? ''
    if (row.withName) row.backName = (incoming.backName ?? '').trim().slice(0, 6).toUpperCase()
    row.photos = incoming.photos
  }
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
  beforeHour?: number
  extraBusy?: { startHour: number; endHour: number }[]
}): CapacityResult {
  return findFreeSlot(input.date, input.durationHours, input.afterHour, undefined, input.extraBusy, undefined, input.beforeHour)
}

export function findMoveSuggestion(input: {
  date: string
  durationHours: number
  handoffDate: string
  beforeHour?: number
}): MoveSuggestion | null {
  const targetDay = dayByDate(input.date)
  if (!paintingDay(input.date).open || paintingDay(input.date).booked > paintingDay(input.date).maxPaintings) return null
  if (!targetDay || input.date > input.handoffDate || input.date < todayDay().date || input.durationHours <= 0) return null

  for (const block of blocksForDay(targetDay.id)) {
    const duration = block.endHour - block.startHour
    if (duration + 0.001 < input.durationHours || !block.orderItemId) continue
    if (input.beforeHour != null && block.startHour + input.durationHours > input.beforeHour + 0.001) continue
    if (block.status !== 'not_started' || (targetDay.isToday && block.startHour < DEMO_NOW_HOUR)) continue
    const item = state.items.find((row) => row.id === block.orderItemId)
    const order = item ? state.orders.find((row) => row.id === item.orderId) : undefined
    const handoff = item?.delivery.marketDayId
      ? state.marketDays.find((day) => day.id === item.delivery.marketDayId)?.date
      : undefined
    if (!item || !order || !handoff || item.productionStatus !== 'not_started') continue

    const alternativeDates = paintDatesToTry(handoff, todayDay().date)
    for (const date of alternativeDates) {
      const freedSlot = {
        date: targetDay.date,
        startHour: block.startHour,
        endHour: block.startHour + input.durationHours,
      }
      const alternative = findFreeSlot(
        date,
        duration,
        undefined,
        undefined,
        date === targetDay.date ? [{ startHour: freedSlot.startHour, endHour: freedSlot.endHour }] : [],
        date === targetDay.date ? block.id : undefined,
      )
      if (!alternative.ok || !alternative.slot) continue
      if (date === handoff && (item.delivery.kind === 'vienna' || item.delivery.pickupHour == null || alternative.slot.endHour > item.delivery.pickupHour)) continue
      return {
        blockId: block.id,
        orderCode: order.code,
        title: item.petName || 'Walk-in order',
        from: { date: targetDay.date, startHour: block.startHour, endHour: block.endHour },
        to: alternative.slot,
        freedSlot,
      }
    }
  }
  return null
}
