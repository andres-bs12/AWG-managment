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

type ReviewPhoto = { id: string; dataUrl: string }

/**
 * One ornament in a review card, the same in /buy and /form: art on the left, then the main line
 * beside its price, the smaller details under both (full width, so a price detail never wraps), and
 * the reference photos under the text instead of on an orphan row of their own.
 */
export function ReviewProduct({ art, lines, price, photos = [], photoAlt }: { art: ReactNode; lines: ReactNode[]; price: string; photos?: ReviewPhoto[]; photoAlt: (index: number) => string }) {
  const [main, ...details] = lines
  return <div className={styles.product}>
    <div className={styles.art}>{art}</div>
    <div className={styles.body}>
      <div className={styles.top}>
        <p className={styles.main}>{main}</p>
        <strong className={styles.price}>{price}</strong>
        {details.map((line, index) => <p key={index} className={styles.detail}>{line}</p>)}
      </div>
      {photos.length > 0 && <div className={styles.photos}>{photos.map((photo, index) => <img key={photo.id} src={photo.dataUrl} alt={photoAlt(index)} />)}</div>}
    </div>
  </div>
}

/** A price detail such as "(+ € 12,99)" that must never break across lines. */
export function NoWrap({ children }: { children: ReactNode }) {
  return <span className={styles.nowrap}>{children}</span>
}
