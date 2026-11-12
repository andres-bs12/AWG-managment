import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useHandover } from '../../components/staff/useHandover'
import { useStaffClock } from '../../lib/staffClock'
import { Button } from '../../components/ui/Button'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { dayChipLabel } from '../../components/staff/DeliveryRow'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { DeliveryOrderCard } from '../../components/staff/DeliveryOrderCard'
import { StaffFilters } from '../../components/staff/StaffFilters'
import { StaffText } from '../../components/staff/StaffText'
import type { AgendaDay, DeliveryKind, ProductionStatus } from '../../domain/types'
import { formatHour } from '../../lib/time'
import { groupDeliveryOrders, remainingDeliveries, type DatedDelivery } from '../../lib/staffDeliveries'
import styles from './DeliveriesPage.module.css'


type DayFilter = 'all' | string
type StatusFilter = 'all' | ProductionStatus
type KindFilter = 'all' | DeliveryKind


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
      marketHours: row.deliveryKind === 'market' ? `${formatHour(day.marketDay.openHour)}–${formatHour(day.marketDay.closeHour)}` : undefined,
    })),
  )
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
  const [handoverStatus, setHandoverStatus] = useState('')
  const view = [dayFilter, statusFilter, kindFilter, routeMode, includePast].join('|')
  useEffect(() => { setHandoverStatus('') }, [view])
  function stableOrder(rows: DatedDelivery[]): DatedDelivery[] {
    if (positions.current.view !== view) positions.current = { view, order: new Map() }
    const order = positions.current.order
    const key = (row: DatedDelivery) => row.orderId
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
  const handover = useHandover(change => { setHandoverStatus(`${change.code} · ${change.itemIds.length} ${change.itemIds.length === 1 ? 'ornament' : 'ornaments'} ${change.target ? 'handed over' : 'handover undone'}.`); setReload(n => n + 1) }, setHandoffError)
  function toggle(row: DatedDelivery, target: boolean) {
    setHandoverStatus('')
    const matchingIds = filtered.filter(item => item.orderId === row.orderId).map(item => item.itemId)
    void handover.request(row.orderId, target, row.count ? undefined : row.itemId, row.count ? matchingIds : undefined)
  }

  const dated = useMemo(() => flattenDays(days), [days])
  const filtered = useMemo(() => {
    return dated.filter((row) => {
      if (!includePast && dayFilter === 'all' && row.date < todayDate) return false
      if (routeMode && row.deliveryKind !== 'vienna') return false
      if (dayFilter !== 'all' && row.date !== dayFilter) return false
      if (kindFilter !== 'all' && row.deliveryKind !== kindFilter) return false
      if (statusFilter !== 'all' && row.productionStatus !== statusFilter) return false
      return true
    })
  }, [dated, dayFilter, kindFilter, statusFilter, routeMode, includePast, todayDate])

  const grouped = useMemo(() => groupDeliveryOrders(filtered, dated), [filtered, dated])
  const orders = stableOrder(grouped)
  const activeIds = new Set(filtered.map(item => item.itemId))
  const remainingCount = remainingDeliveries(orders, routeMode, activeIds)

  const dayOptions = useMemo(
    () => [
      { value: 'all', label: includePast ? 'All days' : 'Today & upcoming' },
      ...days.filter(day => includePast || day.marketDay.date >= todayDate || day.marketDay.date === dayFilter).map((day) => ({ value: day.marketDay.date, label: dayChipLabel(day) })),
    ],
    [days, includePast, todayDate, dayFilter],
  )

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
        {routeMode ? <p className={styles.hint}>{remainingCount} {remainingCount === 1 ? 'ornament' : 'ornaments'} remaining</p> : <Button tone="staff" onClick={() => { const next = new URLSearchParams(params); next.set('mode', 'route'); if (!dayParam) { const today = days.find(day => day.marketDay.isToday); if (today) next.set('day', today.marketDay.date) } setParams(next); setKindFilter('all'); setStatusFilter('all') }}>Open delivery run</Button>}
      </div>

      <div className={styles.panel}>
        <StaffFilters mobileInline count={Number(dayFilter !== 'all') + Number(statusFilter !== 'all') + Number(kindFilter !== 'all') + Number(includePast)} inline={<label className={styles.quickDay}>Day<select aria-label="Delivery day" value={dayFilter} onChange={event => setDayFilter(event.target.value)}>{dayOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}>
        <div className={styles.filters}>
          <div className={styles.dayFilters}><SegmentedControl legend="Day" name="delivery-day" value={dayFilter} onChange={setDayFilter} options={dayOptions} /></div>
          {!routeMode ? <>
            <SegmentedControl legend="Production" name="delivery-status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
            <SegmentedControl legend="Handoff" name="delivery-kind" value={kindFilter} onChange={setKindFilter} options={KIND_OPTIONS} />
          </> : <Button tone="staff" variant="secondary" onClick={() => { const next = new URLSearchParams(params); next.delete('mode'); setParams(next) }}>Exit delivery run</Button>}
          <label className={styles.past}><input type="checkbox" checked={includePast} onChange={event => setIncludePast(event.target.checked)} /> Include past days</label>
        </div>
        </StaffFilters>
        {handover.dialog}
        {handoffError ? <p role="alert">{handoffError}</p> : null}
        <p className={styles.hint} role="status"><StaffText>{handoverStatus}</StaffText></p>

        {orders.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : (
          <div className={styles.group}>
            {orders.map(row => <DeliveryOrderCard key={row.orderId} row={row} from={`/staff/deliveries?${params}`} routeMode={routeMode} busy={handover.busy} activeIds={activeIds} onToggle={toggle} />)}
          </div>
        )}
      </div>
    </section>
  )
}
