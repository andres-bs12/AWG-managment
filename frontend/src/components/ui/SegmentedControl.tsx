import styles from './SegmentedControl.module.css'

export type SegmentOption<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  legend: string
  value: T | null
  onChange: (value: T) => void
  options: SegmentOption<T>[]
  name: string
}

export function SegmentedControl<T extends string>({ legend, value, onChange, options, name }: Props<T>) {
  return (
    <fieldset className={styles.wrap}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.row} role="radiogroup" aria-label={legend}>
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              className={styles.seg}
              name={name}
              role="radio"
              aria-checked={selected}
              aria-pressed={selected}
              data-selected={selected ? 'true' : 'false'}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
