/** The studio's Instagram profile, shared by the public footer and Track. */
export const INSTAGRAM_URL = 'https://www.instagram.com/art_withgab_'

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.1" cy="6.9" r="1.3" fill="currentColor" />
    </svg>
  )
}

/** The studio's contact address, shown next to Instagram on Track. */
export const CONTACT_EMAIL = 'artwithgab@gmail.com'

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="5.5" width="18" height="13" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4 7.5l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
