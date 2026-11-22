import { useRef, useState } from 'react'
import { api } from '../../api/client'
import type { PaymentMethod } from '../../domain/types'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import { TRACKING_NUMBER_REGEX } from '../../lib/postShipping'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
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
  const [tracking, setTracking] = useState('')
  const [error, setError] = useState('')
  const trigger = useRef<HTMLElement | null>(null)
  function dismiss() {
    setPending(null)
    const target = trigger.current
    requestAnimationFrame(() => { if (target?.isConnected) target.focus() })
  }
  const postItems = pending?.bundle.items.filter(item => item.delivery.kind === 'post') ?? []
  const allPostFinished = postItems.length > 0 && postItems.every(item => item.productionStatus === 'finished')
  const unhandedPostIds = postItems.filter(item => !(item.handedOver ?? pending?.bundle.order.handedOver)).map(item => item.id)
  const hasSelectedPost = Boolean(pending?.target && postItems.some(item => selected.includes(item.id)))
  const cleanTracking = tracking.trim()
  const trackingInvalid = Boolean(hasSelectedPost && cleanTracking && !TRACKING_NUMBER_REGEX.test(cleanTracking))

  async function perform(ids: string[], collect = false) {
    if (lock.current || !pending || !ids.length) return
    if (pending.target && hasSelectedPost) {
      if (!allPostFinished || unhandedPostIds.some(id => !ids.includes(id))) {
        setError('Finish every ornament in the Post parcel before handing it to Post.')
        return
      }
      if (balance > 0 && !collect) {
        setError('Collect the remaining balance before handing the parcel to Post.')
        return
      }
    }
    if (trackingInvalid) {
      setError('Enter 8–40 letters or digits for the tracking number.')
      return
    }
    lock.current = true; setBusy(true); setError('')
    try {
      const sendTracking = hasSelectedPost && cleanTracking ? cleanTracking : undefined
      // One call: payment and handover land together, so the customer gets a single e-mail.
      await api.orders.setHandedOver(pending.bundle.order.id, pending.target, ids, sendTracking, collect && method ? method : undefined)
      setPending(null)
      await onChanged({ orderId: pending.bundle.order.id, code: pending.bundle.order.code, target: pending.target, itemIds: ids })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update handover.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function request(id: string, target: boolean, itemId?: string, initialIds?: string[], initialTracking?: string) {
    if (lock.current) return
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lock.current = true; setBusy(true); onError('')
    try {
      const bundle = await api.orders.getOrderBundle(id)
      if (target && (bundle.order.checkoutStatus === 'pending' || bundle.order.checkoutStatus === 'review' || bundle.order.paymentReview)) throw new Error('Check the online payment in Stripe before handover.')
      const bundlePostItems = bundle.items.filter(item => item.delivery.kind === 'post')
      const bundlePostReady = bundlePostItems.length > 0 && bundlePostItems.every(item => item.productionStatus === 'finished')
      if (target && itemId && bundlePostItems.some(item => item.id === itemId) && !bundlePostReady) {
        throw new Error('Finish every ornament in the Post parcel before handing it to Post.')
      }
      const eligible = bundle.items.filter(item =>
        (item.handedOver ?? bundle.order.handedOver) !== target &&
        (!target || (item.productionStatus === 'finished' && (item.delivery.kind !== 'post' || bundlePostReady))),
      )
      if (itemId && !eligible.some(item => item.id === itemId)) throw new Error('This ornament cannot be updated.')
      if (!eligible.length) {
        if (target && bundlePostItems.some(item => !(item.handedOver ?? bundle.order.handedOver)) && !bundlePostReady) {
          throw new Error('Finish every ornament in the Post parcel before handing it to Post.')
        }
        throw new Error('There are no eligible ornaments to update.')
      }
      let initial = itemId ? [itemId] : eligible.filter(item => !initialIds || initialIds.includes(item.id)).map(item => item.id)
      // A Post parcel ships all-or-nothing: selecting any Post item includes every unhanded Post item in the parcel.
      if (target && bundlePostItems.some(item => initial.includes(item.id))) {
        const allEligiblePost = eligible.filter(item => item.delivery.kind === 'post').map(item => item.id)
        initial = [...new Set([...initial, ...allEligiblePost])]
      }
      if (!initial.length) throw new Error('There are no eligible ornaments in these filters.')
      setSelected(initial)
      setPending({ bundle, target, itemId })
      setMethod(bundle.order.paymentMethod ?? null)
      setTracking(initialTracking ?? bundle.order.trackingNumber ?? '')
      setError('')
    } catch (err) { onError(err instanceof Error ? err.message : 'Could not check order.') }
    finally { lock.current = false; setBusy(false) }
  }
  const eligible = pending?.bundle.items.filter(item =>
    (item.handedOver ?? pending.bundle.order.handedOver) !== pending.target &&
    (!pending.target || (item.productionStatus === 'finished' && (item.delivery.kind !== 'post' || allPostFinished))),
  ) ?? []
  const balance = pending && pending.target ? paymentSummary(pending.bundle.order).remaining : 0
  const items = pending?.bundle.items ?? []
  const isAllPostParcel = Boolean(pending?.target && postItems.length > 0 && postItems.length === items.length)
  const label = (item: Bundle['items'][number]) => ornamentLabel({ kind: item.kind, backName: item.backName || item.petName })
  const why = (item: Bundle['items'][number]) => (item.handedOver ?? pending?.bundle.order.handedOver)
    ? (pending?.target ? 'Already handed over' : '')
    : pending?.target
      ? (handoverBlocker({ kind: item.kind, productionStatus: item.productionStatus, handedOver: false,
          waitingForCustomer: item.kind === 'custom' && (!item.photos.length || (item.withName && !item.backName)) })
        ?? (item.delivery.kind === 'post' && !allPostFinished ? 'Waiting for the rest of the parcel' : ''))
      : 'Not handed over'
  const count = selected.length
  const noun = `${count} ${count === 1 ? 'ornament' : 'ornaments'}`
  function toggleItem(item: Bundle['items'][number], checked: boolean) {
    if (pending?.target && item.delivery.kind === 'post') {
      const eligiblePostIds = eligible.filter(row => row.delivery.kind === 'post').map(row => row.id)
      setSelected(current => checked
        ? [...new Set([...current, ...eligiblePostIds])]
        : current.filter(id => !eligiblePostIds.includes(id)))
      return
    }
    setSelected(current => checked ? [...current, item.id] : current.filter(id => id !== item.id))
  }
  // One clear question, a checklist only when the order has several ornaments, and at most two actions.
  const dialog = pending ? <StaffDialog title={pending.target ? (hasSelectedPost ? 'Handed to Post' : 'Hand over') : 'Undo handover'} busy={busy} onClose={dismiss}>
    <p className={styles.lead}><StaffText>{`${pending.bundle.order.code} · ${customerLabel(pending.bundle.customer?.name)}`}</StaffText></p>
    {items.length > 1 && isAllPostParcel ? (
      <p>{`Mark all ${items.length} ornaments (${items.map(label).join(', ')}) as handed to Austrian Post?`}</p>
    ) : items.length > 1 ? <fieldset className={styles.pick}><legend>{pending.target ? (hasSelectedPost ? 'Which ornaments are in this parcel?' : 'Which ornaments does the customer take now?') : 'Which handovers should be undone?'}</legend>
      {items.map(item => {
        const available = eligible.some(row => row.id === item.id)
        return <label key={item.id} className={styles.pickRow} data-disabled={!available || undefined}>
          <input type="checkbox" checked={selected.includes(item.id)} disabled={busy || !available} onChange={event => toggleItem(item, event.target.checked)} />
          <span><strong>{label(item)}</strong>{!available && why(item) ? <>{' '}<small>{why(item)}</small></> : null}</span>
        </label>
      })}
    </fieldset> : <p>{pending.target ? (hasSelectedPost ? `Mark ${label(items[0] ?? eligible[0])} as handed to Austrian Post?` : `Hand ${label(items[0] ?? eligible[0])} to the customer?`) : `Mark ${label(items[0] ?? eligible[0])} as not handed over?`}</p>}
    {hasSelectedPost && (
      <Field label="Post tracking number (optional)" htmlFor="handover-tracking" error={trackingInvalid ? 'Enter 8–40 letters or digits.' : undefined}>
        <input id="handover-tracking" value={tracking} autoComplete="off" disabled={busy} onChange={event => { setTracking(event.target.value); setError('') }} />
      </Field>
    )}
    {balance > 0 && <div className={styles.due}>
      <p><strong>{`Still to pay: ${formatEur(balance, 'en')}`}</strong></p>
      {hasSelectedPost && <p>Collect the remaining balance before handing the parcel to Post.</p>}
      <SegmentedControl legend="Paid with" name="handover-method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }]} />
    </div>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.actions}>
      {balance > 0 && !hasSelectedPost && <Button tone="staff" variant="secondary" disabled={busy || !count || trackingInvalid} onClick={() => void perform(selected)}>Hand over, collect later</Button>}
      {balance > 0
        ? <Button tone="staff" disabled={busy || !method || !count || trackingInvalid} onClick={() => void perform(selected, true)}>{`Collect ${formatEur(balance, 'en')} & ${hasSelectedPost ? 'hand to Post' : 'hand over'}`}</Button>
        : <Button tone="staff" disabled={busy || !count || trackingInvalid} onClick={() => void perform(selected)}>{pending.target ? (hasSelectedPost ? 'Handed to Post' : (items.length > 1 ? `Hand over ${noun}` : 'Hand over')) : (items.length > 1 ? `Undo ${noun}` : 'Undo handover')}</Button>}
    </div>
  </StaffDialog> : null
  return { request, busy, dialog }
}
