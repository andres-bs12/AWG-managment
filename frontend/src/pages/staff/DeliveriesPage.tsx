import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useHandover } from '../../components/staff/useHandover'
import { useStaffClock } from '../../lib/staffClock'
import { Button } from '../../components/ui/Button'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { dayChipLabel, DeliveryRow, prodLabel } from '../../components/staff/DeliveryRow'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { ViennaDeliveryCard } from '../../components/staff/ViennaDeliveryCard'
import type { AgendaDay, AgendaDelivery, DeliveryKind, ProductionStatus } from '../../domain/types'
import { formatDateLabel } from '../../lib/time'
import styles from './DeliveriesPage.module.css'


type DayFilter = 'all' | string
type StatusFilter = 'all' | ProductionStatus
type KindFilter = 'all' | DeliveryKind

type DatedDelivery = AgendaDelivery & { date: string; count?: number; ready?: number; members?: DatedDelivery[] }

type Section = {
  key: string
  title: string
  meta: string
  rows: DatedDelivery[]
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'Started' },
  { value: 'finished', label: 'Finished' },
]

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'market', label: 'Market' },
  { value: 'vienna', label: 'Vienna' },
]

function flattenDays(days: AgendaDay[]): DatedDelivery[] {
  return days.flatMap((day) =>
    day.deliveries.map((row) => ({
      ...row,
      date: day.marketDay.date,
    })),
  )
}

