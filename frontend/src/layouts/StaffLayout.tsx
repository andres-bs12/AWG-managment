import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { ButtonLink } from '../components/ui/ButtonLink'
import { rememberStaffHub } from '../lib/staffNav'
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
  const onDeliveries = location.pathname.startsWith('/staff/deliveries')
  const onMarkets = location.pathname.startsWith('/staff/markets')
  const onNewSale = location.pathname.startsWith('/staff/sales/new')
  const onPaint = location.pathname.includes('/paint/')

  useEffect(() => {
    rememberStaffHub(location.pathname + location.search)
  }, [location.pathname, location.search])

  return (
    <div className={onPaint ? `${styles.shell} ${styles.shellPaint}` : styles.shell}>
      {onPaint ? null : (
        <header className={styles.bar}>
          <p className={styles.brand}>AWG</p>
          <nav className={styles.nav} aria-label="Staff">
            <ButtonLink to="/staff/agenda" tone="staff" variant="ghost" selected={onAgenda}>
              Agenda
            </ButtonLink>
            <ButtonLink to="/staff/deliveries" tone="staff" variant="ghost" selected={onDeliveries}>
              Deliveries
            </ButtonLink>
            <ButtonLink to="/staff/markets" tone="staff" variant="ghost" selected={onMarkets}>
              Markets
            </ButtonLink>
            <ButtonLink to="/staff/sales/new?fresh=1" tone="staff" variant="ghost" selected={onNewSale}>
              New sale
            </ButtonLink>
          </nav>
          <div className={styles.who}>
            <span className={styles.whoName}>{user?.name}</span>
            <Button tone="staff" variant="ghost" className={styles.logout} onClick={() => void logout()}>
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
