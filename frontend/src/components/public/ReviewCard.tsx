import { useId, type ReactNode } from 'react'
import styles from './ReviewCard.module.css'

export type ReviewRow = { label: string; value: ReactNode }
export type ReviewAction = { label: string; ariaLabel?: string; onClick: () => void }

/**
 * One review card: title with at most one "Edit" next to it (it opens the whole section), then
 * label/value rows. Never one button per attribute (docs/design-system.md, review cards).
 */
export function ReviewCard({ title, rows, children, action, changed = false }: { title: string; rows: ReviewRow[]; children?: ReactNode; action?: ReviewAction; changed?: boolean }) {
  const heading = useId()
  return <section className={styles.card} aria-labelledby={heading} data-changed={changed}>
    <div className={styles.header}><h3 id={heading}>{title}</h3>{action && <button type="button" className={styles.edit} aria-label={action.ariaLabel} onClick={action.onClick}>{action.label}</button>}</div>
    {children}
    {rows.length > 0 && <dl className={styles.rows}>{rows.map((row, index) => <div className={styles.row} key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>}
  </section>
}

/** Reference photo thumbnails; no heading, the pictures speak for themselves. */
export function ReviewThumbs({ photos, alt }: { photos: { id: string; dataUrl: string }[]; alt: (index: number) => string }) {
  if (!photos.length) return null
  return <div className={styles.thumbs}>{photos.map((photo, index) => <img key={photo.id} src={photo.dataUrl} alt={alt(index)} />)}</div>
}
