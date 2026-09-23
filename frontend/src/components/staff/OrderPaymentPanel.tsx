import { useState } from 'react'
import { Button } from '../ui/Button'
import type { Order, PaymentMethod } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import styles from './OrderPaymentPanel.module.css'

type Props = { order: Order; busy: boolean; onRecord: (amount: number, method: PaymentMethod) => Promise<boolean> }

export function OrderPaymentPanel({ order, busy, onRecord }: Props) {
  const { paid, remaining } = paymentSummary(order)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const numericAmount = Number(amount.replace(',', '.'))
  const validAmount = Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount <= remaining
  const invalid = amount !== '' && !validAmount
  const entries = order.paymentEntries ?? []

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!method || !validAmount || busy) return
    if (await onRecord(numericAmount, method)) setAmount('')
  }

  return (
    <section className={styles.panel} aria-labelledby="payment-heading">
      <div className={styles.heading}><h2 id="payment-heading">Payment</h2><span>{remaining === 0 ? 'Paid' : paid > 0 ? 'Part paid' : 'Unpaid'}</span></div>
      <dl className={styles.totals}>
        <div><dt>Total</dt><dd>{formatEur(order.total)}</dd></div>
        <div><dt>Received</dt><dd>{formatEur(paid)}</dd></div>
        {remaining > 0 ? <div className={styles.balance}><dt>Remaining</dt><dd>{formatEur(remaining)}</dd></div> : null}
      </dl>
      {remaining > 0 ? <details className={styles.collect}>
        <summary>Record a payment</summary>
        <form onSubmit={event => void submit(event)}>
          <fieldset disabled={busy} className={styles.fields}>
            <label htmlFor="amount-received">Amount received</label>
            <div className={styles.amount}>
              <span aria-hidden="true">€</span>
              <input id="amount-received" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-invalid={invalid} aria-describedby={invalid ? 'payment-error' : undefined} />
            </div>
            {invalid ? <p id="payment-error" role="alert" className={styles.error}>Enter an amount between €0.01 and {formatEur(remaining)}.</p> : null}
            <Button tone="staff" variant="ghost" onClick={() => setAmount(String(remaining))}>Use remaining {formatEur(remaining)}</Button>
            <fieldset className={styles.methods}>
              <legend>Method</legend>
              {(['cash', 'card'] as const).map(value => <label key={value}><input type="radio" name="payment-method" value={value} checked={method === value} onChange={() => setMethod(value)} />{value === 'cash' ? 'Cash' : 'Card'}</label>)}
            </fieldset>
            <Button tone="staff" type="submit" fullWidth disabled={busy || !method || !validAmount}>{busy ? 'Saving…' : 'Record payment'}</Button>
          </fieldset>
        </form>
      </details> : null}
      {entries.length > 0 ? <details className={styles.history}>
        <summary>Payment history · {entries.length}</summary>
        {order.paymentOpeningBalance ? <p>Previously recorded: {formatEur(order.paymentOpeningBalance)}</p> : null}
        <ul>{entries.map(entry => <li key={entry.id}><strong>{formatEur(entry.amount)} · {entry.method === 'cash' ? 'Cash' : 'Card'}</strong><span>{new Date(entry.recordedAt).toLocaleString('en-GB')}</span></li>)}</ul>
      </details> : paid > 0 ? <p className={styles.legacy}>Payment recorded{order.paymentMethod ? ` · ${order.paymentMethod === 'cash' ? 'Cash' : 'Card'}` : ''}</p> : null}
    </section>
  )
}
