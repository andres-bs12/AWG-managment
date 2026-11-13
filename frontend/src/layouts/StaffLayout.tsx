import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { StaffDialog } from '../components/staff/StaffDialog'
import { Button } from '../components/ui/Button'
import { ButtonLink } from '../components/ui/ButtonLink'
import { rememberStaffHub } from '../lib/staffNav'
import { useStaffRefresh } from '../lib/useStaffRefresh'
import styles from './StaffLayout.module.css'

export function StaffGuard() {
  const { ready, user, offline, expired, retrySession, logout } = useAuth()
  const location = useLocation()
  if (!ready || (offline && !user)) return <main data-staff-page className={styles.session}>
    <h1>Staff session</h1><p role="status">{offline ? 'Offline — retrying' : 'Loading session…'}</p>
    {offline && <><Button tone="staff" onClick={retrySession}>Retry session</Button><Button tone="staff" variant="secondary" onClick={() => void logout()}>Log out</Button></>}
  </main>
  if (!user) return <Navigate to={`/staff/login?next=${encodeURIComponent(location.pathname + location.search)}${expired ? '&expired=1' : ''}`} replace />
  return <Outlet />
}

export function StaffLayout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [attention, setAttention] = useState<number | null>(null)
  const [attentionError, setAttentionError] = useState('')
  const version = useStaffRefresh()
  const location = useLocation()
  const navigate = useNavigate()
  const onPaint = location.pathname.includes('/paint/')
  const selected = (path: string) => location.pathname.startsWith(path)
  // Pages reached through More keep a current tab, so the shell always shows where you are.
  const inMore = ['/staff/sales', '/staff/stats'].includes(location.pathname) || ['/staff/inventory', '/staff/markets', '/staff/painting-days', '/staff/password'].some(selected)
  useEffect(() => { rememberStaffHub(location.pathname + location.search); setMenuOpen(false) }, [location.pathname, location.search])
  useEffect(() => {
    let active = true
    api.orders.attention().then(rows => { if (active) { setAttention(rows.length); setAttentionError('') } }).catch(err => { if (active) setAttentionError(err instanceof Error ? err.message : 'Could not load attention count.') })
    return () => { active = false }
  }, [version])
  function search(event: FormEvent) {
    event.preventDefault()
    navigate(`/staff/search?q=${encodeURIComponent(query.trim())}`)
  }
  useEffect(() => {
    const keepVisible = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || target.closest('[data-staff-actions]') || target.closest('dialog') || target.closest('nav')) return
      const rect = target.getBoundingClientRect()
      const actions = document.querySelector<HTMLElement>('[data-staff-actions][data-docked="true"]')?.getBoundingClientRect()
      const tabs = document.querySelector<HTMLElement>(`.${styles.bottomTabs}`)?.getBoundingClientRect()
      const bottom = Math.min(window.visualViewport?.height ?? window.innerHeight, actions?.top ?? Infinity, tabs && tabs.height ? tabs.top : Infinity)
      if (rect.bottom > bottom || rect.top < 0) target.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
    document.addEventListener('focusin', keepVisible)
    return () => document.removeEventListener('focusin', keepVisible)
  }, [])
  const more = <>
    <ButtonLink to="/staff/sales" tone="staff" variant="ghost" selected={location.pathname === '/staff/sales'}>Sales</ButtonLink>
    <ButtonLink to="/staff/stats" tone="staff" variant="ghost" selected={location.pathname === '/staff/stats'}>Statistics</ButtonLink>
    <ButtonLink to="/staff/inventory" tone="staff" variant="ghost" selected={selected('/staff/inventory')}>Stock</ButtonLink>
    <ButtonLink to="/staff/markets" tone="staff" variant="ghost" selected={selected('/staff/markets')}>Markets</ButtonLink>
    <ButtonLink to="/staff/painting-days" tone="staff" variant="ghost" selected={selected('/staff/painting-days')}>Painting days</ButtonLink>
    <ButtonLink to="/staff/password" tone="staff" variant="ghost" selected={selected('/staff/password')}>Change password</ButtonLink>
    <Button tone="staff" variant="ghost" onClick={() => void logout()}>Log out</Button>
  </>
  return <div data-staff-page className={`${styles.shell} ${onPaint ? styles.shellPaint : ''}`}>
    {!onPaint && <div className={styles.headerArea}>
      <header className={styles.bar}>
        <div className={styles.brand}><ButtonLink to="/staff/agenda" tone="staff" variant="ghost" aria-label="AWG · Agenda">AWG</ButtonLink><span>{user?.name}</span></div>
        <form className={styles.search} role="search" onSubmit={search}>
          <label className="visually-hidden" htmlFor="staff-search">Search orders</label>
          <input id="staff-search" type="search" placeholder="Code, name or phone" value={query} onChange={event => setQuery(event.target.value)} />
          <Button tone="staff" variant="secondary" type="submit">Search</Button>
        </form>
        <ButtonLink to="/staff/attention" tone="staff" variant={attention ? 'secondary' : 'ghost'} selected={selected('/staff/attention')}>Needs attention{attention ? ` (${attention})` : ''}</ButtonLink>
        <nav className={styles.desktopNav} aria-label="Staff">
          <ButtonLink to="/staff/agenda" tone="staff" variant="ghost" selected={selected('/staff/agenda')}>Agenda</ButtonLink>
          <ButtonLink to="/staff/deliveries" tone="staff" variant="ghost" selected={selected('/staff/deliveries')}>Deliveries</ButtonLink>
          <ButtonLink to="/staff/sales/new?fresh=1" tone="staff" variant="ghost" selected={selected('/staff/sales/new')}>New sale</ButtonLink>
          <Button tone="staff" variant="ghost" data-selected={inMore ? 'true' : 'false'} aria-current={inMore ? 'page' : undefined} aria-expanded={menuOpen} aria-controls="staff-more" onClick={() => setMenuOpen(open => !open)}>More</Button>
        </nav>
      </header>
      {attentionError && <p className={styles.status} role="status">{attentionError} <ButtonLink to="/staff/attention" tone="staff" variant="ghost">Review orders</ButtonLink></p>}
      <div id="staff-more" hidden={!menuOpen}>
        {menuOpen && <StaffDialog title="More staff tools" onClose={() => setMenuOpen(false)}>
          <nav className={styles.more} aria-label="More staff tools">{more}</nav>
        </StaffDialog>}
      </div>
    </div>}
    <main id="staff-main" className={onPaint ? styles.mainBleed : styles.main}><Outlet /></main>
    {!onPaint && <div id="staff-actions-root" className={styles.actionsRoot} />}
    {!onPaint && <nav className={styles.bottomTabs} aria-label="Staff tabs">
      <ButtonLink to="/staff/agenda" tone="staff" variant="ghost" selected={selected('/staff/agenda')}>Agenda</ButtonLink>
      <ButtonLink to="/staff/deliveries" tone="staff" variant="ghost" selected={selected('/staff/deliveries')} aria-label="Deliveries"><span>Deliver</span></ButtonLink>
      <ButtonLink to="/staff/sales/new?fresh=1" tone="staff" variant="ghost" selected={selected('/staff/sales/new')} aria-label="New sale"><span>Sale</span></ButtonLink>
      <ButtonLink to="/staff/search" tone="staff" variant="ghost" selected={selected('/staff/search')}>Search</ButtonLink>
      <Button tone="staff" variant="ghost" data-selected={inMore ? 'true' : 'false'} aria-current={inMore ? 'page' : undefined} aria-expanded={menuOpen} aria-controls="staff-more" onClick={() => setMenuOpen(open => !open)}>More</Button>
    </nav>}
  </div>
}
