import type { CustomerFormView } from '../../../domain/types'
import type { FormDraft } from '../../../lib/formDraft'
import { useLocale } from '../../../i18n/LocaleContext'
import { ReviewCard, ReviewProduct, ReviewThumbs } from '../../../components/public/ReviewCard'
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
      const title = t('ornamentN', { n: index + 1 })
      // The picture shows the colour, so only the finish is written. A legacy colour (no longer
      // offered) is the exception: it is named so the customer knows why it differs.
      const legacy = source.color === 'grey' || source.color === 'white'
      const look = [legacy && source.color && `${t(colorKeys[source.color])} (${t('legacyColour')})`, source.finish && t(source.finish === 'shiny' ? 'finishShiny' : 'finishMatte')].filter(Boolean).join(' · ') || t('formFinishUnknown')
      return <ReviewCard key={source.id} title={title}
        action={item ? { label: editLabel, ariaLabel: t('editOrnamentNamed', { name: details.petName?.trim() || title }), onClick: () => edit(`pet-${source.id}`) } : undefined}
        rows={[
          ...(source.withName ? [{ label: t('backName'), value: details.backName }] : []),
          ...(details.note ? [{ label: t('noteLabel'), value: details.note }] : []),
        ]}>
        <ReviewProduct preview={<OrnamentPreview item={previewItem(source, item)} static />} price={formatEur(source.cost, locale)}>
          <p>{details.petName || t(source.kind === 'finished' ? 'finishedOrnament' : 'customOrnament')}</p>
          <dl><dt>{legacy ? t('reviewLook') : t('shopFinish')}</dt><dd>{look}</dd></dl>
          {item && <ReviewThumbs photos={details.photos} alt={i => t('photoAlt', { n: i + 1, name: details.petName || t('yourPet') })} />}
        </ReviewProduct>
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
