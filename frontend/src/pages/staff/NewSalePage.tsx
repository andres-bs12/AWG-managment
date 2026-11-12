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
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { useOrderFormStatus } from '../../lib/useOrderFormStatus'
import { QrCode } from '../../components/staff/QrCode'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { ChoiceList } from '../../components/ui/ChoiceList'
import { Field } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { AgendaDay, CapacityResult, Market, MarketDay, MoveSuggestion, OrnamentColor, PaymentMethod, PaymentState, InventoryItem, PaintingDay } from '../../domain/types'
import { isMarketPickupWeekday, isViennaWeekday, paintDatesToTry } from '../../lib/calendar'
import { formatDateLabel, formatHour, hoursOverlap, minutesToHours, pickupHourOptions } from '../../lib/time'
import { formatEur, itemCost, type Pricing } from '../../lib/money'
import { OrderSummaryPanel } from './OrderSummaryPanel'
import {
  draftTotal,
  buildDraftFromParams,
  clearStoredDraft,
  itemLabel,
  makeCustom,
  makeFinished,
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
import { viennaClock } from '../../lib/viennaClock'
import { finishForColor, firstAvailableCustom, remainingColor, remainingStock, stockLabel } from '../../lib/saleStock'

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

function fillDayRefs(item: DraftItem, days: MarketDay[], markets: Market[], seasonEnd: string): DraftItem {
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
  const pickupDays = days.filter(
    (d) => isMarketPickupWeekday(d.date) && markets.find((m) => m.id === d.marketId)?.kind === 'market',
  )
  const md =
    pickupDays.find((d) => d.id === item.delivery.marketDayId) ??
    pickupDays.find((d) => d.date === date) ??
    pickupDays.find((d) => date && d.date >= date) ??
    pickupDays.find((d) => d.isToday) ??
    pickupDays[0]
  if (!md) return item
  return {
    ...item,
    delivery: {
      ...item.delivery,
      marketDayId: md.id,
      marketId: md.marketId,
      pickupDate: item.delivery.pickupDate && isMarketPickupWeekday(item.delivery.pickupDate) ? item.delivery.pickupDate : md.date,
    },
  }
}

function paintFitsHandoff(item: DraftItem, delivery: DraftItem['delivery']): boolean {
  if (item.kind !== 'custom' || !item.paintDate || item.paintEnd == null || !delivery.pickupDate) return false
  if (delivery.mode === 'vienna') return item.paintDate < delivery.pickupDate
  if (delivery.mode !== 'market' || item.paintDate > delivery.pickupDate) return false
  if (item.paintDate < delivery.pickupDate) return true
  return delivery.pickupHour == null || item.paintEnd <= delivery.pickupHour
}

export function NewSalePage() {
  const navigate = useNavigate()
  const clock = useStaffClock()
  const version = useStaffRefresh()
  const [prices, setPrices] = useState<Pricing | null>(null)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
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
  const [copied, setCopied] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null)
  const [payState, setPayState] = useState<PaymentState>('paid')
  const [depositAmount, setDepositAmount] = useState('')
  const [paidNote, setPaidNote] = useState('')
  // What this screen recorded, so the done screen can show the balance after a deposit.
  const [paidAmount, setPaidAmount] = useState<number | null>(null)
  const [doneQrOpen, setDoneQrOpen] = useState(false)
  const [finishedHandoff, setFinishedHandoff] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  // null = closed. The order is re-read first: a paid order must not be deleted, and a sent form means a cancellation e-mail.
  const [changeDate, setChangeDate] = useState<{ state: 'checking' | 'ready' | 'unknown' | 'paid'; formSent: boolean } | null>(null)
  const [planRetry, setPlanRetry] = useState(0)

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
      setPayMethod(null); setPayState('paid'); setDepositAmount(''); setPaidNote(''); setPaidAmount(null); setDoneQrOpen(false); setCopied(false); setError('')
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
      setPrices(config); setConfigError(''); setInventory(stock); setSeasonEnd(config.seasonEnd)
      setMarkets(m); setDays(d); setAgendaDays(agenda)
      if (d.length) {
        setDraft(current => ({ ...current, items: current.items.map(item => fillDayRefs(item, d, m, config.seasonEnd)) }))
        // The endpoint caps ranges at 62 days: load only upcoming days, in API-sized ranges, so an
        // old market day or a long season can no longer block the whole sale screen.
        const ranges = upcomingWindows(d.map(day => day.date), viennaClock().date)
        const rules = (await Promise.all(ranges.map(([from, to]) => api.paintingDays.list(from, to)))).flat()
        if (active) setPaintingDays(rules)
      }
    }).catch(err => { if (active) setConfigError(err instanceof Error && err.message ? err.message : 'Check the connection.') })
    return () => { active = false }
  }, [version, configRetry])

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
      if (draft.phase === 'done') clearStoredDraft()
      return
    }
    writeStoredDraft({ ...draft, idempotencyKey: saleKey.current })
  }, [draft])

  const today = days.find(d => d.isToday && markets.find(m => m.id === d.marketId)?.kind === 'market') ?? days.find(d => d.isToday)
  const currentDate = today?.date ?? clock.date
  const marketDays = days.filter(
    (d) => markets.find((m) => m.id === d.marketId)?.kind === 'market' && isMarketPickupWeekday(d.date),
  )
  const onlyFinished = draft.items.length > 0 && draft.items.every((item) => item.kind === 'finished')
  const hasCustom = draft.items.some((item) => item.kind === 'custom')
  const mixed = hasCustom && draft.items.some((item) => item.kind === 'finished')
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
        const dates = paintDatesToTry(handoff, currentDate).filter((date) => item.delivery.mode !== 'vienna' || date < handoff)
        let result: CapacityResult = {
          ok: false,
          slot: null,
          remainingHours: 0,
          message: 'No free paint slot before this handoff.',
        }
        const candidates = await Promise.all(dates.map(date => api.agenda.checkCapacity({
          date,
          durationHours: minutesToHours(item.durationMinutes),
          beforeHour: date === handoff && item.delivery.mode === 'market' ? item.delivery.pickupHour ?? undefined : undefined,
          extraBusy: busyOn(date, item.id),
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
            date, durationHours: minutesToHours(item.durationMinutes), handoffDate: handoff,
            beforeHour: date === handoff && item.delivery.mode === 'market' ? item.delivery.pickupHour ?? undefined : undefined,
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
  }, [phase, suggestKey, currentDate, hasCustom, planRetry])

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
    setDraft((current) => {
      const different = current.differentPickups || mixed
      return {
        ...current,
        differentPickups: different,
        items: current.items.map((item) => {
          const apply = item.id === id || !different
          if (!apply) return item
          const next = { ...item.delivery, ...delivery }
          const handoffChanged = next.pickupDate !== item.delivery.pickupDate || next.pickupHour !== item.delivery.pickupHour || next.mode !== item.delivery.mode
          const keepChosenSlot = item.slotLocked && !item.plannedMove && paintFitsHandoff(item, next)
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

  function addItem(kind: 'custom' | 'finished') {
    if (!draft.items.length && !draft.order) saleKey.current = uid()
    setDraft((current) => {
      // A new custom ornament starts on the first combination still in stock (counting this draft).
      const combo = kind === 'custom' ? firstAvailableCustom(inventory, current.items) : null
      const next = kind === 'custom' ? makeCustom({ ...(combo ?? {}), delivery: { mode: 'market', pickupDate: todayPaintingFull(paintingDays, today) ? undefined : today?.date } }) : makeFinished()
      const items = [...current.items.map((item) => item.plannedMove ? { ...item, plannedMove: undefined, slotLocked: false, paintDate: undefined, paintStart: undefined, paintEnd: undefined } : item), fillDayRefs(next, days, markets, seasonEnd)]
      const mixedNow = items.some((i) => i.kind === 'custom') && items.some((i) => i.kind === 'finished')
      return { ...current, items, differentPickups: current.differentPickups || mixedNow }
    })
  }

  function removeItem(id: string) {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
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
    const date = item.paintDate || (handoff ? paintDatesToTry(handoff, currentDate)[0] : today?.date)
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
    setDoneQrOpen(false)
    setDepositAmount('')
    setCopied(false)
    setError('')
    setDraft({ items: [], differentPickups: false, phase: 'items' })
    navigate('/staff/sales/new', { replace: true })
  }

  async function createOrder(): Promise<NonNullable<SaleDraft['order']>> {
    if (draft.order) return draft.order
    if (!prices) throw new Error('Load server prices before creating a sale.')
    writeStoredDraft({ ...draft, idempotencyKey: saleKey.current })
    const created = await api.orders.createSale({
      items: toCreateItems(draft.items, days, today),
      plannedMove: draft.items.find((item) => item.plannedMove)?.plannedMove,
    }, saleKey.current)
    const ref = { id: created.id, code: created.code, formToken: created.formToken, total: created.total }
    setDraft((current) => ({ ...current, order: ref }))
    return ref
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
      setError(saleErrorMessage(err, 'Could not record sale'))
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
    const missing = draft.items.filter(
      (item) => item.kind === 'custom' && (item.paintStart == null || item.paintEnd == null || !item.paintDate),
    )
    if (missing.length) {
      setError('Assign a paint slot — use the suggestion or place on the board.')
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
      setError(saleErrorMessage(err, 'Could not create sale'))
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

  // Plain step names: "1 Item" read like a quantity.
  const stepLabels = !draft.items.length
    ? ['Items']
    : onlyFinished
      ? ['Items', 'Hand over & pay']
      : ['Items', allVienna ? 'Delivery' : 'Pickup', 'QR & payment']

  function stepOn(index: number) {
    if (!draft.items.length || phase === 'items') return index === 0
    if (onlyFinished) return index === 1
    if (phase === 'delivery') return index === 1
    return index === 2
  }

  const sharedItem = draft.items[0]
  const deliveryItems = draft.differentPickups || mixed ? draft.items : sharedItem ? [sharedItem] : []

  return (
    <section className={styles.page}>
      <div className={styles.head}>
        <div>
          <h1 ref={pageHeading} tabIndex={-1} className={styles.focusHeading}>New sale</h1>
          <p className={styles.steps}>
            {stepLabels.map((label, index) => (
              <span key={label} data-on={stepOn(index) ? 'true' : 'false'} aria-current={stepOn(index) && phase !== 'done' ? 'step' : undefined}>
                {label}
              </span>
            ))}
          </p>
        </div>
        {phase !== 'done' && (order || draft.items.length > 0) ? (
          <Button tone="staff" variant="ghost" onClick={() => { if (order) setLeaveOpen(true); else startOver() }}>
            {order ? 'New sale' : 'Start over'}
          </Button>
        ) : null}
      </div>

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
      <div className={styles.workspace}>
        <div className={styles.main}>
          {phase !== 'items' && <h2 ref={stepHeading} tabIndex={-1} className={styles.focusHeading}>{title[phase]}</h2>}
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
              stockReady={Boolean(prices)}
              onAdd={addItem}
              onRemove={removeItem}
              onToggleName={toggleName}
              onColor={setColor}
              onFinish={(item, finish) => patchItem(item.id, { finish })}
              onDuration={setDuration}
              onContinue={() => {
                if (!draft.items.length) return
                if (!prices || configError) { setError('Prices and stock are still loading. Wait a moment or tap Try again.'); return }
                const shortage = draft.items.find(item => { const quantity = inventory.find(row => row.kind === item.kind && (item.kind === 'finished' || (row.color === item.color && row.finish === item.finish)))?.quantity ?? 0; const count = draft.items.filter(other => other.kind === item.kind && (item.kind === 'finished' || (other.color === item.color && other.finish === item.finish))).length; return count > quantity })
                if (shortage) { setError(`Out of stock: ${shortage.kind === 'finished' ? 'finished ornaments' : `${shortage.finish} ${shortage.color} ornaments`}. Reduce the quantity or choose another combination.`); return }
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
                    onChange={(e) => setDraft((current) => ({ ...current, differentPickups: e.target.checked || mixed }))}
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
                    allItems={draft.items}
                    paintItems={paintItems}
                    markets={markets}
                    marketDays={marketDays}
                    allDays={days}
                    seasonEnd={seasonEnd}
                    agendaDays={agendaDays}
                    paintingDays={paintingDays}
                    nowHour={clock.hour}
                    currentDate={currentDate}
                    today={today}
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
                  disabled={busy || !prices || Boolean(configError) || !draft.items.length || draft.items.some(item => item.kind === 'custom' && item.paintStart == null) || (onlyFinished && payState !== 'unpaid' && !payMethod) || (onlyFinished && payState === 'deposit' && !validDeposit(depositAmount, prices ? draft.items.reduce((sum, item) => sum + itemCost(item.kind, item.withName, prices), 0) : 0))}
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
                  <StaffActions className={styles.actions} total={balanceDue != null && paidAmount != null ? balanceDue : order.total} totalLabel={paidAmount == null ? 'Total' : balanceDue === 0 ? 'Total · paid' : 'Balance due'}>
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
        <OrderSummaryPanel prices={prices} items={draft.items} markets={markets} days={days} orderCode={order?.code} showHandoff={phase !== 'items'} />
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

function ItemsStep({
  items,
  prices,
  inventory,
  stockReady,
  onAdd,
  onRemove,
  onToggleName,
  onColor,
  onFinish,
  onDuration,
  onContinue,
}: {
  prices: Pricing | null
  inventory: InventoryItem[]
  stockReady: boolean
  items: DraftItem[]
  onAdd: (kind: 'custom' | 'finished') => void
  onRemove: (id: string) => void
  onToggleName: (item: DraftItem) => void
  onColor: (item: DraftItem, color: OrnamentColor) => void
  onFinish: (item: DraftItem, finish: import('../../domain/types').CustomFinish) => void
  onDuration: (item: DraftItem, preset: DurationPreset, customMinutes?: number) => void
  onContinue: () => void
}) {
  const finishedLeft = remainingStock(inventory, items, 'finished')
  const finishedHint = stockReady ? `Finished stock: ${stockLabel(finishedLeft)}` : 'Checking stock…'
  const customSoldOut = stockReady && !firstAvailableCustom(inventory, items)
  return (
    <>
      {items.length === 0 ? (
        // Empty sale: the two starting choices sit right under the question, with no €0.00 total.
        <div className={styles.startChoices}>
          <Button tone="staff" variant="choice" size="lg" onClick={() => onAdd('custom')}>
            <span><strong>+ Add custom ornament</strong><small>{customSoldOut ? 'Sold out · update Stock first' : "Painted from the customer's photos"}</small></span>
          </Button>
          <Button tone="staff" variant="choice" size="lg" disabled={stockReady && finishedLeft === 0} onClick={() => onAdd('finished')}>
            <span><strong>+ Add finished product</strong><small>{finishedHint}</small></span>
          </Button>
        </div>
      ) : (
        <>
          {items.map((item, index) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHead}>
                <h3>
                  <StaffText>{`${itemLabel(item, index)} · ${prices ? formatEur(itemCost(item.kind, item.withName, prices), 'en') : 'Price unavailable'}`}</StaffText>
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
              })() : null}
            </article>
          ))}
          <div className={styles.addRow}>
            <Button tone="staff" variant="secondary" onClick={() => onAdd('custom')}>
              + Add custom
            </Button>
            <Button tone="staff" variant="secondary" disabled={stockReady && finishedLeft === 0} onClick={() => onAdd('finished')}>
              + Add finished
            </Button>
            <span className={styles.hint}>{finishedHint}</span>
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
  allItems,
  paintItems,
  markets,
  marketDays,
  allDays,
  seasonEnd,
  agendaDays,
  paintingDays,
  nowHour,
  currentDate,
  today,
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
  allItems: DraftItem[]
  paintItems: DraftItem[]
  markets: Market[]
  marketDays: MarketDay[]
  allDays: MarketDay[]
  seasonEnd: string
  agendaDays: AgendaDay[]
  paintingDays: PaintingDay[]
  nowHour: number
  currentDate: string
  today?: MarketDay
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
  const todayFull = item.kind === 'custom' && todayIsMarket ? todayPaintingFull(paintingDays, today) : null
  const needsOtherDay = Boolean(todayFull && item.delivery.mode === 'market' && !item.delivery.pickupDate)
  // When today cannot take another painting, go straight to the market-day choice instead of a dead end.
  useEffect(() => { if (needsOtherDay) setDatePickerOpen(true) }, [needsOtherDay])
  // Capacity can arrive after the draft picked today: release that unplannable choice once (a board placement stays).
  const staleToday = Boolean(todayFull && item.delivery.mode === 'market' && item.delivery.pickupDate === today?.date && !item.slotLocked)
  useEffect(() => {
    if (staleToday) onDelivery({ ...item.delivery, pickupDate: undefined, marketDayId: undefined, pickupHour: null })
  }, [staleToday]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickupWhen: 'today' | 'another_day' | 'vienna' | 'now' =
    item.kind === 'finished' && item.delivery.mode === 'now'
      ? 'now'
      : item.delivery.mode === 'vienna'
        ? 'vienna'
        : item.delivery.pickupDate && today && item.delivery.pickupDate !== today.date
          ? 'another_day'
          : todayIsMarket && (!todayFull || item.delivery.pickupDate === today?.date)
            ? 'today'
            : 'another_day'

  const pickupDay =
    marketDays.find((d) => d.id === item.delivery.marketDayId) ??
    marketDays.find((d) => d.date === item.delivery.pickupDate) ??
    (pickupWhen === 'today' ? today : undefined)

  const hours = pickupDay
    ? pickupHourOptions(pickupDay.openHour, pickupDay.closeHour, pickupDay.isToday ? nowHour : undefined)
    : []
  // Ornaments the planner will place for this pickup; board-chosen ones count as busy time.
  const previewItems = paintItems.filter((row) => !row.slotLocked)
  const previewBusy = allItems.flatMap((row) => row.kind === 'custom' && !previewItems.includes(row) && row.paintDate && row.paintStart != null && row.paintEnd != null
    ? [{ date: row.paintDate, startHour: row.paintStart, endHour: row.paintEnd }]
    : [])
  // Agenda refreshes (another device booking or freeing time) re-run the preview.
  const agendaKey = agendaDays.map((day) => `${day.marketDay.date}:${day.slots.map((slot) => `${slot.block.id}@${slot.block.startHour}`).join(',')}`).join(';')
  const hourPreview = usePickupHourPreview(item.delivery.mode === 'market' && pickupDay && previewItems.length ? pickupDay.date : null, hours, previewItems, previewBusy, currentDate, agendaKey)
  const [hintHour, setHintHour] = useState<number | null>(null)

  const chosenMarketId = item.delivery.mode === 'market'
    ? item.delivery.marketId ?? today?.marketId
    : today?.marketId
  const daysOfMarket = marketDays.filter((d) => !chosenMarketId || d.marketId === chosenMarketId)
  const futureDays = marketDays.filter(d => d.date > currentDate)
  const viennaDays = allDays.filter((d) => (isViennaWeekday(d.date) || d.date === seasonEnd) && d.date <= seasonEnd && d.date >= currentDate && !marketDays.some(m => m.date === d.date) && (item.kind === 'finished' || paintDatesToTry(d.date, today?.date).some(date => date < d.date)))
  const viennaDay = viennaDays.find((d) => d.id === item.delivery.marketDayId) ??
    viennaDays.find((d) => d.date === item.delivery.pickupDate)
  const mixedMarkets = new Set(futureDays.map((d) => d.marketId)).size > 1
  const dayChoices = futureDays

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
      })
      return
    }
    if (mode === 'vienna') {
      setDatePickerOpen(false)
      setViennaPickerOpen(true)
      // The choice is the handoff itself: summary, hints and labels follow it before a day is picked.
      if (item.delivery.mode !== 'vienna') onDelivery({ ...item.delivery, mode: 'vienna', pickupDate: undefined, marketDayId: undefined, marketId: undefined, pickupHour: null })
      return
    }
    if (mode === 'today' && todayIsMarket && !todayFull) {
      setDatePickerOpen(false)
      setViennaPickerOpen(false)
      onDelivery({
        mode: 'market',
        pickupDate: today?.date,
        marketDayId: today?.id,
        marketId: today?.marketId ?? chosenMarketId,
        pickupHour: null,
      })
      return
    }
    setViennaPickerOpen(false)
    setDatePickerOpen(true)
    if (item.delivery.mode !== 'market') onDelivery({ ...item.delivery, mode: 'market', pickupDate: undefined, marketDayId: undefined, marketId: today?.marketId, pickupHour: null })
  }

  const slot = slotLabel(item)
  const pickupOptions = [
    ...(todayIsMarket ? [{ value: 'today' as const, label: todayFull ? 'Today · full' : 'Today', disabled: Boolean(todayFull) }] : []),
    { value: 'another_day' as const, label: 'Market day' },
    { value: 'vienna' as const, label: 'Delivery' },
  ]
  const showSelectedMarketDay = Boolean(
    !viennaPickerOpen &&
    item.delivery.mode === 'market' &&
    pickupDay &&
    (pickupWhen === 'another_day' || item.kind === 'finished'),
  )

  return (
    <article className={styles.card}>
      <h3>{title}</h3>

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

      {todayFull && item.delivery.mode !== 'vienna' ? (
        <p className={styles.hint} role="status">
          {todayFull.open ? `Today is full (${todayFull.booked}/${todayFull.maxPaintings} paintings booked).` : 'Painting is closed today.'} Automatic planning cannot add one: choose another market day, or place it on the board by hand.
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
            <strong>{formatDateLabel(pickupDay.date)}</strong>
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
              value={item.delivery.pickupDate ?? null}
              onChange={(date) => {
                const md = daysOfMarket.find((d) => d.date === date) ?? marketDays.find((d) => d.date === date)
                onDelivery({
                  ...item.delivery,
                  mode: 'market',
                  pickupDate: date,
                  marketDayId: md?.id,
                  marketId: md?.marketId ?? chosenMarketId,
                  pickupHour: null,
                })
                setDatePickerOpen(false)
              }}
              compact
              choices={dayChoices.map((d) => ({
                value: d.date,
                title: formatDateLabel(d.date),
                body: [mixedMarkets ? markets.find((m) => m.id === d.marketId)?.name : null, capacityLabel(d.date)].filter(Boolean).join(' · '),
              }))}
            />
          ) : (
            <p className={styles.emptyDates}>No future market pickup days available.</p>
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
              const tooEarly = paintItems.some((row) => row.slotLocked && row.paintDate === pickupDay.date && row.paintEnd != null && hour < row.paintEnd)
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
          {item.delivery.mode === 'vienna' && !item.delivery.pickupDate ? (
            <p className={styles.planPrompt}>Choose the delivery day to calculate a safe painting time.</p>
          ) : item.delivery.mode === 'market' && item.delivery.pickupHour == null ? (
            <p className={styles.planPrompt}>Choose the pickup hour to calculate a safe painting time.</p>
          ) : paintItems.length > 1 ? (
            <>
              <ul className={styles.sessionList}>
                {paintItems.map((row) => {
                  const rowSlot = slotLabel(row)
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
              {item.plannedMove ? <small>Saved together with the order.</small> : null}
              <button type="button" className={styles.textBtn} onClick={() => onChangeSlot(item)}>{item.plannedMove ? 'Undo change' : 'Change'}</button>
            </div>
          ) : slot ? (
            <div className={styles.planSelected}>
              <strong><StaffText>{slot}</StaffText></strong>
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
async function previewPickupHours(date: string, hours: number[], items: DraftItem[], busy: PaintSlot[], currentDate: string): Promise<HourPreview> {
  const cache = new Map<string, Promise<CapacityResult>>()
  const check = (input: Parameters<typeof api.agenda.checkCapacity>[0]) => {
    const key = JSON.stringify(input)
    let result = cache.get(key)
    if (!result) { result = api.agenda.checkCapacity(input); cache.set(key, result) }
    return result
  }
  const dates = paintDatesToTry(date, currentDate)
  const out: HourPreview = {}
  await Promise.all(hours.map(async (hour) => {
    const planned = [...busy]
    const slots: PaintSlot[] = []
    for (const item of items) {
      const candidates = await Promise.all(dates.map((day) => check({
        date: day,
        durationHours: minutesToHours(item.durationMinutes),
        beforeHour: day === date ? hour : undefined,
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

function usePickupHourPreview(date: string | null, hours: number[], items: DraftItem[], busy: PaintSlot[], currentDate: string, refreshKey: string): HourPreview | null {
  const key = date
    ? [refreshKey, date, currentDate, hours.join(','), items.map((row) => `${row.id}:${row.durationMinutes}`).join(','), busy.map((slot) => `${slot.date}@${slot.startHour}-${slot.endHour}`).join(',')].join('|')
    : ''
  const [state, setState] = useState<{ key: string; value: HourPreview } | null>(null)
  useEffect(() => {
    if (!date) return
    let cancelled = false
    // On a failed check nothing is disabled; the normal planner still reports the problem.
    previewPickupHours(date, hours, items, busy, currentDate)
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
