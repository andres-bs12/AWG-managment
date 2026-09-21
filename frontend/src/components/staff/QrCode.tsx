import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import styles from './QrCode.module.css'

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!value) {
      setSrc('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(value, {
      width: size,
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
    return <div className={styles.placeholder} style={{ width: size, height: size }} aria-hidden />
  }

  return <img className={styles.img} src={src} alt="QR code for the customer form" width={size} height={size} />
}
