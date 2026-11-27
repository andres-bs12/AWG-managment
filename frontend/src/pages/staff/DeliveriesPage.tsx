import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useHandover } from '../../components/staff/useHandover'
import { useStaffClock } from '../../lib/staffClock'
import { useStaffMarket } from '../../lib/staffMarket'
import { Field } from '../../components/ui/Field'
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
import { formatStaffShortDate } from '../../lib/postShipping'
import { groupDeliveryOrders, isHandedOverAtSale, remainingDeliveries, type DatedDelivery } from '../../lib/staffDeliveries'
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

function parseKindParam(raw: string | null): KindFilter {
  return raw === 'market' || raw === 'post' || raw === 'vienna' ? raw : 'all'
}

/** Route order: Vienna postcode, falling back to the address line when no postcode is stored. */
function routeKey(row: DatedDelivery): string {
  return (row.postalCode || row.addressLabel || '').trim()
}

function byPostcode(a: DatedDelivery, b: DatedDelivery): number {
  return routeKey(a).localeCompare(routeKey(b), 'en', { numeric: true })
}

function flattenDays(days: AgendaDay[]): DatedDelivery[] {
  return days.flatMap(day => day.deliveries.map(row => {
    const stalls = day.marketDays ?? (day.market.kind === 'market' ? [day.marketDay] : [])
    const pickup = row.deliveryKind !== 'market' ? undefined
      : row.marketDayId ? stalls.find(stall => stall.id === row.marketDayId)
        : row.marketId ? stalls.find(stall => stall.marketId === row.marketId)
          : stalls.length === 1 ? stalls[0] : undefined
    return {
      ...row,
      date: day.marketDay.date,
      marketHours: pickup ? `${formatHour(pickup.openHour)}–${formatHour(pickup.closeHour)}` : undefined,
    }
  }))
}

