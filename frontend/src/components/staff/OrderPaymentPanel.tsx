import { useState } from 'react'
import { Button } from '../ui/Button'
import type { Order, PaymentMethod, PaymentState } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import styles from './OrderPaymentPanel.module.css'

type Props = {
  order: Order
  busy: boolean
  onSetState: (state: PaymentState, method: PaymentMethod | null, amountPaid?: number) => Promise<boolean>
}

export function OrderPaymentPanel({ order, busy, onSetState }: Props) {
  const { paid, remaining } = paymentSummary(order)
  const [method, setMethod] = useState<PaymentMethod | null>(order.paymentMethod)
  const [deposit, setDeposit] = useState(String(Math.round((order.total / 2) * 100) / 100))
  const [error, setError] = useState('')

  return (
    <section className={styles.panel} aria-labelledby="payment-heading">
      <div className={styles.heading}><h2 id="payment-heading">Payment</h2><span>{remaining === 0 ? 'Paid' : order.paymentState === 'deposit' ? 'Deposit' : 'Unpaid'}</span></div>
      <dl className={styles.totals}>
        <div><dt>Total</dt><dd>{formatEur(order.total)}</dd></div>
        <div><dt>Received</dt><dd>{formatEur(paid)}</dd></div>
        {remaining > 0 ? <div className={styles.balance}><dt>Remaining</dt><dd>{formatEur(remaining)}</dd></div> : null}
      </dl>
      {remaining > 0 ? <div className={styles.collect}>
        <p>Mark the payment once you have checked the money arrived.</p>
        <fieldset className={styles.methods} disabled={busy}>
          <legend>Method (optional)</legend>
          {(['cash', 'card'] as const).map(value => <label key={value}><input type="radio" name="payment-method" value={value} checked={method === value} onChange={() => setMethod(value)} />{value === 'cash' ? 'Cash' : 'Card'}</label>)}
        </fieldset>
        {order.paymentState === 'unpaid' ? <><label>Deposit received (€) <input type="number" min="0.01" step="0.01" value={deposit} disabled={busy} onChange={event => { setDeposit(event.target.value); setError('') }} aria-invalid={Boolean(error)} /></label>{error && <p role="alert">{error}</p>}<Button tone="staff" variant="secondary" fullWidth disabled={busy} onClick={() => { const amount = Number(deposit); if (!deposit.trim() || !Number.isFinite(amount) || amount <= 0 || amount >= order.total) { setError('Enter an amount greater than zero and less than the total.'); return } void onSetState('deposit', method, amount) }}>Mark deposit</Button></> : null}
        <Button tone="staff" fullWidth disabled={busy} onClick={() => void onSetState('paid', method)}>{busy ? 'Saving…' : 'Mark paid'}</Button>
      </div> : order.paymentMethod ? <p className={styles.legacy}>Paid · {order.paymentMethod === 'cash' ? 'Cash' : 'Card'}</p> : null}
      <div className={styles.collect}><p>Correct a payment state after checking the record.</p>{(['unpaid', 'deposit', 'paid'] as const).filter(state => state !== order.paymentState).map(state => <Button key={state} tone="staff" variant="secondary" disabled={busy || state === order.paymentState} onClick={() => { const amount = Number(deposit); if (state === 'deposit' && (!Number.isFinite(amount) || amount <= 0 || amount >= order.total)) { setError('Enter a valid deposit amount.'); return } if (window.confirm(`Change payment state to ${state}?`)) void onSetState(state, method, state === 'deposit' ? amount : undefined) }}>Change to {state}</Button>)}{error && <p role="alert">{error}</p>}</div>
    </section>
  )
}
