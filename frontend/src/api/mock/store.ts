import { paymentSummary } from '../../lib/paymentSummary'
import { filterSales } from '../../lib/sales'
import { readFormToken, rememberFormToken } from '../formTokens'
import type {
  Prices, PricesUpdate,
  InventoryItem, OrnamentSize, PaintingDay, ShopCheckoutInput, ShopItemInput, ShippingQuote,
  MakeRoomInput, MakeRoomMove, MakeRoomResult, PostCollectionDay,
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
import { DEFAULT_BACK_NAME_MAX, paintedNameValid } from '../../lib/paintedName'
import {
  AUSTRIAN_POSTAL_REGEX,
  isCollectionOn,
  isWorkingDay,
  type PostShippingConfig,
  planPostShipping,
  postTrackingUrl,
  shippingWindowAfter,
  TRACKING_NUMBER_REGEX,
} from '../../lib/postShipping'
import { mockPricing, validatePriceInput } from './pricing'
import { marketPickupDates, paintDatesToTry } from '../../lib/calendar'
import { bookedPaintRange, hasPaintOverlap, paintElapsedUntil } from '../../lib/slots'
import { addUtcDays, formatDateLabel, formatHour, formatMinutes, hoursOverlap, utcWeekday } from '../../lib/time'
import { createSeed, DEMO_NOW_HOUR, SEED_REVISION, STAFF_ACCOUNTS, STORAGE_KEY, type MockState } from './seed'
import { uid as newUuid } from '../../lib/uid'
import { returnMarketPieces, sellMarketPieces } from './marketStock'

/** Prices live beside the seed data; absent in older saved demo data, which means the defaults at revision 0. */
let state: MockState & {
  prices?: Prices
  /** Mirrors `post_collection_day`: per-date Post collection overrides, empty by default. */
  postCollectionOverrides?: Record<string, boolean>
} = load()
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
      for (const item of parsed.items) item.marketOrnamentId ??= null
      if (!parsed.openingMarketsSeeded) {
        addOpeningMarkets(parsed)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)) } catch { /* quota */ }
      }
      return parsed
    }
  } catch {
    /* use seed */
  }
  return null
}

function addOpeningMarkets(previous: MockState) {
  const seed = createSeed()
  for (const id of ['mkt-rathaus', 'mkt-spittelberg']) {
    const market = previous.markets.find(row => row.id === id)
    const original = seed.markets.find(row => row.id === id)!
    const configured = previous.marketDays.some(day => day.marketId === id)
    if (!market) continue
    if (id === 'mkt-spittelberg' && (!configured && market.startDate === null)) {
      Object.assign(market, original)
    } else if (id === 'mkt-rathaus' && market.startDate === '2026-11-27' && market.finishDate === '2026-12-06') {
      market.startDate = original.startDate
    } else {
      continue
    }
    previous.marketDays.push(...seed.marketDays.filter(day => day.marketId === id && day.date >= market.startDate!
      && day.date <= '2026-11-29' && !previous.marketDays.some(existing => existing.marketId === id && existing.date === day.date)))
  }
  previous.openingMarketsSeeded = true
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
    // Phone photos overflow the localStorage quota. Keep the orders without their image data,
    // otherwise a full page load (the checkout redirect) would lose the order just placed.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, items: state.items.map(item => ({ ...item, photos: item.photos.map(photo => ({ ...photo, dataUrl: '' })) })) }))
    } catch {
      /* quota */
    }
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

// The customer can submit the QR form in another tab while the staff screen stays open.
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return
  const stored = readStored()
  if (!stored) return
  state = stored
  version += 1
  listeners.forEach(listener => listener())
})

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

function stallSort(a: MarketDay, b: MarketDay, markets = state.markets): number {
  if (a.openHour !== b.openHour) return a.openHour - b.openHour
  const nameA = markets.find(m => m.id === a.marketId)?.name ?? ''
  const nameB = markets.find(m => m.id === b.marketId)?.name ?? ''
  return nameA.localeCompare(nameB) || a.id.localeCompare(b.id)
}

export function marketDaysOn(date: string): MarketDay[] {
  return state.marketDays.filter(day => day.date === date && state.markets.some(market => market.id === day.marketId && market.kind === 'market'))
    .sort((a, b) => stallSort(a, b))
}

const primaryPickupMarketId: string | null = 'mkt-rathaus'

export function webPickupDay(date: string): MarketDay | undefined {
  const stalls = marketDaysOn(date)
  if (stalls.length <= 1) return stalls[0]
  return primaryPickupMarketId ? stalls.find(day => day.marketId === primaryPickupMarketId) : undefined
}

function effectivePaintingStall(
  stalls: MarketDay[],
  paintingMarketId?: string | null,
  markets = state.markets,
): MarketDay | undefined {
  if (!stalls.length) return undefined
  const sorted = [...stalls].sort((a, b) => stallSort(a, b, markets))
  if (paintingMarketId) {
    const chosen = sorted.find(day => day.marketId === paintingMarketId)
    if (chosen) return chosen
  }
  if (primaryPickupMarketId) {
    const primary = sorted.find(day => day.marketId === primaryPickupMarketId)
    if (primary) return primary
  }
  return sorted[0]
}

function paintingLocationMessage(date: string, pickup: MarketDay | undefined): string | null {
  if (pickup?.date !== date) return null
  const stall = effectivePaintingStall(marketDaysOn(date), state.paintingDays?.[date]?.paintingMarketId)
  if (!stall || stall.marketId === pickup.marketId) return null
  const name = state.markets.find(market => market.id === stall.marketId)?.name
  return `Gaby is painting at ${name ?? 'another market'} that day. Pick another day.`
}

function paintingLocationConflict(message: string): Error {
  return Object.assign(new Error(message), { status: 409, code: 'PAINT_NOT_AT_THIS_MARKET' })
}

function assertPaintingLocation(date: string, pickup: MarketDay | undefined) {
  const message = paintingLocationMessage(date, pickup)
  if (message) throw paintingLocationConflict(message)
}

function assertPaintingLocationChange(date: string, previousMarketId?: string, nextMarketId?: string) {
  if (previousMarketId === nextMarketId) return
  const pickups = blocksForDate(date).filter(block => {
    const item = state.items.find(row => row.id === block.orderItemId)
    if (item?.kind !== 'custom' || item.delivery.kind !== 'market' || requireOrder(item.orderId).status === 'CANCELLED') return false
    const pickup = pickupDayForItem(item)
    return pickup?.date === date && pickup.marketId !== nextMarketId
  }).length
  if (pickups) {
    throw paintingLocationConflict(`Changing where Gaby paints would leave ${pickups} same-day pickup${pickups === 1 ? '' : 's'} at another market.`)
  }
}

function dayByDate(date: string, marketId?: string): MarketDay | undefined {
  const rows = state.marketDays.filter((d) => d.date === date && (!marketId || d.marketId === marketId))
  if (!rows.length) {
    const home = state.markets.find(m => m.kind === 'home')
    if (!home || (marketId && marketId !== home.id)) return undefined
    return { id: `home-${date}`, marketId: home.id, date, openHour: 10, closeHour: [3, 5].includes(utcWeekday(date)) ? 12 : 13, isToday: false }
  }
  if (marketId) return rows[0]
  return marketDaysOn(date)[0] ?? rows[0]
}

function blocksForDate(date: string): TimeBlock[] {
  const ids = new Set(state.marketDays.filter(day => day.date === date).map(day => day.id))
  ids.add(`home-${date}`)
  return state.blocks.filter(block => ids.has(block.marketDayId)).sort((a, b) => a.startHour - b.startHour)
}

function busyPaintRanges(date: string) {
  const elapsedUntil = paintElapsedUntil(date, todayDay().date, DEMO_NOW_HOUR)
  return blocksForDate(date).flatMap(block => {
    const limit = block.status === 'finished' && isCheckoutHold(slotView(block).order) ? Infinity : elapsedUntil
    return bookedPaintRange(block, limit) ?? []
  })
}

function isCheckoutHold(order: Order | null) {
  return order?.checkoutStatus === 'pending' || order?.checkoutStatus === 'review' || order?.paymentReview === true
}

export function currentPrices(): Prices {
  const stored = state.prices
  return {
    ...mockPricing,
    revision: 0,
    ...stored,
    postCollectionDays: [...(stored?.postCollectionDays ?? mockPricing.postCollectionDays)],
    finishedWithCustom: mockPricing.finishedWithCustom,
  }
}

export function updatePrices(input: PricesUpdate): Prices {
  const current = currentPrices()
  if (input.expectedRevision !== current.revision) throw Object.assign(new Error('Someone else changed the prices. Reload and check them.'), { code: 'PRICES_CHANGED', status: 409 })
  const problem = validatePriceInput(input)
  if (problem) throw Object.assign(new Error(problem), { status: 400 })
  state.prices = {
    customPrice: input.customPrice,
    customMediumPrice: input.customMediumPrice ?? current.customMediumPrice,
    finishedPrice: input.finishedPrice,
    nameExtra: input.nameExtra,
    shippingFee: input.shippingFee ?? current.shippingFee,
    backNameMax: input.backNameMax ?? current.backNameMax,
    postCollectionDays: [...(input.postCollectionDays ?? current.postCollectionDays)],
    finishedWithCustom: current.finishedWithCustom,
    revision: current.revision + 1,
  }
  emit()
  return currentPrices()
}

function mockTodayIso(): string {
  const now = new Date()
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return iso >= '2026-01-01' && iso <= '2026-12-31' ? iso : todayDay().date
}

/** The Post rules with the staff-edited weekdays and per-date overrides (like `ShippingService.rules`). */
function postConfig(): Partial<PostShippingConfig> {
  return { collectionDays: currentPrices().postCollectionDays, overrides: { ...(state.postCollectionOverrides ?? {}) } }
}

