import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { useLocale } from '../../../i18n/LocaleContext'
import { Button } from '../../../components/ui/Button'

export function BuyDateStep({ t, draft, config, dates, datesState, setDatesRetry, patch, formatDate, err, described }: Pick<BuyStepProps, 't' | 'draft' | 'config' | 'dates' | 'datesState' | 'setDatesRetry' | 'patch' | 'formatDate' | 'err' | 'described'>) {
  const { locale } = useLocale()
  return (<>
    <p>
      {t('shopDateLead')}</p><p>{t('shopSeasonEnd', { date: new Intl.DateTimeFormat(locale === 'de' ? 'de-AT' : 'en-GB', { day: 'numeric', month: 'long' }).format(new Date(`${config.seasonEnd}T12:00:00`)) })}</p>
    <p className={styles.muted} role="status">
      {datesState === 'loading' ? t('shopDatesLoading') : datesState === 'error' ? t('shopDatesError') : datesState === 'ready' && !dates.length ? t('shopDatesNone') : datesState === 'ready' ? t('shopDatesReady', { n: dates.length }) : t('shopDatesNeedItems')}</p>
    {datesState === 'error' && <Button variant="secondary" onClick={() => setDatesRetry((value) => value + 1)}>
      {t('shopRetry')}</Button>}
    <fieldset

      id="buy-date"

      tabIndex={-1}

      className={styles.chips}

      aria-busy={datesState === 'loading'}

      aria-describedby={described('buy-date')}>
      <legend className="visually-hidden">
        {t('shopStepDate')}</legend>
      {datesState === 'ready' && dates.map((date) => <label key={date.date} className={styles.chip} data-selected={draft.deliveryDate === date.date}>
        <input

          className="visually-hidden"

          type="radio"

          name="delivery-date"

          checked={draft.deliveryDate === date.date}

          onChange={() => patch({ deliveryDate: date.date })} />
        {formatDate(date.date)}</label>)}</fieldset>
    {err('buy-date') && <p className={styles.error} id="buy-date-error" role="alert">
      {err('buy-date')}</p>}</>)
}
