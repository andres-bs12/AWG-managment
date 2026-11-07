import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { SalesFilters, SalesPage as SalesResult } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
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
  const period: Period = params.get('period') === 'today' ? 'today' : params.get('period') === 'week' ? 'week' : 'all'
  const page = Math.max(0, Number.parseInt(params.get('page') ?? '0', 10) || 0)
  const [response, setResponse] = useState<{ result: SalesResult | null; error: string; key: string }>({ result: null, error: '', key: '' })
  const [retry, setRetry] = useState(0)
  const refresh = useStaffRefresh()
  const today = viennaDate(new Date())
  const requestKey = JSON.stringify([query, state, source, period, page, today, refresh, retry])
  const busy = response.key !== requestKey
  const error = busy ? '' : response.error
  const result = response.result

  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  useEffect(() => {
    let active = true
    const start = new Date(`${today}T12:00:00Z`)
    start.setUTCDate(start.getUTCDate() - 6)
    const from = period === 'today' ? today : period === 'week' ? start.toISOString().slice(0, 10) : undefined
    const timer = window.setTimeout(() => {
      void api.orders.listSales({ query, state, source, page, from, to: period === 'all' ? undefined : today }).then(next => {
        if (active) setResponse({ result: next, error: '', key: requestKey })
      }).catch(err => {
        if (active) setResponse({ result: null, error: err instanceof Error ? err.message : 'Could not load sales.', key: requestKey })
      })
    }, query ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query, state, source, period, page, today, refresh, retry, requestKey])

  // A stale or hand-edited ?page= past the end jumps back to the last page instead of an empty list.
  const lastPage = result && !busy && result.totalPages > 0 && page >= result.totalPages ? result.totalPages - 1 : null
  useEffect(() => {
    if (lastPage === null) return
    const next = new URLSearchParams(params)
    if (lastPage > 0) next.set('page', String(lastPage)); else next.delete('page')
    setParams(next, { replace: true })
  }, [lastPage, params, setParams])

  return <section className={styles.page}>
    <div className={styles.heading}><h1>Sales</h1><ButtonLink to="/staff/sales/new" tone="staff" variant="secondary">New sale</ButtonLink></div>
    <StaffFilters count={Number(Boolean(state)) + Number(Boolean(source)) + Number(period !== 'all')} inline={
      <Field label="Code, customer name or phone" htmlFor="sales-query" hint="Phone search needs at least three digits.">
        <input id="sales-query" type="search" placeholder="Code, name or phone" autoComplete="off" value={query} onChange={event => update('q', event.target.value)} />
      </Field>
    }>
    <div className={styles.filters}>
      <div className={styles.filterRow}>
        <Field label="Payment" htmlFor="sales-state"><select id="sales-state" value={state ?? ''} onChange={event => update('state', event.target.value)}>
          <option value="">All payments</option><option value="unpaid">Unpaid</option><option value="deposit">Deposit paid</option><option value="paid">Paid</option><option value="pending">Checkout pending</option><option value="review">Payment review</option>
        </select></Field>
        <Field label="Source" htmlFor="sales-source"><select id="sales-source" value={source ?? ''} onChange={event => update('source', event.target.value)}>
          <option value="">All sources</option><option value="stall">Stall</option><option value="web">Web</option>
        </select></Field>
      </div>
      <SegmentedControl legend="Created" value={period} name="sales-period" onChange={value => update('period', value)} options={[{ value: 'today', label: 'Today' }, { value: 'week', label: '7 days' }, { value: 'all', label: 'All' }]} />
    </div>
    </StaffFilters>
    {busy && <p role="status">Loading sales…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={() => setRetry(value => value + 1)}>Retry</Button></div>}
    {!busy && !error && result && <>
      {!result.orders.length ? <p role="status">No sales match these filters.</p> : <ul className={styles.list} aria-label="Sales results">{result.orders.map(order => <li key={order.id}>
        <Link className={styles.sale} to={`/staff/orders/${order.id}`} state={{ from: `/staff/sales?${params}` }}>
          <div className={styles.row}><strong>{order.customerName || 'Customer pending'}</strong><strong className={styles.total}>{formatEur(order.total, 'en')}</strong></div>
          <div className={styles.row}><span className={styles.code}>{order.code}</span><span className={styles.payment} data-warning={order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' || undefined}>{salePaymentLabel(order)}</span></div>
          <span className={styles.meta}><StaffText>{`${order.source === 'web' ? 'Web' : 'Stall'} · ${formatDateLabel(viennaDate(order.createdAt))}${order.status === 'CANCELLED' ? ' · Cancelled' : ''}`}</StaffText></span>
        </Link>
      </li>)}</ul>}
      {result.totalPages > 1 && <nav className={styles.pagination} aria-label="Sales pages">
        <Button tone="staff" variant="secondary" disabled={page === 0} onClick={() => update('page', String(page - 1))}>Previous</Button>
        <span aria-live="polite">{page + 1} / {result.totalPages}</span>
        <Button tone="staff" variant="secondary" disabled={page + 1 >= result.totalPages} onClick={() => update('page', String(page + 1))}>Next</Button>
      </nav>}
    </>}
  </section>
}
