import type { CustomerFormView } from '../../../domain/types'
import type { FormDraft } from '../../../lib/formDraft'
import { useLocale } from '../../../i18n/LocaleContext'
import { ReviewCard, ReviewProduct } from '../../../components/public/ReviewCard'
import { ornamentName, reviewTitle } from '../../../lib/ornamentTitle'
import { OrnamentPreview } from '../../../components/public/OrnamentPreview'
import { InsetNote } from '../../../components/public/PublicForm'
import { formatEur } from '../../../lib/money'
import { colorKeys, previewItem } from '../../../lib/ornamentPresentation'
import styles from '../FormPage.module.css'

export function FormReview({ view, draft, handoffs, edit }: { view: CustomerFormView; draft: FormDraft; handoffs: string[]; edit: (id: string) => void }) {
  const { t, locale } = useLocale()
  const items = view.items ?? [view.item]
  const editLabel = t('change')
  return <div className={styles.review}>
    {items.map((source, index) => {
      const item = draft.items.find(row => row.orderItemId === source.id)
      const details = item ?? source
      const named = { kind: source.kind, backName: source.withName ? details.backName : '', petName: details.petName }
      const title = reviewTitle(named, index, items.length, t)
      // Colour and finish on one line; an order without either says so once, not twice.
      const look = [source.color && `${t(colorKeys[source.color])}${source.color === 'grey' || source.color === 'white' ? ` (${t('legacyColour')})` : ''}`, source.finish && t(source.finish === 'shiny' ? 'finishShiny' : 'finishMatte')].filter(Boolean).join(' · ') || t('formFinishUnknown')
      // Same compact card as /buy: the name is the title only, the line below says whether it is painted on.
      return <ReviewCard key={source.id} title={title}
        action={item ? { label: editLabel, ariaLabel: t('editOrnamentNamed', { name: ornamentName(named) || title }), onClick: () => edit(source.withName ? `back-${source.id}` : `photos-${source.id}`) } : undefined}
        rows={details.note ? [{ label: t('noteLabel'), value: details.note }] : []}>
        <ReviewProduct art={<OrnamentPreview item={previewItem(source, item)} static />} price={formatEur(source.cost, locale)}
          lines={[look, t(source.kind === 'finished' ? 'finishedOrnament' : source.withName ? 'reviewWithName' : 'multiNoName')]}
          photos={item ? details.photos : []} photoAlt={i => t('photoAlt', { n: i + 1, name: ornamentName(named) || t('yourPet') })} />
      </ReviewCard>
    })}
    <ReviewCard title={t('reviewDetails')} action={{ label: editLabel, ariaLabel: t('editContactShort'), onClick: () => edit('form-name') }} rows={[
      { label: t('yourName'), value: draft.customerName },
      { label: t('email'), value: draft.email }, { label: t('phone'), value: draft.phone },
      ...(view.needsAddress ? [{ label: t('deliveryAddress'), value: [draft.address.line1, draft.address.line2, draft.address.postalCode, draft.address.city].filter(Boolean).join(', ') }] : []),
    ]} />
    <ReviewCard title={t('reviewOrder')} rows={[
      ...(handoffs.length ? [{ label: t('pickupWhen'), value: <>{handoffs.map(line => <p key={line}>{line}</p>)}</> }] : []),
      ...(view.total != null ? [{ label: t('orderTotal'), value: <span className={styles.price}>{formatEur(view.total, locale)}</span> }] : []),
      ...(view.paymentState ? [{ label: t('formPaymentState'), value: t(`payment_${view.paymentState}`) }] : []),
    ]} />
    <InsetNote><p>{t('reviewFromStall')}</p></InsetNote>
  </div>
}
