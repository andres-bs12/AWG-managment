import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { Field } from '../../../components/ui/Field'
import { colorKeys, MAX_PHOTOS } from './shared'

import { useState } from 'react'

export function BuyPetStep({ t, draft, patchItem, err, described, photoErrors, addFiles, activeUid }: { activeUid: string } & Pick<BuyStepProps, 't' | 'draft' | 'patchItem' | 'err' | 'described' | 'photoErrors' | 'addFiles'>) {
  const [reading, setReading] = useState<string | null>(null)
  return (draft.items.map((item, index) => item.uid !== activeUid ? null : <div className={styles.card} key={item.uid}>
    <h3>
      {t('ornamentN', { n: index + 1 })} · {item.color && t(colorKeys[item.color])}{item.finish && <> · {t(item.finish === 'shiny' ? 'finishShiny' : 'finishMatte')}</>}</h3>
    <Field label={t('petName')} htmlFor={`pet-${item.uid}`} error={err(`pet-${item.uid}`)}>
      <input

        id={`pet-${item.uid}`} maxLength={60}

        value={item.petName}

        required

        aria-invalid={!!err(`pet-${item.uid}`)}

        aria-describedby={described(`pet-${item.uid}`)}

        onChange={(event) => patchItem(item.uid, { petName: event.target.value })} /></Field>
    <div className={styles.photoBlock}>
      <p className={styles.label}>
        {t('formPhotos')}</p>
      <p className={styles.muted} id={`photos-${item.uid}-hint`}>
        {t('shopPhotosHint')}</p>
      {item.photosNeedReload && <p className={styles.inset} role="status">
        {t('shopPhotosReload')}</p>}
      <div className={styles.photoRow}>
        {item.photos.map((photo, photoIndex) => <span key={photo.id} className={styles.thumb}>
          <img src={photo.dataUrl} alt={t('photoAlt', { n: photoIndex + 1, name: item.petName })} />
          <button

            type="button"

            aria-label={t('shopRemovePhoto', { name: photo.name })}

            onClick={() => patchItem(item.uid, { photos: item.photos.filter((other) => other.id !== photo.id) })}>×</button></span>)}{item.photos.length < MAX_PHOTOS && <button type="button" id={`photos-${item.uid}`} className={styles.photoAdd} aria-label={t('addPhoto')} aria-describedby={described(`photos-${item.uid}`, true)} aria-disabled={reading === item.uid} aria-busy={reading === item.uid} onClick={() => { if (reading !== item.uid) document.getElementById(`gallery-${item.uid}`)?.click() }}>+</button>}</div>{reading === item.uid && <p role="status">{t('photoReading')}</p>}
      <p className={styles.muted} aria-live="polite">
        {t('shopPhotosCount', { n: item.photos.length, max: MAX_PHOTOS })}{item.photos.length > 0 && <> · {t('shopPhotosWarningShort')}</>}</p>
      <input

        id={`gallery-${item.uid}`}

        className="visually-hidden"

        type="file"

        accept="image/*"

        multiple

        tabIndex={-1}

        aria-hidden="true"

        onChange={(event) => { const files = Array.from(event.target.files ?? []); setReading(item.uid); void addFiles(item.uid, files).finally(() => setReading(null)); event.target.value = '' }} />
      {err(`photos-${item.uid}`) && <p className={styles.error} id={`photos-${item.uid}-error`} role="alert">
        {err(`photos-${item.uid}`)}</p>}{photoErrors[item.uid] && <p className={styles.error} role="alert">
          {photoErrors[item.uid]}</p>}
    </div>
    <details className={styles.noteToggle}><summary>{t('optionalNote')}</summary><Field label={t('note')} htmlFor={`note-${item.uid}`} error={err(`note-${item.uid}`)}>
      <textarea

        id={`note-${item.uid}`} maxLength={1000}

        value={item.note}

        onChange={(event) => patchItem(item.uid, { note: event.target.value })} /></Field></details>
  </div>))
}
