import type { ReactNode } from 'react'
import styles from './Field.module.css'

type Props = {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, children }: Props) {
  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''}`}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      <div className={styles.control}>{children}</div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
