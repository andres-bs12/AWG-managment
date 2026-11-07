import { OptionalNote } from '../../../components/public/OptionalNote'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { Field } from '../../../components/ui/Field'
import { PhotoTiles } from '../../../components/public/PhotoTiles'

export function BuyPetStep({ t, draft, patchItem, err, photoErrors, addFiles, activeUid, changeName }: { activeUid: string; changeName: () => void } & Pick<BuyStepProps, 't' | 'draft' | 'patchItem' | 'err' | 'described' | 'photoErrors' | 'addFiles'>) {
  return draft.items.map(item => item.uid !== activeUid ? null : <div className={styles.itemSection} key={item.uid}>
    {item.withName ? <div data-pet-name className={styles.petNameSummary}>
      <span>{t('petName')}: <strong>{item.petName || '—'}</strong></span>
      <button type="button" className={styles.linkBtn} onClick={changeName}>{t('change')}</button>
    </div> : <Field label={t('petName')} htmlFor={`pet-${item.uid}`} error={err(`pet-${item.uid}`)}>
      <input id={`pet-${item.uid}`} maxLength={60} value={item.petName} required onChange={event => patchItem(item.uid, { petName: event.target.value })} />
    </Field>}
    <PhotoTiles uid={item.uid} petName={item.petName} photos={item.photos} needsReload={item.photosNeedReload} error={err(`photos-${item.uid}`)} fileError={photoErrors[item.uid]} onAdd={files => addFiles(item.uid, files)} onRemove={id => patchItem(item.uid, { photos: item.photos.filter(photo => photo.id !== id) })} />
    <OptionalNote id={`note-${item.uid}`} value={item.note} onChange={note => patchItem(item.uid, { note })} error={err(`note-${item.uid}`)} />
  </div>)
}
