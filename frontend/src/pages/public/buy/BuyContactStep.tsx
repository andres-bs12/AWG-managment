import type { BuyStepProps } from './shared'
import { Field } from '../../../components/ui/Field'

export function BuyContactStep({ t, draft, patch, err, described }: Pick<BuyStepProps, 't' | 'draft' | 'patch' | 'err' | 'described'>) {
  return (<>
    <p>
      {t('shopRequiredFields')}</p>
    <Field label={t('yourName')} htmlFor="buy-name" error={err('buy-name')}>
      <input

        id="buy-name" maxLength={120}

        autoComplete="name"

        value={draft.customerName}

        aria-invalid={!!err('buy-name')}

        aria-describedby={described('buy-name')}

        onChange={(event) => patch({ customerName: event.target.value })} /></Field>
    <Field label={t('email')} htmlFor="buy-email" error={err('buy-email')}>
      <input

        id="buy-email" maxLength={200}

        type="email"

        autoComplete="email"

        value={draft.email}

        aria-invalid={!!err('buy-email')}

        aria-describedby={described('buy-email')}

        onChange={(event) => patch({ email: event.target.value })} /></Field>
    <Field label={t('phone')} htmlFor="buy-phone" error={err('buy-phone')}>
      <input

        id="buy-phone" maxLength={40}

        type="tel"

        autoComplete="tel"

        value={draft.phone}

        aria-invalid={!!err('buy-phone')}

        aria-describedby={described('buy-phone')}

        onChange={(event) => patch({ phone: event.target.value })} /></Field>
    <Field label={t('shopStreet')} htmlFor="buy-line1" error={err('buy-line1')}>
      <input

        id="buy-line1"

        autoComplete="address-line1"

        value={draft.line1}

        aria-invalid={!!err('buy-line1')}

        aria-describedby={described('buy-line1')}

        onChange={(event) => patch({ line1: event.target.value })} /></Field>
    <Field label={t('shopLine2')} htmlFor="buy-line2">
      <input

        id="buy-line2"

        autoComplete="address-line2"

        value={draft.line2}

        onChange={(event) => patch({ line2: event.target.value })} /></Field>
    <Field

      label={t('shopPostal')}

      htmlFor="buy-postal"

      hint={t('shopPostalHint')}

      error={err('buy-postal')}>
      <input

        id="buy-postal"

        inputMode="numeric"

        autoComplete="postal-code"

        maxLength={4}

        value={draft.postalCode}

        aria-invalid={!!err('buy-postal')}

        aria-describedby={described('buy-postal', true)}

        onChange={(event) => patch({ postalCode: event.target.value.replace(/\D/g, '') })} /></Field>
    <Field label={t('shopCity')} htmlFor="buy-city">
      <input id="buy-city" value="Wien" readOnly /></Field>
  </>)
}
