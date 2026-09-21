import { useMemo, type CSSProperties } from 'react'
import styles from './Snowfield.module.css'

type Props = {
  density?: 'full' | 'low'
}

export function Snowfield({ density = 'full' }: Props) {
  const flakes = useMemo(() => {
    const n = density === 'full' ? 28 : 10
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      left: `${(i * 37) % 100}%`,
      delay: `${(i * 0.37) % 8}s`,
      duration: `${9 + (i % 7)}s`,
      size: 3 + (i % 4),
      /** Where this flake parks when the visitor asked for reduced motion. */
      drop: `${12 + ((i * 31) % 86)}vh`,
    }))
  }, [density])

  return (
    <div className={`${styles.layer} ${density === 'low' ? styles.low : ''}`} aria-hidden="true">
      {flakes.map((f) => (
        <span
          key={f.id}
          className={styles.flake}
          style={
            {
              left: f.left,
              animationDelay: f.delay,
              animationDuration: f.duration,
              width: f.size,
              height: f.size,
              '--drop': f.drop,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