export function listCollectionDays(from: string, to: string): PostCollectionDay[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(to ?? '') || to < from) {
    throw Object.assign(new Error('Invalid date range.'), { code: 'VALIDATION', status: 400 })
  }
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
  if (days >= 400) {
    throw Object.assign(new Error('Choose a collection date range of at most 400 days.'), { code: 'VALIDATION', status: 400 })
  }
  const overrides = state.postCollectionOverrides ?? {}
  const out: PostCollectionDay[] = []
  for (let date = from; date <= to; date = addUtcDays(date, 1)) {
    const open = isCollectionOn(date, postConfig())
    const override = overrides[date] ?? null
    if (open || override !== null) out.push({ date, open, override })
  }
  return out
}

export function setCollectionDay(date: string, open: boolean | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw Object.assign(new Error('Invalid date.'), { code: 'VALIDATION', status: 400 })
  if (open === true && !isWorkingDay(date)) {
    throw Object.assign(new Error('Post collections must be on a working day.'), { code: 'VALIDATION', field: 'open', status: 400 })
  }
  if (open == null) {
    if (state.postCollectionOverrides) delete state.postCollectionOverrides[date]
  } else {
    ;(state.postCollectionOverrides ??= {})[date] = open
  }
  emit()
}

export function getShippingWindow(readyOn: string): ShippingQuote {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readyOn ?? '')) {
    throw Object.assign(new Error('Invalid date.'), { code: 'VALIDATION', field: 'readyOn', status: 400 })
  }
  const today = mockTodayIso()
  const effective = readyOn < today ? today : readyOn
  return shippingWindowAfter(effective, postConfig())
}

function planMockPostShipping(items: Pick<ShopItemInput, 'kind' | 'withName'>[]) {
  if (!items.length) {
    return { quote: { available: false, collectionDate: null, arrivalFrom: null, arrivalTo: null }, slots: [] }
  }
  if (items.some(item => item.kind !== 'custom')) {
    throw Object.assign(new Error('Only custom pet ornaments can be ordered online.'), { status: 400 })
  }
  return planPostShipping({
    today: mockTodayIso(),
    items,
    config: postConfig(),
    findSlot: (date, durationHours, extraBusy) => {
      const res = findFreeSlot(date, durationHours, undefined, undefined, extraBusy)
      return res.ok ? res.slot : null
    },
  })
}

export function getShippingQuote(items: Pick<ShopItemInput, 'kind' | 'withName'>[]): ShippingQuote {
  return planMockPostShipping(items).quote
}

/** Stock row id of a custom base; big rows keep the ids they had before sizes existed. */
function stockId(color: string, finish: string, size: OrnamentSize | null | undefined): string {
  return size === 'medium' ? `custom-${color}-${finish}-medium` : `custom-${color}-${finish}`
}

export function listInventory(): InventoryItem[] {
  const rows = state.inventory ??= []
  for (const color of ['red', 'green', 'beige'] as const) for (const finish of ['shiny', 'matte'] as const) {
    if (!rows.some(row => row.kind === 'custom' && row.color === color && row.finish === finish && (row.size ?? 'big') === 'big')) {
      const legacy = finish === 'shiny' ? rows.find(row => row.kind === 'custom' && row.color === color && !row.finish) : undefined
      if (legacy) { legacy.finish = finish; legacy.id = stockId(color, finish, 'big') }
      else rows.push({ id: stockId(color, finish, 'big'), kind: 'custom', color, finish, size: 'big', quantity: 3 })
    }
    // Medium bases start at 0 until staff counts them on Stock, like production (V22).
    if (!rows.some(row => row.kind === 'custom' && row.color === color && row.finish === finish && row.size === 'medium')) {
      rows.push({ id: stockId(color, finish, 'medium'), kind: 'custom', color, finish, size: 'medium', quantity: 0 })
    }
  }
  for (const row of rows) if (row.kind === 'custom') { if (!row.finish) row.finish = 'shiny'; if (!row.size) row.size = 'big' }
  if (!rows.some(row => row.kind === 'finished')) rows.push({ id: 'finished', kind: 'finished', color: null, finish: null, quantity: 10 })
  return rows

}
export function updateInventory(id: string, quantity: number, expectedQuantity?: number): InventoryItem {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 10000) throw new Error('Quantity must be between 0 and 10000.')
  const item = listInventory().find(row => row.id === id); if (!item) throw new Error('Stock item not found.')
  if (expectedQuantity != null && item.quantity !== expectedQuantity) throw Object.assign(new Error('Stock changed. Reload and try again.'), { code: 'STOCK_CHANGED', status: 409 })
  item.quantity = quantity; emit(); return { ...item }
}
function derivedMaxPaintings(openHour: number, closeHour: number): number {
  return Math.max(0, Math.floor((closeHour - openHour) + 1e-6))
}
function effectivePaintingHoursFor(
  date: string,
  stalls: MarketDay[],
  markets = state.markets,
): { openHour: number; closeHour: number } {
  const settings = state.paintingDays?.[date]
  const day = effectivePaintingStall(stalls, settings?.paintingMarketId, markets)
    ?? (stalls.length ? undefined : dayByDate(date))
  const openHour = settings?.openHour ?? day?.openHour ?? 10
  const closeHour = settings?.closeHour ?? day?.closeHour ?? ([3, 5].includes(utcWeekday(date)) ? 12 : 13)
  return { openHour, closeHour }
}

export function paintingDay(date: string): PaintingDay {
  const settings = state.paintingDays?.[date] ?? { open: true }
  const booked = blocksForDate(date).filter(block => block.status !== 'finished'
    && state.items.some(item => item.id === block.orderItemId && item.kind === 'custom')).length
  const { openHour, closeHour } = effectivePaintingHoursFor(date, marketDaysOn(date))
  const market = state.markets.find(row => row.id === settings.paintingMarketId)
  return { date, open: settings.open, maxPaintings: derivedMaxPaintings(openHour, closeHour), booked, openHour, closeHour,
    paintingMarketId: market?.id ?? null, paintingMarketName: market?.name ?? null }
}
export function updatePaintingDay(date: string, open: boolean | undefined, settings?: { openHour?: number; closeHour?: number; paintingMarketId?: string | null }): PaintingDay {
  const { openHour, closeHour, paintingMarketId } = settings ?? {}
  if ((openHour != null || closeHour != null) && (openHour == null || closeHour == null || openHour < 0 || closeHour >= 24
    || openHour >= closeHour || !Number.isInteger(openHour * 4) || !Number.isInteger(closeHour * 4))) {
    throw new Error('Choose painting hours from 00:00 to 23:45 in 15-minute steps, with end after start.')
  }
  if (paintingMarketId != null && !marketDaysOn(date).some(day => day.marketId === paintingMarketId)) {
    throw invalidField('Choose a market open on this date.', 'paintingMarketId')
  }
  const previous = state.paintingDays?.[date]
  if (paintingMarketId !== undefined) {
    const stalls = marketDaysOn(date)
    assertPaintingLocationChange(date, effectivePaintingStall(stalls, previous?.paintingMarketId)?.marketId,
      effectivePaintingStall(stalls, paintingMarketId)?.marketId)
  }
  state.paintingDays ??= {}
  state.paintingDays[date] = { ...previous, ...settings, open: open ?? previous?.open ?? true }
  emit()
  return paintingDay(date)
}
export function joinWaitlist(email: string) { const token = newUuid(); (state.waitlistTokens ??= {})[token] = { email: email.toLowerCase(), confirmed: false }; emit() }
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
  const ignored = ignoreBlockId && blocksForDate(date).some(block => block.id === ignoreBlockId && block.status !== 'finished') ? 1 : 0
  if (!setting.open || setting.booked - ignored + extraBusy.length >= setting.maxPaintings) return { ok: false, slot: null, remainingHours: 0, message: 'Painting day is closed or full.' }
  const day = dayByDate(date, marketId) ?? dayByDate(date)
  if (!day) {
    return { ok: false, slot: null, remainingHours: 0, message: 'No market day on that date.' }
  }
  const floor =
    day.isToday && afterHour == null
      ? Math.max(setting.openHour, DEMO_NOW_HOUR)
      : Math.max(setting.openHour, afterHour ?? setting.openHour)
  const busy = [
    ...busyPaintRanges(date).filter(block => block.id !== ignoreBlockId),
    ...extraBusy.map((b, i) => ({
      id: `draft-${i}`,
      marketDayId: day.id,
      orderItemId: null,
      startHour: b.startHour,
      endHour: b.endHour,
      status: 'not_started' as const,
    })),
  ].sort((a, b) => a.startHour - b.startHour)
  const ceiling = Math.min(setting.closeHour, beforeHour ?? setting.closeHour)
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

function validateCancel(order: Order, reason?: string) {
  if (reason && reason.length > 500) throw new Error('Reason must be 500 characters or fewer.')
  if (order.handedOver || state.items.some(item => item.orderId === order.id && item.handedOver)) {
    throw new Error('Cannot cancel an order with handed-over items.')
  }
}

function applyCancelOrder(id: string, reason?: string): boolean {
  const order = requireOrder(id)
  if (order.status === 'CANCELLED') return false
  validateCancel(order, reason)
  const cancelled = state.items.filter(item => item.orderId === id)
  for (const item of cancelled) {
    if (item.kind !== 'custom' || item.productionStatus !== 'not_started') continue
    const stock = listInventory().find(row => row.kind === 'custom' && row.color === item.color && row.finish === (item.finish ?? 'shiny'))
    if (stock) stock.quantity++
  }
  const itemIds = new Set(cancelled.map(item => item.id))
  state.blocks = state.blocks.filter((block) => !block.orderItemId || !itemIds.has(block.orderItemId))
  order.status = 'CANCELLED'
  order.cancelledAt = new Date().toISOString()
  order.cancellationReason = reason?.trim() || null
  return true
}

