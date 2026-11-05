import { formatEur, itemCost, type Pricing } from '../../lib/money'
import { formatMinutes } from '../../lib/time'
import type { Market, MarketDay } from '../../domain/types'
import { deliveryLabel, draftTotal, itemLabel, paintMinutes, slotLabel, type DraftItem } from './saleDraft'
import styles from './OrderSummaryPanel.module.css'

type Props = {
  items: DraftItem[]
  markets: Market[]
  days: MarketDay[]
  prices: Pricing | null
  orderCode?: string
}

export function OrderSummaryPanel({ items, markets, days, orderCode, prices }: Props) {
  const total = prices ? draftTotal(items, prices) : null
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
              <strong><span className={styles.colorDot} data-color={item.color} role="img" aria-label={`${item.color} colour`} />{itemLabel(item, index)}</strong>
              <span>{prices ? formatEur(itemCost(item.kind, item.withName, prices), 'en') : 'Loading price…'}</span>
            </div>
            <p>{deliveryLabel(item, markets, days)}</p>
            {slotLabel(item) ? <p>Paint {slotLabel(item)}</p> : null}
            {item.kind === 'custom' && item.withName ? <p>Add name · {prices ? formatEur(prices.nameExtra, 'en') : 'Loading price…'}</p> : null}
          </li>
        ))}
      </ul>
      {named ? <p className={styles.meta}>Name extra × {named}</p> : null}
      {paint > 0 ? <p className={styles.meta}>Paint to reserve · {formatMinutes(paint)}</p> : null}
      <div className={styles.total}>
        <span>Total</span>
        <strong>{total === null ? 'Price unavailable' : formatEur(total, 'en')}</strong>
      </div>
    </aside>
  )
}
