import type { OrderItem } from '../../domain/types'
import { Button } from '../ui/Button'
import { StaffDialog } from './StaffDialog'
import styles from './CompleteOrderDialog.module.css'

type Props = { orderCode: string; customerName: string; items: OrderItem[]; pendingItemId: string; busy: boolean; onClose: () => void; onConfirm: () => void }
export function CompleteOrderDialog({ orderCode, customerName, items, pendingItemId, busy, onClose, onConfirm }: Props) {
  return <StaffDialog title="Complete order?" busy={busy} onClose={onClose}>
    <p>This is the last ornament in order {orderCode} ({customerName || 'Customer details pending'}). The customer will see the whole order as ready on Track. Check every ornament before continuing.</p>
    {items.some(item => item.kind === 'custom' && (!item.formComplete || !item.petName || !item.photos.length)) && <p role="alert">Some custom ornaments are missing form details or photos.</p>}
    <ul className={styles.list}>{items.map(item => {
      const ready = item.productionStatus === 'finished' || item.id === pendingItemId
      return <li key={item.id} className={styles.row} data-ready={ready}><strong>{item.petName || 'Ornament'}</strong><span>{ready ? 'Ready' : 'Pending'}</span></li>
    })}</ul>
    <div className={styles.actions}><Button tone="staff" variant="secondary" disabled={busy} onClick={onClose}>Not yet</Button><Button tone="staff" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : 'Confirm & mark ready'}</Button></div>
  </StaffDialog>
}
