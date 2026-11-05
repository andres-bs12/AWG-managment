import { useLayoutEffect, useRef, useState } from 'react'
import type { Photo } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import { InsetNote } from './PublicForm'
import styles from './PhotoTiles.module.css'

export const MAX_PHOTOS = 6

/** Reference uploads shared by the shop and QR form. Picker input is never a hidden tab stop. */
export function PhotoTiles({ uid, petName, photos, needsReload, error, fileError, onAdd, onRemove, announceErrors = true }: {
  uid: string; petName: string; photos: Photo[]; needsReload?: boolean; error?: string; fileError?: string;
  onAdd: (files: File[]) => Promise<void>; onRemove: (id: string) => void; announceErrors?: boolean;
}) {
  const { t } = useLocale()
  const [reading, setReading] = useState(false)
  const busy = useRef(false)
  const picker = useRef<HTMLInputElement>(null)
  const add = useRef<HTMLButtonElement>(null)
  const count = useRef<HTMLParagraphElement>(null)
  const focusPending = useRef(false)
  const id = `photos-${uid}`
  // Restore after React commits the tiles: at the limit the add button is removed.
  // A frame callback can focus the old button just before that removal and lose focus.
  useLayoutEffect(() => {
    if (reading || !focusPending.current) return
    focusPending.current = false
    const target = add.current ?? count.current
    target?.focus()
  }, [photos, reading])
  const description = [`${id}-hint`, `${id}-count`, needsReload ? `${id}-reload` : '', error ? `${id}-error` : '', fileError ? `${id}-file-error` : ''].filter(Boolean).join(' ')
  return <div id={`photos-block-${uid}`} className={styles.block} role="group" aria-labelledby={`${id}-label`} aria-describedby={description} tabIndex={-1} aria-busy={reading}>
    <p className={styles.label} id={`${id}-label`}>{t('formPhotos')}</p>
    <p className={styles.hint} id={`${id}-hint`}>{t('shopPhotosHint')} {t('photoFormats')}</p>
    {needsReload && <InsetNote><p id={`${id}-reload`} role="status">{t('shopPhotosReload')}</p></InsetNote>}
    <div className={styles.tiles}>
      {photos.map((photo, index) => <span key={photo.id} className={styles.tile}>
        <img src={photo.dataUrl} alt={t('photoAlt', { n: index + 1, name: petName || t('yourPet') })} />
        <button type="button" className={styles.remove} disabled={reading} aria-label={t('shopRemovePhoto', { name: photo.name })} onClick={() => {
          focusPending.current = true
          onRemove(photo.id)
        }}><span aria-hidden="true">×</span></button>
      </span>)}
      {photos.length < MAX_PHOTOS && <button ref={add} type="button" id={id} className={styles.add} aria-label={t('addPhotoCount', { n: photos.length, max: MAX_PHOTOS })} aria-describedby={description} aria-invalid={!!error || !!fileError} aria-disabled={reading} aria-busy={reading} onClick={() => { if (!busy.current) picker.current?.click() }}>{reading ? <span className={styles.reading}>{t('photoReading')}</span> : '+'}</button>}
    </div>
    <p ref={count} id={`${id}-count`} className={styles.count} role="status" tabIndex={-1}>{reading ? t('photoReading') : t('shopPhotosCount', { n: photos.length, max: MAX_PHOTOS })}{!needsReload && photos.some(photo => photo.dataUrl.startsWith('data:')) && <> · {t('shopPhotosWarningShort')}</>}</p>
    <input ref={picker} id={`gallery-${uid}`} className="visually-hidden" type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" onChange={event => {
      const files = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (!files.length || busy.current) return
      busy.current = true; setReading(true)
      void onAdd(files).finally(() => { busy.current = false; focusPending.current = true; setReading(false) })
    }} />
    {error && <p className={styles.error} id={`${id}-error`} role={announceErrors ? 'alert' : undefined}>{error}</p>}
    {fileError && <p className={styles.error} id={`${id}-file-error`} role="alert">{fileError}</p>}
  </div>
}
