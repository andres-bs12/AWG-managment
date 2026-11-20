import type { ReactNode } from 'react'
import styles from './OrderTimeline.module.css'

export type TimelineIcon = 'check' | 'paint' | 'parcel' | 'stall'
export type TimelineStep = { icon: TimelineIcon; title: string; state: 'done' | 'current' | 'upcoming'; detail?: ReactNode }

// 24-unit viewBox, 2-unit rounded stroke, currentColor (docs/design-system.md I1).
const ICONS: Record<TimelineIcon, ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  paint: <><path d="m18.37 2.63 -4.37 4.37-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" /><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" /><path d="M14.5 17.5 4.5 15" /></>,
  parcel: <><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
  stall: <><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" /><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" /><path d="M2 7h20" /><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" /></>,
}

/** Vertical timeline: an icon per step, the title on one line and the detail on its own line below. */
export function OrderTimeline({ steps, doneLabel }: { steps: TimelineStep[]; doneLabel: string }) {
  return <ol className={styles.timeline}>{steps.map((step, index) => (
    <li key={index} className={styles.step} data-state={step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
      <span className={styles.marker} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{ICONS[step.icon]}</svg></span>
      <span className={styles.body}>
        <strong className={styles.title}>{step.title}{step.state === 'done' && <span className="visually-hidden"> ({doneLabel})</span>}</strong>
        {step.detail && <span className={styles.detail}>{step.detail}</span>}
      </span>
    </li>
  ))}</ol>
}
