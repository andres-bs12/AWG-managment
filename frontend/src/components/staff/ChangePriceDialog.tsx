import { useState } from 'react'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { StaffDialog } from './StaffDialog'
import type { Order } from '../../domain/types'
import { formatEur } from '../../lib/money'

/**
 * Changes the charged total of a past stall sale (a discount agreed with the customer).
 * Opened from «Change» beside the total in the order summary; the dialog is the confirmation step.
 */
export function ChangePriceDialog({ order, busy, onClose, onSetPrice }: { order: Order; busy: boolean; onClose: () => void; onSetPrice: (chargedTotal: number) => Promise<boolean> }) {
  const listPrice = Math.round((order.total + (order.discount ?? 0)) * 100) / 100
  const [draft, setDraft] = useState('')
  const newPrice = draft.trim() ? Number(draft.trim().replace(',', '.')) : NaN
  const error = !draft.trim() ? '' : !Number.isFinite(newPrice) || newPrice < 0 ? 'Enter a price in euros.' : newPrice > listPrice ? `Enter at most the list price (${formatEur(listPrice, 'en')}).` : ''
  const valid = draft.trim() !== '' && !error && Math.round(newPrice * 100) / 100 !== order.total
  const paid = order.amountPaid ?? 0
  return <StaffDialog title="Change price?" busy={busy} onClose={onClose} preventEscape>
    <p>For a discount agreed with the customer. Revenue, stats and the received amount follow the new price.</p>
    <Field label="New total (€)" htmlFor="order-new-price" hint={`List price ${formatEur(listPrice, 'en')}`} error={error || undefined}><input id="order-new-price" inputMode="decimal" placeholder={String(order.total).replace('.', ',')} value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} /></Field>
    {valid ? <p>Change the total of {order.code} from <strong>{formatEur(order.total, 'en')}</strong> to <strong>{formatEur(newPrice, 'en')}</strong>{newPrice < listPrice ? ` (discount ${formatEur(Math.round((listPrice - newPrice) * 100) / 100, 'en')})` : ''}. {order.paymentState !== 'unpaid' && newPrice < paid ? 'The received amount is updated too; give back the difference in cash.' : ''}{order.paymentState !== 'unpaid' && newPrice > paid ? `${formatEur(Math.round((newPrice - paid) * 100) / 100, 'en')} is still to collect.` : ''}</p> : null}
    <Button tone="staff" disabled={busy || !valid} onClick={() => { void onSetPrice(Math.round(newPrice * 100) / 100).then(ok => { if (ok) onClose() }) }}>Change price</Button>
  </StaffDialog>
}
