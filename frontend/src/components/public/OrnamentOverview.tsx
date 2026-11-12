import { useId } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import type { BuyItem } from '../../lib/buyDraft'
import { colorKeys } from '../../lib/ornamentPresentation'
import { formatEur } from '../../lib/money'
import { OrnamentPreview } from './OrnamentPreview'
import styles from './OrnamentOverview.module.css'

type OverviewItem = Pick<BuyItem, 'uid' | 'petName' | 'color' | 'finish' | 'withName' | 'backName'> & { price: number; editable?: boolean }

type Props = {
  items: OverviewItem[]
  activeUid: string
  onEdit: (uid: string) => void
  onRemove?: (uid: string) => void
  onAdd?: () => void
  maxItems?: number
}

/**
 * Side-by-side ornament picker shared by /buy and the QR form: tapping an ornament opens it in
 * the editor. The artwork carries colour and finish; the full summary lives in the accessible name.
 */
export function OrnamentOverview({ items, activeUid, onEdit, onRemove, onAdd, maxItems }: Props) {
  const { t, locale } = useLocale()
  const heading = useId()
  const limit = useId()
  const atLimit = maxItems !== undefined && items.length >= maxItems
  const jumpOnly = !onRemove && !onAdd
  return <section className={styles.overview} aria-labelledby={heading}>
    <h3 id={heading}>{t('multiYourOrnaments')}</h3>
    <ul role="list" className={styles.tiles} aria-labelledby={heading}>
      {items.map((item, index) => {
        const active = !jumpOnly && item.uid === activeUid
        const name = item.petName.trim() || t('ornamentN', { n: index + 1 })
        const label = `${t('ornamentN', { n: index + 1 })}${item.petName.trim() ? ` – ${item.petName.trim()}` : ''}`
        const summary = [
          item.color ? t(colorKeys[item.color]) : t('previewNoColor'),
          item.finish ? t(item.finish === 'shiny' ? 'finishShiny' : 'finishMatte') : t('previewNoFinish'),
          item.withName ? item.backName.trim() ? t('multiNameValue', { name: item.backName }) : t('multiNamePending') : t('multiNoName'),
          ...(active ? [t('multiEditing')] : []),
        ].join(' · ')
        const summaryId = `${heading}-${index}`
        const content = <>
          <span className={styles.art} aria-hidden="true"><OrnamentPreview item={item} static /></span>
          <span className={styles.name} data-label={name}><span>{name}</span></span>
          <span className={styles.price}>{formatEur(item.price, locale)}</span>
          <span id={summaryId} className="visually-hidden">{summary}</span>
        </>
        return <li key={item.uid} data-ornament>
          {item.editable === false
            ? <div className={styles.tile} data-static role="group" aria-label={label} aria-describedby={summaryId}>{content}</div>
            : <button type="button" className={styles.tile} data-selected={jumpOnly ? undefined : active} aria-current={active ? 'true' : undefined}
              aria-label={active ? t('multiEditingNamed', { ornament: label }) : t('multiEdit', { ornament: label })} aria-describedby={summaryId} onClick={() => onEdit(item.uid)}>{content}</button>}
          {/* The remove action lives on the ornament it removes, and only on the open one. */}
          {active && onRemove && items.length > 1 && <button type="button" className={styles.remove} aria-label={t('multiRemove', { ornament: label })} title={t('multiRemoveShort')} onClick={() => onRemove(item.uid)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
          </button>}
        </li>
      })}
      {onAdd && <li>
        <button type="button" id="buy-add" className={styles.add} disabled={atLimit} aria-label={t('multiAddAnother')} aria-describedby={atLimit ? limit : undefined} onClick={onAdd}>
          <span className={styles.plus} aria-hidden="true">+</span>
          <span aria-hidden="true">{t('shopAddShort')}</span>
        </button>
      </li>}
    </ul>
    {onAdd && atLimit && <p id={limit} className={styles.limit} role="status">{t('itemLimit', { n: maxItems! })}</p>}
  </section>
}
