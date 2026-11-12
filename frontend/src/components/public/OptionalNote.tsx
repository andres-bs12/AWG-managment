import { useEffect, useRef } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import { Field } from '../ui/Field'
import styles from './OptionalNote.module.css'

export function OptionalNote({ id, value, onChange, error, announceError = true }: { id: string; value: string; onChange: (value: string) => void; error?: string; announceError?: boolean }) {
  const { t } = useLocale()
  const root = useRef<HTMLDetailsElement>(null)
  useEffect(() => { if (error && root.current) root.current.open = true }, [error])
  return <details ref={root} className={styles.note}><summary>{t('optionalNote')}</summary><Field className={styles.field} label={t('note')} htmlFor={id} error={error} announceError={announceError}><textarea id={id} maxLength={1000} value={value} onChange={event => onChange(event.target.value)} /></Field></details>
}
