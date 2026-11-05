import type { HTMLAttributes, ReactNode } from 'react'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './PublicForm.module.css'
import { usePublicActions } from './usePublicActions'

export function PublicPage({ className = '', variant = 'form', ...props }: HTMLAttributes<HTMLDivElement> & { variant?: 'form' | 'status' }) {
  return <div {...props} data-public-page className={`${styles.page} ${variant === 'status' ? styles.state : ''} ${className}`} />
}
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <header className={styles.header}><h1>{title}</h1>{children && <div className={styles.lead}>{children}</div>}</header>
}
export function InsetNote({ children, tone }: { children: ReactNode; tone?: 'warning' }) { return <div className={styles.inset} data-tone={tone}>{children}</div> }
export function StickyActions({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = usePublicActions()
  return <div ref={ref} data-sticky-actions className={`${styles.actions} ${className}`}>{children}</div>
}
export function Card({ children }: { children: ReactNode }) { return <section className={styles.card}>{children}</section> }
export function PublicState({ title, children, error = false }: { title: string; children: ReactNode; error?: boolean }) {
  return <PublicPage className={styles.state}><PageHeader title={title} /><div className={styles.stateBody} role={error ? 'alert' : undefined}>{children}</div></PublicPage>
}
export function ErrorSummary({ errors, labels, onFocus }: { errors: Record<string, string>; labels: Record<string, string>; onFocus: (id: string) => void }) {
  const { t } = useLocale()
  if (!Object.keys(errors).length) return null
  return <div className={styles.errorSummary} role="alert" tabIndex={-1} aria-labelledby="form-errors-heading">
    <h3 id="form-errors-heading">{t('shopFixErrors')}</h3><ul>{Object.entries(errors).map(([id, message]) => <li key={id}><a href={`#${id}`} onClick={event => { event.preventDefault(); onFocus(id) }}>{labels[id] || t('formDetails')}: {message}</a></li>)}</ul>
  </div>
}

