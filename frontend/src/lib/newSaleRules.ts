import type { AgendaDay, Market, MarketDay } from '../domain/types'
import { isMarketPickupWeekday, paintDatesToTry } from './calendar'
import { pickupHourOptions } from './time'
import type { DraftDelivery, DraftItem, SaleDraft } from '../pages/staff/saleDraft'

/** Handling buffer between painting end and a same-day market pickup (15 minutes). */
export const PAINT_HANDLING_HOURS = 0.25

const EPS = 0.001

export function earliestPickupHourAfterPaint(paintEnd: number): number {
  return Math.ceil(paintEnd + PAINT_HANDLING_HOURS - 1e-6)
}

export function paintingMarketOn(days: AgendaDay[], date: string | undefined): Market | undefined {
  return days.find(day => day.marketDay.date === date && day.market.kind === 'market')?.market
}

export function paintDatesForPickup(date: string, marketId: string | undefined, firstPaintDate: string, agenda: AgendaDay[]): string[] {
  const market = paintingMarketOn(agenda, date)
  return paintDatesToTry(date, firstPaintDate).filter(day => day < date || !market || market.id === marketId)
}

/** True when an already-assigned paint slot fits the given handoff date, hour, and delivery mode. */
export function paintFitsHandoff(
  item: Pick<DraftItem, 'kind' | 'paintDate' | 'paintEnd'>,
  delivery: DraftDelivery,
): boolean {
  if (item.kind !== 'custom' || !item.paintDate || item.paintEnd == null) return false
  if (delivery.mode === 'post') return true
  if (!delivery.pickupDate) return false
  if (delivery.mode !== 'market' || item.paintDate > delivery.pickupDate) return false
  if (item.paintDate < delivery.pickupDate) return true
  return delivery.pickupHour == null || item.paintEnd + PAINT_HANDLING_HOURS <= delivery.pickupHour + EPS
}

export function latestLockedPaintDate(items: readonly DraftItem[]): string | undefined {
  let latest: string | undefined
  for (const item of items) {
    if (item.kind !== 'custom' || !item.slotLocked || !item.paintDate) continue
    if (!latest || item.paintDate > latest) latest = item.paintDate
  }
  return latest
}

export function lockedPaintMinHourOnDate(items: readonly DraftItem[], date: string): number | undefined {
  let minHour: number | undefined
  for (const item of items) {
    if (item.kind !== 'custom' || !item.slotLocked || item.paintDate !== date || item.paintEnd == null) continue
    const candidate = item.paintEnd + PAINT_HANDLING_HOURS
    if (minHour == null || candidate > minHour) minHour = candidate
  }
  return minHour
}

export function validMarketPickupHours(
  day: Pick<MarketDay, 'date' | 'openHour' | 'closeHour'>,
  paintItems: readonly DraftItem[],
  currentDate: string,
  nowHour: number,
): number[] {
  const minNow = day.date === currentDate ? nowHour : undefined
  const minPaint = lockedPaintMinHourOnDate(paintItems, day.date)
  const notBefore = minNow != null && minPaint != null
    ? Math.max(minNow, minPaint)
    : (minNow ?? minPaint)
  return pickupHourOptions(day.openHour, day.closeHour, notBefore)
}

export function isMarketDayValidForItems(
  day: MarketDay,
  paintItems: readonly DraftItem[],
  currentDate: string,
  nowHour: number,
  firstPaintDate: string,
  agendaDays: AgendaDay[],
): boolean {
  if (day.date < currentDate || !isMarketPickupWeekday(day.date)) return false
  if (validMarketPickupHours(day, paintItems, currentDate, nowHour).length === 0) return false
  for (const row of paintItems) {
    if (row.kind !== 'custom') continue
    if (row.slotLocked && row.paintDate) {
      if (day.date < row.paintDate) return false
      if (day.date === row.paintDate) {
        const pm = paintingMarketOn(agendaDays, day.date)
        if (pm && pm.id !== day.marketId) return false
      }
    }
  }
  if (paintItems.some(row => row.kind === 'custom' && !row.slotLocked) &&
      paintDatesForPickup(day.date, day.marketId, firstPaintDate, agendaDays).length === 0) {
    return false
  }
  return true
}

