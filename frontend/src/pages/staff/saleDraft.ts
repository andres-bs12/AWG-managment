import type { Address, CapacityResult, CreateSaleItemInput, ItemKind, Market, MarketDay } from '../../domain/types'
import { formatDateLabel, formatHour, formatMinutes } from '../../lib/time'
import { itemCost } from '../../lib/money'

export const SALE_DRAFT_KEY = 'awg-sale-draft'

export type DurationPreset = '45' | '60' | '75' | 'custom'
export type DeliveryMode = 'now' | 'market' | 'vienna'
export type SalePhase = 'items' | 'delivery' | 'qr' | 'formWhere' | 'payment' | 'done'

export type DraftDelivery = {
  mode: DeliveryMode
  marketId?: string
  marketDayId?: string
  pickupDate?: string
  pickupHour?: number | null
  address?: Address
}

export type DraftItem = {
  id: string
  kind: ItemKind
  withName: boolean
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
    durationMinutes: minutes,
    durationPreset: presetFromMinutes(minutes),
    fromCalendar: false,
    slotLocked: false,
    delivery: { mode: 'market' },
    ...partial,
    kind: 'custom',
  }
}

export function makeFinished(): DraftItem {
  return {
    id: newDraftId(),
    kind: 'finished',
    withName: false,
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
    delivery: { mode: 'market', pickupDate: date, pickupHour: end },
  })
}

export function applySlot(item: DraftItem, date: string, start: number, end: number): DraftItem {
  const minutes = Math.max(15, Math.round((end - start) * 60))
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
      mode: item.delivery.mode === 'vienna' ? 'vienna' : 'market',
      pickupDate: item.delivery.mode === 'vienna' ? item.delivery.pickupDate : date,
      pickupHour: item.delivery.mode === 'vienna' ? null : (item.delivery.pickupHour ?? end),
    },
  }
}

export function draftTotal(items: DraftItem[]): number {
  return items.reduce((sum, item) => sum + itemCost(item.kind, item.withName), 0)
}

export function paintMinutes(items: DraftItem[]): number {
  return items.filter((item) => item.kind === 'custom').reduce((sum, item) => sum + item.durationMinutes, 0)
}

export function itemLabel(item: DraftItem, index: number): string {
  return `${item.kind === 'custom' ? 'Custom' : 'Finished'} ${index + 1}`
}

export function slotLabel(item: DraftItem): string | null {
  if (item.kind !== 'custom' || item.paintStart == null || item.paintEnd == null || !item.paintDate) return null
  return `${formatDateLabel(item.paintDate)} · ${formatHour(item.paintStart)}–${formatHour(item.paintEnd)}`
}

export function deliveryLabel(item: DraftItem, markets: Market[], days: MarketDay[]): string {
  if (item.kind === 'finished' && item.delivery.mode === 'now') return 'Deliver now'
  if (item.delivery.mode === 'vienna') {
    const date = item.delivery.pickupDate ? formatDateLabel(item.delivery.pickupDate) : null
    return ['Vienna · Wed/Fri · no clock', date].filter(Boolean).join(' · ')
  }
  const day = days.find((d) => d.id === item.delivery.marketDayId) ?? days.find((d) => d.date === item.delivery.pickupDate)
  const market = markets.find((m) => m.id === (item.delivery.marketId ?? day?.marketId))
  const date = day ? formatDateLabel(day.date) : item.delivery.pickupDate ? formatDateLabel(item.delivery.pickupDate) : 'Market day'
  const hour = item.delivery.pickupHour != null ? formatHour(item.delivery.pickupHour) : null
  return [market?.name, date, hour].filter(Boolean).join(' · ')
}

export function suggestionCopy(result: CapacityResult | undefined, busy: boolean): string {
  if (busy) return 'Looking for a free slot…'
  if (!result) return ''
  if (result.ok && result.slot) {
    return `Suggested ${formatHour(result.slot.startHour)}–${formatHour(result.slot.endHour)}`
  }
  return 'No free slot on this day.'
}

export function toCreateItems(items: DraftItem[], days: MarketDay[], today?: MarketDay): CreateSaleItemInput[] {
  return items.map((item) => {
    const mode = item.kind === 'finished' && item.delivery.mode === 'now' ? 'now' : item.delivery.mode
    const pickupDay =
      days.find((d) => d.id === item.delivery.marketDayId) ??
      days.find((d) => d.date === item.delivery.pickupDate) ??
      (mode === 'now' ? today : undefined)
    const deliveryKind = mode === 'vienna' ? 'vienna' : 'market'
    return {
      kind: item.kind,
      withName: item.kind === 'custom' && item.withName,
      paintDate: item.kind === 'custom' ? item.paintDate : undefined,
      paintStart: item.kind === 'custom' ? item.paintStart : undefined,
      paintEnd: item.kind === 'custom' ? item.paintEnd : undefined,
      deliveryKind,
      marketId: deliveryKind === 'market' ? (item.delivery.marketId ?? pickupDay?.marketId) : undefined,
      marketDayId: deliveryKind === 'market' ? (item.delivery.marketDayId ?? pickupDay?.id) : undefined,
      pickupHour: deliveryKind === 'vienna' ? null : mode === 'now' ? (item.delivery.pickupHour ?? null) : (item.delivery.pickupHour ?? null),
      address: deliveryKind === 'vienna' ? (item.delivery.address ?? null) : null,
    }
  })
}

export function extraBusyFor(items: DraftItem[], itemId: string, date: string) {
  return items
    .filter((item) => item.id !== itemId && item.kind === 'custom' && item.paintDate === date && item.paintStart != null && item.paintEnd != null)
    .map((item) => ({ startHour: item.paintStart!, endHour: item.paintEnd! }))
}

export const SLOT_TAKEN_COPY = 'That hour is taken · change / place on board'

export function saleErrorMessage(err: unknown, fallback = 'Could not create sale'): string {
  const msg = err instanceof Error ? err.message : ''
  if (/overlap/i.test(msg) || /hour is taken/i.test(msg)) return SLOT_TAKEN_COPY
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

  if (date && startRaw != null && endRaw != null && startRaw !== '' && endRaw !== '') {
    const start = Number(startRaw)
    const end = Number(endRaw)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      if (placeItem && stored) {
        const has = stored.items.some((item) => item.id === placeItem)
        return {
          ...stored,
          placingItemId: undefined,
          phase: 'delivery',
          items: has
            ? stored.items.map((item) => (item.id === placeItem ? applySlot(item, date, start, end) : item))
            : [...stored.items, makeCustomFromSlot(date, start, end)],
        }
      }
      return {
        items: [makeCustomFromSlot(date, start, end)],
        differentPickups: false,
        phase: 'items',
      }
    }
  }

  if (stored && stored.phase !== 'done' && stored.items.length) {
    return { ...stored, placingItemId: undefined }
  }

  return emptyDraft()
}

export { formatMinutes }
