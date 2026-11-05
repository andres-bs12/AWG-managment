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
import { QrCode } from '../../components/staff/QrCode'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { ChoiceList } from '../../components/ui/ChoiceList'
import { Field } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { AgendaDay, CapacityResult, Market, MarketDay, MoveSuggestion, OrnamentColor, PaymentMethod, PaymentState, InventoryItem, PaintingDay } from '../../domain/types'
import { isMarketPickupWeekday, isViennaWeekday, paintDatesToTry } from '../../lib/calendar'
import { formatDateLabel, formatHour, formatMinutes, hoursOverlap, minutesToHours, pickupHourOptions } from '../../lib/time'
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
  const saleKey = useRef(draft.idempotencyKey ?? crypto.randomUUID())
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null)
  const [payState, setPayState] = useState<PaymentState>('paid')
  const [depositAmount, setDepositAmount] = useState('')
  const [paidNote, setPaidNote] = useState('')
  const [finishedHandoff, setFinishedHandoff] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [planRetry, setPlanRetry] = useState(0)

  // One-shot commands are consumed before reload or a remembered back link can replay them.
  const paramKey = params.toString()
  const consumedParams = useRef<string | null>(null)
  useEffect(() => {
    if (consumedParams.current === paramKey) return
    const next = buildDraftFromParams(params)
    saleKey.current = next.idempotencyKey ?? crypto.randomUUID()
    next.idempotencyKey = saleKey.current
    setDraft(next)
    if (params.has('fresh') || params.has('start') || params.has('placeItem')) {
      setPayMethod(null); setPayState('paid'); setDepositAmount(''); setPaidNote(''); setCopied(false); setError('')
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
        const from = [...d].sort((a, b) => a.date.localeCompare(b.date))[0].date
        // The endpoint caps ranges at 62 days; staff season spans this window.
        const to = d.map(day => day.date).sort().at(-1)!
        const rules = await api.paintingDays.list(from, to)
        if (active) setPaintingDays(rules)
      }
    }).catch(err => { if (active) setConfigError(err instanceof Error ? err.message : 'Could not load sale configuration.') })
    return () => { active = false }
  }, [version, configRetry])

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
    if (!draft.items.length && !draft.order) saleKey.current = crypto.randomUUID()
    setDraft((current) => {
      const next = kind === 'custom' ? makeCustom({ delivery: { mode: 'market', pickupDate: todayPaintingFull(paintingDays, today) ? undefined : today?.date } }) : makeFinished()
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
    const available = inventory.filter(row => row.kind === 'custom' && row.color === color && row.quantity > 0)
    const finish = available.some(row => row.finish === item.finish) ? item.finish : available[0]?.finish ?? item.finish
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
    saleKey.current = crypto.randomUUID()
    setPayMethod(null)
    setPayState('paid')
    setPaidNote('')
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
      } else {
        setPaidNote('Not paid yet')
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
      setPhase('done')
    } catch (err) {
      setError(saleErrorMessage(err, 'Could not record payment'))
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  const title: Record<SalePhase, string> = {
    items: 'What are we selling?',
    delivery: onlyFinished ? 'Hand over and pay' : 'Pickup and paint',
    qr: 'Customer form',
    payment: 'Payment',
    done: 'Sale recorded',
  }

  // Plain step names: "1 Item" read like a quantity.
  const stepLabels = !draft.items.length
    ? ['Items']
    : onlyFinished
      ? ['Items', 'Hand over & pay']
      : ['Items', 'Pickup', 'QR & payment']

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
          <h1>New sale</h1>
          <p className={styles.steps}>
            {stepLabels.map((label, index) => (
              <span key={label} data-on={stepOn(index) ? 'true' : 'false'} aria-current={stepOn(index) && phase !== 'done' ? 'step' : undefined}>
                {label}
              </span>
            ))}
          </p>
        </div>
        {phase !== 'done' ? (
          <Button tone="staff" variant="ghost" onClick={() => { if (order) setLeaveOpen(true); else startOver() }}>
            {order ? 'New sale' : 'Start over'}
          </Button>
        ) : null}
      </div>

      {leaveOpen && order && <StaffDialog title="Leave this sale?" onClose={() => setLeaveOpen(false)}>
        <p>{order.code} stays saved and unpaid, with its paint time reserved. Open it later from Search to show the QR or take payment.</p>
        <Button tone="staff" variant="secondary" onClick={() => setLeaveOpen(false)}>Keep working</Button>
        <Button tone="staff" variant="secondary" onClick={() => { clearStoredDraft(); navigate(`/staff/orders/${order.id}`, { state: { from: '/staff/sales/new' } }) }}>Open order</Button>
        <Button tone="staff" onClick={() => { setLeaveOpen(false); startOver() }}>Start new sale</Button>
      </StaffDialog>}
      {finishedHandoff && <StaffDialog title="Balance due" busy={busy} onClose={() => setFinishedHandoff(false)}>
        <p>Collect the remaining balance before handing over the whole order. {prices ? formatEur((order?.total ?? draft.items.reduce((sum, item) => sum + itemCost(item.kind, item.withName, prices), 0)) - (payState === 'deposit' ? depositValue(depositAmount, order?.total ?? draft.items.reduce((sum, item) => sum + itemCost(item.kind, item.withName, prices), 0)) : 0), 'en') : ''} is still due.</p>
        <SegmentedControl legend="Collection method" name="finished-handover-method" value={payMethod} onChange={setPayMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />
        <Button tone="staff" disabled={busy || !payMethod} onClick={() => void finishFinishedSale('paid')}>Mark paid &amp; hand over</Button>
        <Button tone="staff" variant="secondary" disabled={busy} onClick={() => void finishFinishedSale(payState, false)}>Save without handover</Button>
        <Button tone="staff" variant="ghost" disabled={busy} onClick={() => void finishFinishedSale(payState)}>Hand over with balance due</Button>
        <Button tone="staff" variant="ghost" disabled={busy} onClick={() => setFinishedHandoff(false)}>Not yet</Button>
        {error && <p role="alert">{error}</p>}
      </StaffDialog>}
      <div className={styles.workspace}>
        <div className={styles.main}>
          <h2>{title[phase]}</h2>
          {configError ? <div role="alert"><p>{configError}</p><Button tone="staff" variant="secondary" onClick={() => setConfigRetry(n => n + 1)}>Retry configuration</Button></div> : null}
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
              onAdd={addItem}
              onRemove={removeItem}
              onToggleName={toggleName}
              onColor={setColor}
              onFinish={(item, finish) => patchItem(item.id, { finish })}
              onDuration={setDuration}
              onContinue={() => {
                if (!draft.items.length) return
                if (!prices || configError) { setError('Load server prices and stock first.'); return }
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
                <div className={styles.card}>
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

          {phase === 'qr' && order ? (
            <div className={styles.qrStep}>
              <div className={styles.qr}>
                <QrCode value={formUrl} />
              </div>
              <div className={styles.qrSide}>
                <p className={styles.lead}>The customer scans the code and adds photos, names and contact on their phone. You can take payment meanwhile.</p>
                <StaffActions className={styles.actions} total={order?.total ?? (prices ? draftTotal(draft.items, prices) : null)}>
                  <Button tone="staff" size="lg" onClick={() => setPhase('payment')}>
                    Continue to payment
                  </Button>
                  <CustomerHandoff token={order.formToken} label="Fill on this device instead" />
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => {
                      void navigator.clipboard.writeText(formUrl).then(() => setCopied(true)).catch(() => setError('Could not copy the link. Please select and copy it.'))
                    }}
                  >
                    {copied ? 'Link copied' : 'Copy link to send'}
                  </button>
                </StaffActions>
              </div>
            </div>
          ) : null}

          {phase === 'payment' && order ? (
            <div>
              <SalePaymentFields state={payState} onState={setPayState} method={payMethod} onMethod={setPayMethod} deposit={depositAmount} onDeposit={setDepositAmount} total={order.total} />
              {payState !== 'unpaid' && !payMethod ? <p>Choose cash or card to record a payment.</p> : null}
              <StaffActions className={styles.actions} total={order?.total ?? (prices ? draftTotal(draft.items, prices) : null)}>
                <Button tone="staff" size="lg" disabled={busy || (payState !== 'unpaid' && !payMethod) || (payState === 'deposit' && !validDeposit(depositAmount, order.total))} onClick={() => void recordPayment(payState)}>
                  {busy ? 'Saving…' : payState === 'unpaid' ? 'Leave unpaid' : payState === 'deposit' ? `Mark deposit · ${formatEur(depositValue(depositAmount, order.total), 'en')}` : `Mark paid · ${formatEur(order.total, 'en')}`}
                </Button>
                {order.formToken ? <Button tone="staff" variant="secondary" disabled={busy} onClick={() => setPhase('qr')}>Show QR again</Button> : null}
              </StaffActions>
            </div>
          ) : null}

          {phase === 'done' && order ? (
            <div>
              <div className={styles.doneCard} role="status">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{order.code} · {formatEur(order.total, 'en')}</strong>
                  {paidNote ? <p>{paidNote}</p> : null}
                </div>
              </div>
              <StaffActions className={styles.actions} total={!paidNote || payState !== 'deposit' ? order.total : order.total - depositValue(depositAmount, order.total)} totalLabel={!paidNote ? 'Total' : payState === 'paid' ? 'Total · paid' : 'Balance due'}>
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
        <OrderSummaryPanel prices={prices} items={draft.items} markets={markets} days={days} orderCode={order?.code} />
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
  items: DraftItem[]
  onAdd: (kind: 'custom' | 'finished') => void
  onRemove: (id: string) => void
  onToggleName: (item: DraftItem) => void
  onColor: (item: DraftItem, color: OrnamentColor) => void
  onFinish: (item: DraftItem, finish: import('../../domain/types').CustomFinish) => void
  onDuration: (item: DraftItem, preset: DurationPreset, customMinutes?: number) => void
  onContinue: () => void
}) {
  return (
    <>
      {items.length === 0 ? (
        <StaffActions className={styles.actions} total={prices ? draftTotal(items, prices) : null}>
          <Button tone="staff" variant="secondary" size="lg" fullWidth onClick={() => onAdd('custom')}>
            + Add custom ornament
          </Button>
          <Button tone="staff" variant="secondary" size="lg" fullWidth onClick={() => onAdd('finished')}>
            + Add finished product
          </Button>
          <p className={styles.hint}>Finished stock: {stockLabel(inventory.find(row => row.kind === 'finished')?.quantity ?? 0)}</p>
        </StaffActions>
      ) : (
        <>
          {items.map((item, index) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHead}>
                <h3>
                  {itemLabel(item, index)} · {prices ? formatEur(itemCost(item.kind, item.withName, prices), 'en') : 'Price unavailable'}
                </h3>
                <Button tone="staff" variant="ghost" onClick={() => onRemove(item.id)}>
                  Remove
                </Button>
              </div>
              {item.slotLocked && slotLabel(item) ? (
                <p className={styles.lead}>Paint {slotLabel(item)} (from the board)</p>
              ) : null}
              {item.kind === 'custom' ? (
                <>
                  <label className={styles.check}>
                    <input type="checkbox" aria-describedby={`name-hint-${item.id}`} checked={item.withName} onChange={() => onToggleName(item)} />
                    {`Name on ornament · +${prices ? formatEur(prices.nameExtra, 'en') : 'price unavailable'}`}
                  </label>
                  <p className={styles.hint} id={`name-hint-${item.id}`}>The customer types the name in the form.</p>
                  <SegmentedControl
                    legend="Colour"
                    name={`colour-${item.id}`}
                    value={item.color}
                    onChange={(color) => onColor(item, color)}
                    options={(['red', 'green', 'beige'] as const).map(color => { const quantity = inventory.filter(row => row.kind === 'custom' && row.color === color).reduce((sum, row) => sum + row.quantity, 0); return { value: color, color, label: color[0].toUpperCase() + color.slice(1), hint: stockLabel(quantity), disabled: quantity === 0 } })}
                  />
                  <SegmentedControl legend="Finish" help={<HelpTip label="Explain finishes">Shiny reflects light. Matte has no glossy reflection. Stock refers to unpainted bases.</HelpTip>} name={`finish-${item.id}`} value={item.finish ?? 'shiny'} onChange={finish => onFinish(item, finish)} options={(['shiny', 'matte'] as const).map(finish => { const quantity = inventory.find(row => row.kind === 'custom' && row.color === item.color && row.finish === finish)?.quantity ?? 0; return { value: finish, label: finish === 'shiny' ? 'Shiny' : 'Matte', hint: stockLabel(quantity), disabled: quantity === 0 } })} />
                  <SegmentedControl
                    legend="Paint time"
                    name={`duration-${item.id}`}
                    value={item.durationPreset}
                    onChange={(preset) => onDuration(item, preset)}
                    options={DURATION_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  />
                  {item.durationPreset === 'custom' ? <CustomMinutesField item={item} onDuration={onDuration} /> : null}
                </>
              ) : null}
            </article>
          ))}
          <div className={styles.addRow}>
            <Button tone="staff" variant="secondary" onClick={() => onAdd('custom')}>
              + Add custom
            </Button>
            <Button tone="staff" variant="secondary" onClick={() => onAdd('finished')}>
              + Add finished
            </Button>
            <span className={styles.hint}>Finished stock: {stockLabel(inventory.find(row => row.kind === 'finished')?.quantity ?? 0)}</span>
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
      return
    }
    if (mode === 'today' && todayIsMarket) {
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
  }

  const slot = slotLabel(item)
  const pickupOptions = [
    ...(todayIsMarket ? [{ value: 'today' as const, label: todayFull ? 'Today · full' : 'Today' }] : []),
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
          legend="Pickup"
          name={`when-${item.id}`}
          value={viennaPickerOpen ? 'vienna' : datePickerOpen ? 'another_day' : pickupWhen === 'now' ? 'today' : pickupWhen}
          onChange={(value) => setMode(value)}
          options={pickupOptions}
        />
      )}

      {todayFull ? (
        <p className={styles.hint} role="status">
          {todayFull.open ? `Today is full (${todayFull.booked}/${todayFull.maxPaintings} paintings booked).` : 'Painting is closed today.'} Choose another market day for this ornament.
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
          <span className={styles.calendarIcon} aria-hidden="true">▦</span>
          <span>
            <strong>{formatDateLabel(pickupDay.date)}</strong>
            <small>{capacityLabel(pickupDay.date)}</small>
          </span>
          <span className={styles.dateChevron} aria-hidden="true">{datePickerOpen ? '▲' : '▼'}</span>
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
              ×
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

      {!datePickerOpen && item.delivery.mode === 'vienna' && viennaDay ? (
        <button
          type="button"
          className={styles.selectedDate}
          aria-expanded={viennaPickerOpen}
          aria-controls={`delivery-day-calendar-${item.id}`}
          onClick={() => setViennaPickerOpen((open) => !open)}
        >
          <span className={styles.calendarIcon} aria-hidden="true">▦</span>
          <span>
            <strong>{formatDateLabel(viennaDay.date)}</strong>
            <small>Vienna delivery · no exact time</small>
          </span>
          <span className={styles.dateChevron} aria-hidden="true">{viennaPickerOpen ? '▲' : '▼'}</span>
        </button>
      ) : null}

      {viennaPickerOpen ? (
        <div className={styles.datePicker} id={`delivery-day-calendar-${item.id}`}>
          <div className={styles.datePickerHead}>
            <div>
              <strong>Choose delivery day</strong>
              <small>Vienna delivery · Wednesday or Friday · no exact time.</small>
            </div>
            <button type="button" className={styles.closePicker} onClick={() => setViennaPickerOpen(false)} aria-label="Close delivery day picker">
              ×
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
                body: `No exact time · ${capacityLabel(d.date)}`,
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
          <div className={styles.hours}>
            {hours.map((hour) => {
              const tooEarly = paintItems.some((row) => row.slotLocked && row.paintDate === pickupDay.date && row.paintEnd != null && hour < row.paintEnd)
              return (
                <Button
                  key={hour}
                  tone="staff"
                  variant="secondary"
                  disabled={tooEarly}
                  title={tooEarly ? 'Painting will not be finished yet' : undefined}
                  selected={item.delivery.pickupHour === hour}
                  onClick={() => onDelivery({ ...item.delivery, pickupHour: hour })}
                >
                  {formatHour(hour)}
                </Button>
              )
            })}
          </div>
        </div>
      ) : null}

      {showPaint && !datePickerOpen && !viennaPickerOpen ? (
        <div className={styles.slotBox}>
          <h4 className={styles.planTitle}>Painting plan</h4>
          {item.delivery.mode === 'market' && item.delivery.pickupHour == null ? (
            <p className={styles.planPrompt}>Choose the pickup hour to calculate a safe painting time.</p>
          ) : paintItems.length > 1 ? (
            <>
              <p className={styles.planPrompt}>One session per ornament, any free time before pickup.</p>
              <ul className={styles.sessionList}>
                {paintItems.map((row) => {
                  const rowSlot = slotLabel(row)
                  const failed = !rowSlot && suggestions[row.id] && !suggestions[row.id].ok
                  return (
                    <li key={row.id} data-state={rowSlot ? 'ok' : failed ? 'missing' : 'pending'}>
                      <div>
                        <strong>{itemLabel(row, allItems.findIndex((entry) => entry.id === row.id))} · {formatMinutes(row.durationMinutes)}</strong>
                        <p>
                          {rowSlot
                            ? <><span aria-hidden="true">✓ </span>{rowSlot}{row.slotLocked ? ' · chosen on agenda' : ''}</>
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
              <strong><span aria-hidden="true">✓ </span>{item.plannedMove ? 'Change added to this sale' : 'Paint time selected'}</strong>
              {item.plannedMove ? <p>{item.plannedMove.orderCode} → {formatDateLabel(item.plannedMove.to.date)} · {formatHour(item.plannedMove.to.startHour)}–{formatHour(item.plannedMove.to.endHour)}</p> : null}
              <p>This ornament · {slot}</p>
              {item.plannedMove ? <small>Saved together with the order.</small> : null}
              <button type="button" className={styles.textBtn} onClick={() => onChangeSlot(item)}>{item.plannedMove ? 'Undo change' : 'Choose another time'}</button>
            </div>
          ) : slot ? (
            <div className={styles.planSelected}>
              <strong><span aria-hidden="true">✓ </span>Time available</strong>
              <p>{slot}</p>
              <button type="button" className={styles.textBtn} onClick={() => onPlace(item)}>Choose on agenda</button>
            </div>
          ) : (
            moveSuggestion ? (
              <div className={styles.moveSuggestion}>
                <strong>No free time — one change makes room</strong>
                <ol className={styles.moveSteps}>
                  <li><span aria-hidden="true">↪</span><div><strong>Move {moveSuggestion.title} · {moveSuggestion.orderCode}</strong><p>{formatDateLabel(moveSuggestion.from.date)} · {formatHour(moveSuggestion.from.startHour)}–{formatHour(moveSuggestion.from.endHour)}</p><p>→ {formatDateLabel(moveSuggestion.to.date)} · {formatHour(moveSuggestion.to.startHour)}–{formatHour(moveSuggestion.to.endHour)}</p><small>Customer pickup stays the same.</small></div></li>
                  <li><span aria-hidden="true">＋</span><div><strong>Paint this ornament in the freed time</strong><p>{formatDateLabel(moveSuggestion.freedSlot.date)} · {formatHour(moveSuggestion.freedSlot.startHour)}–{formatHour(moveSuggestion.freedSlot.endHour)}</p></div></li>
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

function stockLabel(quantity: number) { return quantity === 0 ? 'Sold out' : quantity === 1 ? 'Last one' : `${quantity} left` }
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
