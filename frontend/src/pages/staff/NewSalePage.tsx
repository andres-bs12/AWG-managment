import { StaffText } from '../../components/staff/StaffText'
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { StaffActions } from '../../components/staff/StaffActions'
import { StaffDialog } from '../../components/staff/StaffDialog'
import { CustomerHandoff } from '../../components/staff/CustomerHandoff'
import { InsetNote } from '../../components/public/PublicForm'
import { HelpTip } from '../../components/ui/HelpTip'
import { useStaffClock } from '../../lib/staffClock'
import { useStaffMarket } from '../../lib/staffMarket'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { useOrderFormStatus } from '../../lib/useOrderFormStatus'
import { DEMO_NOW_HOUR } from 'demo-source'
import { QrCode } from '../../components/staff/QrCode'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { ChoiceList } from '../../components/ui/ChoiceList'
import { Field } from '../../components/ui/Field'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { marketOrnamentLabel, marketOrnamentParts, type MarketOrnament } from '../../domain/marketStock'
import type { AgendaDay, CapacityResult, Market, MarketDay, MoveSuggestion, OrnamentColor, PaymentMethod, PaymentState, InventoryItem, PaintingDay } from '../../domain/types'
import { isMarketPickupWeekday, isViennaWeekday, paintDatesToTry } from '../../lib/calendar'
import {
  isMarketDayValidForItems,
  isPickupInPast,
  isViennaDayValidForItems,
  latestLockedPaintDate,
  PAINT_HANDLING_HOURS,
  paintDatesForPickup,
  paintFitsHandoff,
  paintingMarketOn,
  reconcileDraftWithClockAndAgenda,
  syncSharedDelivery,
  validMarketPickupHours,
} from '../../lib/newSaleRules'
import { addUtcDays, formatDateLabel, formatHour, hoursOverlap, minutesToHours } from '../../lib/time'
import { formatEur, itemCost, type Pricing } from '../../lib/money'
import { OrderSummaryPanel } from './OrderSummaryPanel'
import { MarketOrnamentPicker, MarketPiecePhoto } from './MarketOrnamentPicker'
import {
  draftTotal,
  buildDraftFromParams,
  clearStoredDraft,
  duplicateMarketPiece,
  itemLabel,
  makeCustom,
  makeFinished,
  marketPieceShortSpec,
  saleErrorMessage,
  SLOT_TAKEN_COPY,
  slotLabel,
  toCreateItems,
  writeStoredDraft,
  type DeliveryMode,
  type DraftItem,
  type DurationPreset,
  type SaleDraft,
  type SalePhase,
} from './saleDraft'
import styles from './NewSalePage.module.css'
import { uid } from '../../lib/uid'
import { upcomingWindows } from '../../lib/dateWindows'
import { finishForColor, firstAvailableCustom, remainingColor, remainingStock, stockLabel } from '../../lib/saleStock'
import { apiError } from '../../lib/apiError'

const MIN_PAINT_MINUTES = 15
const MAX_PAINT_MINUTES = 8 * 60
const PAINT_STEP_MINUTES = 15

const DURATION_OPTIONS: { value: DurationPreset; label: string; minutes: number }[] = [
  { value: '45', label: '45 min', minutes: 45 },
  { value: '60', label: '1 h', minutes: 60 },
  { value: '75', label: '1 h 15', minutes: 75 },
  { value: 'custom', label: 'Custom', minutes: 0 },
]

function clampPaintMinutes(value: number): number {
  if (!Number.isFinite(value)) return MIN_PAINT_MINUTES
  return Math.min(MAX_PAINT_MINUTES, Math.max(MIN_PAINT_MINUTES, Math.round(value)))
}

function fillDayRefs(
  item: DraftItem,
  days: MarketDay[],
  markets: Market[],
  seasonEnd: string,
  activeMarket?: Market | null,
  currentDate?: string,
): DraftItem {
  if (item.delivery.mode === 'now') return item
  if (item.delivery.mode === 'vienna') {
    const date = item.delivery.pickupDate
    const eligible = days.filter(d => (isViennaWeekday(d.date) || d.date === seasonEnd) && d.date <= seasonEnd && !days.some(other => other.date === d.date && markets.find(m => m.id === other.marketId)?.kind === 'market'))
    const md = eligible.find(d => d.id === item.delivery.marketDayId) ?? eligible.find(d => d.date === date)
    if (!md) return item
    return {
      ...item,
      delivery: {
        ...item.delivery,
        pickupDate: md.date,
        marketDayId: md.id,
        marketId: md.marketId,
      },
    }
  }
  const date = item.delivery.pickupDate || item.paintDate
  // Pickups happen at a stall: never on a home (painting) day.
  const pickupDays = days
    .filter((d) => isMarketPickupWeekday(d.date) && markets.find((m) => m.id === d.marketId)?.kind === 'market')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  if (item.delivery.manualDay && item.delivery.marketDayId) {
    const chosen = pickupDays.find((d) => d.id === item.delivery.marketDayId)
    if (chosen) {
      return {
        ...item,
        delivery: {
          ...item.delivery,
          marketDayId: chosen.id,
          marketId: chosen.marketId,
          pickupDate: chosen.date,
        },
      }
    }
  }
  const preferredMarketId = activeMarket?.id ?? item.delivery.marketId
  const preferredDays = preferredMarketId ? pickupDays.filter((d) => d.marketId === preferredMarketId) : []
  const matchDate = (pool: MarketDay[]) =>
    date ? pool.find((d) => d.date === date) ?? pool.find((d) => d.date >= date) : undefined
  const pickDefault = (pool: MarketDay[]) =>
    (currentDate ? pool.find((d) => d.date === currentDate) ?? pool.find((d) => d.date >= currentDate) : undefined) ??
    pool.find((d) => d.isToday) ??
    pool[0]
  const md =
    (item.delivery.marketDayId ? pickupDays.find((d) => d.id === item.delivery.marketDayId) : undefined) ??
    (date
      ? matchDate(preferredDays) ?? matchDate(pickupDays) ?? pickDefault(preferredDays) ?? pickDefault(pickupDays)
      : pickDefault(preferredDays) ?? pickDefault(pickupDays))
  if (!md) return item
  return {
    ...item,
    delivery: {
      ...item.delivery,
      marketDayId: md.id,
      marketId: md.marketId,
      pickupDate: md.date,
    },
  }
}

function nextMarketPickup(days: MarketDay[], firstPaintDate: string, agenda: AgendaDay[], currentDate: string, nowHour: number, preferredMarketId?: string, minDate = currentDate) {
  return days
    .filter(day => day.date >= minDate && isMarketDayValidForItems(day, [], currentDate, nowHour, firstPaintDate, agenda))
    .sort((a, b) => a.date.localeCompare(b.date) || Number(b.marketId === preferredMarketId) - Number(a.marketId === preferredMarketId))[0]
}

function marketPickup(day: MarketDay | undefined): DraftItem['delivery'] {
  return { mode: 'market', pickupDate: day?.date, marketDayId: day?.id, marketId: day?.marketId, pickupHour: null, manualDay: false }
}

function paintingAtOtherMarket(item: DraftItem, agenda: AgendaDay[], delivery = item.delivery) {
  if (item.kind !== 'custom' || delivery.mode !== 'market' || !item.paintDate || item.paintDate !== delivery.pickupDate) return undefined
  const market = paintingMarketOn(agenda, item.paintDate)
  return market && delivery.marketId && market.id !== delivery.marketId ? market : undefined
}

function paintedElsewhereLabel(
  paintDate: string | undefined,
  agendaDays: AgendaDay[],
  marketDays: MarketDay[],
  activeMarket: Market | null,
  pickupMarketId?: string,
): string | null {
  if (!paintDate) return null
  if (marketDays.filter(d => d.date === paintDate).length <= 1) return null
  const market = paintingMarketOn(agendaDays, paintDate)
  if (!market || market.id === (activeMarket?.id ?? pickupMarketId)) return null
  return `Painted at ${market.name}`
}

