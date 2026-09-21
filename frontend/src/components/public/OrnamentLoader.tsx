import styles from './OrnamentLoader.module.css'

export function OrnamentLoader() {
  return (
    <div className={styles.row} role="status" aria-live="polite">
      <span className={styles.ornament} />
      <span className={styles.brush} />
    </div>
  )
}
