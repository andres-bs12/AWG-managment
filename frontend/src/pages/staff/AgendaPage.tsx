import { StaffText } from '../../components/staff/StaffText'
import { DayRow, LostSaves } from './PaintingDaysPage'
import { agendaCapacitySummary, maxPaintingsFromHours } from './PaintingDaysHelpers'
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { useStaffClock } from '../../lib/staffClock'
import { useStaffMarket, STAFF_MARKET_KEY } from '../../lib/staffMarket'
import { agendaBounds, layoutAgendaSlots } from '../../lib/agendaLayout'
import { StaffDialog } from '../../components/staff/StaffDialog'
import { MakeRoomDialog, type MakeRoomDialogMove } from '../../components/staff/MakeRoomDialog'
import { Field } from '../../components/ui/Field'
import { dayChipLabel } from '../../components/staff/DeliveryRow'
import { DayStrip } from '../../components/staff/DayStrip'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { AgendaDay, AgendaDelivery, AgendaSlot, Market, MarketDay, OrderItem, PaintingDay, ProductionStatus } from '../../domain/types'
import { handoffLabel } from '../../lib/handoff'
import { formatStaffShortDate } from '../../lib/postShipping'
import { bookedPaintRange, hasPaintOverlap, paintElapsedUntil } from '../../lib/slots'
import { formatDateLabel, formatHour, formatMinutes, parseHour, hourToY, weekdayShort, yToHour } from '../../lib/time'
import styles from './AgendaPage.module.css'

const HOLD_MS = 350
const HOLD_SLOP_PX = 8

type DragState =
  | { kind: 'new'; pointerId: number; startHour: number }
  | { kind: 'move'; pointerId: number; blockId: string; originalStart: number; duration: number; grabOffset: number }

type PendingDrag = { drag: DragState; x: number; y: number; timer?: number }
type DragPreview = { start: number; end: number; problem: string | null }

type MoveProposal = {
  slot: AgendaSlot
  startHour: number
  endHour: number
}

const STATUS_LABELS = {
  not_started: 'To paint',
  in_progress: 'Painting',
  finished: 'Ready',
  delivered: 'Delivered',
  shipped: 'Shipped',
}

function StatusTag({ status }: { status: ProductionStatus | 'delivered' | 'shipped' }) {
  return <span className={styles.statusTag} data-status={status}>{STATUS_LABELS[status]}</span>
}

function dayMarkets(day: AgendaDay) {
  return day.markets ?? (day.market.kind === 'market' ? [day.market] : [])
}

function capturePointer(element: Element | null, pointerId: number) {
  try {
    element?.setPointerCapture(pointerId)
  } catch {
    /* pointer already released */
  }
}

function canMove(slot: AgendaSlot) {
  return Boolean(slot.item && !slot.held && slot.block.status === 'not_started' && !(slot.item.handedOver ?? slot.order?.handedOver))
}

function slotHandoffDate(item: OrderItem, days: MarketDay[]): string | null {
  return days.find(row => row.id === item.delivery.marketDayId)?.date ?? item.delivery.deliveryDate ?? null
}

/** Movable via Make room: not started, not handed over, and its handoff day is strictly after its paint day. */
function isMakeRoomMovable(slot: AgendaSlot, paintDate: string, days: MarketDay[]): boolean {
  if (!canMove(slot) || !slot.item) return false
  const handoff = slotHandoffDate(slot.item, days)
  return Boolean(handoff && handoff > paintDate)
}

function makeRoomBlockError(err: unknown): string {
  const problem = err && typeof err === 'object' ? (err as { code?: string; message?: string }) : {}
  if (problem.code === 'SESSION_NOT_MOVABLE') {
    return problem.message || 'This session cannot be moved: it is handed over the day it is painted.'
  }
  if (problem.code === 'NO_SLOT_KEEPS_PROMISE') {
    return problem.message || 'No free slot before the handoff day. Move the session by hand.'
  }
  return err instanceof Error && err.message ? err.message : 'Could not move this session.'
}

function shortWindowHour(hour: number): string {
  const whole = Math.floor(hour)
  const mins = Math.round((hour - whole) * 60)
  return mins === 0 ? String(whole) : formatHour(hour)
}

/** Concise delivery/pickup line for a calendar block, e.g. "Pickup Sat 15:30", "Post Tue 1 Dec" or "Vienna Wed 18–20". */
function compactHandoff(item: OrderItem, days: MarketDay[]): string {
  const marketDay = days.find(row => row.id === item.delivery.marketDayId)
  const handoffDate = marketDay?.date ?? item.delivery.deliveryDate ?? null
  if (item.delivery.kind === 'post') {
    return handoffDate ? `Post ${formatStaffShortDate(handoffDate)}` : 'Post · date pending'
  }
  const dayPart = handoffDate ? weekdayShort(handoffDate) : ''
  if (item.delivery.kind === 'vienna') {
    return dayPart ? `Vienna ${dayPart} 18–20` : 'Vienna · date pending'
  }
  const timePart = item.delivery.pickupHour != null
    ? formatHour(item.delivery.pickupHour)
    : marketDay
      ? `${shortWindowHour(marketDay.openHour)}–${shortWindowHour(marketDay.closeHour)}`
      : ''
  return ['Pickup', dayPart, timePart].filter(Boolean).join(' ')
}

