import { useEffect, useState } from 'react'
import type { BuyItem } from '../../lib/buyDraft'
import { useLocale } from '../../i18n/LocaleContext'
import { CatFace, DogFace } from './PetFaces'
import styles from './OrnamentPreview.module.css'

export function OrnamentPreview({ item }: { item: BuyItem }) {
  const { t } = useLocale()
  const [back, setBack] = useState(false)
  useEffect(() => {
    if (!item.withName) return
    const timer = window.setTimeout(() => setBack(true), 0)
    return () => window.clearTimeout(timer)
  }, [item.withName])
  const showBack = item.withName && back
  const color = item.color || 'beige'
  const finish = item.finish || 'matte'
  const colorLabel = t(({ red: 'colorRed', green: 'colorGreen', beige: 'colorBeige', grey: 'colorGrey', white: 'colorWhite' })[color])
  return <div className={styles.preview}>
    <div className={styles.stage} role="img" aria-label={t('previewLabel', { color: colorLabel, finish: t(finish === 'shiny' ? 'finishShiny' : 'finishMatte'), name: item.withName && item.backName ? item.backName : t('previewNoName') })}>
      <div className={styles.sway}><div className={styles.flip} data-back={showBack}>
        <svg viewBox="0 0 200 230" className={styles.art} aria-hidden="true">
          <path d="M86 19a14 14 0 0 1 28 0" fill="none" stroke="#a98948" strokeWidth="5"/><rect x="79" y="19" width="42" height="25" rx="4" fill="#d2b66f"/>
          {(['red', 'green', 'beige'] as const).map(shade => <circle key={shade} cx="100" cy="132" r="88" className={styles.ball} data-color={shade} data-visible={color === shade}/>)}
          {finish === 'matte' && <g fill="white" opacity=".08"><circle cx="53" cy="110" r="1.5"/><circle cx="65" cy="169" r="1.5"/><circle cx="146" cy="93" r="1.5"/><circle cx="148" cy="160" r="1.5"/></g>}
          <g className={styles.front} transform="translate(43 75) scale(1.14)"><CatFace className={styles.cat}/><DogFace className={styles.dog}/></g>
          <text x="100" y="140" textAnchor="middle" className={styles.back}>{item.backName.toUpperCase()}</text>
          {finish === 'shiny' && <g key={finish} className={styles.gloss}><path d="M44 106c6-24 21-42 41-48" fill="none" stroke="white" strokeOpacity=".55" strokeWidth="8" strokeLinecap="round"/><path className={styles.glint} d="M57 65 L130 205" stroke="white" strokeOpacity=".22" strokeWidth="12"/></g>}
        </svg>
      </div></div>
    </div>
    {item.withName && <div className={styles.segment} role="group" aria-label={t('previewSide')}><button type="button" aria-pressed={!showBack} onClick={() => setBack(false)}>{t('previewFront')}</button><button type="button" aria-pressed={showBack} onClick={() => setBack(true)}>{t('previewBack')}</button></div>}
    <p>{t('previewDisclaimer')}</p>
  </div>
}
