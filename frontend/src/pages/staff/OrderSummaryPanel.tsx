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
}

export function OrderSummaryPanel({ items, markets, days, orderCode, prices }: Props) {
  const total = prices ? draftTotal(items, prices) : null

  return (
    <aside className={styles.panel}>
      <h2>Order summary</h2>
      {orderCode ? <p className={styles.code}>{orderCode}</p> : null}
      {items.length === 0 ? <p className={styles.empty}>No ornaments yet.</p> : null}
      <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={item.id}>
            <div className={styles.row}>
              <strong>{item.kind === 'custom' ? <span className={styles.colorDot} data-color={item.color} role="img" aria-label={`${item.color} colour`} /> : null}{itemLabel(item, index)}</strong>
              <span>{prices ? formatEur(itemCost(item.kind, item.withName, prices), 'en') : 'Loading price…'}</span>
            </div>
            <p><StaffText>{deliveryLabel(item, markets, days)}</StaffText></p>
            {slotLabel(item) ? <p><StaffText>{`Paint ${slotLabel(item)}`}</StaffText></p> : null}
            {item.kind === 'custom' && item.withName ? <p>Add name · {prices ? formatEur(prices.nameExtra, 'en') : 'Loading price…'}</p> : null}
          </li>
        ))}
      </ul>
      <div className={styles.total}>
        <span>Total</span>
        <strong>{total === null ? 'Price unavailable' : formatEur(total, 'en')}</strong>
      </div>
    </aside>
  )
}
