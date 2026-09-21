import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { ButtonLink } from '../components/ui/ButtonLink'
import styles from './StaffLayout.module.css'

export function StaffGuard() {
  const { ready, user } = useAuth()
  const location = useLocation()
  if (!ready) {
    return (
      <p style={{ padding: 24, minHeight: '100vh', background: 'var(--staff-bg)', color: 'var(--staff-ink)' }}>
        Loading session…
      </p>
    )
  }
  if (!user) return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function StaffLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const onAgenda = location.pathname.startsWith('/staff/agenda')
  const onNewSale = location.pathname.startsWith('/staff/sales/new')
  const onPaint = location.pathname.includes('/paint/')
  const onOrder = location.pathname.startsWith('/staff/orders/') && !onPaint

  return (
    <div className={onPaint ? `${styles.shell} ${styles.shellPaint}` : styles.shell}>
      {onPaint ? null : (
        <header className={styles.bar}>
          <p className={styles.brand}>AWG</p>
          <nav className={styles.nav} aria-label="Staff">
            <ButtonLink to="/staff/agenda" tone="staff" variant="ghost" selected={onAgenda}>
              {onAgenda ? 'Current: Agenda' : 'Agenda'}
            </ButtonLink>
            <ButtonLink to="/staff/sales/new?fresh=1" tone="staff" variant="ghost" selected={onNewSale}>
              {onNewSale ? 'Current: New sale' : 'New sale'}
            </ButtonLink>
            {onOrder ? (
              <span className={styles.navCurrent} aria-current="page">
                Current: Order
              </span>
            ) : null}
          </nav>
          <div className={styles.who}>
            <span>{user?.name}</span>
            <Button tone="staff" variant="ghost" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </header>
      )}
      <div className={onPaint ? styles.mainBleed : styles.main}>
        <Outlet />
      </div>
    </div>
  )
}
