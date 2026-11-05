import styles from './SegmentedControl.module.css'
import publicStyles from './PublicSegment.module.css'

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
  tone?: 'public' | 'staff'
  hideLegend?: boolean
}

export function SegmentedControl<T extends string>({ legend, value, onChange, options, name, tone = 'staff', hideLegend = false }: Props<T>) {
  if (tone === 'public') return <fieldset className={publicStyles.wrap}>
    <legend className={hideLegend ? publicStyles.hiddenLegend : undefined}>{legend}</legend>
    {options.map(option => <label key={option.value} className={publicStyles.option} data-selected={value === option.value}><input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} /><span>{option.label}</span></label>)}
  </fieldset>
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
