import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
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
  const staffDevice = useSearchParams()[0].get('staff') === '1'
  // One anonymous page view per visit; the stall iPad (?staff=1) is not a visitor.
  useEffect(() => { if (!staffDevice) void api.metrics.track({ event: 'home_view' }).catch(() => {}) }, [staffDevice])

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
        {/* One primary action (order), tracking is secondary. Text only: the scene is the illustration. */}
        <ButtonLink to="/buy" size="lg" fullWidth>
          {t('buyCta')}
        </ButtonLink>
        <Button variant="secondary" size="lg" fullWidth onClick={() => setDialogOpen(true)}>
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
