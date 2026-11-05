import type { BuyStepProps } from './shared'
import styles from '../BuyPage.module.css'
import { Field } from '../../../components/ui/Field'

/**
 * Mobile: one column, only PLZ + Ort share a row. From 640px a 6-column grid puts related fields
 * side by side (Name | E-Mail, Straße | Stiege, PLZ | Ort); the fields use subgrid rows, so labels,
 * hints and inputs stay aligned. Two sections with display-font titles so they never look like labels.
 */
export function BuyContactStep({ t, draft, patch, err, described, validateField, validFields }: Pick<BuyStepProps, 't' | 'draft' | 'patch' | 'err' | 'described'> & { validateField: (id: string) => void; validFields: string[] }) {
  return (
    <>
      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>{t('contactHeading')}</legend>
        <div className={styles.formGrid} data-field-grid>
        <Field className={styles.colHalf} label={t('yourName')} htmlFor="buy-name" error={err('buy-name')}>
          <input
            id="buy-name"
            onBlur={() => validateField("buy-name") }
            data-valid={validFields.includes("buy-name") || undefined}
            maxLength={120}
            autoComplete="name"
            value={draft.customerName}
            aria-invalid={!!err('buy-name')}
            aria-describedby={described('buy-name')}
            onChange={(event) => patch({ customerName: event.target.value })}
          />
        </Field>
        <Field className={styles.colHalf} label={t('email')} htmlFor="buy-email" error={err('buy-email')}>
          <input
            id="buy-email"
            onBlur={() => validateField("buy-email") }
            data-valid={validFields.includes("buy-email") || undefined}
            maxLength={200}
            type="email"
            autoComplete="email"
            value={draft.email}
            aria-invalid={!!err('buy-email')}
            aria-describedby={described('buy-email')}
            onChange={(event) => patch({ email: event.target.value })}
          />
        </Field>
        <Field className={styles.colHalf} label={t('phone')} htmlFor="buy-phone" hint={t('phoneHint')} error={err('buy-phone')}>
          <input
            id="buy-phone"
            onBlur={() => validateField("buy-phone") }
            data-valid={validFields.includes("buy-phone") || undefined}
            maxLength={40}
            type="tel"
            autoComplete="tel"
            value={draft.phone}
            aria-invalid={!!err('buy-phone')}
            aria-describedby={described('buy-phone', true)}
            onChange={(event) => patch({ phone: event.target.value })}
          />
        </Field>
        </div>
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.sectionTitle}>{t('addressHeading')}</legend>
        <div className={styles.inset}>
          <p>{t('viennaNotice')}</p>
        </div>
        <div className={styles.formGrid} data-field-grid>
        <Field className={styles.colWide} label={t('shopStreet')} htmlFor="buy-line1" error={err('buy-line1')}>
          <input
            id="buy-line1"
            onBlur={() => validateField("buy-line1") }
            data-valid={validFields.includes("buy-line1") || undefined}
            autoComplete="address-line1"
            value={draft.line1}
            aria-invalid={!!err('buy-line1')}
            aria-describedby={described('buy-line1')}
            onChange={(event) => patch({ line1: event.target.value })}
          />
        </Field>
        <Field className={styles.colNarrow} label={t('shopLine2')} htmlFor="buy-line2" error={err('buy-line2')}>
          <input
            id="buy-line2"
            autoComplete="address-line2"
            value={draft.line2}
            onChange={(event) => patch({ line2: event.target.value })}
          />
        </Field>
          <Field className={styles.colPostal} label={t('shopPostal')} htmlFor="buy-postal" error={err('buy-postal')}>
            <input
              id="buy-postal"
            onBlur={() => validateField("buy-postal") }
            data-valid={validFields.includes("buy-postal") || undefined}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={4}
              value={draft.postalCode}
              aria-invalid={!!err('buy-postal')}
              aria-describedby={described('buy-postal')}
              onChange={(event) => patch({ postalCode: event.target.value.replace(/\D/g, '') })}
            />
          </Field>
          <div className={`${styles.cityField} ${styles.colCity}`}>
            <strong>{t('shopCity')}</strong>
            <span>Wien</span>
          </div>
        </div>
      </fieldset>
    </>
  )
}
