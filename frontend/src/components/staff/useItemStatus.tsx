import { useState } from 'react'
import type { Order, OrderItem, ProductionStatus } from '../../domain/types'
import { CompleteOrderDialog } from './CompleteOrderDialog'

type Bundle = { order: Order; customer: { name: string }; items: OrderItem[] }
/** Both painting entry points share the same missing-data and whole-order safeguards. */
export function useItemStatus(bundle: Bundle | null, save: (itemId: string, status: ProductionStatus, message: string) => Promise<boolean>, busy: boolean) {
  const [pending, setPending] = useState<string | null>(null)
  const unconfirmed = bundle?.order.checkoutStatus === 'pending' || bundle?.order.checkoutStatus === 'review' || bundle?.order.paymentReview
  async function setStatus(itemId: string, status: ProductionStatus) {
    if (!bundle || busy || unconfirmed) return
    const item = bundle.items.find(row => row.id === itemId)
    if (!item || item.productionStatus === status) return
    if (status !== 'finished' && (item.handedOver ?? bundle.order.handedOver) && !window.confirm('This will undo this ornament’s handover. Continue?')) return
    if (status === 'finished' && item.kind === 'custom' && (!item.formComplete || !item.petName || !item.photos.length) && !window.confirm('This custom ornament is missing form details or photos. Mark it ready anyway?')) return
    if (status === 'finished' && bundle.items.filter(row => row.productionStatus !== 'finished').length === 1) { setPending(itemId); return }
    await save(itemId, status, `${item.petName || 'Ornament'} updated.`)
  }
  const dialog = pending && bundle ? <CompleteOrderDialog orderCode={bundle.order.code} customerName={bundle.customer.name} items={bundle.items} pendingItemId={pending} busy={busy} onClose={() => { if (!busy) setPending(null) }} onConfirm={() => { void save(pending, 'finished', 'Order ready.').then(ok => { if (ok) setPending(null) }) }} /> : null
  return { setStatus, dialog, unconfirmed: Boolean(unconfirmed) }
}
