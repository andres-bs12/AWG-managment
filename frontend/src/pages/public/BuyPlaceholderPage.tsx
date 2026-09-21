import { ButtonLink } from '../../components/ui/ButtonLink'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './Panel.module.css'

export function BuyPlaceholderPage() {
  const { t } = useLocale()
  return (
    <div className={styles.panel}>
      <h1>{t('buySoonTitle')}</h1>
      <p className={styles.lead}>{t('buySoonBody')}</p>
      <div className={styles.actions}>
        <ButtonLink to="/track" fullWidth>
          {t('track')}
        </ButtonLink>
        <ButtonLink to="/" variant="ghost" fullWidth>
          {t('backHome')}
        </ButtonLink>
      </div>
    </div>
  )
}
