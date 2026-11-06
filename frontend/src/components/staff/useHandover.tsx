import { useRef, useState } from 'react'
import { api } from '../../api/client'
import type { PaymentMethod } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import { Button } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import { StaffDialog } from './StaffDialog'

type Bundle = Awaited<ReturnType<typeof api.orders.getOrderBundle>>
type Pending = { bundle: Bundle; target: boolean; itemId?: string }
export function useHandover(onChanged: () => Promise<unknown> | void, onError: (message: string) => void) {
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
      await onChanged()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update handover.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function request(id: string, target: boolean, itemId?: string) {
    if (lock.current) return
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lock.current = true; setBusy(true); onError('')
    try {
      const bundle = await api.orders.getOrderBundle(id)
      if (target && (bundle.order.checkoutStatus === 'pending' || bundle.order.checkoutStatus === 'review' || bundle.order.paymentReview)) throw new Error('Check the online payment in Stripe before handover.')
      const eligible = bundle.items.filter(item => (item.handedOver ?? bundle.order.handedOver) !== target && (!target || item.productionStatus === 'finished'))
      if (itemId && !eligible.some(item => item.id === itemId)) throw new Error('This ornament cannot be updated.')
      if (!eligible.length) throw new Error('There are no eligible ornaments to update.')
      setSelected(itemId ? [itemId] : eligible.map(item => item.id))
      setPending({ bundle, target, itemId }); setMethod(bundle.order.paymentMethod ?? null); setError('')
    } catch (err) { onError(err instanceof Error ? err.message : 'Could not check order.') }
    finally { lock.current = false; setBusy(false) }
  }
  const eligible = pending?.bundle.items.filter(item => (item.handedOver ?? pending.bundle.order.handedOver) !== pending.target && (!pending.target || item.productionStatus === 'finished')) ?? []
  const otherItems = pending?.itemId ? pending.bundle.items.filter(item => item.id !== pending.itemId && (item.handedOver ?? pending.bundle.order.handedOver) !== pending.target) ?? [] : []
  const balance = pending && pending.target ? paymentSummary(pending.bundle.order).remaining : 0
  const dialog = pending ? <StaffDialog title={pending.target ? 'Confirm handover' : 'Undo handover'} busy={busy} onClose={dismiss} preventEscape>
    <p>{pending.bundle.order.code}</p>
    {pending.itemId && otherItems.length > 0 && <p>{otherItems.length} more {otherItems.length === 1 ? 'item' : 'items'} of this order {otherItems.length === 1 ? 'is' : 'are'} still {pending.target ? 'to hand over' : 'handed over'}.</p>}
    <fieldset><legend>{pending.target ? 'Select ornaments to hand over' : 'Select ornaments to undo'}</legend>
      {pending.bundle.items.map(item => {
        const available = eligible.some(row => row.id === item.id)
        return <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 'var(--touch-lg)' }}><input type="checkbox" checked={selected.includes(item.id)} disabled={busy || !available} onChange={event => setSelected(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} />{item.petName || (item.kind === 'custom' ? 'Custom ornament' : 'Finished ornament')}{!available ? ((item.handedOver ?? pending.bundle.order.handedOver) ? ' · Handed over' : (pending.target ? ' · Not ready' : ' · Not handed over')) : ''}</label>
      })}
    </fieldset>
    {balance > 0 && <><p>Balance due: {formatEur(balance, 'en')}.</p><SegmentedControl legend="Collection method" name="handover-method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} /></>}
    {error && <p role="alert">{error}</p>}
    {balance > 0 && <Button tone="staff" disabled={busy || !method || !selected.length} onClick={() => void perform(selected, true)}>Mark paid &amp; hand over</Button>}
    <Button tone="staff" variant={balance > 0 ? 'ghost' : 'primary'} disabled={busy || !selected.length} onClick={() => void perform(selected)}>{balance > 0 ? 'Hand over with balance due' : 'Save'}</Button>
    {pending.itemId && otherItems.length > 0 && <Button tone="staff" variant="secondary" disabled={busy} onClick={() => void perform([pending.itemId!])}>Only this one</Button>}
    <Button tone="staff" variant="secondary" disabled={busy} onClick={dismiss}>Not yet</Button>
  </StaffDialog> : null
  return { request, busy, dialog }
}
