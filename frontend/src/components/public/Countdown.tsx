import { useEffect, useState } from 'react'
import { christmasCountdown } from '../../lib/countdown'
import { pad2 } from '../../lib/time'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './Countdown.module.css'

/**
 * Small Santa-Tracker-style clock to 25 December.
 * The ticking digits are `aria-hidden`; the accessible version is a hidden sentence that only
 * changes text once a day, so screen readers are never spammed.
 */
export function Countdown() {
  const { t } = useLocale()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const left = christmasCountdown(now)

  if (left.isChristmas) {
    return (
      <p className={styles.merry}>
        <span aria-hidden="true">✦ </span>
        {t('merryChristmas')}
      </p>
    )
  }

  const cells = [
    { key: 'd', value: String(left.days), label: t('unitDays') },
    { key: 'h', value: pad2(left.hours), label: t('unitHours') },
    { key: 'm', value: pad2(left.minutes), label: t('unitMinutes') },
    { key: 's', value: pad2(left.seconds), label: t('unitSeconds') },
  ]

  return (
    <div className={styles.wrap} role="group" aria-label={t('countdownLabel')}>
      <span className={styles.label} aria-hidden="true">
        {t('countdownLabel')}
      </span>
      <div className={styles.cells} aria-hidden="true">
        {cells.map((cell) => (
          <span key={cell.key} className={styles.cell}>
            <b className={styles.value}>{cell.value}</b>
            <i className={styles.unit}>{cell.label}</i>
          </span>
        ))}
      </div>
      <p className="visually-hidden">{t('countdownSummary', { days: left.days })}</p>
    </div>
  )
}
