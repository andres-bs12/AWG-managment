import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CabinScene } from '../../components/public/CabinScene'
import { Countdown } from '../../components/public/Countdown'
import { TrackDialog } from '../../components/public/TrackDialog'
import { VillageStreet } from '../../components/public/VillageStreet'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './HomePage.module.css'

export function HomePage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className={styles.hero}>
      <div className={styles.copyTop}>
        <h1 className={styles.title}>{t('brand')}</h1>
        <p className={styles.subtitle}>{t('heroSubtitle')}</p>
        <div className={styles.clock}>
          <Countdown />
        </div>
      </div>

      {/* sky → stall on its street → clear snow for the buttons: one ground line for everything */}
      <div className={styles.stage}>
        <div className={styles.scene}>
          <CabinScene title={t('sceneAlt')} />
        </div>
        <VillageStreet />
      </div>

      <div className={styles.ctas}>
        {/* One primary action (order), tracking is secondary. Icons: Lucide shopping-bag and truck (ISC). */}
        <ButtonLink to="/buy" size="lg" fullWidth className={styles.cta}>
          <svg className={styles.ctaIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 10a4 4 0 0 1-8 0" /><path d="M3.103 6.034h17.794" /><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" />
          </svg>
          {t('buyCta')}
        </ButtonLink>
        <Button variant="secondary" size="lg" fullWidth className={styles.cta} onClick={() => setDialogOpen(true)}>
          <svg className={styles.ctaIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
          </svg>
          {t('trackCta')}
        </Button>
      </div>

      {dialogOpen ? (
        <TrackDialog
          onClose={() => setDialogOpen(false)}
          onSubmit={(code) => {
            setDialogOpen(false)
            navigate(`/track/${encodeURIComponent(code)}`)
          }}
        />
      ) : null}
    </div>
  )
}
