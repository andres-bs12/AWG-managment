import { StaffText } from '../../components/staff/StaffText'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { OrderSummary } from '../../domain/types'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { formatEur } from '../../lib/money'
import { formatDateLabel } from '../../lib/time'
import { Field } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import styles from './OrderLookupPage.module.css'


const PAYMENT_LABEL: Record<string, string> = { unpaid: 'Unpaid', deposit: 'Deposit paid', paid: 'Paid' }
export function OrderLookupPage({ attention = false }: { attention?: boolean }) {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [rows, setRows] = useState<OrderSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const version = useStaffRefresh()
  const navigate = useNavigate()
  useEffect(() => {
    if (attention || busy || error) return
    const code = query.trim().toUpperCase()
    if (!/^AWG[A-Z0-9]{4,}$/.test(code)) return
    const exact = rows.filter(row => row.code.toUpperCase() === code)
    if (exact.length === 1) navigate(`/staff/orders/${exact[0].id}`, { replace: true, state: { from: `/staff/search?${params}` } })
  }, [attention, busy, error, navigate, params, query, rows])
  useEffect(() => {
    let active = true
    if (!attention && query.trim().length < 2) { setRows([]); setBusy(false); setError(''); return }
    setBusy(true); setError(''); setRows([])
    const timer = window.setTimeout(() => {
      void (attention ? api.orders.attention() : api.orders.search(query)).then(next => {
        if (active) setRows(next)
      }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load orders.') }).finally(() => { if (active) setBusy(false) })
    }, attention ? 0 : 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [attention, query, version, retry])
  return <section className={styles.page}>
    <StaffBackLink to="/staff/agenda" label="Agenda" />
    <h1>{attention ? 'Needs attention' : 'Search orders'}</h1>
    {attention ? <div className={styles.explain}><p>Web shop orders whose payment is not settled yet. You only act on <strong>Payment review</strong>.</p><ul><li><strong>Waiting for online payment:</strong> the customer is on the Stripe page. Their painting time is held for 15 minutes, then released on its own. Nothing to do.</li><li><strong>Payment review:</strong> Stripe received a different amount than the order total. Check the payment in Stripe, then record it on the order.</li></ul></div> : <Field label="Code, customer name or phone" htmlFor="order-query" hint={rows.length ? undefined : 'Enter at least two characters; phone search needs three digits.'}><input id="order-query" type="search" autoComplete="off" value={query} onChange={event => setParams({ q: event.target.value }, { replace: true })} /></Field>}
    {busy && <p role="status">Searching orders…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={() => setRetry(n => n + 1)}>Retry</Button></div>}
    {!busy && !error && !rows.length && (attention || query.trim().length >= 2) && <p role="status">{attention ? 'No orders need attention.' : 'No matching orders.'}</p>}
    <ul className={styles.list} aria-busy={busy}>{!busy && !error && rows.map(row => <li key={row.id}><Link className={styles.result} to={`/staff/orders/${row.id}`} state={{ from: attention ? '/staff/attention' : `/staff/search?${params}` }}>
      <strong><StaffText>{`${row.code} · ${row.customerName || 'Customer pending'}`}</StaffText></strong>
      <span><StaffText>{`${row.phone || 'Phone pending'} · ${row.items} ${row.items === 1 ? 'ornament' : 'ornaments'} · ${formatEur(row.total, 'en')}`}</StaffText></span>
      <span><StaffText>{`${row.checkoutStatus === 'review' ? 'Payment review — check Stripe' : row.checkoutStatus === 'pending' ? 'Waiting for online payment' : row.handedOver ? 'Handed over' : PAYMENT_LABEL[row.paymentState] ?? row.paymentState} · ${row.nextHandoffDate ? `Handoff ${formatDateLabel(row.nextHandoffDate)}` : 'Handoff not scheduled'}`}</StaffText></span>
    </Link></li>)}</ul>
  </section>
}
