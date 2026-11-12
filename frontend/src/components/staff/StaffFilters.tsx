import { useId, useState, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import styles from './StaffFilters.module.css'

/** Keep one set of filter controls, expanded on larger screens. */
export function StaffFilters({ count, inline, mobileInline = false, children }: { count: number; inline: ReactNode; mobileInline?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className={styles.filters}>
    <div className={styles.compact} data-mobile-only={mobileInline}>
      <div className={styles.inline}>{inline}</div>
      <Button tone="staff" variant="secondary" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>Filters ({count})</Button>
    </div>
    <div id={id} className={styles.controls} data-open={open}>{children}</div>
  </div>
}
