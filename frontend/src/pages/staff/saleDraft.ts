import type { Address, CapacityResult, CustomFinish, CreateSaleItemInput, ItemKind, Market, MarketDay, OrnamentColor } from '../../domain/types'
import { marketOrnamentLabel, marketOrnamentParts } from '../../domain/marketStock'
import { isMarketPickupWeekday } from '../../lib/calendar'
import { earliestPickupHourAfterPaint, PAINT_HANDLING_HOURS } from '../../lib/newSaleRules'
import { formatDateLabel, formatHour, formatMinutes, hoursOverlap } from '../../lib/time'
import { itemCost, type Pricing } from '../../lib/money'

export const SALE_DRAFT_KEY = 'awg-sale-draft'

export type DurationPreset = '45' | '60' | '75' | 'custom'
export type DeliveryMode = 'now' | 'market' | 'vienna'
export type SalePhase = 'items' | 'delivery' | 'qr' | 'payment' | 'done'

export type DraftDelivery = {
  mode: DeliveryMode
  marketId?: string
  marketDayId?: string
  pickupDate?: string
  pickupHour?: number | null
  address?: Address
  manualDay?: boolean
}

export type DraftItem = {
  plannedMove?: import('../../domain/types').MoveSuggestion
  id: string
  kind: ItemKind
  marketOrnamentId?: string
  withName: boolean
  color: OrnamentColor
  finish: CustomFinish
  durationMinutes: number
  durationPreset: DurationPreset
  paintDate?: string
  paintStart?: number
  paintEnd?: number
  fromCalendar: boolean
  slotLocked: boolean
  delivery: DraftDelivery
}

export type CreatedSaleRef = {
  id: string
  code: string
  formToken: string
  total: number
}

export type SaleDraft = {
  items: DraftItem[]
  differentPickups: boolean
  phase: SalePhase
  order?: CreatedSaleRef
  idempotencyKey?: string
  placingItemId?: string
}

