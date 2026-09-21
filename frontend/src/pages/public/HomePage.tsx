import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CabinScene } from '../../components/public/CabinScene'
import { Countdown } from '../../components/public/Countdown'
import { TrackDialog } from '../../components/public/TrackDialog'
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

      <div className={styles.scene}>
        <CabinScene title={t('sceneAlt')} />
      </div>

      <div className={styles.ctas}>
        <Button size="lg" fullWidth className={styles.trackBtn} onClick={() => setDialogOpen(true)}>
          <span className={styles.btnIcon} aria-hidden="true">
            ✦
          </span>
          {t('trackCta')}
        </Button>
        <ButtonLink to="/buy" size="lg" fullWidth variant="secondary" className={styles.buyBtn}>
          {t('buyCta')}
        </ButtonLink>
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
