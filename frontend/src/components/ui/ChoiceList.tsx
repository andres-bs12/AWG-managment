import { useState } from 'react'
import styles from './ChoiceList.module.css'

type Choice<T extends string> = {
  value: T
  title: string
  body?: string
}

type Props<T extends string> = {
  legend: string
  value: T | null
  onChange: (value: T) => void
  choices: Choice<T>[]
  name: string
  compact?: boolean
  collapseSelected?: boolean
}

export function ChoiceList<T extends string>({ legend, value, onChange, choices, name, compact = false, collapseSelected = false }: Props<T>) {
  const [expanded, setExpanded] = useState(!value)
  const visibleChoices = collapseSelected && value && !expanded ? choices.filter((choice) => choice.value === value) : choices
  return (
    <fieldset className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <legend className="visually-hidden">{legend}</legend>
      {visibleChoices.map((c) => {
        const selected = value === c.value
        return (
          <label key={c.value} className={styles.card} data-selected={selected ? 'true' : 'false'}>
            <input
              className="visually-hidden"
              type="radio"
              name={name}
              value={c.value}
              checked={selected}
              onChange={() => {
                onChange(c.value)
                if (collapseSelected) setExpanded(false)
              }}
            />
            <span className={styles.copy}>
              <span className={styles.title}>{c.title}</span>
              {c.body ? <span className={styles.body}>{c.body}</span> : null}
            </span>
          </label>
        )
      })}
      {collapseSelected && value && !expanded ? (
        <button type="button" className={styles.change} onClick={() => setExpanded(true)}>
          Change {legend.toLowerCase()}
        </button>
      ) : null}
    </fieldset>
  )
}