/** One row per order and handoff kind; names, readiness and the handover check cover every ornament. */
function groupOrders(rows: DatedDelivery[]): DatedDelivery[] {
  const groups = new Map<string, DatedDelivery[]>()
  for (const row of rows) {
    const key = `${row.orderId}|${row.deliveryKind}|${row.handedOver}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()].map(([first, ...rest]) => {
    if (!rest.length) return first
    const all = [first, ...rest]
    const ready = all.filter(row => row.productionStatus === 'finished').length
    const names = [...new Set(all.map(row => row.title).filter(Boolean))]
    const productionStatus: ProductionStatus = ready === all.length ? 'finished' : all.some(row => row.productionStatus !== 'not_started') ? 'in_progress' : 'not_started'
    return { ...first, title: `${names.join(', ')} · ${all.length} ornaments`, productionStatus, count: all.length, ready, members: all, color: undefined, finish: undefined, backName: undefined }
  })
}

function uniqueVienna(rows: DatedDelivery[]): DatedDelivery[] {
  const seen = new Set<string>()
  const out: DatedDelivery[] = []
  for (const row of rows) {
    if (row.deliveryKind !== 'vienna') continue
    // One row per ornament (the mock can list an undated item on several days); orders are grouped later.
    const id = row.itemId
    if (seen.has(id)) continue
    seen.add(id)
    out.push(row)
  }
  return out
}

function buildSections(days: AgendaDay[], rows: DatedDelivery[], dayFilter: DayFilter): Section[] {
  if (dayFilter !== 'all') {
    const day = days.find((d) => d.marketDay.date === dayFilter)
    const title = day ? (day.marketDay.isToday ? 'Today' : formatDateLabel(day.marketDay.date)) : 'Day'
    const market = rows.filter((row) => row.deliveryKind === 'market')
    const vienna = rows.filter((row) => row.deliveryKind === 'vienna')
    const out: Section[] = []
    if (market.length) {
      out.push({
        key: 'market',
        title,
        meta: day ? `${day.market.name} · market pickup hour` : 'Market pickup',
        rows: market,
      })
    }
    if (vienna.length) {
      out.push({
        key: 'vienna',
        title: `Vienna · ${title}`,
        meta: 'Home deliveries · no exact time',
        rows: vienna,
      })
    }
    return out
  }

  const out: Section[] = []
  for (const day of days) {
    const market = rows.filter((row) => row.deliveryKind === 'market' && row.date === day.marketDay.date)
    if (!market.length) continue
    out.push({
      key: day.marketDay.date,
      title: day.marketDay.isToday ? 'Today' : formatDateLabel(day.marketDay.date),
      meta: `${day.market.name} · sorted by pickup time`,
      rows: market,
    })
  }
  const vienna = uniqueVienna(rows)
  for (const date of [...new Set(vienna.map(row => row.date))].sort()) {
    out.push({
      key: `vienna-${date}`,
      title: `Vienna · ${formatDateLabel(date)}`,
      meta: 'Home deliveries · no exact time',
      rows: vienna.filter(row => row.date === date),
    })
  }
  return out
}

export function DeliveriesPage() {
  const version = useStaffRefresh()
  const clock = useStaffClock()
  const [includePast, setIncludePast] = useState(false)
  const [params, setParams] = useSearchParams()
  const routeMode = params.get('mode') === 'route'
  const dayParam = params.get('day')
  const dayFilter: DayFilter = dayParam || 'all'
  const [days, setDays] = useState<AgendaDay[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [handoffError, setHandoffError] = useState('')
  // Rows keep the position they were first shown in until the filters change: a handover or an undo
  // never moves another order's button under the finger. New rows go after the known ones.
  const positions = useRef({ view: '', order: new Map<string, number>() })
  const [lastToggle, setLastToggle] = useState<{ orderId: string; code: string; target: boolean } | null>(null)
  const view = [dayFilter, statusFilter, kindFilter, routeMode, includePast].join('|')
  useEffect(() => { setLastToggle(null) }, [view])
  function stableOrder(rows: DatedDelivery[]): DatedDelivery[] {
    if (positions.current.view !== view) positions.current = { view, order: new Map() }
    const order = positions.current.order
    const key = (row: DatedDelivery) => `${row.orderId}|${row.deliveryKind}|${row.date}`
    for (const row of [...rows].sort((a, b) => Number(a.handedOver) - Number(b.handedOver))) {
      if (!order.has(key(row))) order.set(key(row), order.size)
    }
    return [...rows].sort((a, b) => order.get(key(a))! - order.get(key(b))!)
  }

  function setDayFilter(value: string) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('day')
    else next.set('day', value)
    setParams(next)
  }

  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoadError('')
    api.agenda
      .listDays()
      .then((next) => {
        if (!cancelled) setDays(next)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load deliveries')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [version, reload])

  const todayDate = days.find(day => day.marketDay.isToday)?.marketDay.date ?? clock.date
  const handover = useHandover(() => setReload(n => n + 1), setHandoffError)
  function toggle(row: DatedDelivery, target: boolean) {
    setLastToggle({ orderId: row.orderId, code: row.orderCode, target })
    void handover.request(row.orderId, target, row.count ? undefined : row.itemId)
  }

  const dated = useMemo(() => flattenDays(days), [days])
  const confirmed = lastToggle && dated.find(row => row.orderId === lastToggle.orderId)?.handedOver === lastToggle.target ? lastToggle : null
  const handoverStatus = confirmed ? `${confirmed.code} ${confirmed.target ? 'handed over' : 'handover undone'}.` : ''

  const filtered = useMemo(() => {
    return dated.filter((row) => {
      if (!includePast && dayFilter === 'all' && row.date < todayDate) return false
      if (routeMode && row.deliveryKind !== 'vienna') return false
      if (dayFilter !== 'all' && row.date !== dayFilter) return false
      if (kindFilter !== 'all' && row.deliveryKind !== kindFilter) return false
      return true
    })
  }, [dated, dayFilter, kindFilter, routeMode, includePast, todayDate])

  // Group whole orders first, then filter by production, so a group keeps every ornament for names, counts and readiness.
  const grouped = useMemo(() => buildSections(days, filtered, dayFilter)
    .map(section => ({ ...section, rows: groupOrders(section.rows).filter(row => statusFilter === 'all' || row.productionStatus === statusFilter) }))
    .filter(section => section.rows.length > 0), [days, filtered, dayFilter, statusFilter])
  const sections = grouped.map(section => ({ ...section, rows: stableOrder(section.rows) }))
  const remainingCount = sections.reduce((sum, section) => sum + section.rows.filter(row => !row.handedOver).reduce((n, row) => n + (row.count ?? 1), 0), 0)

  const dayOptions = useMemo(
    () => [
      { value: 'all', label: includePast ? 'All days' : 'Today & upcoming' },
      ...days.filter(day => includePast || day.marketDay.date >= todayDate || day.marketDay.date === dayFilter).map((day) => ({ value: day.marketDay.date, label: dayChipLabel(day) })),
    ],
    [days, includePast, todayDate, dayFilter],
  )

  const selectedDay = days.find((day) => day.marketDay.date === dayFilter)
  const subtitleParts = [
    dayFilter === 'all' ? 'All days' : selectedDay ? dayChipLabel(selectedDay) : 'Selected day',
  ]
  if (statusFilter !== 'all') subtitleParts.push(prodLabel(statusFilter).toLowerCase())
  if (kindFilter === 'market') subtitleParts.push('market pickup')
  else if (kindFilter === 'vienna') subtitleParts.push('Vienna Wed/Fri')
  else subtitleParts.push('market pickup or Vienna Wed/Fri')

  const emptyMessage = (() => {
    if (statusFilter !== 'all' || kindFilter !== 'all') return 'No deliveries match these filters.'
    if (dayFilter !== 'all') return 'No deliveries for this day.'
    return 'No deliveries in the agenda.'
  })()

  if (loadError && !days.length) {
    return (
      <section>
        <h1>Deliveries</h1>
        <p role="alert">{loadError}</p>
        <Button tone="staff" onClick={() => { setLoading(true); setReload((value) => value + 1) }}>Try again</Button>
      </section>
    )
  }
  if (loading && !days.length) return <p role="status">Loading deliveries…</p>

  return (
    <section>
      <StaffBackLink to="/staff/agenda" label="Agenda" />
      <div className={styles.head}>
        <h1>{routeMode ? 'Delivery run' : 'Deliveries'}</h1>
        <p className={styles.sub}>{routeMode ? (selectedDay ? dayChipLabel(selectedDay) : 'All days') : subtitleParts.join(' · ')}</p>
        {routeMode ? <p className={styles.hint}>{remainingCount} {remainingCount === 1 ? 'ornament' : 'ornaments'} remaining</p> : <Button tone="staff" onClick={() => { const next = new URLSearchParams(params); next.set('mode', 'route'); if (!dayParam) { const today = days.find(day => day.marketDay.isToday); if (today) next.set('day', today.marketDay.date) } setParams(next); setKindFilter('all'); setStatusFilter('all') }}>Open delivery run</Button>}
      </div>

      <div className={styles.panel}>
        <div className={styles.filters}>
          <div className={styles.dayFilters}><SegmentedControl legend="Day" name="delivery-day" value={dayFilter} onChange={setDayFilter} options={dayOptions} /></div>
          {!routeMode ? <>
            <SegmentedControl legend="Production" name="delivery-status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
            <SegmentedControl legend="Handoff" name="delivery-kind" value={kindFilter} onChange={setKindFilter} options={KIND_OPTIONS} />
          </> : <Button tone="staff" variant="secondary" onClick={() => { const next = new URLSearchParams(params); next.delete('mode'); setParams(next) }}>Exit delivery run</Button>}
        </div>

        <label className={styles.past}><input type="checkbox" checked={includePast} onChange={event => setIncludePast(event.target.checked)} /> Include past days</label>
        {handover.dialog}
        {handoffError ? <p role="alert">{handoffError}</p> : null}
        <p className={styles.hint} role="status">{handoverStatus}</p>

        {sections.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : (
          sections.map((section) => (
            <div key={section.key} className={styles.group}>
              <h2>{section.title}</h2>
              <p className={styles.meta}>{section.meta}</p>
              {section.rows.map((row) =>
                routeMode && row.deliveryKind === 'vienna' ? (
                  <div key={`${row.orderId}-${row.itemId}-${row.date}`}>
                    <ViennaDeliveryCard row={row} from={`/staff/deliveries?${params}`} busy={handover.busy} onToggle={(_, handedOver) => toggle(row, handedOver)} />
                    {row.members?.map(member => <Button key={member.itemId} tone="staff" variant="secondary" disabled={handover.busy || (!member.handedOver && member.productionStatus !== 'finished')} onClick={() => toggle(member, !member.handedOver)}>{member.handedOver ? 'Undo' : 'Hand over'} {member.title}</Button>)}
                  </div>
                ) : (
                  <div key={`${row.orderId}-${row.itemId}-${row.date}`} className={styles.item}>
                    <DeliveryRow row={row} from={`/staff/deliveries?${params}`} />
                    <div className={styles.itemAction}>
                      <Button tone="staff" variant="secondary" disabled={handover.busy || (!row.handedOver && row.productionStatus !== 'finished')} onClick={() => toggle(row, !row.handedOver)}>{row.handedOver ? 'Undo handover' : row.deliveryKind === 'market' ? 'Mark picked up' : 'Mark delivered'}</Button>
                      {row.members?.map(member => <Button key={member.itemId} tone="staff" variant="secondary" disabled={handover.busy || (!member.handedOver && member.productionStatus !== 'finished')} onClick={() => toggle(member, !member.handedOver)}>{member.handedOver ? 'Undo' : 'Hand over'} {member.title}</Button>)}
                      {!row.handedOver && row.productionStatus !== 'finished' ? <span className={styles.hint}>{row.count ? `${row.ready} of ${row.count} ready` : 'Finish before handoff'}</span> : null}
                    </div>
                  </div>
                ),
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
