import { useId, type ReactNode } from 'react'
import styles from './ReviewCard.module.css'

export type ReviewRow = { label: string; value: ReactNode; action?: ReactNode }

/** One label/value/action grid for every fact, including a back-name surcharge. */
export function ReviewCard({ title, rows, children, changed = false }: { title: string; rows: ReviewRow[]; children?: ReactNode; changed?: boolean }) {
  const heading = useId()
  return <section className={styles.card} aria-labelledby={heading} data-changed={changed}>
    <h3 id={heading}>{title}</h3>
    {children}
    <dl className={styles.rows}>{rows.map((row, index) => <div className={styles.row} key={index}><dt>{row.label}</dt><dd>{row.value}</dd><dd className={styles.action}>{row.action}</dd></div>)}</dl>
  </section>
}
