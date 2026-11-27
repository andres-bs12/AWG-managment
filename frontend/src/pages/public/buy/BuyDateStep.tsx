import styles from '../BuyPage.module.css'
import { pickupTimes, selectedPickupDay, type BuyStepProps } from './shared'
import { useLocale } from '../../../i18n/LocaleContext'
import { Button } from '../../../components/ui/Button'
import { MarketMapLink } from '../../../components/public/MarketMapLink'
import { formatEur } from '../../../lib/money'
import { formatArrivalWithWeekdays } from '../../../lib/postShipping'
import type { DeliveryKind, ShopPickupDay } from '../../../domain/types'

type Props = Pick<BuyStepProps, 't' | 'draft' | 'config' | 'shippingQuote' | 'shippingState' | 'setDatesRetry' | 'pickupDays' | 'pickupState' | 'patch' | 'formatDate' | 'err' | 'described'>

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
  const { t, draft, config, shippingQuote, shippingState, pickupDays, pickupState, patch } = props
  const { locale } = useLocale()
  const postUnavailable = shippingState === 'ready' && !shippingQuote?.available
  // Only when Post is still possible: with neither, the market card stays selectable and explains it below.
  const noMarketDays = pickupState === 'ready' && pickupDays.length === 0 && !postUnavailable
  const choose = (kind: DeliveryKind) => {
    if (kind === 'post' && postUnavailable) return
    if (kind === 'market' && noMarketDays) return
    if (kind !== draft.deliveryKind) patch({ deliveryKind: kind, deliveryDate: '', pickupMarketDayId: '', pickupTime: '' })
  }
  const fee = config.deliveryFee ? `+${formatEur(config.deliveryFee, locale)}` : t('shopFree')
  const methods: { kind: DeliveryKind; title: string; detail: string; disabled?: boolean }[] = [
    {
      kind: 'post',
      title: t('methodPost'),
      detail: postUnavailable ? t('postUnavailable') : t('methodPostDetail', { fee }),
      disabled: postUnavailable,
    },
    { kind: 'market', title: t('methodMarket'), detail: noMarketDays ? t('pickupDaysNone') : t('methodMarketDetail'), disabled: noMarketDays },
  ]
  return <>
    <fieldset className={styles.methodGroup}><legend className={styles.groupLegend}>{t('deliveryMethod')}</legend>
      <div className={styles.choiceCards}>{methods.map(method => {
        const selected = !method.disabled && draft.deliveryKind === method.kind
        return <label key={method.kind} className={styles.choiceCard} data-selected={selected} data-disabled={method.disabled || undefined}>
          <input className={styles.choiceInput} type="radio" name="delivery-kind" value={method.kind} checked={selected} disabled={method.disabled} onChange={() => choose(method.kind)} />
          <strong>{method.title}</strong><span>{method.detail}</span>
        </label>
      })}</div>
    </fieldset>
    {draft.deliveryKind === 'market' ? <PickupSection {...props} /> : <PostSection {...props} />}
  </>
}

