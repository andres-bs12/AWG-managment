import { useId } from 'react'
import { Field } from '../ui/Field'
import { Button } from '../ui/Button'
import styles from '../../pages/staff/SettingsRows.module.css'

export function NumberStepper({ label, value, onChange, min = 0, max, disabled = false }: { label: string; value: string; onChange: (value: string) => void; min?: number; max: number; disabled?: boolean }) {
  const id = useId()
  const number = Number(value)
  const valid = value.trim() !== '' && Number.isInteger(number)
  return <div className={styles.stepper}>
    <Button tone="staff" variant="secondary" aria-label={`Decrease ${label}`} disabled={disabled || (valid && number <= min)} onClick={() => onChange(String(Math.max(min, (valid ? number : min) - 1)))}>−</Button>
    <Field label={label} htmlFor={id}><input id={id} type="number" min={min} max={max} step="1" value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /></Field>
    <Button tone="staff" variant="secondary" aria-label={`Increase ${label}`} disabled={disabled || (valid && number >= max)} onClick={() => onChange(String(Math.min(max, (valid ? number : min) + 1)))}>+</Button>
  </div>
}
