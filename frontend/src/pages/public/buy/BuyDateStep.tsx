import { DeliveryIcon } from '../../../components/public/DeliveryIcon'
import { useLayoutEffect, useRef, useState } from 'react'
import styles from '../BuyPage.module.css'
import { pickupTimes, type BuyStepProps } from './shared'
import { useLocale } from '../../../i18n/LocaleContext'
import { Button } from '../../../components/ui/Button'
import { formatEur } from '../../../lib/money'
import type { DeliveryKind, ShopPickupDay } from '../../../domain/types'

type Props = Pick<BuyStepProps, 't' | 'draft' | 'config' | 'dates' | 'datesState' | 'setDatesRetry' | 'pickupDays' | 'pickupState' | 'patch' | 'formatDate' | 'err' | 'described'>

/** Short weekday + day + month without trailing dots ("Mi, 23. Dez" / "Wed, 23 Dec"). */
export function useCompactDate() {
  const { locale } = useLocale()
  const lang = locale === 'de' ? 'de-AT' : 'en-GB'
  return (date: string) => new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`)).replace(/^(\p{L}+)\./u, '$1').replace(/\.$/, '')
}

/** Market name with its stall number, e.g. "Rathausplatz · Stand 12". */
export function pickupPlace(day: Pick<ShopPickupDay, 'marketName' | 'stall'>, t: Props['t']) {
  return day.stall ? `${day.marketName} · ${t('stallN', { n: day.stall })}` : day.marketName
}

export function BuyDateStep(props: Props) {
  const { t, draft, config, patch } = props
  const { locale } = useLocale()
  const choose = (kind: DeliveryKind) => { if (kind !== draft.deliveryKind) patch({ deliveryKind: kind, deliveryDate: '', pickupTime: '' }) }
  const methods: { kind: DeliveryKind; title: string; detail: string }[] = [
    { kind: 'vienna', title: t('methodVienna'), detail: t('methodViennaDetail', { fee: config.deliveryFee ? formatEur(config.deliveryFee, locale) : t('shopFree') }) },
    { kind: 'market', title: t('methodMarket'), detail: t('methodMarketDetail') },
  ]
  return <div className={styles.deliverySections}>
    <fieldset className={styles.methodGroup}><legend className={styles.groupLegend}>{t('deliveryMethod')}</legend>
      <div className={styles.choiceCards}>{methods.map(method => <label key={method.kind} className={styles.choiceCard} data-selected={draft.deliveryKind === method.kind}>
        <input className={styles.choiceInput} type="radio" name="delivery-kind" value={method.kind} checked={draft.deliveryKind === method.kind} onChange={() => choose(method.kind)} />
        <span className={styles.identifiedCard}><DeliveryIcon kind={method.kind} /><span><strong>{method.title}</strong><span>{method.detail}</span>{method.kind === 'vienna' && <span>{t('shopDateLead')}</span>}</span></span>
      </label>)}</div>
    </fieldset>
    <section className={styles.dateSection} aria-labelledby="delivery-when"><h3 id="delivery-when">{t('deliveryWhen')}</h3>
    <div className={styles.dateBody}>{draft.deliveryKind === 'market' ? <PickupSection {...props} /> : <ViennaSection {...props} />}</div>
    </section>
  </div>
}

function SelectedDate({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
  return <div className={styles.selectedDate} data-selected={!!value} data-selected-date role="status" aria-live="polite">
    <small>{label}</small><span>{value || placeholder}</span>
  </div>
}

function ViennaSection({ t, draft, dates, datesState, setDatesRetry, patch, formatDate, err, described }: Props) {
  const { locale } = useLocale()
  const compactDate = useCompactDate()
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
  const sorted = [...dates].sort((a, b) => a.date.localeCompare(b.date))
  const earliest = sorted[0]
  const months = [...new Set(sorted.map(d => d.date.slice(0, 7)))]
  return <>
    <p className={styles.muted} role="status" hidden={datesState === 'ready' && dates.length > 0}>{datesState === 'loading' ? t('shopDatesLoading') : datesState === 'error' ? t('shopDatesError') : datesState === 'ready' && !dates.length ? t('shopDatesNone') : ''}</p>
    {datesState === 'error' && <Button variant="secondary" onClick={() => setDatesRetry(value => value + 1)}>{t('shopRetry')}</Button>}
    {(datesState === 'loading' || datesState === 'idle') && <div className={styles.dateCards} aria-hidden="true"><div className={styles.dateSkeleton} /></div>}
    {datesState === 'ready' && earliest && <div className={styles.dateCards}><button type="button" className={styles.dateCard} data-selected={draft.deliveryDate === earliest.date} data-earliest aria-pressed={draft.deliveryDate === earliest.date} onClick={() => patch({ deliveryDate: earliest.date })}><span className={styles.identifiedCard}><DeliveryIcon kind="date" /><span><small>{t('earliestDate')}</small><span>{compactDate(earliest.date)} · {t('eveningShort')}</span></span></span></button></div>}
    <fieldset ref={calendar} id="buy-date" tabIndex={-1} className={styles.calendarField} aria-busy={datesState === 'loading'} aria-describedby={described('buy-date')}><legend className="visually-hidden">{t('shopStepDate')}</legend>
      {datesState === 'ready' && months.map(month => { const first = new Date(`${month}-01T12:00:00`); const offset = (first.getDay() + 6) % 7; const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); return <div key={month}><h3>{new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(first)}</h3><div className={styles.calendar} data-list={list}>{Array.from({ length: 7 }, (_, i) => <span key={`w${i}`} className={styles.weekday}>{new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(2026, 10, 2 + i))}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank${i}`} />)}{Array.from({ length: count }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; const available = dates.some(d => d.date === date); return available ? <label key={date} className={styles.day} data-selected={draft.deliveryDate === date}><input className={styles.choiceInput} type="radio" name="delivery-date" aria-label={formatDate(date)} checked={draft.deliveryDate === date} onChange={() => patch({ deliveryDate: date })} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); patch({ deliveryDate: date }) } }} /><span className={styles.dayNumber}>{i + 1}</span><span className={styles.dayFull}>{formatDate(date)}</span></label> : <span key={date} className={styles.unavailable}>{i + 1}</span> })}</div></div> })}
    </fieldset>
    {err('buy-date') && <p className={styles.error} id="buy-date-error" role="alert">{err('buy-date')}</p>}
    <SelectedDate label={t('yourDate')} value={draft.deliveryDate ? `${compactDate(draft.deliveryDate)} · ${t('eveningShort')}` : ''} placeholder={t('chooseDayInCalendar')} />
  </>
}

