import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useMockStoreVersion } from 'demo-source'
import dialogStyles from '../../components/staff/CompleteOrderDialog.module.css'
import { CompleteOrderDialog } from '../../components/staff/CompleteOrderDialog'
import { OrderItemCard } from '../../components/staff/OrderItemCard'
import { OrderPaymentPanel } from '../../components/staff/OrderPaymentPanel'
import { QrCode } from '../../components/staff/QrCode'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { MarketDay, ProductionStatus } from '../../domain/types'
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
  const version = useMockStoreVersion()
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
  const [pendingCompleteItemId, setPendingCompleteItemId] = useState<string | null>(null)

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
  const production = order.handedOver ? (deliveryItem ? 'Delivered' : 'Handed over') : allFinished ? (deliveryItem ? 'Ready for delivery' : 'Ready for pickup') : formWaiting ? 'Waiting for form' : 'In the workshop'

  function handleItemStatus(itemId: string, status: ProductionStatus, noticeLabel: string) {
    const item = items.find(entry => entry.id === itemId)
    if (!item) return
    if (status === 'finished' && item.kind === 'custom' && (!item.formComplete || !item.petName || !item.photos.length) && !window.confirm('This custom ornament is missing form details or photos. Mark it ready anyway?')) return
    if (status === 'finished' && item.productionStatus !== 'finished' && finishedCount === items.length - 1) {
      setPendingCompleteItemId(itemId)
      return
    }
    void runAction(() => api.orders.setItemStatus(id, itemId, status), noticeLabel)
  }

  async function confirmCompleteOrder() {
    if (!pendingCompleteItemId || actionLock.current) return
    const item = items.find(entry => entry.id === pendingCompleteItemId)
    const ok = await runAction(
      () => api.orders.setItemStatus(id, pendingCompleteItemId, 'finished'),
      item ? `${item.petName || 'Ornament'} finished — order ready.` : 'Order ready for pickup.',
    )
    if (ok) setPendingCompleteItemId(null)
  }

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
    <QrCode value={formUrl} size={180} />
    <div className={styles.shareActions}>
      <ButtonLink to={`/form/${order.formToken}`} tone="staff" variant={formWaiting ? 'primary' : 'secondary'}>Open customer form</ButtonLink>
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
      <div><p className={styles.eyebrow}>Order</p><h1>{order.code}</h1><p className={styles.customer}>{customer.name || 'Customer details pending'}</p></div>
      <span className={styles.status} data-ready={allFinished || order.handedOver}>{production}</span>
    </header>
    {order.paymentReview ? <p role="alert">Stripe reported a payment that does not match this order. Check it in Stripe, then record it as paid or deposit (or cancel the order). It stays off the agenda until then.</p> : null}
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
        {items.map(item => <OrderItemCard key={item.id} item={item} block={blocks.find(block => block.orderItemId === item.id)} days={days} showHandoff={handoffs.length > 1} selected={item.id === navigationState?.itemId} navigationState={navigationState} busy={busy} onStatus={status => { handleItemStatus(item.id, status, `${item.petName || 'Ornament'} updated.`) }} />)}
      </section>
      <aside className={styles.support} aria-label="Order management">
        <section className={styles.panel} aria-labelledby="handoff-heading">
          <h2 id="handoff-heading">{deliveryItem ? 'Delivery' : 'Pickup'}</h2>
          {order.handedOver ? <p className={styles.muted}>{deliveryItem ? 'Delivered to the customer.' : 'Picked up at the stall.'}</p> : <p className={styles.muted}>{allFinished ? (deliveryItem ? 'Ready to deliver.' : 'Ready for pickup.') : `${items.filter(item => item.productionStatus !== 'finished').length} still to finish.`}</p>}
          {deliveryItem ? <ButtonLink tone="staff" fullWidth to={deliveryTo} variant={allFinished && !order.handedOver ? 'primary' : 'secondary'}>Open delivery run</ButtonLink> : <Button tone="staff" fullWidth variant={allFinished && !order.handedOver ? 'primary' : 'secondary'} disabled={busy || (!order.handedOver && !allFinished)} onClick={() => { void runAction(() => api.orders.setHandedOver(id, !order.handedOver), order.handedOver ? 'Pickup undone.' : 'Marked as picked up.') }}>{order.handedOver ? 'Undo pickup' : 'Mark picked up'}</Button>}
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
        <Button tone="staff" variant="danger" disabled={busy} onClick={() => setCancelOpen(true)}>Cancel order</Button>
        <ButtonLink to={`/track/${order.code}`} tone="staff" variant="ghost">View customer tracking ↗</ButtonLink>
      </aside>
    </div>
    {cancelOpen && <CancelOrderDialog busy={busy} card={order.paymentMethod === 'card' && order.paymentState !== 'unpaid'} cash={order.paymentMethod === 'cash' && order.paymentState !== 'unpaid'} onClose={() => setCancelOpen(false)} onConfirm={() => { void cancelOrder() }} />}
    {pendingCompleteItemId ? (
      <CompleteOrderDialog
        orderCode={order.code}
        customerName={customer.name}
        items={items}
        pendingItemId={pendingCompleteItemId}
        busy={busy}
        onClose={() => { if (!busy) setPendingCompleteItemId(null) }}
        onConfirm={() => { void confirmCompleteOrder() }}
      />
    ) : null}
  </article>
}

function CancelOrderDialog({ busy, card, cash, onClose, onConfirm }: { busy: boolean; card: boolean; cash: boolean; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog className={dialogStyles.nativeDialog} ref={ref} aria-labelledby="cancel-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <h2 id="cancel-title">Cancel order?</h2>
    <p>The order will be deleted. Painting time and stock will be released. This cannot be undone.</p>
    {card && <p>If this order was paid online, the refund must be done manually in Stripe.</p>}
    {cash && <p>Return any cash received to the customer manually.</p>}
    <Button tone="staff" variant="secondary" disabled={busy} onClick={onClose}>Keep order</Button>{' '}
    <Button tone="staff" variant="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Cancelling…' : 'Cancel order'}</Button>
  </dialog>
}
