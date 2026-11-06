import type { BuyStepProps } from './shared'
import { ContactFields } from '../../../components/public/ContactFields'

export function BuyContactStep({ draft, patch, err, validateField, validFields, withAddress = true }: Pick<BuyStepProps, 't' | 'draft' | 'patch' | 'err' | 'described'> & { validateField: (id: string) => void; validFields: string[]; withAddress?: boolean }) {
  return <ContactFields prefix="buy" values={draft} onChange={patch} error={err} onBlur={validateField} validFields={validFields} withAddress={withAddress} />
}