export function DeliveriesPage() {
  const version = useStaffRefresh()
  const clock = useStaffClock()
  const { activeMarket, stalls } = useStaffMarket()
  const [stallFilter, setStallFilter] = useState<{ activeId: string | undefined; value: string }>()
  const [includePast, setIncludePast] = useState(false)
  const [params, setParams] = useSearchParams()
  const routeMode = params.get('mode') === 'route'
  const dayParam = params.get('day')
  const dayFilter: DayFilter = dayParam || 'all'
  const [days, setDays] = useState<AgendaDay[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const kindFilter: KindFilter = parseKindParam(params.get('kind'))
  const [handoffError, setHandoffError] = useState('')
  const [shipBusy, setShipBusy] = useState(false)
  const shipLock = useRef(false)
  // Rows keep the position they were first shown in until the filters change: a handover or an undo
  // never moves another order's button under the finger. New rows go after the known ones.
  const positions = useRef({ view: '', order: new Map<string, number>() })
  const [handoverStatus, setHandoverStatus] = useState('')
  const marketOptions = useMemo(() => [...new Map(
    days.flatMap(day => day.markets ?? (day.market.kind === 'market' ? [day.market] : [])).map(market => [market.id, market]),
  ).values()].sort((a, b) => a.name.localeCompare(b.name)), [days])
  const activeId = activeMarket?.id
  const stallDefault = stalls.length > 1 ? activeId ?? 'all' : 'all'
  const requestedStall = stallFilter && stallFilter.activeId === activeId ? stallFilter.value : stallDefault
  const marketFilter = marketOptions.some(market => market.id === requestedStall) ? requestedStall : 'all'
  const view = [dayFilter, statusFilter, kindFilter, marketFilter, routeMode, includePast].join('|')
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

  function setKindFilter(value: KindFilter) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('kind')
    else next.set('kind', value)
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

  async function handToPost(row: DatedDelivery, trackingNumber: string) {
    setHandoverStatus('')
    setHandoffError('')
    const postItems = (row.members ?? [row]).filter(item => item.deliveryKind === 'post')
    const allPostFinished = postItems.length > 0 && postItems.every(item => item.productionStatus === 'finished')
    const postIds = postItems.filter(item => !item.handedOver).map(item => item.itemId)
    if (!allPostFinished || !postIds.length) return
    if ((row.remaining ?? 0) > 0) {
      void handover.request(row.orderId, true, undefined, postIds, trackingNumber)
      return
    }
    if (shipLock.current) return
    shipLock.current = true
    setShipBusy(true)
    try {
      await api.orders.setHandedOver(row.orderId, true, postIds, trackingNumber || undefined)
      setHandoverStatus(`${row.orderCode} · handed to Post.`)
      setReload(n => n + 1)
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : 'Could not mark parcel as handed to Post.')
    } finally {
      shipLock.current = false
      setShipBusy(false)
    }
  }

  const dated = useMemo(() => flattenDays(days), [days])
  const hasLegacyVienna = useMemo(() => dated.some(row => row.deliveryKind === 'vienna'), [dated])
  const kindOptions: { value: KindFilter; label: string }[] = useMemo(() => [
    { value: 'all', label: 'All' },
    { value: 'market', label: 'Market' },
    { value: 'post', label: 'Post' },
    ...(hasLegacyVienna ? [{ value: 'vienna' as const, label: 'Vienna' }] : []),
  ], [hasLegacyVienna])
  const effectiveKind: KindFilter = kindFilter === 'vienna' && !hasLegacyVienna ? 'all' : kindFilter
  const shipView = !routeMode && effectiveKind === 'post'
  // Every filter except the day: the day chips are built from these rows, so a chip only exists
  // for a day that has something to hand over under the current Handoff/Market/Production choice.
  function matchesOtherFilters(row: DatedDelivery): boolean {
    if (isHandedOverAtSale(row)) return false
    if (routeMode && row.deliveryKind !== 'vienna') return false
    if (effectiveKind !== 'all' && row.deliveryKind !== effectiveKind) return false
    if (!routeMode && effectiveKind !== 'vienna' && effectiveKind !== 'post' && marketFilter !== 'all' && row.marketId !== marketFilter) return false
    if (statusFilter !== 'all' && row.productionStatus !== statusFilter) return false
    return true
  }
  const candidates = dated.filter(row => matchesOtherFilters(row) && (includePast || row.date >= todayDate))
  const filtered = dated.filter(row => {
    if (!matchesOtherFilters(row)) return false
    if (dayFilter !== 'all') return row.date === dayFilter
    return includePast || row.date >= todayDate
  })

  const grouped = groupDeliveryOrders(filtered, dated)
  // The run follows the route, not the order of first sight. A postcode never changes on handover, so the list stays put.
  const orders = routeMode ? [...grouped].sort(byPostcode) : stableOrder(grouped)
  const shipGroups = useMemo(() => {
    if (!shipView) return []
    const byDate = new Map<string, DatedDelivery[]>()
    for (const order of orders) {
      const date = (order.members?.find(item => item.deliveryKind === 'post') ?? order).date
      const bucket = byDate.get(date) ?? []
      bucket.push(order)
      byDate.set(date, bucket)
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [shipView, orders])
  const activeIds = new Set(filtered.map(item => item.itemId))
  const remainingCount = remainingDeliveries(orders, routeMode, activeIds)

  // Only days with deliveries get a chip, each with its order count; the chosen day stays even when
  // a filter empties it, so the selection never disappears from under the finger.
  const ordersByDate = new Map<string, Set<string>>()
  for (const row of candidates) ordersByDate.set(row.date, (ordersByDate.get(row.date) ?? new Set()).add(row.orderId))
  const totalOrders = new Set(candidates.map(row => row.orderId)).size
  const dayOptions = [
    { value: 'all', label: includePast ? 'All days' : 'Upcoming', hint: String(totalOrders) },
    ...days
      .filter(day => ordersByDate.has(day.marketDay.date) || day.marketDay.date === dayFilter)
      .map(day => ({ value: day.marketDay.date, label: dayChipLabel(day), hint: String(ordersByDate.get(day.marketDay.date)?.size ?? 0) })),
  ]
  const quickDayOptions = dayOptions.map(option => ({ value: option.value, label: `${option.label} · ${option.hint}` }))

  const emptyMessage = (() => {
    if (shipView) return 'No Post parcels match these filters.'
    if (statusFilter !== 'all' || effectiveKind !== 'all' || marketFilter !== 'all') return 'No deliveries match these filters.'
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

  const activeMarketFilterCount = Number(!routeMode && effectiveKind !== 'vienna' && effectiveKind !== 'post' && marketFilter !== 'all')

  return (
    <section>
      <StaffBackLink to="/staff/agenda" label="Agenda" />
      <div className={styles.head}>
        <h1>{routeMode ? 'Delivery run' : shipView ? 'Ship · Post' : 'Deliveries'}</h1>
        {routeMode ? (
          <p className={styles.hint}>{remainingCount} {remainingCount === 1 ? 'ornament' : 'ornaments'} remaining</p>
        ) : shipView && orders.length > 0 ? (
          <p className={styles.hint}>{orders.filter(order => !order.handedOver).length} of {orders.length} {orders.length === 1 ? 'parcel' : 'parcels'} to hand to Post</p>
        ) : !shipView && hasLegacyVienna ? (
          <Button tone="staff" onClick={() => { const next = new URLSearchParams(params); next.set('mode', 'route'); next.delete('kind'); if (!dayParam) { const today = days.find(day => day.marketDay.isToday); if (today) next.set('day', today.marketDay.date) } setParams(next); setStatusFilter('all') }}>Open delivery run</Button>
        ) : null}
      </div>

      <div className={styles.panel}>
        <StaffFilters mobileInline count={Number(dayFilter !== 'all') + Number(statusFilter !== 'all') + Number(effectiveKind !== 'all') + activeMarketFilterCount + Number(includePast)} inline={<label className={styles.quickDay}>Day<select aria-label="Delivery day" value={dayFilter} onChange={event => setDayFilter(event.target.value)}>{quickDayOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}>
        <div className={styles.filters}>
          <div className={styles.dayBlock}>
            <div className={styles.dayFilters}><SegmentedControl legend="Day" name="delivery-day" value={dayFilter} onChange={setDayFilter} options={dayOptions} /></div>
            <label className={styles.past}><input type="checkbox" checked={includePast} onChange={event => setIncludePast(event.target.checked)} /> Include past days</label>
          </div>
          {!routeMode ? <div className={styles.refine}>
            <SegmentedControl legend="Handoff" name="delivery-kind" value={effectiveKind} onChange={setKindFilter} options={kindOptions} />
            {marketOptions.length > 1 && effectiveKind !== 'vienna' && effectiveKind !== 'post' && <Field className={styles.market} label="Pickup market" htmlFor="deliveries-market">
              <select id="deliveries-market" value={marketFilter} onChange={event => setStallFilter({ activeId, value: event.target.value })}>
                <option value="all">Any market</option>
                {marketOptions.map(market => <option key={market.id} value={market.id}>{market.name}</option>)}
              </select>
            </Field>}
            <SegmentedControl legend="Production" name="delivery-status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          </div> : <Button tone="staff" variant="secondary" onClick={() => { const next = new URLSearchParams(params); next.delete('mode'); setParams(next) }}>Exit delivery run</Button>}
        </div>
        </StaffFilters>
        {handover.dialog}
        {handoffError ? <p role="alert">{handoffError}</p> : null}
        <p className={styles.hint} role="status"><StaffText>{handoverStatus}</StaffText></p>

        {orders.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : shipView ? (
          <div className={styles.shipGroups}>
            {shipGroups.map(([date, groupOrders]) => (
              <section key={date} className={styles.group} aria-labelledby={`ship-day-${date}`}>
                <h2 id={`ship-day-${date}`}>
                  <StaffText>{`Post · ${formatStaffShortDate(date)}`}</StaffText>
                </h2>
                {groupOrders.map(row => (
                  <DeliveryOrderCard key={row.orderId} row={row} from={`/staff/deliveries?${params}`} routeMode={false} busy={handover.busy || shipBusy} activeIds={activeIds} hideDueDate onToggle={toggle} onHandToPost={(r, t) => void handToPost(r, t)} />
                ))}
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.group}>
            {orders.map(row => <DeliveryOrderCard key={row.orderId} row={row} from={`/staff/deliveries?${params}`} routeMode={routeMode} busy={handover.busy || shipBusy} activeIds={activeIds} onToggle={toggle} onHandToPost={(r, t) => void handToPost(r, t)} />)}
          </div>
        )}
      </div>
    </section>
  )
}
