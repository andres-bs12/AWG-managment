import { Field } from '../ui/Field'
import { BACK_NAME_MAX, backNameInput, backNameTooLong } from '../../lib/backNameInput'
import styles from './BackNameField.module.css'

/**
 * The paid name on the back, shared by /buy and /form: letters only, shown in capitals, never cut
 * off. Typing stops at 6 letters; a longer pasted or saved name stays visible with the limit explained.
 */
export function BackNameField({ id, label, hint, value, error, tooLongMessage, onChange, onBlur, describedBy, announceError = true }: {
  id: string; label: string; hint: string; value: string; error?: string; tooLongMessage: string;
  onChange: (value: string) => void; onBlur?: () => void; describedBy?: string; announceError?: boolean;
}) {
  const shown = error ?? (backNameTooLong(value) ? tooLongMessage : undefined)
  return <Field label={label} htmlFor={id} hint={hint} error={shown} announceError={announceError}>
    {/* maxLength stops typing at 6 letters; a longer paste is kept whole (set from state, which maxLength does not cut) so the error explains it. */}
    <input id={id} className={styles.input} value={value} maxLength={BACK_NAME_MAX} autoComplete="off" autoCapitalize="characters" spellCheck={false}
      aria-describedby={describedBy} onBlur={onBlur} onChange={event => onChange(backNameInput(event.target.value))}
      onPaste={event => {
        const input = event.currentTarget
        const pasted = event.clipboardData.getData('text')
        const next = backNameInput(input.value.slice(0, input.selectionStart ?? input.value.length) + pasted + input.value.slice(input.selectionEnd ?? input.value.length))
        if (!backNameTooLong(next)) return
        event.preventDefault()
        onChange(next)
      }} />
  </Field>
}
