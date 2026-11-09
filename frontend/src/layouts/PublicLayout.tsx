import { useLayoutEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { IntroCurtain } from '../components/public/IntroCurtain'
import { Snowfield } from '../components/public/Snowfield'
import { WinterBackdrop } from '../components/public/WinterBackdrop'
import { useLocale } from '../i18n/LocaleContext'
import { keepFormFocusVisible } from '../lib/publicFormFocus'
import styles from './PublicLayout.module.css'

/** The opening curtain plays once per page load, and only when the visit starts on home. */
let introPlayed = false

function holdHeroEntrance(on: boolean) {
  if (on) document.documentElement.dataset.intro = 'on'
  else delete document.documentElement.dataset.intro
}

export function PublicLayout() {
  const { t, locale, setLocale } = useLocale()
  const location = useLocation()
  const quiet = location.pathname.startsWith('/form') || location.pathname.startsWith('/track')
  /** The home hero already shouts the brand, so the header there is only the language switch. */
  const atHome = location.pathname === '/'
  const [intro, setIntro] = useState(() => !introPlayed && atHome)

  /** Pauses the home entrance animations under the curtain, so they play as it lifts. */
  useLayoutEffect(() => {
    if (!intro) return
    holdHeroEntrance(true)
    return () => holdHeroEntrance(false)
  }, [intro])

  return (
    <div data-public-shell className={`${styles.shell} ${quiet ? styles.quiet : ''}`} onFocus={(event) => {
      const target = event.target
      // Forms repair their own focus; header/footer links need the same viewport clearance.
      if (!(target instanceof HTMLElement) || target.closest('main')) return
      keepFormFocusVisible(event)
    }}>
      {intro ? (
        <IntroCurtain
          label={t('introLoading')}
          onReveal={() => holdHeroEntrance(false)}
          onDone={() => {
            introPlayed = true
            setIntro(false)
          }}
        />
      ) : null}
      <WinterBackdrop mood={quiet ? 'calm' : 'hero'} />
      <Snowfield density={quiet ? 'low' : 'full'} />
      <header className={styles.top}>
        {atHome ? (
          <span />
        ) : (
          <Link className={styles.brand} to="/">
            {t('brand')}
          </Link>
        )}
        <div className={styles.lang} role="group" aria-label={t('lang')}>
          <button type="button" data-on={locale === 'en' ? 'true' : 'false'} onClick={() => setLocale('en')}>
            EN
          </button>
          <button type="button" data-on={locale === 'de' ? 'true' : 'false'} onClick={() => setLocale('de')}>
            DE
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p className={styles.note}>{t('footerNote')}</p>
        <nav className={styles.legal} aria-label={t('impressum')}>
          <Link to="/impressum">{t('impressum')}</Link>
          <Link to="/agb">{t('terms')}</Link>
          <Link to="/datenschutz">{t('privacy')}</Link>
        </nav>
        <a className={styles.social} href="https://www.instagram.com/art_withgab_" rel="noreferrer" target="_blank">
          <svg className={styles.socialIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.9" />
            <circle cx="17.1" cy="6.9" r="1.3" fill="currentColor" />
          </svg>
          <span className={styles.socialLabel}>{t('instagram')}</span>
        </a>
      </footer>
    </div>
  )
}
