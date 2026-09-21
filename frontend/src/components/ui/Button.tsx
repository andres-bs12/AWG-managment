import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'choice'
  size?: 'md' | 'lg'
  fullWidth?: boolean
  tone?: 'public' | 'staff'
  selected?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  tone = 'public',
  selected,
  className,
  children,
  type = 'button',
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
    <button
      type={type}
      className={cls}
      data-selected={selected ? 'true' : 'false'}
      {...rest}
      {...(selected !== undefined ? { 'aria-pressed': selected } : {})}
    >
      {children}
    </button>
  )
}
