import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../ui/Button'
import { StaffDialog } from './StaffDialog'

/** A new tab shares localStorage, so explicitly end the staff session before handing over. */
export function CustomerHandoff({ token, label = 'Open customer form' }: { token: string; label?: string }) {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  return <>
    <Button tone="staff" variant="secondary" onClick={() => setOpen(true)}>{label}</Button>
    {open && <StaffDialog title="Hand iPad to customer?" onClose={() => setOpen(false)}>
      <p>This signs staff out before opening the customer form. Going back cannot open staff tools. Sign in again when the iPad is returned. The order is already saved.</p>
      <Button tone="staff" variant="secondary" onClick={() => setOpen(false)}>Keep iPad</Button>
      <Button tone="staff" onClick={() => { void logout(); window.location.replace(`/form/${encodeURIComponent(token)}`) }}>Sign out & open form</Button>
    </StaffDialog>}
  </>
}
