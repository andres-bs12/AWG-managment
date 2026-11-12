import { useRef, useState } from 'react'
import { api } from '../../api/client'
import type { PaymentMethod } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import { Button } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import { StaffDialog } from './StaffDialog'
import { StaffText } from './StaffText'
import { customerLabel, handoverBlocker, ornamentLabel } from '../../lib/deliveryFacts'
import styles from './CompleteOrderDialog.module.css'

type Bundle = Awaited<ReturnType<typeof api.orders.getOrderBundle>>
type Pending = { bundle: Bundle; target: boolean; itemId?: string }
export function useHandover(onChanged: (change: { orderId: string; code: string; target: boolean; itemIds: string[] }) => Promise<unknown> | void, onError: (message: string) => void) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [error, setError] = useState('')
  const trigger = useRef<HTMLElement | null>(null)
  function dismiss() {
    setPending(null)
    const target = trigger.current
    requestAnimationFrame(() => { if (target?.isConnected) target.focus() })
  }
  async function perform(ids: string[], collect = false) {
    if (lock.current || !pending || !ids.length) return
    lock.current = true; setBusy(true); setError('')
    try {
      if (collect) await api.payments.setPaymentState(pending.bundle.order.id, 'paid', method)
      await api.orders.setHandedOver(pending.bundle.order.id, pending.target, ids)
      setPending(null)
      await onChanged({ orderId: pending.bundle.order.id, code: pending.bundle.order.code, target: pending.target, itemIds: ids })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update handover.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function request(id: string, target: boolean, itemId?: string, initialIds?: string[]) {
    if (lock.current) return
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lock.current = true; setBusy(true); onError('')
    try {
      const bundle = await api.orders.getOrderBundle(id)
      if (target && (bundle.order.checkoutStatus === 'pending' || bundle.order.checkoutStatus === 'review' || bundle.order.paymentReview)) throw new Error('Check the online payment in Stripe before handover.')
      const eligible = bundle.items.filter(item => (item.handedOver ?? bundle.order.handedOver) !== target && (!target || item.productionStatus === 'finished'))
      if (itemId && !eligible.some(item => item.id === itemId)) throw new Error('This ornament cannot be updated.')
      if (!eligible.length) throw new Error('There are no eligible ornaments to update.')
      const initial = itemId ? [itemId] : eligible.filter(item => !initialIds || initialIds.includes(item.id)).map(item => item.id)
      if (!initial.length) throw new Error('There are no eligible ornaments in these filters.')
      setSelected(initial)
      setPending({ bundle, target, itemId }); setMethod(bundle.order.paymentMethod ?? null); setError('')
    } catch (err) { onError(err instanceof Error ? err.message : 'Could not check order.') }
    finally { lock.current = false; setBusy(false) }
  }
  const eligible = pending?.bundle.items.filter(item => (item.handedOver ?? pending.bundle.order.handedOver) !== pending.target && (!pending.target || item.productionStatus === 'finished')) ?? []
  const balance = pending && pending.target ? paymentSummary(pending.bundle.order).remaining : 0
  const items = pending?.bundle.items ?? []
  const label = (item: Bundle['items'][number]) => ornamentLabel({ kind: item.kind, backName: item.backName || item.petName })
  const why = (item: Bundle['items'][number]) => (item.handedOver ?? pending?.bundle.order.handedOver)
    ? (pending?.target ? 'Already handed over' : '')
    : pending?.target ? (handoverBlocker({ kind: item.kind, productionStatus: item.productionStatus, handedOver: false,
      waitingForCustomer: item.kind === 'custom' && (!item.photos.length || (item.withName && !item.backName)) }) ?? '') : 'Not handed over'
  const count = selected.length
  const noun = `${count} ${count === 1 ? 'ornament' : 'ornaments'}`
  // One clear question, a checklist only when the order has several ornaments, and at most two actions.
  const dialog = pending ? <StaffDialog title={pending.target ? 'Hand over' : 'Undo handover'} busy={busy} onClose={dismiss}>
    <p className={styles.lead}><StaffText>{`${pending.bundle.order.code} · ${customerLabel(pending.bundle.customer?.name)}`}</StaffText></p>
    {items.length > 1 ? <fieldset className={styles.pick}><legend>{pending.target ? 'Which ornaments does the customer take now?' : 'Which handovers should be undone?'}</legend>
      {items.map(item => {
        const available = eligible.some(row => row.id === item.id)
        return <label key={item.id} className={styles.pickRow} data-disabled={!available || undefined}>
          <input type="checkbox" checked={selected.includes(item.id)} disabled={busy || !available} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />
          <span><strong>{label(item)}</strong>{!available && why(item) ? <>{' '}<small>{why(item)}</small></> : null}</span>
        </label>
      })}
    </fieldset> : <p>{pending.target ? `Hand ${label(items[0] ?? eligible[0])} to the customer?` : `Mark ${label(items[0] ?? eligible[0])} as not handed over?`}</p>}
    {balance > 0 && <div className={styles.due}>
      <p><strong>{`Still to pay: ${formatEur(balance, 'en')}`}</strong></p>
      <SegmentedControl legend="Paid with" name="handover-method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />
    </div>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.actions}>
      {balance > 0 && <Button tone="staff" variant="secondary" disabled={busy || !count} onClick={() => void perform(selected)}>Hand over, collect later</Button>}
      {balance > 0
        ? <Button tone="staff" disabled={busy || !method || !count} onClick={() => void perform(selected, true)}>{`Collect ${formatEur(balance, 'en')} & hand over`}</Button>
        : <Button tone="staff" disabled={busy || !count} onClick={() => void perform(selected)}>{pending.target ? (items.length > 1 ? `Hand over ${noun}` : 'Hand over') : (items.length > 1 ? `Undo ${noun}` : 'Undo handover')}</Button>}
    </div>
  </StaffDialog> : null
  return { request, busy, dialog }
}
