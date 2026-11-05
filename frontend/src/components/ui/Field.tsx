import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
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
      {hint ? <p className={styles.hint} id={`${htmlFor}-hint`}>{hint}</p> : null}
      <div className={styles.control}>{isValidElement(children) && typeof children.type === 'string' ? cloneElement(children as ReactElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, { 'aria-invalid': error ? true : undefined, 'aria-describedby': [hint ? `${htmlFor}-hint` : '', error ? `${htmlFor}-error` : ''].filter(Boolean).join(' ') || undefined }) : children}</div>
      {error ? (
        <p className={styles.error} id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
