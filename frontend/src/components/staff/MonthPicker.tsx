import type { PaintingDay } from '../../domain/types'
import { dayStatus, isSelectable, monthGrid, monthOf, monthTitle, shiftMonth, spokenDate, weekdayHeaders } from '../../lib/monthGrid'
import styles from './MonthPicker.module.css'

type Props = {
  /** Visible month, 'YYYY-MM'. */
  month: string
  today: string
  seasonEnd: string | null
  /** Loaded painting days; matched by date, so days of other months are simply ignored. */
  days: PaintingDay[]
  selected: string | null
  onMonthChange: (month: string) => void
  onSelect: (date: string) => void
}

/** Month grid for picking one painting day. Weeks start on Monday; only today..season end can be chosen. */
export function MonthPicker({ month, today, seasonEnd, days, selected, onMonthChange, onSelect }: Props) {
  const firstMonth = monthOf(today)
  const lastMonth = seasonEnd ? monthOf(seasonEnd) : firstMonth
  const byDate = new Map(days.map(day => [day.date, day]))
  const cells = monthGrid(month)
  return <div className={styles.picker}>
    <div className={styles.header}>
      <button type="button" className={styles.nav} aria-label="Previous month" disabled={month <= firstMonth} onClick={() => onMonthChange(shiftMonth(month, -1))}>‹</button>
      <h2 className={styles.title} aria-live="polite">{monthTitle(month)}</h2>
      <button type="button" className={styles.nav} aria-label="Next month" disabled={month >= lastMonth} onClick={() => onMonthChange(shiftMonth(month, 1))}>›</button>
    </div>
    <div className={styles.weekdays} aria-hidden="true">
      {weekdayHeaders().map(weekday => <span key={weekday.long}>{weekday.short}</span>)}
    </div>
    <div className={styles.grid}>
      {cells.map((date, index) => {
        if (!date) return <span key={`pad-${index}`} className={styles.empty} aria-hidden="true" />
        const selectable = isSelectable(date, today, seasonEnd)
        const day = byDate.get(date)
        const status = selectable ? dayStatus(day) : null
        const isToday = date === today
        const isSelected = date === selected
        const dayNumber = Number(date.slice(8, 10))
        const spoken = status ? `${spokenDate(date)}, ${status.spoken}` : `${spokenDate(date)}${selectable ? '' : ', not available'}`
        return <button
          key={date}
          type="button"
          className={styles.day}
          data-selected={isSelected || undefined}
          data-today={isToday || undefined}
          data-tone={status?.tone}
          aria-pressed={isSelected}
          aria-label={spoken}
          disabled={!selectable}
          onClick={() => onSelect(date)}
        >
          <span className={styles.number}>{dayNumber}</span>
          {status && <span className={styles.status} aria-hidden="true">{status.short}</span>}
        </button>
      })}
    </div>
  </div>
}
