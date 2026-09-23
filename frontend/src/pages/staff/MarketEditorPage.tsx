import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import type { AgendaDay, MarketDay } from '../../domain/types'
import { marketPickupDates, stallHours } from '../../lib/calendar'
import { formatDateLabel, formatHour, parseHour } from '../../lib/time'
import styles from './MarketEditorPage.module.css'

type DayDraft = {
  id?: string
  date: string
  open: string
  close: string
}

function blankDay(date: string): DayDraft {
  const hours = stallHours()
  return { date, open: formatHour(hours.openHour), close: formatHour(hours.closeHour) }
}

function toDraft(day: MarketDay): DayDraft {
  return {
    id: day.id,
    date: day.date,
    open: formatHour(day.openHour),
    close: formatHour(day.closeHour),
  }
}

function withSeason(prev: DayDraft[], dates: string[], removed: Set<string>): DayDraft[] {
  if (!dates.length) return []
  const byDate = new Map(prev.map((day) => [day.date, day]))
  return dates.filter((date) => !removed.has(date)).map((date) => byDate.get(date) ?? blankDay(date))
}

function seasonDates(start: string, finish: string, removed: Set<string>): string[] {
  if (!start || !finish || finish < start) return []
  const dates = marketPickupDates(start, finish)
  for (const date of [...removed]) {
    if (!dates.includes(date)) removed.delete(date)
  }
  return dates
}

function busyDayIds(agenda: AgendaDay[], marketId: string): Set<string> {
  const ids = new Set<string>()
  for (const day of agenda) {
    for (const slot of day.slots) ids.add(slot.block.marketDayId)
    if (day.market.id === marketId && day.deliveries.some((row) => row.deliveryKind === 'market')) {
      ids.add(day.marketDay.id)
    }
  }
  return ids
}

function clock(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  return match ? `${match[1]}:${match[2]}` : value
}

export function MarketEditorPage() {
  const { id } = useParams()
  return <MarketEditor key={id ?? 'new'} />
}

