import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useMockStoreVersion } from '../../api/mock/useMockStore'
import { DEMO_NOW_HOUR } from '../../api/mock/seed'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { AgendaDay, AgendaSlot, ProductionStatus } from '../../domain/types'
import { hasPaintOverlap, keepNonOverlapping } from '../../lib/slots'
import { formatDateLabel, formatHour, hourToY, yToHour } from '../../lib/time'
import styles from './AgendaPage.module.css'

const HOUR_H = 56

function prodLabel(status: ProductionStatus): string {
  if (status === 'in_progress') return 'Started'
  if (status === 'finished') return 'Finished'
  return 'Not started'
}

function dayChipLabel(day: AgendaDay): string {
  if (day.marketDay.isToday) return 'Today'
  const [y, m, d] = day.marketDay.date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function slotRange(slot: AgendaSlot) {
  return { id: slot.block.id, startHour: slot.block.startHour, endHour: slot.block.endHour }
}

export function AgendaPage() {
  const version = useMockStoreVersion()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const placeItem = params.get('place')
  const [days, setDays] = useState<AgendaDay[]>([])
  const [date, setDate] = useState('')
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startHour: number } | null>(null)
  const [preview, setPreview] = useState<{ start: number; end: number; invalid?: boolean } | null>(null)

  useEffect(() => {
    api.agenda.listDays().then((list) => {
      setDays(list)
      const today = list.find((d) => d.marketDay.isToday) ?? list[0]
      setDate((current) => current || today.marketDay.date)
    })
  }, [version])

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

  function go(delta: number) {
    const i = days.findIndex((d) => d.marketDay.date === date)
    const next = days[i + delta]
    if (next) setDate(next.marketDay.date)
  }

  function clampHour(h: number) {
    if (!day) return h
    return Math.min(day.marketDay.closeHour, Math.max(day.marketDay.openHour, h))
  }

  function hourFromEvent(e: ReactPointerEvent) {
    if (!day || !gridRef.current) return day?.marketDay.openHour ?? 12
    const rect = gridRef.current.getBoundingClientRect()
    return clampHour(yToHour(e.clientY - rect.top, HOUR_H, day.marketDay.openHour))
  }

  function previewFrom(startHour: number, endHour: number) {
    if (!day) return { start: startHour, end: endHour, invalid: true }
    const start = Math.min(startHour, endHour)
    const end = Math.max(start + 0.5, Math.max(startHour, endHour))
    const clampedStart = Math.max(start, day.marketDay.openHour)
    const clampedEnd = Math.min(end, day.marketDay.closeHour)
    return {
      start: clampedStart,
      end: clampedEnd,
      invalid: clampedEnd - clampedStart < 0.4 || hasPaintOverlap(paintRanges, clampedStart, clampedEnd),
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-slot]')) return
    if (!day) return
    e.preventDefault()
    const start = hourFromEvent(e)
    drag.current = { pointerId: e.pointerId, startHour: start }
    setPreview(previewFrom(start, Math.min(start + 1, day.marketDay.closeHour)))
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== e.pointerId || !day) return
    setPreview(previewFrom(drag.current.startHour, hourFromEvent(e)))
  }

  function commitDrag() {
    if (!drag.current || !preview || !day) {
      drag.current = null
      setPreview(null)
      return
    }
    let { start, end } = preview
    if (end - start < 0.4) end = Math.min(start + 1, day.marketDay.closeHour)
    drag.current = null
    setPreview(null)
    if (end - start < 0.4 || hasPaintOverlap(paintRanges, start, end)) return
    const q = new URLSearchParams({
      kind: 'custom',
      date: day.marketDay.date,
      start: String(start),
      end: String(end),
    })
    if (placeItem) q.set('placeItem', placeItem)
    navigate(`/staff/sales/new?${q.toString()}`)
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return
    commitDrag()
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return
    drag.current = null
    setPreview(null)
  }

  function openOrder(slot: AgendaSlot) {
    if (!slot.order) return
    setSelectedBlockId(slot.block.id)
    navigate(`/staff/orders/${slot.order.id}`)
  }

  if (!day) return <p>Loading agenda…</p>

  const height = (day.marketDay.closeHour - day.marketDay.openHour) * HOUR_H
  const deliveries = day.deliveries ?? []
  const marketDeliveries = deliveries.filter((row) => row.deliveryKind === 'market')
  const viennaDeliveries = deliveries.filter((row) => row.deliveryKind === 'vienna')
  const todaySelected = Boolean(days.find((d) => d.marketDay.isToday && d.marketDay.date === date))
  const dayOptions = days.map((row) => {
    const label = dayChipLabel(row)
    return { value: row.marketDay.date, label, selectedLabel: `Current: ${label}` }
  })

  return (
    <section>
      <div className={styles.head}>
        <div>
          <h1>Agenda</h1>
          <p>
            {day.market.name} · {formatDateLabel(day.marketDay.date)}
          </p>
        </div>
        <div className={styles.nav}>
          <Button tone="staff" variant="ghost" onClick={() => go(-1)}>
            Previous
          </Button>
          <Button
            tone="staff"
            variant="secondary"
            selected={todaySelected}
            onClick={() => {
              const today = days.find((d) => d.marketDay.isToday)
              if (today) setDate(today.marketDay.date)
            }}
          >
            {todaySelected ? 'Current: Today' : 'Today'}
          </Button>
          <Button tone="staff" variant="ghost" onClick={() => go(1)}>
            Next
          </Button>
          <Button tone="staff" onClick={() => navigate('/staff/sales/new')}>
            New sale
          </Button>
        </div>
      </div>

      <div className={styles.chips}>
        <SegmentedControl
          legend="Day"
          name="agenda-day"
          value={date}
          onChange={setDate}
          options={dayOptions}
        />
      </div>

      {placeItem ? (
        <p className={styles.banner} role="status">
          Drag an empty hour to place this custom ornament. Overlap is blocked.
        </p>
      ) : null}

      <div className={styles.workspace}>
        <div>
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
              {preview ? (
                <div
                  className={preview.invalid ? styles.previewBad : styles.preview}
                  style={{
                    top: hourToY(preview.start, HOUR_H, day.marketDay.openHour),
                    height: Math.max(8, (preview.end - preview.start) * HOUR_H),
                  }}
                />
              ) : null}
              {boardSlots.map((slot) => (
                <button
                  key={slot.block.id}
                  type="button"
                  className={styles.slot}
                  data-slot="true"
                  data-status={slot.block.status}
                  data-selected={selectedBlockId === slot.block.id ? 'true' : 'false'}
                  aria-pressed={selectedBlockId === slot.block.id}
                  style={{
                    top: hourToY(slot.block.startHour, HOUR_H, day.marketDay.openHour),
                    height: (slot.block.endHour - slot.block.startHour) * HOUR_H - 4,
                  }}
                  onClick={() => openOrder(slot)}
                >
                  <strong>{slot.item?.petName || slot.customer?.name || 'Block'}</strong>
                  <div>
                    {formatHour(slot.block.startHour)}–{formatHour(slot.block.endHour)}
                    {slot.order ? ` · ${slot.order.code}` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <p className={styles.hint}>
            Drag empty hours to start a custom sale with that slot. Tap a block to open the order.
          </p>
        </div>

        <aside className={styles.side}>
          <h2>Deliveries</h2>
          <p className={styles.sideMeta}>
            {formatDateLabel(day.marketDay.date)} · market pickup hour · Vienna Wed/Fri, no clock
          </p>
          {marketDeliveries.length === 0 && viennaDeliveries.length === 0 ? (
            <p className={styles.sideMeta}>No deliveries for this day.</p>
          ) : null}
          {marketDeliveries.map((row) => (
            <button
              key={`${row.orderId}-${row.itemId}`}
              type="button"
              className={styles.dlv}
              onClick={() => navigate(`/staff/orders/${row.orderId}`)}
            >
              {row.photoUrl ? (
                <img src={row.photoUrl} alt="" width={48} height={48} />
              ) : (
                <span className={styles.thumb} />
              )}
              <span className={styles.dlvBody}>
                <strong>
                  {row.orderCode} · {row.title}
                </strong>
                <span>{prodLabel(row.productionStatus)}</span>
              </span>
              <span className={styles.dlvAside}>
                <span>{row.methodLabel}</span>
                {row.timeLabel ? <span className={styles.dlvTime}>{row.timeLabel}</span> : null}
              </span>
            </button>
          ))}
          {viennaDeliveries.length ? (
            <>
              <h3 className={styles.homeTitle}>Vienna · Wed/Fri</h3>
              <p className={styles.sideMeta}>Day only · no exact clock</p>
              {viennaDeliveries.map((row) => (
                <button
                  key={`${row.orderId}-${row.itemId}`}
                  type="button"
                  className={styles.dlv}
                  onClick={() => navigate(`/staff/orders/${row.orderId}`)}
                >
                  {row.photoUrl ? (
                    <img src={row.photoUrl} alt="" width={48} height={48} />
                  ) : (
                    <span className={styles.thumb} />
                  )}
                  <span className={styles.dlvBody}>
                    <strong>
                      {row.orderCode} · {row.title}
                    </strong>
                    <span>{prodLabel(row.productionStatus)}</span>
                  </span>
                  <span className={styles.dlvAside}>
                    <span>{row.methodLabel}</span>
                  </span>
                </button>
              ))}
            </>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
