import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import styles from './QrCode.module.css'

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!value) {
      setSrc('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(value, {
      width: Math.max(size, 720),
      margin: 1,
      color: { dark: '#1c1914', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!src) {
    return <div className={styles.placeholder} style={{ width: Math.max(size, 720), height: size }} aria-hidden />
  }

  return <>
    <button type="button" className={styles.expand} onClick={() => dialog.current?.showModal()} aria-label="Enlarge customer QR code">
      <img className={styles.img} src={src} alt="QR code for the customer form" width={size} height={size} />
      <span>Tap to enlarge</span>
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-label="Customer form QR code">
      <form method="dialog"><button className={styles.close} autoFocus>Close ×</button></form>
      <h2>Scan to personalise your ornament</h2>
      <img src={src} alt="QR code for the customer form" />
    </dialog>
  </>
}
