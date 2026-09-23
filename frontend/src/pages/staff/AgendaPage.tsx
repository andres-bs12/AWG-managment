import { AgendaSessionList } from '../../components/staff/AgendaSessionList'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useMockStoreVersion } from '../../api/mock/useMockStore'
import { DEMO_NOW_HOUR } from '../../api/mock/seed'
import { dayChipLabel, DeliveryRow } from '../../components/staff/DeliveryRow'
import { DayStrip } from '../../components/staff/DayStrip'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { AgendaDay, AgendaSlot } from '../../domain/types'
import { handoffLabel } from '../../lib/handoff'
import { hasPaintOverlap, keepNonOverlapping } from '../../lib/slots'
import { formatDateLabel, formatHour, formatMinutes, hourToY, yToHour } from '../../lib/time'
import styles from './AgendaPage.module.css'

const HOUR_H = 80
const HOLD_MS = 350
const HOLD_SLOP_PX = 8

type PendingHold = { pointerId: number; startHour: number; x: number; y: number; timer: number }

type DragState =
  | { kind: 'new'; pointerId: number; startHour: number }
  | { kind: 'move'; pointerId: number; blockId: string; originalStart: number; duration: number; grabOffset: number }

type MoveProposal = {
  slot: AgendaSlot
  startHour: number
  endHour: number
}

function capturePointer(element: Element | null, pointerId: number) {
  try {
    element?.setPointerCapture(pointerId)
  } catch {
    /* pointer already released */
  }
}

function slotRange(slot: AgendaSlot) {
  return { id: slot.block.id, startHour: slot.block.startHour, endHour: slot.block.endHour }
}

