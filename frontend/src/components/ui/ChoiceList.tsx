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
}

export function ChoiceList<T extends string>({ legend, value, onChange, choices, name }: Props<T>) {
  return (
    <fieldset className={styles.wrap}>
      <legend className="visually-hidden">{legend}</legend>
      {choices.map((c) => {
        const selected = value === c.value
        return (
          <label key={c.value} className={styles.card} data-selected={selected ? 'true' : 'false'}>
            <input
              className="visually-hidden"
              type="radio"
              name={name}
              value={c.value}
              checked={selected}
              onChange={() => onChange(c.value)}
            />
            <span className={styles.mark} aria-hidden="true">
              {selected ? '✓' : ''}
            </span>
            <span className={styles.copy}>
              <span className={styles.title}>
                {c.title}
                {selected ? <span className={styles.current}> Current</span> : null}
              </span>
              {c.body ? <span className={styles.body}>{c.body}</span> : null}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
