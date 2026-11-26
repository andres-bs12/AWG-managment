import type { OrnamentColor, OrnamentSize, PaymentState } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import { receiptTitle } from '../../lib/ornamentTitle'
import { colorKeys } from '../../lib/ornamentPresentation'
import { sizeKey } from '../../lib/ornamentSize'
import styles from './OrderReceipt.module.css'

type ReceiptItem = { petName: string; kind: 'custom' | 'finished'; withName?: boolean; color?: OrnamentColor; size?: OrnamentSize | null; cost?: number; backName: string }

/** `shipping`: the Post fee line (Track passes total minus the ornaments for Post orders). */
export function OrderReceipt({ items, total, paymentState, shipping }: { items: ReceiptItem[]; total?: number; paymentState?: PaymentState; shipping?: number }) {
  const { locale, t } = useLocale()
  const money = (value: number) => new Intl.NumberFormat(locale === 'de' ? 'de-AT' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(value)
  return (
    <section className={styles.receipt} aria-label={t('orderIncludes')}>
      <h2>{t('orderIncludes')}</h2>
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <div>
              <strong>{receiptTitle(item, index, items.length, t)}</strong>
              <span className={styles.meta}>
                {item.color ? <span className={styles.color}><i data-color={item.color} aria-hidden="true" />{t(colorKeys[item.color])}{item.color === 'grey' || item.color === 'white' ? ` (${t('legacyColour')})` : ''}{item.size ? ` · ${t(sizeKey(item.size))}` : ''}</span> : item.kind === 'custom' ? <span>{t('colorUnknown')}</span> : null}
              </span>
            </div>
            {item.cost != null ? <span>{money(item.cost)}</span> : null}
          </li>
        ))}
        {shipping ? <li><div><strong>{t('methodPost')}</strong></div><span>{money(shipping)}</span></li> : null}
      </ul>
      {total != null || paymentState ? <div className={styles.total}>
        <div><span>{t('orderTotal')}</span>{total != null ? <strong>{money(total)}</strong> : null}</div>
        {paymentState ? <span className={styles.payment} data-paid={paymentState === 'paid'}>{t(`payment_${paymentState}`)}</span> : null}
      </div> : null}
    </section>
  )
}
