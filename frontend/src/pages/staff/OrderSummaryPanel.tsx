import { StaffText } from '../../components/staff/StaffText'
import { formatEur, itemCost, type Pricing } from '../../lib/money'
import type { Market, MarketDay } from '../../domain/types'
import { deliveryLabel, draftTotal, itemLabel, slotLabel, type DraftItem } from './saleDraft'
import styles from './OrderSummaryPanel.module.css'

type Props = {
  items: DraftItem[]
  markets: Market[]
  days: MarketDay[]
  prices: Pricing | null
  orderCode?: string
  /** False while items are still being chosen: no place or date is shown before a handoff is picked. */
  showHandoff?: boolean
}

export function OrderSummaryPanel({ items, markets, days, orderCode, prices, showHandoff = true }: Props) {
  const total = prices ? draftTotal(items, prices) : null

  return (
    <aside className={styles.panel}>
      <h2>Order summary</h2>
      {orderCode ? <p className={styles.code}>{orderCode}</p> : null}
      {items.length === 0 ? <p className={styles.empty}>No ornaments yet.</p> : null}
      {items.length ? <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={item.id}>
            <div className={styles.row}>
              <strong>{item.kind === 'custom' ? <span className={styles.colorDot} data-color={item.color} role="img" aria-label={`${item.color} colour`} /> : null}{itemLabel(item, index)}</strong>
              <span>{prices ? formatEur(itemCost(item.kind, item.withName, prices), 'en') : 'Loading price…'}</span>
            </div>
            {showHandoff ? <p><StaffText>{deliveryLabel(item, markets, days)}</StaffText></p> : null}
            {slotLabel(item) ? <p><StaffText>{`Paint ${slotLabel(item)}`}</StaffText></p> : null}
            {item.kind === 'custom' && item.withName ? <p>Name on the back · +{prices ? formatEur(prices.nameExtra, 'en') : 'price loading…'}</p> : null}
          </li>
        ))}
      </ul> : null}
      <div className={styles.total}>
        <span>Total</span>
        <strong>{total === null ? 'Price unavailable' : formatEur(total, 'en')}</strong>
      </div>
    </aside>
  )
}
