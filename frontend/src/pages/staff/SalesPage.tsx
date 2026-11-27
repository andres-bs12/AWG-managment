import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { Market, SaleItemPreview, SalesFilters, SalesPage as SalesResult } from '../../domain/types'
import { marketOrnamentParts } from '../../domain/marketStock'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { formatEur } from '../../lib/money'
import { formatDateLabel } from '../../lib/time'
import { salePaymentLabel, viennaDate } from '../../lib/sales'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { StaffFilters } from '../../components/staff/StaffFilters'
import { StaffText } from '../../components/staff/StaffText'
import styles from './SalesPage.module.css'

type Period = 'today' | 'week' | 'all'
const paymentStates = new Set(['unpaid', 'deposit', 'paid', 'pending', 'review'])

export function SalesPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const state = paymentStates.has(params.get('state') ?? '') ? params.get('state') as SalesFilters['state'] : undefined
  const source = params.get('source') === 'stall' || params.get('source') === 'web' ? params.get('source') as SalesFilters['source'] : undefined
  const market = params.get('market') || undefined
  const period: Period = params.get('period') === 'today' ? 'today' : params.get('period') === 'week' ? 'week' : 'all'
  const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0)
  const [response, setResponse] = useState<{ result: SalesResult | null; error: string; key: string }>({ result: null, error: '', key: '' })
  const [retry, setRetry] = useState(0)
  const [markets, setMarkets] = useState<Market[]>([])
  const refresh = useStaffRefresh()
  const today = viennaDate(new Date())
  const requestKey = JSON.stringify([query, state, source, market, period, page, today, refresh, retry])
  const busy = response.key !== requestKey
  const error = busy ? '' : response.error
  const result = response.result

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }

  // The market list only fills the filter; without it the filter just offers "All markets".
  useEffect(() => {
    let active = true
    api.markets.listMarkets().then(rows => { if (active) setMarkets([...rows].sort((a, b) => a.name.localeCompare(b.name))) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const start = new Date(`${today}T12:00:00Z`)
    start.setUTCDate(start.getUTCDate() - 6)
    const from = period === 'today' ? today : period === 'week' ? start.toISOString().slice(0, 10) : undefined
    const timer = window.setTimeout(() => {
      void api.orders.listSales({ query, state, source, market, page, from, to: period === 'all' ? undefined : today }).then(next => {
        if (active) setResponse({ result: next, error: '', key: requestKey })
      }).catch(err => {
        if (active) setResponse({ result: null, error: err instanceof Error ? err.message : 'Could not load sales.', key: requestKey })
      })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, state, source, market, period, page, today, refresh, retry, requestKey])

  // A stale or hand-edited ?page= past the end jumps back to the last page instead of an empty list.
  const lastPage = result && !busy && result.totalPages > 0 && page >= result.totalPages ? result.totalPages - 1 : null
  useEffect(() => {
    if (lastPage === null) return
    const next = new URLSearchParams(params)
    if (lastPage > 0) next.set('page', String(lastPage)); else next.delete('page')
    setParams(next, { replace: true })
  }, [lastPage, params, setParams])

  return <section className={styles.page}>
    <h1>Sales</h1>
    <StaffFilters count={Number(Boolean(state)) + Number(Boolean(source)) + Number(Boolean(market)) + Number(period !== 'all')} inline={
      <div className={styles.period}>
        <SegmentedControl legend="Sale date" hideLegend value={period} name="sales-period" onChange={value => update('period', value)} options={[{ value: 'today', label: 'Today' }, { value: 'week', label: '7 days' }, { value: 'all', label: 'All' }]} />
      </div>
    }>
      <div className={styles.filterRow}>
        <Field label="Payment" htmlFor="sales-state"><select id="sales-state" value={state ?? ''} onChange={event => update('state', event.target.value)}>
          <option value="">All payments</option><option value="unpaid">Unpaid</option><option value="deposit">Deposit paid</option><option value="paid">Paid</option><option value="pending">Checkout pending</option><option value="review">Payment review</option>
        </select></Field>
        <Field label="Source" htmlFor="sales-source"><select id="sales-source" value={source ?? ''} onChange={event => update('source', event.target.value)}>
          <option value="">All sources</option><option value="stall">Stall</option><option value="web">Web</option>
        </select></Field>
        <Field label="Market" htmlFor="sales-market"><select id="sales-market" value={market ?? ''} onChange={event => update('market', event.target.value)}>
          <option value="">All markets</option>
          {/* A market id from an old link that is no longer listed still shows as selected instead of silently "All". */}
          {market && !markets.some(row => row.id === market) ? <option value={market}>Selected market</option> : null}
          {markets.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></Field>
      </div>
    </StaffFilters>
    {busy && <p role="status">Loading sales…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>}
    {!busy && !error && result && <>
      {/* Money taken over the whole range and filters (every page), by how it was paid (owner, 2026-11-27). */}
      {result.received ? <dl className={styles.received} aria-label="Received">
        <div><dt>Card</dt><dd>{formatEur(result.received.card, 'en')}</dd></div>
        <div><dt>Cash</dt><dd>{formatEur(result.received.cash, 'en')}</dd></div>
        {result.received.other > 0 ? <div><dt>No method</dt><dd>{formatEur(result.received.other, 'en')}</dd></div> : null}
      </dl> : null}
      {!result.orders.length ? <p role="status">No sales match these filters.</p> : <ul className={styles.list} aria-label="Sales results">{result.orders.map(order => {
        const web = order.source === 'web'
        const market = web ? null : order.soldAtMarketName
        const date = formatDateLabel(viennaDate(order.createdAt))
        return <li key={order.id}>
          <Link className={styles.sale} to={`/staff/orders/${order.id}`} state={{ from: `/staff/sales?${params}` }}>
            <div className={styles.identity}><strong className={styles.code}>{order.code}</strong><span>{order.customerName || 'Customer pending'}</span></div>
            {order.saleItems?.length ? <ul className={styles.items} aria-label="Ornaments">{order.saleItems.map(item =>
              <li key={item.id}><SaleItem item={item} /></li>
            )}</ul> : <span className={styles.items}>{order.items} {order.items === 1 ? 'ornament' : 'ornaments'}</span>}
            <div className={styles.location}>
              <span>{web ? 'Web shop' : market || 'Stall'}</span>
              <span className={styles.meta}><StaffText>{`${market ? 'Stall · ' : ''}${date}${order.status === 'CANCELLED' ? ' · Cancelled' : ''}`}</StaffText></span>
            </div>
            <div className={styles.amount}>
              <strong className={styles.total}>{formatEur(order.total, 'en')}</strong>
              <span className={styles.payment} data-warning={order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' || undefined}><StaffText>{salePaymentLabel(order, amount => formatEur(amount, 'en'))}</StaffText></span>
            </div>
          </Link>
        </li>
      })}</ul>}
      {result.totalPages > 1 && <nav className={styles.pagination} aria-label="Sales pages">
        <Button tone="staff" variant="secondary" disabled={page === 0} onClick={() => update('page', String(page - 1))}>Previous</Button>
        <span aria-live="polite">{page + 1} / {result.totalPages}</span>
        <Button tone="staff" variant="secondary" disabled={page + 1 >= result.totalPages} onClick={() => update('page', String(page + 1))}>Next</Button>
      </nav>}
    </>}
  </section>
}

function SaleItem({ item }: { item: SaleItemPreview }) {
  const piece = item.marketOrnamentId ? marketOrnamentParts(item.marketOrnamentId) : null
  const color = item.color ?? piece?.color.key
  return <>
    {item.photoUrl ? <img className={styles.photo} src={item.photoUrl} alt="" loading="lazy" /> : color ?
      <span className={styles.swatch} style={{ background: `var(--ornament-${color})` }} role="img" aria-label={`${color} ornament`} /> : null}
    <span>{item.kind === 'custom' ? 'Custom' : 'Finished'}</span>
  </>
}
