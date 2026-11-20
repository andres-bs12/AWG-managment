import { StaffText } from '../../components/staff/StaffText'
import { formatEur, itemCost, type Pricing } from '../../lib/money'
import { marketOrnamentParts, type MarketOrnament } from '../../domain/marketStock'
import type { Market, MarketDay } from '../../domain/types'
import { MarketPiecePhoto } from './MarketOrnamentPicker'
import { deliveryLabel, draftTotal, itemLabel, marketPieceShortSpec, slotLabel, type DraftItem } from './saleDraft'
import styles from './OrderSummaryPanel.module.css'

type Props = {
  items: DraftItem[]
  markets: Market[]
  days: MarketDay[]
  prices: Pricing | null
  marketPieces?: MarketOrnament[]
  orderCode?: string
  /** False while items are still being chosen: no place or date is shown before a handoff is picked. */
  showHandoff?: boolean
}

export function OrderSummaryPanel({ items, markets, days, orderCode, prices, marketPieces, showHandoff = true }: Props) {
  if (!items.length) return null
  const total = prices ? draftTotal(items, prices) : null
  const hasNowFinished = items.some(item => item.kind === 'finished' && item.delivery.mode === 'now')
  const hasWaiting = items.some(item => item.kind === 'custom' || item.delivery.mode !== 'now')

  return (
    <aside className={styles.panel}>
      <h2>Order summary</h2>
      {orderCode ? <p className={styles.code}>{orderCode}</p> : null}
      <ul className={styles.list}>
        {items.map((item, index) => {
          const priceText = prices ? formatEur(itemCost(item.kind, item.withName, prices), 'en') : 'Loading price…'
          if (item.kind === 'finished' && item.marketOrnamentId) {
            const id = item.marketOrnamentId
            const piece = marketPieces?.find(row => row.id === id)
            const parts = marketOrnamentParts(id)
            const shortSpec = marketPieceShortSpec(id)
            return (
              <li key={item.id} className={styles.finishedItem}>
                <MarketPiecePhoto
                  id={id}
                  piece={piece}
                  probeUploaded={!marketPieces}
                  className={styles.thumb}
                  alt={`Ornament ${id}`}
                />
                <div className={styles.details}>
                  <div className={styles.row}>
                    <strong className={styles.pieceCode}>{id}</strong>
                    <span>{priceText}</span>
                  </div>
                  {shortSpec ? (
                    <p className={styles.pieceSpec}>
                      {parts ? <span className={styles.swatchDot} style={{ background: parts.color.swatch }} aria-hidden="true" /> : null}
                      <StaffText>{shortSpec}</StaffText>
                    </p>
                  ) : null}
                  {showHandoff ? <p><StaffText>{deliveryLabel(item, markets, days)}</StaffText></p> : null}
                </div>
              </li>
            )
          }
          return (
            <li key={item.id}>
              <div className={styles.row}>
                <strong>{item.kind === 'custom' ? <span className={styles.colorDot} data-color={item.color} role="img" aria-label={`${item.color} colour`} /> : null}<StaffText>{itemLabel(item, index)}</StaffText></strong>
                <span>{priceText}</span>
              </div>
              {showHandoff ? <p><StaffText>{deliveryLabel(item, markets, days)}</StaffText></p> : null}
              {slotLabel(item) ? <p><StaffText>{`Paint ${slotLabel(item)}`}</StaffText></p> : null}
              {item.kind === 'custom' && item.withName ? <p>Name on the back · +{prices ? formatEur(prices.nameExtra, 'en') : 'price loading…'}</p> : null}
            </li>
          )
        })}
      </ul>
      {showHandoff && hasNowFinished && hasWaiting ? (
        <p className={styles.mixedNote}>Ready-made pieces go home now; custom pieces wait for their date.</p>
      ) : null}
      <div className={styles.total}>
        <span>Total</span>
        <strong>{total === null ? 'Price unavailable' : formatEur(total, 'en')}</strong>
      </div>
    </aside>
  )
}
