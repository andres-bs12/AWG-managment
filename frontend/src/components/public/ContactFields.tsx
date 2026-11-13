import { Field } from '../ui/Field'
import { HelpTip } from '../ui/HelpTip'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './ContactFields.module.css'

export type ContactValues = { customerName: string; email: string; phone: string; line1: string; line2: string; postalCode: string; city?: string }

/** Shared contact/address composition; QR forms retain the server's address city. */
export function ContactFields({ prefix, values, onChange, error, onBlur, validFields = [], withAddress = true, announceErrors = true, deliveryPhone = true }: {
  prefix: string; values: ContactValues; onChange: (partial: Partial<ContactValues>) => void;
  error: (id: string) => string | undefined; onBlur?: (id: string) => void; validFields?: string[];
  withAddress?: boolean; announceErrors?: boolean; deliveryPhone?: boolean;
}) {
  const { t } = useLocale()
  const fields = [
    { key: 'customerName', suffix: 'name', label: t('yourName'), autoComplete: 'name', maxLength: 120 },
    { key: 'email', suffix: 'email', label: t('email'), autoComplete: 'email', maxLength: 200, type: 'email' },
    { key: 'phone', suffix: 'phone', label: t('phone'), autoComplete: 'tel', maxLength: 40, type: 'tel', hint: t(deliveryPhone ? 'phoneHint' : 'formPhoneHint') },
  ] as const
  return <>
    <fieldset className={styles.section}><legend className={styles.title}>{t('contactHeading')}</legend><div className={styles.grid} data-field-grid>
      {fields.map(field => {
        const id = `${prefix}-${field.suffix}`
        return <Field key={id} className={styles.half} label={field.label} htmlFor={id} hint={'hint' in field ? field.hint : undefined} error={error(id)} announceError={announceErrors}>
          <input id={id} type={'type' in field ? field.type : 'text'} autoComplete={field.autoComplete} maxLength={field.maxLength} value={values[field.key]} onBlur={() => onBlur?.(id)} data-valid={validFields.includes(id) || undefined} onChange={event => onChange({ [field.key]: event.target.value })} />
        </Field>
      })}
    </div></fieldset>
    {withAddress && <fieldset className={styles.section}><legend className={styles.title}>{t('addressHeading')}</legend><div className={styles.grid} data-field-grid>
      <Field className={styles.wide} label={t('shopStreet')} htmlFor={`${prefix}-line1`} error={error(`${prefix}-line1`)} announceError={announceErrors}><input id={`${prefix}-line1`} maxLength={200} autoComplete="address-line1" value={values.line1} onBlur={() => onBlur?.(`${prefix}-line1`)} data-valid={validFields.includes(`${prefix}-line1`) || undefined} onChange={event => onChange({ line1: event.target.value })} /></Field>
      <Field className={styles.narrow} label={t('shopLine2')} htmlFor={`${prefix}-line2`} error={error(`${prefix}-line2`)} announceError={announceErrors}><input id={`${prefix}-line2`} maxLength={200} autoComplete="address-line2" value={values.line2} onBlur={() => onBlur?.(`${prefix}-line2`)} onChange={event => onChange({ line2: event.target.value })} /></Field>
      <div className={styles.locality} data-field-grid>
        <Field className={styles.postal} label={t('shopPostal')} htmlFor={`${prefix}-postal`} error={error(`${prefix}-postal`)} renderError={false}><input id={`${prefix}-postal`} maxLength={4} inputMode="numeric" autoComplete="postal-code" value={values.postalCode} onBlur={() => onBlur?.(`${prefix}-postal`)} data-valid={validFields.includes(`${prefix}-postal`) || undefined} onChange={event => onChange({ postalCode: event.target.value.replace(/\D/g, '') })} /></Field>
        <div className={styles.city}><div className={styles.cityLabel}><strong id={`${prefix}-city-label`}>{t('shopCity')}</strong><HelpTip label={t('explainVienna')}>{t('viennaHelp')}</HelpTip></div><span className={styles.cityValue} id={`${prefix}-city`} tabIndex={-1} aria-labelledby={`${prefix}-city-label`} aria-describedby={error(`${prefix}-city`) ? `${prefix}-city-error` : undefined}>Wien</span></div>
        {['postal', 'city'].map(suffix => error(`${prefix}-${suffix}`) && <p key={suffix} className={styles.error} id={`${prefix}-${suffix}-error`} role={announceErrors ? 'alert' : undefined}>{error(`${prefix}-${suffix}`)}</p>)}
      </div>
    </div></fieldset>}
  </>
}
