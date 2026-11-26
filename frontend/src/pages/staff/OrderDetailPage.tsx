import { StaffText } from '../../components/staff/StaffText'
import { sizeLabel } from '../../lib/ornamentSize'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useStaffRefresh } from '../../lib/useStaffRefresh'
import { StaffDialog } from '../../components/staff/StaffDialog'
import { CustomerHandoff } from '../../components/staff/CustomerHandoff'
import { useItemStatus } from '../../components/staff/useItemStatus'
import { useHandover } from '../../components/staff/useHandover'
import { InsetNote } from '../../components/public/PublicForm'
import { OrderItemCard } from '../../components/staff/OrderItemCard'
import { ChangePriceDialog } from '../../components/staff/ChangePriceDialog'
import { OrderPaymentPanel } from '../../components/staff/OrderPaymentPanel'
import { QrCode } from '../../components/staff/QrCode'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Field } from '../../components/ui/Field'
import { marketOrnamentLabel } from '../../domain/marketStock'
import type { Market, MarketDay } from '../../domain/types'
import { viennaDate } from '../../lib/sales'
import { formatDateLabel } from '../../lib/time'
import { handoffArrivalLabel, handoffLabel } from '../../lib/handoff'
import { formatEur } from '../../lib/money'
import { paymentSummary } from '../../lib/paymentSummary'
import { colorLabel, finishLabel } from '../../lib/stats'
import { TRACKING_NUMBER_REGEX } from '../../lib/postShipping'
import styles from './OrderDetailPage.module.css'

type Bundle = Awaited<ReturnType<typeof api.orders.getOrderBundle>>

export function OrderDetailPage() {
  const { id = '' } = useParams()
  return <OrderDetail key={id} id={id} />
}

