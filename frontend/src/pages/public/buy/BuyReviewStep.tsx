import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { formatEur } from '../../../lib/money'
import { OrnamentPreview } from '../../../components/public/OrnamentPreview'
import { colorKeys } from './shared'

export function BuyReviewStep({ t, draft, config, itemPrice, formatDate, patch, err, described, serverError, go, itemsTotal, total, changed }: Pick<BuyStepProps, 't' | 'draft' | 'config' | 'itemPrice' | 'formatDate' | 'patch' | 'err' | 'described' | 'serverError'> & { go: (step: number, uid?: string, substep?: number) => void; itemsTotal: number; total: number; changed: string }) {
  const { locale } = useLocale()
  const change = (step: number, section: string, uid?: string, substep?: number) => <button type="button" className={styles.linkBtn} aria-label={t('changeSection', { section })} onClick={() => go(step, uid, substep)}>{t('change')}</button>
  return <>
    <section className={styles.reviewCard}><div className={styles.cardHead}><h3>{t('shopStepItems')}</h3></div>{draft.items.map(item => <div className={styles.reviewItem} data-changed={changed === item.uid} key={item.uid}><div className={styles.reviewRow}><div className={styles.reviewPreview}><OrnamentPreview item={item} /></div><p>{item.color && t(colorKeys[item.color])} · {item.finish && t(item.finish === 'shiny' ? 'finishShiny' : 'finishMatte')}<br />{item.petName}</p><strong>{formatEur(config.customPrice, locale)}</strong></div><div className={styles.reviewLinks}>{change(0, t('shopStepItems'), item.uid, 0)} {change(0, t('shopStepPet'), item.uid, 2)} {item.withName && change(0, t('shopNameExtraLine'), item.uid, 1)}</div>{item.withName && <div className={styles.reviewExtra}><span>{t('shopNameExtraLine')}: {item.backName}</span><span>{formatEur(itemPrice(item) - config.customPrice, locale)}</span></div>}</div>)}</section>
    <section className={styles.reviewCard} data-changed={changed === "delivery"}><div className={styles.cardHead}><h3>{t('shopStepDate')}</h3>{change(2, t('shopStepDate'))}</div><p>{draft.deliveryDate && formatDate(draft.deliveryDate)} · {t('evening')}</p><p>{draft.line1}<br />{draft.line2 && <>{draft.line2}<br /></>}{draft.postalCode} Wien</p></section>
    <section className={styles.reviewCard} data-changed={changed === "contact"}><div className={styles.cardHead}><h3>{t('contactHeading')}</h3>{change(3, t('contactHeading'))}</div><p>{draft.customerName}<br />{draft.email}<br />{draft.phone}</p></section>
    <section className={styles.reviewCard}><h3>{t('shopTotal')}</h3><dl className={styles.totals}><div><dt>{t('shopItemsTotal')}</dt><dd>{formatEur(itemsTotal, locale)}</dd></div><div><dt>{t('shopDeliveryFee')}</dt><dd>{config.deliveryFee ? formatEur(config.deliveryFee, locale) : t('shopFree')}</dd></div><div><dt>{t('shopTotal')}</dt><dd><strong>{formatEur(total, locale)}</strong></dd></div></dl></section>
    <div className={styles.terms}><div className={styles.inset}><p>{t('personalisedNoReturn')}</p>{draft.items.some(item => item.withName) && <p>{t('nameNonRefund')}</p>}</div>
    <div className={styles.check}><input id="buy-terms" aria-labelledby="buy-terms-label" type="checkbox" checked={draft.acceptTerms} aria-invalid={!!err('buy-terms')} aria-describedby={described('buy-terms')} onChange={event => patch({ acceptTerms: event.target.checked })} /><label id="buy-terms-label" htmlFor="buy-terms">{t('shopTermsBefore')}<a href="/agb" target="_blank" rel="noopener noreferrer">{t('terms')}</a>{t('shopTermsAfter')} {t('shopPrivacyBefore')}<a href="/datenschutz" target="_blank" rel="noopener noreferrer">{t('privacy')}</a>.</label></div>
    {err('buy-terms') && <p className={styles.error} id="buy-terms-error" role="alert">{err('buy-terms')}</p>}</div>{serverError && <p className={styles.error} role="alert">{serverError}</p>}
  </>
}
