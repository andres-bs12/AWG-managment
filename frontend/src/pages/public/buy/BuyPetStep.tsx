import { OptionalNote } from '../../../components/public/OptionalNote'
import styles from '../BuyPage.module.css'
import type { BuyStepProps } from './shared'
import { PhotoTiles } from '../../../components/public/PhotoTiles'

export function BuyPetStep({ draft, patchItem, err, photoErrors, addFiles, activeUid }: { activeUid: string } & Pick<BuyStepProps, 't' | 'draft' | 'patchItem' | 'err' | 'described' | 'photoErrors' | 'addFiles'>) {
  return draft.items.map(item => item.uid !== activeUid ? null : <div className={styles.itemSection} key={item.uid}>
    {/* No pet-name field (owner, 2026-11-11): a name is only asked for when it is painted on the back. */}
    <PhotoTiles uid={item.uid} petName={item.petName} photos={item.photos} needsReload={item.photosNeedReload} error={err(`photos-${item.uid}`)} fileError={photoErrors[item.uid]} onAdd={files => addFiles(item.uid, files)} onRemove={id => patchItem(item.uid, { photos: item.photos.filter(photo => photo.id !== id) })} />
    <OptionalNote id={`note-${item.uid}`} value={item.note} onChange={note => patchItem(item.uid, { note })} error={err(`note-${item.uid}`)} />
  </div>)
}
