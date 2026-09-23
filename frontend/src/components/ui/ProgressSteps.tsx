import styles from './ProgressSteps.module.css'

export function ProgressSteps({ labels, current, label, compact = false }: { labels: string[]; current: number; label: string; compact?: boolean }) {
  return <nav aria-label={label} className={styles.progress} data-compact={compact}>
    <ol>{labels.map((text, index) => <li key={text} data-complete={index < current} aria-current={index === current ? 'step' : undefined}>
      <span className={styles.dot} aria-hidden="true">{index < current ? '✓' : index + 1}</span>
      <span className={styles.label}>{text}</span>
    </li>)}</ol>
    {compact ? <p>{label}</p> : null}
  </nav>
}
