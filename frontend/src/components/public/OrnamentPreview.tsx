import { useId, useState } from 'react'
import type { BuyItem } from '../../lib/buyDraft'
import { useLocale } from '../../i18n/LocaleContext'
import { CatFace, DogFace } from './PetFaces'
import styles from './OrnamentPreview.module.css'
import { SegmentedControl } from '../ui/SegmentedControl'

type Shade = 'red' | 'green' | 'beige' | 'grey' | 'white' | 'unknown'
const SHADES: Shade[] = ['red', 'green', 'beige', 'grey', 'white', 'unknown']
const COLOR_KEYS = { red: 'colorRed', green: 'colorGreen', beige: 'colorBeige', grey: 'colorGrey', white: 'colorWhite' } as const

/**
 * Live ornament for the configurator (docs/design-system.md §7.16, C3). Shows our illustrated
 * cat/dog — never the customer's photo. The disc behind the pet is a darker tint of the
 * ornament colour. Before a colour is chosen, beige is only an illustrative placeholder.
 * The parent owns side state when switching between ornaments. Static variants have no controls.
 */
/** Gaby letters names in a flowing script: "LUNA" -> "Luna". */
function script(name: string) {
  return name ? name.charAt(0).toLocaleUpperCase() + name.slice(1).toLocaleLowerCase() : ''
}

export type OrnamentSide = 'front' | 'back'

export function OrnamentPreview({ item, static: isStatic = false, side: chosenSide, onSideChange, readOnly = false }: { item: Pick<BuyItem, 'color' | 'finish' | 'withName' | 'backName'>; static?: boolean; side?: OrnamentSide; onSideChange?: (side: OrnamentSide) => void; readOnly?: boolean }) {
  const { t } = useLocale()
  // null = follow the name option (show the back while a name is on); a click pins a side.
  const [side, setSide] = useState<OrnamentSide | null>(null)
  const instance = useId()
  // Without a typed name the back is empty, so the front stays in view until there is a name to show.
  const pinned = onSideChange ? chosenSide : (chosenSide ?? side)
  const showBack = !isStatic && item.withName && !!item.backName.trim() && (pinned ?? 'back') === 'back'
  // No colour yet = a neutral ball; a beige one read as if Beige were already chosen.
  const shade: Shade = item.color || 'unknown'
  const colorLabel = item.color ? `${t(COLOR_KEYS[item.color])}${item.color === 'grey' || item.color === 'white' ? ` · ${t('legacyColour')}` : ''}` : t(isStatic || readOnly ? 'colorUnknown' : 'previewNoColor')
  const finishLabel = item.finish ? t(item.finish === 'shiny' ? 'finishShiny' : 'finishMatte') : t(isStatic || readOnly ? 'formFinishUnknown' : 'previewNoFinish')
  const name = item.withName && item.backName ? item.backName : t('previewNoName')
  const disc = `var(--portrait-${shade})`
  const sideName = `side-${instance}`
  const svgId = `orn${instance.replace(/[^a-zA-Z0-9]/g, '')}`

  const description = t('previewDescription', { choices: t('previewLabel', { color: colorLabel, finish: finishLabel, name }), side: t(showBack ? 'previewBack' : 'previewFront') })
  return <div className={styles.preview} data-preview={isStatic ? 'static' : 'live'}>
    <div className={styles.stage} role="img" aria-label={description}>
      <div className={styles.turn} data-back={showBack}>
        <svg viewBox="0 0 200 230" className={styles.art} aria-hidden="true">
          <defs>
            <clipPath id={`${svgId}-ball`}><circle cx="100" cy="132" r="88"/></clipPath>
            {/* Fixed light from the upper left: the ball keeps its volume while the artwork turns. */}
            <radialGradient id={`${svgId}-shade`} cx="38%" cy="32%" r="72%">
              <stop offset="0" stopColor="var(--art-white)" stopOpacity=".22"/>
              <stop offset=".55" stopColor="var(--art-white)" stopOpacity="0"/>
              <stop offset="1" stopColor="var(--art-black)" stopOpacity=".28"/>
            </radialGradient>
          </defs>
          <path d="M86 19a14 14 0 0 1 28 0" fill="none" className={styles.hook} strokeWidth="5"/>
          <rect x="79" y="19" width="42" height="25" rx="4" className={styles.cap}/>
          {SHADES.map(value => <circle key={value} cx="100" cy="132" r="88" className={styles.ball} data-color={value} data-visible={shade === value}/>)}
          {/* Globe turn: the painted side slides across the curved surface and compresses at the rim. */}
          <g clipPath={`url(#${svgId}-ball)`}>
            <g className={styles.front}><g transform="translate(43 75) scale(1.14)"><CatFace className={styles.cat} disc={disc}/><DogFace className={styles.dog} disc={disc}/></g></g>
            <text x="100" y="146" textAnchor="middle" className={styles.back} data-color={shade}>{script(item.backName)}</text>
          </g>
          <circle cx="100" cy="132" r="88" fill={`url(#${svgId}-shade)`} className={styles.shade}/>
          {item.finish === 'shiny' && <g key={`${item.color}-shiny`} className={styles.gloss}><path d="M44 106c6-24 21-42 41-48" fill="none" stroke="var(--ornament-highlight)" strokeWidth="8" strokeLinecap="round"/><path className={styles.glint} d="M57 65 L130 205" stroke="var(--ornament-glint)" strokeWidth="12"/></g>}
        </svg>
      </div>
    </div>
    {/* The side choice needs a name, but its row is reserved as soon as the name option is on: inserting
        it on the first typed letter pushed the name field down and Safari re-centred the caret (owner, 2026-11-12). */}
    {!isStatic && item.withName && <div className={styles.sideSlot} data-reserved={item.backName ? undefined : true}><SegmentedControl tone="public" hideLegend legend={t('previewSide')} name={sideName} value={showBack ? 'back' : 'front'} options={[{ value: 'front', label: t('previewFront') }, { value: 'back', label: t('previewBack') }]} onChange={value => { setSide(value); onSideChange?.(value) }} /></div>}
    {/* Each sentence stays whole: on narrow screens the line breaks between them, never mid-sentence. */}
    {!isStatic && <p className={styles.disclaimer}>{(t('previewDisclaimer').match(/[^.]+\.?/g) ?? []).map(part => part.trim()).filter(Boolean).map((sentence, index) => <span key={index}>{index > 0 ? ' ' : ''}<span className={styles.sentence}>{sentence}</span></span>)}</p>}
  </div>
}
