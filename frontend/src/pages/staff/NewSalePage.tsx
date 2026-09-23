import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { QrCode } from '../../components/staff/QrCode'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { ChoiceList } from '../../components/ui/ChoiceList'
import { Field } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { AgendaDay, CapacityResult, Market, MarketDay, MoveSuggestion, OrnamentColor, PaymentMethod, PaymentState } from '../../domain/types'
import { isMarketPickupWeekday, isViennaWeekday, paintDatesToTry } from '../../lib/calendar'
import { formatDateLabel, formatHour, formatMinutes, hoursOverlap, minutesToHours, pickupHourOptions } from '../../lib/time'
import { formatEur, itemCost, NAME_EXTRA } from '../../lib/money'
import { OrderSummaryPanel } from './OrderSummaryPanel'
import {
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

function fillDayRefs(item: DraftItem, days: MarketDay[]): DraftItem {
  if (item.delivery.mode === 'vienna') {
    const date = item.delivery.pickupDate
    const md =
      days.find((d) => d.id === item.delivery.marketDayId) ??
      days.find((d) => d.date === date) ??
      days.find((d) => isViennaWeekday(d.date) && (!date || d.date >= date)) ??
      days.find((d) => isViennaWeekday(d.date))
    if (!md || !isViennaWeekday(md.date)) return item
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
  const pickupDays = days.filter((d) => isMarketPickupWeekday(d.date))
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
  const [params] = useSearchParams()
  const [draft, setDraft] = useState<SaleDraft>(() => buildDraftFromParams(params))
  const [markets, setMarkets] = useState<Market[]>([])
  const [days, setDays] = useState<MarketDay[]>([])
  const [agendaDays, setAgendaDays] = useState<AgendaDay[]>([])
  const [suggestions, setSuggestions] = useState<Record<string, CapacityResult>>({})
  const [moveSuggestions, setMoveSuggestions] = useState<Record<string, MoveSuggestion | null>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null)
  const [payState, setPayState] = useState<PaymentState>('paid')
  const [payAmount, setPayAmount] = useState('')
  const [paidNote, setPaidNote] = useState('')
  const paramKey = `${params.get('date')}|${params.get('start')}|${params.get('end')}|${params.get('placeItem')}|${params.get('fresh')}`

  useEffect(() => {
    setDraft(buildDraftFromParams(params))
  }, [paramKey])

  useEffect(() => {
    void Promise.all([api.markets.listMarkets(), api.markets.listMarketDays(), api.agenda.listDays()]).then(([m, d, agenda]) => {
      setMarkets(m)
      setDays(d)
      setAgendaDays(agenda)
    })
  }, [])

  useEffect(() => {
    if (!days.length) return
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => fillDayRefs(item, days)),
    }))
  }, [days])

  useEffect(() => {
    if (draft.phase === 'done' || (!draft.items.length && !draft.placingItemId)) {
      if (draft.phase === 'done') clearStoredDraft()
      return
    }
    writeStoredDraft(draft)
  }, [draft])

  const today = days.find((d) => d.isToday)
  const marketDays = days.filter(
    (d) => markets.find((m) => m.id === d.marketId)?.kind === 'market' && isMarketPickupWeekday(d.date),
  )
  const onlyFinished = draft.items.length > 0 && draft.items.every((item) => item.kind === 'finished')
  const hasCustom = draft.items.some((item) => item.kind === 'custom')
  const mixed = hasCustom && draft.items.some((item) => item.kind === 'finished')
  const phase = draft.phase
  const order = draft.order
  const formUrl = order ? `${window.location.origin}/form/${order.formToken}` : ''

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
      for (const item of draft.items) {
        if (item.kind === 'custom' && item.paintDate && item.paintStart != null && item.paintEnd != null) {
          planned.set(item.id, { date: item.paintDate, startHour: item.paintStart, endHour: item.paintEnd })
        }
      }
      const busyOn = (date: string, itemId: string) =>
        [...planned.entries()]
          .filter(([id, slot]) => id !== itemId && slot.date === date)
          .map(([, slot]) => ({ startHour: slot.startHour, endHour: slot.endHour }))
      const handoffKey = (item: DraftItem) => `${item.delivery.pickupDate ?? today?.date ?? ''}|${String(item.delivery.pickupHour ?? 99).padStart(5, '0')}`
      const customCount = draft.items.filter((item) => item.kind === 'custom').length
      const toPlan = draft.items
        .filter((item) => item.kind === 'custom' && !item.slotLocked && item.paintStart == null)
        .sort((a, b) => handoffKey(a).localeCompare(handoffKey(b)))
      for (const item of toPlan) {
        const handoff = item.delivery.pickupDate || today?.date
        if (!handoff) continue
        if (item.delivery.mode === 'market' && item.delivery.pickupHour == null) continue
        const dates = paintDatesToTry(handoff, today?.date).filter((date) => item.delivery.mode !== 'vienna' || date < handoff)
        let result: CapacityResult = {
          ok: false,
          slot: null,
          remainingHours: 0,
          message: 'No free paint slot before this handoff.',
        }
        for (const date of dates) {
          result = await api.agenda.checkCapacity({
            date,
            durationHours: minutesToHours(item.durationMinutes),
            beforeHour: date === handoff && item.delivery.mode === 'market' ? item.delivery.pickupHour ?? undefined : undefined,
            extraBusy: busyOn(date, item.id),
          })
          if (cancelled) return
          if (result.ok && result.slot) break
        }
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
          for (const date of customCount === 1 ? dates : []) {
            move = await api.agenda.findMoveSuggestion({
              date,
              durationHours: minutesToHours(item.durationMinutes),
              handoffDate: handoff,
              beforeHour: date === handoff && item.delivery.mode === 'market' ? item.delivery.pickupHour ?? undefined : undefined,
            })
            if (cancelled || move) break
          }
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
    void loadSuggestions()
    return () => {
      cancelled = true
    }
  }, [phase, suggestKey, today?.date, hasCustom])

  useEffect(() => {
    if (phase !== 'delivery' || !hasCustom) return
    const locked = draft.items.filter(
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
    })
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
    setDraft((current) => {
      const next = kind === 'custom' ? makeCustom({ delivery: { mode: 'market', pickupDate: today?.date } }) : makeFinished()
      const items = [...current.items.map((item) => item.plannedMove ? { ...item, plannedMove: undefined, slotLocked: false, paintDate: undefined, paintStart: undefined, paintEnd: undefined } : item), fillDayRefs(next, days)]
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
    patchItem(item.id, { withName })
  }

  function setColor(item: DraftItem, color: OrnamentColor) {
    patchItem(item.id, { color })
  }

  function placeOnBoard(item: DraftItem) {
    writeStoredDraft({ ...draft, placingItemId: item.id, phase: 'delivery' })
    const handoff = item.delivery.pickupDate
    const date = item.paintDate || (handoff ? paintDatesToTry(handoff, today?.date)[0] : today?.date)
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
    setPayMethod(null)
    setPayState('paid')
    setPaidNote('')
    setCopied(false)
    setError('')
    setDraft({ items: [], differentPickups: false, phase: 'items' })
    navigate('/staff/sales/new', { replace: true })
  }

  async function createOrder(): Promise<NonNullable<SaleDraft['order']>> {
    const created = await api.orders.createSale({
      items: toCreateItems(draft.items, days, today),
      plannedMove: draft.items.find((item) => item.plannedMove)?.plannedMove,
    })
    const ref = { id: created.id, code: created.code, formToken: created.formToken, total: created.total }
    setDraft((current) => ({ ...current, order: ref }))
    setPayAmount(String(ref.total))
    return ref
  }

  async function finishFinishedSale(state: PaymentState) {
    if (!payMethod && state !== 'unpaid') {
      setError('Choose cash or card.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await createOrder()
      if (state !== 'unpaid') {
        const amount = state === 'deposit' ? Math.round((created.total / 2) * 100) / 100 : created.total
        if (!payMethod) throw new Error('Choose cash or card.')
        await api.payments.recordPayment(created.id, amount, payMethod)
        setPaidNote(`${formatEur(amount)} received · ${payMethod === 'cash' ? 'cash' : 'card'}`)
      } else {
        setPaidNote('Not paid yet')
      }
      setDraft((current) => ({ ...current, order: created, phase: 'done' }))
    } catch (err) {
      setError(saleErrorMessage(err, 'Could not record sale'))
    } finally {
      setBusy(false)
    }
  }

  async function continueFromDelivery() {
    if (onlyFinished) {
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
    setBusy(true)
    setError('')
    try {
      const created = await createOrder()
      setDraft((current) => ({ ...current, order: created, phase: 'qr' }))
    } catch (err) {
      setError(saleErrorMessage(err, 'Could not create sale'))
    } finally {
      setBusy(false)
    }
  }

  async function recordPayment(state: PaymentState) {
    if (!order) return
    if (state !== 'unpaid' && !payMethod) {
      setError('Choose cash or card.')
      return
    }
    const amount = Number(payAmount.replace(',', '.'))
    if (state !== 'unpaid' && (!Number.isFinite(amount) || amount <= 0)) {
      setError('Enter the amount received.')
      return
    }
    setBusy(true)
    try {
      if (state !== 'unpaid') await api.payments.recordPayment(order.id, amount, payMethod!)
      setPaidNote(state === 'unpaid' ? 'Not paid yet' : `${formatEur(amount)} received · ${payMethod === 'cash' ? 'cash' : 'card'}`)
      setPhase('done')
    } catch (err) {
      setError(saleErrorMessage(err, 'Could not record payment'))
    } finally {
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

  const stepLabels = !draft.items.length
    ? ['1 Items']
    : onlyFinished
      ? ['1 Items', '2 Pay']
      : ['1 Items', '2 Pickup', '3 QR & payment']

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
              <span key={label} data-on={stepOn(index) ? 'true' : 'false'}>
                {label}
              </span>
            ))}
          </p>
        </div>
        {phase !== 'done' ? (
          <Button tone="staff" variant="ghost" onClick={startOver}>
            Start over
          </Button>
        ) : null}
      </div>

      <div className={styles.workspace}>
        <div className={styles.main}>
          <h2>{title[phase]}</h2>
          {error ? (
            <p className={styles.err} role="alert">
              {error}
            </p>
          ) : null}

          {phase === 'items' ? (
            <ItemsStep
              items={draft.items}
              onAdd={addItem}
              onRemove={removeItem}
              onToggleName={toggleName}
              onColor={setColor}
              onDuration={setDuration}
              onContinue={() => {
                if (!draft.items.length) return
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
                    agendaDays={agendaDays}
                    today={today}
                    suggestions={suggestions}
                    moveSuggestion={moveSuggestions[item.id]}
                    slotTaken={Boolean(error && /hour is taken|overlap/i.test(error))}
                    onDelivery={(delivery) => patchDelivery(item.id, delivery)}
                    onPlace={placeOnBoard}
                    onChangeSlot={changeSlot}
                    onApplyMove={(suggestion) => void applyMoveSuggestion(item, suggestion)}
                  />
                )
              })}

              {onlyFinished ? (
                <div className={styles.card}>
                  <p className={styles.lead}>Hand over at the stall now. No calendar and no customer form.</p>
                  <SegmentedControl
                    legend="Payment method"
                    name="finished-pay"
                    value={payMethod}
                    onChange={setPayMethod}
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'card', label: 'Card' },
                    ]}
                  />
                  <label className={styles.amountField}>
                    Amount received
                    <input inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
                  </label>
                  <SegmentedControl
                    legend="Payment state"
                    name="finished-state"
                    value={payState}
                    onChange={setPayState}
                    options={[
                      { value: 'paid', label: 'Paid' },
                      { value: 'deposit', label: 'Deposit' },
                      { value: 'unpaid', label: 'Unpaid' },
                    ]}
                  />
                </div>
              ) : null}

              <div className={styles.actions}>
                <Button
                  tone="staff"
                  size="lg"
                  disabled={busy || !draft.items.length || draft.items.some((item) => item.kind === 'custom' && item.paintStart == null)}
                  onClick={() => void continueFromDelivery()}
                >
                  {busy ? 'Saving…' : onlyFinished ? 'Done' : draft.items.some((item) => item.plannedMove) ? 'Save change & create order' : 'Create order & show QR'}
                </Button>
                <Button tone="staff" variant="ghost" onClick={() => setPhase('items')}>
                  Back to items
                </Button>
              </div>
            </>
          ) : null}

          {phase === 'qr' && order ? (
            <div className={styles.qrStep}>
              <div className={styles.qr}>
                <QrCode value={formUrl} />
              </div>
              <div className={styles.qrSide}>
                <p className={styles.lead}>The customer scans the code and adds photos, names and contact on their phone. You can take payment meanwhile.</p>
                <div className={styles.actions}>
                  <Button tone="staff" size="lg" onClick={() => setPhase('payment')}>
                    Continue to payment
                  </Button>
                  <Button
                    tone="staff"
                    variant="secondary"
                    onClick={() => {
                      writeStoredDraft({ ...draft, phase: 'payment' })
                      navigate(`/form/${order.formToken}`)
                    }}
                  >
                    Fill on this iPad instead
                  </Button>
                  <button
                    type="button"
                    className={styles.textBtn}
                    onClick={() => {
                      void navigator.clipboard.writeText(formUrl).then(() => setCopied(true)).catch(() => setError('Could not copy the link. Please select and copy it.'))
                    }}
                  >
                    {copied ? 'Link copied' : 'Copy link to send'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {phase === 'payment' && order ? (
            <div>
              <label className={styles.amountField}>
                Amount received
                <input inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
              </label>
              <button type="button" className={styles.textBtn} onClick={() => setPayAmount(String(order.total))}>
                Use full remaining balance ({formatEur(order.total)})
              </button>
              <SegmentedControl
                legend="Method"
                name="pay-method"
                value={payMethod}
                onChange={setPayMethod}
                options={[
                  { value: 'cash', label: 'Register cash' },
                  { value: 'card', label: 'Card' },
                ]}
              />
              <div className={styles.actions}>
                <Button tone="staff" size="lg" disabled={busy || !payMethod} onClick={() => void recordPayment('paid')}>
                  Record payment
                </Button>
                <Button tone="staff" variant="ghost" disabled={busy} onClick={() => void recordPayment('unpaid')}>
                  Leave unpaid
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'done' && order ? (
            <div>
              <div className={styles.doneCard} role="status">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{order.code} · {formatEur(order.total)}</strong>
                  {paidNote ? <p>{paidNote}</p> : null}
                </div>
              </div>
              <div className={styles.actions}>
                <Button tone="staff" size="lg" onClick={startOver}>
                  New sale
                </Button>
                <ButtonLink to={`/staff/orders/${order.id}`} state={{ from: '/staff/sales/new' }} tone="staff" variant="secondary">
                  Open order
                </ButtonLink>
              </div>
            </div>
          ) : null}
        </div>
        <OrderSummaryPanel items={draft.items} markets={markets} days={days} orderCode={order?.code} />
      </div>
    </section>
  )
}

function CustomMinutesField({
  item,
  onDuration,
}: {
  item: DraftItem
  onDuration: (item: DraftItem, preset: DurationPreset, customMinutes?: number) => void
}) {
  const [text, setText] = useState(String(item.durationMinutes))

  useEffect(() => {
    setText(String(item.durationMinutes))
  }, [item.id, item.durationMinutes])

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
  onAdd,
  onRemove,
  onToggleName,
  onColor,
  onDuration,
  onContinue,
}: {
  items: DraftItem[]
  onAdd: (kind: 'custom' | 'finished') => void
  onRemove: (id: string) => void
  onToggleName: (item: DraftItem) => void
  onColor: (item: DraftItem, color: OrnamentColor) => void
  onDuration: (item: DraftItem, preset: DurationPreset, customMinutes?: number) => void
  onContinue: () => void
}) {
  return (
    <>
      {items.length === 0 ? (
        <div className={styles.actions}>
          <Button tone="staff" variant="secondary" size="lg" fullWidth onClick={() => onAdd('custom')}>
            + Add custom ornament
          </Button>
          <Button tone="staff" variant="secondary" size="lg" fullWidth onClick={() => onAdd('finished')}>
            + Add finished product
          </Button>
        </div>
      ) : (
        <>
          {items.map((item, index) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHead}>
                <h3>
                  {itemLabel(item, index)} · {formatEur(itemCost(item.kind, item.withName))}
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
                    <input type="checkbox" checked={item.withName} onChange={() => onToggleName(item)} />
                    {`Add name on ornament · ${formatEur(NAME_EXTRA)} (text comes from the customer form)`}
                  </label>
                  <SegmentedControl
                    legend="Colour"
                    name={`colour-${item.id}`}
                    value={item.color}
                    onChange={(color) => onColor(item, color)}
                    options={[{ value: 'red', label: 'Red' }, { value: 'grey', label: 'Grey' }]}
                  />
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
          </div>
          <div className={styles.actions}>
            <Button tone="staff" size="lg" onClick={onContinue}>
              Continue
            </Button>
          </div>
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
  agendaDays,
  today,
  suggestions,
  moveSuggestion,
  slotTaken,
  onDelivery,
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
  agendaDays: AgendaDay[]
  today?: MarketDay
  suggestions: Record<string, CapacityResult>
  moveSuggestion?: MoveSuggestion | null
  slotTaken?: boolean
  onDelivery: (delivery: DraftItem['delivery']) => void
  onPlace: (item: DraftItem) => void
  onChangeSlot: (item: DraftItem) => void
  onApplyMove: (suggestion: MoveSuggestion) => void
}) {
  const showPaint = paintItems.length > 0
  const suggestion = suggestions[item.id]
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [viennaPickerOpen, setViennaPickerOpen] = useState(false)
  const todayIsMarket = Boolean(today && isMarketPickupWeekday(today.date))
  const pickupWhen: 'today' | 'another_day' | 'vienna' | 'now' =
    item.kind === 'finished' && item.delivery.mode === 'now'
      ? 'now'
      : item.delivery.mode === 'vienna'
        ? 'vienna'
        : item.delivery.pickupDate && today && item.delivery.pickupDate !== today.date
          ? 'another_day'
          : todayIsMarket
            ? 'today'
            : 'another_day'

  const pickupDay =
    marketDays.find((d) => d.id === item.delivery.marketDayId) ??
    marketDays.find((d) => d.date === item.delivery.pickupDate) ??
    (pickupWhen === 'today' ? today : undefined)

  const hours = pickupDay
    ? pickupHourOptions(pickupDay.openHour, pickupDay.closeHour)
    : []

  const chosenMarketId = item.delivery.mode === 'market'
    ? item.delivery.marketId ?? today?.marketId
    : today?.marketId
  const daysOfMarket = marketDays.filter((d) => !chosenMarketId || d.marketId === chosenMarketId)
  const futureDays = marketDays.filter((d) => (today ? d.date > today.date : !d.isToday))
  const viennaDays = allDays.filter((d) => isViennaWeekday(d.date) && (!today || d.date >= today.date))
  const viennaDay = viennaDays.find((d) => d.id === item.delivery.marketDayId) ??
    viennaDays.find((d) => d.date === item.delivery.pickupDate)
  const mixedMarkets = new Set(futureDays.map((d) => d.marketId)).size > 1
  const dayChoices = futureDays

  function capacityLabel(date: string): string {
    const agenda = agendaDays.find((row) => row.marketDay.date === date)
    if (!agenda) return 'Checking availability…'
    const used = agenda.slots.reduce((sum, slot) => sum + (slot.block.endHour - slot.block.startHour), 0)
    const free = Math.max(0, agenda.marketDay.closeHour - agenda.marketDay.openHour - used)
    const minutes = Math.round(free * 60)
    if (minutes === 0) return 'Full'
    if (minutes < 60) return `${minutes} min free`
    const remainder = minutes % 60
    return `${Math.floor(minutes / 60)} h${remainder ? ` ${remainder} min` : ''} free`
  }

  function setMode(mode: DeliveryMode | 'today' | 'another_day') {
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
    ...(todayIsMarket ? [{ value: 'today' as const, label: 'Today' }] : []),
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
              <small>Available painting time is shown for each day.</small>
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