function OrderDetail({ id }: { id: string }) {
  const version = useStaffRefresh()
  const location = useLocation()
  const navigationState = location.state as { from?: string; itemId?: string } | undefined
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [days, setDays] = useState<MarketDay[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  // A confirmation is read once; it should not stay over the page.
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 5000); return () => window.clearTimeout(timer) }, [notice])
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const actionLock = useRef(false)
  const [copied, setCopied] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const [trackingDraft, setTrackingDraft] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.orders.getOrderBundle(id), api.markets.listMarketDays(), api.markets.listMarkets()])
      .then(([next, marketDays, marketList]) => {
        if (cancelled) return
        setBundle(next)
        setDays(marketDays)
        setMarkets(marketList)
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
  const onlyReadyMade = items.length > 0 && items.every(item => item.kind === 'finished')
  const formWaiting = items.some(item => item.kind === 'custom' && !item.formComplete)
  const stallSale = order.source !== 'web' && !order.checkoutStatus
  const hasForm = items.some(item => item.kind === 'custom')
  const postItem = items.find(item => item.delivery.kind === 'post')
  const viennaItem = items.find(item => item.delivery.kind === 'vienna')
  const deliveryItem = postItem ?? viennaItem
  const deliveryAddress = deliveryItem?.delivery.address
  const addressText = deliveryAddress ? [
    [deliveryAddress.line1, deliveryAddress.line2].filter(Boolean).join(', '),
    [deliveryAddress.postalCode, deliveryAddress.city].filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ') : ''
  const arrivalText = postItem ? handoffArrivalLabel(postItem) : null
  const postItems = items.filter(item => item.delivery.kind === 'post')
  const postShipped = postItems.length > 0 && postItems.every(item => item.handedOver ?? order.handedOver)
  const trackingValue = trackingDraft ?? order.trackingNumber ?? ''
  const trimmedTracking = trackingValue.trim()
  const trackingInvalid = Boolean(trimmedTracking && !TRACKING_NUMBER_REGEX.test(trimmedTracking))
  const trackingDirty = trimmedTracking !== (order.trackingNumber ?? '')
  const handoffs = [...new Set(items.map(item => handoffLabel(item, days)))]
  const formUrl = `${window.location.origin}/form/${order.formToken}`
  // Unconfirmed online payments hold their slot but are not ready for painting or delivery yet.
  const paymentHeld = !order.handedOver && (order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' || Boolean(order.paymentReview))
  const production = paymentHeld
    ? (order.checkoutStatus === 'pending' ? 'Waiting for online payment' : 'Payment review')
    : postShipped
      ? 'Shipped'
      : order.handedOver
        ? (viennaItem ? 'Delivered' : 'Handed over')
        : allFinished
          ? (postItem ? 'Ready to ship' : viennaItem ? 'Ready for delivery' : 'Ready for pickup')
          : formWaiting
            ? 'Waiting for form'
            : 'In the workshop'

  async function cancelOrder(reason: string) {
    if (actionLock.current) return
    actionLock.current = true
    setBusy(true)
    setActionError('')
    try {
      await api.orders.cancelOrder(id, reason)
      try { localStorage.removeItem(`awg-form-token:${order.code.toUpperCase()}`) } catch { /* storage unavailable */ }
      setBundle(await api.orders.getOrderBundle(id))
      setCancelOpen(false)
      setNotice('Order cancelled.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not cancel order.')
      setCancelOpen(false)
    } finally { actionLock.current = false; setBusy(false) }
  }

  if (order.status === 'CANCELLED') return <article className={styles.page}>
    <StaffBackLink />
    <header className={styles.hero}><div><h1>{order.code}</h1><p>{customer.name}</p></div><span className={styles.status}>Cancelled</span></header>
    <section className={styles.panel}>
      <h2>Cancelled order</h2>
      <p>This order is read-only. Painting time was released and eligible stock returned.</p>
      {order.cancelledAt && <p>Cancelled: {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(order.cancelledAt))} (Vienna)</p>}
      {order.cancellationReason && <p>Reason: {order.cancellationReason}</p>}
      <p>Total: {formatEur(order.total, 'en')} · Received: {formatEur(paymentSummary(order).paid, 'en')}</p>
      <p>{items.length} {items.length === 1 ? 'ornament' : 'ornaments'}</p>
      {items.map(item => {
        const piece = item.kind === 'finished' && item.marketOrnamentId ? marketOrnamentLabel(item.marketOrnamentId) : null
        const facts = [item.kind, !piece && item.size && sizeLabel(item.size), !piece && item.color, !piece && item.finish, item.productionStatus.replaceAll('_', ' '), formatEur(item.cost, 'en')]
        return <div key={item.id}>
          <h3><StaffText>{piece || item.petName || 'Ornament'}</StaffText></h3>
          <p><StaffText>{facts.filter(Boolean).join(' · ')}</StaffText></p>
          {item.backName && <p>Name: {item.backName}</p>}
          {item.note && <p>Note: {item.note}</p>}
          {item.photos.map(photo => <img key={photo.id} src={photo.dataUrl} alt={`Reference for ${item.petName || 'ornament'}`} width={120} />)}
        </div>
      })}
      <p>{customer.email} {customer.phone}</p>
    </section>
    <ButtonLink to={`/track/${order.code}`} tone="staff" variant="ghost">View customer tracking ↗</ButtonLink>
  </article>

  const formContent = <div className={styles.share}>
    <QrCode value={formUrl} />
    <div className={styles.shareActions}>
      <CustomerHandoff token={order.formToken} />
      <Button tone="staff" variant="secondary" onClick={() => {
        setActionError('')
        void navigator.clipboard.writeText(formUrl).then(() => setCopied(true)).catch(() => setActionError('Could not copy. Open the customer form to share its link.'))
      }}>{copied ? 'Link copied' : 'Copy form link'}</Button>
      <span role="status" className={styles.muted}>{copied ? 'Link copied to clipboard.' : ''}</span>
    </div>
  </div>

  return <article className={styles.page}>
    <StaffBackLink />
    <header className={styles.hero}>
      <div><h1 title={order.code}>{order.code}</h1><p className={styles.customer} title={customer.name}>{customer.name || 'Customer details pending'}</p></div>
      <span className={styles.status} data-ready={allFinished || order.handedOver}>{production}</span>
    </header>
    {order.needsReview ? <InsetNote tone="warning"><p role="status">New web order, paid online. Check the photos and the pickup or Post details.</p><Button tone="staff" disabled={busy} onClick={() => void runAction(() => api.orders.markReviewed(order.id), 'Marked as reviewed.')}>Mark reviewed</Button></InsetNote> : null}
    {order.paymentReview ? <InsetNote tone="warning"><p role="alert">Stripe reported a payment that does not match this order. Check it in Stripe, then record it as paid or deposit (or cancel the order). It remains held on the agenda until resolved.</p></InsetNote> : null}
    <div className={styles.overview} data-delivery={Boolean(deliveryItem)} data-sold={stallSale || undefined}>
      <div><span>{order.handedOver ? (postItem ? 'Handed to Post' : deliveryItem ? 'Delivered' : 'Picked up') : postItem ? 'Post shipping' : deliveryItem ? 'Delivery' : 'Pickup'}</span><div className={styles.cellRow}><strong><StaffText>{handoffs.join(' / ') || 'Not scheduled'}</StaffText></strong></div>
        {arrivalText ? <span className={styles.arrivalLine}>{arrivalText}</span> : null}
        {deliveryItem ? <div className={styles.handoffActions}>
          {addressText ? (
            postItem ? (
              <>
                <span>{addressText}</span>
                <button type="button" className={styles.inlineCopy} onClick={() => {
                  const full = [customer.name, deliveryAddress?.line1, deliveryAddress?.line2, `${deliveryAddress?.postalCode ?? ''} ${deliveryAddress?.city ?? ''}`.trim()].filter(Boolean).join('\n')
                  void navigator.clipboard.writeText(full).then(() => setAddressCopied(true)).catch(() => setActionError('Could not copy address.'))
                }}>{addressCopied ? 'Address copied' : 'Copy address'}</button>
              </>
            ) : (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`} target="_blank" rel="noreferrer">{addressText} ↗</a>
            )
          ) : <span>Address pending</span>}
          {customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : null}
        </div> : null}
      </div>
      {/* Stall sales: the market the sale counts for is its own cell of the summary, changed from here (no panel below). */}
      {stallSale ? <SoldAtCell order={order} days={days} markets={markets} busy={busy}
        onSave={marketDayId => runAction(() => api.orders.setSaleMarket(id, marketDayId), 'Market changed.')} /> : null}
      <div><span>{remaining > 0 ? 'Balance due' : 'Total · paid'}</span>
        {/* Value on the left, its «Change» on the right: the same row in every cell of the summary. */}
        <div className={styles.cellRow}><a href="#payment-heading">{formatEur(remaining > 0 ? remaining : order.total, 'en')}</a>
          {stallSale ? <button type="button" className={styles.inlineCopy} aria-label="Change price" disabled={busy} onClick={() => setPriceOpen(true)}>Change</button> : null}</div>
        {priceOpen ? <ChangePriceDialog order={order} busy={busy} onClose={() => setPriceOpen(false)} onSetPrice={chargedTotal => runAction(() => api.payments.setPrice(id, chargedTotal), 'Price changed.')} /> : null}
      </div>
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
        {items.map(item => {
          const allPostOrder = postItems.length > 0 && postItems.length === items.length
          // Ready-made pieces all go together at the stall, and once the whole order is handed over the single undo
          // lives in the order panel: in both cases the cards repeat no handover button.
          const canItemHandover = items.length > 1 && !onlyReadyMade && !order.handedOver && !(allPostOrder && !(item.handedOver ?? order.handedOver))
          return <OrderItemCard key={item.id} item={{ ...item, handedOver: item.handedOver ?? order.handedOver }} onHandover={canItemHandover ? () => { void handover.request(id, !(item.handedOver ?? order.handedOver), item.id) } : undefined} block={blocks.find(block => block.orderItemId === item.id)} days={days} selected={item.id === navigationState?.itemId} navigationState={navigationState} busy={busy || itemStatus.unconfirmed} held={paymentHeld} orderDone={order.handedOver} onStatus={status => { void itemStatus.setStatus(item.id, status) }} />
        })}
      </section>
      <aside className={styles.support} aria-label="Order management">
        {/* Handed over: the summary at the top already says where and when, so only a Post parcel keeps this panel (tracking). */}
        {order.handedOver && !postItem ? null : <section className={styles.panel} aria-labelledby="handoff-heading">
          <h2 id="handoff-heading">{postItem ? 'Post shipping' : deliveryItem ? 'Delivery' : 'Pickup'}</h2>
          {arrivalText ? <p className={styles.arrivalMeta}>{arrivalText}</p> : null}
          {order.handedOver ? <p className={styles.muted}>{postItem ? 'Handed to Austrian Post.' : deliveryItem ? 'Delivered to the customer.' : 'Picked up at the stall.'}</p> : <p className={styles.muted}>{allFinished ? (postItem ? 'Ready to hand to Post.' : deliveryItem ? 'Ready to deliver.' : 'Ready for pickup.') : `${items.filter(item => item.productionStatus !== 'finished').length} still to finish.`}</p>}
          {postItem && !paymentHeld ? (
            <div className={styles.trackingBox}>
              {order.trackingUrl && order.trackingNumber ? (
                <a className={styles.trackingLink} href={order.trackingUrl} target="_blank" rel="noreferrer">
                  Track parcel ({order.trackingNumber}) ↗
                </a>
              ) : null}
              <div className={styles.trackingRow}>
                <Field label="Post tracking number" htmlFor="order-tracking-number" error={trackingInvalid ? 'Enter 8–40 letters or digits.' : undefined}>
                  <input
                    id="order-tracking-number"
                    value={trackingValue}
                    autoComplete="off"
                    disabled={busy}
                    onChange={event => setTrackingDraft(event.target.value)}
                  />
                </Field>
                <Button
                  tone="staff"
                  variant="secondary"
                  disabled={busy || trackingInvalid || !trackingDirty}
                  onClick={async () => {
                    const ok = await runAction(async () => {
                      // Refetch first so we merge against the latest server handedOver state instead of resending stale loaded state.
                      const fresh = await api.orders.getOrderBundle(order.id)
                      if (fresh.order.status === 'CANCELLED') {
                        setBundle(fresh)
                        throw new Error('This order is cancelled.')
                      }
                      const freshPost = fresh.items.find(item => item.id === postItem.id) ?? fresh.items.find(item => item.delivery.kind === 'post')
                      if (!freshPost) throw new Error('This order has no Post shipment.')
                      const freshHandedOver = Boolean(freshPost.handedOver ?? fresh.order.handedOver)
                      await api.orders.setHandedOver(order.id, freshHandedOver, [freshPost.id], trimmedTracking)
                    }, trimmedTracking ? 'Tracking number saved.' : 'Tracking number cleared.')
                    if (ok) setTrackingDraft(null)
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : null}
          {order.handedOver ? null : paymentHeld ? <p className={styles.muted}>{order.checkoutStatus === 'pending' ? 'The customer has not finished paying online. It appears in deliveries once Stripe confirms the payment.' : 'Resolve the online payment below before delivery.'}</p> : <Button tone="staff" fullWidth variant={allFinished ? 'primary' : 'secondary'} disabled={busy || handover.busy || itemStatus.unconfirmed || !allFinished} onClick={() => { void handover.request(id, true, undefined, undefined, postItem ? trimmedTracking : undefined) }}>{postItem ? 'Handed to Post' : deliveryItem ? 'Mark delivered' : 'Mark picked up'}</Button>}
        </section>}
        <OrderPaymentPanel order={order} busy={busy} onSetState={(state, method, amount) => runAction(() => api.payments.setPaymentState(id, state, method, amount), state === 'paid' ? 'Marked as paid.' : 'Deposit recorded.')} />
        <details className={styles.panel}>
          <summary>Customer contact</summary>
          <dl className={styles.contacts}>
            <div><dt>Name</dt><dd>{customer.name || 'Waiting for form'}</dd></div>
            <div><dt>Phone</dt><dd>{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : 'Waiting for form'}</dd></div>
            <div><dt>Email</dt><dd>{customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : 'Waiting for form'}</dd></div>
          </dl>
        </details>
        {/* The form link and QR only matter until the order is handed over. */}
        {hasForm && !formWaiting && !order.handedOver ? <details className={styles.panel}><summary>Customer form <span className={styles.muted}>Completed</span></summary>{formContent}</details> : null}
        {/* The facts of the order as one quiet line: no «Order info» disclosure to open (owner, 2026-11-26). */}
        <p className={styles.muted}>{order.source === 'web' || order.checkoutStatus ? 'Web order' : 'Stall order'} · Created {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Vienna' }).format(new Date(order.createdAt.endsWith('Z') || /[+-]\d\d:\d\d$/.test(order.createdAt) ? order.createdAt : `${order.createdAt}Z`))} (Vienna){order.paymentMethod ? ` · Paid by ${order.paymentMethod}` : ''}</p>
        <ButtonLink to={`/track/${order.code}`} tone="staff" variant="ghost">View customer tracking ↗</ButtonLink>
        {/* Handed over: undo is only for mistakes, so it sits once at the bottom, quiet and red, where Cancel would be.
            It opens the usual confirmation. A handed-over order cannot be cancelled, so no dead Cancel button. */}
        {order.handedOver ? <div className={styles.dangerZone}>
          <Button tone="staff" variant="ghost" className={styles.cancelBtn} disabled={busy || handover.busy || itemStatus.unconfirmed} onClick={() => { void handover.request(id, false) }}>Undo handover</Button>
        </div> : <div className={styles.dangerZone}>
          <Button tone="staff" variant="ghost" className={styles.cancelBtn} disabled={busy || items.some(item => item.handedOver)} onClick={() => setCancelOpen(true)}>Cancel order</Button>
          {items.some(item => item.handedOver) && <p className={styles.muted}>An order with handed-over items cannot be cancelled. Undo handover first.</p>}
        </div>}
      </aside>
    </div>
    {cancelOpen && <CancelOrderDialog busy={busy} order={order} items={items} onClose={() => setCancelOpen(false)} onConfirm={(reason) => { void cancelOrder(reason) }} />}
    {itemStatus.dialog}{handover.dialog}
  </article>
}

/** Which stall the sale counts for (stats, sales list). Fixable when the market was loaded after the sale. */
function SoldAtCell({ order, days, markets, busy, onSave }: { order: Bundle['order']; days: MarketDay[]; markets: Market[]; busy: boolean; onSave: (marketDayId: string) => Promise<boolean> }) {
  const saleDate = viennaDate(order.createdAt)
  const stallIds = new Set(markets.filter(market => market.kind === 'market').map(market => market.id))
  const choices = days.filter(day => day.date === saleDate && stallIds.has(day.marketId))
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState('')
  const name = (id: string) => markets.find(market => market.id === id)?.name ?? 'Market'
  const selected = choice || order.soldOnMarketDayId || ''
  return <div>
    <span>Sold at</span>
    <div className={styles.cellRow}><strong><StaffText>{order.soldAtMarketName ?? 'No market'}</StaffText></strong>
      <button type="button" className={styles.inlineCopy} aria-label="Change market" onClick={() => setOpen(true)}>Change</button></div>
    {open ? <StaffDialog title="Sold at" busy={busy} onClose={() => { setOpen(false); setChoice('') }}>
      {choices.length ? <>
        <Field label={`Market open on ${formatDateLabel(saleDate)}`} htmlFor="sold-at-market">
          <select id="sold-at-market" value={selected} disabled={busy} onChange={event => setChoice(event.target.value)}>
            {!order.soldOnMarketDayId ? <option value="">Choose a market</option> : null}
            {choices.map(day => <option key={day.id} value={day.id}>{name(day.marketId)}</option>)}
          </select>
        </Field>
        <Button tone="staff" disabled={busy || !selected || selected === order.soldOnMarketDayId} onClick={() => { void onSave(selected).then(ok => { if (ok) { setChoice(''); setOpen(false) } }) }}>Save market</Button>
      </> : <p className={styles.muted}>No stall market was open on {formatDateLabel(saleDate)}. Add the market and that day in Markets first.</p>}
    </StaffDialog> : null}
  </div>
}

function CancelOrderDialog({ busy, order, items, onClose, onConfirm }: { busy: boolean; order: Bundle['order']; items: Bundle['items']; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const { paid } = paymentSummary(order)
  const painted = items.filter(item => item.kind === 'custom' && item.productionStatus !== 'not_started')
  return <StaffDialog title="Cancel order?" busy={busy} onClose={onClose} preventEscape>
    <p>The order and payment record will be kept. Painting reservations are released. This cannot be undone.</p>
    <p>Received: {formatEur(paid, 'en')}.{paid > 0 ? ` Refund it manually${order.source === 'web' ? ' in Stripe' : ''}; cancelling does not issue a refund.` : ''}</p>
    <p>{items.length} {items.length === 1 ? 'ornament' : 'ornaments'} are cancelled. Only unpainted bases and eligible finished stock return to inventory.</p>
    {painted.length > 0 && <p>Painting already started: {painted.map(item => item.petName || `${colorLabel(item.color ?? '')} · ${finishLabel(item.finish ?? 'shiny')} ornament`).join(', ')}. These bases will not be restocked.</p>}
    <Field label="Reason (optional)" htmlFor="cancel-reason"><textarea id="cancel-reason" rows={3} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /></Field>
    <Button tone="staff" variant="danger" disabled={busy} onClick={() => onConfirm(reason)}>{busy ? 'Cancelling…' : 'Cancel order'}</Button>
  </StaffDialog>
}
