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
  announceError?: boolean
}

export function Field({ label, htmlFor, hint, error, children, className, announceError = true }: Props) {
  const control = isValidElement(children) && typeof children.type === 'string'
    ? children as ReactElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }>
    : null
  const description = [...new Set([
    control?.props['aria-describedby'], hint ? `${htmlFor}-hint` : '', error ? `${htmlFor}-error` : '',
  ].filter(Boolean).join(' ').split(/\s+/).filter(Boolean))].join(' ') || undefined
  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''} ${className ?? ''}`}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {hint ? <p className={styles.hint} id={`${htmlFor}-hint`}>{hint}</p> : null}
      <div className={styles.control} data-field-control>{control ? cloneElement(control, { 'aria-invalid': error ? true : undefined, 'aria-describedby': description }) : children}</div>
      {error ? (
        <p className={styles.error} id={`${htmlFor}-error`} role={announceError ? 'alert' : undefined}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
