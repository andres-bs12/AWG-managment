import { useLayoutEffect, useRef, useState } from 'react'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { useLocale } from '../../../i18n/LocaleContext'
import { HelpTip } from '../../../components/ui/HelpTip'
import { Button } from '../../../components/ui/Button'

export function BuyDateStep({ t, draft, dates, datesState, setDatesRetry, patch, formatDate, err, described }: Pick<BuyStepProps, 't' | 'draft' | 'dates' | 'datesState' | 'setDatesRetry' | 'patch' | 'formatDate' | 'err' | 'described'>) {
  const { locale } = useLocale()
  const calendar = useRef<HTMLFieldSetElement>(null)
  const [list, setList] = useState(false)
  useLayoutEffect(() => {
    const node = calendar.current
    if (!node) return
    const measure = () => setList(node.getBoundingClientRect().width < 7 * parseFloat(getComputedStyle(node).getPropertyValue('--touch')))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const lang = locale === 'de' ? 'de-AT' : 'en-GB'
  const months = [...new Set(dates.map(d => d.date.slice(0, 7)))].sort()
  const compactDate = (date: string) => new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`)).replace(/^(\p{L}+)\./u, '$1').replace(/\.$/, '')
  return <><div className={styles.intro}><p>{t('shopDateLead')}</p><div className={styles.helpRow}><HelpTip label={t('explainDates')}>{t('dateHelp')}</HelpTip></div></div>
    <p className={styles.muted} role="status" hidden={datesState === 'ready' && dates.length > 0}>{datesState === 'loading' ? t('shopDatesLoading') : datesState === 'error' ? t('shopDatesError') : datesState === 'ready' && !dates.length ? t('shopDatesNone') : ''}</p>
    {datesState === 'error' && <Button variant="secondary" onClick={() => setDatesRetry(value => value + 1)}>{t('shopRetry')}</Button>}
    {(datesState === 'loading' || datesState === 'idle') && <div className={styles.dateCards} aria-hidden="true">{[0, 1, 2].map(i => <div key={i} className={styles.dateSkeleton} />)}</div>}
    {datesState === 'ready' && <div className={styles.dateCards}>{[...dates].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3).map((entry, index) => <button key={entry.date} type="button" className={styles.dateCard} data-selected={draft.deliveryDate === entry.date} data-earliest={index === 0} aria-pressed={draft.deliveryDate === entry.date} onClick={() => patch({ deliveryDate: entry.date })}>{index === 0 && <small>{t('earliestDate')}</small>}<span>{compactDate(entry.date)} · {t('eveningShort')}</span></button>)}</div>}
    <fieldset ref={calendar} id="buy-date" tabIndex={-1} className={styles.calendarField} aria-busy={datesState === 'loading'} aria-describedby={described('buy-date')}><legend className="visually-hidden">{t('shopStepDate')}</legend>
      {datesState === 'ready' && months.map(month => { const first = new Date(`${month}-01T12:00:00`); const offset = (first.getDay() + 6) % 7; const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); return <div key={month}><h3>{new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(first)}</h3><div className={styles.calendar} data-list={list}>{Array.from({ length: 7 }, (_, i) => <span key={`w${i}`} className={styles.weekday}>{new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(2026, 10, 2 + i))}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank${i}`} />)}{Array.from({ length: count }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; const available = dates.some(d => d.date === date); return available ? <label key={date} className={styles.day} data-selected={draft.deliveryDate === date}><input className={styles.choiceInput} type="radio" name="delivery-date" aria-label={formatDate(date)} checked={draft.deliveryDate === date} onChange={() => patch({ deliveryDate: date })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); patch({ deliveryDate: date }) } }} /><span className={styles.dayNumber}>{i + 1}</span><span className={styles.dayFull}>{formatDate(date)}</span></label> : <span key={date} className={styles.unavailable}>{i + 1}</span> })}</div></div> })}
    </fieldset><p className={styles.dateConfirmation} data-selected-date role="status" aria-live="polite">{draft.deliveryDate ? <><span aria-hidden="true">{t('selectedDate', { date: compactDate(draft.deliveryDate) })}</span><span className="visually-hidden">{t('selectedDate', { date: formatDate(draft.deliveryDate) })}</span></> : t('chooseDeliveryDate')}</p>{err('buy-date') && <p className={styles.error} id="buy-date-error" role="alert">{err('buy-date')}</p>}</>
}
