import { Link, useLocation } from 'react-router-dom'
import { staffHubTarget } from '../../lib/staffNav'
import styles from './StaffBackLink.module.css'

type Props = {
  to?: string
  label?: string
  /** Router state for the destination; by default the current `from` is passed on. */
  state?: unknown
}

export function StaffBackLink({ to, label, state }: Props) {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const hub = staffHubTarget(from)
  const dest = to ?? hub.to
  const text = label ?? hub.label

  return (
    <Link className={styles.back} to={dest} state={state !== undefined ? state : from ? { from } : undefined}>
      ← {text}
    </Link>
  )
}
