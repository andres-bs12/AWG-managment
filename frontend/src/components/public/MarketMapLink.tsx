import { useLocale } from '../../i18n/LocaleContext'
import styles from './MarketMapLink.module.css'

/** Google Maps search for a market. The market model has no address, so the name (plus the city) is the query. */
export const marketMapUrl = (name: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, Wien`)}`

/**
 * Market name as a link that opens Google Maps in a new tab. `label` is the visible text when it
 * differs from the searched name (e.g. with the stall number); `inline` keeps it inside a sentence.
 */
export function MarketMapLink({ name, label, inline = false }: { name: string; label?: string; inline?: boolean }) {
  const { t } = useLocale()
  const text = label ?? name
  return <a className={`${styles.link} ${inline ? styles.inline : ''}`} href={marketMapUrl(name)} target="_blank" rel="noopener noreferrer" aria-label={t('openInMaps', { market: text })}>
    <svg className={styles.pin} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
    <span>{text}</span>
  </a>
}