function PickupSection({ t, draft, pickupDays, pickupState, setDatesRetry, patch, formatDate, err, described }: Props) {
  const compactDate = useCompactDate()
  const day = pickupDays.find(entry => entry.date === draft.deliveryDate)
  const times = day ? pickupTimes(day) : []
  const hours = (entry: ShopPickupDay) => t('timeOClock', { time: `${entry.openTime}–${entry.closeTime}` })
  const markets = [...new Set(pickupDays.map(entry => pickupPlace(entry, t)))]
  const summary = day ? [day.marketName, compactDate(day.date), draft.pickupTime && t('timeOClock', { time: draft.pickupTime })].filter(Boolean).join(' · ') : ''
  return <>
    <p className={styles.sectionLead}>{t('pickupLead')}</p>
    <p className={styles.muted} role="status" hidden={pickupState === 'ready' && pickupDays.length > 0}>{pickupState === 'loading' ? t('pickupDaysLoading') : pickupState === 'error' ? t('pickupDaysError') : pickupState === 'ready' && !pickupDays.length ? t('pickupDaysNone') : ''}</p>
    {pickupState === 'error' && <Button variant="secondary" onClick={() => setDatesRetry(value => value + 1)}>{t('shopRetry')}</Button>}
    <fieldset id="buy-date" tabIndex={-1} className={styles.chips} aria-busy={pickupState === 'loading'} aria-describedby={described('buy-date')}><legend>{t('pickupDayHeading')}</legend>
      {(pickupState === 'loading' || pickupState === 'idle') && <div className={styles.pickupDays} aria-hidden="true"><div className={styles.dateSkeleton} /><div className={styles.dateSkeleton} /></div>}
      {pickupState === 'ready' && markets.map(place => <div key={place} className={styles.pickupMarket}>
        <h3>{place}</h3>
        <div className={styles.pickupDays}>{pickupDays.filter(entry => pickupPlace(entry, t) === place).map(entry => <label key={entry.date} className={styles.choiceCard} data-selected={draft.deliveryDate === entry.date}>
          <input className={styles.choiceInput} type="radio" name="pickup-day" value={entry.date} aria-label={`${formatDate(entry.date)}, ${hours(entry)}, ${place}`} checked={draft.deliveryDate === entry.date} onChange={() => patch({ deliveryDate: entry.date, pickupTime: pickupTimes(entry).includes(draft.pickupTime) ? draft.pickupTime : '' })} />
          <strong>{compactDate(entry.date)}</strong><span>{hours(entry)}</span>
        </label>)}</div>
      </div>)}
    </fieldset>
    {err('buy-date') && <p className={styles.error} id="buy-date-error" role="alert">{err('buy-date')}</p>}
    {day && <fieldset id="buy-time" tabIndex={-1} className={styles.chips} aria-describedby={described('buy-time')}><legend>{t('pickupTimeHeading')}</legend>
      <div className={styles.timeRow}>{times.map(time => <label key={time} className={`${styles.chip} ${styles.timeChip}`} data-selected={draft.pickupTime === time}>
        <input className={styles.choiceInput} type="radio" name="pickup-time" value={time} checked={draft.pickupTime === time} onChange={() => patch({ pickupTime: time })} /><span>{time}</span>
      </label>)}</div>
    </fieldset>}
    {err('buy-time') && <p className={styles.error} id="buy-time-error" role="alert">{err('buy-time')}</p>}
    <SelectedDate label={t('yourDate')} value={draft.pickupTime ? summary : ''} placeholder={day ? t('pickupTimeHeading') : t('choosePickupDay')} />
  </>
}
