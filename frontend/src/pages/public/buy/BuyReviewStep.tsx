import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { formatEur } from '../../../lib/money'
import { OrnamentPreview } from '../../../components/public/OrnamentPreview'
import { ReviewCard } from '../../../components/public/ReviewCard'
import { colorKeys } from './shared'

export function BuyReviewStep({ t, draft, config, itemPrice, formatDate, patch, err, described, serverError, go, itemsTotal, total, changed }: Pick<BuyStepProps, 't' | 'draft' | 'config' | 'itemPrice' | 'formatDate' | 'patch' | 'err' | 'described' | 'serverError'> & { go: (step: number, uid?: string, substep?: number, field?: string) => void; itemsTotal: number; total: number; changed: string }) {
  const { locale } = useLocale()
  const change = (key: string, step: number, uid?: string, substep?: number) => {
    const item = draft.items.findIndex(entry => entry.uid === uid)
    return <button type="button" className={styles.linkBtn} aria-label={uid && draft.items.length > 1 ? t('editItem', { action: t(key), item: t('ornamentN', { n: item + 1 }) }) : undefined} onClick={() => go(step, uid, substep, uid ? `${({ editColour: 'color', editFinish: 'finish', editPhotos: 'photos-block', editPet: 'pet', editName: 'back' } as Record<string, string>)[key]}-${uid}` : step === 2 ? 'buy-date' : step === 4 ? 'buy-line1' : 'buy-name')}>{t(key)}</button>
  }
  return <>
    {draft.items.map((item, index) => <ReviewCard key={item.uid} title={t('ornamentN', { n: index + 1 })} changed={changed === item.uid} rows={[
      { label: t('shopColour'), value: item.color && t(colorKeys[item.color]), action: change('editColour', 0, item.uid, 0) },
      { label: t('shopFinish'), value: item.finish && t(item.finish === 'shiny' ? 'finishShiny' : 'finishMatte'), action: change('editFinish', 0, item.uid, 0) },
      { label: t('petName'), value: item.petName, action: change('editPet', 0, item.uid, 2) },
      { label: t('formPhotos'), value: t('photosCount', { n: item.photos.length }), action: change('editPhotos', 0, item.uid, 2) },
      ...(item.withName ? [{ label: t('shopNameExtraLine'), value: <>{item.backName}<br /><span className={styles.price}>+{formatEur(itemPrice(item) - config.customPrice, locale)}</span></>, action: change('editName', 0, item.uid, 1) }] : []),
    ]}>
      <div className={styles.reviewProduct}><div className={styles.reviewPreview}><OrnamentPreview item={item} static /></div><p>{item.petName}</p><strong className={styles.price}>{formatEur(config.customPrice, locale)}</strong></div>
    </ReviewCard>)}
    <ReviewCard title={t('shopStepDate')} changed={changed === 'delivery'} rows={[
      { label: t('shopStepDate'), value: <>{draft.deliveryDate && formatDate(draft.deliveryDate)} · {t('eveningShort')}</>, action: change('editDate', 2) },
      { label: t('addressHeading'), value: <>{draft.line1}<br />{draft.line2 && <>{draft.line2}<br /></>}{draft.postalCode} Wien</>, action: change('editReviewAddress', 4) },
    ]} />
    <ReviewCard title={t('contactHeading')} changed={changed === 'contact'} rows={[
      { label: t('yourName'), value: draft.customerName, action: change('editContact', 3) },
      { label: t('email'), value: draft.email },
      { label: t('phone'), value: draft.phone },
    ]} />
    <section className={styles.reviewCard}><h3>{t('shopTotal')}</h3><dl className={styles.totals}><div><dt>{t('shopItemsTotal')}</dt><dd>{formatEur(itemsTotal, locale)}</dd></div><div><dt>{t('shopDeliveryFee')}</dt><dd>{config.deliveryFee ? formatEur(config.deliveryFee, locale) : t('shopFree')}</dd></div><div><dt>{t('shopTotal')}</dt><dd><strong>{formatEur(total, locale)}</strong></dd></div></dl></section>
    <p className={styles.afterPayment}>{t('afterPayment')}</p>
    <div className={styles.terms}><div className={styles.inset}><p>{t('personalisedNoReturn')}</p>{draft.items.some(item => item.withName) && <p>{t('nameNonRefund')}</p>}</div>
    <div className={styles.check}><input id="buy-terms" aria-labelledby="buy-terms-label" type="checkbox" checked={draft.acceptTerms} aria-invalid={!!err('buy-terms')} aria-describedby={described('buy-terms')} onChange={event => patch({ acceptTerms: event.target.checked })} /><label id="buy-terms-label" htmlFor="buy-terms">{t('shopTermsBefore')}<a href="/agb" target="_blank" rel="noopener noreferrer">{t('terms')}</a>{t('shopTermsAfter')} {t('shopPrivacyBefore')}<a href="/datenschutz" target="_blank" rel="noopener noreferrer">{t('privacy')}</a>.</label></div>
    {err('buy-terms') && <p className={styles.error} id="buy-terms-error" role="alert">{err('buy-terms')}</p>}</div>{serverError && <p className={styles.error} role="alert">{serverError}</p>}
  </>
}
