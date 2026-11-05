import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import styles from './Field.module.css'

type Props = {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: ReactNode
  /** Extra class, e.g. a column span when the field sits in a form grid. */
  className?: string
}

export function Field({ label, htmlFor, hint, error, children, className }: Props) {
  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''} ${className ?? ''}`}>
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
