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

type Props = { order: Order; busy: boolean; onSetState: (state: PaymentState, method: PaymentMethod | null, amountPaid?: number) => Promise<boolean>; onSetPrice?: (chargedTotal: number) => Promise<boolean> }
export function OrderPaymentPanel({ order, busy, onSetState, onSetPrice }: Props) {
  const { paid, remaining } = paymentSummary(order)
  const [methodDraft, setMethod] = useState<PaymentMethod | null | undefined>(undefined)
  const method = methodDraft === undefined ? order.paymentMethod : methodDraft
  // Until staff type an amount, the field follows the order, so a refresh from another iPad never leaves a stale value.
  const [depositDraft, setDeposit] = useState<string | null>(null)
  const deposit = depositDraft ?? String(order.paymentState === 'deposit' ? paid : Math.round(order.total * 50) / 100)
  const [chosenState, setState] = useState<PaymentState>('paid')
  const [chosenCorrection, setCorrection] = useState<PaymentState | null>(null)
  // A deposit order can only be completed; the choice only applies while nothing was received.
  const state: PaymentState = order.paymentState === 'unpaid' ? chosenState : 'paid'
  // The correction starts on the recorded state, so it never suggests a change nobody picked.
  const correction: PaymentState = chosenCorrection ?? order.paymentState
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<PaymentState | null>(null)
  const discount = order.discount ?? 0
  const listPrice = Math.round((order.total + discount) * 100) / 100
  const [priceDraft, setPriceDraft] = useState('')
  const [confirmPrice, setConfirmPrice] = useState(false)
  // Corrections are rare: two plain buttons, and the chosen form opens below them (one at a time).
  const [open, setOpen] = useState<'correct' | 'price' | null>(null)
  const canChangePrice = Boolean(onSetPrice) && order.source !== 'web'
  const newPrice = priceDraft.trim() ? Number(priceDraft.trim().replace(',', '.')) : NaN
  const priceError = !priceDraft.trim() ? '' : !Number.isFinite(newPrice) || newPrice < 0 ? 'Enter a price in euros.' : newPrice > listPrice ? `Enter at most the list price (${formatEur(listPrice, 'en')}).` : ''
  const priceValid = priceDraft.trim() !== '' && !priceError && Math.round(newPrice * 100) / 100 !== order.total
  const pending = order.checkoutStatus === 'pending'
  const amount = Number(deposit.replace(',', '.'))
  const unchanged = correction === order.paymentState && method === order.paymentMethod && (correction !== 'deposit' || amount === paid)
  function update(next: PaymentState, correcting = false) {
    setError('')
    if (next === 'deposit' && (!deposit.trim() || !Number.isFinite(amount) || amount <= 0 || amount >= order.total)) { setError('Enter an amount greater than zero and less than the total.'); return }
    if (correcting) { setConfirming(next); return }
    void onSetState(next, method, next === 'deposit' ? amount : undefined).then(ok => { if (ok) { setDeposit(null); setMethod(undefined) } })
  }
  function confirmCorrection() {
    const next = confirming
    setConfirming(null)
    if (next) void onSetState(next, method, next === 'deposit' ? amount : undefined).then(ok => { if (ok) { setCorrection(null); setDeposit(null); setMethod(undefined); setOpen(null) } })
  }
  const methodField = <SegmentedControl legend="Method" name="payment-method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />
  const depositField = (id: string) => <Field label="Deposit received (€)" htmlFor={id}><input id={id} inputMode="decimal" value={deposit} disabled={busy} onChange={event => { setDeposit(event.target.value); setError('') }} /></Field>
  return <section className={styles.panel} aria-labelledby="payment-heading">
    <div className={styles.heading}><h2 id="payment-heading">Payment</h2><span>{remaining === 0 ? 'Paid' : order.paymentState === 'deposit' ? 'Deposit' : 'Unpaid'}</span></div>
    <dl className={styles.totals}>{discount > 0 && <><div><dt>List price</dt><dd>{formatEur(listPrice, 'en')}</dd></div><div><dt>Discount</dt><dd>−{formatEur(discount, 'en')}</dd></div></>}<div><dt>Total</dt><dd>{formatEur(order.total, 'en')}</dd></div><div><dt>Received</dt><dd>{formatEur(paid, 'en')}</dd></div>{remaining > 0 && <div className={styles.balance}><dt>Remaining</dt><dd>{formatEur(remaining, 'en')}</dd></div>}</dl>
    {pending ? <InsetNote><p>Waiting for online payment. Check Stripe; staff cannot record a payment while Checkout is pending.</p></InsetNote> : <>
      {remaining > 0 && <div className={styles.collect}>
        <p>Record payment after checking the money arrived.</p>
        {/* A deposit order can only become paid: a one-option choice would look like a selected button. */}
        {order.paymentState === 'unpaid' ? <SegmentedControl legend="Record payment" name="record-state" value={state} onChange={setState} options={[{ value: 'paid', label: 'Paid' }, { value: 'deposit', label: 'Deposit' }]} /> : null}
        {methodField}{!method && <p>Choose cash or card to record a payment.</p>}{state === 'deposit' && depositField('payment-deposit')}
        <Button tone="staff" fullWidth disabled={busy || !method} onClick={() => update(state)}>{busy ? 'Saving…' : state === 'deposit' ? `Mark deposit · ${formatEur(Number.isFinite(amount) ? amount : 0, 'en')}` : `Mark paid · ${formatEur(remaining, 'en')}`}</Button>
      </div>}
      <div className={styles.corrections}>
        <Button tone="staff" variant="secondary" aria-expanded={open === 'correct'} onClick={() => setOpen(open === 'correct' ? null : 'correct')}>Correct payment</Button>
        {canChangePrice && <Button tone="staff" variant="secondary" aria-expanded={open === 'price'} onClick={() => setOpen(open === 'price' ? null : 'price')}>Change price</Button>}
      </div>
      {open === 'correct' && <div className={styles.correctionForm}>
        <p>Use after checking the payment record. Corrections replace the recorded amount.</p>
        <SegmentedControl legend="Corrected payment state" name="correction-state" value={correction} onChange={setCorrection} options={[{ value: 'unpaid', label: 'Unpaid' }, { value: 'deposit', label: 'Deposit' }, { value: 'paid', label: 'Paid' }]} />
        {remaining === 0 && methodField}{correction === 'deposit' && depositField('correction-deposit')}
        <Button tone="staff" variant="secondary" disabled={busy || unchanged} onClick={() => update(correction, true)}>Correct to {correction}{correction === 'deposit' && Number.isFinite(amount) ? ` · ${formatEur(amount, 'en')}` : ''}</Button>
      </div>}
      {open === 'price' && canChangePrice && <div className={styles.correctionForm}>
        <p>For a discount agreed with the customer. Revenue, stats and the received amount follow the new price.</p>
        <Field label="New total (€)" htmlFor="order-new-price" hint={`List price ${formatEur(listPrice, 'en')}`} error={priceError || undefined}><input id="order-new-price" inputMode="decimal" placeholder={String(order.total).replace('.', ',')} value={priceDraft} disabled={busy} onChange={event => setPriceDraft(event.target.value)} /></Field>
        <Button tone="staff" variant="secondary" disabled={busy || !priceValid} onClick={() => setConfirmPrice(true)}>{priceValid ? `Change price to ${formatEur(newPrice, 'en')}` : 'Save new price'}</Button>
      </div>}
    </>}
    {error && <p role="alert">{error}</p>}
    {confirmPrice && onSetPrice && <StaffDialog title="Change price?" busy={busy} onClose={() => setConfirmPrice(false)}>
      <p>Change the total of {order.code} from <strong>{formatEur(order.total, 'en')}</strong> to <strong>{formatEur(newPrice, 'en')}</strong>{newPrice < listPrice ? ` (discount ${formatEur(Math.round((listPrice - newPrice) * 100) / 100, 'en')})` : ''}. {order.paymentState !== 'unpaid' && newPrice < (order.amountPaid ?? 0) ? 'The received amount is updated too; give back the difference in cash.' : ''}{order.paymentState !== 'unpaid' && newPrice > (order.amountPaid ?? 0) ? `${formatEur(Math.round((newPrice - (order.amountPaid ?? 0)) * 100) / 100, 'en')} is still to collect.` : ''}</p>
      <Button tone="staff" disabled={busy} onClick={() => { setConfirmPrice(false); void onSetPrice(Math.round(newPrice * 100) / 100).then(ok => { if (ok) { setPriceDraft(''); setOpen(null) } }) }}>Change price</Button>
    </StaffDialog>}
    {confirming && <StaffDialog title="Correct payment?" busy={busy} onClose={() => setConfirming(null)}>
      <p>Change the recorded payment of {order.code} to <strong>{confirming}{confirming === 'deposit' ? ` · ${formatEur(amount, 'en')}` : ''}</strong>. This replaces the recorded amount.</p>
      <Button tone="staff" disabled={busy} onClick={confirmCorrection}>Correct to {confirming}</Button>
    </StaffDialog>}
  </section>
}
