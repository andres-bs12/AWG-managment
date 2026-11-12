/** Small outline icons share the public 24px / 2px stroke vocabulary. */
export function DeliveryIcon({ kind }: { kind: 'vienna' | 'market' | 'date' }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'vienna' ? <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></> : kind === 'market' ? <><path d="m3 9 2-5h14l2 5M3 9h18M5 12v8h14v-8M9 20v-6h6v6M7 4v5m5-5v5m5-5v5" /><path d="M3 9v1a2 2 0 0 0 4 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2 2 0 0 0 4 0V9" /></> : <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-14 5 3 3 7-6" /></>}
  </svg>
}
