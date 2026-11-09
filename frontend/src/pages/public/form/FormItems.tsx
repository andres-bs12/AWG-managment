import { useState } from 'react'
import { OrnamentOverview } from '../../../components/public/OrnamentOverview'
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
  const [activeId, setActiveId] = useState(draft[0]?.orderItemId ?? '')
  const overview = items.map(source => {
    const item = draft.find(row => row.orderItemId === source.id)
    return { ...previewItem(source, item), uid: source.id, petName: item?.petName ?? source.petName, price: source.cost, editable: !!item }
  })
  return <>
    {/* A single ornament needs no overview list. */}
    {items.length > 1 && <OrnamentOverview items={overview} activeUid={activeId} onEdit={id => {
      setActiveId(id)
      const heading = document.getElementById(`form-editor-${id}`)
      heading?.focus({ preventScroll: true })
      heading?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }} />}
    {items.map((source, index) => {
      const item = draft.find(row => row.orderItemId === source.id)
      if (!item) return <Card key={source.id}><div className={styles.item}>
        <h3>{source.petName || t('ornamentN', { n: index + 1 })}</h3>
        <p className={styles.muted}>{t('finishedOrnament')}</p>
        <div className={styles.preview}><OrnamentPreview item={previewItem(source)} static /></div>
        <dl className={styles.facts}><div><dt>{t('shopColour')}</dt><dd>{source.color ? t(colorKeys[source.color]) : t('formFinishUnknown')}</dd></div><div><dt>{t('shopFinish')}</dt><dd>{source.finish ? t(source.finish === 'shiny' ? 'finishShiny' : 'finishMatte') : t('formFinishUnknown')}</dd></div>{source.withName && <div><dt>{t('backName')}</dt><dd>{source.backName}</dd></div>}</dl>
      </div></Card>
      const id = source.id
      return <Card key={id}><div className={styles.item} onFocusCapture={() => setActiveId(id)}>
        {/* Same rule as /buy: "Kugel 1 von 1" and the name summary only help when there are several. */}
        <h3 id={`form-editor-${id}`} tabIndex={-1}>{items.length > 1 ? `${t('multiEditorHeading', { n: index + 1, total: items.length })}${item.petName.trim() ? ` – ${item.petName.trim()}` : ''}` : item.petName.trim() || t('formSingleOrnament')}</h3>
        {items.length > 1 && <p className={styles.muted}>{source.withName ? item.backName.trim() ? t('multiNameValue', { name: item.backName }) : t('multiNamePending') : t('multiNoName')}</p>}
        <dl className={styles.facts}><div><dt>{t('shopColour')}</dt><dd>{source.color ? t(colorKeys[source.color]) : t('formFinishUnknown')}{(source.color === 'grey' || source.color === 'white') && <> · {t('legacyColour')}</>}</dd></div><div><dt>{t('shopFinish')}</dt><dd>{source.finish ? t(source.finish === 'shiny' ? 'finishShiny' : 'finishMatte') : t('formFinishUnknown')}</dd></div></dl>
        <div className={styles.editor}>
          <div className={styles.preview}><OrnamentPreview readOnly item={previewItem(source, item)} /></div>
          <div className={styles.fields}>
            <Field label={t('petName')} htmlFor={`pet-${id}`} error={errors[`pet-${id}`]} announceError={false}><input id={`pet-${id}`} maxLength={60} value={item.petName} onBlur={() => validate(`pet-${id}`)} onChange={event => patch(id, { petName: event.target.value })} /></Field>
            {source.withName && <Field label={t('backName')} htmlFor={`back-${id}`} hint={t('formBackNameHint')} error={errors[`back-${id}`]} announceError={false}><input id={`back-${id}`} maxLength={6} value={item.backName} onBlur={() => validate(`back-${id}`)} onChange={event => patch(id, { backName: event.target.value })} /></Field>}
            <PhotoTiles uid={id} petName={item.petName} photos={item.photos} needsReload={item.photosNeedReload} error={errors[`photos-${id}`]} fileError={photoErrors[id]} announceErrors={false} onAdd={files => addFiles(id, files)} onRemove={photoId => patch(id, { photos: item.photos.filter(photo => photo.id !== photoId) })} />
            <OptionalNote id={`note-${id}`} value={item.note} onChange={note => patch(id, { note })} error={errors[`note-${id}`]} announceError={false} />
          </div>
        </div>
      </div></Card>
  })}</>
}

export function FormEditHelp() {
  const { t } = useLocale()
  return <HelpTip label={t('formExplainChanges')}>{t('formCanEdit')}</HelpTip>
}
