import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Field'
import { newItem } from '../../../lib/buyDraft'
import { formatEur } from '../../../lib/money'
import { colorKeys } from './shared'

export function BuyItemsStep({ t, draft, config, itemPrice, patch, patchItem, err, described }: Pick<BuyStepProps, 't' | 'draft' | 'config' | 'itemPrice' | 'patch' | 'patchItem' | 'err' | 'described'>) {
  const { locale } = useLocale()
  return (<>
    <div className={styles.product}>
      <svg

        className={styles.productArt}

        viewBox="0 0 80 90"

        aria-hidden="true"

        data-color={draft.items[0]?.color || 'red'}>
        <path d="M34 12a6 6 0 0 1 12 0" fill="none" stroke="#b89a56" strokeWidth="3" />
        <path d="M31 12h18v10H31z" fill="#d2b66f" />
        <circle cx="40" cy="52" r="32" fill="currentColor" stroke="#bca980" strokeWidth="2" />
        <path

          d="M20 41c3-11 11-17 20-18"

          fill="none"

          stroke="white"

          strokeOpacity=".55"

          strokeWidth="4"

          strokeLinecap="round" />
        <path d="M40 37c-3-5-10-4-10 2 0 5 10 12 10 12s10-7 10-12c0-6-7-7-10-2Z" fill="#fff6e2" />
      </svg>
      <div>
        <h3>
          {t('shopProduct')}</h3>
        <strong>
          {formatEur(config.customPrice, locale)}</strong>
        <p>
          {t('shopCustomHint')}</p>
        <p>
          {t('shopIncludes')}</p></div></div>
    {draft.items.map((item, index) => <div className={styles.card} key={item.uid}>
      <div className={styles.cardHead}>
        <h3>
          {t('ornamentN', { n: index + 1 })}</h3>
        <span className={styles.price}>
          {formatEur(itemPrice(item), locale)}</span>
        {draft.items.length > 1 && <button

          type="button"

          className={styles.linkBtn}

          aria-label={t('shopRemoveItem', { n: index + 1 })}

          onClick={() => patch({ items: draft.items.filter((other) => other.uid !== item.uid) })}>
          {t('shopRemove')}</button>}</div>
      <fieldset

        id={`color-${item.uid}`}

        tabIndex={-1}

        className={styles.chips}

        aria-describedby={described(`color-${item.uid}`)}>
        <legend>
          {t('shopColour')}</legend>
        {config.colors.map((option) => <label

          key={option.color}

          className={styles.chip}

          data-selected={item.color === option.color}

          data-disabled={!option.inStock}>
          <input

            className="visually-hidden"

            aria-label={`${t(colorKeys[option.color])}${!option.inStock ? ` ${t('shopSoldOut')}` : ''}`}
            type="radio"

            name={`color-${item.uid}`}

            checked={item.color === option.color}

            disabled={!option.inStock}

            onChange={() => patchItem(item.uid, { color: option.color })} />
          <span className={styles.swatch} data-color={option.color} aria-hidden="true" />
          <span>
            {t(colorKeys[option.color])}{!option.inStock && <small>
              {t('shopSoldOut')}</small>}</span></label>)}</fieldset>
      {err(`color-${item.uid}`) && <p className={styles.error} id={`color-${item.uid}-error`} role="alert">
        {err(`color-${item.uid}`)}</p>}
      <label className={styles.check}>
        <input

          aria-label={t('shopNameOnBack', { price: formatEur(config.nameExtra, locale) })}
          type="checkbox"

          checked={item.withName}

          onChange={(event) => patchItem(item.uid, { withName: event.target.checked })} />
        <span>
          {t('shopNameOnBack', { price: formatEur(config.nameExtra, locale) })}</span></label>
      {item.withName && <Field

        label={t('backName')}

        htmlFor={`back-${item.uid}`}

        hint={t('shopBackNameHint')}

        error={err(`back-${item.uid}`)}>
        <input

          id={`back-${item.uid}`}

          value={item.backName}

          maxLength={6}

          aria-invalid={!!err(`back-${item.uid}`)}

          aria-describedby={described(`back-${item.uid}`, true)}

          onChange={(event) => patchItem(item.uid, { backName: event.target.value.toUpperCase().replace(/[^\p{L}]/gu, '').slice(0, 6) })} /></Field>}
    </div>)}
    <Button

      id="buy-add"

      variant="secondary"

      disabled={draft.items.length >= config.maxItems}

      onClick={() => patch({ items: [...draft.items, newItem()] })}>
      {t('shopAddAnother')}</Button>
    {err('buy-add') && <p className={styles.error} role="alert">
      {err('buy-add')}</p>}{draft.items.length >= config.maxItems && <p className={styles.muted}>
        {t('shopMaxItems', { max: config.maxItems })}</p>}
  </>)
}
