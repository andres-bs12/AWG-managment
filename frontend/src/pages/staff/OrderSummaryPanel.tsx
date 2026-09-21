import { formatEur, itemCost, NAME_EXTRA } from '../../lib/money'
import { formatMinutes } from '../../lib/time'
import type { Market, MarketDay } from '../../domain/types'
import { deliveryLabel, draftTotal, itemLabel, paintMinutes, slotLabel, type DraftItem } from './saleDraft'
import styles from './OrderSummaryPanel.module.css'

type Props = {
  items: DraftItem[]
  markets: Market[]
  days: MarketDay[]
  orderCode?: string
}

export function OrderSummaryPanel({ items, markets, days, orderCode }: Props) {
  const total = draftTotal(items)
  const paint = paintMinutes(items)
  const named = items.filter((item) => item.kind === 'custom' && item.withName).length

  return (
    <aside className={styles.panel}>
      <h2>Order summary</h2>
      {orderCode ? <p className={styles.code}>{orderCode}</p> : null}
      {items.length === 0 ? <p className={styles.empty}>No ornaments yet.</p> : null}
      <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={item.id}>
            <div className={styles.row}>
              <strong>{itemLabel(item, index)}</strong>
              <span>{formatEur(itemCost(item.kind, item.withName))}</span>
            </div>
            <p>{deliveryLabel(item, markets, days)}</p>
            {slotLabel(item) ? <p>Paint {slotLabel(item)}</p> : null}
            {item.kind === 'custom' && item.withName ? <p>Add name · {formatEur(NAME_EXTRA)}</p> : null}
          </li>
        ))}
      </ul>
      {named ? <p className={styles.meta}>Name extra × {named}</p> : null}
      {paint > 0 ? <p className={styles.meta}>Paint to reserve · {formatMinutes(paint)}</p> : null}
      <div className={styles.total}>
        <span>Total</span>
        <strong>{formatEur(total)}</strong>
      </div>
    </aside>
  )
}