export function cancelOrder(id: string, reason?: string) {
  if (applyCancelOrder(id, reason)) emit()
}

export async function cancelStaffOrder(id: string, reason?: string) {
  const order = requireOrder(id)
  if (order.status === 'CANCELLED') return
  validateCancel(order, reason)
  const pieces = state.items.flatMap(item => item.orderId === id && item.marketOrnamentId ? [item.marketOrnamentId] : [])
  if (pieces.length) await returnMarketPieces(pieces, id)
  if (applyCancelOrder(id, reason)) emit()
}

export function createMockCheckout(input: ShopCheckoutInput) {
  // The mock completes new checkouts immediately; pending entries can still exist in saved demo data.
  const pending = state.orders.filter(order => order.source === 'web' && order.checkoutStatus === 'pending' && order.status !== 'CANCELLED')
  for (const order of pending) {
    if (Date.now() - Date.parse(order.createdAt) >= 15 * 60 * 1000) {
      cancelOrder(order.id)
      if (state.pendingCheckouts) delete state.pendingCheckouts[order.code]
    }
  }
  const active = pending.filter(order => order.status !== 'CANCELLED')
  const email = input.email.trim().toLowerCase()
  if (active.filter(order => state.customers.find(customer => customer.id === order.customerId)?.email.trim().toLowerCase() === email).length >= 2
      || active.filter(order => Boolean(state.pendingCheckouts?.[order.code])).length >= 2) {
    throw Object.assign(new Error('Too many pending checkouts.'), { code: 'PENDING_CHECKOUT_LIMIT' })
  }
  const inventory = listInventory()
  const counts = new Map<string, number>()
  for (const item of input.items) {
    if (item.size !== 'big' && item.size !== 'medium') throw Object.assign(new Error('Choose Big (10 cm) or Medium (8 cm) for each personalised ornament.'), { code: 'VALIDATION', field: `items[${input.items.indexOf(item)}].size` })
    if (!item.finish || !item.color || !['red', 'green', 'beige'].includes(item.color)) throw Object.assign(new Error('Choose a valid colour and finish.'), { code: 'VALIDATION', field: `items[${input.items.indexOf(item)}].${!item.finish ? 'finish' : 'color'}` })
    if (item.withName) requireBackName(item.backName, null, `items[${input.items.indexOf(item)}].backName`)
    const id = stockId(item.color, item.finish, item.size)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  for (const [id, count] of counts) {
    if ((inventory.find(row => row.id === id)?.quantity ?? 0) < count) throw Object.assign(new Error('Out of stock.'), { code: 'OUT_OF_STOCK' })
  }
  const prices = currentPrices()
  const pickup = input.deliveryKind === 'market'
  if (input.deliveryKind === 'vienna') {
    throw Object.assign(new Error('Choose Post shipping or market pickup.'), { code: 'VALIDATION', field: 'deliveryKind', status: 400 })
  }
  let postQuote: ShippingQuote | null = null
  let postSlots: { date: string; startHour: number; endHour: number }[] = []
  if (!pickup) {
    if (!input.address?.line1?.trim() || !input.address?.city?.trim()) {
      throw Object.assign(new Error('Add the shipping address.'), { code: 'VALIDATION', field: 'address', status: 400 })
    }
    if (!AUSTRIAN_POSTAL_REGEX.test(input.address.postalCode?.trim() ?? '')) {
      throw Object.assign(new Error('Enter a four-digit Austrian postcode.'), { code: 'POSTAL_INVALID', field: 'address.postalCode', status: 400 })
    }
    if (!input.expectedArrivalTo) {
      throw Object.assign(new Error('Confirm the estimated arrival date.'), { code: 'VALIDATION', field: 'expectedArrivalTo', status: 400 })
    }
    const planned = planMockPostShipping(input.items)
    postQuote = planned.quote
    postSlots = planned.slots
    if (!postQuote.available || !postQuote.collectionDate || !postQuote.arrivalFrom || !postQuote.arrivalTo) {
      throw Object.assign(new Error('Post shipping is no longer available.'), { code: 'SHIPPING_UNAVAILABLE', field: 'delivery', status: 409 })
    }
    if (postQuote.arrivalTo > input.expectedArrivalTo) {
      throw Object.assign(new Error('The estimated arrival window changed. Confirm the new dates.'), { code: 'SHIPPING_WINDOW_CHANGED', field: 'delivery', status: 409 })
    }
  }
  const customer: Customer = { id: uid('cus'), name: input.customerName, email: input.email, phone: input.phone }
  const orderId = uid('ord')
  const code = makeOrderCode()
  const token = uid('frm')
  const cleanAddress = !pickup && input.address
    ? {
        line1: input.address.line1.trim(),
        ...(input.address.line2?.trim() ? { line2: input.address.line2.trim() } : {}),
        postalCode: input.address.postalCode.trim(),
        city: input.address.city.trim(),
      }
    : undefined
  const pickupDay = pickup
    ? state.marketDays.find(day => day.id === input.marketDayId)
      ?? state.marketDays.find(day => day.date === input.deliveryDate && state.markets.some(m => m.id === day.marketId && m.kind === 'market'))
    : undefined
  const market = state.markets.find(row => row.id === pickupDay?.marketId)
  const items: OrderItem[] = input.items.map(item => ({
    id: uid('orn'), orderId, kind: 'custom', marketOrnamentId: null, petName: item.petName ?? '', withName: item.withName,
    color: item.color ?? 'red', finish: item.finish, size: item.size, backName: item.withName ? (item.backName ?? '').trim().toUpperCase() : '', note: item.note ?? '',
    cost: itemCost('custom', item.withName, prices, item.size), productionStatus: 'not_started', photos: item.photos,
    formComplete: true, delivery: pickup
      ? { kind: 'market', marketDayId: pickupDay?.id, marketId: market?.id, marketName: market?.name, deliveryDate: input.deliveryDate ?? pickupDay?.date, pickupHour: input.pickupTime ? Number(input.pickupTime.slice(0, 2)) + Number(input.pickupTime.slice(3)) / 60 : null }
      : { kind: 'post', address: cleanAddress, deliveryDate: postQuote!.collectionDate!, arrivalFrom: postQuote!.arrivalFrom, arrivalTo: postQuote!.arrivalTo },
  }))
  const createdBlocks: TimeBlock[] = []
  if (!pickup && postSlots.length) {
    // Pair planned slots longest-first to match planPostShipping's duration ordering.
    const orderedItems = [...items].sort((a, b) => Number(b.withName) - Number(a.withName))
    for (let i = 0; i < orderedItems.length && i < postSlots.length; i += 1) {
      const slot = postSlots[i]
      const day = dayByDate(slot.date)
      if (!day) continue
      if (!state.marketDays.some(row => row.id === day.id)) state.marketDays.push(day)
      createdBlocks.push({
        id: uid('blk'),
        marketDayId: day.id,
        orderItemId: orderedItems[i].id,
        startHour: slot.startHour,
        endHour: slot.endHour,
        status: 'not_started',
      })
    }
  }
  const deliveryFee = pickup ? 0 : prices.shippingFee
  const total = Math.round((items.reduce((sum, item) => sum + item.cost, 0) + deliveryFee) * 100) / 100
  const order: Order = { id: orderId, customerId: customer.id, code, trackToken: uid('trk'), formToken: token,
    source: 'web', checkoutStatus: 'confirmed', paymentState: 'paid', paymentMethod: 'card', deliveryFee, amountPaid: total, total,
    createdAt: new Date().toISOString(), itemIds: items.map(item => item.id), handedOver: false, paymentEntries: [],
    reviewedAt: null, needsReview: true }
  for (const [id, count] of counts) inventory.find(row => row.id === id)!.quantity -= count
  state.customers.push(customer); state.orders.push(order); state.items.push(...items); state.blocks.push(...createdBlocks)
  // The mock checkout redirects directly to success, so it simulates confirmed payment.
  emit()
  rememberFormToken(code, token)
  return { orderCode: code, formToken: token, checkoutUrl: `/buy/thanks?code=${code}` }
}

export function abandonMockCheckout(code: string) {
  const token = state.pendingCheckouts?.[code]
  const suppliedToken = readFormToken(code)
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
  if (!token.startsWith('mock.')) throw Object.assign(new Error('Invalid session'), { status: 401 })
  const id = token.split('.')[1]
  const user = state.staff.find((s) => s.id === id)
  if (!user) throw Object.assign(new Error('Invalid session'), { status: 401 })
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

function dayIsUsed(day: MarketDay): boolean {
  return Object.values(state.soldOnMarketDays ?? {}).includes(day.id)
    || state.items.some(item => item.delivery.kind === 'market' && pickupDayForItem(item)?.id === day.id)
    || (marketDaysOn(day.date).length === 1 && blocksForDate(day.date).length > 0)
}

function paintingConflict(date: string, postChangeStalls: MarketDay[], markets = state.markets): string | null {
  const blocks = blocksForDate(date)
  if (!blocks.length) return null
  const { openHour, closeHour } = effectivePaintingHoursFor(date, postChangeStalls, markets)
  const label = formatDateLabel(date)
  const span = `${formatHour(openHour)}–${formatHour(closeHour)}`
  for (const block of blocks) {
    if (block.startHour < openHour || block.endHour > closeHour) {
      return `${label}: a paint session sits outside ${span}`
    }
  }
  const override = state.paintingDays?.[date]?.paintingMarketId
  assertPaintingLocationChange(date, effectivePaintingStall(marketDaysOn(date), override)?.marketId,
    effectivePaintingStall(postChangeStalls, override, markets)?.marketId)
  return null
}

function assertDayCanBeRemoved(day: MarketDay, message: string) {
  if (dayIsUsed(day)) throw new Error(`${formatDateLabel(day.date)} ${message}`)
  const remaining = marketDaysOn(day.date).filter(other => other.id !== day.id)
  if (remaining.length > 0) {
    const conflict = paintingConflict(day.date, remaining)
    if (conflict) throw new Error(conflict)
  }
}

function removeMarketDay(day: MarketDay) {
  const replacement = marketDaysOn(day.date).find(other => other.id !== day.id)
  if (replacement) state.blocks.filter(block => block.marketDayId === day.id).forEach(block => { block.marketDayId = replacement.id })
  const settings = state.paintingDays?.[day.date]
  if (settings?.paintingMarketId === day.marketId) settings.paintingMarketId = null
  state.marketDays = state.marketDays.filter(row => row.id !== day.id)
}

function hoursConflict(
  day: MarketDay | undefined,
  date: string,
  openHour: number,
  closeHour: number,
  postSaveStalls: MarketDay[],
  markets: Market[],
): string | null {
  const paintErr = paintingConflict(date, postSaveStalls, markets)
  if (paintErr) return paintErr
  const label = formatDateLabel(date)
  const span = `${formatHour(openHour)}–${formatHour(closeHour)}`
  for (const item of state.items) {
    const order = requireOrder(item.orderId)
    if (!day || order.status === 'CANCELLED' || item.delivery.kind !== 'market' || pickupDayForItem(item)?.id !== day.id) continue
    const hour = item.delivery.pickupHour
    if (hour == null) continue
    if (hour < openHour || hour >= closeHour || (order.source === 'web' && hour > closeHour - 0.5)) {
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
    if (!Number.isFinite(day.openHour) || !Number.isFinite(day.closeHour) || !(day.closeHour > day.openHour) || day.openHour < 0 || day.closeHour >= 24) {
      throw new Error(`${formatDateLabel(day.date)}: close must be after open`)
    }
  }

  for (const day of input.days) {
    const alreadyStall = marketDaysOn(day.date).length > 0
    if (!alreadyStall && state.items.some(item => requireOrder(item.orderId).status !== 'CANCELLED' && item.delivery.kind === 'vienna' && deliveryDateForItem(item) === day.date)) throw Object.assign(new Error(`${formatDateLabel(day.date)} has Vienna deliveries; move them first.`), { code: 'DAY_HAS_DELIVERIES', field: 'days' })
  }

  const existing = input.id ? state.markets.find((row) => row.id === input.id) : undefined
  if (input.id && (!existing || existing.kind !== 'market')) throw new Error('Market not found')

  const removed = existing ? state.marketDays.filter(day => day.marketId === existing.id && !seen.has(day.date)) : []
  for (const day of removed) {
    assertDayCanBeRemoved(day, 'has orders and cannot leave the season')
  }
  const candidateMarketId = existing?.id ?? 'new-market'
  const postSaveMarkets: Market[] = [
    ...state.markets.filter(m => m.id !== candidateMarketId),
    { id: candidateMarketId, name, kind: 'market', totalCost: input.totalCost, startDate: input.startDate, finishDate: input.finishDate, stall: input.stall },
  ]
  for (const row of input.days) {
    const day = existing ? state.marketDays.find(day => day.marketId === existing.id && day.date === row.date) : undefined
    const postSaveStalls: MarketDay[] = [
      ...marketDaysOn(row.date).filter(other => other.id !== day?.id),
      { id: day?.id ?? 'new-day', marketId: candidateMarketId, date: row.date, openHour: row.openHour, closeHour: row.closeHour, isToday: false },
    ]
    const conflict = hoursConflict(day, row.date, row.openHour, row.closeHour, postSaveStalls, postSaveMarkets)
    if (conflict) throw new Error(conflict)
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

  removed.forEach(removeMarketDay)
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
  assertDayCanBeRemoved(day, 'has orders and cannot be deleted')
  removeMarketDay(day)
  emit()
}

export function deleteMarket(id: string): void {
  const market = state.markets.find((row) => row.id === id)
  if (!market || market.kind !== 'market') throw new Error('Market not found')
  const days = listMarketDays(id)
  for (const day of days) {
    assertDayCanBeRemoved(day, 'has orders. This market cannot be deleted')
  }
  days.forEach(removeMarketDay)
  state.markets = state.markets.filter(row => row.id !== id)
  emit()
}

function slotView(block: TimeBlock): AgendaSlot {
  const item = block.orderItemId ? state.items.find((i) => i.id === block.orderItemId) ?? null : null
  const order = item ? state.orders.find((o) => o.id === item.orderId) ?? null : null
  const customer = order ? state.customers.find((c) => c.id === order.customerId) ?? null : null
  return { block, order, item: item && withPickupMarket(item), customer, photoUrl: item?.photos?.[0]?.dataUrl || null }
}

function marketDayDate(marketDayId?: string | null): string | null {
  if (!marketDayId) return null
  return state.marketDays.find((d) => d.id === marketDayId)?.date ?? null
}

/** Calendar date this ornament is handed off — market pickup day, or Vienna mapped to a day. */
function pickupDayForItem(item: OrderItem): MarketDay | undefined {
  const exact = state.marketDays.find(day => day.id === item.delivery.marketDayId)
  if (exact) return exact
  const date = item.delivery.deliveryDate
  if (!date) return undefined
  const stalls = marketDaysOn(date)
  return stalls.find(day => day.marketId === item.delivery.marketId) ?? stalls[0]
}

function withPickupMarket(item: OrderItem): OrderItem {
  if (item.delivery.kind !== 'market') return item
  const day = pickupDayForItem(item)
  const market = state.markets.find(row => row.id === day?.marketId && row.kind === 'market')
  return day && market ? { ...item, delivery: { ...item.delivery, marketId: market.id, marketName: market.name, marketDayId: day.id } } : item
}

function deliveryDateForItem(item: OrderItem): string | null {
  if (item.delivery.kind === 'market') {
    return pickupDayForItem(item)?.date ?? item.delivery.deliveryDate ?? null
  }
  if (item.delivery.marketDayId) return marketDayDate(item.delivery.marketDayId)
  // Web Vienna orders carry the chosen date directly (like the backend's handoff date).
  if (item.delivery.deliveryDate) return item.delivery.deliveryDate
  const block = state.blocks.find((b) => b.orderItemId === item.id)
  if (!block) return null
  const paintDate = marketDayDate(block.marketDayId)
  if (!paintDate) return null
  // Legacy undated Vienna item: the first Wednesday or Friday after painting, so it shows on exactly one day.
  for (let offset = 1; offset <= 7; offset++) {
    const date = addUtcDays(paintDate, offset)
    if (utcWeekday(date) === 3 || utcWeekday(date) === 5) return date
  }
  return null
}

function viennaBelongsToDate(item: OrderItem, date: string): boolean {
  if (item.delivery.kind !== 'vienna') return false
  if (item.delivery.marketDayId) return marketDayDate(item.delivery.marketDayId) === date
  return deliveryDateForItem(item) === date
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
    if (!order || !customer || order.status === 'CANCELLED') continue
    if (order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' || order.paymentReview) continue
    const title = item.petName || customer.name || 'Ornament'
    const photoUrl = item.photos[0]?.dataUrl
    if (item.delivery.kind === 'market') {
      if (deliveryDateForItem(item) !== date) continue
      const day = pickupDayForItem(item)
      const market = state.markets.find(row => row.id === day?.marketId && row.kind === 'market')
      const hour = item.delivery.pickupHour ?? null
      rows.push({
        orderId: order.id,
        orderCode: order.code,
        itemId: item.id,
        customerName: customer.name,
        color: item.color,
        finish: item.finish,
        size: item.size,
        backName: item.backName,
        title,
        productionStatus: item.productionStatus,
        handedOver: item.handedOver ?? order.handedOver,
        deliveryKind: 'market',
        pickupHour: hour,
        methodLabel: market?.name ?? 'Market pickup',
        marketId: market?.id ?? null,
        marketName: market?.name ?? null,
        marketDayId: day?.id ?? null,
        timeLabel: hour != null ? formatHour(hour) : null,
        phone: customer.phone,
        addressLabel: null,
        photoUrl,
        source: order.source ?? 'stall',
        kind: item.kind,
        postalCode: null,
        waitingForCustomer: item.kind === 'custom' && (!item.photos.length || (item.withName && !item.backName)),
      })
    } else if (item.delivery.kind === 'vienna' || item.delivery.kind === 'post') {
      const isPost = item.delivery.kind === 'post'
      if (isPost ? deliveryDateForItem(item) !== date : !viennaBelongsToDate(item, date)) continue
      const shortDate = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '')
      rows.push({
        orderId: order.id,
        orderCode: order.code,
        itemId: item.id,
        customerName: customer.name,
        color: item.color,
        finish: item.finish,
        size: item.size,
        backName: item.backName,
        title,
        productionStatus: item.productionStatus,
        handedOver: item.handedOver ?? order.handedOver,
        deliveryKind: item.delivery.kind,
        pickupHour: null,
        methodLabel: `${isPost ? 'Post' : 'Vienna'} · ${shortDate}`,
        timeLabel: null,
        phone: customer.phone,
        addressLabel: addressLabel(item.delivery.address),
        photoUrl,
        source: order.source ?? 'stall',
        kind: item.kind,
        postalCode: item.delivery.address?.postalCode ?? null,
        waitingForCustomer: item.kind === 'custom' && (!item.photos.length || (item.withName && !item.backName)),
      })
    }
  }
  rows.sort((a, b) => {
    if (a.deliveryKind !== b.deliveryKind) return a.deliveryKind === 'market' ? -1 : 1
    return (a.pickupHour ?? 99) - (b.pickupHour ?? 99)
  })
  return rows.map(row => { const order = requireOrder(row.orderId); const summary = paymentSummary(order); return { ...row, remaining: summary.remaining, paymentState: order.paymentState, total: order.total, amountPaid: summary.paid } })
}

export function getAgendaDay(date: string): AgendaDay {
  const settings = state.paintingDays?.[date]
  const marketDay = effectivePaintingStall(marketDaysOn(date), settings?.paintingMarketId) ?? dayByDate(date) ?? todayDay()
  const market = state.markets.find((m) => m.id === marketDay.marketId)
  if (!market) throw new Error('Market missing')
  const marketDays = marketDaysOn(marketDay.date)
  const { paintingMarketId, paintingMarketName } = paintingDay(marketDay.date)
  return {
    marketDay,
    market,
    marketDays,
    markets: marketDays.map(day => state.markets.find(row => row.id === day.marketId)!),
    paintingMarketId,
    paintingMarketName,
    slots: blocksForDate(marketDay.date).map(slotView).map(slot => isCheckoutHold(slot.order) ? { block: slot.block, held: true, order: null, item: null, customer: null, photoUrl: null } : slot),
    deliveries: deliveriesForDate(marketDay.date),
  }
}

export function listAgendaDays(): AgendaDay[] {
  const postDates = state.items
    .filter(item => item.delivery.kind === 'post' && item.delivery.deliveryDate)
    .map(item => item.delivery.deliveryDate!)
  const dates = [...new Set([...state.marketDays.map((d) => d.date), ...postDates])].sort()
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
  const pickup = item.delivery.kind === 'market' ? pickupDayForItem(item) : undefined
  assertPaintingLocation(date, pickup)
  const hours = paintingDay(date)
  const end = startHour + duration
  const booked = hours.booked + (marketDayDate(block.marketDayId) === date ? 0 : 1)
  if (!hours.open) throw new Error('Painting is closed on this day.')
  if (booked > hours.maxPaintings) throw new Error('Daily painting limit reached.')
  if (startHour < hours.openHour || end > hours.closeHour) {
    throw new Error('Outside painting hours')
  }
  if (hasPaintOverlap(busyPaintRanges(date), startHour, end, blockId)) {
    throw new Error('That time overlaps another block')
  }
  if (date < todayDay().date || (day.isToday && startHour < DEMO_NOW_HOUR)) {
    throw new Error('That time has already passed')
  }
  const handoff = pickup?.date ?? deliveryDateForItem(item)
  const deliveryDay = handoff ? { date: handoff } : undefined
  if (!deliveryDay || day.date > deliveryDay.date) {
    throw new Error('Painting must stay before pickup')
  }
  if (item.delivery.kind === 'vienna' && day.date >= deliveryDay.date) {
    throw new Error('Vienna orders must be painted before the handoff day')
  }
  if (item.delivery.kind === 'post' && day.date >= deliveryDay.date) {
    throw new Error('Post orders must be painted before the collection day')
  }
  if (
    item.delivery.kind === 'market' &&
    day.date === deliveryDay.date &&
    item.delivery.pickupHour != null &&
    end + 0.25 > item.delivery.pickupHour + 0.001
  ) {
    throw new Error(`This session must finish before pickup at ${formatHour(item.delivery.pickupHour)}`)
  }
  if (!state.marketDays.some(row => row.id === day.id)) state.marketDays.push(day)
  block.marketDayId = day.id
  block.startHour = startHour
  block.endHour = end
  emit()
}

function makeRoomError(code: string, message: string, reason?: string): Error {
  return Object.assign(new Error(message), { code, status: 409, ...(reason ? { reason } : {}) })
}

/** Like MakeRoomPlanner.isMovable: a not-started session whose handoff is after its paint day. */
function movableSession(block: TimeBlock): OrderItem | null {
  const item = block.orderItemId ? state.items.find(row => row.id === block.orderItemId) : undefined
  const paintDate = marketDayDate(block.marketDayId) ?? block.marketDayId.replace(/^home-/, '')
  const handoff = item ? deliveryDateForItem(item) : null
  if (!item || !handoff || block.status !== 'not_started' || item.productionStatus !== 'not_started' || item.handedOver) return null
  return handoff > paintDate ? item : null
}

/** Painting dates from today up to (not including) the handoff: later days first, then earlier ones. */
function makeRoomTargets(handoff: string, original: string): string[] {
  const out: string[] = []
  for (let date = todayDay().date; date < handoff; date = addUtcDays(date, 1)) {
    const setting = paintingDay(date)
    if (setting.open && setting.maxPaintings > 0 && dayByDate(date)) out.push(date)
  }
  return [...out.filter(date => date >= original), ...out.filter(date => date < original)]
}

const minuteFloor = (date: string, after = 0) => date === todayDay().date ? Math.max(DEMO_NOW_HOUR, after) : after

function placeBlock(block: TimeBlock, date: string, startHour: number, endHour: number) {
  const day = dayByDate(date)!
  if (!state.marketDays.some(row => row.id === day.id)) state.marketDays.push(day)
  block.marketDayId = day.id
  block.startHour = startHour
  block.endHour = endHour
}

function blockSpan(block: TimeBlock) {
  return { date: marketDayDate(block.marketDayId) ?? block.marketDayId.replace(/^home-/, ''), startHour: block.startHour, endHour: block.endHour }
}

/** Mock of `POST /api/agenda/blocks/{itemId}/make-room`. */
export function makeRoomForBlock(itemId: string): MakeRoomResult {
  const block = state.blocks.find(row => row.orderItemId === itemId)
  const item = block ? movableSession(block) : null
  if (!block || !item) throw makeRoomError('SESSION_NOT_MOVABLE', 'This session cannot be moved: it is handed over the day it is painted.')
  const from = blockSpan(block)
  const duration = block.endHour - block.startHour
  const targets = makeRoomTargets(deliveryDateForItem(item)!, from.date)
  for (const date of targets) {
    const after = date === from.date ? minuteFloor(date, from.endHour) : minuteFloor(date)
    const result = findFreeSlot(date, duration, after || undefined, undefined, [], block.id)
    if (result.ok && result.slot) {
      placeBlock(block, date, result.slot.startHour, result.slot.endHour)
      emit()
      const order = state.orders.find(row => row.id === item.orderId)
      return { moved: [{ itemId, orderCode: order?.code ?? '', from, to: { date, startHour: result.slot.startHour, endHour: result.slot.endHour } }] }
    }
  }
  if (targets.includes(from.date)) {
    const earlier = findFreeSlot(from.date, duration, minuteFloor(from.date) || undefined, undefined, [], block.id, from.startHour)
    if (earlier.ok && earlier.slot) {
      placeBlock(block, from.date, earlier.slot.startHour, earlier.slot.endHour)
      emit()
      const order = state.orders.find(row => row.id === item.orderId)
      return { moved: [{ itemId, orderCode: order?.code ?? '', from, to: { date: from.date, startHour: earlier.slot.startHour, endHour: earlier.slot.endHour } }] }
    }
  }
  throw makeRoomError('NO_SLOT_KEEPS_PROMISE', 'No free slot before the handoff day. Move the session by hand.')
}

const makeRoomReplays = new Map<string, MakeRoomResult>()

/** Mock of `POST /api/agenda/make-room`: fewest moves, latest handoffs first, all or nothing. */
export function makeRoom(input: MakeRoomInput, key: string): MakeRoomResult {
  const replay = makeRoomReplays.get(key)
  if (replay) return replay
  const { date } = input
  const duration = input.minutes / 60
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !(input.minutes > 0 && input.minutes <= 1440)) {
    throw Object.assign(new Error('Invalid request.'), { code: 'VALIDATION', status: 400 })
  }
  const setting = paintingDay(date)
  const requestedDay = input.marketDayId
    ? state.marketDays.find(day => day.id === input.marketDayId && day.date === date && state.markets.some(m => m.id === day.marketId && m.kind === 'market'))
    : dayByDate(date)
  if (!requestedDay || date < todayDay().date || !setting.open || setting.maxPaintings <= 0) {
    throw makeRoomError('NO_MOVABLE_SESSION', 'Painting is unavailable on this day.', 'NOT_PAINTING_DAY')
  }
  const remember = (result: MakeRoomResult) => { makeRoomReplays.set(key, result); return result }
  const free = findFreeSlot(date, duration, minuteFloor(date) || undefined, input.marketDayId ? requestedDay.marketId : undefined)
  if (free.ok && free.slot) return remember({ slot: free.slot, moved: [] })

  const onDay = blocksForDate(date).filter(block => block.orderItemId)
  if (onDay.length && onDay.every(block => { const item = state.items.find(row => row.id === block.orderItemId); return item && deliveryDateForItem(item) === date })) {
    throw makeRoomError('NO_MOVABLE_SESSION', "All of today's sessions are for pickups today, so none can be moved.", 'SAME_DAY_ONLY')
  }
  const handoffOf = (block: TimeBlock) => deliveryDateForItem(movableSession(block)!)!
  const candidates = onDay.filter(block => movableSession(block)).sort((a, b) => handoffOf(b).localeCompare(handoffOf(a)) || a.startHour - b.startHour)
  const subsets = (size: number, start = 0): TimeBlock[][] => size === 0 ? [[]]
    : candidates.slice(start).flatMap((block, i) => subsets(size - 1, start + i + 1).map(rest => [block, ...rest]))
  for (let size = 1; size <= candidates.length; size++) {
    for (const subset of subsets(size)) {
      const saved = state.blocks.map(block => ({ ...block }))
      const savedDays = state.marketDays.length
      const removed = new Set(subset.map(block => block.id))
      state.blocks = state.blocks.filter(block => !removed.has(block.id))
      const slot = findFreeSlot(date, duration, minuteFloor(date) || undefined)
      const moved: MakeRoomMove[] = []
      let placedAll = !!(slot.ok && slot.slot)
      for (const block of [...subset].sort((a, b) => handoffOf(a).localeCompare(handoffOf(b)))) {
        if (!placedAll) break
        const item = movableSession(block)!
        const from = { ...saved.find(copy => copy.id === block.id)! }
        const fromSpan = blockSpan(from)
        let placed = false
        for (const target of makeRoomTargets(handoffOf(block), fromSpan.date)) {
          const extra = target === date && slot.slot ? [slot.slot] : []
          const result = findFreeSlot(target, block.endHour - block.startHour, minuteFloor(target) || undefined, undefined, extra)
          if (result.ok && result.slot) {
            placeBlock(block, target, result.slot.startHour, result.slot.endHour)
            state.blocks.push(block)
            const order = state.orders.find(row => row.id === item.orderId)
            moved.push({ itemId: item.id, orderCode: order?.code ?? '', from: fromSpan, to: { date: target, startHour: result.slot.startHour, endHour: result.slot.endHour } })
            placed = true
            break
          }
        }
        placedAll = placed
      }
      if (placedAll && slot.slot) {
        emit()
        return remember({ slot: slot.slot, moved })
      }
      // All or nothing: put every session back where it was.
      state.blocks = saved
      state.marketDays.length = savedDays
    }
  }
  throw makeRoomError('NO_MOVABLE_SESSION', 'No available painting slots can free this time and keep the promised handoffs.', 'NO_TARGET_SLOT')
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
  const items = state.items.filter(i => i.orderId === order.id).map(withPickupMarket)
  const blocks = state.blocks.filter((b) => items.some((i) => i.id === b.orderItemId))
  return { order, customer, items, blocks }
}

export async function createSale(input: CreateSaleInput): Promise<Order> {
  const ids = new Set<string>()
  const invalidPiece = (message: string) => Object.assign(new Error(message), {
    code: 'VALIDATION', status: 400, field: 'marketOrnamentId',
  })
  for (const item of input.items ?? []) {
    const id = item.marketOrnamentId
    if (item.kind === 'finished') {
      if (!id?.trim()) throw invalidPiece('Choose a numbered ornament.')
      if (ids.has(id)) throw invalidPiece('Choose each numbered ornament only once.')
      ids.add(id)
    } else if (id != null) {
      throw invalidPiece('Custom ornaments cannot use numbered market stock.')
    }
  }
  const orderId = uid('ord')
  const code = makeOrderCode()
  const pieces = [...ids]
  if (pieces.length) await sellMarketPieces(pieces, { orderId, orderCode: code, soldAt: new Date().toISOString() })
  try {
    return createSaleOrder(input, orderId, code)
  } catch (error) {
    await returnMarketPieces(pieces, orderId)
    throw error
  }
}

function invalidField(message: string, field: string) {
  return Object.assign(new Error(message), { code: 'VALIDATION', status: 400, field })
}

function createSaleOrder(input: CreateSaleInput, orderId: string, code: string): Order {
  const rows = input.items ?? []
  if (!rows.length) throw new Error('Add at least one ornament')
  const today = todayDay().date
  const stalls = marketDaysOn(today)
  const soldOn = input.soldOnMarketDayId ? stalls.find(day => day.id === input.soldOnMarketDayId) : stalls[0]
  if ((input.soldOnMarketDayId && !soldOn) || (!input.soldOnMarketDayId && stalls.length > 1)) {
    throw invalidField('Choose the market where this sale took place.', 'soldOnMarketDayId')
  }
  const move = input.plannedMove
  const moving = move ? state.blocks.find((block) => block.id === move.blockId) : undefined
  const destination = move ? dayByDate(move.to.date) : undefined
  if (move) {
    const movedIntoSlot = rows.find((row) => row.paintDate === move.freedSlot.date && row.paintStart === move.freedSlot.startHour)
    const deliveryDay = movedIntoSlot?.marketDayId ? state.marketDays.find((day) => day.id === movedIntoSlot.marketDayId) : undefined
    const beforeHour = movedIntoSlot?.deliveryKind === 'market' && deliveryDay?.date === move.freedSlot.date && movedIntoSlot.pickupHour != null
      ? movedIntoSlot.pickupHour - 0.25
      : undefined
    const pickup = movedIntoSlot?.deliveryKind === 'market' ? deliveryDay : undefined
    assertPaintingLocation(move.freedSlot.date, pickup)
    const movingItem = state.items.find(item => item.id === moving?.orderItemId)
    if (movingItem?.delivery.kind === 'market') assertPaintingLocation(move.to.date, pickupDayForItem(movingItem))
    const fresh = findMoveSuggestion({
      date: move.from.date,
      durationHours: move.freedSlot.endHour - move.freedSlot.startHour,
      handoffDate: deliveryDay?.date ?? move.freedSlot.date,
      beforeHour,
      handoffMarketDayId: pickup?.id,
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
  const createdItems: OrderItem[] = []
  const createdBlocks: TimeBlock[] = []

  const prices = currentPrices()
  const hasPost = rows.some(row => row.deliveryKind === 'post')
  let postWindow: ShippingQuote | null = null
  if (hasPost) {
    const postRows = rows.filter(row => row.deliveryKind === 'post')
    if (postRows.some(row => row.kind === 'finished') && (!prices.finishedWithCustom || !postRows.some(row => row.kind === 'custom'))) {
      throw Object.assign(new Error('Finished pieces can only ship together with a custom ornament sent by post.'), { code: 'SHIPPING_NEEDS_CUSTOM', field: 'delivery', status: 400 })
    }
    const customPaintDates = postRows.filter(row => row.kind === 'custom' && row.paintDate).map(row => row.paintDate!).sort()
    const readyOn = customPaintDates.at(-1) ?? todayDay().date
    postWindow = shippingWindowAfter(readyOn, postConfig())
    if (!postWindow.available || !postWindow.collectionDate) {
      throw Object.assign(new Error('Post shipping can no longer arrive before Christmas.'), { code: 'SHIPPING_UNAVAILABLE', status: 400 })
    }
    const postAddress = rows.find(row => row.deliveryKind === 'post' && row.address)?.address
    if (postAddress) {
      if (!postAddress.line1?.trim() || !postAddress.city?.trim()) {
        throw Object.assign(new Error('Add the shipping address.'), { code: 'VALIDATION', field: 'address', status: 400 })
      }
      if (!AUSTRIAN_POSTAL_REGEX.test(postAddress.postalCode?.trim() ?? '')) {
        throw Object.assign(new Error('Enter a four-digit Austrian postcode.'), { code: 'POSTAL_INVALID', field: 'address.postalCode', status: 400 })
      }
    }
  }

  for (const row of rows) {
    const itemId = uid('orn')
    const withName = row.kind === 'custom' && row.withName
    if (row.kind === 'custom' && row.size !== 'big' && row.size !== 'medium') throw invalidField('Choose Big (10 cm) or Medium (8 cm) for each personalised ornament.', `items[${createdItems.length}].size`)
    const cost = itemCost(row.kind, withName, prices, row.kind === 'custom' ? row.size : undefined)
    const isPost = row.deliveryKind === 'post'
    const handoff = isPost ? undefined : row.marketDayId ? state.marketDays.find(day => day.id === row.marketDayId)
      : row.kind === 'finished' && row.deliveryKind === 'market' ? soldOn : undefined
    const market = state.markets.find(m => m.id === handoff?.marketId && m.kind === 'market')
    const field = `items[${createdItems.length}].marketDayId`
    if (!isPost && row.marketDayId && !handoff) throw invalidField('Choose a calendar day.', field)
    if (row.deliveryKind === 'market' && row.kind === 'custom' && !market) throw invalidField('Choose a market day for the pickup.', field)
    if (handoff && handoff.date < today) throw invalidField('That pickup day has already passed.', field)
    if (row.deliveryKind === 'market' && handoff && row.pickupHour != null) {
      if (row.pickupHour < handoff.openHour || row.pickupHour >= handoff.closeHour) throw new Error('Pickup hour is outside market hours')
      if (handoff.date === today && row.pickupHour < DEMO_NOW_HOUR - 0.001) throw new Error('That pickup hour has already passed')
    }
    if (row.deliveryKind === 'vienna' && handoff && marketDaysOn(handoff.date).length) {
      throw Object.assign(new Error('That day is a market day: the stall has priority. Choose another delivery day.'), { code: 'DELIVERY_DAY_INVALID', status: 400 })
    }
    createdItems.push({
      id: itemId,
      orderId,
      kind: row.kind,
      marketOrnamentId: row.marketOrnamentId ?? null,
      petName: '',
      withName,
      color: row.kind === 'custom' ? row.color ?? 'red' : undefined,
      finish: row.kind === 'custom' ? row.finish ?? 'shiny' : undefined,
      size: row.kind === 'custom' ? row.size : undefined,
      backName: '',
      note: '',
      cost,
      productionStatus: row.kind === 'finished' ? 'finished' : 'not_started',
      photos: [],
      formComplete: false,
      delivery: isPost
        ? {
            kind: 'post',
            deliveryDate: postWindow!.collectionDate!,
            arrivalFrom: postWindow!.arrivalFrom,
            arrivalTo: postWindow!.arrivalTo,
            address: row.address ?? null,
          }
        : {
            kind: row.deliveryKind,
            marketId: row.deliveryKind === 'market' ? market?.id : undefined,
            marketName: row.deliveryKind === 'market' ? market?.name : undefined,
            marketDayId: handoff?.id,
            deliveryDate: handoff?.date ?? (row.kind === 'finished' && row.deliveryKind === 'market' ? today : undefined),
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
      if (row.deliveryKind === 'market') assertPaintingLocation(row.paintDate, handoff)
      const md = dayByDate(row.paintDate)
      if (!md) throw new Error('Cannot place paint block: no market day')
      const clashExisting = hasPaintOverlap(busyPaintRanges(md.date), row.paintStart, row.paintEnd, moving?.id)
      const deliveryDay = isPost ? { date: postWindow!.collectionDate! } : handoff
      const hours = paintingDay(md.date)
      if (row.paintEnd <= row.paintStart || row.paintStart < hours.openHour || row.paintEnd > hours.closeHour ||
        md.date < today || (md.isToday && row.paintStart < DEMO_NOW_HOUR) ||
        (row.deliveryKind === 'vienna' && row.paintDate === handoff?.date) ||
        !deliveryDay || (isPost ? row.paintDate >= deliveryDay.date : row.paintDate > deliveryDay.date) ||
        (row.paintDate === deliveryDay.date && row.deliveryKind === 'market' && row.pickupHour != null && row.paintEnd + 0.25 > row.pickupHour + 0.001) ||
        (move && destination?.date === md.date && hoursOverlap(row.paintStart, row.paintEnd, move.to.startHour, move.to.endHour))) {
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
    if (item.kind !== 'custom') continue
    const stock = listInventory().find(row => row.id === stockId(item.color ?? '', item.finish ?? 'shiny', item.size))
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
  if (postWindow?.collectionDate && !state.marketDays.some(day => day.date === postWindow!.collectionDate)) {
    const postDay = dayByDate(postWindow.collectionDate)
    if (postDay) state.marketDays.push(postDay)
  }
  const deliveryFee = hasPost ? prices.shippingFee : 0
  const order: Order = {
    id: orderId,
    customerId: customer.id,
    code,
    trackToken: uid('trk'),
    formToken: uid('frm'),
    paymentState: 'unpaid',
    paymentMethod: null,
    amountPaid: 0,
    deliveryFee,
    total: Math.round((createdItems.reduce((sum, item) => sum + item.cost, 0) + deliveryFee) * 100) / 100,
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
  if (soldOn) (state.soldOnMarketDays ??= {})[order.id] = soldOn.id
  state.orders.push(order)
  state.items.push(...createdItems)
  state.blocks.push(...createdBlocks)
  emit()
  return order
}

export function setPaymentState(orderId: string, paymentState: PaymentState, method?: PaymentMethod | null, amountPaid?: number) {
  const order = requireOrder(orderId)
  if (order.status === 'CANCELLED') throw new Error('This order is cancelled.')
  if (order.checkoutStatus === 'pending') throw Object.assign(new Error('Check this payment in Stripe first; Checkout is still pending.'), { code: 'PAYMENT_PENDING' })
  const amount = paymentState === 'paid' ? order.total : paymentState === 'unpaid' ? 0 : amountPaid ?? Math.round(order.total * 50) / 100
  if (!Number.isFinite(amount) || (paymentState === 'deposit' && (amount <= 0 || amount >= order.total))) throw new Error('Deposit must be greater than zero and less than the total.')
  if (order.checkoutStatus === 'review' || order.paymentReview) { order.checkoutStatus = 'confirmed'; order.paymentReview = false }
  order.amountPaid = amount
  order.paymentState = paymentState
  if (method !== undefined) order.paymentMethod = method
  emit()
  return order
}

export function recordPayment(orderId: string, amount: number, method: PaymentMethod): { order: Order; entry: PaymentEntry } {
  const order = requireOrder(orderId)
  if (order.status === 'CANCELLED') throw new Error('This order is cancelled.')
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
  const order = requireOrder(orderId)
  if (order.status === 'CANCELLED') throw new Error('This order is cancelled.')
  const item = state.items.find((i) => i.id === itemId && i.orderId === orderId)
  if (!item) throw new Error('Item not found')
  const newlyFinished = status === 'finished' && item.productionStatus !== 'finished'
  const blocks = state.blocks.filter(block => block.orderItemId === itemId)
  if (status !== 'finished' && item.productionStatus === 'finished' && !isCheckoutHold(order)) {
    const today = todayDay().date
    for (const block of blocks) {
      const date = marketDayDate(block.marketDayId)
      if (!date) continue
      const start = Math.max(block.startHour, paintElapsedUntil(date, today, DEMO_NOW_HOUR))
      if (start < block.endHour && hasPaintOverlap(busyPaintRanges(date), start, block.endHour, block.id)) {
        throw Object.assign(new Error('Another session has booked this painting time.'), { status: 409 })
      }
    }
  }
  item.productionStatus = status
  for (const block of blocks) {
    const today = todayDay().date
    if (newlyFinished && marketDayDate(block.marketDayId) === today) {
      const recordedEnd = paintElapsedUntil(today, today, DEMO_NOW_HOUR)
      if (recordedEnd < block.endHour) {
        if (DEMO_NOW_HOUR < block.startHour || recordedEnd <= block.startHour) block.startHour = recordedEnd - 0.25
        block.endHour = recordedEnd
      }
    }
    block.status = status
  }
  const siblings = state.items.filter((i) => i.orderId === orderId)
  if (status !== 'finished' && (item.handedOver ?? order.handedOver)) {
    for (const sibling of siblings) sibling.handedOver ??= order.handedOver
    item.handedOver = false
    order.handedOver = false
    order.handedOverAt = undefined
  }
  emit()
}

export function setHandedOver(orderId: string, handedOver: boolean, itemIds?: string[], trackingNumber?: string | null) {
  const order = requireOrder(orderId)
  if (order.status === 'CANCELLED') throw new Error('This order is cancelled.')
  const items = state.items.filter((i) => i.orderId === orderId)
  const selected = itemIds ? items.filter(i => itemIds.includes(i.id)) : items
  if (itemIds && (!itemIds.length || selected.length !== itemIds.length)) throw new Error('Select valid items from this order.')
  if (handedOver && selected.some(i => i.productionStatus !== 'finished')) throw new Error('Finish all ornaments before marking handed over')
  if (trackingNumber !== undefined) {
    const clean = (trackingNumber ?? '').trim() || null
    if (clean && !TRACKING_NUMBER_REGEX.test(clean)) {
      throw Object.assign(new Error('Enter a parcel number with 8–40 letters or digits.'), { code: 'VALIDATION', field: 'trackingNumber', status: 400 })
    }
    order.trackingNumber = clean
    order.trackingUrl = postTrackingUrl(clean)
  }
  for (const item of items) item.handedOver ??= order.handedOver
  for (const item of selected) item.handedOver = handedOver
  const complete = items.length > 0 && items.every(i => i.handedOver)
  if (complete !== order.handedOver) order.handedOverAt = complete ? new Date().toISOString() : undefined
  order.handedOver = complete
  emit()
}

function trackStatusFor(order: Order, items: OrderItem[]): TrackView['status'] {
  if (order.status === 'CANCELLED') return 'cancelled'
  // Like Order.isPostShipped: every Post item handed to the Post.
  const postItems = items.filter(i => i.delivery.kind === 'post')
  if (postItems.length && postItems.every(i => i.handedOver ?? order.handedOver)) return 'shipped'
  if (order.handedOver) return 'delivered'
  if (items.every((i) => i.productionStatus === 'finished')) return 'ready'
  return 'preparing'
}

export function getTrackByCode(code: string): TrackView {
  const order = getOrderByCode(code)
  if (!order) throw Object.assign(new Error('Order not found. Check the code.'), { code: 'ORDER_NOT_FOUND', status: 404 })
  const customer = state.customers.find((c) => c.id === order.customerId)
  const items = state.items.filter((i) => i.orderId === order.id)
  // Like TrackingService: a Post item describes the order's handoff when there is one.
  const first = items.find(i => i.delivery.kind === 'post') ?? items[0]
  const owner = readFormToken(order.code) === order.formToken
    && !(order.handedOver && order.handedOverAt && Date.now() - Date.parse(order.handedOverAt) >= 30 * 86400000)
  const personal = owner || order.code.length >= 9
  const day = first?.delivery.kind === 'market' ? pickupDayForItem(first) : undefined
  const market = state.markets.find(m => m.id === day?.marketId && m.kind === 'market')
  const trackingUrl = postTrackingUrl(order.trackingNumber)
  const when: TrackWhen =
    first?.delivery.kind === 'post'
      ? {
          kind: 'post',
          date: deliveryDateForItem(first),
          arrivalFrom: first.delivery.arrivalFrom ?? null,
          arrivalTo: first.delivery.arrivalTo ?? null,
          fromHour: null,
          toHour: null,
          marketName: null,
          untilHour: null,
        }
      : first?.delivery.kind === 'vienna'
        ? { kind: 'vienna', date: deliveryDateForItem(first), fromHour: 18, toHour: 20, marketName: null, untilHour: null }
        : day && market
          ? {
              kind: 'market',
              date: day.date,
              fromHour: first.delivery.pickupHour ?? null,
              marketName: market.name,
              untilHour: day.closeHour,
            }
          : { kind: 'unknown', date: null, fromHour: null, marketName: null, untilHour: null }

  return {
    total: order.total,
    paymentState: order.paymentState,
    code: order.code,
    status: trackStatusFor(order, items),
    customerName: personal ? customer?.name.split(' ')[0] ?? '' : '',
    trackingUrl,
    items: items.map((i) => ({
      color: i.color,
      finish: i.finish,
      size: i.size,
      cost: i.cost,
      petName: personal ? i.petName : '',
      kind: i.kind,
      productionStatus: i.productionStatus,
      withName: i.withName,
      backName: personal ? i.backName : '',
      deliveryKind: i.delivery.kind,
      arrivalFrom: i.delivery.arrivalFrom ?? null,
      arrivalTo: i.delivery.arrivalTo ?? null,
      handedOver: i.handedOver ?? order.handedOver,
    })),
    delivery: first ? { ...withPickupMarket(first).delivery, address: owner ? first.delivery.address : undefined } : { kind: 'market' },
    when,
  }
}

export function getForm(token: string): CustomerFormView {
  const order = state.orders.find((o) => o.formToken === token)
  if (!order || order.status === 'CANCELLED') throw new Error('This form link is not valid.')
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
      if (row.delivery.kind === 'post') {
        return {
          kind: 'post',
          date: deliveryDateForItem(row),
          arrivalFrom: row.delivery.arrivalFrom ?? null,
          arrivalTo: row.delivery.arrivalTo ?? null,
          fromHour: null,
          toHour: null,
          marketName: null,
          untilHour: null,
        }
      }
      const day = row.delivery.kind === 'market' ? pickupDayForItem(row) : undefined
      const market = state.markets.find(entry => entry.id === day?.marketId && entry.kind === 'market')
      return {
        kind: row.delivery.kind === 'vienna' ? 'vienna' : market ? 'market' : 'unknown',
        date: deliveryDateForItem(row),
        fromHour: row.delivery.kind === 'vienna' ? 18 : row.delivery.pickupHour ?? null,
        toHour: row.delivery.kind === 'vienna' ? 20 : null,
        marketName: market?.name ?? null,
        untilHour: day?.closeHour ?? null,
      }
    }),
    needsAddress: items.some((i) => i.delivery.kind === 'post' || i.delivery.kind === 'vienna'),
    address: items.find((i) => i.delivery.kind === 'post' || i.delivery.kind === 'vienna')?.delivery.address ?? null,
    editable: !order.handedOver && items.filter(i => i.kind === 'custom').every((i) => i.productionStatus === 'not_started'),
    withName: items.some((i) => i.withName),
    alreadySubmitted: items.every((i) => i.formComplete),
    customer,
    item,
  }
}

/** Same rule as PricingService.requireBackName: the staff limit, except a name already saved and re-sent unchanged. */
function requireBackName(raw: string | undefined, saved: string | null, field: string): void {
  const max = currentPrices().backNameMax ?? DEFAULT_BACK_NAME_MAX
  if (!paintedNameValid((raw ?? '').trim(), max, saved)) {
    throw Object.assign(new Error(`Use 1–${max} letters for the painted name.`), { code: 'VALIDATION', field, status: 400 })
  }
}

export function submitForm(token: string, payload: CustomerFormPayload): { orderCode: string } {
  const order = state.orders.find((o) => o.formToken === token)
  if (!order || order.status === 'CANCELLED') throw new Error('This form link is not valid.')
  if (order.handedOver && order.handedOverAt && Date.now() - Date.parse(order.handedOverAt) >= 30 * 86400000) throw Object.assign(new Error('Form expired.'), { code: 'FORM_EXPIRED', status: 404 })
  const customer = state.customers.find((c) => c.id === order.customerId)
  const items = state.items.filter((i) => i.orderId === order.id)
  const item = items.find((i) => i.kind === 'custom') ?? items[0]
  if (!customer || !item) throw new Error('Form data missing')
  if (!getForm(token).editable) throw Object.assign(new Error('Form is locked.'), { code: 'FORM_LOCKED', status: 409 })
  payload.items.forEach((incoming, index) => {
    const row = items.find(entry => entry.id === incoming.orderItemId)
    if (row?.withName) requireBackName(incoming.backName, row.backName || null, `items[${index}].backName`)
  })
  if (getForm(token).needsAddress) {
    if (!payload.address?.line1?.trim() || !payload.address?.city?.trim()) throw Object.assign(new Error('Address required.'), { code: 'VALIDATION', field: 'address' })
    if (!AUSTRIAN_POSTAL_REGEX.test(payload.address.postalCode?.trim() ?? '')) throw Object.assign(new Error('Invalid postal code.'), { code: 'POSTAL_INVALID', field: 'address.postalCode' })
    const cleanAddress = {
      line1: payload.address.line1.trim(),
      ...(payload.address.line2?.trim() ? { line2: payload.address.line2.trim() } : {}),
      postalCode: payload.address.postalCode.trim(),
      city: payload.address.city.trim(),
    }
    items.filter(i => i.delivery.kind === 'post' || i.delivery.kind === 'vienna').forEach(i => { i.delivery.address = cleanAddress })
  }
  customer.name = payload.customerName.trim()
  customer.phone = payload.phone.trim()
  customer.email = payload.email.trim()
  for (const incoming of payload.items) {
    const row = items.find((entry) => entry.id === incoming.orderItemId)
    if (!row) continue
    row.petName = incoming.petName.trim()
    row.note = incoming.note?.trim() ?? ''
    if (row.withName) row.backName = (incoming.backName ?? '').trim().toUpperCase()
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
  handoffMarketDayId?: string
}): CapacityResult {
  const message = paintingLocationMessage(input.date, state.marketDays.find(day => day.id === input.handoffMarketDayId))
  if (message) return { ok: false, slot: null, remainingHours: 0, message }
  return findFreeSlot(input.date, input.durationHours, input.afterHour, undefined, input.extraBusy, undefined, input.beforeHour)
}

export function findMoveSuggestion(input: {
  date: string
  durationHours: number
  handoffDate: string
  beforeHour?: number
  handoffMarketDayId?: string
}): MoveSuggestion | null {
  const pickup = state.marketDays.find(day => day.id === input.handoffMarketDayId)
  if (paintingLocationMessage(input.date, pickup)) return null
  const targetDay = dayByDate(input.date)
  if (!paintingDay(input.date).open || paintingDay(input.date).booked > paintingDay(input.date).maxPaintings) return null
  if (!targetDay || input.date > input.handoffDate || input.date < todayDay().date || input.durationHours <= 0) return null

  for (const block of blocksForDate(targetDay.date)) {
    const duration = block.endHour - block.startHour
    if (duration + 0.001 < input.durationHours || !block.orderItemId) continue
    if (input.beforeHour != null && block.startHour + input.durationHours > input.beforeHour + 0.001) continue
    if (block.status !== 'not_started' || (targetDay.isToday && block.startHour < DEMO_NOW_HOUR)) continue
    const item = state.items.find((row) => row.id === block.orderItemId)
    const order = item ? state.orders.find((row) => row.id === item.orderId) : undefined
    const handoff = item ? deliveryDateForItem(item) : null
    if (!item || !order || !handoff || item.productionStatus !== 'not_started') continue
    if (order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' || order.paymentReview) continue
    const itemPickup = item.delivery.kind === 'market' ? pickupDayForItem(item) : undefined

    const alternativeDates = paintDatesToTry(handoff, todayDay().date)
    for (const date of alternativeDates) {
      if (paintingLocationMessage(date, itemPickup)) continue
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
      if (date === handoff && (item.delivery.kind === 'vienna' || item.delivery.pickupHour == null || alternative.slot.endHour + 0.25 > item.delivery.pickupHour + 0.001)) continue
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

export function searchOrders(query: string): import('../../domain/types').OrderSummary[] {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []
  const phone = needle.replace(/\D/g, '')
  return state.orders.filter(order => {
    const customer = state.customers.find(row => row.id === order.customerId)
    return order.code.toLowerCase().includes(needle) || (customer?.name ?? '').toLowerCase().includes(needle) || (phone.length >= 3 && (customer?.phone ?? '').replace(/\D/g, '').includes(phone))
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20).map(orderSummary)
}
function orderSummary(order: Order): import('../../domain/types').OrderSummary {
  const bundle = getOrderBundle(order.id)
  const dates = bundle.items.map(item => item.delivery.deliveryDate ?? state.marketDays.find(day => day.id === item.delivery.marketDayId)?.date).filter((date): date is string => Boolean(date)).sort()
  const soldOn = order.source === 'web' ? undefined : state.soldOnMarketDays?.[order.id]
  const marketId = soldOn ? state.marketDays.find(day => day.id === soldOn)?.marketId : undefined
  const soldAtMarketName = state.markets.find(market => market.id === marketId)?.name ?? null
  return { id: order.id, code: order.code, customerName: bundle.customer.name, phone: bundle.customer.phone, createdAt: order.createdAt, paymentState: order.paymentState, checkoutStatus: order.checkoutStatus ?? (order.paymentReview ? 'review' : null), total: order.total, items: bundle.items.length, nextHandoffDate: dates[0] ?? null, handedOver: order.handedOver, source: order.source ?? 'stall', status: order.status ?? 'ACTIVE', amountPaid: paymentSummary(order).paid, soldAtMarketName, saleItems: [], needsReview: Boolean(order.needsReview) && order.status !== 'CANCELLED' }
}
/** Read-only snapshot for the mock Statistics endpoint. */
export function statsSource(): { orders: Order[]; items: import('../../domain/types').OrderItem[] } {
  return { orders: state.orders, items: state.items }
}
export function listSales(filters: import('../../domain/types').SalesFilters): import('../../domain/types').SalesPage {
  const result = filterSales(state.orders.map(orderSummary), filters)
  for (const order of result.orders) {
    order.saleItems = state.items.filter(item => item.orderId === order.id).map(item => ({
      id: item.id, kind: item.kind, color: item.color ?? null,
      photoUrl: item.photos[0]?.dataUrl ?? null, marketOrnamentId: item.marketOrnamentId ?? null,
    }))
  }
  return result
}
export function attentionOrders() {
  return state.orders.filter(order => order.status !== 'CANCELLED' && (order.needsReview || order.paymentReview || order.checkoutStatus === 'pending' || order.checkoutStatus === 'review')).map(orderSummary)
}
/** Mirrors POST /api/orders/{id}/reviewed: the first review time is kept. */
export function markOrderReviewed(id: string): Order {
  const order = requireOrder(id)
  if (order.needsReview) { order.needsReview = false; order.reviewedAt = new Date().toISOString(); emit() }
  return order
}
