import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { formatEur } from '../../../lib/money'
import { OrnamentPreview } from '../../../components/public/OrnamentPreview'
import { NoWrap, ReviewCard, ReviewProduct } from '../../../components/public/ReviewCard'
import { ornamentName, reviewTitle } from '../../../lib/ornamentTitle'
import { CartRows } from './CartRows'
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
      const title = reviewTitle(item, index, draft.items.length, t)
      return <ReviewCard key={item.uid} title={title} changed={changed === item.uid}
        action={{ label: t('change'), ariaLabel: t('editOrnamentNamed', { name: ornamentName(item) || title }), onClick: () => go(0, item.uid, 0, `color-${item.uid}`) }}
        rows={item.note.trim() ? [{ label: t('noteLabel'), value: item.note }] : []}>
        {/* The name is the title; the line below only says the name option was chosen and what it adds. */}
        <ReviewProduct art={<OrnamentPreview item={item} static />} price={formatEur(itemPrice(item), locale)}
          lines={[
            [item.color && t(colorKeys[item.color]), item.finish && t(item.finish === 'shiny' ? 'finishShiny' : 'finishMatte')].filter(Boolean).join(' · '),
            item.withName ? <>{t('reviewWithName')} <NoWrap>(+{formatEur(config.nameExtra, locale)})</NoWrap></> : t('multiNoName'),
          ]}
          photos={item.photos} photoAlt={i => t('photoAlt', { n: i + 1, name: ornamentName(item) || t('yourPet') })} />
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
    <section className={`${styles.cart} ${styles.reviewCart}`} aria-labelledby="review-cart-heading"><h3 id="review-cart-heading">{t('shopCart')}</h3><CartRows t={t} count={draft.items.length} itemsTotal={itemsTotal} deliveryFee={deliveryFee} total={total} pickup={pickup} /></section>
    <div className={styles.terms}><div className={styles.inset}><p>{t('personalisedNoReturn')}</p></div>
    <div className={styles.check}><input id="buy-terms" aria-labelledby="buy-terms-label" type="checkbox" checked={draft.acceptTerms} aria-invalid={!!err('buy-terms')} aria-describedby={described('buy-terms')} onChange={event => patch({ acceptTerms: event.target.checked })} /><label id="buy-terms-label" htmlFor="buy-terms">{t('shopTermsBefore')}<a href="/agb" target="_blank" rel="noopener noreferrer">{t('terms')}</a>{t('shopTermsAfter')} {t('shopPrivacyBefore')}<a href="/datenschutz" target="_blank" rel="noopener noreferrer">{t('privacy')}</a>.</label></div>
    {err('buy-terms') && <p className={styles.error} id="buy-terms-error" role="alert">{err('buy-terms')}</p>}</div>{serverError && <p className={styles.error} role="alert">{serverError}</p>}
  </>
}