export function newDraftId(): string {
  return `draft-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyDraft(): SaleDraft {
  return { items: [], differentPickups: false, phase: 'items' }
}

export function readStoredDraft(): SaleDraft | null {
  try {
    const raw = sessionStorage.getItem(SALE_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SaleDraft
  } catch {
    return null
  }
}

export function writeStoredDraft(draft: SaleDraft) {
  sessionStorage.setItem(SALE_DRAFT_KEY, JSON.stringify(draft))
}

export function clearStoredDraft() {
  sessionStorage.removeItem(SALE_DRAFT_KEY)
}

export function presetFromMinutes(minutes: number): DurationPreset {
  if (minutes === 45) return '45'
  if (minutes === 60) return '60'
  if (minutes === 75) return '75'
  return 'custom'
}

export function makeCustom(partial?: Partial<DraftItem>): DraftItem {
  const minutes = partial?.durationMinutes ?? 60
  return {
    id: newDraftId(),
    withName: false,
    color: partial?.color ?? 'red',
    finish: partial?.finish ?? 'shiny',
    durationMinutes: minutes,
    durationPreset: presetFromMinutes(minutes),
    fromCalendar: false,
    slotLocked: false,
    delivery: { mode: 'market' },
    ...partial,
    kind: 'custom',
  }
}

export function makeFinished(marketOrnamentId?: string): DraftItem {
  return {
    id: newDraftId(),
    kind: 'finished',
    marketOrnamentId,
    withName: false,
    color: 'red',
    finish: 'shiny',
    durationMinutes: 0,
    durationPreset: '60',
    fromCalendar: false,
    slotLocked: false,
    delivery: { mode: 'now' },
  }
}

export function makeCustomFromSlot(date: string, start: number, end: number): DraftItem {
  const minutes = Math.max(15, Math.round((end - start) * 60))
  return makeCustom({
    durationMinutes: minutes,
    durationPreset: presetFromMinutes(minutes),
    paintDate: date,
    paintStart: start,
    paintEnd: end,
    fromCalendar: true,
    slotLocked: true,
    delivery: {
      mode: 'market',
      pickupDate: isMarketPickupWeekday(date) ? date : undefined,
      pickupHour: isMarketPickupWeekday(date) ? earliestPickupHourAfterPaint(end) : null,
    },
  })
}

export function applySlot(item: DraftItem, date: string, start: number, end: number): DraftItem {
  const minutes = Math.max(15, Math.round((end - start) * 60))
  if (item.delivery.mode === 'vienna') {
    const validViennaDate = item.delivery.pickupDate && item.delivery.pickupDate > date ? item.delivery.pickupDate : undefined
    return {
      ...item,
      durationMinutes: minutes,
      durationPreset: presetFromMinutes(minutes),
      paintDate: date,
      paintStart: start,
      paintEnd: end,
      fromCalendar: true,
      slotLocked: true,
      delivery: {
        ...item.delivery,
        mode: 'vienna',
        pickupDate: validViennaDate,
        ...(validViennaDate ? {} : { marketDayId: undefined, manualDay: false }),
        pickupHour: null,
      },
    }
  }
  const existingDate = item.delivery.pickupDate
  const keepExistingDate = Boolean(existingDate && existingDate >= date && isMarketPickupWeekday(existingDate))
  const pickupDate = keepExistingDate ? existingDate : (isMarketPickupWeekday(date) ? date : undefined)
  const dateChanged = pickupDate !== existingDate
  const minSameDayHour = end + PAINT_HANDLING_HOURS - 0.001
  const keepHour = pickupDate === date
    ? (item.delivery.pickupHour != null && item.delivery.pickupHour >= minSameDayHour
      ? item.delivery.pickupHour
      : earliestPickupHourAfterPaint(end))
    : (pickupDate && pickupDate > date ? (item.delivery.pickupHour ?? null) : null)
  return {
    ...item,
    durationMinutes: minutes,
    durationPreset: presetFromMinutes(minutes),
    paintDate: date,
    paintStart: start,
    paintEnd: end,
    fromCalendar: true,
    slotLocked: true,
    delivery: {
      ...item.delivery,
      mode: 'market',
      pickupDate,
      ...(dateChanged ? { marketDayId: undefined, manualDay: false } : {}),
      pickupHour: keepHour,
    },
  }
}

export function draftTotal(items: DraftItem[], prices: Pricing): number {
  return Math.round(items.reduce((sum, item) => sum + itemCost(item.kind, item.withName, prices), 0) * 100) / 100
}

export function paintMinutes(items: DraftItem[]): number {
  return items.filter((item) => item.kind === 'custom').reduce((sum, item) => sum + item.durationMinutes, 0)
}

export function itemLabel(item: DraftItem, index: number): string {
  if (item.kind === 'finished' && item.marketOrnamentId) return marketOrnamentLabel(item.marketOrnamentId)
  return `${item.kind === 'custom' ? 'Custom' : 'Finished'} ${index + 1}`
}

/** Short attribute line for numbered market ornaments: "Red · M" (S = Shiny, M = Matte). */
export function marketPieceShortSpec(id?: string | null): string | null {
  if (!id) return null
  const parts = marketOrnamentParts(id)
  return parts ? `${parts.color.label} · ${parts.finish.code}` : null
}

export function duplicateMarketPiece(items: DraftItem[]): string | null {
  const seen = new Set<string>()
  for (const item of items) {
    if (item.kind !== 'finished' || !item.marketOrnamentId) continue
    if (seen.has(item.marketOrnamentId)) return item.marketOrnamentId
    seen.add(item.marketOrnamentId)
  }
  return null
}

export function slotLabel(item: DraftItem): string | null {
  if (item.kind !== 'custom' || item.paintStart == null || item.paintEnd == null || !item.paintDate) return null
  return `${formatDateLabel(item.paintDate)} · ${formatHour(item.paintStart)}–${formatHour(item.paintEnd)}`
}

export function deliveryLabel(item: DraftItem, markets: Market[], days: MarketDay[]): string {
  if (item.kind === 'finished' && item.delivery.mode === 'now') return 'Deliver now'
  if (item.delivery.mode === 'vienna') {
    return item.delivery.pickupDate ? `Vienna delivery · ${formatDateLabel(item.delivery.pickupDate)}` : 'Vienna delivery · day not chosen'
  }
  // No place or date until a pickup day is chosen.
  if (!item.delivery.pickupDate) return 'Pickup · day not chosen'
  const day = days.find((d) => d.id === item.delivery.marketDayId) ?? days.find((d) => d.date === item.delivery.pickupDate)
  const market = markets.find((m) => m.id === (item.delivery.marketId ?? day?.marketId))
  const date = formatDateLabel(day?.date ?? item.delivery.pickupDate)
  const hour = item.delivery.pickupHour != null ? formatHour(item.delivery.pickupHour) : null
  return [market?.name, date, hour].filter(Boolean).join(' · ')
}

export function suggestionCopy(result: CapacityResult | undefined, busy: boolean): string {
  if (busy) return 'Looking for a free slot…'
  if (!result) return ''
  if (result.ok && result.slot) {
    return `Suggested paint ${formatDateLabel(result.slot.date)} · ${formatHour(result.slot.startHour)}–${formatHour(result.slot.endHour)}`
  }
  return 'No free paint slot before this handoff.'
}

export function toCreateItems(items: DraftItem[], days: MarketDay[], today?: MarketDay): CreateSaleItemInput[] {
  return items.map((item) => {
    const mode = item.kind === 'finished' && item.delivery.mode === 'now' ? 'now' : item.delivery.mode
    const pickupDay =
      mode === 'now'
        ? (today ?? days.find((d) => d.id === item.delivery.marketDayId) ?? days.find((d) => d.date === item.delivery.pickupDate))
        : (days.find((d) => d.id === item.delivery.marketDayId) ?? days.find((d) => d.date === item.delivery.pickupDate))
    const deliveryKind = mode === 'vienna' ? 'vienna' : 'market'
    return {
      kind: item.kind,
      marketOrnamentId: item.kind === 'finished' ? item.marketOrnamentId : undefined,
      withName: item.kind === 'custom' && item.withName,
      color: item.kind === 'custom' ? item.color : undefined,
      finish: item.kind === 'custom' ? item.finish ?? 'shiny' : undefined,
      paintDate: item.kind === 'custom' ? item.paintDate : undefined,
      paintStart: item.kind === 'custom' ? item.paintStart : undefined,
      paintEnd: item.kind === 'custom' ? item.paintEnd : undefined,
      deliveryKind,
      marketId: deliveryKind === 'market' ? (mode === 'now' ? pickupDay?.marketId : (item.delivery.marketId ?? pickupDay?.marketId)) : undefined,
      marketDayId: mode === 'now' ? pickupDay?.id : (item.delivery.marketDayId ?? pickupDay?.id),
      pickupHour: deliveryKind === 'vienna' ? null : mode === 'now' ? (item.delivery.pickupHour ?? null) : (item.delivery.pickupHour ?? null),
      address: deliveryKind === 'vienna' ? (item.delivery.address ?? null) : null,
    }
  })
}

export const SLOT_TAKEN_COPY = 'That hour is taken · change / place on board'

export function saleErrorMessage(err: unknown, fallback = 'Could not create sale'): string {
  const msg = err instanceof Error ? err.message : ''
  return msg || fallback
}

export function buildDraftFromParams(params: URLSearchParams): SaleDraft {
  if (params.get('fresh')) {
    clearStoredDraft()
    return emptyDraft()
  }

  const date = params.get('date')
  const startRaw = params.get('start')
  const endRaw = params.get('end')
  const placeItem = params.get('placeItem')
  const stored = readStoredDraft()
  const rawPhase = stored ? ((stored.phase as string) === 'formWhere' ? 'qr' as const : stored.phase) : null
  const validItems = stored && Array.isArray(stored.items)
    ? stored.items
        .filter((item): item is DraftItem => Boolean(item && typeof item.id === 'string' && (item.kind === 'custom' || item.kind === 'finished') && item.delivery && typeof item.delivery.mode === 'string'))
        .map((item) => ({ ...item, color: item.color ?? 'red' as const, finish: item.finish ?? 'shiny' as const }))
    : []
  const normalizedStored: SaleDraft | null = stored && validItems.length
    ? {
        ...stored,
        phase: !stored.order && rawPhase && ['qr', 'payment', 'done'].includes(rawPhase) ? 'items' : (rawPhase ?? 'items'),
        items: validItems,
      }
    : null

  if (date && startRaw != null && endRaw != null && startRaw !== '' && endRaw !== '') {
    const start = Number(startRaw)
    const end = Number(endRaw)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      if (placeItem && normalizedStored) {
        const has = normalizedStored.items.some((item) => item.id === placeItem)
        const others = normalizedStored.items.map((item) =>
          item.id !== placeItem && !item.slotLocked && item.paintDate === date && item.paintStart != null && item.paintEnd != null && hoursOverlap(start, end, item.paintStart, item.paintEnd)
            ? { ...item, paintDate: undefined, paintStart: undefined, paintEnd: undefined }
            : item,
        )
        return {
          ...normalizedStored,
          placingItemId: undefined,
          phase: 'delivery',
          items: has
            ? others.map((item) => (item.id === placeItem ? applySlot(item, date, start, end) : item))
            : [...others, makeCustomFromSlot(date, start, end)],
        }
      }
      return {
        items: [makeCustomFromSlot(date, start, end)],
        differentPickups: false,
        phase: 'items',
      }
    }
  }

  if (normalizedStored && normalizedStored.phase !== 'done' && normalizedStored.items.length) {
    return { ...normalizedStored, placingItemId: undefined }
  }

  return emptyDraft()
}

export { formatMinutes }
