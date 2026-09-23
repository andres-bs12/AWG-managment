import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import styles from './Button.module.css'

type Props = {
  to: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'lg'
  fullWidth?: boolean
  tone?: 'public' | 'staff'
  selected?: boolean
  className?: string
  state?: object
  'aria-label'?: string
}

export function ButtonLink({
  to,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  tone = 'public',
  selected,
  className,
  state,
  ...rest
}: Props) {
  const cls = [
    styles.btn,
    styles[variant],
    size === 'lg' ? styles.lg : '',
    fullWidth ? styles.full : '',
    tone === 'staff' ? styles.staff : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <Link
      className={cls}
      to={to}
      state={state}
      data-selected={selected ? 'true' : 'false'}
      aria-current={selected ? 'page' : undefined}
      {...rest}
    >
      {children}
    </Link>
  )
}
