import { AgendaSessionList } from '../../components/staff/AgendaSessionList'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { useStaffClock } from '../../lib/staffClock'
import { layoutAgendaSlots } from '../../lib/agendaLayout'
import { StaffDialog } from '../../components/staff/StaffDialog'
import { Field } from '../../components/ui/Field'
import { dayChipLabel, DeliveryRow } from '../../components/staff/DeliveryRow'
import { DayStrip } from '../../components/staff/DayStrip'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { AgendaDay, AgendaSlot, PaintingDay } from '../../domain/types'
import { handoffLabel } from '../../lib/handoff'
import { hasPaintOverlap } from '../../lib/slots'
import { formatDateLabel, formatHour, formatMinutes, parseHour, hourToY, yToHour } from '../../lib/time'
import styles from './AgendaPage.module.css'

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
  const version = useStaffRefresh()
  const { hour: nowHour } = useStaffClock()
  // The board is laid out in px, so the hour height follows the text size (5rem at 16px is the 80px token); at 200% text an hour doubles.
  const [{ HOUR_H, REM }] = useState(() => {
    const css = getComputedStyle(document.documentElement)
    const rem = Number.parseFloat(css.fontSize) || 16
    return { HOUR_H: Math.max(Number.parseFloat(css.getPropertyValue('--size-agenda-hour')), 5 * rem), REM: rem }
  })
  const [paintingRule, setPaintingRule] = useState<PaintingDay | null>(null)
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
  const [view, setView] = useState<'list' | 'calendar'>(() => params.get('view') === 'list' ? 'list' : params.get('view') === 'calendar' || placeItem ? 'calendar' : window.matchMedia('(max-width: 639px)').matches ? 'list' : 'calendar')
  const editing = arranging || Boolean(placeItem)

  useEffect(() => {
    let active = true
    api.agenda.listDays().then((list) => {
      if (!active) return
      setDays(list)
      const today = list.find((d) => d.marketDay.isToday) ?? list[0]
      setDate((current) => dateParam || current || today?.marketDay.date || '')
      setLoadError('')
    }).catch((err: Error) => { if (active) setLoadError(err.message) })
    return () => { active = false }
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

  useEffect(() => {
    if (!date) return
    let active = true
    api.paintingDays.list(date, date).then(rows => { if (active) setPaintingRule(rows[0] ?? null) }).catch(() => { if (active) setPaintingRule(null) })
    return () => { active = false }
  }, [date, version, retry])

  const day = days.find((d) => d.marketDay.date === date) ?? days[0]
  const hours = useMemo(() => {
    if (!day) return []
    const out: number[] = []
    for (let h = Math.floor(day.marketDay.openHour); h < day.marketDay.closeHour; h += 1) out.push(h)
    return out
  }, [day])

  const boardSlots = useMemo(() => day?.slots ?? [], [day])
  const slotLayout = layoutAgendaSlots(boardSlots)
  const boardStart = day ? Math.floor(day.marketDay.openHour) : 0

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
    return clampHour(yToHour(e.clientY - rect.top, HOUR_H, boardStart))
  }

  function deliveryAllows(slot: AgendaSlot, startHour: number, endHour: number): boolean {
    if (!day || !slot.item || slot.held) return false
    if (day.marketDay.isToday && startHour < nowHour) return false
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
    if (day.marketDay.isToday && start < nowHour - 0.01) return 'That time has already passed.'
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
      if (!editing || !movingSlot || movingSlot.held || movingSlot.order?.handedOver || movingSlot.block.status !== 'not_started') return
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
    const problem = newSlotProblem(newProposal.start, newProposal.end)
    if (problem || newProposal.end <= newProposal.start || newProposal.end > day.marketDay.closeHour || newProposal.start < day.marketDay.openHour) { setMoveError(problem ?? 'Choose a valid time within opening hours.'); return }
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
      // A short touch can dismiss the proposal; only a held drag or explicit add creates one.
      setNewProposal(null)
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
      setRetry(value => value + 1)
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Could not move the session')
    } finally {
      setMoving(false)
    }
  }

  if (loadError) return <section><h1>Agenda</h1><ButtonLink to="/staff/painting-days" tone="staff" variant="secondary">Painting days</ButtonLink><p role="alert">{loadError}</p><Button tone="staff" onClick={() => setRetry(value => value + 1)}>Try again</Button></section>
  if (!day) return <p role="status">{date ? 'No days scheduled.' : 'Loading agenda…'}</p>

  const height = (day.marketDay.closeHour - boardStart) * HOUR_H
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
        <h1>Agenda</h1><ButtonLink to="/staff/painting-days" tone="staff" variant="secondary">Painting days</ButtonLink>
        <p className={styles.context}>
          {day.market.name} · {formatDateLabel(day.marketDay.date)}
        </p>
        {paintingRule && <p className={styles.context}>{paintingRule.booked} {paintingRule.booked === 1 ? 'session' : 'sessions'} {day.marketDay.isToday ? 'today' : 'scheduled'}{!paintingRule.open ? ' · Web booking closed' : paintingRule.booked >= paintingRule.maxPaintings ? ` · Web booking full (${Math.min(paintingRule.booked, paintingRule.maxPaintings)}/${paintingRule.maxPaintings})` : ''}</p>}
      </div>

      <DayStrip
        days={dayOptions}
        today={days.find(row => row.marketDay.isToday)?.marketDay.date}
        value={date}
        onChange={setAgendaDate}
      />

      <div className={styles.toolbar}>
        {view === 'calendar' && <Button tone="staff" variant="secondary" onClick={() => {
          const earliest = day.marketDay.isToday ? Math.max(nowHour, day.marketDay.openHour) : day.marketDay.openHour
          for (let start = Math.ceil(earliest * 4) / 4; start + 1 <= day.marketDay.closeHour; start += .25) {
            if (!newSlotProblem(start, start + 1)) { proposeNew(start, start + 1); return }
          }
          setMoveError('No free hour on this day. Choose another day or move a session.')
        }}>+ Add paint session</Button>}

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
        {marketDeliveries.length || viennaDeliveries.length ? <a href="#agenda-pickups" className={styles.jump}>{marketDeliveries.length ? `${marketDeliveries.length} ${marketDeliveries.length === 1 ? 'pickup' : 'pickups'}` : `${viennaDeliveries.length} ${viennaDeliveries.length === 1 ? 'delivery' : 'deliveries'}`} ↓</a> : null}
        {view === 'calendar' && !placeItem ? <Button tone="staff" variant="ghost" selected={arranging} onClick={() => { setArranging(!arranging); setMoveProposal(null); setNewProposal(null); setPreview(null); drag.current = null }}>{arranging ? 'Done moving' : 'Move sessions'}</Button> : null}
      </div>
      {view === 'calendar' ? (
        <p className={styles.createHint}>
          {placeItem
            ? 'Tap or drag free time to paint this ornament.'
            : arranging
              ? 'Drag an unstarted session to a new time.'
              : 'Use + Add paint session, or hold and drag free time, to start a custom sale.'}
        </p>
      ) : null}

      {moveError && !moveProposal ? <p className={styles.moveError} role="alert">{moveError}</p> : null}

      {moveProposal ? (
        <StaffDialog title="Confirm schedule change" busy={moving} onClose={() => { setMoveProposal(null); setMoveError('') }}>
          <div>
            <strong>Move {moveProposal.slot.order?.code ?? moveProposal.slot.item?.petName ?? 'session'}?</strong>
            <p>
              {formatHour(moveProposal.slot.block.startHour)}–{formatHour(moveProposal.slot.block.endHour)}
              <span aria-hidden="true"> → </span>
              <strong>{formatHour(moveProposal.startHour)}–{formatHour(moveProposal.endHour)}</strong>
            </p>
            <small>Pickup stays {moveProposal.slot.item ? handoffLabel(moveProposal.slot.item, marketDays) : 'unchanged'}.</small>
          </div>
          {moveError ? <p role="alert">{moveError}</p> : null}
          <div className={styles.moveActions}>
            <Button tone="staff" variant="ghost" onClick={() => { setMoveProposal(null); setMoveError('') }} disabled={moving}>
              Cancel
            </Button>
            <Button tone="staff" onClick={confirmMove} disabled={moving}>
              {moving ? 'Saving…' : 'Save move'}
            </Button>
          </div>
        </StaffDialog>
      ) : null}

      {[...slotLayout.values()].some(layout => layout.lanes > 1) && <p className={styles.moveError} role="status">Overlapping sessions are shown side by side. Review the schedule.</p>}
      <div className={styles.workspace}>
        {view === 'list' ? <AgendaSessionList slots={day.slots} days={marketDays} selectedId={selectedBlockId} onOpen={openOrder} /> : <div>
          <div className={styles.board}>
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
              {day.marketDay.isToday && nowHour >= day.marketDay.openHour && nowHour <= day.marketDay.closeHour ? (
                <div
                  className={styles.now}
                  role="img"
                  data-now={formatHour(nowHour)}
                  aria-label={`Current time ${formatHour(nowHour)} in Vienna`}
                  style={{ top: hourToY(nowHour, HOUR_H, boardStart) }}
                />
              ) : null}
              {shownPreview ? (
                <div
                  className={shownPreview.invalid ? styles.previewBad : styles.preview}
                  style={{
                    top: hourToY(shownPreview.start, HOUR_H, boardStart),
                    height: Math.max(8, (shownPreview.end - shownPreview.start) * HOUR_H),
                  }}
                >
                  {!shownPreview.invalid ? <span>{formatHour(shownPreview.start)}–{formatHour(shownPreview.end)}</span> : null}
                </div>
              ) : null}
              {boardSlots.map((slot) => {
                const name = slot.held ? 'Held by web checkout' : slot.item?.petName || slot.customer?.name || 'Block'
                const range = `${formatHour(slot.block.startHour)}–${formatHour(slot.block.endHour)}`
                const code = slot.order?.code
                const handoff = slot.item ? handoffLabel(slot.item, marketDays) : null
                const tone = slot.held ? 'held' : slot.order?.handedOver ? 'delivered' : slot.block.status
                const slotHeight = (slot.block.endHour - slot.block.startHour) * HOUR_H - 4
                // Three lines need about 4.75rem (76px at 16px); shorter blocks get one line instead of overlapping text.
                const compact = slotHeight < 4.75 * REM
                const statusLabel = slot.held ? (slot.holdUntil ? `Held until ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' }).format(new Date(slot.holdUntil))}` : 'Held by web checkout') : tone === 'delivered' ? 'Delivered' : tone === 'finished' ? 'Ready' : tone === 'in_progress' ? 'Painting' : 'To paint'
                return (
                  <button
                    key={slot.block.id}
                    type="button"
                    className={styles.slot}
                    data-slot="true"
                    data-held={slot.held || undefined}
                    disabled={slot.held}
                    data-slot-id={slot.block.id}
                    data-movable={!slot.held && slot.block.status === 'not_started' && !slot.order?.handedOver ? 'true' : 'false'}
                    data-status={tone}
                    data-selected={selectedBlockId === slot.block.id ? 'true' : 'false'}
                    aria-pressed={selectedBlockId === slot.block.id}
                    aria-label={[name, `paint ${range}`, code, statusLabel, handoff].filter(Boolean).join(', ')}
                    style={{
                      left: `${100 * (slotLayout.get(slot.block.id)?.lane ?? 0) / (slotLayout.get(slot.block.id)?.lanes ?? 1)}%`,
                      width: `calc(${100 / (slotLayout.get(slot.block.id)?.lanes ?? 1)}% - var(--space-2))`,
                      top: hourToY(slot.block.startHour, HOUR_H, boardStart),
                      height: slotHeight,
                    }}
                    data-compact={compact || undefined}
                    onClick={() => openOrder(slot)}
                  >
                    {compact ? <span className={styles.slotLine}><strong>{name}</strong> · {range} · {statusLabel}</span> : <>
                      <strong>{name}</strong>
                      <span className={styles.slotRange}>
                        {range}
                        {code ? ` · ${code}` : ''}
                      </span>
                      <span className={styles.slotHandoff}>{statusLabel}</span>
                    </>}
                  </button>
                )
              })}
            </div>
          </div>
          {newProposal ? (
            <StaffDialog title="New paint session" onClose={() => setNewProposal(null)}>
              <div>
                <strong>{placeItem ? 'Paint this ornament' : 'New custom ornament'}</strong>
                <p>
                  {formatDateLabel(day.marketDay.date)} · {formatHour(newProposal.start)}–{formatHour(newProposal.end)}
                  <span className={styles.newDuration}> · {formatMinutes(proposalMinutes)}</span>
                </p>
              </div>
              <Field label="Paint start" htmlFor="proposal-start"><input id="proposal-start" type="time" step="900" value={formatHour(newProposal.start)} onChange={event => setNewProposal({ ...newProposal, start: parseHour(event.target.value) })} /></Field>
              <Field label="Paint end" htmlFor="proposal-end"><input id="proposal-end" type="time" step="900" value={formatHour(newProposal.end)} onChange={event => setNewProposal({ ...newProposal, end: parseHour(event.target.value) })} /></Field>
              {moveError && <p role="alert">{moveError}</p>}
              <div className={styles.moveActions}>
                <Button tone="staff" variant="ghost" onClick={() => setNewProposal(null)}>
                  Cancel
                </Button>
                <Button tone="staff" onClick={startSaleFromProposal}>
                  {placeItem ? 'Use this time' : 'Start sale'}
                </Button>
              </div>
            </StaffDialog>
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
            {marketDeliveries.length} {marketDeliveries.length === 1 ? 'pickup' : 'pickups'} · {viennaDeliveries.length} home {viennaDeliveries.length === 1 ? 'delivery' : 'deliveries'}
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
