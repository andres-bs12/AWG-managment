import styles from './SegmentedControl.module.css'
import publicStyles from './PublicSegment.module.css'

export type SegmentOption<T extends string> = {
  value: T
  label: string
  hint?: string
  disabled?: boolean
  color?: string
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
  return <fieldset className={styles.wrap}>
    <legend className={hideLegend ? 'visually-hidden' : styles.legend}>{legend}</legend>
    <div className={styles.row}>
      {options.map(option => <label key={option.value} className={styles.seg} data-selected={value === option.value} data-disabled={option.disabled || undefined}>
        <input className="visually-hidden" type="radio" name={name} value={option.value} checked={value === option.value} disabled={option.disabled} onChange={() => onChange(option.value)} />
        {option.color && <span aria-hidden="true" className={styles.swatch} data-color={option.color} />}
        <span>{option.label}{option.hint && <small> · {option.hint}</small>}</span>
      </label>)}
    </div>
  </fieldset>
}
