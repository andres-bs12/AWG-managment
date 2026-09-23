import { Button } from '../../components/ui/Button'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useMockStoreVersion } from '../../api/mock/useMockStore'
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
    const id = `${row.orderId}-${row.itemId}`
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
  const version = useMockStoreVersion()
  const [params, setParams] = useSearchParams()
  const routeMode = params.get('mode') === 'route'
  const dayParam = params.get('day')
  const dayFilter: DayFilter = dayParam || 'all'
  const [days, setDays] = useState<AgendaDay[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null)
  const [handoffError, setHandoffError] = useState('')

  function setDayFilter(value: string) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('day')
    else next.set('day', value)
    setParams(next)
  }

  useEffect(() => {
    api.agenda.listDays().then(setDays)
  }, [version])

  const dated = useMemo(() => flattenDays(days), [days])

  const filtered = useMemo(() => {
    return dated.filter((row) => {
      if (routeMode && row.deliveryKind !== 'vienna') return false
      if (dayFilter !== 'all' && row.date !== dayFilter) return false
      if (statusFilter !== 'all' && row.productionStatus !== statusFilter) return false
      if (kindFilter !== 'all' && row.deliveryKind !== kindFilter) return false
      return true
    })
  }, [dated, dayFilter, kindFilter, statusFilter, routeMode])

  const sections = useMemo(() => buildSections(days, filtered, dayFilter), [days, filtered, dayFilter])
  const remainingCount = filtered.filter(row => !row.handedOver).length

  const dayOptions = useMemo(
    () => [
      { value: 'all', label: 'All days' },
      ...days.map((day) => ({ value: day.marketDay.date, label: dayChipLabel(day) })),
    ],
    [days],
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

  async function toggleHandedOver(orderId: string, handedOver: boolean) {
    setHandoffError('')
    setBusyOrderId(orderId)
    try {
      await api.orders.setHandedOver(orderId, handedOver)
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : 'Could not update handoff')
    } finally {
      setBusyOrderId(null)
    }
  }

  if (!days.length) return <p>Loading deliveries…</p>

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
          <label className={styles.filter} htmlFor="deliveries-day">
            <span>Day</span>
            <select
              id="deliveries-day"
              className={styles.select}
              value={dayFilter}
              onChange={(e) => setDayFilter(e.target.value)}
            >
              {dayOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {!routeMode ? <><label className={styles.filter} htmlFor="deliveries-status">
            <span>Production</span>
            <select
              id="deliveries-status"
              className={styles.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filter} htmlFor="deliveries-kind">
            <span>Handoff</span>
            <select
              id="deliveries-kind"
              className={styles.select}
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label></> : <Button tone="staff" variant="secondary" onClick={() => { const next = new URLSearchParams(params); next.delete('mode'); setParams(next) }}>Exit delivery run</Button>}
        </div>

        {handoffError ? <p role="alert">{handoffError}</p> : null}

        {sections.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : (
          sections.map((section) => (
            <div key={section.key} className={styles.group}>
              <h2>{section.title}</h2>
              <p className={styles.meta}>{section.meta}</p>
              {[...section.rows].sort((a, b) => Number(a.handedOver) - Number(b.handedOver)).map((row) =>
                routeMode && row.deliveryKind === 'vienna' ? (
                  <ViennaDeliveryCard
                    key={`${row.orderId}-${row.itemId}-${row.date}`}
                    row={row}
                    from={`/staff/deliveries?${params}`}
                    busy={busyOrderId === row.orderId}
                    onToggle={(orderId, handedOver) => void toggleHandedOver(orderId, handedOver)}
                  />
                ) : (
                  <DeliveryRow
                    key={`${row.orderId}-${row.itemId}-${row.date}`}
                    row={row}
                    from={`/staff/deliveries?${params}`}
                  />
                ),
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
