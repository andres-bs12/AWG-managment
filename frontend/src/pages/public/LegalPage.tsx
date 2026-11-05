import { useLocale } from '../../i18n/LocaleContext'
import styles from './LegalPage.module.css'

export function LegalPage({ title }: { title: 'impressum' | 'terms' | 'privacy' }) {
  const { t } = useLocale()
  return <article className={styles.page}><h1>{t(title)}</h1><p>{t('legalPreparing')}</p></article>
}
