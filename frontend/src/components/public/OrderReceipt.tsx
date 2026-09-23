import type { OrnamentColor, PaymentState } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './OrderReceipt.module.css'

type ReceiptItem = { petName: string; kind: 'custom' | 'finished'; color?: OrnamentColor; cost?: number; backName: string }

export function OrderReceipt({ items, total, paymentState }: { items: ReceiptItem[]; total?: number; paymentState?: PaymentState }) {
  const { locale, t } = useLocale()
  const money = (value: number) => new Intl.NumberFormat(locale === 'de' ? 'de-AT' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(value)
  return (
    <section className={styles.receipt} aria-label={t('orderIncludes')}>
      <h2>{t('orderIncludes')}</h2>
      <ul>
        {items.map((item, index) => (
          <li key={index}>
            <div>
              <strong>{item.petName || t('itemNotPersonalised')}</strong>
              <span className={styles.meta}>
                {item.color ? <span className={styles.color}><i data-color={item.color} aria-hidden="true" />{t(item.color === 'red' ? 'colorRed' : 'colorGrey')}</span> : item.kind === 'custom' ? <span>{t('colorUnknown')}</span> : null}
                {item.backName ? <span>{t('backName')}: {item.backName}</span> : null}
              </span>
            </div>
            {item.cost != null ? <span>{money(item.cost)}</span> : null}
          </li>
        ))}
      </ul>
      {total != null || paymentState ? <div className={styles.total}>
        <div><span>{t('orderTotal')}</span>{total != null ? <strong>{money(total)}</strong> : null}</div>
        {paymentState ? <span className={styles.payment} data-paid={paymentState === 'paid'}>{t(`payment_${paymentState}`)}</span> : null}
      </div> : null}
    </section>
  )
}