export function isSlotInPast(
  item: Pick<DraftItem, 'kind' | 'paintDate' | 'paintStart'>,
  currentDate: string,
  nowHour: number,
): boolean {
  if (item.kind !== 'custom' || !item.paintDate || item.paintStart == null) return false
  if (item.paintDate < currentDate) return true
  return item.paintDate === currentDate && item.paintStart < nowHour - EPS
}

export function isPickupInPast(delivery: DraftDelivery, currentDate: string, nowHour: number): boolean {
  if (delivery.mode === 'now' || delivery.mode === 'post') return false
  if (delivery.pickupDate && delivery.pickupDate < currentDate) return true
  if (delivery.mode === 'market' && delivery.pickupDate === currentDate && delivery.pickupHour != null && delivery.pickupHour < nowHour - EPS) {
    return true
  }
  return false
}

export type ReconcileContext = {
  currentDate: string
  nowHour: number
  firstPaintDate: string
  days: MarketDay[]
  markets: Market[]
  agendaDays: AgendaDay[]
  activeMarket: Market | null
  seasonEnd: string
}

function sameDelivery(a: DraftDelivery, b: DraftDelivery): boolean {
  return a.mode === b.mode &&
    a.marketId === b.marketId &&
    a.marketDayId === b.marketDayId &&
    a.pickupDate === b.pickupDate &&
    (a.pickupHour ?? null) === (b.pickupHour ?? null) &&
    Boolean(a.manualDay) === Boolean(b.manualDay)
}

function sameSlot(a: DraftItem, b: DraftItem): boolean {
  return a.paintDate === b.paintDate &&
    a.paintStart === b.paintStart &&
    a.paintEnd === b.paintEnd &&
    a.slotLocked === b.slotLocked &&
    a.fromCalendar === b.fromCalendar &&
    a.plannedMove === b.plannedMove
}

function plannedMoveStillValid(item: DraftItem, agendaDays: AgendaDay[]): boolean {
  const move = item.plannedMove
  if (!move || !agendaDays.length) return true
  const day = agendaDays.find(row => row.marketDay.date === move.from.date)
  if (!day) return false
  return day.slots.some(slot =>
    slot.block.id === move.blockId &&
    slot.block.status === 'not_started' &&
    Math.abs(slot.block.startHour - move.from.startHour) < EPS,
  )
}

function pickNextMarketDay(
  paintItems: readonly DraftItem[],
  ctx: ReconcileContext,
  preferredMarketId?: string,
): MarketDay | undefined {
  const marketDays = ctx.days
    .filter(d => ctx.markets.find(m => m.id === d.marketId)?.kind === 'market')
    .filter(d => isMarketDayValidForItems(d, paintItems, ctx.currentDate, ctx.nowHour, ctx.firstPaintDate, ctx.agendaDays))
  const pref = preferredMarketId ?? ctx.activeMarket?.id
  return marketDays
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || Number(b.marketId === pref) - Number(a.marketId === pref))[0]
}

