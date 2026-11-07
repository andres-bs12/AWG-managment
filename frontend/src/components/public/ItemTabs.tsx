import { useState } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './ItemTabs.module.css'

/** Manual-activation tabs. The add action is a sibling, never a tab. */
export function ItemTabs({ items, activeUid, maxItems, onSelect, onAdd }: { items: { uid: string; petName?: string }[]; activeUid: string; maxItems: number; onSelect: (uid: string) => void; onAdd: () => void }) {
  const { t } = useLocale()
  const [focusedUid, setFocusedUid] = useState(activeUid)
  const focusUid = items.some(item => item.uid === focusedUid) ? focusedUid : activeUid
  return <>
    <div className={styles.itemToolbar}>
      <div role="tablist" aria-label={t('shopCart')} className={styles.itemTabs} onKeyDown={event => {
        const index = items.findIndex(item => `tab-${item.uid}` === document.activeElement?.id)
        const target = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null
        if (target === null) return
        event.preventDefault()
        const item = items[(target + items.length) % items.length]
        setFocusedUid(item.uid)
        document.getElementById(`tab-${item.uid}`)?.focus()
      }}>
        {items.map((item, index) => <button type="button" role="tab" key={item.uid} id={`tab-${item.uid}`} aria-selected={activeUid === item.uid} aria-controls={`panel-${item.uid}`} tabIndex={focusUid === item.uid ? 0 : -1} onFocus={() => setFocusedUid(item.uid)} onClick={() => onSelect(item.uid)}>{[t('ornamentN', { n: index + 1 }), item.petName?.trim()].filter(Boolean).join(' · ')}</button>)}
      </div>
      <button type="button" id="buy-add" className={styles.addItem} aria-label={t('shopAddAnother')} disabled={items.length >= maxItems} onClick={onAdd}><span aria-hidden="true">+</span><span className={styles.addLabel}>{t('shopAddAnother')}</span></button>
    </div>
    {items.length >= maxItems && <p className={styles.limit}>{t('itemLimit', { n: maxItems })}</p>}
  </>
}
