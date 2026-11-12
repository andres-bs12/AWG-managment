import { useState } from 'react'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { SegmentedControl } from '../ui/SegmentedControl'
import { InsetNote } from '../public/PublicForm'
import { StaffDialog } from './StaffDialog'
import type { Order, PaymentMethod, PaymentState } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import styles from './OrderPaymentPanel.module.css'

type Props = { order: Order; busy: boolean; onSetState: (state: PaymentState, method: PaymentMethod | null, amountPaid?: number) => Promise<boolean> }
export function OrderPaymentPanel({ order, busy, onSetState }: Props) {
  const { paid, remaining } = paymentSummary(order)
  const [method, setMethod] = useState<PaymentMethod | null>(order.paymentMethod)
  const [deposit, setDeposit] = useState(String(Math.round(order.total * 50) / 100))
  const [state, setState] = useState<PaymentState>('paid')
  const [correction, setCorrection] = useState<PaymentState>('unpaid')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<PaymentState | null>(null)
  const pending = order.checkoutStatus === 'pending'
  const amount = Number(deposit.replace(',', '.'))
  function update(next: PaymentState, correcting = false) {
    setError('')
    if (next === 'deposit' && (!deposit.trim() || !Number.isFinite(amount) || amount <= 0 || amount >= order.total)) { setError('Enter an amount greater than zero and less than the total.'); return }
    if (correcting) { setConfirming(next); return }
    void onSetState(next, method, next === 'deposit' ? amount : undefined)
  }
  function confirmCorrection() {
    const next = confirming
    setConfirming(null)
    if (next) void onSetState(next, method, next === 'deposit' ? amount : undefined)
  }
  const methodField = <SegmentedControl legend="Method" name="payment-method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />
  const depositField = (id: string) => <Field label="Deposit received (€)" htmlFor={id}><input id={id} inputMode="decimal" value={deposit} disabled={busy} onChange={event => { setDeposit(event.target.value); setError('') }} /></Field>
  return <section className={styles.panel} aria-labelledby="payment-heading">
    <div className={styles.heading}><h2 id="payment-heading">Payment</h2><span>{remaining === 0 ? 'Paid' : order.paymentState === 'deposit' ? 'Deposit' : 'Unpaid'}</span></div>
    <dl className={styles.totals}><div><dt>Total</dt><dd>{formatEur(order.total, 'en')}</dd></div><div><dt>Received</dt><dd>{formatEur(paid, 'en')}</dd></div>{remaining > 0 && <div className={styles.balance}><dt>Remaining</dt><dd>{formatEur(remaining, 'en')}</dd></div>}</dl>
    {pending ? <InsetNote><p>Waiting for online payment. Check Stripe; staff cannot record a payment while Checkout is pending.</p></InsetNote> : <>
      {remaining > 0 && <div className={styles.collect}>
        <p>Record payment after checking the money arrived.</p>
        {/* A deposit order can only become paid: a one-option choice would look like a selected button. */}
        {order.paymentState === 'unpaid' ? <SegmentedControl legend="Record payment" name="record-state" value={state} onChange={setState} options={[{ value: 'paid', label: 'Paid' }, { value: 'deposit', label: 'Deposit' }]} /> : null}
        {methodField}{!method && <p>Choose cash or card to record a payment.</p>}{state === 'deposit' && depositField('payment-deposit')}
        <Button tone="staff" fullWidth disabled={busy || !method} onClick={() => update(state)}>{busy ? 'Saving…' : state === 'deposit' ? `Mark deposit · ${formatEur(Number.isFinite(amount) ? amount : 0, 'en')}` : `Mark paid · ${formatEur(remaining, 'en')}`}</Button>
      </div>}
      <details className={styles.collect}><summary>Correct payment</summary>
        <p>Use after checking the payment record. Corrections replace the recorded amount.</p>
        <SegmentedControl legend="Corrected payment state" name="correction-state" value={correction} onChange={setCorrection} options={[{ value: 'unpaid', label: 'Unpaid' }, { value: 'deposit', label: 'Deposit' }, { value: 'paid', label: 'Paid' }]} />
        {remaining === 0 && methodField}{correction === 'deposit' && depositField('correction-deposit')}
        <Button tone="staff" variant="secondary" disabled={busy} onClick={() => update(correction, true)}>Correct to {correction}{correction === 'deposit' && Number.isFinite(amount) ? ` · ${formatEur(amount, 'en')}` : ''}</Button>
      </details>
    </>}
    {error && <p role="alert">{error}</p>}
    {confirming && <StaffDialog title="Correct payment?" busy={busy} onClose={() => setConfirming(null)}>
      <p>Change the recorded payment of {order.code} to <strong>{confirming}{confirming === 'deposit' ? ` · ${formatEur(amount, 'en')}` : ''}</strong>. This replaces the recorded amount.</p>
      <Button tone="staff" disabled={busy} onClick={confirmCorrection}>Correct to {confirming}</Button>
    </StaffDialog>}
  </section>
}
