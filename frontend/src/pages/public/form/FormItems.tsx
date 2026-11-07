import { paintedName } from '../../../lib/paintedName'
import { OptionalNote } from '../../../components/public/OptionalNote'
import type { OrderItem } from '../../../domain/types'
import type { FormItemDraft } from '../../../lib/formDraft'
import { useLocale } from '../../../i18n/LocaleContext'
import { previewItem, colorKeys } from '../../../lib/ornamentPresentation'
import { OrnamentPreview } from '../../../components/public/OrnamentPreview'
import { PhotoTiles } from '../../../components/public/PhotoTiles'
import { Card } from '../../../components/public/PublicForm'
import { Field } from '../../../components/ui/Field'
import { HelpTip } from '../../../components/ui/HelpTip'
import styles from '../FormPage.module.css'

export function FormItems({ items, draft, errors, photoErrors, patch, addFiles, validate }: {
  items: OrderItem[]; draft: FormItemDraft[]; errors: Record<string, string>; photoErrors: Record<string, string>;
  patch: (id: string, partial: Partial<FormItemDraft>) => void; addFiles: (id: string, files: File[]) => Promise<void>; validate: (id: string) => void;
}) {
  const { t } = useLocale()
  return items.map((source, index) => {
    const item = draft.find(row => row.orderItemId === source.id)
    if (!item) return <Card key={source.id}><div className={styles.item}>
      <h3>{source.petName || t('ornamentN', { n: index + 1 })}</h3>
      <p className={styles.muted}>{t('finishedOrnament')}</p>
      <div className={styles.preview}><OrnamentPreview item={previewItem(source)} static /></div>
      <dl className={styles.facts}><div><dt>{t('shopColour')}</dt><dd>{source.color ? t(colorKeys[source.color]) : t('colorUnknown')}</dd></div><div><dt>{t('shopFinish')}</dt><dd>{source.finish ? t(source.finish === 'shiny' ? 'finishShiny' : 'finishMatte') : t('formFinishUnknown')}</dd></div>{source.withName && <div><dt>{t('backName')}</dt><dd>{source.backName}</dd></div>}</dl>
    </div></Card>
    const id = source.id
    return <Card key={id}><div className={styles.item}>
      <h3>{item.petName || t('ornamentN', { n: index + 1 })}</h3>
      <dl className={styles.facts}><div><dt>{t('shopColour')}</dt><dd>{source.color ? t(colorKeys[source.color]) : t('colorUnknown')}{(source.color === 'grey' || source.color === 'white') && <> · {t('legacyColour')}</>}</dd></div><div><dt>{t('shopFinish')}</dt><dd>{source.finish ? t(source.finish === 'shiny' ? 'finishShiny' : 'finishMatte') : t('formFinishUnknown')}</dd></div></dl>
      <div className={styles.editor}>
        <div className={styles.preview}><OrnamentPreview readOnly item={previewItem(source, item)} /></div>
        <div className={styles.fields}>
          <Field label={t(source.withName ? 'paintedPetName' : 'petName')} hint={source.withName ? t('formBackNameHint') : undefined} htmlFor={`pet-${id}`} error={errors[`pet-${id}`]} announceError={false}><input id={`pet-${id}`} maxLength={60} value={source.withName ? item.backName : item.petName} onBlur={() => validate(`pet-${id}`)} onChange={event => patch(id, { petName: source.withName ? paintedName(event.target.value) : event.target.value })} /></Field>
          <PhotoTiles uid={id} petName={item.petName} photos={item.photos} needsReload={item.photosNeedReload} error={errors[`photos-${id}`]} fileError={photoErrors[id]} announceErrors={false} onAdd={files => addFiles(id, files)} onRemove={photoId => patch(id, { photos: item.photos.filter(photo => photo.id !== photoId) })} />
          <OptionalNote id={`note-${id}`} value={item.note} onChange={note => patch(id, { note })} error={errors[`note-${id}`]} announceError={false} />
        </div>
      </div>
    </div></Card>
  })
}

export function FormEditHelp() {
  const { t } = useLocale()
  return <HelpTip label={t('formExplainChanges')}>{t('formCanEdit')}</HelpTip>
}
