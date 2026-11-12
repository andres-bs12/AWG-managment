import { useLocale } from '../../../i18n/LocaleContext'
import { formatEur } from '../../../lib/money'
import styles from '../BuyPage.module.css'

/** Cart lines shared by the delivery aside and the review. Market pickup has no delivery line at all. */
export function CartRows({ t, count, itemsTotal, deliveryFee, total, pickup, live = false }: {
  t: ReturnType<typeof useLocale>['t']; count: number; itemsTotal: number; deliveryFee: number; total: number; pickup: boolean; live?: boolean
}) {
  const { locale } = useLocale()
  return <dl aria-live={live ? 'polite' : undefined}>
    <div><dt>{count > 1 ? t('shopItemsN', { n: count }) : t('shopItemOne')}</dt><dd>{formatEur(itemsTotal, locale)}</dd></div>
    {!pickup && <div><dt>{t('shopDeliveryFee')}</dt><dd>{deliveryFee ? formatEur(deliveryFee, locale) : t('shopFree')}</dd></div>}
    <div className={styles.cartTotal}><dt>{t('shopTotal')}</dt><dd>{formatEur(total, locale)}</dd></div>
  </dl>
}
