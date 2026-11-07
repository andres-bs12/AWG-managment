import { paintedName } from '../../../lib/paintedName'
import { useState } from 'react'
import { WaitlistSignup } from '../../../components/public/WaitlistSignup'
import { HelpTip } from '../../../components/ui/HelpTip'
import type { BuyItem } from '../../../lib/buyDraft'
import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { Field } from '../../../components/ui/Field'
import { formatEur } from '../../../lib/money'

// Hover previews only where a real pointer hovers: on touch screens a layout shift (e.g. removing an
// ornament) must never make the preview show a choice nobody made.
const canHover = () => typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches
import { colorKeys } from './shared'

export function BuyItemsStep({ t, draft, config, patchItem, err, described, activeUid, preview, onJoinWaitlist }: { activeUid: string; preview: (value: Partial<BuyItem> | null) => void; onJoinWaitlist?: import('../../../api/contracts').ShopService['joinWaitlist'] } & Pick<BuyStepProps, 't' | 'draft' | 'config' | 'patchItem' | 'err' | 'described'>) {
  const { locale } = useLocale()
  const [waitlist, setWaitlist] = useState(false)
  const active = draft.items.find(item => item.uid === activeUid)
  const soldOut = (['red', 'green', 'beige'] as const).some(color => !config.colors.some(option => option.color === color && option.inStock)) || (!!active?.color && (['shiny', 'matte'] as const).some(finish => !config.colors.some(option => option.color === active.color && option.finish === finish && option.inStock)))
  return <>
    {draft.items.map(item => item.uid !== activeUid ? null : <div className={styles.itemSection} key={item.uid}>
      <div className={styles.choiceGroup}><fieldset id={`color-${item.uid}`} tabIndex={-1} className={styles.chips} aria-describedby={described(`color-${item.uid}`)}><legend>{t('shopColour')}</legend>
        <div className={styles.chipRow}>{(['red', 'green', 'beige'] as const).map(color => { const available = config.colors.some(option => option.color === color && option.inStock); return <label key={color} className={styles.chip} data-selected={item.color === color} data-disabled={!available} onMouseEnter={() => { if (available && canHover()) preview({ color }) }} onMouseLeave={() => preview(null)} onFocus={() => { if (available) preview({ color }) }} onBlur={() => preview(null)}><input className={styles.choiceInput} type="radio" name={`color-${item.uid}`} value={color} checked={item.color === color} disabled={!available} onChange={() => patchItem(item.uid, { color, finish: config.colors.some(option => option.color === color && option.finish === item.finish && option.inStock) ? item.finish : '' })} /><span className={styles.swatch} data-color={color} aria-hidden="true" /><span>{t(colorKeys[color])}{!available && <small>{t('shopSoldOut')}</small>}</span></label> })}</div>
      {err(`color-${item.uid}`) && <p className={styles.error} id={`color-${item.uid}-error`} role="alert">{err(`color-${item.uid}`)}</p>}</fieldset>
      <fieldset id={`finish-${item.uid}`} tabIndex={-1} className={styles.chips} aria-describedby={described(`finish-${item.uid}`)}><legend>{t('shopFinish')} <HelpTip label={t('explainFinishes')}>{t('finishExplanation')}</HelpTip></legend>
        <div className={styles.chipRow}>{(['shiny', 'matte'] as const).map(finish => { // Before a colour is chosen every finish that exists in stock for some colour stays selectable.
        const available = item.color ? config.colors.some(option => option.color === item.color && option.finish === finish && option.inStock) : config.colors.some(option => option.finish === finish && option.inStock); return <label key={finish} className={styles.chip} data-selected={item.finish === finish} data-disabled={!available} onMouseEnter={() => { if (available && canHover()) preview({ finish }) }} onMouseLeave={() => preview(null)} onFocus={() => { if (available) preview({ finish }) }} onBlur={() => preview(null)}><input className={styles.choiceInput} type="radio" name={`finish-${item.uid}`} value={finish} checked={item.finish === finish} disabled={!available} onChange={() => patchItem(item.uid, { finish })} /><span className={styles.swatch} data-color={item.color || 'none'} data-finish={finish} aria-hidden="true" /><span>{t(finish === 'shiny' ? 'finishShiny' : 'finishMatte')}{!available && <small>{t('shopSoldOut')}</small>}</span></label> })}</div>
      {err(`finish-${item.uid}`) && <p className={styles.error} id={`finish-${item.uid}-error`} role="alert">{err(`finish-${item.uid}`)}</p>}</fieldset>
      {soldOut && <div className={styles.waitlist}><button type="button" className={styles.linkBtn} aria-expanded={waitlist} aria-controls={`waitlist-${activeUid}`} onClick={() => setWaitlist(value => !value)}>{t('waitlistNotify')}</button><div id={`waitlist-${activeUid}`} hidden={!waitlist}>{waitlist && <WaitlistSignup onJoin={onJoinWaitlist} />}</div></div>}
      </div><div className={styles.nameGroup}><div className={styles.nameCard} data-on={item.withName}>
        <label className={styles.check}><input type="checkbox" checked={item.withName} onChange={event => patchItem(item.uid, { withName: event.target.checked })} /><span>{t('shopNameOnBack')}</span><strong className={styles.price}>+{formatEur(config.nameExtra, locale)}</strong></label>
        {item.withName && <div className={styles.nameDetails}><Field label={t('paintedPetName')} htmlFor={`back-${item.uid}`} hint={t('shopBackNameHint')} error={err(`back-${item.uid}`)}><input id={`back-${item.uid}`} value={item.backName} maxLength={60} aria-invalid={!!err(`back-${item.uid}`)} aria-describedby={described(`back-${item.uid}`, true)} onChange={event => patchItem(item.uid, { petName: paintedName(event.target.value) })} /></Field><p className={styles.muted}>{t('nameNonRefund')}</p></div>}
      </div></div>
    </div>)}
  </>
}
