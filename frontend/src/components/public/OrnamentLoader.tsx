import { useLocale } from '../../i18n/LocaleContext'
import { PetBauble } from './PetBauble'
import styles from './OrnamentLoader.module.css'

type Props = {
  /** 'screen' fills the viewport while a lazy public page loads; 'inline' sits inside a page card. */
  variant?: 'screen' | 'inline'
  /** Optional visible caption for the inline variant; the screen variant always shows the intro text. */
  label?: string
}

/**
 * Pet baubles swinging on their threads, as in the opening curtain, plus the four pastel dots.
 * The screen variant mirrors the curtain panel at rest: transparent background, threads from the
 * top edge, copy near the bottom. The inline variant is a small centred block for page cards.
 */
export function OrnamentLoader({ variant = 'inline', label }: Props) {
  const { t } = useLocale()
  const screen = variant === 'screen'
  const loading = t('introLoading')
  return (
    <div
      className={`${styles.loader} ${screen ? styles.screen : styles.inline}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.baubles} aria-hidden="true">
        <PetBauble pet="cat" className={styles.hangA} />
        <PetBauble pet="dog" className={styles.hangB} />
      </div>
      {screen ? (
        <p className={styles.label}>{loading}</p>
      ) : label ? (
        <p className={styles.label}>{label}</p>
      ) : (
        <span className="visually-hidden">{loading}</span>
      )}
      <div className={styles.dots} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
