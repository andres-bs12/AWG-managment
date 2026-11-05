import { useState } from 'react'
import type { BuyItem } from '../../../lib/buyDraft'
import { useLocale } from '../../../i18n/LocaleContext'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Field'
import { newItem } from '../../../lib/buyDraft'
import { formatEur } from '../../../lib/money'
import { colorKeys } from './shared'

export function BuyItemsStep({ t, draft, config, itemPrice, patch, patchItem, err, described, activeUid, preview }: { activeUid: string; preview: (value: Partial<BuyItem> | null) => void } & Pick<BuyStepProps, 't' | 'draft' | 'config' | 'itemPrice' | 'patch' | 'patchItem' | 'err' | 'described'>) {
  const { locale } = useLocale()
  const [explained, setExplained] = useState<string | null>(null)
  return <>
    {draft.items.map((item, index) => item.uid !== activeUid ? null : <div className={styles.card} key={item.uid}>
      <div className={styles.cardHead}><h3>{t('ornamentN', { n: index + 1 })}</h3><span className={styles.price}>{formatEur(itemPrice(item), locale)}</span>{draft.items.length > 1 && <button type="button" className={styles.linkBtn} aria-label={t('shopRemoveItem', { n: index + 1 })} onClick={() => patch({ items: draft.items.filter(other => other.uid !== item.uid) })}>{t('shopRemove')}</button>}</div>
      <div className={styles.choiceGroup}><fieldset id={`color-${item.uid}`} tabIndex={-1} className={styles.chips} aria-describedby={described(`color-${item.uid}`)}><legend>{t('shopColour')}</legend>
        <div className={styles.chipRow}>{(['red', 'green', 'beige'] as const).map(color => { const available = config.colors.some(option => option.color === color && option.inStock); return <label key={color} className={styles.chip} data-selected={item.color === color} data-disabled={!available} onMouseEnter={() => { if (available) preview({ color }) }} onMouseLeave={() => preview(null)} onFocus={() => { if (available) preview({ color }) }} onBlur={() => preview(null)}><input className={styles.choiceInput} type="radio" name={`color-${item.uid}`} checked={item.color === color} disabled={!available} onChange={() => patchItem(item.uid, { color, finish: config.colors.some(option => option.color === color && option.finish === item.finish && option.inStock) ? item.finish : '' })} /><span className={styles.swatch} data-color={color} aria-hidden="true" /><span>{t(colorKeys[color])}{!available && <small>{t('shopSoldOut')}</small>}</span></label> })}</div>
      </fieldset>{err(`color-${item.uid}`) && <p className={styles.error} id={`color-${item.uid}-error`} role="alert">{err(`color-${item.uid}`)}</p>}
      <fieldset id={`finish-${item.uid}`} tabIndex={-1} className={styles.chips} aria-describedby={described(`finish-${item.uid}`)}><legend>{t('shopFinish')} <button type="button" className={styles.help} aria-label={t('explainFinishes')} aria-expanded={explained === item.uid} aria-controls={`explain-${item.uid}`} onClick={() => setExplained(explained === item.uid ? null : item.uid)} onKeyDown={e => { if (e.key === 'Escape') setExplained(null) }}><span aria-hidden="true">?</span></button></legend>
        <p id={`explain-${item.uid}`} className={styles.explanation} hidden={explained !== item.uid}>{t('finishExplanation')}</p>
        <div className={styles.chipRow}>{(['shiny', 'matte'] as const).map(finish => { const available = !!item.color && config.colors.some(option => option.color === item.color && option.finish === finish && option.inStock); return <label key={finish} className={styles.chip} data-selected={item.finish === finish} data-disabled={!available} onMouseEnter={() => { if (available) preview({ finish }) }} onMouseLeave={() => preview(null)} onFocus={() => { if (available) preview({ finish }) }} onBlur={() => preview(null)}><input className={styles.choiceInput} type="radio" name={`finish-${item.uid}`} checked={item.finish === finish} disabled={!available} onChange={() => patchItem(item.uid, { finish })} /><span className={styles.swatch} data-color={item.color || 'beige'} data-finish={finish} aria-hidden="true" /><span>{t(finish === 'shiny' ? 'finishShiny' : 'finishMatte')}{item.color && !available && <small>{t('shopSoldOut')}</small>}</span></label> })}</div>
      </fieldset>{err(`finish-${item.uid}`) && <p className={styles.error} id={`finish-${item.uid}-error`} role="alert">{err(`finish-${item.uid}`)}</p>}
      </div><div className={styles.nameGroup}><div className={styles.nameCard} data-on={item.withName}>
        <label className={styles.check}><input type="checkbox" checked={item.withName} onChange={event => patchItem(item.uid, { withName: event.target.checked })} /><span>{t('shopNameOnBack')}</span><strong className={styles.price}>+{formatEur(config.nameExtra, locale)}</strong></label>
        {item.withName && <div className={styles.nameDetails}><Field label={t('backName')} htmlFor={`back-${item.uid}`} hint={t('shopBackNameHint')} error={err(`back-${item.uid}`)}><input id={`back-${item.uid}`} value={item.backName} maxLength={6} aria-invalid={!!err(`back-${item.uid}`)} aria-describedby={described(`back-${item.uid}`, true)} onChange={event => patchItem(item.uid, { backName: event.target.value.toUpperCase().replace(/[^\p{L}]/gu, '').slice(0, 6) })} /></Field><p className={styles.muted}>{t('nameNonRefund')}</p></div>}
      </div></div>
    </div>)}
    <Button id="buy-add" variant="secondary" disabled={draft.items.length >= config.maxItems} onClick={() => patch({ items: [...draft.items, newItem()] })}>{t('shopAddAnother')}</Button>{err('buy-add') && <p className={styles.error} role="alert">{err('buy-add')}</p>}
  </>
}