function SlotThumbnail({ slot, slotHeight }: { slot: AgendaSlot; slotHeight: number }) {
  const [failed, setFailed] = useState(false)
  const color = slot.item?.color
  const size = Math.max(32, Math.min(76, Math.round(slotHeight - 12)))
  if (slot.photoUrl && !failed) return (
    <img className={styles.thumbnail} src={slot.photoUrl} alt="Pet photo"
      style={{ width: size, height: size }} width={size} height={size} loading="lazy" draggable={false} onError={() => setFailed(true)} />
  )
  if (color) return (
    <span className={styles.swatch} style={{ background: `var(--ornament-${color})` }} role="img" aria-label={`${color} ornament`} />
  )
  return slot.photoUrl ? <span className={styles.swatch} aria-hidden="true" /> : null
}

function PaintingMarketField({ day, markets, automaticMarket, onSaved }: {
  day: PaintingDay
  markets: Market[]
  automaticMarket?: string
  onSaved: (day: PaintingDay) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(marketId: string | null) {
    setBusy(true)
    setError('')
    try {
      onSaved(await api.paintingDays.update(day.date, undefined, { paintingMarketId: marketId }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the painting location.')
    } finally {
      setBusy(false)
    }
  }
  return <Field label="Gaby paints at" htmlFor="agenda-paint-market" error={error}>
    <select id="agenda-paint-market" value={day.paintingMarketId ?? ''} disabled={busy}
      onChange={event => void save(event.target.value || null)}>
      <option value="">{automaticMarket ? `Automatic · ${automaticMarket}` : 'Automatic'}</option>
      {markets.map(market => <option key={market.id} value={market.id}>{market.name}</option>)}
    </select>
  </Field>
}

function rememberedMarketId(): string | null {
  try {
    return localStorage.getItem(STAFF_MARKET_KEY)
  } catch {
    return null
  }
}

function AgendaDeliveryCard({ row, markets, from }: { row: AgendaDelivery; markets: Market[]; from: string }) {
  const navigate = useNavigate()
  const [photoFailed, setPhotoFailed] = useState(false)
  const marketName = row.marketName
    || (row.marketId ? markets.find(m => m.id === row.marketId)?.name : null)
    || (row.methodLabel && row.methodLabel !== 'Market pickup' ? row.methodLabel : null)
    || (markets.length === 1 ? markets[0].name : null)
  const typeLabel = row.deliveryKind === 'vienna'
    ? 'Vienna'
    : marketName ? `Pickup at ${marketName}` : 'Market pickup'
  const timeLabel = row.timeLabel
    ?? (row.pickupHour != null ? formatHour(row.pickupHour) : row.deliveryKind === 'vienna' ? '18:00–20:00' : null)
  const status = row.handedOver ? 'delivered' : row.productionStatus
  const handoff = [typeLabel, timeLabel].filter(Boolean).join(' · ')
  const hasThumb = Boolean((row.photoUrl && !photoFailed) || row.color)

  return (
    <button
      type="button"
      className={styles.deliveryCard}
      data-thumbnail={hasThumb}
      onClick={() => navigate(`/staff/orders/${row.orderId}`, { state: { from } })}
    >
      {row.photoUrl && !photoFailed ? (
        <img className={styles.deliveryPhoto} src={row.photoUrl} alt="" width={48} height={48} onError={() => setPhotoFailed(true)} />
      ) : row.color ? (
        <span className={styles.deliveryThumb} style={{ background: `var(--ornament-${row.color})` }} role="img" aria-label={`${row.color} ornament`} />
      ) : null}
      <span className={styles.cardText}>
        <strong>{row.orderCode}</strong>
        <StatusTag status={status} />
        {row.customerName && <span className={styles.customerName}>{row.customerName}</span>}
        <span className={styles.handoff}><StaffText>{handoff}</StaffText></span>
      </span>
    </button>
  )
}

export function AgendaPage() {
  const { activeMarket } = useStaffMarket()
  const [pickupFilter, setPickupFilter] = useState<{ key: string; marketId: string }>()
  const [expandedAwayKey, setExpandedAwayKey] = useState<string | null>(null)
  const version = useStaffRefresh()
  const { hour: nowHour, date: clockDate } = useStaffClock()
  // The board is laid out in px, so the hour height follows the text size (5rem at 16px is the 80px token); at 200% text an hour doubles.
  const [{ HOUR_H, REM }] = useState(() => {
    const css = getComputedStyle(document.documentElement)
    const rem = Number.parseFloat(css.fontSize) || 16
    return { HOUR_H: Math.max(Number.parseFloat(css.getPropertyValue('--size-agenda-hour')), 5 * rem), REM: rem }
  })
  const [paintingEditor, setPaintingEditor] = useState(false)
  const [paintingRule, setPaintingRule] = useState<PaintingDay | null>(null)
  const [paintingError, setPaintingError] = useState('')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const placeItem = params.get('place')
  const dateParam = params.get('date')
  const blockParam = params.get('block')
  const [days, setDays] = useState<AgendaDay[]>([])
  const [date, setDate] = useState('')
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const suppressClick = useRef(false)
  const [preview, setPreviewState] = useState<DragPreview | null>(null)
  const previewRef = useRef<DragPreview | null>(null)
  const setPreview = (next: DragPreview | null) => {
    previewRef.current = next
    setPreviewState(next)
  }
  const [moveProposal, setMoveProposal] = useState<MoveProposal | null>(null)
  const [newProposal, setNewProposal] = useState<{ start: number; end: number } | null>(null)
  const pending = useRef<PendingDrag | null>(null)
  const [moveError, setMoveError] = useState('')
  const [moving, setMoving] = useState(false)
  const [makeRoomResult, setMakeRoomResult] = useState<MakeRoomDialogMove[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const currentDay = days.find(row => row.marketDay.isToday)?.marketDay.date ?? clockDate

  useEffect(() => {
    let active = true
    api.agenda.listDays().then((list) => {
      if (!active) return
      setDays(list)
      const today = list.find((d) => d.marketDay.isToday) ?? list[0]
      setDate(current => [dateParam, current, today?.marketDay.date].find(candidate => list.some(day => day.marketDay.date === candidate)) || '')
      setLoadError('')
    }).catch((err: Error) => { if (active) setLoadError(err.message) })
    return () => { active = false }
  }, [version, dateParam, retry])

  useEffect(() => {
    if (blockParam) setSelectedBlockId(blockParam)
  }, [blockParam])

  function setAgendaDate(next: string) {
    clearPending()
    drag.current = null
    suppressClick.current = false
    setDraggingBlockId(null)
    setPreview(null)
    setDate(next)
    setPaintingEditor(false)
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
    api.paintingDays.list(date, date).then(rows => {
      if (!active) return
      const row = rows.find(entry => entry.date === date) ?? null
      setPaintingRule(row ? { ...row, maxPaintings: maxPaintingsFromHours(row.openHour, row.closeHour) } : null)
      setPaintingError('')
    }).catch(() => { if (active) { setPaintingRule(null); setPaintingError('Could not load painting capacity.') } })
    return () => { active = false }
  }, [date, version, retry])

  const day = days.find((d) => d.marketDay.date === date) ?? days[0]
  const rule = paintingRule?.date === date ? paintingRule : null
  const markets = day ? dayMarkets(day) : []
  const activeMarketId = activeMarket?.id ?? rememberedMarketId()
  const stallToday = markets.find(market => market.id === activeMarketId)
  const explicitPaintId = (rule && rule.paintingMarketId !== undefined ? rule.paintingMarketId : day?.paintingMarketId) ?? null
  const explicitPaintName = (rule && rule.paintingMarketName !== undefined ? rule.paintingMarketName : day?.paintingMarketName) ?? null
  const paintsAtMarket = day
    ? (explicitPaintId
        ? (markets.find(market => market.id === explicitPaintId) ?? (explicitPaintName ? { id: explicitPaintId, name: explicitPaintName } : null))
        : (day.market.kind === 'market' ? day.market : null))
    : null
  const gabyAway = Boolean(markets.length > 1 && stallToday && paintsAtMarket && paintsAtMarket.id !== stallToday.id)
  const awayKey = `${day?.marketDay.date ?? ''}:${stallToday?.id ?? ''}:${paintsAtMarket?.id ?? ''}`
  const awayExpanded = gabyAway && expandedAwayKey === awayKey
  const effectiveMax = rule ? maxPaintingsFromHours(rule.openHour, rule.closeHour) : null
  const paintOpen = rule?.openHour ?? day?.marketDay.openHour ?? 0
  const paintClose = rule?.closeHour ?? day?.marketDay.closeHour ?? 0
  const slots = day?.slots ?? []
  const completedThrough = day?.marketDay.isToday ? nowHour : date > currentDay ? 0 : Infinity
  const isPaintedTrace = (slot: AgendaSlot) => !slot.held && slot.block.status === 'finished' && slot.block.endHour > completedThrough
  const paintedTraces = slots.filter(isPaintedTrace)
  const boardSlots = slots.filter(slot => !isPaintedTrace(slot))
  const slotLayout = layoutAgendaSlots(boardSlots)
  const { start: boardStart, end: boardEnd } = agendaBounds(boardSlots, paintOpen, paintClose)
  const hours = useMemo(() => {
    const out: number[] = []
    for (let h = boardStart; h < boardEnd; h += 1) out.push(h)
    return out
  }, [boardStart, boardEnd])

  const elapsedUntil = paintElapsedUntil(date, currentDay, nowHour)
  const paintRanges = slots.flatMap(slot => bookedPaintRange(slot.block, slot.held ? Infinity : elapsedUntil) ?? [])
  const marketDays = useMemo(() => days.flatMap(row =>
    [row.marketDay, ...(row.marketDays ?? []).filter(day => day.id !== row.marketDay.id)]), [days])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const blockScroll = (event: TouchEvent) => {
      // A quick swipe still scrolls. Only a recognised hold owns vertical movement.
      if (drag.current && event.cancelable) event.preventDefault()
    }
    grid.addEventListener('touchmove', blockScroll, { passive: false })
    return () => grid.removeEventListener('touchmove', blockScroll)
  }, [loadError, day?.marketDay.id, gabyAway, awayExpanded])

  useEffect(() => () => {
    window.clearTimeout(pending.current?.timer)
  }, [])

  function pointHour(clientY: number) {
    const top = gridRef.current?.getBoundingClientRect().top ?? 0
    return yToHour(clientY - top, HOUR_H, boardStart)
  }

  function timeProblem(start: number, end: number, movingSlot?: AgendaSlot) {
    if (!day) return 'No market day.'
    if (rule && !rule.open) return 'Painting is closed on this day.'
    if (rule && effectiveMax !== null && rule.booked + (movingSlot ? 0 : 1) > effectiveMax) return 'Daily painting limit reached.'
    if (start < paintOpen || end > paintClose || !(end > start)) return 'Choose a time within painting hours.'
    if ((currentDay && date < currentDay) || (day.marketDay.isToday && start < nowHour)) return 'That time has already passed.'
    if (hasPaintOverlap(paintRanges, start, end, movingSlot?.block.id)) return 'That time overlaps another session.'
    const item = movingSlot?.item
    if (!item) return null
    const { delivery } = item
    const handoffDate = marketDays.find(row => row.id === delivery.marketDayId)?.date ?? delivery.deliveryDate
    if (!handoffDate || date > handoffDate ||
      ((delivery.kind === 'vienna' || delivery.kind === 'post') && date === handoffDate) ||
      (date === handoffDate && delivery.pickupHour != null && end > delivery.pickupHour)) {
      return `This session must stay before ${handoffLabel(item, marketDays)}.`
    }
    return null
  }

  function clearPending() {
    window.clearTimeout(pending.current?.timer)
    pending.current = null
  }

  function updatePreview(active: DragState, hour: number, initial = false) {
    if (active.kind === 'new') {
      const target = Math.min(paintClose, Math.max(paintOpen, hour))
      const start = Math.min(active.startHour, target)
      const end = Math.min(paintClose, initial || target === active.startHour
        ? start + 1 : Math.max(start + 0.5, active.startHour, target))
      setPreview({ start, end, problem: timeProblem(start, end) })
      return
    }
    const slot = boardSlots.find(row => row.block.id === active.blockId)
    if (!slot) return
    const start = initial ? active.originalStart : Math.round((hour - active.grabOffset) * 4) / 4
    const end = start + active.duration
    setPreview({ start, end, problem: timeProblem(start, end, slot) })
  }

  function beginDrag(active: DragState, grid: HTMLDivElement, hour: number, initial = false) {
    clearPending()
    drag.current = active
    if (active.kind === 'move') {
      suppressClick.current = true
      setDraggingBlockId(active.blockId)
    }
    setNewProposal(null)
    setMoveError('')
    updatePreview(active, hour, initial)
    capturePointer(grid, active.pointerId)
  }

  // Always invoke the latest render's beginDrag from the hold timer so clock ticks or refreshes never leave stale state.
  const beginDragRef = useRef(beginDrag)
  useEffect(() => {
    beginDragRef.current = beginDrag
  })

  function proposeDefault() {
    if (gabyAway) return
    const earliest = day.marketDay.isToday ? Math.max(nowHour, paintOpen) : paintOpen
    for (let start = Math.ceil(earliest * 4) / 4; start + 1 <= paintClose; start += 0.25) {
      if (timeProblem(start, start + 1)) continue
      setMoveError('')
      setNewProposal({ start, end: start + 1 })
      return
    }
    setMoveError(timeProblem(earliest, earliest + 1) ?? 'No free hour on this day.')
  }

  function openMoveDialog(slot: AgendaSlot) {
    if (gabyAway || placeItem || !canMove(slot)) return
    setMoveError('')
    setMoveProposal({ slot, startHour: slot.block.startHour, endHour: slot.block.endHour })
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (gabyAway || !e.isPrimary || e.button !== 0 || drag.current || pending.current) return
    suppressClick.current = false
    if ((e.target as Element).closest('[data-slot-move], [data-slot-make-room]')) return
    const grid = e.currentTarget
    const slotElement = (e.target as Element).closest<HTMLElement>('[data-slot-id]')
    const slot = slotElement && boardSlots.find(row => row.block.id === slotElement.dataset.slotId)
    const hour = pointHour(e.clientY)
    let next: DragState
    if (slotElement) {
      if (placeItem || !slot || !canMove(slot)) return
      next = {
        kind: 'move', pointerId: e.pointerId, blockId: slot.block.id,
        originalStart: slot.block.startHour, duration: slot.block.endHour - slot.block.startHour,
        grabOffset: hour - slot.block.startHour,
      }
    } else {
      if (hour < paintOpen || hour >= paintClose) return
      next = { kind: 'new', pointerId: e.pointerId, startHour: hour }
    }

    if (e.pointerType === 'mouse' && next.kind === 'new') {
      e.preventDefault()
      beginDrag(next, grid, hour, true)
      return
    }
    const timer = e.pointerType === 'mouse'
      ? undefined
      : window.setTimeout(() => beginDragRef.current(next, grid, hour, true), HOLD_MS)
    pending.current = { drag: next, x: e.clientX, y: e.clientY, timer }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const hold = pending.current
    if (hold?.drag.pointerId === e.pointerId && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP_PX) {
      if (hold.timer !== undefined) clearPending()
      else beginDrag(hold.drag, e.currentTarget, pointHour(e.clientY))
      return
    }
    if (drag.current?.pointerId === e.pointerId) updatePreview(drag.current, pointHour(e.clientY))
  }

  function finishDrag(active: DragState, { start, end, problem }: DragPreview) {
    if (active.kind === 'move' && start === active.originalStart) return
    if (problem) {
      setMoveError(problem)
      return
    }
    if (active.kind === 'new') {
      setNewProposal({ start, end })
    } else {
      const slot = boardSlots.find(row => row.block.id === active.blockId)
      if (slot) setMoveProposal({ slot, startHour: start, endHour: end })
    }
  }

  function startSaleFromProposal() {
    if (!newProposal || !day) return
    const { start, end } = newProposal
    const problem = timeProblem(start, end)
    if (problem || !Number.isInteger(start * 4) || !Number.isInteger(end * 4)) { setMoveError(problem ?? 'Choose times in 15-minute steps.'); return }
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
    const hold = pending.current
    if (hold?.drag.pointerId === e.pointerId) {
      clearPending()
      if (placeItem && hold.drag.kind === 'new') {
        const start = hold.drag.startHour
        const end = Math.min(start + 1, paintClose)
        finishDrag(hold.drag, { start, end, problem: timeProblem(start, end) })
      }
    }
    const active = drag.current
    if (active?.pointerId !== e.pointerId) return
    const finalPreview = previewRef.current
    drag.current = null
    setDraggingBlockId(null)
    setPreview(null)
    const { left, right, top, bottom } = e.currentTarget.getBoundingClientRect()
    if (finalPreview && e.clientX >= left && e.clientX <= right && e.clientY >= top && e.clientY <= bottom) {
      finishDrag(active, finalPreview)
    }
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (pending.current?.drag.pointerId === e.pointerId) clearPending()
    if (drag.current?.pointerId !== e.pointerId) return
    drag.current = null
    setDraggingBlockId(null)
    setPreview(null)
  }

  function openOrder(slot: AgendaSlot) {
    if (placeItem) return
    if (!slot.order) return
    setSelectedBlockId(slot.block.id)
    const backQuery = new URLSearchParams(params)
    backQuery.set('date', day.marketDay.date)
    backQuery.set('block', slot.block.id)
    navigate(`/staff/orders/${slot.order.id}`, { state: { from: `/staff/agenda?${backQuery}`, itemId: slot.item?.id } })
  }

  async function runMakeRoomForBlock(slot: AgendaSlot) {
    if (moving || !slot.item) return
    setMoving(true)
    setMoveError('')
    try {
      const result = await api.agenda.makeRoomForBlock(slot.item.id)
      const slotIndex = new Map(days.flatMap(d => d.slots).filter(s => s.item).map(s => [s.item!.id, s]))
      const rows: MakeRoomDialogMove[] = result.moved.map(move => {
        const match = slotIndex.get(move.itemId) ?? (slot.item?.id === move.itemId ? slot : undefined)
        return {
          ...move,
          photoUrl: match?.photoUrl ?? null,
          color: match?.item?.color ?? null,
        }
      })
      setMoveProposal(null)
      setMakeRoomResult(rows)
      setRetry(value => value + 1)
    } catch (err) {
      setMoveError(makeRoomBlockError(err))
    } finally {
      setMoving(false)
    }
  }

  async function confirmMove() {
    if (!moveProposal) return
    if (moveProposal.startHour === moveProposal.slot.block.startHour) {
      setMoveError('Choose a different start time.')
      return
    }
    const problem = timeProblem(moveProposal.startHour, moveProposal.endHour, moveProposal.slot)
    if (problem || !Number.isInteger(moveProposal.startHour * 4)) {
      setMoveError(problem ?? 'Choose times in 15-minute steps.')
      return
    }
    setMoving(true)
    setMoveError('')
    try {
      await api.agenda.moveBlock(moveProposal.slot.block.id, day.marketDay.date, moveProposal.startHour)
      setSelectedBlockId(moveProposal.slot.block.id)
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

  const height = (boardEnd - boardStart) * HOUR_H
  const shownPreview = preview ?? (newProposal ? { ...newProposal, problem: null } : null)
  const proposalMinutes = newProposal ? Math.round((newProposal.end - newProposal.start) * 60) : 0
  const deliveries = day.deliveries ?? []
  const pickupKey = `${day.marketDay.date}:${activeMarketId ?? ''}`
  const pickupMarket = pickupFilter?.key === pickupKey && markets.some(market => market.id === pickupFilter.marketId)
    ? pickupFilter.marketId : stallToday?.id ?? markets[0]?.id
  const marketDeliveries = deliveries.filter(row => row.deliveryKind === 'market'
    && (markets.length <= 1 || !row.marketId || row.marketId === pickupMarket))
  const postDeliveries = deliveries.filter((row) => row.deliveryKind === 'post')
  const postParcelCount = new Set(postDeliveries.map(row => row.orderId)).size
  const postStatus: ProductionStatus | 'shipped' = postDeliveries.length > 0 && postDeliveries.every(row => row.handedOver)
    ? 'shipped'
    : postDeliveries.every(row => row.productionStatus === 'finished')
      ? 'finished'
      : postDeliveries.some(row => row.productionStatus !== 'not_started')
        ? 'in_progress'
        : 'not_started'
  const viennaDeliveries = deliveries.filter((row) => row.deliveryKind === 'vienna')
  const allDeliveries = [...marketDeliveries, ...viennaDeliveries]
  const hasAnyDeliveries = allDeliveries.length > 0 || postParcelCount > 0
  const capacitySummary = rule ? agendaCapacitySummary(rule) : null
  const automaticMarket = !day.paintingMarketId && day.market.kind === 'market' ? day.market.name : undefined
  const dayOptions = days.map(row => ({
    value: row.marketDay.date,
    label: dayChipLabel(row),
    markets: dayMarkets(row).map(market => market.name).join(' · ') || undefined,
  }))

  return (
    <section style={{ '--hour-h': `${HOUR_H}px` } as CSSProperties}>
      <div className={styles.head}>
        <h1>Agenda</h1>
        <Button tone="staff" variant="secondary" className={styles.settings} aria-label={`Painting hours for ${formatDateLabel(day.marketDay.date)}`} onClick={() => setPaintingEditor(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg>
        </Button>
      </div>

      <DayStrip
        days={dayOptions}
        today={currentDay}
        value={date}
        onChange={setAgendaDate}
      />

      {paintingError && <div role="alert"><p>{paintingError}</p><Button tone="staff" variant="secondary" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>}
      <LostSaves onSaved={() => setRetry(value => value + 1)} />
      {rule && effectiveMax !== null && rule.booked > (rule.open ? effectiveMax : 0) && <p className={styles.capacityWarning} role="status">Over painting limit. Review painting hours.</p>}
      {paintingEditor && <StaffDialog title={`Painting hours · ${formatDateLabel(day.marketDay.date)}`} onClose={() => { setPaintingEditor(false); setRetry(value => value + 1) }}>
        {rule ? <div className={styles.paintSettings}>
          <DayRow key={`day-${rule.date}-${rule.paintingMarketId ?? ''}`} day={rule} showDate={false} formatCapacity={agendaCapacitySummary} onSaved={saved => { setPaintingRule(saved); setRetry(value => value + 1) }} />
          {markets.length > 0 && <PaintingMarketField key={`market-${rule.date}`} day={rule} markets={markets} automaticMarket={automaticMarket}
            onSaved={saved => { setPaintingRule(saved); setRetry(value => value + 1) }} />}
        </div> : paintingError ? <div role="alert"><p>{paintingError}</p><Button tone="staff" onClick={() => setRetry(value => value + 1)}>Retry</Button></div> : <p role="status">Loading painting hours…</p>}
      </StaffDialog>}

      {(!gabyAway || hasAnyDeliveries) && (
        <div className={styles.toolbar}>
          {!gabyAway && (
            <p className={styles.createHint}>
              {placeItem ? 'Hold and drag to choose a time.' : <StaffText>Hold a session to move · Hold free time for a new sale.</StaffText>}
            </p>
          )}
          {hasAnyDeliveries && <a href="#agenda-pickups" className={styles.jump}>
            {marketDeliveries.length
              ? `${marketDeliveries.length} ${marketDeliveries.length === 1 ? 'pickup' : 'pickups'}`
              : postParcelCount
                ? `${postParcelCount} Post ${postParcelCount === 1 ? 'parcel' : 'parcels'}`
                : `${viennaDeliveries.length} ${viennaDeliveries.length === 1 ? 'delivery' : 'deliveries'}`} ↓
          </a>}
        </div>
      )}

      {moveError && !moveProposal ? <p className={styles.moveError} role="alert">{moveError}</p> : null}
      {makeRoomResult ? (
        <MakeRoomDialog
          moved={makeRoomResult}
          todayDate={currentDay}
          onClose={() => setMakeRoomResult(null)}
        />
      ) : null}

      {moveProposal ? (
        <StaffDialog title="Confirm schedule change" busy={moving} onClose={() => { setMoveProposal(null); setMoveError('') }}>
          <div>
            <strong>Move {moveProposal.slot.order?.code || 'session'}?</strong>
            <p>
              {formatHour(moveProposal.slot.block.startHour)}–{formatHour(moveProposal.slot.block.endHour)}
              <span aria-hidden="true"> → </span>
              <strong>{formatHour(moveProposal.startHour)}–{formatHour(moveProposal.endHour)}</strong>
            </p>
            {moveProposal.slot.item && <small><StaffText>{handoffLabel(moveProposal.slot.item, marketDays)}</StaffText></small>}
          </div>
          <Field label="New start time" htmlFor="move-start">
            <input
              id="move-start"
              type="time"
              step="900"
              value={formatHour(moveProposal.startHour)}
              onChange={event => {
                const nextStart = parseHour(event.target.value)
                const duration = moveProposal.slot.block.endHour - moveProposal.slot.block.startHour
                setMoveError('')
                setMoveProposal({ ...moveProposal, startHour: nextStart, endHour: nextStart + duration })
              }}
            />
          </Field>
          {moveError ? <p role="alert">{moveError}</p> : null}
          <div className={styles.moveActions}>
            <Button tone="staff" size="lg" onClick={confirmMove} disabled={moving}>
              {moving ? 'Saving…' : 'Save move'}
            </Button>
            {moveProposal.slot.item && (
              <Button tone="staff" variant="secondary" size="lg" onClick={() => void runMakeRoomForBlock(moveProposal.slot)} disabled={moving}>
                Make room
              </Button>
            )}
          </div>
        </StaffDialog>
      ) : null}

      {[...slotLayout.values()].some(layout => layout.lanes > 1) && <p className={styles.moveError} role="status">Overlapping sessions are shown side by side. Review the schedule.</p>}
      <div className={styles.workspace}>
        <section className={styles.calendarSection} aria-labelledby="agenda-paint-heading">
          <div className={styles.sectionHead}>
            <h2 id="agenda-paint-heading">Paint sessions</h2>
            {!gabyAway && capacitySummary && <p className={styles.capacityMeta}><StaffText>{capacitySummary}</StaffText></p>}
          </div>
          {gabyAway && paintsAtMarket ? (
            <div className={styles.awayCard} data-gaby-away="true">
              <div className={styles.awayBody}>
                <p className={styles.awayTitle}>{`Gaby is painting at ${paintsAtMarket.name} this day.`}</p>
                {capacitySummary && <p className={styles.awayCount}><StaffText>{capacitySummary}</StaffText></p>}
              </div>
              <button
                type="button"
                className={styles.textBtn}
                aria-expanded={awayExpanded}
                onClick={() => setExpandedAwayKey(awayExpanded ? null : awayKey)}
              >
                {awayExpanded ? 'Hide sessions' : 'Show sessions'}
              </button>
            </div>
          ) : null}
          {(!gabyAway || awayExpanded) ? (
            <>
              {paintedTraces.length > 0 && <ul className={styles.traces} aria-label="Painted sessions">
                {paintedTraces.map(slot => (
                  <li key={slot.block.id}>
                    <button type="button" className={styles.trace} onClick={() => openOrder(slot)} disabled={Boolean(placeItem)}
                      aria-label={`${slot.order?.code ?? 'Session'} painted, recorded at ${formatHour(slot.block.startHour)}`}>
                      <span aria-hidden="true">✓</span> {slot.order?.code ?? 'Session'} painted
                      <span className={styles.traceTime}>{formatHour(slot.block.startHour)}</span>
                    </button>
                  </li>
                ))}
              </ul>}
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
                  data-calendar="true"
                  data-readonly={gabyAway ? 'true' : undefined}
                  className={styles.grid}
                  style={{ height }}
                  data-dragging={preview ? 'true' : 'false'}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                  onLostPointerCapture={event => { if (event.target === event.currentTarget) onPointerCancel(event) }}
                  onPointerLeave={event => { if (event.pointerType === 'mouse' && pending.current?.drag.pointerId === event.pointerId) clearPending() }}
                  onContextMenu={event => event.preventDefault()}
                >
                  {!gabyAway && (
                    <button type="button" className={styles.calendarTarget} aria-label="Choose a painting time"
                      onClick={proposeDefault} />
                  )}
                  {hours.map((h) => (
                    <div key={h} className={styles.gridline} />
                  ))}
                  {day.marketDay.isToday && nowHour >= paintOpen && nowHour <= paintClose ? (
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
                      className={shownPreview.problem ? styles.previewBad : styles.preview}
                      style={{
                        top: hourToY(shownPreview.start, HOUR_H, boardStart),
                        height: Math.max(8, (shownPreview.end - shownPreview.start) * HOUR_H),
                      }}
                    >
                      {!shownPreview.problem ? <span>{formatHour(shownPreview.start)}–{formatHour(shownPreview.end)}</span> : null}
                    </div>
                  ) : null}
                  {boardSlots.map((slot) => {
                    const title = slot.held ? 'Held by web checkout' : slot.order?.code || (slot.item?.kind === 'custom' ? 'Custom ornament' : 'Paint session')
                    const range = `${formatHour(slot.block.startHour)}–${formatHour(slot.block.endHour)}`
                    const handoffShort = !slot.held && slot.item ? compactHandoff(slot.item, marketDays) : null
                    const status = (slot.item?.handedOver ?? slot.order?.handedOver) ? 'delivered' : slot.block.status
                    const customer = slot.held ? null : slot.customer?.name
                    const height = (slot.block.endHour - slot.block.startHour) * HOUR_H
                    const density = height >= 4.75 * REM ? 'full' : height >= 3.5 * REM ? 'compact' : 'short'
                    const slotHeight = density === 'short' ? height : height - 4
                    const movable = !gabyAway && !placeItem && canMove(slot)
                    const roomMovable = !gabyAway && !placeItem && isMakeRoomMovable(slot, day.marketDay.date, marketDays)
                    const { lane = 0, lanes = 1 } = slotLayout.get(slot.block.id) ?? {}
                    const slotLeft = `${100 * lane / lanes}%`
                    const slotRight = `${100 * (lanes - lane - 1) / lanes}%`
                    const slotTop = hourToY(slot.block.startHour, HOUR_H, boardStart)
                    const holdUntil = slot.held && slot.holdUntil
                      ? `Held until ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' }).format(new Date(slot.holdUntil))}`
                      : null
                    return (
                      <Fragment key={slot.block.id}>
                        <button
                          type="button"
                          className={styles.slot}
                          data-slot="true"
                          data-held={slot.held || undefined}
                          disabled={slot.held}
                          data-slot-id={slot.block.id}
                          data-movable={movable}
                          data-make-room={roomMovable ? 'true' : undefined}
                          data-moving={draggingBlockId === slot.block.id ? 'true' : undefined}
                          data-density={density}
                          data-selected={selectedBlockId === slot.block.id ? 'true' : 'false'}
                          aria-pressed={selectedBlockId === slot.block.id}
                          aria-label={[title, customer, handoffShort, `paint ${range}`, slot.held ? holdUntil : STATUS_LABELS[status]].filter(Boolean).join(', ')}
                          style={{
                            left: slotLeft,
                            width: `calc(${100 / lanes}% - var(--space-2))`,
                            top: slotTop,
                            height: slotHeight,
                          }}
                          onClick={event => {
                            const wasDragged = suppressClick.current && event.detail > 0
                            suppressClick.current = false
                            if (!wasDragged) openOrder(slot)
                          }}
                        >
                          {!slot.held && density !== 'short' && <SlotThumbnail key={slot.photoUrl} slot={slot} slotHeight={slotHeight} />}
                          <span className={styles.cardText}>
                            <strong>{title}</strong>
                            {slot.held ? (
                              density !== 'short' && holdUntil && <span className={styles.handoff}>{holdUntil}</span>
                            ) : (
                              <>
                                <StatusTag status={status} />
                                {density === 'full' && customer && <span className={styles.customerName}>{customer}</span>}
                                {density !== 'short' && handoffShort && <span className={styles.handoff}>{handoffShort}</span>}
                              </>
                            )}
                          </span>
                        </button>
                        {movable && (
                          <button
                            type="button"
                            className={styles.slotMove}
                            data-slot-move="true"
                            aria-label={`Move ${title}`}
                            style={{ left: slotLeft, top: slotTop }}
                            onClick={() => openMoveDialog(slot)}
                          >
                            Move
                          </button>
                        )}
                        {roomMovable && (
                          <button
                            type="button"
                            className={styles.slotMakeRoom}
                            data-slot-make-room="true"
                            disabled={moving}
                            aria-label={`Make room · ${title}`}
                            style={{ right: `calc(${slotRight} + var(--space-3))`, top: slotTop + Math.max(0, Math.round((slotHeight - 44) / 2)) }}
                            onClick={() => void runMakeRoomForBlock(slot)}
                          >
                            Make room
                          </button>
                        )}
                      </Fragment>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}
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
                <Button tone="staff" size="lg" onClick={startSaleFromProposal}>
                  {placeItem ? 'Use this time' : 'Start sale'}
                </Button>
              </div>
            </StaffDialog>
          ) : null}
        </section>

        <aside className={styles.side} id="agenda-pickups">
          <div className={styles.sideHead}>
            <h2>Pickups and deliveries</h2>
          </div>
          {markets.length > 1 && <Field label="Pickup market" htmlFor="agenda-pickup-market">
            <select id="agenda-pickup-market" value={pickupMarket} onChange={event => setPickupFilter({ key: pickupKey, marketId: event.target.value })}>
              {markets.map(market => <option key={market.id} value={market.id}>{market.name}</option>)}
            </select>
          </Field>}
          {!hasAnyDeliveries ? (
            <p className={styles.sideMeta}>No deliveries for this day.</p>
          ) : (
            <div className={styles.deliveryList}>
              {postParcelCount > 0 ? (
                <button
                  type="button"
                  className={styles.deliveryCard}
                  data-thumbnail="false"
                  onClick={() => navigate(`/staff/deliveries?${new URLSearchParams({ day: day.marketDay.date, kind: 'post' })}`)}
                >
                  <span className={styles.cardText}>
                    <strong><StaffText>{`Post · ${formatStaffShortDate(day.marketDay.date)}`}</StaffText></strong>
                    <StatusTag status={postStatus} />
                    <span className={styles.handoff}>{`${postParcelCount} ${postParcelCount === 1 ? 'parcel' : 'parcels'}`}</span>
                  </span>
                </button>
              ) : null}
              {allDeliveries.map((row) => (
                <AgendaDeliveryCard
                  key={`${row.orderId}-${row.itemId}`}
                  row={row}
                  markets={markets}
                  from={`/staff/agenda?${new URLSearchParams({ date: day.marketDay.date })}`}
                />
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
