import { useRef, useState } from 'react'
import { api } from '../../api/client'
import type { PaymentMethod } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import { Button } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import { StaffDialog } from './StaffDialog'

type Bundle = Awaited<ReturnType<typeof api.orders.getOrderBundle>>
export function useHandover(onChanged: () => Promise<unknown> | void, onError: (message: string) => void) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Bundle | null>(null)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [error, setError] = useState('')
  // The dialog opens after an async check while the trigger is disabled, so remember it to return focus on dismiss.
  const trigger = useRef<HTMLElement | null>(null)
  function dismiss() {
    setPending(null)
    const target = trigger.current
    requestAnimationFrame(() => { if (target?.isConnected) target.focus() })
  }
  async function perform(id: string, target: boolean, collect = false) {
    if (lock.current) return
    lock.current = true; setBusy(true); onError(''); setError('')
    try {
      if (collect) await api.payments.setPaymentState(id, 'paid', method)
      await api.orders.setHandedOver(id, target)
      setPending(null)
      await onChanged()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update handover.'
      setError(message); onError(message)
    } finally { lock.current = false; setBusy(false) }
  }
  async function request(id: string, target: boolean) {
    if (lock.current) return
    if (!target) { await perform(id, false); return }
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lock.current = true; setBusy(true); onError('')
    let proceed = false
    try {
      const bundle = await api.orders.getOrderBundle(id)
      if (bundle.items.some(item => item.productionStatus !== 'finished')) throw new Error('Finish every ornament before handing over the order.')
      if (bundle.order.checkoutStatus === 'pending' || bundle.order.checkoutStatus === 'review' || bundle.order.paymentReview) throw new Error('Check the online payment in Stripe before handover.')
      if (paymentSummary(bundle.order).remaining > 0) { setPending(bundle); setMethod(bundle.order.paymentMethod ?? null); setError('') }
      else proceed = true
    } catch (err) { onError(err instanceof Error ? err.message : 'Could not check order balance.') }
    finally { lock.current = false; setBusy(false) }
    if (proceed) await perform(id, true)
  }
  const dialog = pending ? <StaffDialog title="Balance due" busy={busy} onClose={dismiss}>
    <p>{pending.order.code}: collect {formatEur(paymentSummary(pending.order).remaining, 'en')} before handing over the whole order.</p>
    <SegmentedControl legend="Collection method" name="handover-method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />
    {error && <p role="alert">{error}</p>}
    <Button tone="staff" disabled={busy || !method} onClick={() => void perform(pending.order.id, true, true)}>Mark paid &amp; hand over</Button>
    <Button tone="staff" variant="ghost" disabled={busy} onClick={() => void perform(pending.order.id, true)}>Hand over with balance due</Button>
    <Button tone="staff" variant="secondary" disabled={busy} onClick={dismiss}>Not yet</Button>
  </StaffDialog> : null
  return { request, busy, dialog }
}
