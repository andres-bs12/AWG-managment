import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { Stats } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { StaffText } from '../../components/staff/StaffText'
import { formatEur } from '../../lib/money'
import { formatDateLabel } from '../../lib/time'
import { useStaffClock } from '../../lib/staffClock'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { colorLabel, errorCodeLabel, fieldLabel, finishLabel, funnelRows, niceMax, percent, statsRange, stepLabel, type StatsPeriod } from '../../lib/stats'
import styles from './StatsPage.module.css'

const periods: { value: StatsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' }, { value: 'week', label: '7 days' }, { value: 'month', label: '30 days' }, { value: 'season', label: 'Season' },
]
type StatsView = 'sales' | 'customers' | 'website'
const views: { value: StatsView; label: string }[] = [{ value: 'sales', label: 'Sales' }, { value: 'customers', label: 'Customers' }, { value: 'website', label: 'Website' }]
const isView = (value: string | null): value is StatsView => views.some(view => view.value === value)
const isPeriod = (value: string | null): value is StatsPeriod => periods.some(period => period.value === value)
const eur = (n: number) => formatEur(n, 'en')
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

type Season = { seasonEnd?: string; stallDays?: string[] }

export function StatsPage() {
  const [params, setParams] = useSearchParams()
  const period: StatsPeriod = isPeriod(params.get('range')) ? params.get('range') as StatsPeriod : 'season'
  const today = useStaffClock().date
  const refresh = useStaffRefresh()
  const [season, setSeason] = useState<Season | null>(null)
  const [retry, setRetry] = useState(0)
  const [response, setResponse] = useState<{ stats: Stats | null; error: string; key: string }>({ stats: null, error: '', key: '' })

  // Season bounds come from the shop config and the stall days; either failing falls back to Nov 1 – Dec 24.
  useEffect(() => {
    let active = true
    void Promise.allSettled([api.shop.getConfig(), api.markets.listMarkets(), api.markets.listMarketDays()]).then(([config, markets, days]) => {
      if (!active) return
      const stalls = new Set(markets.status === 'fulfilled' ? markets.value.filter(market => market.kind === 'market').map(market => market.id) : [])
      setSeason({
        seasonEnd: config.status === 'fulfilled' ? config.value.seasonEnd : undefined,
        stallDays: days.status === 'fulfilled' ? days.value.filter(day => stalls.has(day.marketId)).map(day => day.date) : [],
      })
    })
    return () => { active = false }
  }, [])

  const range = period === 'season' && !season ? null : statsRange(period, today, season ?? {})
  const requestKey = range ? JSON.stringify([range.from, range.to, refresh, retry]) : ''
  useEffect(() => {
    if (!range) return
    let active = true
    api.stats.get(range.from, range.to).then(stats => {
      if (active) setResponse({ stats, error: '', key: requestKey })
    }).catch(err => {
      if (active) setResponse({ stats: null, error: err instanceof Error ? err.message : 'Could not load statistics.', key: requestKey })
    })
    return () => { active = false }
  // range is derived from requestKey's inputs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const busy = !range || response.key !== requestKey
  const stats = busy ? null : response.stats

  const view: StatsView = isView(params.get('view')) ? params.get('view') as StatsView : 'sales'
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  return <section className={styles.page} aria-labelledby="stats-title">
    <h1 id="stats-title">Statistics</h1>
    <div className={styles.rangeBlock}>
      <div className={styles.compactSegments}>
        <SegmentedControl legend="Range" hideLegend name="stats-range" value={period} options={periods} onChange={value => setParam('range', value)} />
      </div>
      {range && <p className={styles.meta}>{range.from === range.to ? formatDateLabel(range.from) : `${formatDateLabel(range.from)} – ${formatDateLabel(range.to)}`}</p>}
    </div>
    {busy && <p role="status">Loading statistics…</p>}
    {!busy && response.error && <div role="alert" className={styles.alert}>
      <p>{response.error}</p>
      <Button tone="staff" variant="secondary" onClick={() => setRetry(value => value + 1)}>Try again</Button>
    </div>}
    {stats && <>
      {/* Phones and tablets show one group at a time; from 1024px every group is visible. */}
      <div className={`${styles.compactSegments} ${styles.viewFilter}`}>
        <SegmentedControl legend="Show" hideLegend name="stats-view" value={view} options={views} onChange={value => setParam('view', value)} />
      </div>
      <StatsBody stats={stats} view={view} />
    </>}
  </section>
}

function StatsBody({ stats, view }: { stats: Stats; view: StatsView }) {
  const { sales, web } = stats
  const hasSales = sales.orders > 0
  const multiDay = stats.daily.length > 1
  const notCounted = [
    sales.cancelled ? plural(sales.cancelled, 'cancelled order') : '',
    sales.checkoutsInProgress ? plural(sales.checkoutsInProgress, 'web checkout', 'web checkouts') + ' waiting for payment' : '',
  ].filter(Boolean).join(' · ')
  const noSales = <div className={styles.card} data-stats-card>
    <p role="status">No sales in this range yet.</p>
    {notCounted && <p className={styles.meta}><StaffText>{`Not counted: ${notCounted}`}</StaffText></p>}
  </div>
  const handed = stats.delivery.market + stats.delivery.vienna

  return <div className={styles.groups} data-view={view}>
    <div className={styles.group} data-group="sales">
      {hasSales ? <>
        <section className={styles.card} data-stats-card aria-labelledby="stats-money">
          <h2 id="stats-money" className="visually-hidden">Money</h2>
          <dl className={styles.money}>
            <div><dt>Revenue</dt><dd>{eur(sales.revenue)}</dd></div>
            <div><dt>Received</dt><dd>{eur(sales.received)}</dd></div>
            <div data-warning={sales.outstanding > 0 || undefined}><dt>Still to collect</dt><dd>{eur(sales.outstanding)}</dd></div>
          </dl>
          <p className={styles.meta}>Revenue counts every order, paid or not. Still to collect is what customers still owe.</p>
        </section>
        <dl className={`${styles.card} ${styles.counts}`} data-stats-card aria-label="Orders and ornaments">
          <div><dd>{sales.orders.toLocaleString('en-GB')}</dd><dt>Orders</dt></div>
          <div><dd>{sales.ornaments.toLocaleString('en-GB')}</dd><dt>Ornaments</dt></div>
          <div><dd>{eur(sales.averageOrder)}</dd><dt>Average order</dt></div>
        </dl>
        {notCounted && <p className={styles.meta}><StaffText>{`Not counted: ${notCounted}`}</StaffText></p>}
        {multiDay && <Card title="Sales per day">
          <DailyBars name="Sales per day" rows={stats.daily.map(day => ({ date: day.date, value: day.revenue, text: `${eur(day.revenue)} · ${plural(day.orders, 'order')}` }))}
            tick={value => eur(value).replace(/\.00$/, '')} best="Best day"
            table={{ headers: ['Orders', 'Revenue'], cells: day => [String(stats.daily.find(row => row.date === day)?.orders ?? 0), eur(stats.daily.find(row => row.date === day)?.revenue ?? 0)] }} />
        </Card>}
        <Card title="Where sales come from">
          <ul className={styles.rows}>
            {stats.bySource.map(row => <ShareRow key={row.source} label={row.source === 'web' ? 'Online shop' : 'Stall'} value={eur(row.revenue)}
              meta={`${plural(row.orders, 'order')} · ${plural(row.ornaments, 'ornament')}`} share={percent(row.revenue, sales.revenue)} shareOf="of revenue" />)}
          </ul>
        </Card>
      </> : noSales}
    </div>

    <div className={styles.group} data-group="customers">
      {hasSales ? <>
        {stats.colors.length > 0 && <Card title="Colour and finish">
          <ul className={styles.rows}>
            {stats.colors.map(row => <ShareRow key={`${row.color}-${row.finish}`} swatch={row.color} label={`${colorLabel(row.color)} · ${finishLabel(row.finish)}`}
              value={row.count.toLocaleString('en-GB')} share={percent(row.count, sales.custom)} shareOf="of custom" />)}
          </ul>
        </Card>}
        <Card title="Custom or finished">
          <ul className={styles.rows}>
            <ShareRow label="Custom" value={sales.custom.toLocaleString('en-GB')} share={percent(sales.custom, sales.ornaments)} shareOf="of ornaments" />
            <ShareRow label="Finished" value={sales.finished.toLocaleString('en-GB')} share={percent(sales.finished, sales.ornaments)} shareOf="of ornaments" />
            {sales.custom > 0 && <ShareRow label="Name on the back" value={`${sales.withName} of ${sales.custom}`} share={percent(sales.withName, sales.custom)} shareOf="of custom" />}
          </ul>
        </Card>
        <Card title="Pickup or delivery">
          <ul className={styles.rows}>
            <ShareRow label="Market pickup" value={stats.delivery.market.toLocaleString('en-GB')} share={percent(stats.delivery.market, handed)} shareOf="of ornaments" />
            <ShareRow label="Vienna delivery" value={stats.delivery.vienna.toLocaleString('en-GB')} share={percent(stats.delivery.vienna, handed)} shareOf="of ornaments" />
          </ul>
        </Card>
      </> : <div className={styles.noSalesRepeat}>{noSales}</div>}
    </div>

    <div className={styles.group} data-group="website">
      <Card title="Page views">
        <dl className={styles.views}>
          <div><dd>{web.homeViews.toLocaleString('en-GB')}</dd><dt>Home</dt></div>
          <div><dd>{web.buyViews.toLocaleString('en-GB')}</dd><dt>Shop</dt></div>
          <div><dd>{web.trackViews.toLocaleString('en-GB')}</dd><dt>Track</dt></div>
          <div><dd>{web.formViews.toLocaleString('en-GB')}</dd><dt>QR form</dt></div>
        </dl>
        <p className={styles.meta}>Anonymous page loads, without cookies. The stall iPad is not counted.</p>
      </Card>
      {multiDay && <Card title="Website visits per day">
        <DailyBars name="Website visits per day" rows={stats.daily.map(day => ({ date: day.date, value: day.visits, text: plural(day.visits, 'visit') }))}
          tick={value => value.toLocaleString('en-GB')} best="Busiest day"
          table={{ headers: ['Visits'], cells: day => [String(stats.daily.find(row => row.date === day)?.visits ?? 0)] }} />
      </Card>}
      <Card title="Online shop funnel">
        <p className={styles.meta}>Each step counts shop visits that got that far. A big drop between two steps shows where customers give up.</p>
        <ol className={styles.rows}>
          {funnelRows(web.funnel).map(row => <ShareRow key={row.stage} label={row.label} value={row.count.toLocaleString('en-GB')} share={row.share} shareOf="of opened" />)}
        </ol>
      </Card>
      <Card title="Most common form errors">
        {web.validationErrors.length ? <ol className={styles.errors}>
          {web.validationErrors.map(row => {
            const meta = [stepLabel(row.step), errorCodeLabel(row.code)].filter(Boolean).join(' · ')
            return <li key={`${row.step}-${row.field}-${row.code}`}>
              <span className={styles.errorLabel}><strong>{fieldLabel(row.field)}</strong>{meta && <span className={styles.meta}><StaffText>{meta}</StaffText></span>}</span>
              <span className={styles.number}>{row.count.toLocaleString('en-GB')}</span>
            </li>
          })}
        </ol> : <p className={styles.meta}>No form errors in this range.</p>}
      </Card>
    </div>
  </div>
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return <section className={styles.card} data-stats-card aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>
}

function ShareRow({ label, value, meta, share, shareOf, swatch }: { label: string; value: string; meta?: string; share: number; shareOf: string; swatch?: string }) {
  return <li className={styles.shareRow}>
    <span className={styles.shareLabel}>
      {swatch && <span aria-hidden="true" className={styles.swatch} style={{ background: `var(--ornament-${swatch})` }} />}
      <span className={styles.text}>{label}</span>
    </span>
    <span className={styles.number}>{value}</span>
    {meta && <span className={`${styles.meta} ${styles.shareMeta}`}><StaffText>{meta}</StaffText></span>}
    <span className={styles.track} aria-hidden="true"><span className={styles.fill} style={{ width: `${share}%` }} /></span>
    <span className={`${styles.meta} ${styles.shareText}`}>{share}% {shareOf}</span>
  </li>
}

type BarRow = { date: string; value: number; text: string }

// Shorter plots on phones save scrolling; ticks and bars stay readable at 120px.
const plotHeight = (width: number) => width < 480 ? 120 : 160
const AXIS_GAP = 8
const BAR_MAX = 24

/**
 * One series of daily columns as inline SVG. Pointer and arrow keys pick a day; the readout above
 * the chart says its value. Every day's numbers are in the table under it.
 */
function DailyBars({ name, rows, tick, best, table }: { name: string; rows: BarRow[]; tick: (value: number) => string; best: string; table: { headers: string[]; cells: (date: string) => string[] } }) {
  const readoutId = useId()
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)
  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const max = niceMax(Math.max(...rows.map(row => row.value)))
  const ticks = [0, max / 2, max]
  const peak = useMemo(() => rows.reduce((top, row, index) => row.value > rows[top].value ? index : top, 0), [rows])
  // Leave room for the widest tick label (about 8px per character at the meta size).
  const left = Math.max(...ticks.map(value => tick(value).length)) * 8 + AXIS_GAP
  const plot = Math.max(0, width - left)
  const band = rows.length ? plot / rows.length : 0
  const gap = band >= 8 ? 2 : band >= 3 ? 1 : 0
  const bar = Math.max(1, Math.min(BAR_MAX, band - gap))
  const plotH = plotHeight(width)
  const y = (value: number) => plotH - (value / max) * plotH
  const shown = active ?? peak
  const readout = rows[shown]
  const allZero = rows.every(row => row.value === 0)

  function pick(event: PointerEvent<HTMLDivElement>) {
    if (!band) return
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left - left
    setActive(Math.min(rows.length - 1, Math.max(0, Math.floor(x / band))))
  }
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : rows.length - 1)
    } else if (moves[event.key]) {
      event.preventDefault()
      setActive(Math.min(rows.length - 1, Math.max(0, (active ?? peak) + moves[event.key])))
    }
  }

  return <div className={styles.chart}>
    <p className={styles.readout} id={readoutId} aria-live="polite">
      {allZero ? 'Nothing yet in this range.' : <StaffText>{`${active === null ? `${best}: ` : ''}${formatDateLabel(readout.date)} · ${readout.text}`}</StaffText>}
    </p>
    <div ref={box} className={styles.plot} tabIndex={0} role="group"
      aria-label={`${name}. Use the left and right arrow keys to read each day.`} aria-describedby={readoutId}
      onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} onKeyDown={keys} onBlur={() => setActive(null)}>
      {width > 0 && <svg width={width} height={plotH + 28} aria-hidden="true" className={styles.svg}>
        {active !== null && <rect className={styles.hoverBand} x={left + band * active} y={0} width={band} height={plotH} />}
        {ticks.map(value => <g key={value}>
          <line className={styles.grid} x1={left} x2={width} y1={y(value) + 0.5} y2={y(value) + 0.5} />
          <text className={styles.axis} x={left - AXIS_GAP} y={y(value)} dy={value === max ? '0.9em' : value === 0 ? '0' : '0.35em'} textAnchor="end">{tick(value)}</text>
        </g>)}
        {rows.map((row, index) => {
          if (row.value <= 0) return null
          const height = Math.max(2, plotH - y(row.value))
          const x = left + band * index + (band - bar) / 2
          const r = Math.min(4, bar / 2, height)
          const top = plotH - height
          return <path key={row.date} className={styles.bar} data-active={active === index || undefined}
            d={`M${x},${plotH}V${top + r}Q${x},${top} ${x + r},${top}H${x + bar - r}Q${x + bar},${top} ${x + bar},${top + r}V${plotH}Z`} />
        })}
        <text className={styles.axis} x={left} y={plotH + 22} textAnchor="start">{formatDateLabel(rows[0].date)}</text>
        <text className={styles.axis} x={width} y={plotH + 22} textAnchor="end">{formatDateLabel(rows[rows.length - 1].date)}</text>
      </svg>}
    </div>
    <details className={styles.details}>
      <summary>Numbers per day</summary>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Day</th>{table.headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.date}><th scope="row">{formatDateLabel(row.date)}</th>{table.cells(row.date).map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  </div>
}
