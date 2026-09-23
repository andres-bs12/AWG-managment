import { Link, useLocation } from 'react-router-dom'
import { staffHubTarget } from '../../lib/staffNav'
import styles from './StaffBackLink.module.css'

type Props = {
  to?: string
  label?: string
}

export function StaffBackLink({ to, label }: Props) {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const hub = staffHubTarget(from)
  const dest = to ?? hub.to
  const text = label ?? hub.label

  return (
    <Link className={styles.back} to={dest} state={from ? { from } : undefined}>
      ← {text}
    </Link>
  )
}
