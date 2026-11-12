import { useState } from 'react'
import { WaitlistSignup } from '../../../components/public/WaitlistSignup'
import { HelpTip } from '../../../components/ui/HelpTip'
import type { BuyItem } from '../../../lib/buyDraft'
import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { Field } from '../../../components/ui/Field'
import { formatEur } from '../../../lib/money'
import { colorKeys } from './shared'

/** Hover previews only for a real mouse: touch emulates mouseenter and would leave a stale preview after taps and scrolls. */
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

export function BuyItemsStep({ t, draft, config, patchItem, err, described, activeUid, preview, onJoinWaitlist }: { activeUid: string; preview: (value: Partial<BuyItem> | null) => void; onJoinWaitlist?: import('../../../api/contracts').ShopService['joinWaitlist'] } & Pick<BuyStepProps, 't' | 'draft' | 'config' | 'patchItem' | 'err' | 'described'>) {
  const { locale } = useLocale()
  const [waitlist, setWaitlist] = useState(false)
  const active = draft.items.find(item => item.uid === activeUid)
  const soldOut = (['red', 'green', 'beige'] as const).some(color => !config.colors.some(option => option.color === color && option.inStock)) || (!!active?.color && (['shiny', 'matte'] as const).some(finish => !config.colors.some(option => option.color === active.color && option.finish === finish && option.inStock)))
  return <>
    {draft.items.map(item => item.uid !== activeUid ? null : <div className={styles.itemSection} key={item.uid}>
      <div className={styles.choiceGroup}><fieldset id={`color-${item.uid}`} tabIndex={-1} className={styles.chips} aria-describedby={described(`color-${item.uid}`)}><legend>{t('shopColour')}</legend>
        <div className={styles.chipRow}>{(['red', 'green', 'beige'] as const).map(color => { const available = config.colors.some(option => option.color === color && option.inStock); return <label key={color} className={styles.chip} data-selected={item.color === color} data-disabled={!available} onMouseEnter={() => { if (available && finePointer()) preview({ color }) }} onMouseLeave={() => preview(null)} onFocus={() => { if (available) preview({ color }) }} onBlur={() => preview(null)}><input className={styles.choiceInput} type="radio" name={`color-${item.uid}`} value={color} checked={item.color === color} disabled={!available} onChange={() => patchItem(item.uid, { color, finish: config.colors.some(option => option.color === color && option.finish === item.finish && option.inStock) ? item.finish : '' })} /><span className={styles.swatch} data-color={color} aria-hidden="true" /><span data-label={t(colorKeys[color])}>{t(colorKeys[color])}{!available && <small>{t('shopSoldOut')}</small>}</span></label> })}</div>
      </fieldset>{err(`color-${item.uid}`) && <p className={styles.error} id={`color-${item.uid}-error`} role="alert">{err(`color-${item.uid}`)}</p>}
      <fieldset id={`finish-${item.uid}`} tabIndex={-1} className={styles.chips} aria-describedby={described(`finish-${item.uid}`)}><legend>{t('shopFinish')} <HelpTip label={t('explainFinishes')}><span className={styles.finishLine}>{t('finishExplanationShiny')}</span><span className={styles.finishLine}>{t('finishExplanationMatte')}</span></HelpTip></legend>
        <div className={styles.chipRow}>{(['shiny', 'matte'] as const).map(finish => { // Before a colour is chosen every finish that exists in stock for some colour stays selectable.
        const available = item.color ? config.colors.some(option => option.color === item.color && option.finish === finish && option.inStock) : config.colors.some(option => option.finish === finish && option.inStock); return <label key={finish} className={styles.chip} data-selected={item.finish === finish} data-disabled={!available} onMouseEnter={() => { if (available && finePointer()) preview({ finish }) }} onMouseLeave={() => preview(null)} onFocus={() => { if (available) preview({ finish }) }} onBlur={() => preview(null)}><input className={styles.choiceInput} type="radio" name={`finish-${item.uid}`} value={finish} checked={item.finish === finish} disabled={!available} onChange={() => patchItem(item.uid, { finish })} /><span className={styles.swatch} data-color={item.color || 'none'} data-finish={finish} aria-hidden="true" /><span data-label={t(finish === 'shiny' ? 'finishShiny' : 'finishMatte')}>{t(finish === 'shiny' ? 'finishShiny' : 'finishMatte')}{!available && <small>{t('shopSoldOut')}</small>}</span></label> })}</div>
      </fieldset>{err(`finish-${item.uid}`) && <p className={styles.error} id={`finish-${item.uid}-error`} role="alert">{err(`finish-${item.uid}`)}</p>}
      {soldOut && <div className={styles.waitlist}><button type="button" className={styles.linkBtn} aria-expanded={waitlist} aria-controls={`waitlist-${activeUid}`} onClick={() => setWaitlist(value => !value)}>{t('waitlistNotify')}</button><div id={`waitlist-${activeUid}`} hidden={!waitlist}>{waitlist && <WaitlistSignup onJoin={onJoinWaitlist} />}</div></div>}
      </div><div className={styles.nameGroup}><div className={styles.nameCard} data-on={item.withName}>
        <fieldset className={styles.nameChoice}>
          <legend>{t('multiNameQuestion')}</legend>
          <div className={styles.nameOptions}>{[false, true].map(withName => <label key={String(withName)} className={styles.nameOption} data-selected={item.withName === withName}>
            <input className={styles.choiceInput} type="radio" name={`with-name-${item.uid}`} value={String(withName)} checked={item.withName === withName} onChange={() => patchItem(item.uid, { withName })} />
            <span data-label={withName ? t('multiNameYes', { price: formatEur(config.nameExtra, locale) }) : t('multiNameNo')}>{withName ? t('multiNameYes', { price: formatEur(config.nameExtra, locale) }) : t('multiNameNo')}</span>
          </label>)}</div>
        </fieldset>
        {item.withName && <div className={styles.nameDetails}><Field label={t('backNameField')} htmlFor={`back-${item.uid}`} hint={t('shopBackNameHint')} error={err(`back-${item.uid}`)}><input id={`back-${item.uid}`} value={item.backName} maxLength={6} aria-invalid={!!err(`back-${item.uid}`)} aria-describedby={described(`back-${item.uid}`, true)} onChange={event => patchItem(item.uid, { backName: event.target.value.replace(/[^\p{L}]/gu, '').slice(0, 6) })} /></Field><p className={styles.muted}>{t('nameNonRefund')}</p></div>}
      </div></div>
    </div>)}
  </>
}
