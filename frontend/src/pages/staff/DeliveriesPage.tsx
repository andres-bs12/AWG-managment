import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useHandover } from '../../components/staff/useHandover'
import { useStaffClock } from '../../lib/staffClock'
import { Button } from '../../components/ui/Button'
import { useEffect, useMemo, useState } from 'react'
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

type DatedDelivery = AgendaDelivery & { date: string }

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

function uniqueVienna(rows: DatedDelivery[]): DatedDelivery[] {
  const seen = new Set<string>()
  const out: DatedDelivery[] = []
  for (const row of rows) {
    if (row.deliveryKind !== 'vienna') continue
    const id = row.orderId
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
        title: 'Home deliveries',
        meta: '',
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
  if (vienna.length) {
    out.push({
      key: 'vienna',
      title: 'Home deliveries',
        meta: '',
      rows: vienna,
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

  const dated = useMemo(() => flattenDays(days), [days])

  const filtered = useMemo(() => {
    return dated.filter((row) => {
      if (!includePast && dayFilter === 'all' && row.date < todayDate) return false
      if (routeMode && row.deliveryKind !== 'vienna') return false
      if (dayFilter !== 'all' && row.date !== dayFilter) return false
      if (statusFilter !== 'all' && row.productionStatus !== statusFilter) return false
      if (kindFilter !== 'all' && row.deliveryKind !== kindFilter) return false
      return true
    })
  }, [dated, dayFilter, kindFilter, statusFilter, routeMode, includePast, todayDate])

  const sections = useMemo(() => buildSections(days, filtered, dayFilter), [days, filtered, dayFilter])
  const remainingCount = filtered.filter(row => !row.handedOver).length

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

        {sections.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : (
          sections.map((section) => (
            <div key={section.key} className={styles.group}>
              <h2>{section.title}</h2>
              <p className={styles.meta}>{section.meta}</p>
              {[...section.rows].filter((row, index, all) => all.findIndex(other => other.orderId === row.orderId && other.deliveryKind === row.deliveryKind) === index).sort((a, b) => Number(a.handedOver) - Number(b.handedOver)).map((row) =>
                routeMode && row.deliveryKind === 'vienna' ? (
                  <ViennaDeliveryCard
                    key={`${row.orderId}-${row.itemId}-${row.date}`}
                    row={row}
                    from={`/staff/deliveries?${params}`}
                    busy={handover.busy}
                    onToggle={(orderId, handedOver) => void handover.request(orderId, handedOver)}
                  />
                ) : (
                  <div key={`${row.orderId}-${row.itemId}-${row.date}`}><DeliveryRow
                    key={`${row.orderId}-${row.itemId}-${row.date}`}
                    row={row}
                    from={`/staff/deliveries?${params}`}
                  />
                  <Button tone="staff" variant="secondary" disabled={handover.busy || (!row.handedOver && row.productionStatus !== 'finished')} onClick={() => void handover.request(row.orderId, !row.handedOver)}>{row.handedOver ? 'Undo handover' : row.deliveryKind === 'market' ? 'Mark picked up' : 'Mark delivered'}</Button></div>
                ),
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
