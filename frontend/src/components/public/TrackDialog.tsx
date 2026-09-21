import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../ui/Button'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './TrackDialog.module.css'

type Props = {
  onClose: () => void
  onSubmit: (code: string) => void
  initialCode?: string
  error?: string
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Mount only while the pop-up should be visible — mounting is what resets and focuses it. */
export function TrackDialog({ onClose, onSubmit, initialCode = '', error }: Props) {
  const { t } = useLocale()
  const titleId = useId()
  const hintId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const [code, setCode] = useState(initialCode)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 220)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = overflow
      restoreRef.current?.focus?.()
    }
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const nodes = cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!nodes || nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const next = code.trim().toUpperCase()
    if (!next) {
      setLocalError(t('trackNeedCode'))
      inputRef.current?.focus()
      return
    }
    setLocalError('')
    onSubmit(next)
  }

  const shownError = localError || error || ''

  return createPortal(
    <div className={styles.overlay} onKeyDown={onKeyDown}>
      <button type="button" className={styles.backdrop} aria-label={t('close')} onClick={onClose} />
      <div
        className={styles.card}
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
      >
        <div className={styles.ribbon} aria-hidden="true">
          <svg viewBox="0 0 220 64" className={styles.ribbonArt}>
            <circle cx="30" cy="30" r="9" fill="var(--berry)" />
            <circle cx="62" cy="38" r="7" fill="var(--gold)" />
            <circle cx="92" cy="30" r="9" fill="var(--green-bright)" />
            <circle cx="124" cy="38" r="7" fill="var(--gift-blue)" />
            <circle cx="156" cy="30" r="9" fill="var(--berry)" />
            <circle cx="188" cy="38" r="7" fill="var(--gold)" />
          </svg>
        </div>

        <button type="button" className={styles.close} onClick={onClose} aria-label={t('close')}>
          <span aria-hidden="true">×</span>
        </button>

        <div className={styles.ornament} aria-hidden="true">
          <span className={styles.ornamentCap} />
          <span className={styles.ornamentBody} />
        </div>

        <h2 className={styles.title} id={titleId}>
          {t('trackTitle')}
        </h2>
        <p className={styles.hint} id={hintId}>
          {t('trackLead')}
        </p>

        <form className={styles.form} onSubmit={submit} noValidate>
          <label className={styles.label} htmlFor="track-dialog-code">
            {t('trackCode')}
          </label>
          <input
            id="track-dialog-code"
            ref={inputRef}
            className={styles.input}
            name="code"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="AWG-2026"
            aria-invalid={shownError ? 'true' : 'false'}
            aria-errormessage={shownError ? `${titleId}-err` : undefined}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase())
              if (localError) setLocalError('')
            }}
          />
          {shownError ? (
            <p className={styles.error} id={`${titleId}-err`} role="alert">
              {shownError}
            </p>
          ) : null}
          <Button type="submit" size="lg" fullWidth className={styles.submit}>
            {t('trackSubmit')}
          </Button>
          <button type="button" className={styles.cancel} onClick={onClose}>
            {t('cancel')}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}
