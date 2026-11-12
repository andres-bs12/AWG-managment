import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import styles from './DayStrip.module.css'

export type DayStripOption = {
  value: string
  label: string
}

type Props = {
  days: DayStripOption[]
  value: string
  onChange: (date: string) => void
  today?: string
  tools?: ReactNode
}

export function DayStrip({ days, value, onChange, today, tools }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const index = Math.max(0, days.findIndex((day) => day.value === value))

  useEffect(() => {
    const selected = trackRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    selected?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' })
  }, [value])

  function go(delta: number) {
    const next = days[index + delta]
    if (next) onChange(next.value)
  }

  return (
    <div className={styles.strip}>
      <div className={styles.tools}>
        {today ? <Button tone="staff" variant="ghost" disabled={today === value} onClick={() => onChange(today)}>Today</Button> : null}
        {tools}
      </div>
      <div className={styles.row}>
        <Button
          className={styles.arrow}
          tone="staff"
          variant="ghost"
          aria-label="Previous day"
          disabled={index <= 0}
          onClick={() => go(-1)}
        >
          ‹
        </Button>
        <div
          ref={trackRef}
          className={styles.track}
          role="group"
          aria-label="Agenda day"
        >
          {days.map((day) => {
            const selected = day.value === value
            return (
              <button
                key={day.value}
                type="button"
                className={styles.chip}
                aria-pressed={selected}
                data-selected={selected ? 'true' : 'false'}
                onClick={() => onChange(day.value)}
              >
                <span>{day.label.split(' ')[0].replace(',', '')}</span>
                <strong>{day.label.split(' ').slice(1).join(' ')}</strong>
              </button>
            )
          })}
        </div>
        <Button
          className={styles.arrow}
          tone="staff"
          variant="ghost"
          aria-label="Next day"
          disabled={index >= days.length - 1}
          onClick={() => go(1)}
        >
          ›
        </Button>
      </div>
    </div>
  )
}
