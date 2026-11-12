import type { ReactNode } from 'react'
import styles from './OrderTimeline.module.css'

/** Describes confirmed events only; callers supply the appropriate first event. */
export function OrderTimeline({ labels }: { labels: ReactNode[] }) {
  return <ol className={styles.timeline}>{labels.map((label, index) => <li key={index} aria-current={index === 0 ? 'step' : undefined}>{label}{index === 0 && <span aria-hidden="true"> ✓</span>}</li>)}</ol>
}
