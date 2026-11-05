import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Field'
import panel from '../Panel.module.css'
import { colorKeys, MAX_PHOTOS } from './shared'

export function BuyPetStep({ t, draft, patchItem, err, described, photoErrors, addFiles }: Pick<BuyStepProps, 't' | 'draft' | 'patchItem' | 'err' | 'described' | 'photoErrors' | 'addFiles'>) {
  return (draft.items.map((item, index) => <div className={styles.card} key={item.uid}>
    <h3>
      {t('ornamentN', { n: index + 1 })} · {item.color && t(colorKeys[item.color])}</h3>
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
        {t('shopPhotosHint')} {t('shopPhotosWarning')}</p>
      {item.photosNeedReload && <p className={styles.notice} role="status">
        {t('shopPhotosReload')}</p>}
      <div className={panel.photoRow}>
        {item.photos.map((photo) => <span key={photo.id} className={styles.thumb}>
          <img src={photo.dataUrl} alt={photo.name} />
          <button

            type="button"

            aria-label={t('shopRemovePhoto', { name: photo.name })}

            onClick={() => patchItem(item.uid, { photos: item.photos.filter((other) => other.id !== photo.id) })}>×</button></span>)}</div>
      <p className={styles.muted} aria-live="polite">
        {t('shopPhotosCount', { n: item.photos.length, max: MAX_PHOTOS })}</p>
      <Button

        id={`photos-${item.uid}`}

        variant="secondary"

        disabled={item.photos.length >= MAX_PHOTOS}

        aria-describedby={described(`photos-${item.uid}`, true)}

        onClick={() => document.getElementById(`gallery-${item.uid}`)?.click()}>
        {t('addPhoto')}</Button>
      <input

        id={`gallery-${item.uid}`}

        className="visually-hidden"

        type="file"

        accept="image/*"

        multiple

        tabIndex={-1}

        aria-hidden="true"

        onChange={(event) => { const files = Array.from(event.target.files ?? []); void addFiles(item.uid, files); event.target.value = '' }} />
      {err(`photos-${item.uid}`) && <p className={styles.error} id={`photos-${item.uid}-error`} role="alert">
        {err(`photos-${item.uid}`)}</p>}{photoErrors[item.uid] && <p className={styles.error} role="alert">
          {photoErrors[item.uid]}</p>}
    </div>
    <Field label={t('note')} htmlFor={`note-${item.uid}`}>
      <textarea

        id={`note-${item.uid}`} maxLength={1000}

        value={item.note}

        onChange={(event) => patchItem(item.uid, { note: event.target.value })} /></Field>
  </div>))
}
