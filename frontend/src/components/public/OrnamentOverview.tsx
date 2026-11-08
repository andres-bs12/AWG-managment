import { useId } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import type { BuyItem } from '../../lib/buyDraft'
import { colorKeys } from '../../lib/ornamentPresentation'
import { formatEur } from '../../lib/money'
import { Button } from '../ui/Button'
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

/** Shared order overview. QR orders expose only the details the customer can edit. */
export function OrnamentOverview({ items, activeUid, onEdit, onRemove, onAdd, maxItems }: Props) {
  const { t, locale } = useLocale()
  const heading = useId()
  const limit = useId()
  const atLimit = maxItems !== undefined && items.length >= maxItems
  return <section className={styles.overview} aria-labelledby={heading}>
    <h3 id={heading}>{t('multiYourOrnaments')}</h3>
    <ul role="list" className={styles.list} aria-labelledby={heading}>
      {items.map((item, index) => {
        const label = `${t('ornamentN', { n: index + 1 })}${item.petName.trim() ? ` · ${item.petName.trim()}` : ''}`
        const summary = [
          item.color ? t(colorKeys[item.color]) : t('previewNoColor'),
          item.finish ? t(item.finish === 'shiny' ? 'finishShiny' : 'finishMatte') : t('previewNoFinish'),
          item.withName ? item.backName.trim() ? t('multiNameValue', { name: item.backName }) : t('multiNamePending') : t('multiNoName'),
        ].join(' · ')
        return <li key={item.uid} className={styles.row} data-editing={item.uid === activeUid}>
          <div className={styles.preview} aria-hidden="true"><OrnamentPreview item={item} static /></div>
          <div className={styles.details}><p className={styles.label}>{label}</p><p className={styles.summary}>{summary}</p>{item.uid === activeUid && <p className={styles.editing}>{t('multiEditing')}</p>}</div>
          <strong className={styles.price}>{formatEur(item.price, locale)}</strong>
          <div className={styles.actions}>
            {item.editable !== false && item.uid !== activeUid && <Button variant="secondary" size="lg" aria-label={t('multiEdit', { ornament: label })} aria-current={item.uid === activeUid ? 'true' : undefined} onClick={() => onEdit(item.uid)}>{t('multiEditShort')}</Button>}
            {onRemove && items.length > 1 && <Button variant="ghost" size="lg" aria-label={t('multiRemove', { ornament: label })} onClick={() => onRemove(item.uid)}>{t('multiRemoveShort')}</Button>}
          </div>
        </li>
      })}
    </ul>
    {onAdd && <Button id="buy-add" variant="secondary" size="lg" fullWidth disabled={atLimit} aria-describedby={atLimit ? limit : undefined} onClick={onAdd}>{t('multiAddAnother')}</Button>}
    {onAdd && atLimit && <p id={limit} className={styles.summary} role="status">{t('itemLimit', { n: maxItems! })}</p>}
  </section>
}
