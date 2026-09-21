import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { QrCode } from '../../components/staff/QrCode'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { ChoiceList } from '../../components/ui/ChoiceList'
import { Field } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { CapacityResult, Market, MarketDay, PaymentMethod, PaymentState } from '../../domain/types'
import { formatDateLabel, formatHour, hoursOverlap, minutesToHours, pickupHourOptions, utcWeekday } from '../../lib/time'
import { formatEur, itemCost, NAME_EXTRA } from '../../lib/money'
import { OrderSummaryPanel } from './OrderSummaryPanel'
import {
  buildDraftFromParams,
  clearStoredDraft,
  extraBusyFor,
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

const DURATION_OPTIONS: { value: DurationPreset; label: string; minutes: number }[] = [
  { value: '45', label: '45 min', minutes: 45 },
  { value: '60', label: '1 h', minutes: 60 },
  { value: '75', label: '1 h 15', minutes: 75 },
  { value: 'custom', label: 'Custom', minutes: 0 },
]

function isViennaWeekday(date: string) {
  const weekday = utcWeekday(date)
  return weekday === 3 || weekday === 5
}

function fillDayRefs(item: DraftItem, days: MarketDay[]): DraftItem {
  if (item.delivery.mode === 'vienna') {
    const date = item.delivery.pickupDate
    if (!date) return item
    const md = days.find((d) => d.id === item.delivery.marketDayId) ?? days.find((d) => d.date === date)
    if (!md) return item
    return {
      ...item,
      delivery: {
        ...item.delivery,
        marketDayId: item.delivery.marketDayId ?? md.id,
        marketId: item.delivery.marketId ?? md.marketId,
      },
    }
  }
  const date = item.delivery.pickupDate || item.paintDate
  const md =
    days.find((d) => d.id === item.delivery.marketDayId) ??
    days.find((d) => d.date === date) ??
    days.find((d) => d.isToday)
  if (!md) return item
  return {
    ...item,
    delivery: {
      ...item.delivery,
      marketDayId: item.delivery.marketDayId ?? md.id,
      marketId: item.delivery.marketId ?? md.marketId,
      pickupDate: item.delivery.pickupDate ?? md.date,
    },
  }
}

export function NewSalePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [draft, setDraft] = useState<SaleDraft>(() => buildDraftFromParams(params))
  const [markets, setMarkets] = useState<Market[]>([])
  const [days, setDays] = useState<MarketDay[]>([])
  const [suggestions, setSuggestions] = useState<Record<string, CapacityResult>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null)
  const [payState, setPayState] = useState<PaymentState>('paid')
  const paramKey = `${params.get('date')}|${params.get('start')}|${params.get('end')}|${params.get('placeItem')}|${params.get('fresh')}`

  useEffect(() => {
    setDraft(buildDraftFromParams(params))
  }, [paramKey])

  useEffect(() => {
    void Promise.all([api.markets.listMarkets(), api.markets.listMarketDays()]).then(([m, d]) => {
      setMarkets(m)
      setDays(d)
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
  const marketDays = days.filter((d) => markets.find((m) => m.id === d.marketId)?.kind === 'market')
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
        item.delivery.mode,
      ].join(':'),
    )
    .join('|')

  useEffect(() => {
    if (phase !== 'delivery' || !hasCustom) return
    let cancelled = false
    async function loadSuggestions() {
      const next: Record<string, CapacityResult> = {}
      for (const item of draft.items) {
        if (item.kind !== 'custom' || item.slotLocked) continue
        const date = item.paintDate || item.delivery.pickupDate || today?.date
        if (!date) continue
        const result = await api.agenda.checkCapacity({
          date,
          durationHours: minutesToHours(item.durationMinutes),
          extraBusy: extraBusyFor(draft.items, item.id, date),
        })
        if (cancelled) return
        next[item.id] = result
        if (result.ok && result.slot && item.paintStart == null) {
          const slot = result.slot
          setDraft((current) => ({
            ...current,
            items: current.items.map((row) =>
              row.id === item.id && row.paintStart == null
                ? {
                    ...row,
                    paintDate: slot.date,
                    paintStart: slot.startHour,
                    paintEnd: slot.endHour,
                  }
                : row,
            ),
          }))
        }
      }
      if (!cancelled) setSuggestions((prev) => ({ ...prev, ...next }))
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
        return day.slots.some((slot) => hoursOverlap(item.paintStart!, item.paintEnd!, slot.block.startHour, slot.block.endHour))
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
    setDraft((current) => {
      const different = current.differentPickups || mixed
      return {
        ...current,
        differentPickups: different,
        items: current.items.map((item) => {
          if (item.id === id || !different) return { ...item, delivery: { ...item.delivery, ...delivery } }
          return item
        }),
      }
    })
  }

  function addItem(kind: 'custom' | 'finished') {
    setDraft((current) => {
      const next = kind === 'custom' ? makeCustom({ delivery: { mode: 'market', pickupDate: today?.date } }) : makeFinished()
      const items = [...current.items, fillDayRefs(next, days)]
      const mixedNow = items.some((i) => i.kind === 'custom') && items.some((i) => i.kind === 'finished')
      return { ...current, items, differentPickups: current.differentPickups || mixedNow }
    })
  }

  function removeItem(id: string) {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
  }

  function setDuration(item: DraftItem, preset: DurationPreset, customMinutes?: number) {
    const minutes = preset === 'custom' ? (customMinutes ?? item.durationMinutes) : DURATION_OPTIONS.find((o) => o.value === preset)?.minutes ?? 60
    patchItem(item.id, {
      durationPreset: preset,
      durationMinutes: Math.max(15, minutes),
      paintStart: item.slotLocked ? item.paintStart : undefined,
      paintEnd: item.slotLocked ? item.paintEnd : undefined,
      paintDate: item.slotLocked ? item.paintDate : item.delivery.pickupDate || item.paintDate,
    })
  }

  function toggleName(item: DraftItem) {
    if (item.kind === 'finished') return
    const withName = !item.withName
    if (item.slotLocked) {
      patchItem(item.id, { withName })
      return
    }
    patchItem(item.id, {
      withName,
      durationPreset: withName ? '75' : '60',
      durationMinutes: withName ? 75 : 60,
      paintStart: undefined,
      paintEnd: undefined,
    })
  }

  function placeOnBoard(item: DraftItem) {
    writeStoredDraft({ ...draft, placingItemId: item.id, phase: 'delivery' })
    navigate(`/staff/agenda?place=${item.id}`)
  }

  function changeSlot(item: DraftItem) {
    setError('')
    patchItem(item.id, {
      slotLocked: false,
      fromCalendar: false,
      paintStart: undefined,
      paintEnd: undefined,
    })
  }

  function startOver() {
    clearStoredDraft()
    setPayMethod(null)
    setPayState('paid')
    setError('')
    setDraft({ items: [], differentPickups: false, phase: 'items' })
    navigate('/staff/sales/new', { replace: true })
  }

  async function createOrder(): Promise<NonNullable<SaleDraft['order']>> {
    const created = await api.orders.createSale({
      items: toCreateItems(draft.items, days, today),
    })
    const ref = { id: created.id, code: created.code, formToken: created.formToken, total: created.total }
    setDraft((current) => ({ ...current, order: ref }))
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
      await api.payments.setPaymentState(created.id, state, state === 'unpaid' ? payMethod : payMethod)
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
    setBusy(true)
    try {
      await api.payments.setPaymentState(order.id, state, payMethod)
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
    formWhere: 'Fill the form?',
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
        <Button tone="staff" variant="ghost" onClick={startOver}>
          Start over
        </Button>
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

              {deliveryItems.map((item) => (
                <DeliveryCard
                  key={item.id}
                  item={item}
                  index={draft.items.findIndex((row) => row.id === item.id)}
                  markets={markets}
                  marketDays={marketDays}
                  today={today}
                  suggestion={suggestions[item.id]}
                  showPaint={item.kind === 'custom'}
                  slotTaken={item.kind === 'custom' && Boolean(error && /hour is taken|overlap/i.test(error))}
                  onDelivery={(delivery) => patchDelivery(item.id, delivery)}
                  onPaintDay={(date) => {
                    const md = marketDays.find((d) => d.date === date)
                    patchItem(item.id, (row) => ({
                      ...row,
                      slotLocked: false,
                      paintDate: date,
                      paintStart: undefined,
                      paintEnd: undefined,
                      delivery:
                        row.delivery.mode === 'vienna'
                          ? row.delivery
                          : {
                              ...row.delivery,
                              mode: 'market',
                              pickupDate: date,
                              marketDayId: md?.id,
                              marketId: md?.marketId,
                            },
                    }))
                  }}
                  onPlace={() => placeOnBoard(item)}
                  onChangeSlot={() => changeSlot(item)}
                />
              ))}

              {onlyFinished ? (
                <div className={styles.card}>
                  <p className={styles.lead}>Hand over at the stall now. No calendar and no customer form.</p>
                  <SegmentedControl
                    legend="Payment method"
                    name="finished-pay"
                    value={payMethod}
                    onChange={setPayMethod}
                    options={[
                      { value: 'cash', label: 'Cash', selectedLabel: 'Current: Cash' },
                      { value: 'card', label: 'Card', selectedLabel: 'Current: Card' },
                    ]}
                  />
                  <SegmentedControl
                    legend="Payment state"
                    name="finished-state"
                    value={payState}
                    onChange={setPayState}
                    options={[
                      { value: 'paid', label: 'Paid', selectedLabel: 'Current: Paid' },
                      { value: 'deposit', label: 'Deposit', selectedLabel: 'Current: Deposit' },
                      { value: 'unpaid', label: 'Unpaid', selectedLabel: 'Current: Unpaid' },
                    ]}
                  />
                </div>
              ) : null}

              <div className={styles.actions}>
                <Button
                  tone="staff"
                  size="lg"
                  disabled={busy || !draft.items.length}
                  onClick={() => void continueFromDelivery()}
                >
                  {onlyFinished ? 'Done' : 'Create order & show QR'}
                </Button>
                <Button tone="staff" variant="ghost" onClick={() => setPhase('items')}>
                  Back to items
                </Button>
              </div>
            </>
          ) : null}

          {phase === 'qr' && order ? (
            <div>
              <p className={styles.lead}>Customer scans this for photos, name and contact. Payment is next.</p>
              <div className={styles.qr}>
                <QrCode value={formUrl} />
              </div>
              <p className={styles.link}>{formUrl}</p>
              <div className={styles.actions}>
                <Button
                  tone="staff"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(formUrl)
                    setCopied(true)
                  }}
                >
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
                <ButtonLink to={`/form/${order.formToken}`} tone="staff" variant="secondary">
                  Open form here
                </ButtonLink>
                <Button tone="staff" size="lg" onClick={() => setPhase('formWhere')}>
                  Continue
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'formWhere' && order ? (
            <div className={styles.actions}>
              <Button tone="staff" size="lg" onClick={() => navigate(`/form/${order.formToken}`)}>
                Fill on this iPad
              </Button>
              <Button tone="staff" variant="secondary" size="lg" onClick={() => setPhase('payment')}>
                Customer scans QR
              </Button>
            </div>
          ) : null}

          {phase === 'payment' && order ? (
            <div>
              <SegmentedControl
                legend="Method"
                name="pay-method"
                value={payMethod}
                onChange={setPayMethod}
                options={[
                  { value: 'cash', label: 'Register cash', selectedLabel: 'Current: Cash' },
                  { value: 'card', label: 'Card', selectedLabel: 'Current: Card' },
                ]}
              />
              <div className={styles.actions}>
                <Button tone="staff" size="lg" disabled={busy || !payMethod} onClick={() => void recordPayment('paid')}>
                  Record paid
                </Button>
                <Button
                  tone="staff"
                  variant="secondary"
                  disabled={busy || !payMethod}
                  onClick={() => void recordPayment('deposit')}
                >
                  Record 50% deposit
                </Button>
                <Button tone="staff" variant="ghost" disabled={busy} onClick={() => void recordPayment('unpaid')}>
                  Leave unpaid
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'done' && order ? (
            <div>
              <p className={styles.lead}>
                {order.code} · {formatEur(order.total)}
              </p>
              {hasCustom && formUrl ? <p className={styles.link}>{formUrl}</p> : null}
              <div className={styles.actions}>
                <ButtonLink to={`/staff/orders/${order.id}`} tone="staff">
                  Open order
                </ButtonLink>
                <ButtonLink to="/staff/agenda" tone="staff" variant="secondary">
                  Agenda
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

function ItemsStep({
  items,
  onAdd,
  onRemove,
  onToggleName,
  onDuration,
  onContinue,
}: {
  items: DraftItem[]
  onAdd: (kind: 'custom' | 'finished') => void
  onRemove: (id: string) => void
  onToggleName: (item: DraftItem) => void
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
                <label className={styles.check}>
                  <input type="checkbox" checked={item.withName} onChange={() => onToggleName(item)} />
                  {`Add name on ornament · ${formatEur(NAME_EXTRA)} (text comes from the customer form)`}
                </label>
              ) : null}
              {item.kind === 'custom' && !item.slotLocked ? (
                <>
                  <SegmentedControl
                    legend="Paint duration"
                    name={`dur-${item.id}`}
                    value={item.durationPreset}
                    onChange={(preset) => onDuration(item, preset)}
                    options={DURATION_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                      selectedLabel: `Current: ${o.label}`,
                    }))}
                  />
                  {item.durationPreset === 'custom' ? (
                    <Field label="Minutes" htmlFor={`mins-${item.id}`}>
                      <input
                        id={`mins-${item.id}`}
                        type="number"
                        min={15}
                        step={15}
                        value={item.durationMinutes}
                        onChange={(e) => onDuration(item, 'custom', Number(e.target.value) || 15)}
                      />
                    </Field>
                  ) : null}
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
  index,
  markets,
  marketDays,
  today,
  suggestion,
  showPaint,
  slotTaken,
  onDelivery,
  onPaintDay,
  onPlace,
  onChangeSlot,
}: {
  item: DraftItem
  index: number
  markets: Market[]
  marketDays: MarketDay[]
  today?: MarketDay
  suggestion?: CapacityResult
  showPaint: boolean
  slotTaken?: boolean
  onDelivery: (delivery: DraftItem['delivery']) => void
  onPaintDay: (date: string) => void
  onPlace: () => void
  onChangeSlot: () => void
}) {
  const pickupWhen: 'today' | 'another_day' | 'vienna' | 'now' =
    item.kind === 'finished' && item.delivery.mode === 'now'
      ? 'now'
      : item.delivery.mode === 'vienna'
        ? 'vienna'
        : item.delivery.pickupDate && today && item.delivery.pickupDate !== today.date
          ? 'another_day'
          : 'today'

  const pickupDay =
    marketDays.find((d) => d.id === item.delivery.marketDayId) ??
    marketDays.find((d) => d.date === item.delivery.pickupDate) ??
    (pickupWhen === 'today' ? today : undefined)

  const hours = pickupDay
    ? pickupHourOptions(
        pickupDay.openHour,
        pickupDay.closeHour,
        item.kind === 'custom' && item.paintDate === pickupDay.date ? item.paintEnd : undefined,
      )
    : []

  const chosenMarketId = item.delivery.marketId ?? today?.marketId
  const daysOfMarket = marketDays.filter((d) => !chosenMarketId || d.marketId === chosenMarketId)
  const otherDays = daysOfMarket.filter((d) => !d.isToday)
  const viennaDays = marketDays.filter((d) => isViennaWeekday(d.date))
  const mixedMarkets = new Set(daysOfMarket.map((d) => d.marketId)).size > 1
  const dayChoices = pickupWhen === 'another_day' ? otherDays : daysOfMarket

  function setMode(mode: DeliveryMode | 'today' | 'another_day') {
    if (mode === 'now') {
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
      const keep = item.delivery.pickupDate && viennaDays.some((d) => d.date === item.delivery.pickupDate)
      const date = keep ? item.delivery.pickupDate : viennaDays[0]?.date
      const md = viennaDays.find((d) => d.date === date)
      onDelivery({
        mode: 'vienna',
        pickupDate: date,
        marketDayId: md?.id,
        marketId: md?.marketId,
        pickupHour: null,
      })
      return
    }
    if (mode === 'today') {
      onDelivery({
        mode: 'market',
        pickupDate: today?.date,
        marketDayId: today?.id,
        marketId: today?.marketId ?? chosenMarketId,
        pickupHour: item.delivery.pickupHour ?? item.paintEnd ?? null,
      })
      return
    }
    onDelivery({
      mode: 'market',
      pickupDate: otherDays[0]?.date,
      marketDayId: otherDays[0]?.id,
      marketId: otherDays[0]?.marketId ?? chosenMarketId,
      pickupHour: item.delivery.pickupHour ?? null,
    })
    if (otherDays[0] && showPaint && !item.slotLocked) onPaintDay(otherDays[0].date)
  }

  const slot = slotLabel(item)

  return (
    <article className={styles.card}>
      <h3>{itemLabel(item, index)}</h3>

      {item.kind === 'finished' ? (
        <SegmentedControl
          legend="Handover"
          name={`hand-${item.id}`}
          value={item.delivery.mode}
          onChange={(mode) => {
            if (mode === 'now') setMode('now')
            else if (mode === 'vienna') setMode('vienna')
            else setMode('today')
          }}
          options={[
            { value: 'now', label: 'Deliver now', selectedLabel: 'Current: Deliver now' },
            { value: 'market', label: 'Market day', selectedLabel: 'Current: Market day' },
            { value: 'vienna', label: 'Vienna', selectedLabel: 'Current: Vienna' },
          ]}
        />
      ) : (
        <SegmentedControl
          legend="Pickup"
          name={`when-${item.id}`}
          value={pickupWhen === 'now' ? 'today' : pickupWhen}
          onChange={(value) => setMode(value)}
          options={[
            { value: 'today', label: 'Today', selectedLabel: 'Current: Today' },
            { value: 'another_day', label: 'Another day', selectedLabel: 'Current: Another day' },
            { value: 'vienna', label: 'Vienna', selectedLabel: 'Current: Vienna' },
          ]}
        />
      )}

      {(pickupWhen === 'another_day' || (item.kind === 'finished' && item.delivery.mode === 'market')) &&
      dayChoices.length ? (
        <ChoiceList
          legend="Pickup day"
          name={`day-${item.id}`}
          value={item.delivery.pickupDate ?? (pickupWhen === 'another_day' ? otherDays[0]?.date : today?.date) ?? null}
          onChange={(date) => {
            const md = daysOfMarket.find((d) => d.date === date) ?? marketDays.find((d) => d.date === date)
            onDelivery({
              ...item.delivery,
              mode: 'market',
              pickupDate: date,
              marketDayId: md?.id,
              marketId: md?.marketId ?? chosenMarketId,
            })
            if (showPaint && !item.slotLocked) onPaintDay(date)
          }}
          choices={dayChoices.map((d) => ({
            value: d.date,
            title: formatDateLabel(d.date),
            body: mixedMarkets ? markets.find((m) => m.id === d.marketId)?.name : undefined,
          }))}
        />
      ) : null}

      {item.delivery.mode === 'vienna' ? (
        <>
          <p className={styles.lead}>Vienna · Wednesday / Friday · no clock. Address comes from the customer form / Track.</p>
          {viennaDays.length ? (
            <ChoiceList
              legend="Vienna day"
              name={`vienna-${item.id}`}
              value={item.delivery.pickupDate ?? viennaDays[0]?.date ?? null}
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
              }}
              choices={viennaDays.map((d) => ({
                value: d.date,
                title: formatDateLabel(d.date),
                body: 'Day only · no clock',
              }))}
            />
          ) : null}
        </>
      ) : null}

      {item.kind === 'finished' && item.delivery.mode === 'now' ? (
        <p className={styles.lead}>Deliver now at the stall.</p>
      ) : null}

      {showPaint ? (
        <div className={styles.slotBox}>
          {slotTaken ? (
            <p>
              That hour is taken
              {' · '}
              <button type="button" className={styles.textBtn} onClick={onChangeSlot}>
                change
              </button>
              {' / '}
              <button type="button" className={styles.textBtn} onClick={onPlace}>
                place on board
              </button>
            </p>
          ) : item.slotLocked && slot ? (
            <p>
              Paint {slot} (from the board)
              {' · '}
              <button type="button" className={styles.textBtn} onClick={onChangeSlot}>
                change
              </button>
              {' / '}
              <button type="button" className={styles.textBtn} onClick={onPlace}>
                place on board
              </button>
            </p>
          ) : slot ? (
            <p>
              Suggested {formatHour(item.paintStart!)}–{formatHour(item.paintEnd!)}
              {' · '}
              <button type="button" className={styles.textBtn} onClick={onChangeSlot}>
                change
              </button>
              {' / '}
              <button type="button" className={styles.textBtn} onClick={onPlace}>
                place on board
              </button>
            </p>
          ) : (
            <p>
              {suggestion && !suggestion.ok
                ? 'No free slot on this day.'
                : 'Looking for a free slot…'}{' '}
              <button type="button" className={styles.textBtn} onClick={onPlace}>
                Place on calendar
              </button>
              {pickupWhen !== 'another_day' ? ' or pick another day.' : ''}
            </p>
          )}
        </div>
      ) : null}

      {item.delivery.mode === 'market' && pickupDay && hours.length ? (
        <div>
          <p className={styles.legend}>Pickup hour</p>
          <div className={styles.hours}>
            {hours.map((hour) => (
              <Button
                key={hour}
                tone="staff"
                variant="secondary"
                selected={item.delivery.pickupHour === hour}
                onClick={() => onDelivery({ ...item.delivery, pickupHour: hour })}
              >
                {item.delivery.pickupHour === hour ? `Current: ${formatHour(hour)}` : formatHour(hour)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}