export function AgendaPage() {
  const version = useMockStoreVersion()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const placeItem = params.get('place')
  const dateParam = params.get('date')
  const blockParam = params.get('block')
  const [days, setDays] = useState<AgendaDay[]>([])
  const [date, setDate] = useState('')
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const suppressClick = useRef(false)
  const [preview, setPreviewState] = useState<{ start: number; end: number; invalid?: boolean } | null>(null)
  const previewRef = useRef<{ start: number; end: number; invalid?: boolean } | null>(null)
  const setPreview = (next: { start: number; end: number; invalid?: boolean } | null) => {
    previewRef.current = next
    setPreviewState(next)
  }
  const [moveProposal, setMoveProposal] = useState<MoveProposal | null>(null)
  const [newProposal, setNewProposal] = useState<{ start: number; end: number } | null>(null)
  const pendingHold = useRef<PendingHold | null>(null)
  const [moveError, setMoveError] = useState('')
  const [moving, setMoving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [arranging, setArranging] = useState(false)
  const [view, setView] = useState<'list' | 'calendar'>(() => params.get('view') === 'list' ? 'list' : params.get('view') === 'calendar' || placeItem ? 'calendar' : window.matchMedia('(max-width: 600px)').matches ? 'list' : 'calendar')
  const editing = arranging || Boolean(placeItem)

  useEffect(() => {
    api.agenda.listDays().then((list) => {
      setDays(list)
      const today = list.find((d) => d.marketDay.isToday) ?? list[0]
      setDate((current) => dateParam || current || today?.marketDay.date || '')
      setLoadError('')
    }).catch((err: Error) => setLoadError(err.message))
  }, [version, dateParam, retry])

  useEffect(() => {
    if (blockParam) setSelectedBlockId(blockParam)
  }, [blockParam])

  function setAgendaDate(next: string) {
    setDate(next)
    setSelectedBlockId(null)
    setMoveProposal(null)
    setNewProposal(null)
    setMoveError('')
    const query = new URLSearchParams(params)
    query.set('date', next)
    query.delete('block')
    setParams(query, { replace: true })
  }

  const day = days.find((d) => d.marketDay.date === date) ?? days[0]
  const hours = useMemo(() => {
    if (!day) return []
    const out: number[] = []
    for (let h = day.marketDay.openHour; h < day.marketDay.closeHour; h += 1) out.push(h)
    return out
  }, [day])

  const boardSlots = useMemo(() => {
    if (!day) return []
    const kept = new Set(keepNonOverlapping(day.slots.map(slotRange)).map((block) => block.id))
    return day.slots.filter((slot) => kept.has(slot.block.id))
  }, [day])

  const paintRanges = useMemo(() => boardSlots.map(slotRange), [boardSlots])
  const marketDays = useMemo(() => days.map((row) => row.marketDay), [days])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const blockScroll = (event: TouchEvent) => {
      if (drag.current) event.preventDefault()
    }
    grid.addEventListener('touchmove', blockScroll, { passive: false })
    return () => grid.removeEventListener('touchmove', blockScroll)
  }, [view, day?.marketDay.id])

  useEffect(() => () => {
    if (pendingHold.current) window.clearTimeout(pendingHold.current.timer)
  }, [])

  function clampHour(h: number) {
    if (!day) return h
    return Math.min(day.marketDay.closeHour, Math.max(day.marketDay.openHour, h))
  }

  function hourFromEvent(e: ReactPointerEvent) {
    if (!day || !gridRef.current) return day?.marketDay.openHour ?? 12
    const rect = gridRef.current.getBoundingClientRect()
    return clampHour(yToHour(e.clientY - rect.top, HOUR_H, day.marketDay.openHour))
  }

  function deliveryAllows(slot: AgendaSlot, startHour: number, endHour: number): boolean {
    if (!day || !slot.item) return false
    if (day.marketDay.isToday && startHour < DEMO_NOW_HOUR) return false
    const deliveryDay = marketDays.find((row) => row.id === slot.item?.delivery.marketDayId)
    if (!deliveryDay || day.marketDay.date > deliveryDay.date) return false
    if (slot.item.delivery.kind === 'vienna' && day.marketDay.date >= deliveryDay.date) return false
    if (
      slot.item.delivery.kind === 'market' &&
      day.marketDay.date === deliveryDay.date &&
      slot.item.delivery.pickupHour != null &&
      endHour > slot.item.delivery.pickupHour
    ) return false
    return true
  }

  function previewFrom(startHour: number, endHour: number, movingSlot?: AgendaSlot) {
    if (!day) return { start: startHour, end: endHour, invalid: true }
    const minimumDuration = movingSlot
      ? movingSlot.block.endHour - movingSlot.block.startHour
      : 0.5
    const start = Math.min(startHour, endHour)
    const end = Math.max(start + minimumDuration, Math.max(startHour, endHour))
    const clampedStart = Math.max(start, day.marketDay.openHour)
    const clampedEnd = Math.min(end, day.marketDay.closeHour)
    return {
      start: clampedStart,
      end: clampedEnd,
      invalid:
        clampedEnd - clampedStart < 0.24 ||
        (!movingSlot && Boolean(newSlotProblem(clampedStart, clampedEnd))) ||
        hasPaintOverlap(paintRanges, clampedStart, clampedEnd, movingSlot?.block.id) ||
        Boolean(movingSlot && !deliveryAllows(movingSlot, clampedStart, clampedEnd)),
    }
  }

  function newSlotProblem(start: number, end: number): string | null {
    if (!day) return 'No market day'
    if (day.marketDay.isToday && start < DEMO_NOW_HOUR - 0.01) return 'That time has already passed.'
    if (hasPaintOverlap(paintRanges, start, end)) return 'That time overlaps another session.'
    return null
  }

  function clearHold() {
    if (pendingHold.current) window.clearTimeout(pendingHold.current.timer)
    pendingHold.current = null
  }

  function startNewDrag(pointerId: number, startHour: number) {
    if (!day) return
    drag.current = { kind: 'new', pointerId, startHour }
    setPreview(previewFrom(startHour, Math.min(startHour + 1, day.marketDay.closeHour)))
  }

  function proposeNew(start: number, end: number) {
    const problem = newSlotProblem(start, end)
    if (problem) {
      setNewProposal(null)
      setMoveError(problem)
      return
    }
    setMoveError('')
    setNewProposal({ start, end })
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    suppressClick.current = false
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!day) return
    const slotElement = (e.target as HTMLElement).closest<HTMLElement>('[data-slot-id]')
    const movingSlot = slotElement
      ? boardSlots.find((slot) => slot.block.id === slotElement.dataset.slotId)
      : undefined
    if (slotElement) {
      if (!editing || !movingSlot || movingSlot.block.status !== 'not_started') return
      e.preventDefault()
      const pointerHour = hourFromEvent(e)
      const duration = movingSlot.block.endHour - movingSlot.block.startHour
      drag.current = {
        kind: 'move',
        pointerId: e.pointerId,
        blockId: movingSlot.block.id,
        originalStart: movingSlot.block.startHour,
        duration,
        grabOffset: pointerHour - movingSlot.block.startHour,
      }
      setSelectedBlockId(movingSlot.block.id)
      setMoveProposal(null)
      setMoveError('')
      setPreview(previewFrom(movingSlot.block.startHour, movingSlot.block.endHour, movingSlot))
      capturePointer(e.currentTarget, e.pointerId)
      return
    }
    setNewProposal(null)
    setMoveError('')
    const start = hourFromEvent(e)
    if (e.pointerType === 'touch' && !editing) {
      clearHold()
      const pointerId = e.pointerId
      pendingHold.current = {
        pointerId,
        startHour: start,
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          pendingHold.current = null
          startNewDrag(pointerId, start)
          capturePointer(gridRef.current, pointerId)
        }, HOLD_MS),
      }
      return
    }
    e.preventDefault()
    startNewDrag(e.pointerId, start)
    capturePointer(e.currentTarget, e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const hold = pendingHold.current
    if (hold && hold.pointerId === e.pointerId && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP_PX) {
      clearHold()
      return
    }
    if (!drag.current || drag.current.pointerId !== e.pointerId || !day) return
    const currentDrag = drag.current
    if (currentDrag.kind === 'new') {
      setPreview(previewFrom(currentDrag.startHour, hourFromEvent(e)))
      return
    }
    const slot = boardSlots.find((row) => row.block.id === currentDrag.blockId)
    if (!slot) return
    const unclampedStart = hourFromEvent(e) - currentDrag.grabOffset
    const start = Math.min(day.marketDay.closeHour - currentDrag.duration, Math.max(day.marketDay.openHour, unclampedStart))
    setPreview(previewFrom(start, start + currentDrag.duration, slot))
  }

  function commitDrag() {
    const preview = previewRef.current
    if (!drag.current || !preview || !day) {
      drag.current = null
      setPreview(null)
      return
    }
    const currentDrag = drag.current
    let { start, end } = preview
    if (end - start < 0.4) end = Math.min(start + 1, day.marketDay.closeHour)
    drag.current = null
    setPreview(null)
    if (currentDrag.kind === 'move') {
      const slot = boardSlots.find((row) => row.block.id === currentDrag.blockId)
      if (!slot) return
      if (Math.abs(start - currentDrag.originalStart) < 0.01) return
      suppressClick.current = true
      if (preview.invalid) {
        const overlaps = hasPaintOverlap(paintRanges, start, end, slot.block.id)
        setMoveError(
          overlaps
            ? 'No space there — it overlaps another session.'
            : `This session must stay before ${slot.item ? handoffLabel(slot.item, marketDays) : 'pickup'}.`,
        )
        return
      }
      setMoveError('')
      setMoveProposal({ slot, startHour: start, endHour: end })
      return
    }
    proposeNew(start, end)
  }

  function startSaleFromProposal() {
    if (!newProposal || !day) return
    const q = new URLSearchParams({
      kind: 'custom',
      date: day.marketDay.date,
      start: String(newProposal.start),
      end: String(newProposal.end),
    })
    if (placeItem) q.set('placeItem', placeItem)
    navigate(`/staff/sales/new?${q.toString()}`)
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const hold = pendingHold.current
    if (hold && hold.pointerId === e.pointerId && day) {
      clearHold()
      const start = Math.max(day.marketDay.openHour, Math.floor(hold.startHour * 2) / 2)
      const end = Math.min(start + 1, day.marketDay.closeHour)
      proposeNew(start, end)
      return
    }
    if (!drag.current || drag.current.pointerId !== e.pointerId) return
    commitDrag()
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (pendingHold.current?.pointerId === e.pointerId) clearHold()
    if (!drag.current || drag.current.pointerId !== e.pointerId) return
    drag.current = null
    setPreview(null)
  }

  function openOrder(slot: AgendaSlot) {
    if (editing) return
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (!slot.order) return
    setSelectedBlockId(slot.block.id)
    const backQuery = new URLSearchParams(params)
    backQuery.set('date', day.marketDay.date)
    backQuery.set('block', slot.block.id)
    backQuery.set('view', view)
    navigate(`/staff/orders/${slot.order.id}`, { state: { from: `/staff/agenda?${backQuery}`, itemId: slot.item?.id } })
  }

  async function confirmMove() {
    if (!moveProposal) return
    setMoving(true)
    setMoveError('')
    try {
      await api.agenda.moveBlock(moveProposal.slot.block.id, day.marketDay.date, moveProposal.startHour)
      setMoveProposal(null)
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Could not move the session')
    } finally {
      setMoving(false)
    }
  }

  if (loadError) return <section><h1>Agenda</h1><p role="alert">{loadError}</p><Button tone="staff" onClick={() => setRetry(value => value + 1)}>Try again</Button></section>
  if (!day) return <p role="status">{date ? 'No days scheduled.' : 'Loading agenda…'}</p>

  const height = (day.marketDay.closeHour - day.marketDay.openHour) * HOUR_H
  const shownPreview = preview ?? (newProposal ? { ...newProposal, invalid: false } : null)
  const proposalMinutes = newProposal ? Math.round((newProposal.end - newProposal.start) * 60) : 0
  const deliveries = day.deliveries ?? []
  const marketDeliveries = deliveries.filter((row) => row.deliveryKind === 'market')
  const viennaDeliveries = deliveries.filter((row) => row.deliveryKind === 'vienna')
  const dayOptions = days.map((row) => {
    const label = dayChipLabel(row)
    return { value: row.marketDay.date, label }
  })

  return (
    <section style={{ '--hour-h': `${HOUR_H}px` } as CSSProperties}>
      <div className={styles.head}>
        <h1>Agenda</h1>
        <p className={styles.context}>
          {day.market.name} · {formatDateLabel(day.marketDay.date)}
        </p>
      </div>

      <DayStrip
        days={dayOptions}
        today={days.find(row => row.marketDay.isToday)?.marketDay.date}
        value={date}
        onChange={setAgendaDate}
      />

      <div className={styles.toolbar}>
        <div className={styles.viewSwitch} role="group" aria-label="Agenda view">
          {(['list', 'calendar'] as const).map(option => <Button key={option} tone="staff" variant="secondary" selected={view === option} disabled={Boolean(placeItem)} onClick={() => {
            setView(option)
            setArranging(false)
            setMoveProposal(null)
            setNewProposal(null)
            const query = new URLSearchParams(params)
            query.set('view', option)
            setParams(query, { replace: true })
          }}>{option === 'list' ? 'List' : 'Calendar'}</Button>)}
        </div>
        {marketDeliveries.length || viennaDeliveries.length ? <a href="#agenda-pickups" className={styles.jump}>{marketDeliveries.length ? `${marketDeliveries.length} pickups` : `${viennaDeliveries.length} deliveries`} ↓</a> : null}
        {view === 'calendar' && !placeItem ? <Button tone="staff" variant="ghost" selected={arranging} onClick={() => { setArranging(!arranging); setMoveProposal(null); setNewProposal(null); setPreview(null); drag.current = null }}>{arranging ? 'Done moving' : 'Move sessions'}</Button> : null}
      </div>
      {view === 'calendar' ? (
        <p className={styles.createHint}>
          {placeItem
            ? 'Tap or drag free time to paint this ornament.'
            : arranging
              ? 'Drag an unstarted session to a new time.'
              : 'Tap free time, or hold and drag, to start a custom sale.'}
        </p>
      ) : null}

      {moveError ? <p className={styles.moveError} role="alert">{moveError}</p> : null}

      {moveProposal ? (
        <section className={styles.moveConfirm} aria-label="Confirm schedule change">
          <div>
            <strong>Move {moveProposal.slot.order?.code ?? moveProposal.slot.item?.petName ?? 'session'}?</strong>
            <p>
              {formatHour(moveProposal.slot.block.startHour)}–{formatHour(moveProposal.slot.block.endHour)}
              <span aria-hidden="true"> → </span>
              <strong>{formatHour(moveProposal.startHour)}–{formatHour(moveProposal.endHour)}</strong>
            </p>
            <small>Pickup stays {moveProposal.slot.item ? handoffLabel(moveProposal.slot.item, marketDays) : 'unchanged'}.</small>
          </div>
          <div className={styles.moveActions}>
            <Button tone="staff" variant="ghost" onClick={() => setMoveProposal(null)} disabled={moving}>
              Cancel
            </Button>
            <Button tone="staff" onClick={confirmMove} disabled={moving}>
              {moving ? 'Saving…' : 'Save move'}
            </Button>
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        {view === 'list' ? <AgendaSessionList slots={day.slots} days={marketDays} selectedId={selectedBlockId} onOpen={openOrder} /> : <div>
          <div className={styles.board} style={{ ['--hour-h' as string]: `${HOUR_H}px` }}>
            <div className={styles.hours}>
              {hours.map((h) => (
                <div key={h} className={styles.hour}>
                  {formatHour(h)}
                </div>
              ))}
            </div>
            <div
              ref={gridRef}
              data-editing={editing}
              className={styles.grid}
              style={{ height }}
              data-dragging={preview ? 'true' : 'false'}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              {hours.map((h) => (
                <div key={h} className={styles.gridline} />
              ))}
              {day.marketDay.isToday ? (
                <div
                  className={styles.now}
                  style={{ top: hourToY(DEMO_NOW_HOUR, HOUR_H, day.marketDay.openHour) }}
                />
              ) : null}
              {shownPreview ? (
                <div
                  className={shownPreview.invalid ? styles.previewBad : styles.preview}
                  style={{
                    top: hourToY(shownPreview.start, HOUR_H, day.marketDay.openHour),
                    height: Math.max(8, (shownPreview.end - shownPreview.start) * HOUR_H),
                  }}
                >
                  {!shownPreview.invalid ? <span>{formatHour(shownPreview.start)}–{formatHour(shownPreview.end)}</span> : null}
                </div>
              ) : null}
              {boardSlots.map((slot) => {
                const name = slot.item?.petName || slot.customer?.name || 'Block'
                const range = `${formatHour(slot.block.startHour)}–${formatHour(slot.block.endHour)}`
                const code = slot.order?.code
                const handoff = slot.item ? handoffLabel(slot.item, marketDays) : null
                const tone = slot.order?.handedOver ? 'delivered' : slot.block.status
                const statusLabel = tone === 'delivered' ? 'Delivered' : tone === 'finished' ? 'Ready' : tone === 'in_progress' ? 'Painting' : 'To paint'
                return (
                  <button
                    key={slot.block.id}
                    type="button"
                    className={styles.slot}
                    data-slot="true"
                    data-slot-id={slot.block.id}
                    data-movable={slot.block.status === 'not_started' && !slot.order?.handedOver ? 'true' : 'false'}
                    data-status={tone}
                    data-selected={selectedBlockId === slot.block.id ? 'true' : 'false'}
                    aria-pressed={selectedBlockId === slot.block.id}
                    aria-label={[name, `paint ${range}`, code, statusLabel, handoff].filter(Boolean).join(', ')}
                    style={{
                      top: hourToY(slot.block.startHour, HOUR_H, day.marketDay.openHour),
                      height: (slot.block.endHour - slot.block.startHour) * HOUR_H - 4,
                    }}
                    onClick={() => openOrder(slot)}
                  >
                    <strong>{name}</strong>
                    <span className={styles.slotRange}>
                      {range}
                      {code ? ` · ${code}` : ''}
                    </span>
                    <span className={styles.slotHandoff}>{statusLabel}</span>
                  </button>
                )
              })}
            </div>
          </div>
          {newProposal ? (
            <section className={styles.newConfirm} aria-label="New paint session">
              <div>
                <strong>{placeItem ? 'Paint this ornament' : 'New custom ornament'}</strong>
                <p>
                  {formatDateLabel(day.marketDay.date)} · {formatHour(newProposal.start)}–{formatHour(newProposal.end)}
                  <span className={styles.newDuration}> · {formatMinutes(proposalMinutes)}</span>
                </p>
              </div>
              <div className={styles.moveActions}>
                <Button tone="staff" variant="ghost" onClick={() => setNewProposal(null)}>
                  Cancel
                </Button>
                <Button tone="staff" onClick={startSaleFromProposal}>
                  {placeItem ? 'Use this time' : 'Start sale'}
                </Button>
              </div>
            </section>
          ) : null}
        </div>}

        <aside className={styles.side} id="agenda-pickups">
          <div className={styles.sideHead}>
            <h2>Pickups & delivery</h2>
            <ButtonLink to="/staff/deliveries" tone="staff" variant="ghost">
              All deliveries
            </ButtonLink>
          </div>
          <p className={styles.sideMeta}>
            {marketDeliveries.length} pickups · {viennaDeliveries.length} home deliveries
          </p>
          {marketDeliveries.length === 0 && viennaDeliveries.length === 0 ? (
            <p className={styles.sideMeta}>No deliveries for this day.</p>
          ) : null}
          {marketDeliveries.map((row) => (
            <DeliveryRow key={`${row.orderId}-${row.itemId}`} row={row} from={`/staff/agenda?${new URLSearchParams({ date: day.marketDay.date })}`} />
          ))}
          {viennaDeliveries.length ? (
            <>
              <h3 className={styles.homeTitle}>Home deliveries</h3>
              <ButtonLink to={`/staff/deliveries?day=${date}&mode=route`} tone="staff">Open delivery run</ButtonLink>
              {viennaDeliveries.map((row) => (
                <DeliveryRow key={`${row.orderId}-${row.itemId}`} row={row} from={`/staff/agenda?${new URLSearchParams({ date: day.marketDay.date })}`} />
              ))}
            </>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
