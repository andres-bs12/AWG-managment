import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { StaffDialog } from '../components/staff/StaffDialog'
import { Button } from '../components/ui/Button'
import { ButtonLink } from '../components/ui/ButtonLink'
import { rememberStaffHub } from '../lib/staffNav'
import { useStaffRefresh } from '../lib/useStaffRefresh'
import { useStaffClock } from '../lib/staffClock'
import { DEMO_NOW_HOUR } from 'demo-source'
import { STAFF_MARKET_KEY, StaffMarketContext, type StaffStall } from '../lib/staffMarket'
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

function rememberedMarket() {
  try { return localStorage.getItem(STAFF_MARKET_KEY) }
  catch { return null }
}

export function StaffLayout() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const searchTrigger = useRef<HTMLButtonElement>(null)
  const [query, setQuery] = useState('')
  const [attention, setAttention] = useState<number | null>(null)
  const [attentionError, setAttentionError] = useState('')
  const version = useStaffRefresh()
  const { date: staffDate } = useStaffClock()
  const [stalls, setStalls] = useState<StaffStall[]>([])
  const [marketError, setMarketError] = useState(false)
  const [marketRetry, setMarketRetry] = useState(0)
  const [marketId, setMarketId] = useState(rememberedMarket)
  const [showMarkets, setShowMarkets] = useState(false)
  const [dismissedDate, setDismissedDate] = useState<string | null>(null)
  const activeStall = stalls.length === 1 ? stalls[0] : stalls.find(stall => stall.market.id === marketId)
  const autoPrompt = stalls.length > 1 && !activeStall && dismissedDate !== stalls[0].day.date
  const location = useLocation()
  const navigate = useNavigate()
  const onPaint = location.pathname.includes('/paint/')
  const onSearch = location.pathname === '/staff/search'
  const selected = (path: string) => location.pathname.startsWith(path)
  // Pages reached through More keep a current tab, so the shell always shows where you are.
  const inMore = ['/staff/sales', '/staff/stats'].includes(location.pathname) || ['/staff/attention', '/staff/deliveries', '/staff/inventory', '/staff/markets', '/staff/painting-days', '/staff/password'].some(selected)
  useEffect(() => {
    rememberStaffHub(location.pathname + location.search)
    setMenuOpen(false)
    setSearchOpen(false)
  }, [location.pathname, location.search])
  useEffect(() => {
    let active = true
    const load = () => api.orders.attention().then(rows => { if (active) { setAttention(rows.length); setAttentionError('') } }).catch(err => { if (active) { setAttention(null); setAttentionError(err instanceof Error ? err.message : 'Could not load attention count.') } })
    void load()
    // New web orders arrive without any staff action: check again every minute while the app is open.
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [version])
  useEffect(() => {
    let current = true
    Promise.all([api.markets.listMarkets(), api.markets.listMarketDays()]).then(([markets, days]) => {
      if (!current) return
      const open = days.flatMap(day => {
        const market = markets.find(row => row.id === day.marketId && row.kind === 'market')
        const isToday = DEMO_NOW_HOUR == null ? day.date === staffDate : day.isToday
        return isToday && market ? [{ market, day }] : []
      })
      setStalls(open.sort((a, b) => a.market.name.localeCompare(b.market.name)))
      setMarketError(false)
    }).catch(() => { if (current) setMarketError(true) })
    return () => { current = false }
  }, [version, staffDate, marketRetry])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STAFF_MARKET_KEY || event.key === null) setMarketId(rememberedMarket())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  function chooseMarket(id: string) {
    try { localStorage.setItem(STAFF_MARKET_KEY, id) } catch { /* keep the choice in this session */ }
    setMarketId(id)
    setShowMarkets(false)
  }
  function openMarkets() {
    setMenuOpen(false)
    setShowMarkets(true)
  }
  function closeMarkets() {
    setDismissedDate(stalls[0]?.day.date ?? null)
    setShowMarkets(false)
  }
  function search(event: FormEvent) {
    event.preventDefault()
    setSearchOpen(false)
    navigate(`/staff/search?q=${encodeURIComponent(query.trim())}`)
  }
  function openSearch() {
    // Focus during the tap so iOS opens its search keyboard.
    flushSync(() => setSearchOpen(true))
    searchInput.current?.focus()
  }
  function closeSearch() {
    flushSync(() => setSearchOpen(false))
    searchTrigger.current?.focus()
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
    {stalls.length > 1 && <Button tone="staff" variant="ghost" onClick={openMarkets}>Change market</Button>}
    <ButtonLink to="/staff/attention" tone="staff" variant="ghost" selected={selected('/staff/attention')}>Needs attention{attention !== null ? ` (${attention})` : ''}</ButtonLink>
    <ButtonLink to="/staff/deliveries" tone="staff" variant="ghost" selected={selected('/staff/deliveries')}>Deliveries</ButtonLink>
    <ButtonLink to="/staff/sales" tone="staff" variant="ghost" selected={location.pathname === '/staff/sales'}>Sales</ButtonLink>
    <ButtonLink to="/staff/stats" tone="staff" variant="ghost" selected={location.pathname === '/staff/stats'}>Statistics</ButtonLink>
    <ButtonLink to="/staff/inventory" tone="staff" variant="ghost" selected={selected('/staff/inventory')}>Stock</ButtonLink>
    <ButtonLink to="/staff/markets" tone="staff" variant="ghost" selected={selected('/staff/markets')}>Markets</ButtonLink>
    <ButtonLink to="/staff/painting-days" tone="staff" variant="ghost" selected={selected('/staff/painting-days')}>Painting days</ButtonLink>
    <ButtonLink to="/staff/password" tone="staff" variant="ghost" selected={selected('/staff/password')}>Change password</ButtonLink>
    <Button tone="staff" variant="ghost" onClick={() => void logout()}>Log out</Button>
  </>
  const navigation = <>
    <ButtonLink to="/staff/sales/new?fresh=1" tone="staff" size="lg" className={styles.newSale} selected={selected('/staff/sales/new')}>New sale</ButtonLink>
    <Button tone="staff" variant="secondary" data-selected={inMore ? 'true' : 'false'} aria-current={inMore ? 'page' : undefined} aria-expanded={menuOpen} aria-controls="staff-more"
      aria-label={attention ? `More, ${attention} ${attention === 1 ? 'order needs' : 'orders need'} attention` : undefined}
      onClick={() => setMenuOpen(open => !open)}>
      <span className={styles.moreLabel}>
        More
        {attention ? <span className={styles.attentionDot} data-attention-dot="" aria-hidden="true" /> : null}
        <svg className={styles.moreChevron} data-open={menuOpen ? 'true' : undefined} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </Button>
  </>
  return <StaffMarketContext.Provider value={{ stalls, activeMarket: activeStall?.market ?? null, activeMarketDay: activeStall?.day ?? null }}>
    <div data-staff-page className={`${styles.shell} ${onPaint ? styles.shellPaint : ''}`}>
    {!onPaint && <div className={styles.headerArea}>
      <header className={styles.bar}>
        <div className={styles.brand}><ButtonLink to="/staff/agenda" tone="staff" variant="ghost" aria-label="AWG · Agenda">AWG</ButtonLink><span>{user?.name}</span></div>
        {stalls.length > 1
          ? <Button tone="staff" variant="ghost" className={styles.activeMarket} onClick={openMarkets}
            aria-label={activeStall ? `Change market, currently at ${activeStall.market.name}` : 'Choose market'}>
            <span className={styles.activeMarketText}>{activeStall?.market.name ?? 'Choose market'}</span>
          </Button>
          : activeStall && <span className={styles.activeMarket}>{activeStall.market.name}</span>}
        {!onSearch && <>
          <form className={styles.search} id="staff-search-form" role="search" data-open={searchOpen} onSubmit={search}>
            <label className="visually-hidden" htmlFor="staff-search">Search orders</label>
            <input ref={searchInput} id="staff-search" type="search" enterKeyHint="search" placeholder="Code, name or phone"
              value={query} onChange={event => setQuery(event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape' && searchOpen) { event.preventDefault(); closeSearch() } }} />
            {searchOpen && <button type="button" className={styles.searchClose} aria-label="Close search" onClick={closeSearch}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>}
          </form>
          <button ref={searchTrigger} className={styles.searchTrigger} type="button" hidden={searchOpen} aria-label="Search orders"
            aria-controls="staff-search-form" onClick={openSearch}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15 15 5 5" /></svg>
          </button>
        </>}
        <nav className={styles.desktopNav} aria-label="Staff">{navigation}</nav>
      </header>
      {marketError && <div className={styles.attentionError} role="alert">
        Could not check today’s markets. <Button tone="staff" variant="ghost" onClick={() => setMarketRetry(n => n + 1)}>Retry markets</Button>
      </div>}
      {attentionError && <p className={styles.attentionError} role="alert">{attentionError}</p>}
      <div id="staff-more" hidden={!menuOpen}>
        {menuOpen && <StaffDialog title="More staff tools" onClose={() => setMenuOpen(false)}>
          <nav className={styles.more} aria-label="More staff tools">{more}</nav>
        </StaffDialog>}
      </div>
    </div>}
    {(showMarkets || (autoPrompt && !menuOpen)) && stalls.length > 1 && <StaffDialog title="I’m at" onClose={closeMarkets}>
      <div className={styles.marketOptions}>
        {stalls.map(({ market }) => <Button key={market.id} tone="staff" variant="secondary"
          selected={activeStall?.market.id === market.id}
          onClick={() => chooseMarket(market.id)}>{market.name}</Button>)}
      </div>
    </StaffDialog>}
    <main id="staff-main" className={onPaint ? styles.mainBleed : styles.main}><Outlet /></main>
    {!onPaint && <div id="staff-actions-root" className={styles.actionsRoot} />}
    {!onPaint && <nav className={styles.bottomTabs} aria-label="Staff tabs">{navigation}</nav>}
    </div>
  </StaffMarketContext.Provider>
}
