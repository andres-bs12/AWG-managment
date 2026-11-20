import styles from './ProgressSteps.module.css'
import { useLocale } from '../../i18n/LocaleContext'

/**
 * Numbered steps with their section names under the circles. "Schritt 1 von 2" is said once,
 * for screen readers only (the nav label) — a visible stepper must not be followed by the same fact in words.
 */
export function ProgressSteps({ labels, current, label, tone = 'public' }: { labels: string[]; current: number; label: string; compact?: boolean; tone?: 'public' | 'staff' }) {
  const { t } = useLocale()
  return <nav aria-label={label} className={styles.progress} data-tone={tone}>
    <ol>{labels.map((text, index) => <li key={text} data-complete={index < current} aria-current={index === current ? 'step' : undefined}>
      <span className={styles.dot} aria-hidden="true">{index < current ? '✓' : index + 1}</span>
      <span className={styles.label}>{text}{index < current && <span className="visually-hidden"> ({tone === 'staff' ? 'Completed' : t('stepDone')})</span>}</span>
    </li>)}</ol>
  </nav>
}