function reconcileGroupDelivery(
  delivery: DraftDelivery,
  paintItems: readonly DraftItem[],
  ctx: ReconcileContext,
  options: { requireDayIfLocked?: boolean; hadPastDate?: boolean },
): DraftDelivery {
  if (delivery.mode === 'now' || delivery.mode === 'post') return delivery

  // Market mode
  const marketDays = ctx.days.filter(d => ctx.markets.find(m => m.id === d.marketId)?.kind === 'market')
  const hasDeliveryRef = Boolean(delivery.pickupDate || delivery.marketDayId)
  const hasLockedPaint = paintItems.some(row => row.kind === 'custom' && row.slotLocked && row.paintDate)

  if (!hasDeliveryRef && !options.hadPastDate && !(options.requireDayIfLocked && hasLockedPaint)) {
    return delivery
  }

  const matched =
    (delivery.marketDayId ? marketDays.find(d => d.id === delivery.marketDayId) : undefined) ??
    (delivery.pickupDate ? marketDays.find(d => d.date === delivery.pickupDate && (!delivery.marketId || d.marketId === delivery.marketId)) : undefined) ??
    (delivery.pickupDate ? marketDays.find(d => d.date === delivery.pickupDate) : undefined)

  const awayOnToday = Boolean(
    matched &&
    paintItems.some(row => row.kind === 'custom') &&
    matched.date === ctx.currentDate &&
    ctx.activeMarket &&
    matched.marketId === ctx.activeMarket.id &&
    paintingMarketOn(ctx.agendaDays, ctx.currentDate) &&
    paintingMarketOn(ctx.agendaDays, ctx.currentDate)!.id !== matched.marketId,
  )

  if (matched && !awayOnToday && isMarketDayValidForItems(matched, paintItems, ctx.currentDate, ctx.nowHour, ctx.firstPaintDate, ctx.agendaDays)) {
    const validHours = validMarketPickupHours(matched, paintItems, ctx.currentDate, ctx.nowHour)
    let nextHour = delivery.pickupHour ?? null
    if (nextHour != null && !validHours.includes(nextHour)) {
      const fromCal = paintItems.some(row => row.fromCalendar && row.paintDate === matched.date)
      nextHour = fromCal ? (validHours[0] ?? null) : null
    }
    if (delivery.marketDayId === matched.id && delivery.marketId === matched.marketId && delivery.pickupDate === matched.date && (delivery.pickupHour ?? null) === nextHour) {
      return delivery
    }
    return { ...delivery, marketDayId: matched.id, marketId: matched.marketId, pickupDate: matched.date, pickupHour: nextHour }
  }

  // Existing day was invalid (past, before locked paint, wrong market, no valid hours) or locked item had no day yet.
  const fallback = pickNextMarketDay(paintItems, ctx, delivery.marketId)
  if (!fallback) {
    return { mode: 'market', pickupDate: undefined, marketDayId: undefined, marketId: undefined, pickupHour: null, manualDay: false }
  }
  const fromCalSameDay = paintItems.some(row => row.fromCalendar && row.paintDate === fallback.date)
  const validHours = validMarketPickupHours(fallback, paintItems, ctx.currentDate, ctx.nowHour)
  return {
    mode: 'market',
    pickupDate: fallback.date,
    marketDayId: fallback.id,
    marketId: fallback.marketId,
    pickupHour: fromCalSameDay ? (validHours[0] ?? null) : null,
    manualDay: false,
  }
}

