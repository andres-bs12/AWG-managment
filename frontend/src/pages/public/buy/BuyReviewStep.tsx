import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { formatEur } from '../../../lib/money'
import { OrnamentPreview } from '../../../components/public/OrnamentPreview'
import { ReviewCard, ReviewThumbs } from '../../../components/public/ReviewCard'
import { colorKeys } from './shared'
import { pickupPlace, useCompactDate } from './BuyDateStep'

type Props = Pick<BuyStepProps, 't' | 'draft' | 'config' | 'itemPrice' | 'formatDate' | 'patch' | 'err' | 'described' | 'serverError' | 'pickupDays'> & {
  go: (step: number, uid?: string, substep?: number, field?: string) => void
  itemsTotal: number
  deliveryFee: number
  total: number
  changed: string
}

export function BuyReviewStep({ t, draft, config, itemPrice, formatDate, patch, err, described, serverError, pickupDays, go, itemsTotal, deliveryFee, total, changed }: Props) {
  const { locale } = useLocale()
  const compactDate = useCompactDate()
  const pickup = draft.deliveryKind === 'market'
  const day = pickup ? pickupDays.find(entry => entry.date === draft.deliveryDate) : undefined
  return <>
    {draft.items.map((item, index) => {
      const title = `${t('ornamentN', { n: index + 1 })}${item.petName.trim() ? ` – ${item.petName.trim()}` : ''}`
      return <ReviewCard key={item.uid} title={title} changed={changed === item.uid}
        action={{ label: t('change'), ariaLabel: t('editOrnamentNamed', { name: item.petName.trim() || title }), onClick: () => go(0, item.uid, 0, `color-${item.uid}`) }}
        rows={item.note.trim() ? [{ label: t('noteLabel'), value: item.note }] : []}>
        {/* One compact block: art, what was chosen, one price (the name surcharge is named, not a second total). */}
        <div className={styles.reviewProduct}>
          <div className={styles.reviewPreview}><OrnamentPreview item={item} static /></div>
          <div className={styles.reviewLines}>
            <p>{[item.color && t(colorKeys[item.color]), item.finish && t(item.finish === 'shiny' ? 'finishShiny' : 'finishMatte')].filter(Boolean).join(' · ')}</p>
            <p>{item.withName ? <>{t('multiNameValue', { name: item.backName })} <span className={styles.nowrap}>(+{formatEur(config.nameExtra, locale)})</span></> : t('multiNoName')}</p>
          </div>
          <strong className={styles.price}>{formatEur(itemPrice(item), locale)}</strong>
        </div>
        <ReviewThumbs photos={item.photos} alt={i => t('photoAlt', { n: i + 1, name: item.petName || t('yourPet') })} />
      </ReviewCard>
    })}
    <ReviewCard title={pickup ? t('methodMarket') : t('methodVienna')} changed={changed === 'delivery'}
      action={{ label: t('change'), ariaLabel: t('editDeliveryShort'), onClick: () => go(2, undefined, undefined, 'buy-date') }}
      rows={pickup ? [
        ...(day ? [{ label: t('pickupWhere'), value: pickupPlace(day, t) }] : []),
        { label: t('yourDate'), value: day ? `${compactDate(day.date)} · ${t('timeOClock', { time: draft.pickupTime })}` : formatDate(draft.deliveryDate) },
      ] : [
        { label: t('yourDate'), value: draft.deliveryDate ? `${compactDate(draft.deliveryDate)} · ${t('eveningShort')}` : '' },
        { label: t('addressHeading'), value: <>{draft.line1}<br />{draft.line2 && <>{draft.line2}<br /></>}{draft.postalCode} Wien</> },
      ]} />
    <ReviewCard title={t('contactHeading')} changed={changed === 'contact'}
      action={{ label: t('change'), ariaLabel: t('editContactShort'), onClick: () => go(3, undefined, undefined, 'buy-name') }}
      rows={[
        { label: t('yourName'), value: draft.customerName },
        { label: t('email'), value: <span className={styles.reviewEmail}>{draft.email.slice(0, draft.email.indexOf('@') + 1)}<wbr />{draft.email.slice(draft.email.indexOf('@') + 1)}</span> },
        { label: t('phone'), value: draft.phone },
      ]} />
    <section className={`${styles.cart} ${styles.reviewCart}`} aria-labelledby="review-cart-heading"><h3 id="review-cart-heading">{t('shopCart')}</h3><dl><div><dt>{t(draft.items.length > 1 ? 'shopItemsTotal' : 'shopItemOne')}</dt><dd>{formatEur(itemsTotal, locale)}</dd></div><div><dt>{t('shopDeliveryFee')}</dt><dd>{deliveryFee ? formatEur(deliveryFee, locale) : t('shopFree')}</dd></div><div className={styles.cartTotal}><dt>{t('shopTotal')}</dt><dd>{formatEur(total, locale)}</dd></div></dl></section>
    <p className={styles.afterPayment}>{t(draft.items.length > 1 ? 'afterPaymentMany' : 'afterPaymentOne', { day: t(pickup ? 'afterPaymentPickupDay' : 'afterPaymentDeliveryDay') })}</p>
    <div className={styles.terms}><div className={styles.inset}><p>{t('personalisedNoReturn')}</p>{draft.items.some(item => item.withName) && <p>{t('nameNonRefund')}</p>}</div>
    <div className={styles.check}><input id="buy-terms" aria-labelledby="buy-terms-label" type="checkbox" checked={draft.acceptTerms} aria-invalid={!!err('buy-terms')} aria-describedby={described('buy-terms')} onChange={event => patch({ acceptTerms: event.target.checked })} /><label id="buy-terms-label" htmlFor="buy-terms">{t('shopTermsBefore')}<a href="/agb" target="_blank" rel="noopener noreferrer">{t('terms')}</a>{t('shopTermsAfter')} {t('shopPrivacyBefore')}<a href="/datenschutz" target="_blank" rel="noopener noreferrer">{t('privacy')}</a>.</label></div>
    {err('buy-terms') && <p className={styles.error} id="buy-terms-error" role="alert">{err('buy-terms')}</p>}</div>{serverError && <p className={styles.error} role="alert">{serverError}</p>}
  </>
}