function SelectedDate({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
  return <div className={styles.selectedDate} data-selected={!!value} data-selected-date role="status" aria-live="polite">
    <small>{label}</small><span>{value || placeholder}</span>
  </div>
}

function PostSection({ t, shippingQuote, shippingState, setDatesRetry, err, described }: Props) {
  const { locale } = useLocale()
  const range = shippingState === 'ready' && shippingQuote?.available && shippingQuote.arrivalFrom && shippingQuote.arrivalTo
    ? formatArrivalWithWeekdays(shippingQuote.arrivalFrom, shippingQuote.arrivalTo, locale)
    : ''
  return <>
    {shippingState === 'error' && <Button variant="secondary" onClick={() => setDatesRetry(value => value + 1)}>{t('shopRetry')}</Button>}
    <div id="buy-date" tabIndex={-1} className={`${styles.selectedDate} ${styles.postRange}`} data-selected={!!range} data-selected-date role="status" aria-live="polite" aria-busy={shippingState === 'loading'} aria-invalid={!!err('buy-date') || undefined} aria-describedby={described('buy-date')}>
      <small>{t('estimatedDelivery')}</small>
      <span>{range || (shippingState === 'loading' || shippingState === 'idle' ? t('shopDatesLoading') : shippingState === 'error' ? t('shopDatesError') : t('postUnavailable'))}</span>
    </div>
    {err('buy-date') && <p className={styles.error} id="buy-date-error" role="alert">{err('buy-date')}</p>}
  </>
}

function PickupSection({ t, draft, pickupDays, pickupState, setDatesRetry, patch, formatDate, err, described }: Props) {
  const compactDate = useCompactDate()
  const day = selectedPickupDay(pickupDays, draft)
  const times = day ? pickupTimes(day) : []
  const hours = (entry: ShopPickupDay) => t('timeOClock', { time: `${entry.openTime}–${entry.closeTime}` })
  const markets = [...new Set(pickupDays.map(entry => pickupPlace(entry, t)))]
  const summary = day ? [day.marketName, compactDate(day.date), draft.pickupTime && t('timeOClock', { time: draft.pickupTime })].filter(Boolean).join(' · ') : ''
  const emptyReady = pickupState === 'ready' && pickupDays.length === 0
  return <>
    <p id={emptyReady ? 'buy-date' : undefined} tabIndex={emptyReady ? -1 : undefined} className={styles.muted} role="status" hidden={pickupState === 'ready' && pickupDays.length > 0}>{pickupState === 'loading' ? t('pickupDaysLoading') : pickupState === 'error' ? t('pickupDaysError') : emptyReady ? t('pickupDaysNone') : ''}</p>
    {pickupState === 'error' && <Button variant="secondary" onClick={() => setDatesRetry(value => value + 1)}>{t('shopRetry')}</Button>}
    {!emptyReady && <div className={styles.pickupDayGroup}>
    <fieldset id="buy-date" tabIndex={-1} className={styles.chips} aria-busy={pickupState === 'loading'} aria-describedby={described('buy-date')}><legend>{t('pickupDayHeading')}</legend>
      {(pickupState === 'loading' || pickupState === 'idle') && <div className={styles.pickupDays} aria-hidden="true"><div className={styles.dateSkeleton} /><div className={styles.dateSkeleton} /></div>}
      {pickupState === 'ready' && markets.map(place => <div key={place} className={styles.pickupMarket}>
        <h3><MarketMapLink name={pickupDays.find(entry => pickupPlace(entry, t) === place)!.marketName} label={place} /></h3>
        <div className={styles.pickupDays}>{pickupDays.filter(entry => pickupPlace(entry, t) === place).map(entry => <label key={entry.marketDayId ?? entry.date} className={styles.choiceCard} data-selected={day === entry}>
          <input className={styles.choiceInput} type="radio" name="pickup-day" value={entry.marketDayId ?? entry.date} aria-label={`${formatDate(entry.date)}, ${hours(entry)}, ${place}`} checked={day === entry} onChange={() => patch({
            deliveryDate: entry.date,
            pickupMarketDayId: entry.marketDayId ?? '',
            pickupTime: day && pickupPlace(day, t) === place && pickupTimes(entry).includes(draft.pickupTime) ? draft.pickupTime : '',
          })} />
          <strong>{compactDate(entry.date)}</strong><span>{hours(entry)}</span>
        </label>)}</div>
      </div>)}
    </fieldset>
    {err('buy-date') && <p className={styles.error} id="buy-date-error" role="alert">{err('buy-date')}</p>}
    </div>}
    {emptyReady && err('buy-date') && <p className={styles.error} id="buy-date-error" role="alert">{err('buy-date')}</p>}
    {day && <fieldset id="buy-time" tabIndex={-1} className={styles.chips} aria-describedby={described('buy-time')}><legend>{t('pickupTimeHeading')}</legend>
      <div className={styles.timeRow}>{times.map(time => <label key={time} className={`${styles.chip} ${styles.timeChip}`} data-selected={draft.pickupTime === time}>
        <input className={styles.choiceInput} type="radio" name="pickup-time" value={time} checked={draft.pickupTime === time} onChange={() => patch({ pickupTime: time })} /><span>{time}</span>
      </label>)}</div>
    </fieldset>}
    {err('buy-time') && <p className={styles.error} id="buy-time-error" role="alert">{err('buy-time')}</p>}
    {!emptyReady && <SelectedDate label={t('yourDate')} value={draft.pickupTime ? summary : ''} placeholder={day ? t('pickupTimeHeading') : t('choosePickupDay')} />}
  </>
}
