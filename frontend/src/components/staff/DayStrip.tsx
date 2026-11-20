import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { StaffText } from './StaffText'
import styles from './DayStrip.module.css'

export type DayStripOption = {
  value: string
  label: string
  markets?: string
}

type Props = {
  days: DayStripOption[]
  value: string
  onChange: (date: string) => void
  today?: string
}

export function DayStrip({ days, value, onChange, today }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const hold = useRef<{ id: number; x: number; y: number; timer: number } | null>(null)
  const held = useRef(false)
  const [marketHint, setMarketHint] = useState('')
  const index = Math.max(0, days.findIndex((day) => day.value === value))

  function clearHold() {
    window.clearTimeout(hold.current?.timer)
    hold.current = null
  }

  useEffect(() => clearHold, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const centerSelected = () => {
      const selected = track.querySelector('[data-selected="true"]')
      if (!selected) return
      const chip = selected.getBoundingClientRect()
      const offset = chip.left - track.getBoundingClientRect().left + (chip.width - track.clientWidth) / 2
      track.scrollTo({ left: track.scrollLeft + offset, behavior: 'instant' })
    }
    centerSelected()
    const resize = new ResizeObserver(centerSelected)
    resize.observe(track)
    return () => resize.disconnect()
  }, [value])

  useEffect(() => {
    if (!marketHint) return
    const dismiss = () => setMarketHint('')
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss() }
    window.addEventListener('click', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('click', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [marketHint])

  function go(delta: number) {
    const next = days[index + delta]
    setMarketHint('')
    if (next) onChange(next.value)
  }

  return (
    <div className={styles.strip}>
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
            const label = day.label.replace(',', '')
            const [weekday, ...dateLabel] = label.split(' ')
            return (
              <button
                key={day.value}
                type="button"
                className={styles.chip}
                aria-pressed={selected}
                aria-current={day.value === today ? 'date' : undefined}
                aria-label={day.markets ? `${label}, ${day.markets}` : label}
                title={day.markets}
                data-selected={selected ? 'true' : 'false'}
                onPointerDown={event => {
                  held.current = false
                  if (!day.markets || event.pointerType === 'mouse' || !event.isPrimary) return
                  clearHold()
                  const markets = day.markets
                  hold.current = {
                    id: event.pointerId, x: event.clientX, y: event.clientY,
                    timer: window.setTimeout(() => {
                      held.current = true
                      setMarketHint(markets)
                    }, 450),
                  }
                }}
                onPointerMove={event => {
                  const active = hold.current
                  if (active?.id === event.pointerId && Math.hypot(event.clientX - active.x, event.clientY - active.y) > 8) clearHold()
                }}
                onPointerUp={clearHold}
                onPointerCancel={clearHold}
                onContextMenu={event => { if (day.markets && (hold.current || held.current)) event.preventDefault() }}
                onClick={event => {
                  if (held.current && event.detail > 0) {
                    event.stopPropagation()
                    return
                  }
                  setMarketHint('')
                  onChange(day.value)
                }}
              >
                <span>{weekday}</span>
                <strong>{dateLabel.join(' ')}</strong>
                {day.markets && <svg className={styles.stall} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 7l2-4h8l2 4v2H2V7Zm0 0h12M6 7l1-4m3 4-1-4M4 9v4h8V9M2 13h12" />
                </svg>}
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
      {marketHint && <p className={styles.marketHint}><StaffText>{marketHint}</StaffText></p>}
    </div>
  )
}
