import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { formatEur } from '../../../lib/money'
import { colorKeys } from './shared'

export function BuyReviewStep({ t, draft, itemPrice, formatDate, patch, err, described, serverError }: Pick<BuyStepProps, 't' | 'draft' | 'itemPrice' | 'formatDate' | 'patch' | 'err' | 'described' | 'serverError'>) {
  const { locale } = useLocale()
  return (<>
    <div className={styles.review}>
      {draft.items.map((item, index) => <div className={styles.reviewItem} key={item.uid}>
        <div className={styles.cardHead}>
          <h3>
            {t('ornamentN', { n: index + 1 })}</h3>
          <strong>
            {formatEur(itemPrice(item), locale)}</strong></div>
        <p>
          {t('shopColour')}: {item.color && t(colorKeys[item.color])}</p>
        <p>
          {t('petName')}: {item.petName}</p>
        <p>
          {t('formPhotos')}: {item.photos.length}</p>
        {item.withName && <p>
          {t('shopNameExtraLine')}: {item.backName}</p>}{item.note.trim() && <p>
            {t('noteLabel')}: {item.note}</p>}</div>)}<div className={styles.reviewItem}>
        <h3>
          {t('shopStepDate')}</h3>
        <p>
          {draft.deliveryDate && formatDate(draft.deliveryDate)}</p>
        <h3>
          {t('shopStepContact')}</h3>
        <p>
          {draft.customerName}<br />
          {draft.email}<br />
          {draft.phone}<br />
          {draft.line1}<br />
          {draft.line2 && <>
            {draft.line2}<br /></>}{draft.postalCode} Wien</p></div></div>
    <label className={styles.check} htmlFor="buy-terms">
      <input

        id="buy-terms"

        type="checkbox"

        checked={draft.acceptTerms}

        aria-invalid={!!err('buy-terms')}

        aria-describedby={described('buy-terms')}

        onChange={(event) => patch({ acceptTerms: event.target.checked })} />
      <span>
        {t('shopTermsBefore')}<a href="/agb" target="_blank" rel="noopener noreferrer">{t('terms')}</a>{t('shopTermsAfter')} {t('shopPrivacyBefore')}<a href="/datenschutz" target="_blank" rel="noopener noreferrer">{t('privacy')}</a>.</span></label>
    {err('buy-terms') && <p className={styles.error} id="buy-terms-error" role="alert">
      {err('buy-terms')}</p>}
    {serverError && <p className={styles.error} role="alert">
      {serverError}</p>}<p className={styles.muted}>
      {t('shopPayNote')}</p>
    <p>
      {t('shopAfterPayment')}</p></>)
}