function MarketEditor() {
  const { id: marketId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const removedRef = useRef(new Set<string>())
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [finish, setFinish] = useState('')
  const [cost, setCost] = useState('')
  const [stall, setStall] = useState('')
  const [days, setDays] = useState<DayDraft[]>([])
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(!marketId)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(
    () => (location.state as { notice?: string } | null)?.notice ?? '',
  )

  useEffect(() => {
    if (!marketId) return
    let cancel = false
    void Promise.all([
      api.markets.listMarkets(),
      api.markets.listMarketDays(marketId),
      api.agenda.listDays(),
    ])
      .then(([markets, marketDays, agenda]) => {
        if (cancel) return
        const market = markets.find((row) => row.id === marketId && row.kind === 'market')
        if (!market) {
          setMissing(true)
          setReady(true)
          return
        }
        setMissing(false)
        setName(market.name)
        setStart(market.startDate ?? '')
        setFinish(market.finishDate ?? '')
        setCost(String(market.totalCost))
        setStall(market.stall == null ? '' : String(market.stall))
        setDays(marketDays.map(toDraft).sort((a, b) => a.date.localeCompare(b.date)))
        setBusyIds(busyDayIds(agenda, marketId))
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancel) return
        setError(err instanceof Error ? err.message : 'Could not load market')
        setReady(true)
      })

    return () => {
      cancel = true
    }
  }, [marketId])

  function changeStart(value: string) {
    setStart(value)
    setNotice('')
    const dates = seasonDates(value, finish, removedRef.current)
    setDays((prev) => withSeason(prev, dates, removedRef.current))
  }

  function changeFinish(value: string) {
    setFinish(value)
    setNotice('')
    const dates = seasonDates(start, value, removedRef.current)
    setDays((prev) => withSeason(prev, dates, removedRef.current))
  }

  function validate(): string | null {
    if (!name.trim()) return 'Name is required'
    if (!start || !finish) return 'Season start and end are required'
    if (finish < start) return 'Season end must be on or after the start'
    if (!marketPickupDates(start, finish).length) return 'No Friday, Saturday, or Sunday in this range'
    const costNumber = Number(cost)
    if (cost.trim() === '' || !Number.isFinite(costNumber) || costNumber < 0) {
      return 'Season cost must be zero or more'
    }
    const stallNumber = Number(stall)
    if (stall.trim() === '' || !Number.isInteger(stallNumber) || stallNumber < 1) {
      return 'Stall number must be a whole number of 1 or more'
    }
    for (const day of days) {
      const open = parseHour(clock(day.open))
      const close = parseHour(clock(day.close))
      if (!clock(day.open) || !clock(day.close) || !(close > open)) {
        return `${formatDateLabel(day.date)}: close must be after open`
      }
    }
    return null
  }

  async function onSave(event: FormEvent) {
    event.preventDefault()
    const message = validate()
    if (message) {
      setNotice('')
      setError(message)
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await api.markets.saveMarket({
        id: marketId,
        name: name.trim(),
        startDate: start,
        finishDate: finish,
        totalCost: Number(cost),
        stall: Number(stall),
        days: days.map((day) => ({
          date: day.date,
          openHour: parseHour(clock(day.open)),
          closeHour: parseHour(clock(day.close)),
        })),
      })
      if (!marketId) {
        setNotice('Market created')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        navigate(`/staff/markets/${saved.market.id}`, { replace: true, state: { notice: 'Market created' } })
        return
      }
      setDays(saved.days.map(toDraft))
      setNotice('Market updated')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setNotice('')
      setError(err instanceof Error ? err.message : 'Could not save market')
    } finally {
      setBusy(false)
    }
  }

  async function onDeleteDay(day: DayDraft) {
    if (day.id && busyIds.has(day.id)) return
    setError('')
    setNotice('')
    if (!day.id) {
      removedRef.current.add(day.date)
      setDays((current) => current.filter((row) => row.date !== day.date))
      return
    }
    setBusy(true)
    try {
      await api.markets.deleteMarketDay(day.id)
      removedRef.current.add(day.date)
      setDays((current) => current.filter((row) => row.date !== day.date))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this day')
    } finally {
      setBusy(false)
    }
  }

  async function onDeleteMarket() {
    if (!marketId || marketLocked) return
    setBusy(true)
    setError('')
    try {
      await api.markets.deleteMarket(marketId)
      navigate('/staff/markets')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete market')
      setBusy(false)
    }
  }

  const marketLocked = days.some((day) => day.id && busyIds.has(day.id))
  const seasonHint = (() => {
    if (start && finish && finish < start) return 'Season end must be on or after the start.'
    if (start && finish && !marketPickupDates(start, finish).length) {
      return 'No Friday, Saturday, or Sunday in this range.'
    }
    return 'Pickup days are Friday, Saturday, and Sunday. New days open 12:00–19:00.'
  })()

  if (!ready) return <p>Loading market…</p>

  if (missing) {
    return (
      <section>
        <StaffBackLink to="/staff/markets" label="Markets" />
        <h1>Market not found</h1>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <StaffBackLink to="/staff/markets" label="Markets" />
      <div className={styles.head}>
        <h1>{marketId ? name || 'Market' : 'New market'}</h1>
        <p className={styles.sub}>Season, stall number, and the hours for each pickup day.</p>
      </div>

      <form className={styles.form} onSubmit={(event) => void onSave(event)}>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <section className={styles.notice} role="status">
            <h2>{notice}</h2>
            <p>{name} · Stall {stall} · {days.length} days</p>
            <a href="/staff/agenda">View agenda →</a>
          </section>
        ) : null}

        <Field label="Name" htmlFor="market-name">
          <input
            id="market-name"
            className={styles.input}
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setNotice('')
            }}
          />
        </Field>

        <div className={styles.grid}>
          <Field label="Season start" htmlFor="market-start">
            <input
              id="market-start"
              className={styles.input}
              type="date"
              value={start}
              onChange={(event) => changeStart(event.target.value)}
            />
          </Field>
          <Field label="Season end" htmlFor="market-end">
            <input
              id="market-end"
              className={styles.input}
              type="date"
              value={finish}
              onChange={(event) => changeFinish(event.target.value)}
            />
          </Field>
          <Field label="Season cost" htmlFor="market-cost" hint="Euros for the whole season">
            <input
              id="market-cost"
              className={styles.input}
              inputMode="decimal"
              value={cost}
              onChange={(event) => {
                setCost(event.target.value)
                setNotice('')
              }}
            />
          </Field>
          <Field label="Stall number" htmlFor="market-stall">
            <input
              id="market-stall"
              className={styles.input}
              inputMode="numeric"
              value={stall}
              onChange={(event) => {
                setStall(event.target.value)
                setNotice('')
              }}
            />
          </Field>
        </div>

        <div className={styles.days}>
          <h2>Market days</h2>
          <p className={styles.hint}>{seasonHint}</p>
          {days.length === 0 ? (
            <p className={styles.empty}>No pickup days in this season.</p>
          ) : (
            <ul className={styles.dayList}>
              {days.map((day) => {
                const locked = Boolean(day.id && busyIds.has(day.id))
                return (
                  <li key={day.date} className={styles.day}>
                    <p className={styles.dayDate}>{formatDateLabel(day.date)}</p>
                    <label className={styles.time}>
                      <span>Open</span>
                      <input
                        className={styles.input}
                        type="time"
                        step={900}
                        value={clock(day.open)}
                        aria-label={`Open ${formatDateLabel(day.date)}`}
                        onChange={(event) => {
                          const open = clock(event.target.value)
                          setNotice('')
                          setDays((current) =>
                            current.map((row) => (row.date === day.date ? { ...row, open } : row)),
                          )
                        }}
                      />
                    </label>
                    <label className={styles.time}>
                      <span>Close</span>
                      <input
                        className={styles.input}
                        type="time"
                        step={900}
                        value={clock(day.close)}
                        aria-label={`Close ${formatDateLabel(day.date)}`}
                        onChange={(event) => {
                          const close = clock(event.target.value)
                          setNotice('')
                          setDays((current) =>
                            current.map((row) => (row.date === day.date ? { ...row, close } : row)),
                          )
                        }}
                      />
                    </label>
                    <div className={styles.dayActions}>
                      {locked ? <span className={styles.locked}>Has orders</span> : null}
                      <Button
                        tone="staff"
                        variant="danger"
                        disabled={locked || busy}
                        onClick={() => void onDeleteDay(day)}
                      >
                        Delete day
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className={styles.actions}>
          <Button type="submit" tone="staff" variant="primary" size="lg" disabled={busy}>
            Save
          </Button>
          {marketId ? (
            <div className={styles.deleteMarket}>
              {marketLocked ? <p className={styles.locked}>This market has orders and cannot be deleted.</p> : null}
              <Button tone="staff" variant="danger" disabled={marketLocked || busy} onClick={() => void onDeleteMarket()}>
                Delete market
              </Button>
            </div>
          ) : null}
        </div>
      </form>
    </section>
  )
}