export function reconcileDraftWithClockAndAgenda(
  draft: SaleDraft,
  ctx: ReconcileContext,
): { draft: SaleDraft; changed: boolean; notice: string | null } {
  if (draft.order || draft.phase === 'done' || !draft.items.length || !ctx.days.length) {
    return { draft, changed: false, notice: null }
  }

  let changed = false
  let notice: string | null = null

  // 1. Drop expired/past paint slots or stale move suggestions.
  const slotChecked = draft.items.map((item) => {
    if (isSlotInPast(item, ctx.currentDate, ctx.nowHour)) {
      changed = true
      notice = 'The earlier paint slot has already passed and was cleared so we can re-plan.'
      return {
        ...item,
        paintDate: undefined,
        paintStart: undefined,
        paintEnd: undefined,
        slotLocked: false,
        fromCalendar: false,
        plannedMove: undefined,
      }
    }
    if (item.plannedMove && !plannedMoveStillValid(item, ctx.agendaDays)) {
      changed = true
      notice = 'The agenda changed — recalculating paint times.'
      return {
        ...item,
        paintDate: undefined,
        paintStart: undefined,
        paintEnd: undefined,
        slotLocked: false,
        plannedMove: undefined,
      }
    }
    return item
  })

  // 2. Reconcile deliveries (shared vs per-item).
  const mixed = slotChecked.some(i => i.kind === 'custom') && slotChecked.some(i => i.kind === 'finished')
  const shared = !(draft.differentPickups || mixed)
  const allPaint = slotChecked.filter(i => i.kind === 'custom')

  const sanitizeDelivery = (delivery: DraftDelivery): { delivery: DraftDelivery; hadPastDate: boolean } => {
    if (delivery.mode === 'now') return { delivery, hadPastDate: false }
    if (delivery.pickupDate && delivery.pickupDate < ctx.currentDate) {
      notice ??= 'The earlier pickup date had passed and was updated.'
      return { delivery: { ...delivery, pickupDate: undefined, marketDayId: undefined, pickupHour: null, manualDay: false }, hadPastDate: true }
    }
    if (delivery.mode === 'market' && delivery.pickupDate === ctx.currentDate && delivery.pickupHour != null && delivery.pickupHour < ctx.nowHour - EPS) {
      notice ??= 'The earlier pickup hour had passed and was cleared.'
      return { delivery: { ...delivery, pickupHour: null }, hadPastDate: false }
    }
    return { delivery, hadPastDate: false }
  }

  let reconciledItems: DraftItem[]
  if (shared) {
    // Choose a reference delivery (prefer any item with a locked paint date on its pickup, else item[0]).
    const sanitized = sanitizeDelivery(slotChecked[0].delivery)
    const nextShared = reconcileGroupDelivery(sanitized.delivery, allPaint, ctx, { requireDayIfLocked: true, hadPastDate: sanitized.hadPastDate })
    reconciledItems = slotChecked.map((item) => {
      const deliveryChanged = !sameDelivery(item.delivery, nextShared)
      if (!deliveryChanged) return item
      changed = true
      const keepSlot = !item.slotLocked
        ? false
        : !item.plannedMove && (!nextShared.pickupDate || (paintFitsHandoff(item, nextShared) && (!paintingMarketOn(ctx.agendaDays, item.paintDate) || nextShared.mode !== 'market' || item.paintDate !== nextShared.pickupDate || paintingMarketOn(ctx.agendaDays, item.paintDate)!.id === nextShared.marketId)))
      if (!item.slotLocked || !keepSlot) {
        return {
          ...item,
          delivery: nextShared,
          paintDate: undefined,
          paintStart: undefined,
          paintEnd: undefined,
          slotLocked: false,
          plannedMove: undefined,
        }
      }
      return { ...item, delivery: nextShared }
    })
  } else {
    reconciledItems = slotChecked.map((item) => {
      const sanitized = sanitizeDelivery(item.delivery)
      const groupPaint = item.kind === 'custom' ? [item] : []
      const nextDelivery = reconcileGroupDelivery(sanitized.delivery, groupPaint, ctx, { requireDayIfLocked: true, hadPastDate: sanitized.hadPastDate })
      if (sameDelivery(item.delivery, nextDelivery)) return item
      changed = true
      return { ...item, delivery: nextDelivery }
    })
  }

  for (let i = 0; i < draft.items.length; i++) {
    if (!sameSlot(draft.items[i], reconciledItems[i]) || !sameDelivery(draft.items[i].delivery, reconciledItems[i].delivery)) {
      changed = true
      break
    }
  }

  return changed
    ? { draft: { ...draft, items: reconciledItems }, changed: true, notice }
    : { draft, changed: false, notice: null }
}

/** When switching back from "Different pickup times" to shared pickup, align every item cleanly. */
export function syncSharedDelivery(items: DraftItem[], ctx: ReconcileContext): DraftItem[] {
  if (!items.length) return items
  const allPaint = items.filter(i => i.kind === 'custom')
  // Prefer the latest valid delivery among items so locked later slots are respected.
  const candidates = items
    .map(i => i.delivery)
    .filter(d => d.mode !== 'now' && d.pickupDate)
    .sort((a, b) => (b.pickupDate ?? '').localeCompare(a.pickupDate ?? '') || (b.pickupHour ?? -1) - (a.pickupHour ?? -1))
  const base = candidates[0] ?? items[0].delivery
  const normalizedBase: DraftDelivery = base.mode === 'now' ? { mode: 'market' } : base
  const sharedDelivery = reconcileGroupDelivery(normalizedBase, allPaint, ctx, { requireDayIfLocked: true })
  return items.map((item) => {
    const keepLocked = item.slotLocked && !item.plannedMove && (!sharedDelivery.pickupDate || paintFitsHandoff(item, sharedDelivery))
    return {
      ...item,
      delivery: sharedDelivery,
      ...(keepLocked ? {} : { paintDate: undefined, paintStart: undefined, paintEnd: undefined, slotLocked: false, plannedMove: undefined }),
    }
  })
}