export function NewSalePage() {
  const navigate = useNavigate()
  const clock = useStaffClock()
  const { activeMarket, activeMarketDay, stalls } = useStaffMarket()
  const version = useStaffRefresh()
  const [prices, setPrices] = useState<Pricing | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [marketStock, setMarketStock] = useState<{ key: string; rows: MarketOrnament[] | null; error: string } | null>(null)
  const [stockRetry, setStockRetry] = useState(0)
  const [paintingDays, setPaintingDays] = useState<PaintingDay[]>([])
  const [configError, setConfigError] = useState('')
  const [configRetry, setConfigRetry] = useState(0)
  const [params] = useSearchParams()
  const [draft, setDraft] = useState<SaleDraft>(() => buildDraftFromParams(params))
  const [seasonEnd, setSeasonEnd] = useState('2026-12-24')
  const [markets, setMarkets] = useState<Market[]>([])
  const [days, setDays] = useState<MarketDay[]>([])
  const [agendaDays, setAgendaDays] = useState<AgendaDay[]>([])
  const [suggestions, setSuggestions] = useState<Record<string, CapacityResult>>({})
  const [moveSuggestions, setMoveSuggestions] = useState<Record<string, MoveSuggestion | null>>({})
  const [busy, setBusy] = useState(false)
  const submitLock = useRef(false)
  const saleKey = useRef(draft.idempotencyKey ?? uid())
  const [error, setError] = useState('')
  const [staleNotice, setStaleNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null)
  const [payState, setPayState] = useState<PaymentState>('paid')
  const [depositAmount, setDepositAmount] = useState('')
  const [paidNote, setPaidNote] = useState('')
  // What this screen recorded, so the done screen can show the balance after a deposit.
  const [paidAmount, setPaidAmount] = useState<number | null>(null)
  const [mixedHandedNote, setMixedHandedNote] = useState('')
  const [doneQrOpen, setDoneQrOpen] = useState(false)
  const [finishedHandoff, setFinishedHandoff] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  // null = closed. The order is re-read first: a paid order must not be deleted, and a sent form means a cancellation e-mail.
  const [changeDate, setChangeDate] = useState<{ state: 'checking' | 'ready' | 'unknown' | 'paid'; formSent: boolean } | null>(null)
  const [planRetry, setPlanRetry] = useState(0)
  const initialClockDate = useRef(clock.date)
  const stockKey = `${version}:${stockRetry}`
  const stock = marketStock?.key === stockKey ? marketStock : null

  useEffect(() => {
    let active = true
    void api.marketStock.list()
      .then(rows => { if (active) setMarketStock({ key: stockKey, rows, error: '' }) })
      .catch(() => { if (active) setMarketStock({ key: stockKey, rows: null, error: 'Could not load ready ornaments.' }) })
    return () => { active = false }
  }, [stockKey])

  // One-shot commands are consumed before reload or a remembered back link can replay them.
  const paramKey = params.toString()
  const consumedParams = useRef<string | null>(null)
  useEffect(() => {
    if (consumedParams.current === paramKey) return
    const next = buildDraftFromParams(params)
    saleKey.current = next.idempotencyKey ?? uid()
    next.idempotencyKey = saleKey.current
    setDraft(next)
    if (params.has('fresh') || params.has('start') || params.has('placeItem')) {
      setPayMethod(null); setPayState('paid'); setDepositAmount(''); setPaidNote(''); setPaidAmount(null); setMixedHandedNote(''); setDoneQrOpen(false); setCopied(false); setError(''); setStaleNotice(''); setSuggestions({}); setMoveSuggestions({}); setFinishedHandoff(false); setDiscardOpen(false); setLeaveOpen(false); setChangeDate(null)
      const cleaned = new URLSearchParams(params)
      for (const command of ['fresh', 'date', 'start', 'end', 'kind', 'placeItem']) cleaned.delete(command)
      consumedParams.current = cleaned.toString()
      writeStoredDraft(next)
      navigate(`/staff/sales/new${cleaned.size ? `?${cleaned}` : ''}`, { replace: true })
    } else consumedParams.current = paramKey
    // Sale params are serialised; object identity must not reset a live draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    let active = true
    void Promise.all([api.markets.listMarkets(), api.markets.listMarketDays(), api.agenda.listDays(), api.shop.getConfig(), api.inventory.list()]).then(async ([m, d, agenda, config, stock]) => {
      if (!active) return
      if (![config.customPrice, config.finishedPrice, config.nameExtra].every(Number.isFinite)) throw new Error('Server prices are unavailable. Retry before creating a sale.')
      setPrices(config); setConfigError(''); setInventory(stock.filter(row => row.kind === 'custom')); setSeasonEnd(config.seasonEnd)
      setMarkets(m); setDays(d); setAgendaDays(agenda)
      if (d.length) {
        const refDate = DEMO_NOW_HOUR == null || clock.date !== initialClockDate.current ? clock.date : (d.find(day => day.isToday)?.date ?? clock.date)
        setDraft(current => ({ ...current, items: current.items.map(item => fillDayRefs(item, d, m, config.seasonEnd, activeMarket, refDate)) }))
        // The endpoint caps ranges at 62 days: load only upcoming days, in API-sized ranges, so an
        // old market day or a long season can no longer block the whole sale screen.
        const ranges = upcomingWindows(d.map(day => day.date), refDate)
        const rules = (await Promise.all(ranges.map(([from, to]) => api.paintingDays.list(from, to)))).flat()
        if (active) setPaintingDays(rules)
      }
    }).catch(err => { if (active) setConfigError(err instanceof Error && err.message ? err.message : 'Check the connection.') })
    return () => { active = false }
  }, [version, configRetry, clock.date])

  const clockRolled = clock.date !== initialClockDate.current
  const useClockToday = DEMO_NOW_HOUR == null || clockRolled
  const isDayToday = (d: MarketDay) => (useClockToday ? d.date === clock.date : d.isToday)
  const marketTodayDays = days.filter(d => isDayToday(d) && markets.find(m => m.id === d.marketId)?.kind === 'market')
  const activeMatch = activeMarketDay && (!useClockToday || activeMarketDay.date === clock.date)
    ? (days.find(d => d.id === activeMarketDay.id) ?? activeMarketDay)
    : undefined
  const today = activeMatch
    ?? (activeMarket ? marketTodayDays.find(d => d.marketId === activeMarket.id) : undefined)
    ?? marketTodayDays[0]
    ?? days.find(d => isDayToday(d))
  const currentDate = useClockToday ? clock.date : (today?.date ?? clock.date)
  const nowHour = clock.hour
  const paintingMarketToday = paintingMarketOn(agendaDays, currentDate)
  const gabyAway = today && paintingMarketToday && paintingMarketToday.id !== today.marketId ? paintingMarketToday : undefined
  const firstPaintDate = gabyAway ? addUtcDays(currentDate, 1) : currentDate

  // Reconcile draft against current Vienna time, calendar rules, active stall, and agenda changes.
  useEffect(() => {
    if (!days.length || !markets.length || draft.order || draft.phase === 'done' || !draft.items.length) return
    const aligned = draft.items.map(item => {
      if (item.delivery.mode !== 'market' || item.delivery.manualDay || item.slotLocked) return item
      if (!activeMarket || !item.delivery.pickupDate) return item
      const activeDayOnDate = days.find(d => d.date === item.delivery.pickupDate && d.marketId === activeMarket.id && isMarketPickupWeekday(d.date))
      if (!activeDayOnDate || activeDayOnDate.id === item.delivery.marketDayId) return item
      if (!isMarketDayValidForItems(activeDayOnDate, item.kind === 'custom' ? [item] : [], currentDate, nowHour, firstPaintDate, agendaDays)) return item
      return { ...item, delivery: { ...item.delivery, marketDayId: activeDayOnDate.id, marketId: activeDayOnDate.marketId } }
    })
    const base = aligned.some((row, idx) => row !== draft.items[idx]) ? { ...draft, items: aligned } : draft
    const { draft: nextDraft, changed, notice } = reconcileDraftWithClockAndAgenda(base, {
      currentDate, nowHour, firstPaintDate, days, markets, agendaDays, activeMarket, seasonEnd,
    })
    if (notice) setStaleNotice(notice)
    if (changed || base !== draft) setDraft(nextDraft)
    // Reconcile when external state (clock, calendar, active stall, item count/phase) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, markets, agendaDays, seasonEnd, activeMarket, currentDate, nowHour, firstPaintDate, draft.order, draft.phase, draft.items.length])

  // Stock arrives after a calendar or restored draft was built: move an unsellable colour/finish to the
  // first combination still in stock, in item order, so the draft never starts on a sold-out base.
  useEffect(() => {
    if (!prices) return
    setDraft(current => {
      if (current.order || current.phase !== 'items') return current
      let changed = false
      const items: DraftItem[] = []
      for (const item of current.items) {
        if (item.kind === 'custom' && remainingStock(inventory, items, 'custom', item.color, item.finish) === 0) {
          const combo = firstAvailableCustom(inventory, items)
          if (combo) { changed = true; items.push({ ...item, ...combo }); continue }
        }
        items.push(item)
      }
      return changed ? { ...current, items } : current
    })
  }, [inventory, prices])

  useEffect(() => {
    if (draft.phase === 'done' || (!draft.items.length && !draft.placingItemId)) {
      clearStoredDraft()
      return
    }
    writeStoredDraft({ ...draft, idempotencyKey: saleKey.current })
  }, [draft])
  const marketDays = days.filter(
    (d) => markets.find((m) => m.id === d.marketId)?.kind === 'market' && isMarketPickupWeekday(d.date),
  )
  const onlyFinished = draft.items.length > 0 && draft.items.every((item) => item.kind === 'finished')
  const hasCustom = draft.items.some((item) => item.kind === 'custom')
  const mixed = hasCustom && draft.items.some((item) => item.kind === 'finished')
  const readyPieces = (stock?.rows ?? []).filter(piece => piece.status === 'painted')
  const readyIds = new Set(readyPieces.map(piece => piece.id))
  const availablePieces = readyPieces.filter(piece => !draft.items.some(item => item.marketOrnamentId === piece.id))
  const unavailable = draft.items.filter(item => item.kind === 'finished' && (
    !item.marketOrnamentId || (stock?.rows && !readyIds.has(item.marketOrnamentId))
  ))
  const phase = draft.phase
  const order = draft.order
  const formUrl = order ? `${window.location.origin}/form/${order.formToken}` : ''
  const formStatus = useOrderFormStatus(order?.id, hasCustom && ['qr', 'payment', 'done'].includes(phase))

  const itemsRef = useRef(draft.items)
  useEffect(() => { itemsRef.current = draft.items }, [draft.items])
  const suggestKey = draft.items
    .map((item) =>
      [
        item.id,
        item.kind,
        item.durationMinutes,
        item.slotLocked,
        item.paintDate ?? '',
        item.paintStart ?? '',
        item.delivery.marketDayId ?? '',
        item.delivery.pickupDate ?? '',
        item.delivery.pickupHour ?? '',
        item.delivery.mode,
      ].join(':'),
    )
    .join('|')

  useEffect(() => {
    if (phase !== 'delivery' || !hasCustom) return
    let cancelled = false
    async function loadSuggestions() {
      const next: Record<string, CapacityResult> = {}
      const planned = new Map<string, { date: string; startHour: number; endHour: number }>()
      for (const item of itemsRef.current) {
        if (item.kind === 'custom' && item.paintDate && item.paintStart != null && item.paintEnd != null) {
          planned.set(item.id, { date: item.paintDate, startHour: item.paintStart, endHour: item.paintEnd })
        }
      }
      const busyOn = (date: string, itemId: string) =>
        [...planned.entries()]
          .filter(([id, slot]) => id !== itemId && slot.date === date)
          .map(([, slot]) => ({ startHour: slot.startHour, endHour: slot.endHour }))
      const handoffKey = (item: DraftItem) => `${item.delivery.pickupDate ?? currentDate}|${String(item.delivery.pickupHour ?? 99).padStart(5, '0')}`
      const customCount = itemsRef.current.filter((item) => item.kind === 'custom').length
      const toPlan = itemsRef.current
        .filter((item) => item.kind === 'custom' && !item.slotLocked && item.paintStart == null)
        .sort((a, b) => handoffKey(a).localeCompare(handoffKey(b)))
      for (const item of toPlan) {
        const handoff = item.delivery.pickupDate || currentDate
        if (!handoff) continue
        if (item.delivery.mode === 'market' && item.delivery.pickupHour == null) continue
        if (item.delivery.mode === 'vienna' && !item.delivery.pickupDate) continue
        const handoffMarketDayId = item.delivery.mode === 'market' ? item.delivery.marketDayId : undefined
        const dates = handoffMarketDayId
          ? paintDatesForPickup(handoff, item.delivery.marketId, firstPaintDate, agendaDays)
          : paintDatesToTry(handoff, firstPaintDate).filter(date => date < handoff)
        let result: CapacityResult = {
          ok: false,
          slot: null,
          remainingHours: 0,
          message: 'No free paint slot before this handoff.',
        }
        const candidates = await Promise.all(dates.map(date => api.agenda.checkCapacity({
          date,
          durationHours: minutesToHours(item.durationMinutes),
          beforeHour: date === handoff && item.delivery.mode === 'market' && item.delivery.pickupHour != null ? item.delivery.pickupHour - PAINT_HANDLING_HOURS : undefined,
          extraBusy: busyOn(date, item.id),
          handoffMarketDayId,
        })))
        if (cancelled) return
        result = candidates.find(candidate => candidate.ok && candidate.slot) ?? candidates.at(-1) ?? result
        if (!result.ok) {
          result = {
            ok: false,
            slot: null,
            remainingHours: result.remainingHours,
            message: 'No free paint slot before this handoff.',
          }
        }
        next[item.id] = result
        if (result.ok && result.slot) planned.set(item.id, result.slot)
        if (!result.ok) {
          let move: MoveSuggestion | null = null
          const moves = await Promise.all((customCount === 1 ? dates : []).map(date => api.agenda.findMoveSuggestion({
            date, durationHours: minutesToHours(item.durationMinutes), handoffDate: handoff, handoffMarketDayId,
            beforeHour: date === handoff && item.delivery.mode === 'market' && item.delivery.pickupHour != null ? item.delivery.pickupHour - PAINT_HANDLING_HOURS : undefined,
          })))
          move = moves.find(Boolean) ?? null
          if (!cancelled) setMoveSuggestions((previous) => ({ ...previous, [item.id]: move }))
        }
      }
      if (cancelled) return
      const placed = toPlan.filter((item) => next[item.id]?.ok && next[item.id]?.slot)
      if (placed.length) {
        setDraft((current) => ({
          ...current,
          items: current.items.map((row) => {
            const slot = row.paintStart == null ? next[row.id]?.slot : null
            return slot ? { ...row, paintDate: slot.date, paintStart: slot.startHour, paintEnd: slot.endHour } : row
          }),
        }))
      }
      setSuggestions((prev) => ({ ...prev, ...next }))
    }
    void loadSuggestions().catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not check painting times.') })
    return () => {
      cancelled = true
    }
  }, [phase, suggestKey, currentDate, firstPaintDate, hasCustom, planRetry, agendaDays])

  useEffect(() => {
    if (phase !== 'delivery' || !hasCustom) return
    const locked = itemsRef.current.filter(
      (item) =>
        item.kind === 'custom' &&
        item.slotLocked &&
        item.paintDate &&
        item.paintStart != null &&
        item.paintEnd != null,
    )
    if (!locked.length) return
    let cancelled = false
    void api.agenda.listDays().then((agenda) => {
      if (cancelled) return
      const taken = locked.some((item) => {
        const day = agenda.find((row) => row.marketDay.date === item.paintDate)
        if (!day) return false
        return day.slots.some((slot) => slot.block.id !== item.plannedMove?.blockId && hoursOverlap(item.paintStart!, item.paintEnd!, slot.block.startHour, slot.block.endHour))
      })
      if (taken) setError(SLOT_TAKEN_COPY)
    }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not check the agenda.') })
    return () => {
      cancelled = true
    }
  }, [phase, suggestKey, hasCustom])

  // A new step starts at its top: on phones the old scroll position hid the new heading.
  const pageHeading = useRef<HTMLHeadingElement>(null)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const shownPhase = useRef(draft.phase)
  useEffect(() => {
    if (shownPhase.current === draft.phase) return
    shownPhase.current = draft.phase
    const heading = draft.phase === 'items' ? pageHeading.current : stepHeading.current
    if (!heading) return
    heading.focus({ preventScroll: true })
    // The page top keeps the step indicator in view right above the new heading.
    const top = pageHeading.current?.closest('section') ?? heading
    top.scrollIntoView({ block: 'start' })
  }, [draft.phase])

  function setPhase(next: SalePhase) {
    setError('')
    setDraft((current) => ({ ...current, phase: next }))
  }

  function patchItem(id: string, patch: Partial<DraftItem> | ((item: DraftItem) => DraftItem)) {
    setDraft((current) => {
      const items = current.items.map((item) => {
        if (item.id !== id) return item
        return typeof patch === 'function' ? patch(item) : { ...item, ...patch }
      })
      return { ...current, items }
    })
  }

  function patchDelivery(id: string, delivery: DraftItem['delivery']) {
    setMoveSuggestions({})
    setSuggestions({})
    setStaleNotice('')
    setDraft((current) => {
      const different = current.differentPickups || mixed
      return {
        ...current,
        differentPickups: different,
        items: current.items.map((item) => {
          const isTarget = item.id === id
          if (!isTarget && different) {
            if (item.kind !== 'custom') return item
            if (!item.slotLocked || item.plannedMove) {
              return { ...item, paintDate: undefined, paintStart: undefined, paintEnd: undefined, slotLocked: false, plannedMove: undefined }
            }
            return item
          }
          const next = { ...item.delivery, ...delivery }
          const handoffChanged = next.pickupDate !== item.delivery.pickupDate || next.pickupHour !== item.delivery.pickupHour || next.mode !== item.delivery.mode || next.marketDayId !== item.delivery.marketDayId
          const keepChosenSlot = item.slotLocked && !item.plannedMove && (
            !next.pickupDate ||
            (paintFitsHandoff(item, next) && !paintingAtOtherMarket(item, agendaDays, next))
          )
          return {
            ...item,
            delivery: next,
            ...(handoffChanged && !keepChosenSlot
              ? { paintDate: undefined, paintStart: undefined, paintEnd: undefined, slotLocked: false, plannedMove: undefined }
              : {}),
          }
        }),
      }
    })
  }

  function addItem(kind: 'custom' | 'finished' = 'custom') {
    if (!draft.items.length && !draft.order) saleKey.current = uid()
    setDraft((current) => {
      // A new custom ornament starts on the first combination still in stock (counting this draft).
      const combo = kind === 'finished' ? null : firstAvailableCustom(inventory, current.items)
      const todayIsMarketDay = Boolean(today && marketDays.some(day => day.id === today.id))
      const todayFull = kind === 'custom' && todayIsMarketDay && Boolean(todayPaintingFull(paintingDays, today))
      const todayNoHours = Boolean(todayIsMarketDay && today && validMarketPickupHours(today, [], currentDate, nowHour).length === 0)
      const next = kind === 'finished'
        ? makeFinished()
        : makeCustom({
            ...(combo ?? {}),
            delivery: todayFull
              ? { mode: 'market', marketId: today?.marketId }
              : { mode: 'market', pickupDate: today?.date, marketDayId: today?.id, marketId: today?.marketId },
          })
      const resolved = kind === 'custom' && (gabyAway || todayNoHours)
        ? { ...next, delivery: marketPickup(nextMarketPickup(marketDays, firstPaintDate, agendaDays, currentDate, nowHour, today?.marketId, todayNoHours ? addUtcDays(currentDate, 1) : currentDate)) }
        : kind === 'custom' && todayFull ? next : fillDayRefs(next, days, markets, seasonEnd, activeMarket, currentDate)
      const items = [...current.items.map((item) => item.plannedMove ? { ...item, plannedMove: undefined, slotLocked: false, paintDate: undefined, paintStart: undefined, paintEnd: undefined } : item), resolved]
      const mixedNow = items.some((i) => i.kind === 'custom') && items.some((i) => i.kind === 'finished')
      return { ...current, items, differentPickups: current.differentPickups || mixedNow }
    })
  }

  function addFinishedItem() {
    setError('')
    setStockRetry(value => value + 1)
    addItem('finished')
  }

  function selectPiece(itemId: string, pieceId: string) {
    if (!availablePieces.some(piece => piece.id === pieceId)) return
    setDraft((current) => {
      if (current.items.some((item) => item.id !== itemId && item.marketOrnamentId === pieceId)) return current
      return { ...current, items: current.items.map((item) => (item.id === itemId ? { ...item, marketOrnamentId: pieceId } : item)) }
    })
    setError('')
  }

  function changePiece(itemId: string) {
    setError('')
    setStockRetry(value => value + 1)
    patchItem(itemId, { marketOrnamentId: undefined })
  }

  function removeItem(id: string) {
    setDraft((current) => {
      const items = current.items.filter((item) => item.id !== id)
      return { ...current, items, differentPickups: items.length > 1 ? current.differentPickups : false }
    })
  }

  function setDuration(item: DraftItem, preset: DurationPreset, customMinutes?: number) {
    const minutes = preset === 'custom'
      ? clampPaintMinutes(customMinutes ?? item.durationMinutes)
      : (DURATION_OPTIONS.find((option) => option.value === preset)?.minutes ?? 60)
    patchItem(item.id, {
      plannedMove: undefined,
      slotLocked: false,
      durationPreset: preset,
      durationMinutes: minutes,
      paintDate: undefined,
      paintStart: undefined,
      paintEnd: undefined,
    })
  }

  function toggleName(item: DraftItem) {
    if (item.kind === 'finished') return
    const withName = !item.withName
    if (withName && item.durationPreset === '60') {
      setDuration(item, '75')
      patchItem(item.id, { withName })
    } else patchItem(item.id, { withName })
  }

  function setColor(item: DraftItem, color: OrnamentColor) {
    const finish = finishForColor(inventory, draft.items, color, item.finish, item.id) as DraftItem['finish'] | null
    patchItem(item.id, { color, finish: finish ?? item.finish })
  }

  function placeOnBoard(item: DraftItem) {
    writeStoredDraft({ ...draft, idempotencyKey: saleKey.current, placingItemId: item.id, phase: 'delivery' })
    const handoff = item.delivery.pickupDate
    const date = item.paintDate || (handoff && item.delivery.mode === 'market'
      ? paintDatesForPickup(handoff, item.delivery.marketId, firstPaintDate, agendaDays)[0]
      : firstPaintDate)
    const query = new URLSearchParams({ place: item.id })
    if (date) query.set('date', date)
    navigate(`/staff/agenda?${query.toString()}`)
  }

  function changeSlot(item: DraftItem) {
    setError('')
    patchItem(item.id, {
      plannedMove: undefined,
      slotLocked: false,
      fromCalendar: false,
      paintDate: undefined,
      paintStart: undefined,
      paintEnd: undefined,
    })
  }

  async function applyMoveSuggestion(item: DraftItem, suggestion: MoveSuggestion) {
    setBusy(true)
    setError('')
    try {
      patchItem(item.id, {
        plannedMove: suggestion,
        paintDate: suggestion.freedSlot.date,
        paintStart: suggestion.freedSlot.startHour,
        paintEnd: suggestion.freedSlot.endHour,
        slotLocked: true,
        fromCalendar: false,
      })
      setMoveSuggestions((previous) => ({ ...previous, [item.id]: null }))
    } catch (err) {
      setError(saleErrorMessage(err, 'Could not move the paint session'))
    } finally {
      setBusy(false)
    }
  }

  function startOver() {
    clearStoredDraft()
    saleKey.current = uid()
    setPayMethod(null)
    setPayState('paid')
    setPaidNote('')
    setPaidAmount(null)
    setMixedHandedNote('')
    setDoneQrOpen(false)
    setFinishedHandoff(false)
    setDiscardOpen(false)
    setLeaveOpen(false)
    setChangeDate(null)
    setSuggestions({})
    setMoveSuggestions({})
    setDepositAmount('')
    setCopied(false)
    setError('')
    setStaleNotice('')
    setDraft({ items: [], differentPickups: false, phase: 'items' })
    navigate('/staff/sales/new', { replace: true })
  }

  async function createOrder(): Promise<NonNullable<SaleDraft['order']>> {
    if (draft.order) return draft.order
    if (!prices) throw new Error('Load server prices before creating a sale.')
    if (draft.items.some(item => item.kind === 'finished' && !item.marketOrnamentId)) {
      setPhase('items')
      throw new Error('Choose a numbered piece for each finished ornament.')
    }
    const duplicatePiece = duplicateMarketPiece(draft.items)
    if (duplicatePiece) {
      setPhase('items')
      throw new Error(`${marketOrnamentLabel(duplicatePiece)} is already in this sale. Remove the duplicate or choose another piece.`)
    }
    writeStoredDraft({ ...draft, idempotencyKey: saleKey.current })
    const soldOnMarketDayId = activeMarketDay?.id ?? (stalls.length <= 1 ? today?.id : undefined)
    const created = await api.orders.createSale({
      soldOnMarketDayId,
      items: toCreateItems(draft.items, days, today),
      plannedMove: draft.items.find((item) => item.plannedMove)?.plannedMove,
    }, saleKey.current)
    const ref = { id: created.id, code: created.code, formToken: created.formToken, total: created.total }
    setDraft((current) => ({ ...current, order: ref }))
    return ref
  }

  function showCreateError(err: unknown, fallback: string) {
    const code = (err as { code?: string } | null)?.code
    if (code === 'MARKET_STOCK_SOLD' || code === 'MARKET_STOCK_NOT_READY') {
      setFinishedHandoff(false)
      setPhase('items')
      setStockRetry(value => value + 1)
      setError(apiError(err, 'en', fallback).text)
      return
    }
    setError(saleErrorMessage(err, fallback))
  }

  async function finishFinishedSale(state: PaymentState, handOver = true) {
    if (!payMethod && state !== 'unpaid') {
      setError('Choose cash or card.')
      return
    }
    if (submitLock.current) return
    submitLock.current = true
    setBusy(true)
    setError('')
    try {
      const created = await createOrder()
      if (state !== 'unpaid') {
        const amount = state === 'deposit' ? depositValue(depositAmount, created.total) : created.total
        if (state === 'deposit' && (!Number.isFinite(amount) || amount <= 0 || amount >= created.total)) throw new Error('Enter a deposit greater than zero and less than the total.')
        if (!payMethod) throw new Error('Choose cash or card.')
        await api.payments.setPaymentState(created.id, state, payMethod, amount)
        setPaidNote(`${formatEur(amount, 'en')} received · ${payMethod === 'cash' ? 'cash' : 'card'}`)
        setPaidAmount(amount)
      } else {
        setPaidNote('Not paid yet')
        setPaidAmount(0)
      }
      if (handOver && draft.items.every(item => item.kind === 'finished' && item.delivery.mode === 'now')) await api.orders.setHandedOver(created.id, true)
      setFinishedHandoff(false)
      setDraft((current) => ({ ...current, order: created, phase: 'done' }))
    } catch (err) {
      showCreateError(err, 'Could not record sale')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  async function continueFromDelivery() {
    if (onlyFinished) {
      if (payState !== 'paid' && draft.items.every(item => item.delivery.mode === 'now')) { setFinishedHandoff(true); return }
      await finishFinishedSale(payState)
      return
    }
    const wrongMarket = draft.items.map(item => paintingAtOtherMarket(item, agendaDays)).find(Boolean)
    if (wrongMarket) {
      setError(`Gaby is painting at ${wrongMarket.name} that day. Pick another day.`)
      return
    }
    const missing = draft.items.filter(
      (item) => item.kind === 'custom' && (item.paintStart == null || item.paintEnd == null || !item.paintDate),
    )
    if (missing.length) {
      setError('Assign a paint slot — use the suggestion or place on the board.')
      return
    }
    const invalidHandoff = draft.items.find(item =>
      isPickupInPast(item.delivery, currentDate, nowHour) ||
      (item.kind === 'custom' && (
        (item.delivery.mode === 'market' && (item.delivery.pickupHour == null || !item.delivery.marketDayId)) ||
        (item.delivery.mode === 'vienna' && !item.delivery.pickupDate) ||
        !paintFitsHandoff(item, item.delivery)
      )),
    )
    if (invalidHandoff) {
      setError('Choose a valid pickup or delivery date and hour after painting finishes.')
      return
    }
    if (submitLock.current) return
    submitLock.current = true
    setBusy(true)
    setError('')
    try {
      const created = await createOrder()
      setDraft((current) => ({ ...current, order: created, phase: 'qr' }))
    } catch (err) {
      showCreateError(err, 'Could not create sale')
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  const appliedMove = draft.items.find((item) => item.plannedMove)?.plannedMove
  const balanceDue = order && paidAmount != null ? Math.max(0, Math.round((order.total - paidAmount) * 100) / 100) : null

  function copyFormLink() {
    void navigator.clipboard.writeText(formUrl).then(() => setCopied(true)).catch(() => setError('Could not copy the link. Please select and copy it.'))
  }

  function openChangeDate() {
    if (!order) return
    setError('')
    setChangeDate({ state: 'checking', formSent: false })
    api.orders.getOrderBundle(order.id)
      .then((bundle) => {
        const paid = bundle.order.paymentState !== 'unpaid' || (bundle.order.amountPaid ?? 0) > 0
        setChangeDate((current) => current && { state: paid ? 'paid' : 'ready', formSent: Boolean(bundle.customer?.email?.trim()) })
      })
      .catch(() => setChangeDate((current) => current && { state: 'unknown', formSent: false }))
  }

  /** The order was created for one date; cancel it (paint time and stock come back) and plan again. */
  async function cancelAndChangeDate() {
    if (!order || submitLock.current) return
    submitLock.current = true
    setBusy(true)
    setError('')
    try {
      try {
        await api.orders.cancelOrder(order.id)
      } catch (err) {
        // The cancellation may have committed even if the response was lost.
        const stillThere = await api.orders.getOrderByCode(order.code).catch(() => undefined)
        if (stillThere !== null && stillThere?.status !== 'CANCELLED') throw err
      }
      saleKey.current = uid()
      setSuggestions({})
      setMoveSuggestions({})
      setCopied(false)
      setChangeDate(null)
      setDraft((current) => ({
        ...current,
        order: undefined,
        phase: 'delivery',
        items: current.items.map((row) => row.kind === 'custom'
          ? { ...row, paintDate: undefined, paintStart: undefined, paintEnd: undefined, slotLocked: false, fromCalendar: false, plannedMove: undefined }
          : row),
      }))
    } catch (err) {
      setError(saleErrorMessage(err, 'Could not cancel the order'))
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  async function recordPayment(state: PaymentState) {
    if (!order) return
    if (state !== 'unpaid' && !payMethod) {
      setError('Choose cash or card.')
      return
    }
    const amount = state === 'deposit' ? depositValue(depositAmount, order.total) : order.total
    if (state === 'deposit' && (!Number.isFinite(amount) || amount <= 0 || amount >= order.total)) { setError('Enter a deposit greater than zero and less than the total.'); return }
    if (submitLock.current) return
    submitLock.current = true
    setBusy(true)
    setError('')
    try {
      if (state !== 'unpaid') await api.payments.setPaymentState(order.id, state, payMethod, amount)
      const nowPieces = draft.items.filter(item => item.kind === 'finished' && item.delivery.mode === 'now' && item.marketOrnamentId)
      if (state === 'paid' && hasCustom && nowPieces.length) {
        const bundle = await api.orders.getOrderBundle(order.id)
        const nowPieceIds = new Set(nowPieces.map(item => item.marketOrnamentId!))
        const handOverIds = bundle.items
          .filter(row => row.kind === 'finished' && row.marketOrnamentId && nowPieceIds.has(row.marketOrnamentId) && !row.handedOver)
          .map(row => row.id)
        if (handOverIds.length) {
          await api.orders.setHandedOver(order.id, true, handOverIds)
          setMixedHandedNote('Ready-made ornaments handed over now · custom ornaments wait.')
        }
      }
      setPaidNote(state === 'unpaid' ? 'Not paid yet' : `${formatEur(amount, 'en')} received · ${payMethod === 'cash' ? 'cash' : 'card'}`)
      setPaidAmount(state === 'unpaid' ? 0 : amount)
      setPhase('done')
    } catch (err) {
      setError(saleErrorMessage(err, 'Could not record payment'))
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  const allVienna = hasCustom && draft.items.every((item) => item.kind !== 'custom' || item.delivery.mode === 'vienna')
  const title: Record<SalePhase, string> = {
    items: 'What are we selling?',
    delivery: onlyFinished ? 'Hand over and pay' : allVienna ? 'Delivery and paint' : 'Pickup and paint',
    qr: 'Customer form',
    payment: 'Payment',
    done: 'Sale recorded',
  }

  const stepLabels = onlyFinished
    ? ['Items', 'Hand over & pay']
    : ['Items', allVienna ? 'Delivery' : 'Pickup', 'QR & pay']
  const currentStep = phase === 'done' ? stepLabels.length : phase === 'items' ? 0 : phase === 'delivery' ? 1 : 2

  const sharedItem = draft.items[0]
  const deliveryItems = draft.differentPickups || mixed ? draft.items : sharedItem ? [sharedItem] : []

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <div className={styles.headingRow}>
          {phase !== 'done' && (order || draft.items.length > 0) ? (
            <Button tone="staff" variant="secondary" disabled={busy} onClick={() => { if (order) setLeaveOpen(true); else setDiscardOpen(true) }}>
              <span aria-hidden="true">‹</span> Back
            </Button>
          ) : null}
          <h1 ref={pageHeading} tabIndex={-1} className={styles.focusHeading}>New sale</h1>
        </div>
        {draft.items.length > 0 && <ProgressSteps labels={stepLabels} current={currentStep} label="Sale progress" tone="staff" />}
      </div>

      {discardOpen && <StaffDialog title="Discard this sale?" onClose={() => setDiscardOpen(false)}>
        <p>The ornaments you added are removed.</p>
        <Button tone="staff" variant="danger" onClick={() => {
          setDiscardOpen(false)
          startOver()
          requestAnimationFrame(() => pageHeading.current?.focus())
        }}>Discard</Button>
      </StaffDialog>}
      {leaveOpen && order && <StaffDialog title="Leave this sale?" onClose={() => setLeaveOpen(false)}>
        <p>{order.code} stays saved and unpaid, with its paint time reserved. Open it later from Search to show the QR or take payment.</p>
        <Button tone="staff" variant="secondary" onClick={() => { clearStoredDraft(); navigate(`/staff/orders/${order.id}`, { state: { from: '/staff/sales/new' } }) }}>Open order</Button>
        <Button tone="staff" onClick={() => { setLeaveOpen(false); startOver() }}>Start new sale</Button>
      </StaffDialog>}
      {changeDate && order && <StaffDialog title="Change the date?" busy={busy} onClose={() => setChangeDate(null)}>
        {changeDate.state === 'paid' ? (
          <p><strong>{order.code} already has a payment recorded.</strong> It cannot be cancelled here: open the order to sort out the payment first.</p>
        ) : (
          <p>Order {order.code} will be cancelled: its paint time and stock are released. You then choose a new date, and a new order with a new QR code is created.</p>
        )}
        {changeDate.state === 'checking' ? <p>Checking the order…</p> : null}
        {changeDate.state === 'unknown' ? <p><strong>Could not check the order.</strong> If the customer already sent the form, they get a cancellation e-mail and must fill the new one.</p> : null}
        {changeDate.state === 'ready' && changeDate.formSent ? <p><strong>The customer already sent the form.</strong> They get a cancellation e-mail and must scan the new code and fill it again.</p> : null}
        {appliedMove && changeDate.state !== 'paid' ? <p>The change already made to {appliedMove.orderCode} stays: its painting remains on {formatDateLabel(appliedMove.to.date)} · {formatHour(appliedMove.to.startHour)}–{formatHour(appliedMove.to.endHour)}.</p> : null}
        {changeDate.state === 'paid'
          ? <Button tone="staff" onClick={() => { clearStoredDraft(); navigate(`/staff/orders/${order.id}`, { state: { from: '/staff/sales/new' } }) }}>Open order</Button>
          : <Button tone="staff" disabled={busy || changeDate.state === 'checking'} onClick={() => void cancelAndChangeDate()}>{busy ? 'Cancelling…' : 'Cancel order & choose new date'}</Button>}
        {error && <p role="alert">{error}</p>}
      </StaffDialog>}
      {finishedHandoff && <StaffDialog title="Balance due" busy={busy} onClose={() => setFinishedHandoff(false)}>
        <p>Collect the remaining balance before handing over the whole order. {prices ? formatEur((order?.total ?? draft.items.reduce((sum, item) => sum + itemCost(item.kind, item.withName, prices), 0)) - (payState === 'deposit' ? depositValue(depositAmount, order?.total ?? draft.items.reduce((sum, item) => sum + itemCost(item.kind, item.withName, prices), 0)) : 0), 'en') : ''} is still due.</p>
        <SegmentedControl legend="Collection method" name="finished-handover-method" value={payMethod} onChange={setPayMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />
        <Button tone="staff" disabled={busy || !payMethod} onClick={() => void finishFinishedSale('paid')}>Mark paid &amp; hand over</Button>
        <Button tone="staff" variant="secondary" disabled={busy} onClick={() => void finishFinishedSale(payState, false)}>Save without handover</Button>
        <Button tone="staff" variant="ghost" disabled={busy} onClick={() => void finishFinishedSale(payState)}>Hand over with balance due</Button>
        {error && <p role="alert">{error}</p>}
      </StaffDialog>}
      <div className={styles.workspace} data-empty={!draft.items.length || undefined}>
        <div className={styles.main}>
          {phase !== 'items' && <h2 ref={stepHeading} tabIndex={-1} className={styles.focusHeading}>{title[phase]}</h2>}
          {staleNotice ? <p className={styles.hint} role="status">{staleNotice}</p> : null}
          {configError ? <div role="alert"><p>Could not load prices, stock and calendar, so sales are paused. {configError}</p><Button tone="staff" variant="secondary" onClick={() => setConfigRetry(n => n + 1)}>Try again</Button></div> : null}
          {error ? (
            <p className={styles.err} role="alert">
              {error}
              {phase === 'delivery' && !onlyFinished && <Button tone="staff" variant="secondary" onClick={() => { setError(''); setPlanRetry(n => n + 1); setConfigRetry(n => n + 1) }}>Retry checks</Button>}
            </p>
          ) : null}

          {phase === 'items' ? (
            <ItemsStep
              items={draft.items}
              prices={prices}
              inventory={inventory}
              marketPieces={stock?.rows ?? undefined}
              availablePieces={availablePieces}
              stockLoading={!stock}
              stockError={stock?.error ?? ''}
              stockReady={Boolean(prices)}
              unavailable={unavailable}
              onRetryStock={() => setStockRetry(value => value + 1)}
              onAddCustom={() => addItem()}
              onAddFinished={addFinishedItem}
              onSelectPiece={selectPiece}
              onChangePiece={changePiece}
              onRemove={removeItem}
              onToggleName={toggleName}
              onColor={setColor}
              onFinish={(item, finish) => patchItem(item.id, { finish })}
              onDuration={setDuration}
              onContinue={() => {
                if (!draft.items.length) return
                if (!prices || configError) { setError('Prices and stock are still loading. Wait a moment or tap Try again.'); return }
                if (unavailable.length) {
                  const id = unavailable[0].marketOrnamentId
                  setError(id ? `${marketOrnamentLabel(id)} is unavailable. Change the piece or remove it.` : 'Choose a numbered piece for each finished ornament.')
                  return
                }
                const duplicatePiece = duplicateMarketPiece(draft.items)
                if (duplicatePiece) {
                  setError(`${marketOrnamentLabel(duplicatePiece)} is already in this sale. Remove the duplicate or choose another piece.`)
                  return
                }
                if (draft.items.some(item => item.kind === 'finished') && !stock?.rows) {
                  setError(stock?.error ? 'Could not check ready ornaments. Tap Try again in the piece list.' : 'Checking ready ornaments. Try again in a moment.')
                  return
                }
                const shortage = draft.items.find(item => item.kind === 'custom' &&
                  draft.items.filter(other => other.kind === 'custom' && other.color === item.color && other.finish === item.finish).length >
                    remainingStock(inventory, [], 'custom', item.color, item.finish))
                if (shortage) { setError(`Out of stock: ${shortage.finish} ${shortage.color} ornaments. Reduce the quantity or choose another combination.`); return }
                setPhase('delivery')
              }}
            />
          ) : null}

          {phase === 'delivery' ? (
            <>
              {draft.items.length > 1 ? (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.differentPickups || mixed}
                    onChange={(e) => {
                      const nextDifferent = e.target.checked || mixed
                      setSuggestions({})
                      setMoveSuggestions({})
                      setDraft((current) => {
                        if (nextDifferent || !current.items.length) return { ...current, differentPickups: nextDifferent }
                        return {
                          ...current,
                          differentPickups: false,
                          items: syncSharedDelivery(current.items, {
                            currentDate, nowHour, firstPaintDate, days, markets, agendaDays, activeMarket, seasonEnd,
                          }),
                        }
                      })
                    }}
                  />
                  Different pickup times
                </label>
              ) : null}

              {deliveryItems.map((item) => {
                const shared = !(draft.differentPickups || mixed)
                const paintItems = shared ? draft.items.filter((row) => row.kind === 'custom') : item.kind === 'custom' ? [item] : []
                return (
                  <DeliveryCard
                    key={item.id}
                    item={item}
                    title={shared && draft.items.length > 1 ? 'Whole order' : itemLabel(item, draft.items.findIndex((row) => row.id === item.id))}
                    shared={shared && draft.items.length > 1}
                    marketPieces={stock?.rows ?? undefined}
                    allItems={draft.items}
                    paintItems={paintItems}
                    markets={markets}
                    marketDays={marketDays}
                    allDays={days}
                    activeMarket={activeMarket}
                    seasonEnd={seasonEnd}
                    agendaDays={agendaDays}
                    paintingDays={paintingDays}
                    nowHour={nowHour}
                    currentDate={currentDate}
                    firstPaintDate={firstPaintDate}
                    today={today}
                    gabyAway={gabyAway}
                    suggestions={suggestions}
                    moveSuggestion={moveSuggestions[item.id]}
                    slotTaken={Boolean(error && /hour is taken|overlap/i.test(error))}
                    onModeChange={() => setError('')}
                    onDelivery={(delivery) => patchDelivery(item.id, delivery)}
                    onPlace={placeOnBoard}
                    onChangeSlot={changeSlot}
                    onApplyMove={(suggestion) => void applyMoveSuggestion(item, suggestion)}
                  />
                )
              })}

              {onlyFinished ? (
                <div className={`${styles.card} ${styles.payCard}`}>
                  <InsetNote><p>No customer form is needed for ready-made ornaments.</p></InsetNote>
                  <SalePaymentFields state={payState} onState={setPayState} method={payMethod} onMethod={setPayMethod} deposit={depositAmount} onDeposit={setDepositAmount} total={order?.total ?? (prices ? draft.items.reduce((sum, item) => sum + itemCost(item.kind, item.withName, prices), 0) : 0)} />

                </div>
              ) : null}

              {onlyFinished && payState !== 'unpaid' && !payMethod ? <p>Choose cash or card before saving.</p> : null}
              <StaffActions className={styles.actions} total={order?.total ?? (prices ? draftTotal(draft.items, prices) : null)}>
                <Button
                  tone="staff"
                  size="lg"
                  disabled={busy || !prices || Boolean(configError) || !draft.items.length || draft.items.some(item => item.kind === 'custom' && (item.paintStart == null || (item.delivery.mode === 'market' && (!item.delivery.marketDayId || item.delivery.pickupHour == null)) || (item.delivery.mode === 'vienna' && !item.delivery.pickupDate) || !paintFitsHandoff(item, item.delivery) || Boolean(paintingAtOtherMarket(item, agendaDays)))) || draft.items.some(item => isPickupInPast(item.delivery, currentDate, nowHour)) || (onlyFinished && payState !== 'unpaid' && !payMethod) || (onlyFinished && payState === 'deposit' && !validDeposit(depositAmount, prices ? draft.items.reduce((sum, item) => sum + itemCost(item.kind, item.withName, prices), 0) : 0))}
                  onClick={() => void continueFromDelivery()}
                >
                  {busy ? 'Saving…' : onlyFinished ? 'Done' : draft.items.some((item) => item.plannedMove) ? 'Save change & create order' : 'Create order & show QR'}
                </Button>
                <Button tone="staff" variant="ghost" disabled={Boolean(order)} onClick={() => setPhase('items')}>
                  Back to items
                </Button>
              </StaffActions>
            </>
          ) : null}

          {order && ['qr', 'payment', 'done'].includes(phase) ? (
            // One parent owns the rhythm between the form status and the step below it.
            <div className={styles.afterOrder}>
              {hasCustom ? <div className={styles.formStatus} data-received={formStatus.received || undefined}>
                <p role="status">{formStatus.received ? `Form received${formStatus.customerName ? ` · ${formStatus.customerName}` : ''}` : 'Waiting for customer form'}</p>
                {formStatus.received ? <ButtonLink to={`/staff/orders/${order.id}`} tone="staff" variant="ghost">View details</ButtonLink> : null}
                {formStatus.error && <div role="alert"><p>{formStatus.error}</p><Button tone="staff" variant="secondary" onClick={formStatus.retry}>Check now</Button></div>}
              </div> : null}

              {phase === 'qr' ? (
                <div className={styles.qrStep}>
                  <div className={styles.qr}>
                    <QrCode value={formUrl} />
                  </div>
                  <div className={styles.qrSide}>
                    {!formStatus.received && <p className={styles.lead}>Scan to add photos and contact details. You can take payment meanwhile.</p>}
                    <StaffActions className={styles.actions} total={order.total}>
                      <Button tone="staff" size="lg" onClick={() => setPhase('payment')}>
                        Continue to payment
                      </Button>
                      <CustomerHandoff token={order.formToken} label="Fill on this device instead" />
                      <Button tone="staff" variant="ghost" onClick={() => copyFormLink()}>{copied ? 'Link copied' : 'Copy link to send'}</Button>
                      <Button tone="staff" variant="ghost" onClick={openChangeDate}>Change date</Button>
                    </StaffActions>
                  </div>
                </div>
              ) : null}

              {phase === 'payment' ? (
                <div>
                  <SalePaymentFields state={payState} onState={setPayState} method={payMethod} onMethod={setPayMethod} deposit={depositAmount} onDeposit={setDepositAmount} total={order.total} />
                  {payState !== 'unpaid' && !payMethod ? <p>Choose cash or card to record a payment.</p> : null}
                  <StaffActions className={styles.actions} total={order.total}>
                    <Button tone="staff" size="lg" disabled={busy || (payState !== 'unpaid' && !payMethod) || (payState === 'deposit' && !validDeposit(depositAmount, order.total))} onClick={() => void recordPayment(payState)}>
                      {busy ? 'Saving…' : payState === 'unpaid' ? 'Leave unpaid' : payState === 'deposit' ? (validDeposit(depositAmount, order.total) ? `Mark deposit · ${formatEur(depositValue(depositAmount, order.total), 'en')}` : 'Mark deposit') : `Mark paid · ${formatEur(order.total, 'en')}`}
                    </Button>
                    {order.formToken ? <Button tone="staff" variant="secondary" disabled={busy} onClick={() => setPhase('qr')}>Show QR again</Button> : null}
                    {order.formToken ? <Button tone="staff" variant="ghost" disabled={busy} onClick={openChangeDate}>Change date</Button> : null}
                  </StaffActions>
                </div>
              ) : null}

              {phase === 'done' ? (
                <div>
                  <div className={styles.doneCard} role="status">
                    <span aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <div>
                      <strong>{order.code} · {formatEur(order.total, 'en')}</strong>
                      {paidNote ? <p>{paidNote}</p> : null}
                      {mixedHandedNote ? <p>{mixedHandedNote}</p> : null}
                      {paidAmount != null && paidAmount > 0 && balanceDue != null && balanceDue > 0 ? <p className={styles.balance}>Balance due · {formatEur(balanceDue, 'en')}</p> : null}
                    </div>
                  </div>
                  {hasCustom && !formStatus.received ? (
                    <div className={styles.doneQr}>
                      <Button tone="staff" variant="secondary" aria-expanded={doneQrOpen} aria-controls="done-qr" onClick={() => setDoneQrOpen(open => !open)}>{doneQrOpen ? 'Hide QR' : 'Show QR'}</Button>
                      {doneQrOpen ? <div id="done-qr" className={styles.doneQrBody}>
                        <QrCode value={formUrl} />
                        <Button tone="staff" variant="ghost" onClick={() => copyFormLink()}>{copied ? 'Link copied' : 'Copy link to send'}</Button>
                      </div> : null}
                    </div>
                  ) : null}
                  <StaffActions className={styles.actions} total={balanceDue != null && paidAmount != null && balanceDue > 0 ? balanceDue : order.total} totalLabel={paidAmount == null ? 'Total' : balanceDue === 0 ? 'Total · paid' : 'Balance due'}>
                    <Button tone="staff" size="lg" onClick={startOver}>
                      New sale
                    </Button>
                    <ButtonLink to={`/staff/orders/${order.id}`} state={{ from: '/staff/sales/new' }} tone="staff" variant="secondary">
                      Open order
                    </ButtonLink>
                  </StaffActions>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {draft.items.length > 0 && <OrderSummaryPanel prices={prices} items={draft.items} markets={markets} days={days} marketPieces={stock?.rows ?? undefined} orderCode={order?.code} showHandoff={phase !== 'items'} />}
      </div>
    </section>
  )
}

/** Today's automatic painting limit is used up (or painting is closed): a same-day pickup cannot be planned. */
function todayPaintingFull(paintingDays: PaintingDay[], today?: MarketDay): PaintingDay | null {
  const rule = today ? paintingDays.find(row => row.date === today.date) : undefined
  return rule && (!rule.open || rule.booked >= rule.maxPaintings) ? rule : null
}

function CustomMinutesField({
  item,
  onDuration,
}: {
  item: DraftItem
  onDuration: (item: DraftItem, preset: DurationPreset, customMinutes?: number) => void
}) {
  const [text, setText] = useState(String(item.durationMinutes))
  const [lastItem, setLastItem] = useState({ id: item.id, minutes: item.durationMinutes })
  if (lastItem.id !== item.id || lastItem.minutes !== item.durationMinutes) {
    setLastItem({ id: item.id, minutes: item.durationMinutes })
    setText(String(item.durationMinutes))
  }

  function commit(raw: string) {
    const minutes = clampPaintMinutes(Number.parseInt(raw, 10))
    setText(String(minutes))
    onDuration(item, 'custom', minutes)
  }

  return (
    <Field label="Minutes" htmlFor={`minutes-${item.id}`} hint="How long will this ornament take?">
      <div className={styles.minsRow}>
        <Button tone="staff" variant="secondary" aria-label="15 minutes less" disabled={item.durationMinutes <= MIN_PAINT_MINUTES} onClick={() => commit(String(item.durationMinutes - PAINT_STEP_MINUTES))}>−</Button>
        <input
          id={`minutes-${item.id}`}
          type="number"
          min={MIN_PAINT_MINUTES}
          max={MAX_PAINT_MINUTES}
          inputMode="numeric"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
        />
        <Button tone="staff" variant="secondary" aria-label="15 minutes more" disabled={item.durationMinutes >= MAX_PAINT_MINUTES} onClick={() => commit(String(item.durationMinutes + PAINT_STEP_MINUTES))}>+</Button>
      </div>
    </Field>
  )
}

function SaleKindIcon({ kind }: { kind: DraftItem['kind'] }) {
  return (
    <svg className={styles.saleKindIcon} data-kind={kind} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10 9V6h6v3m-3-3V3" />
      <circle cx="13" cy="18" r="9" />
      {kind === 'custom' ? (
        <path fill="var(--sale-icon-surface)" d="m19 17 8-9a1.4 1.4 0 0 1 2 2l-7 10m-3-3 3 3c0 4-4 7-9 7 2-2 1-5 3-8a4 4 0 0 1 3-2Z" />
      ) : (
        <g>
          <path fill="var(--sale-icon-surface)" d="M19 14h6l5 5-6 6-5-5Z" />
          <circle cx="22" cy="17" r="1" fill="currentColor" stroke="none" />
        </g>
      )}
    </svg>
  )
}

function ItemsStep({
  items,
  prices,
  inventory,
  marketPieces,
  availablePieces,
  stockLoading,
  stockError,
  stockReady,
  unavailable,
  onRetryStock,
  onAddCustom,
  onAddFinished,
  onSelectPiece,
  onChangePiece,
  onRemove,
  onToggleName,
  onColor,
  onFinish,
  onDuration,
  onContinue,
}: {
  prices: Pricing | null
  inventory: InventoryItem[]
  marketPieces?: MarketOrnament[]
  availablePieces: MarketOrnament[]
  stockLoading: boolean
  stockError: string
  stockReady: boolean
  items: DraftItem[]
  unavailable: DraftItem[]
  onRetryStock: () => void
  onAddCustom: () => void
  onAddFinished: () => void
  onSelectPiece: (itemId: string, pieceId: string) => void
  onChangePiece: (itemId: string) => void
  onRemove: (id: string) => void
  onToggleName: (item: DraftItem) => void
  onColor: (item: DraftItem, color: OrnamentColor) => void
  onFinish: (item: DraftItem, finish: import('../../domain/types').CustomFinish) => void
  onDuration: (item: DraftItem, preset: DurationPreset, customMinutes?: number) => void
  onContinue: () => void
}) {
  const customSoldOut = stockReady && !firstAvailableCustom(inventory, items)
  return (
    <>
      {items.length === 0 ? (
        <div className={styles.startChoices}>
          <Button tone="staff" variant="choice" size="lg" onClick={onAddCustom}>
            <SaleKindIcon kind="custom" />
            <span><strong>+ Add custom ornament</strong><small>{customSoldOut ? 'Sold out · update Stock first' : "Painted from the customer's photos"}</small></span>
          </Button>
          <Button tone="staff" variant="choice" size="lg" onClick={onAddFinished}>
            <SaleKindIcon kind="finished" />
            <span><strong>+ Add finished product</strong><small>Choose a numbered ornament</small></span>
          </Button>
        </div>
      ) : (
        <>
          {items.map((item, index) => {
            const priceText = prices ? formatEur(itemCost(item.kind, item.withName, prices), 'en') : 'Price unavailable'
            if (item.kind === 'finished' && item.marketOrnamentId) {
              const pieceId = item.marketOrnamentId
              const piece = marketPieces?.find(row => row.id === pieceId)
              const parts = marketOrnamentParts(pieceId)
              const shortSpec = marketPieceShortSpec(pieceId)
              return (
                <article key={item.id} className={styles.card}>
                  <div className={styles.finishedRow}>
                    <MarketPiecePhoto
                      id={pieceId}
                      piece={piece}
                      probeUploaded={!marketPieces}
                      className={styles.salePhoto}
                      alt={`Ornament ${pieceId}`}
                    />
                    <div className={styles.finishedBody}>
                      <div className={styles.cardHead}>
                        <h3 className={styles.pieceHeading} aria-label={`${marketOrnamentLabel(pieceId)} · ${priceText}`}>
                          <span className={styles.pieceCode}>{pieceId}</span>
                          <span className={styles.piecePrice}>{priceText}</span>
                        </h3>
                        <Button tone="staff" variant="ghost" onClick={() => onRemove(item.id)}>
                          Remove
                        </Button>
                      </div>
                      {shortSpec ? (
                        <p className={styles.pieceSpec}>
                          {parts ? <span className={styles.swatchDot} style={{ background: parts.color.swatch }} aria-hidden="true" /> : null}
                          <StaffText>{shortSpec}</StaffText>
                        </p>
                      ) : null}
                      {unavailable.includes(item) && <p className={styles.soldOut}>Piece no longer available.</p>}
                      <div className={styles.pieceActions}>
                        <Button tone="staff" variant="secondary" onClick={() => onChangePiece(item.id)}>
                          Change piece
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            }
            return (
              <article key={item.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h3>
                    <StaffText>{`${itemLabel(item, index)} · ${priceText}`}</StaffText>
                  </h3>
                  <Button tone="staff" variant="ghost" onClick={() => onRemove(item.id)}>
                    Remove
                  </Button>
                </div>
                {item.slotLocked && slotLabel(item) ? (
                  <p className={styles.lead}>Paint {slotLabel(item)} (from the board)</p>
                ) : null}
                {item.kind === 'custom' ? (() => {
                  // Hints show what is left for this ornament after the other ornaments in the draft.
                  const comboLeft = stockReady ? remainingStock(inventory, items, 'custom', item.color, item.finish, item.id) : 1
                  const soldOut = comboLeft === 0 && !firstAvailableCustom(inventory, items, item.id)
                  return <>
                    <label className={styles.check}>
                      <input type="checkbox" aria-describedby={`name-hint-${item.id}`} checked={item.withName} onChange={() => onToggleName(item)} />
                      {`Name on the back · +${prices ? formatEur(prices.nameExtra, 'en') : 'price unavailable'}`}
                    </label>
                    <p className={styles.hint} id={`name-hint-${item.id}`}>The customer types the name in the form.</p>
                    {soldOut ? <p className={styles.soldOut} role="status">Sold out: no unpainted bases left. Update Stock or remove this ornament.</p> : null}
                    <SegmentedControl
                      legend="Colour"
                      name={`colour-${item.id}`}
                      value={soldOut ? null : item.color}
                      onChange={(color) => onColor(item, color)}
                      options={(['red', 'green', 'beige'] as const).map(color => { const left = remainingColor(inventory, items, color, item.id); return { value: color, color, label: color[0].toUpperCase() + color.slice(1), hint: stockReady ? stockLabel(left) : undefined, disabled: stockReady && left === 0 } })}
                    />
                    <SegmentedControl legend="Finish" help={<HelpTip label="Explain finishes">Shiny reflects light. Matte has no glossy reflection. Stock refers to unpainted bases.</HelpTip>} name={`finish-${item.id}`} value={soldOut ? null : item.finish ?? 'shiny'} onChange={finish => onFinish(item, finish)} options={(['shiny', 'matte'] as const).map(finish => { const left = remainingStock(inventory, items, 'custom', item.color, finish, item.id); return { value: finish, label: finish === 'shiny' ? 'Shiny' : 'Matte', hint: stockReady ? stockLabel(left) : undefined, disabled: stockReady && left === 0 } })} />
                    <SegmentedControl
                      legend="Paint time"
                      name={`duration-${item.id}`}
                      value={item.durationPreset}
                      onChange={(preset) => onDuration(item, preset)}
                      options={DURATION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    />
                    {item.durationPreset === 'custom' ? <CustomMinutesField item={item} onDuration={onDuration} /> : null}
                  </>
                })() : (
                  <MarketOrnamentPicker
                    pieces={availablePieces}
                    loading={stockLoading}
                    error={stockError}
                    onRetry={onRetryStock}
                    onPick={(pieceId) => onSelectPiece(item.id, pieceId)}
                  />
                )}
              </article>
            )
          })}
          <div className={styles.addRow}>
            <Button tone="staff" variant="secondary" size="lg" onClick={onAddCustom}>
              <SaleKindIcon kind="custom" />
              + Add custom
            </Button>
            <Button tone="staff" variant="secondary" size="lg" onClick={onAddFinished}>
              <SaleKindIcon kind="finished" />
              + Add finished
            </Button>
          </div>
          <StaffActions className={styles.actions} total={prices ? draftTotal(items, prices) : null}>
            <Button tone="staff" size="lg" onClick={onContinue}>
              Continue
            </Button>
          </StaffActions>
        </>
      )}
    </>
  )
}

function DeliveryCard({
  item,
  title,
  shared = false,
  marketPieces,
  allItems,
  paintItems,
  markets,
  marketDays,
  allDays,
  activeMarket,
  seasonEnd,
  agendaDays,
  paintingDays,
  nowHour,
  currentDate,
  firstPaintDate,
  today,
  gabyAway,
  suggestions,
  moveSuggestion,
  slotTaken,
  onDelivery,
  onModeChange,
  onPlace,
  onChangeSlot,
  onApplyMove,
}: {
  item: DraftItem
  title: string
  shared?: boolean
  marketPieces?: MarketOrnament[]
  allItems: DraftItem[]
  paintItems: DraftItem[]
  markets: Market[]
  marketDays: MarketDay[]
  allDays: MarketDay[]
  activeMarket: Market | null
  seasonEnd: string
  agendaDays: AgendaDay[]
  paintingDays: PaintingDay[]
  nowHour: number
  currentDate: string
  firstPaintDate: string
  today?: MarketDay
  gabyAway?: Market
  suggestions: Record<string, CapacityResult>
  moveSuggestion?: MoveSuggestion | null
  slotTaken?: boolean
  onModeChange: () => void
  onDelivery: (delivery: DraftItem['delivery']) => void
  onPlace: (item: DraftItem) => void
  onChangeSlot: (item: DraftItem) => void
  onApplyMove: (suggestion: MoveSuggestion) => void
}) {
  const showPaint = paintItems.length > 0
  const suggestion = suggestions[item.id]
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [viennaPickerOpen, setViennaPickerOpen] = useState(false)
  const todayIsMarket = Boolean(today && marketDays.some(day => day.id === today.id))
  const todayFull = showPaint && todayIsMarket ? todayPaintingFull(paintingDays, today) : null
  const away = showPaint ? gabyAway : undefined
  const lockedDate = latestLockedPaintDate(paintItems)
  const anyLockedNotToday = paintItems.some(row => row.slotLocked && row.paintDate && row.paintDate !== currentDate)
  const allPaintLocked = showPaint && paintItems.every(row => row.slotLocked)
  const todayValidHours = today ? validMarketPickupHours(today, paintItems, currentDate, nowHour) : []
  const todayCanPickup = Boolean(todayIsMarket && !away && !anyLockedNotToday && todayValidHours.length > 0)
  const todayBlockedFull = Boolean(todayFull && !allPaintLocked)
  const needsOtherDay = Boolean((todayBlockedFull || away) && item.delivery.mode === 'market' && !item.delivery.pickupDate)
  const unavailablePickup = showPaint && item.delivery.mode === 'market' && item.delivery.pickupDate
    && !paintDatesForPickup(item.delivery.pickupDate, item.delivery.marketId, firstPaintDate, agendaDays).length
  useEffect(() => {
    if (unavailablePickup) onDelivery(marketPickup(nextMarketPickup(marketDays, firstPaintDate, agendaDays, currentDate, nowHour, today?.marketId)))
  }, [unavailablePickup, firstPaintDate, currentDate, nowHour, today?.marketId]) // eslint-disable-line react-hooks/exhaustive-deps
  // When today cannot take another painting, go straight to the market-day choice instead of a dead end.
  useEffect(() => { if (needsOtherDay) setDatePickerOpen(true) }, [needsOtherDay])
  // Capacity can arrive after the draft picked today: release that unplannable choice once (a board placement stays).
  const staleToday = Boolean(!away && todayBlockedFull && item.delivery.mode === 'market' && item.delivery.pickupDate === today?.date && !item.slotLocked)
  useEffect(() => {
    if (staleToday) onDelivery({ ...item.delivery, pickupDate: undefined, marketDayId: undefined, pickupHour: null, manualDay: false })
  }, [staleToday]) // eslint-disable-line react-hooks/exhaustive-deps
  const isThisToday = Boolean(
    today && (item.delivery.marketDayId ? item.delivery.marketDayId === today.id : item.delivery.pickupDate === today.date),
  )
  const pickupWhen: 'today' | 'another_day' | 'vienna' | 'now' =
    item.kind === 'finished' && item.delivery.mode === 'now'
      ? 'now'
      : item.delivery.mode === 'vienna'
        ? 'vienna'
        : !todayCanPickup
          ? 'another_day'
          : (item.delivery.marketDayId || item.delivery.pickupDate) && !isThisToday
            ? 'another_day'
            : !todayBlockedFull || isThisToday
              ? 'today'
              : 'another_day'

  const pickupDay =
    (item.delivery.marketDayId ? marketDays.find((d) => d.id === item.delivery.marketDayId) : undefined) ??
    (today && item.delivery.pickupDate === today.date && todayCanPickup ? today : undefined) ??
    (item.delivery.pickupDate ? marketDays.find((d) => d.date === item.delivery.pickupDate) : undefined) ??
    (pickupWhen === 'today' ? today : undefined)

  const hours = pickupDay
    ? validMarketPickupHours(pickupDay, paintItems, currentDate, nowHour)
    : []
  // Ornaments the planner will place for this pickup; board-chosen ones count as busy time.
  const previewItems = paintItems.filter((row) => !row.slotLocked)
  const previewBusy = allItems.flatMap((row) => row.kind === 'custom' && !previewItems.includes(row) && row.paintDate && row.paintStart != null && row.paintEnd != null
    ? [{ date: row.paintDate, startHour: row.paintStart, endHour: row.paintEnd }]
    : [])
  // Agenda refreshes (another device booking or freeing time) re-run the preview.
  const agendaKey = agendaDays.map((day) => `${day.marketDay.date}:${day.slots.map((slot) => `${slot.block.id}@${slot.block.startHour}`).join(',')}`).join(';')
  const paintingMarket = paintingMarketOn(agendaDays, pickupDay?.date)
  const canPaintOnPickup = !paintingMarket || paintingMarket.id === pickupDay?.marketId
  const hourPreview = usePickupHourPreview(item.delivery.mode === 'market' && pickupDay && previewItems.length ? pickupDay : null,
    hours, previewItems, previewBusy, firstPaintDate, agendaKey, canPaintOnPickup)
  const [hintHour, setHintHour] = useState<number | null>(null)

  const chosenMarketId = item.delivery.mode === 'market'
    ? item.delivery.marketId ?? today?.marketId
    : today?.marketId
  const marketNameById = new Map(markets.map(m => [m.id, m.name]))
  const datesWithMultipleMarkets = new Set<string>()
  const seenMarketDates = new Set<string>()
  for (const d of marketDays) {
    if (seenMarketDates.has(d.date)) datesWithMultipleMarkets.add(d.date)
    else seenMarketDates.add(d.date)
  }
  const activeMarketId = activeMarket?.id ?? today?.marketId
  const includeOtherToday = !showPaint || (!todayCanPickup && paintItems.some(row => row.slotLocked && row.paintDate === currentDate))
  const dayChoices = marketDays
    .filter(d => d.date > currentDate || (includeOtherToday && d.date === currentDate && d.id !== today?.id))
    .filter(d => isMarketDayValidForItems(d, paintItems, currentDate, nowHour, firstPaintDate, agendaDays))
    .slice()
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (a.marketId === activeMarketId ? -1 : b.marketId === activeMarketId ? 1 : (marketNameById.get(a.marketId) ?? '').localeCompare(marketNameById.get(b.marketId) ?? '')),
    )
  const viennaDays = allDays.filter(d => isViennaDayValidForItems(d, paintItems, currentDate, firstPaintDate, seasonEnd, marketDays))
  const viennaDay = viennaDays.find((d) => d.id === item.delivery.marketDayId) ??
    viennaDays.find((d) => d.date === item.delivery.pickupDate)
  const mixedMarkets = new Set(dayChoices.map((d) => d.marketId)).size > 1

  function capacityLabel(date: string): string {
    const agenda = agendaDays.find((row) => row.marketDay.date === date)
    if (!agenda) return 'Checking availability…'
    const rule = paintingDays.find(row => row.date === date)
    if (!rule) return `${agenda.slots.length} painting sessions scheduled`
    return rule.open ? `${rule.booked}/${rule.maxPaintings} paintings booked` : 'Painting closed'

  }

  function setMode(mode: DeliveryMode | 'today' | 'another_day') {
    onModeChange()
    if (mode === 'now') {
      setDatePickerOpen(false)
      setViennaPickerOpen(false)
      onDelivery({
        mode: 'now',
        pickupDate: today?.date,
        marketDayId: today?.id,
        marketId: today?.marketId,
        pickupHour: null,
        manualDay: false,
      })
      return
    }
    if (mode === 'vienna') {
      setDatePickerOpen(false)
      setViennaPickerOpen(true)
      // The choice is the handoff itself: summary, hints and labels follow it before a day is picked.
      if (item.delivery.mode !== 'vienna') onDelivery({ ...item.delivery, mode: 'vienna', pickupDate: undefined, marketDayId: undefined, marketId: undefined, pickupHour: null, manualDay: false })
      return
    }
    if (mode === 'today' && todayCanPickup && !todayBlockedFull) {
      setDatePickerOpen(false)
      setViennaPickerOpen(false)
      onDelivery({
        mode: 'market',
        pickupDate: today?.date,
        marketDayId: today?.id,
        marketId: today?.marketId ?? chosenMarketId,
        pickupHour: null,
        manualDay: false,
      })
      return
    }
    setViennaPickerOpen(false)
    setDatePickerOpen(true)
    if (item.delivery.mode !== 'market') onDelivery({ ...item.delivery, mode: 'market', pickupDate: undefined, marketDayId: undefined, marketId: today?.marketId, pickupHour: null, manualDay: false })
  }

  const slot = slotLabel(item)
  const paintedAt = paintedElsewhereLabel(item.paintDate, agendaDays, marketDays, activeMarket, pickupDay?.marketId)
  const showMarketOnSelected = Boolean(
    pickupDay && ((today?.marketId && pickupDay.marketId !== today.marketId) || datesWithMultipleMarkets.has(pickupDay.date)),
  )
  const pickupMarketName = pickupDay ? marketNameById.get(pickupDay.marketId) : undefined
  const pickupOptions = [
    ...(todayCanPickup ? [{ value: 'today' as const, label: todayBlockedFull ? 'Today · full' : 'Today', disabled: todayBlockedFull }] : []),
    { value: 'another_day' as const, label: 'Market day' },
    { value: 'vienna' as const, label: 'Delivery' },
  ]
  const showSelectedMarketDay = Boolean(
    !viennaPickerOpen &&
    item.delivery.mode === 'market' &&
    pickupDay &&
    (pickupWhen === 'another_day' || item.kind === 'finished'),
  )

  const cardFinishedItems = shared
    ? allItems.filter((row): row is DraftItem & { marketOrnamentId: string } => row.kind === 'finished' && Boolean(row.marketOrnamentId))
    : item.kind === 'finished' && item.marketOrnamentId
      ? [item as DraftItem & { marketOrnamentId: string }]
      : []

  return (
    <article className={styles.card}>
      {cardFinishedItems.length === 1 ? (() => {
        const pieceId = cardFinishedItems[0].marketOrnamentId
        const piece = marketPieces?.find(row => row.id === pieceId)
        const parts = marketOrnamentParts(pieceId)
        const shortSpec = marketPieceShortSpec(pieceId)
        return (
          <div className={styles.deliveryPiece}>
            <MarketPiecePhoto
              id={pieceId}
              piece={piece}
              probeUploaded={!marketPieces}
              className={styles.deliveryPhoto}
              alt={`Ornament ${pieceId}`}
            />
            <div className={styles.deliveryPieceMeta}>
              <h3 aria-label={title}>{pieceId}</h3>
              {shortSpec ? (
                <p className={styles.pieceSpec}>
                  {parts ? <span className={styles.swatchDot} style={{ background: parts.color.swatch }} aria-hidden="true" /> : null}
                  <StaffText>{shortSpec}</StaffText>
                </p>
              ) : null}
            </div>
          </div>
        )
      })() : (
        <>
          <h3><StaffText>{title}</StaffText></h3>
          {cardFinishedItems.length > 1 ? (
            <ul className={styles.deliveryPieces} aria-label="Selected ornaments">
              {cardFinishedItems.map(entry => {
                const piece = marketPieces?.find(row => row.id === entry.marketOrnamentId)
                const parts = marketOrnamentParts(entry.marketOrnamentId)
                const shortSpec = marketPieceShortSpec(entry.marketOrnamentId)
                return (
                  <li key={entry.id} className={styles.deliveryChip}>
                    <MarketPiecePhoto
                      id={entry.marketOrnamentId}
                      piece={piece}
                      probeUploaded={!marketPieces}
                      className={styles.deliveryPhoto}
                      alt={`Ornament ${entry.marketOrnamentId}`}
                    />
                    <div className={styles.deliveryPieceMeta}>
                      <strong>{entry.marketOrnamentId}</strong>
                      {shortSpec ? (
                        <span className={styles.pieceSpec}>
                          {parts ? <span className={styles.swatchDot} style={{ background: parts.color.swatch }} aria-hidden="true" /> : null}
                          <StaffText>{shortSpec}</StaffText>
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      )}

      {item.kind === 'finished' ? (
        <SegmentedControl
          legend="Handover"
          name={`hand-${item.id}`}
          value={viennaPickerOpen ? 'vienna' : datePickerOpen ? 'market' : item.delivery.mode}
          onChange={(mode) => {
            if (mode === 'now') setMode('now')
            else if (mode === 'vienna') setMode('vienna')
            else setMode(todayIsMarket ? 'today' : 'another_day')
          }}
          options={[
            { value: 'now', label: 'Deliver now' },
            { value: 'market', label: 'Market day' },
            { value: 'vienna', label: 'Delivery' },
          ]}
        />
      ) : (
        <SegmentedControl
          legend="Pickup or delivery"
          name={`when-${item.id}`}
          value={viennaPickerOpen ? 'vienna' : datePickerOpen ? 'another_day' : pickupWhen === 'now' ? 'today' : pickupWhen}
          onChange={(value) => setMode(value)}
          options={pickupOptions}
        />
      )}

      {away && !anyLockedNotToday && item.delivery.mode !== 'vienna' ? (
        <p className={styles.hint} role="status">Gaby is painting at {away.name} today.</p>
      ) : null}

      {!away && todayBlockedFull && todayCanPickup && item.delivery.mode !== 'vienna' ? (
        <p className={styles.hint} role="status">
          {todayFull!.open ? `Today is full (${todayFull!.booked}/${todayFull!.maxPaintings} paintings booked).` : 'Painting is closed today.'} Automatic planning cannot add one: choose another market day, or place it on the board by hand.
        </p>
      ) : null}

      {showSelectedMarketDay && pickupDay ? (
        <button
          type="button"
          className={styles.selectedDate}
          aria-expanded={datePickerOpen}
          aria-controls={`market-day-calendar-${item.id}`}
          onClick={() => setDatePickerOpen((open) => !open)}
        >
          <CalendarIcon />
          <span>
            <strong>{showMarketOnSelected && pickupMarketName ? `${pickupMarketName} · ${formatDateLabel(pickupDay.date)}` : formatDateLabel(pickupDay.date)}</strong>
            <small>{capacityLabel(pickupDay.date)}</small>
          </span>
          <ChevronIcon open={datePickerOpen} />
        </button>
      ) : null}

      {datePickerOpen ? (
        <div className={styles.datePicker} id={`market-day-calendar-${item.id}`}>
          <div className={styles.datePickerHead}>
            <div>
              <strong>Choose market day</strong>
              <small>Painting bookings and daily limits are shown for each day.</small>
            </div>
            <button type="button" className={styles.closePicker} onClick={() => setDatePickerOpen(false)} aria-label="Close market day picker">
              <CloseIcon />
            </button>
          </div>
          {dayChoices.length ? (
            <ChoiceList
              legend="Market day"
              name={`day-${item.id}`}
              value={pickupDay?.id ?? item.delivery.marketDayId ?? null}
              onChange={(marketDayId) => {
                const md = marketDays.find((d) => d.id === marketDayId)
                if (!md) return
                onDelivery({
                  ...item.delivery,
                  mode: 'market',
                  pickupDate: md.date,
                  marketDayId: md.id,
                  marketId: md.marketId,
                  pickupHour: null,
                  manualDay: true,
                })
                setDatePickerOpen(false)
              }}
              compact
              choices={dayChoices.map((d) => {
                const marketName = marketNameById.get(d.marketId)
                const showMarketTitle = Boolean((today?.marketId && d.marketId !== today.marketId) || datesWithMultipleMarkets.has(d.date))
                return {
                  value: d.id,
                  title: showMarketTitle && marketName ? `${marketName} · ${formatDateLabel(d.date)}` : formatDateLabel(d.date),
                  body: [!showMarketTitle && mixedMarkets ? marketName : null, capacityLabel(d.date)].filter(Boolean).join(' · '),
                }
              })}
            />
          ) : (
            <p className={styles.emptyDates}>
              {lockedDate
                ? 'No market pickup days left after the chosen paint date. Choose Delivery instead or change the paint time.'
                : 'No future market pickup days available.'}
            </p>
          )}
        </div>
      ) : null}

      {!datePickerOpen && item.delivery.mode === 'vienna' && (viennaDay || !viennaPickerOpen) ? (
        <button
          type="button"
          className={styles.selectedDate}
          aria-expanded={viennaPickerOpen}
          aria-controls={`delivery-day-calendar-${item.id}`}
          onClick={() => setViennaPickerOpen((open) => !open)}
        >
          <CalendarIcon />
          <span>
            <strong>{viennaDay ? formatDateLabel(viennaDay.date) : 'Choose delivery day'}</strong>
            <small>Vienna delivery</small>
          </span>
          <ChevronIcon open={viennaPickerOpen} />
        </button>
      ) : null}

      {viennaPickerOpen ? (
        <div className={styles.datePicker} id={`delivery-day-calendar-${item.id}`}>
          <div className={styles.datePickerHead}>
            <div>
              <strong>Choose delivery day</strong>

            </div>
            <button type="button" className={styles.closePicker} onClick={() => setViennaPickerOpen(false)} aria-label="Close delivery day picker">
              <CloseIcon />
            </button>
          </div>
          {viennaDays.length ? (
            <ChoiceList
              legend="Delivery day"
              name={`vienna-${item.id}`}
              value={item.delivery.mode === 'vienna' ? item.delivery.pickupDate ?? null : null}
              onChange={(date) => {
                const md = viennaDays.find((d) => d.date === date)
                onDelivery({
                  ...item.delivery,
                  mode: 'vienna',
                  pickupDate: date,
                  marketDayId: md?.id,
                  marketId: md?.marketId,
                  pickupHour: null,
                })
                setViennaPickerOpen(false)
              }}
              compact
              choices={viennaDays.map((d) => ({
                value: d.date,
                title: formatDateLabel(d.date),
                body: capacityLabel(d.date),
              }))}
            />
          ) : (
            <p className={styles.emptyDates}>No delivery days available.</p>
          )}
        </div>
      ) : null}

      {item.kind === 'finished' && item.delivery.mode === 'now' ? (
        <p className={styles.lead}>Deliver now at the stall.</p>
      ) : null}

      {!datePickerOpen && !viennaPickerOpen && item.delivery.mode === 'market' && pickupDay && hours.length ? (
        <div className={styles.pickupTime}>
          <p className={styles.legend}>Pickup hour</p>
          <div className={styles.hours} onMouseLeave={() => setHintHour(null)}>
            {hours.map((hour) => {
              const tooEarly = paintItems.some((row) => row.slotLocked && row.paintDate === pickupDay.date && row.paintEnd != null && hour < row.paintEnd + PAINT_HANDLING_HOURS - 0.001)
              const plan = hourPreview?.[hour]
              const checking = previewItems.length > 0 && !hourPreview
              const noTime = plan?.ok === false
              const selected = item.delivery.pickupHour === hour
              // Disabled buttons get no mouse events, so the wrapper carries the hover hint.
              return (
                <span key={hour} className={styles.hourWrap} title={tooEarly ? 'Painting will not be finished yet' : noTime ? `No painting time before ${formatHour(hour)}` : plan?.ok ? `Paint ${paintSlotsLabel(plan.slots, pickupDay.date)}` : undefined} onMouseEnter={() => setHintHour(hour)}>
                  <Button
                    tone="staff"
                    variant="secondary"
                    // A chosen hour stays selectable so staff can see why it no longer works.
                    disabled={tooEarly || (!selected && (checking || noTime))}
                    aria-describedby={`pickup-hint-${item.id}`}
                    selected={selected}
                    onFocus={() => setHintHour(hour)}
                    onBlur={() => setHintHour(null)}
                    onClick={() => onDelivery({ ...item.delivery, pickupHour: hour })}
                  >
                    {formatHour(hour)}
                  </Button>
                </span>
              )
            })}
          </div>
          <p className={styles.hourHint} id={`pickup-hint-${item.id}`} aria-live="polite">
            {pickupHint(hintHour ?? item.delivery.pickupHour ?? null, hourPreview, previewItems.length, pickupDay.date)}
          </p>
          {hourPreview && previewItems.length > 0 && hours.every(hour => hourPreview[hour]?.ok === false) ? (
            <p className={styles.planPrompt}>
              No painting time before any pickup hour on this day. Choose another day or{' '}
              <button type="button" className={styles.textBtn} onClick={() => onPlace(previewItems[0])}>place it on the agenda</button>.
            </p>
          ) : null}
        </div>
      ) : null}

      {showPaint && !datePickerOpen && !viennaPickerOpen ? (
        <div className={styles.slotBox}>
          <h4 className={styles.planTitle}>Painting plan</h4>
          {paintItems.length === 1 && item.slotLocked && slot && !slotTaken ? (
            <div className={styles.planSelected} role="status">
              {item.plannedMove && <strong>Change added to this sale</strong>}
              {item.plannedMove ? <p>{item.plannedMove.orderCode} → {formatDateLabel(item.plannedMove.to.date)} · {formatHour(item.plannedMove.to.startHour)}–{formatHour(item.plannedMove.to.endHour)}</p> : null}
              <strong><StaffText>{slot}</StaffText></strong>
              {paintedAt ? <small>{paintedAt}</small> : null}
              {item.plannedMove ? <small>Saved together with the order.</small> : null}
              <button type="button" className={styles.textBtn} onClick={() => onChangeSlot(item)}>{item.plannedMove ? 'Undo change' : 'Change'}</button>
            </div>
          ) : item.delivery.mode === 'vienna' && !item.delivery.pickupDate ? (
            <p className={styles.planPrompt}>Choose the delivery day to calculate a safe painting time.</p>
          ) : item.delivery.mode === 'market' && item.delivery.pickupHour == null ? (
            <p className={styles.planPrompt}>Choose the pickup hour to calculate a safe painting time.</p>
          ) : paintItems.length > 1 ? (
            <>
              <ul className={styles.sessionList}>
                {paintItems.map((row) => {
                  const rowSlot = slotLabel(row)
                  const rowPaintedAt = paintedElsewhereLabel(row.paintDate, agendaDays, marketDays, activeMarket, pickupDay?.marketId)
                  const failed = !rowSlot && suggestions[row.id] && !suggestions[row.id].ok
                  return (
                    <li key={row.id} data-state={rowSlot ? 'ok' : failed ? 'missing' : 'pending'}>
                      <div>
                        <strong>{itemLabel(row, allItems.findIndex((entry) => entry.id === row.id))}</strong>
                        <p>
                          {rowSlot
                            ? <StaffText>{rowSlot}</StaffText>
                            : failed ? 'No free time before pickup' : 'Checking paint times…'}
                        </p>
                        {rowSlot && rowPaintedAt ? <small>{rowPaintedAt}</small> : null}
                      </div>
                      <Button tone="staff" variant={failed ? 'secondary' : 'ghost'} onClick={() => onPlace(row)}>
                        {failed ? 'Place on agenda' : 'Change'}
                      </Button>
                    </li>
                  )
                })}
              </ul>
              {slotTaken ? <p className={styles.planPrompt}>One of these times was just taken. Tap Change to pick a new one.</p> : null}
            </>
          ) : slotTaken ? (
            <p>
              That hour is taken
              {' · '}
              <button type="button" className={styles.textBtn} onClick={() => onChangeSlot(item)}>
                change
              </button>
              {' / '}
              <button type="button" className={styles.textBtn} onClick={() => onPlace(item)}>
                place on board
              </button>
            </p>
          ) : item.slotLocked && slot ? (
            <div className={styles.planSelected} role="status">
              {item.plannedMove && <strong>Change added to this sale</strong>}
              {item.plannedMove ? <p>{item.plannedMove.orderCode} → {formatDateLabel(item.plannedMove.to.date)} · {formatHour(item.plannedMove.to.startHour)}–{formatHour(item.plannedMove.to.endHour)}</p> : null}
              <strong><StaffText>{slot}</StaffText></strong>
              {paintedAt ? <small>{paintedAt}</small> : null}
              {item.plannedMove ? <small>Saved together with the order.</small> : null}
              <button type="button" className={styles.textBtn} onClick={() => onChangeSlot(item)}>{item.plannedMove ? 'Undo change' : 'Change'}</button>
            </div>
          ) : slot ? (
            <div className={styles.planSelected}>
              <strong><StaffText>{slot}</StaffText></strong>
              {paintedAt ? <small>{paintedAt}</small> : null}
              <button type="button" className={styles.textBtn} onClick={() => onPlace(item)}>Change</button>
            </div>
          ) : (
            moveSuggestion ? (
              <div className={styles.moveSuggestion}>
                <strong>No free time — one change makes room</strong>
                <ol className={styles.moveSteps}>
                  <li><span aria-hidden="true" className={styles.stepIcon}><svg viewBox="0 0 24 24" focusable="false"><path d="M5 7h10a4 4 0 0 1 0 8H8m0 0l3-3m-3 3l3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><strong>Move {moveSuggestion.title} · {moveSuggestion.orderCode}</strong><p>{formatDateLabel(moveSuggestion.from.date)} · {formatHour(moveSuggestion.from.startHour)}–{formatHour(moveSuggestion.from.endHour)}</p><p>→ {formatDateLabel(moveSuggestion.to.date)} · {formatHour(moveSuggestion.to.startHour)}–{formatHour(moveSuggestion.to.endHour)}</p><small>Customer pickup stays the same.</small></div></li>
                  <li><span aria-hidden="true" className={styles.stepIcon}><svg viewBox="0 0 24 24" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span><div><strong>Paint this ornament in the freed time</strong><p>{formatDateLabel(moveSuggestion.freedSlot.date)} · {formatHour(moveSuggestion.freedSlot.startHour)}–{formatHour(moveSuggestion.freedSlot.endHour)}</p></div></li>
                </ol>
                <Button tone="staff" onClick={() => onApplyMove(moveSuggestion)}>
                  Use this plan
                </Button>
              </div>
            ) : (
              <p>
                {suggestion && !suggestion.ok ? 'No safe paint time found. Choose another pickup day or review the agenda.' : 'Checking paint times…'}{' '}
                <button type="button" className={styles.textBtn} onClick={() => onPlace(item)}>Check agenda</button>
              </p>
            )
          )}
        </div>
      ) : null}

    </article>
  )
}

type PaintSlot = { date: string; startHour: number; endHour: number }
type HourPreview = Record<number, { ok: boolean; slots: PaintSlot[] }>

/** For each pickup hour, the paint times the automatic planner would choose (same order and rules). */
async function previewPickupHours(pickup: MarketDay, hours: number[], items: DraftItem[], busy: PaintSlot[], currentDate: string, canPaintOnPickup: boolean): Promise<HourPreview> {
  const { date, id: handoffMarketDayId } = pickup
  const cache = new Map<string, Promise<CapacityResult>>()
  const check = (input: Parameters<typeof api.agenda.checkCapacity>[0]) => {
    const key = JSON.stringify(input)
    let result = cache.get(key)
    if (!result) { result = api.agenda.checkCapacity(input); cache.set(key, result) }
    return result
  }
  const dates = paintDatesToTry(date, currentDate).filter(day => day < date || canPaintOnPickup)
  const out: HourPreview = {}
  await Promise.all(hours.map(async (hour) => {
    const planned = [...busy]
    const slots: PaintSlot[] = []
    for (const item of items) {
      const candidates = await Promise.all(dates.map((day) => check({
        date: day,
        durationHours: minutesToHours(item.durationMinutes),
        beforeHour: day === date ? hour - PAINT_HANDLING_HOURS : undefined,
        handoffMarketDayId,
        extraBusy: planned.filter((slot) => slot.date === day).map(({ startHour, endHour }) => ({ startHour, endHour })),
      })))
      const hit = candidates.find((candidate) => candidate.ok && candidate.slot)?.slot
      if (!hit) { out[hour] = { ok: false, slots }; return }
      slots.push(hit)
      planned.push(hit)
    }
    out[hour] = { ok: true, slots }
  }))
  return out
}

function usePickupHourPreview(pickup: MarketDay | null, hours: number[], items: DraftItem[], busy: PaintSlot[], currentDate: string, refreshKey: string, canPaintOnPickup: boolean): HourPreview | null {
  const key = pickup
    ? [refreshKey, pickup.id, pickup.date, canPaintOnPickup, currentDate, hours.join(','), items.map((row) => `${row.id}:${row.durationMinutes}`).join(','), busy.map((slot) => `${slot.date}@${slot.startHour}-${slot.endHour}`).join(',')].join('|')
    : ''
  const [state, setState] = useState<{ key: string; value: HourPreview } | null>(null)
  useEffect(() => {
    if (!pickup) return
    let cancelled = false
    // On a failed check nothing is disabled; the normal planner still reports the problem.
    previewPickupHours(pickup, hours, items, busy, currentDate, canPaintOnPickup)
      .then((value) => { if (!cancelled) setState({ key, value }) })
      .catch(() => { if (!cancelled) setState({ key, value: {} }) })
    return () => { cancelled = true }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return state && state.key === key ? state.value : null
}

function paintSlotsLabel(slots: PaintSlot[], pickupDate: string) {
  return slots.map((slot) => `${slot.date === pickupDate ? '' : `${formatDateLabel(slot.date)} `}${formatHour(slot.startHour)}–${formatHour(slot.endHour)}`).join(', ')
}

function pickupHint(hour: number | null, preview: HourPreview | null, count: number, pickupDate: string) {
  if (!count) return ''
  if (!preview) return 'Checking paint times…'
  const plan = hour == null ? undefined : preview[hour]
  if (hour == null || !plan) return 'Grey hours leave no time to paint before pickup.'
  if (!plan.ok) return `Pickup ${formatHour(hour)} · no painting time left before it.`
  return `Pickup ${formatHour(hour)} · paint ${paintSlotsLabel(plan.slots, pickupDate)}`
}

function depositValue(text: string, total: number) { return text.trim() ? Number(text.replace(',', '.')) : Math.round(total * 50) / 100 }
function validDeposit(text: string, total: number) { const amount = depositValue(text, total); return Number.isFinite(amount) && amount > 0 && amount < total }
function SalePaymentFields({ state, onState, method, onMethod, deposit, onDeposit, total }: {
  state: PaymentState; onState: (state: PaymentState) => void; method: PaymentMethod | null; onMethod: (method: PaymentMethod) => void; deposit: string; onDeposit: (value: string) => void; total: number
}) {
  return <>
    <SegmentedControl legend="Payment state" name="sale-payment-state" value={state} onChange={onState} options={[{ value: 'paid', label: 'Paid' }, { value: 'deposit', label: 'Deposit' }, { value: 'unpaid', label: 'Unpaid' }]} />
    {state !== 'unpaid' && <SegmentedControl legend="Payment method" name="sale-payment-method" value={method} onChange={onMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />}
    {state === 'deposit' && <Field label="Deposit received (€)" htmlFor="sale-deposit" hint={`Leave empty for 50% · ${formatEur(Math.round(total * 50) / 100, 'en')}`} error={validDeposit(deposit, total) ? undefined : 'Enter an amount greater than zero and less than the total.'}><input id="sale-deposit" inputMode="decimal" value={deposit} onChange={event => onDeposit(event.target.value)} /></Field>}
  </>
}

/** Inline icons: drawn, not text glyphs, so they align and scale with the control. */
function CalendarIcon() {
  return <span className={styles.calendarIcon} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="4" y="5.5" width="16" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
}

function ChevronIcon({ open }: { open: boolean }) {
  return <span className={styles.dateChevron} data-open={open || undefined} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
}

function CloseIcon() {
  return <svg className={styles.closeIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" /></svg>
}
