import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { StaffDialog } from '../../components/staff/StaffDialog'
import { CustomerHandoff } from '../../components/staff/CustomerHandoff'
import { useItemStatus } from '../../components/staff/useItemStatus'
import { useHandover } from '../../components/staff/useHandover'
import { InsetNote } from '../../components/public/PublicForm'
import { OrderItemCard } from '../../components/staff/OrderItemCard'
import { OrderPaymentPanel } from '../../components/staff/OrderPaymentPanel'
import { QrCode } from '../../components/staff/QrCode'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { MarketDay } from '../../domain/types'
import { handoffLabel } from '../../lib/handoff'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import styles from './OrderDetailPage.module.css'

type Bundle = Awaited<ReturnType<typeof api.orders.getOrderBundle>>

export function OrderDetailPage() {
  const { id = '' } = useParams()
  return <OrderDetail key={id} id={id} />
}

function OrderDetail({ id }: { id: string }) {
  const version = useStaffRefresh()
  const location = useLocation()
  const navigate = useNavigate()
  const navigationState = location.state as { from?: string; itemId?: string } | undefined
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [days, setDays] = useState<MarketDay[]>([])
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const actionLock = useRef(false)
  const [copied, setCopied] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.orders.getOrderBundle(id), api.markets.listMarketDays()])
      .then(([next, marketDays]) => {
        if (cancelled) return
        setBundle(next)
        setDays(marketDays)
        setLoadError('')
      })
      .catch((err: Error) => { if (!cancelled) setLoadError(err.message) })
    return () => { cancelled = true }
  }, [id, version, retry])

  async function runAction(action: () => Promise<unknown>, message: string) {
    if (actionLock.current) return false
    actionLock.current = true
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      await action()
      setBundle(await api.orders.getOrderBundle(id))
      setNotice(message)
      return true
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not save. Please try again.')
      return false
    } finally {
      actionLock.current = false
      setBusy(false)
    }
  }

  const itemStatus = useItemStatus(bundle, (itemId, status, message) => runAction(() => api.orders.setItemStatus(id, itemId, status), message), busy)
  const handover = useHandover(async () => { setBundle(await api.orders.getOrderBundle(id)); setNotice('Handover updated.') }, setActionError)

  if (!bundle) return <section className={styles.page}><StaffBackLink />{loadError ? <><p role="alert">{loadError}</p><Button tone="staff" onClick={() => setRetry(value => value + 1)}>Try again</Button></> : <p role="status">Loading order…</p>}</section>

  const { order, customer, blocks } = bundle
  const items = [...bundle.items].sort((a, b) => Number(b.id === navigationState?.itemId) - Number(a.id === navigationState?.itemId))
  const { remaining } = paymentSummary(order)
  const finishedCount = items.filter(item => item.productionStatus === 'finished').length
  const allFinished = items.length > 0 && finishedCount === items.length
  const formWaiting = items.some(item => item.kind === 'custom' && !item.formComplete)
  const hasForm = items.some(item => item.kind === 'custom')
  const deliveryItem = items.find(item => item.delivery.kind === 'vienna')
  const deliveryAddress = deliveryItem?.delivery.address
  const addressText = deliveryAddress ? [
    [deliveryAddress.line1, deliveryAddress.line2].filter(Boolean).join(', '),
    [deliveryAddress.postalCode, deliveryAddress.city].filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ') : ''
  const deliveryDate = days.find(day => day.id === deliveryItem?.delivery.marketDayId)?.date
  const deliveryTo = deliveryDate ? `/staff/deliveries?day=${deliveryDate}&mode=route` : '/staff/deliveries'
  const handoffs = [...new Set(items.map(item => handoffLabel(item, days)))]
  const formUrl = `${window.location.origin}/form/${order.formToken}`
  // Unconfirmed online payments hold their slot but are not ready for painting or delivery yet.
  const paymentHeld = !order.handedOver && (order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' || Boolean(order.paymentReview))
  const production = paymentHeld ? (order.checkoutStatus === 'pending' ? 'Waiting for online payment' : 'Payment review') : order.handedOver ? (deliveryItem ? 'Delivered' : 'Handed over') : allFinished ? (deliveryItem ? 'Ready for delivery' : 'Ready for pickup') : formWaiting ? 'Waiting for form' : 'In the workshop'

  async function cancelOrder() {
    if (actionLock.current) return
    actionLock.current = true
    setBusy(true)
    setActionError('')
    try {
      await api.orders.cancelOrder(id)
      try { localStorage.removeItem(`awg-form-token:${order.code.toUpperCase()}`) } catch { /* storage unavailable */ }
      navigate('/staff/agenda', { replace: true })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel order.')
      setCancelOpen(false)
    } finally { actionLock.current = false; setBusy(false) }
  }

  const formContent = <div className={styles.share}>
    <QrCode value={formUrl} />
    <div className={styles.shareActions}>
      <CustomerHandoff token={order.formToken} />
      <Button tone="staff" variant="secondary" onClick={() => {
        setActionError('')
        void navigator.clipboard.writeText(formUrl).then(() => setCopied(true)).catch(() => setActionError('Could not copy. Open the customer form to share its link.'))
      }}>{copied ? 'Link copied' : 'Copy form link'}</Button>
      <span role="status" className={styles.muted}>{copied ? 'Link copied to clipboard.' : 'Tap the QR to show it to the customer.'}</span>
    </div>
  </div>

  return <article className={styles.page}>
    <StaffBackLink />
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>Order</p><h1 title={order.code}>{order.code}</h1><p className={styles.customer} title={customer.name}>{customer.name || 'Customer details pending'}</p></div>
      <span className={styles.status} data-ready={allFinished || order.handedOver}>{production}</span>
    </header>
    {order.paymentReview ? <InsetNote><p role="alert">Stripe reported a payment that does not match this order. Check it in Stripe, then record it as paid or deposit (or cancel the order). It remains held on the agenda until resolved.</p></InsetNote> : null}
    <details className={styles.panel}><summary>Order info</summary><p>{order.source === 'web' || order.checkoutStatus ? 'Web order' : 'Stall order'} · Created {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(order.createdAt.endsWith('Z') || /[+-]\d\d:\d\d$/.test(order.createdAt) ? order.createdAt : `${order.createdAt}Z`))} (Vienna)</p><p>Payment method: {order.paymentMethod ?? 'Not recorded'}</p></details>
    <div className={styles.overview} data-delivery={Boolean(deliveryItem)}>
      <div><span>{deliveryItem ? 'Delivery' : 'Pickup'}</span><strong>{handoffs.join(' / ') || 'Not scheduled'}</strong>
        {deliveryItem ? <div className={styles.handoffActions}>
          {addressText ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`} target="_blank" rel="noreferrer">{addressText} ↗</a> : <span>Address pending</span>}
          {customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : null}
        </div> : null}
      </div>
      <div><span>{remaining > 0 ? 'Balance due' : 'Total · paid'}</span><a href="#payment-heading">{formatEur(remaining > 0 ? remaining : order.total)}</a></div>
    </div>
    {loadError || actionError ? <p className={styles.error} role="alert">{actionError || loadError}</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    {formWaiting ? <section className={styles.panel} aria-labelledby="pending-form"><h2 id="pending-form">Customer details needed</h2><p className={styles.muted}>Collect reference photos and personalisation before painting.</p>{formContent}</section> : null}
    <div className={styles.workspace}>
      <h2 id="order-items" className={styles.itemsTitle}>
        Ornaments
        <span className={styles.progressBadge} data-complete={allFinished || undefined}>
          {finishedCount}/{items.length} {allFinished ? 'completed' : 'ready'}
        </span>
      </h2>
      <section aria-labelledby="order-items" className={styles.items}>
        {items.map(item => <OrderItemCard key={item.id} item={item} block={blocks.find(block => block.orderItemId === item.id)} days={days} showHandoff={handoffs.length > 1} selected={item.id === navigationState?.itemId} navigationState={navigationState} busy={busy || itemStatus.unconfirmed} held={paymentHeld} onStatus={status => { void itemStatus.setStatus(item.id, status) }} />)}
      </section>
      <aside className={styles.support} aria-label="Order management">
        <section className={styles.panel} aria-labelledby="handoff-heading">
          <h2 id="handoff-heading">{deliveryItem ? 'Delivery' : 'Pickup'}</h2>
          {order.handedOver ? <p className={styles.muted}>{deliveryItem ? 'Delivered to the customer.' : 'Picked up at the stall.'}</p> : <p className={styles.muted}>{allFinished ? (deliveryItem ? 'Ready to deliver.' : 'Ready for pickup.') : `${items.filter(item => item.productionStatus !== 'finished').length} still to finish.`}</p>}
          {paymentHeld ? <p className={styles.muted}>{order.checkoutStatus === 'pending' ? 'The customer has not finished paying online. It appears in deliveries once Stripe confirms the payment.' : 'Resolve the online payment below before delivery.'}</p> : deliveryItem ? <ButtonLink tone="staff" fullWidth to={deliveryTo} variant={allFinished && !order.handedOver ? 'primary' : 'secondary'}>Open delivery run</ButtonLink> : <Button tone="staff" fullWidth variant={allFinished && !order.handedOver ? 'primary' : 'secondary'} disabled={busy || handover.busy || itemStatus.unconfirmed || (!order.handedOver && !allFinished)} onClick={() => { void handover.request(id, !order.handedOver) }}>{order.handedOver ? 'Undo pickup' : 'Mark picked up'}</Button>}
        </section>
        <OrderPaymentPanel order={order} busy={busy} onSetState={(state, method, amount) => runAction(() => api.payments.setPaymentState(id, state, method, amount), state === 'paid' ? 'Marked as paid.' : 'Deposit recorded.')} />
        <details className={styles.panel}>
          <summary>Customer contact</summary>
          <dl className={styles.contacts}>
            <div><dt>Name</dt><dd>{customer.name || 'Waiting for form'}</dd></div>
            <div><dt>Phone</dt><dd>{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : 'Waiting for form'}</dd></div>
            <div><dt>Email</dt><dd>{customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : 'Waiting for form'}</dd></div>
          </dl>
        </details>
        {hasForm && !formWaiting ? <details className={styles.panel}><summary>Customer form <span className={styles.muted}>Completed</span></summary>{formContent}</details> : null}
        <ButtonLink to={`/track/${order.code}`} tone="staff" variant="ghost">View customer tracking ↗</ButtonLink>
        <div className={styles.dangerZone}>
          <Button tone="staff" variant="ghost" className={styles.cancelBtn} disabled={busy || order.handedOver} onClick={() => setCancelOpen(true)}>Cancel order</Button>
          {order.handedOver && <p className={styles.muted}>A handed-over order cannot be cancelled. Undo handover first.</p>}
        </div>
      </aside>
    </div>
    {cancelOpen && <CancelOrderDialog busy={busy} order={order} items={items} onClose={() => setCancelOpen(false)} onConfirm={() => { void cancelOrder() }} />}
    {itemStatus.dialog}{handover.dialog}
  </article>
}

function CancelOrderDialog({ busy, order, items, onClose, onConfirm }: { busy: boolean; order: Bundle['order']; items: Bundle['items']; onClose: () => void; onConfirm: () => void }) {
  const { paid } = paymentSummary(order)
  const painted = items.filter(item => item.kind === 'custom' && item.productionStatus !== 'not_started')
  return <StaffDialog title="Cancel order?" busy={busy} onClose={onClose}>
    <p>This permanently deletes the order, customer form, photos and payment record. Painting reservations are released. This cannot be undone.</p>
    <p>Received: {formatEur(paid, 'en')}. Refund any money manually{order.source === 'web' ? ' in Stripe' : ''}; cancelling does not issue a refund.</p>
    <p>{items.length} ornaments will be removed. Only unpainted bases and eligible finished stock return to inventory.</p>
    {painted.length > 0 && <p>Painting already started: {painted.map(item => item.petName || `${item.color} ${item.finish} ornament`).join(', ')}. These bases will not be restocked.</p>}
    <Button tone="staff" variant="secondary" disabled={busy} onClick={onClose}>Keep order</Button>
    <Button tone="staff" variant="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Cancelling…' : 'Cancel order'}</Button>
  </StaffDialog>
}
