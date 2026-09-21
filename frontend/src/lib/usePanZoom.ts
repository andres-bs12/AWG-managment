import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const MIN_REL = 1
const MAX_REL = 12
const ZOOM_STEP = 1.28

type View = {
  x: number
  y: number
  scale: number
  fit: number
  cw: number
  ch: number
}

type Pointer = { x: number; y: number }

type Args = {
  stageRef: RefObject<HTMLElement | null>
  layerRef: RefObject<HTMLElement | null>
  width: number
  height: number
  resetKey: string | number
}

function distance(a: Pointer, b: Pointer) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function midpoint(a: Pointer, b: Pointer): Pointer {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function usePanZoom({ stageRef, layerRef, width, height, resetKey }: Args) {
  const view = useRef<View>({ x: 0, y: 0, scale: 1, fit: 1, cw: 0, ch: 0 })
  const pointers = useRef(new Map<number, Pointer>())
  const pinch = useRef<{ dist: number; mid: Pointer } | null>(null)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)
  const [percent, setPercent] = useState(100)
  const lastPercent = useRef(100)

  const apply = useCallback(() => {
    const layer = layerRef.current
    const v = view.current
    if (layer) {
      layer.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`
    }
    const next = Math.round((v.scale / Math.max(v.fit, 0.0001)) * 100)
    if (next !== lastPercent.current) {
      lastPercent.current = next
      setPercent(next)
    }
  }, [layerRef])

  const clamp = useCallback(() => {
    const stage = stageRef.current
    const v = view.current
    if (!stage || !v.cw || !v.ch) return
    const vw = stage.clientWidth
    const vh = stage.clientHeight
    const w = v.cw * v.scale
    const h = v.ch * v.scale
    if (w <= vw) v.x = (vw - w) / 2
    else v.x = Math.min(0, Math.max(vw - w, v.x))
    if (h <= vh) v.y = (vh - h) / 2
    else v.y = Math.min(0, Math.max(vh - h, v.y))
  }, [stageRef])

  const fitScale = useCallback(() => {
    const stage = stageRef.current
    const v = view.current
    if (!stage || !v.cw || !v.ch) return 1
    const vw = stage.clientWidth
    const vh = stage.clientHeight
    if (!vw || !vh) return 1
    return Math.min(vw / v.cw, vh / v.ch)
  }, [stageRef])

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = view.current
      const min = v.fit * MIN_REL
      const max = v.fit * MAX_REL
      const next = Math.min(max, Math.max(min, v.scale * factor))
      const k = next / v.scale
      v.x = cx - (cx - v.x) * k
      v.y = cy - (cy - v.y) * k
      v.scale = next
      clamp()
      apply()
    },
    [apply, clamp],
  )

  const fit = useCallback(() => {
    const v = view.current
    v.fit = fitScale()
    v.scale = v.fit
    clamp()
    apply()
  }, [apply, clamp, fitScale])

  const setRelative = useCallback(
    (rel: number) => {
      const stage = stageRef.current
      const v = view.current
      if (!stage) return
      const target = v.fit * Math.min(MAX_REL, Math.max(MIN_REL, rel))
      const cx = stage.clientWidth / 2
      const cy = stage.clientHeight / 2
      zoomAt(target / v.scale, cx, cy)
    },
    [stageRef, zoomAt],
  )

  const zoomIn = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    zoomAt(ZOOM_STEP, stage.clientWidth / 2, stage.clientHeight / 2)
  }, [stageRef, zoomAt])

  const zoomOut = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    zoomAt(1 / ZOOM_STEP, stage.clientWidth / 2, stage.clientHeight / 2)
  }, [stageRef, zoomAt])

  useEffect(() => {
    view.current.cw = width
    view.current.ch = height
    if (width && height) fit()
  }, [width, height, resetKey, fit])

  useEffect(() => {
    const stage = stageRef.current
    const layer = layerRef.current
    if (!stage || !layer) return

    layer.style.transformOrigin = '0 0'

    const local = (e: PointerEvent): Pointer => {
      const rect = stage.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      stage.setPointerCapture(e.pointerId)
      pointers.current.set(e.pointerId, local(e))
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        pinch.current = { dist: distance(a, b), mid: midpoint(a, b) }
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return
      const next = local(e)
      const prev = pointers.current.get(e.pointerId)
      pointers.current.set(e.pointerId, next)
      if (!prev) return

      if (pointers.current.size >= 2 && pinch.current) {
        const pts = [...pointers.current.values()]
        const a = pts[0]
        const b = pts[1]
        const dist = distance(a, b)
        const mid = midpoint(a, b)
        const factor = dist / Math.max(pinch.current.dist, 1)
        const v = view.current
        v.x += mid.x - pinch.current.mid.x
        v.y += mid.y - pinch.current.mid.y
        pinch.current = { dist, mid }
        zoomAt(factor, mid.x, mid.y)
        return
      }

      if (pointers.current.size === 1) {
        view.current.x += next.x - prev.x
        view.current.y += next.y - prev.y
        clamp()
        apply()
      }
    }

    const onUp = (e: PointerEvent) => {
      const pos = pointers.current.get(e.pointerId)
      pointers.current.delete(e.pointerId)
      if (pointers.current.size < 2) pinch.current = null
      if (e.type !== 'pointerup' || !pos || pointers.current.size > 0) return

      const now = performance.now()
      const prevTap = lastTap.current
      lastTap.current = { t: now, x: pos.x, y: pos.y }
      if (
        prevTap &&
        now - prevTap.t < 280 &&
        Math.hypot(pos.x - prevTap.x, pos.y - prevTap.y) < 28
      ) {
        lastTap.current = null
        const v = view.current
        const rel = v.scale / v.fit
        if (rel > 1.15) fit()
        else zoomAt(3.4 / rel, pos.x, pos.y)
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = stage.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.0018)
      zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top)
    }

    const onResize = () => {
      const v = view.current
      const stageEl = stage
      const oldScale = v.scale
      const oldFit = v.fit
      const rel = oldScale / Math.max(oldFit, 0.0001)
      const cx = stageEl.clientWidth / 2
      const cy = stageEl.clientHeight / 2
      const imgX = (cx - v.x) / oldScale
      const imgY = (cy - v.y) / oldScale
      v.fit = fitScale()
      v.scale = v.fit * Math.min(MAX_REL, Math.max(MIN_REL, rel))
      v.x = cx - imgX * v.scale
      v.y = cy - imgY * v.scale
      clamp()
      apply()
    }

    stage.addEventListener('pointerdown', onDown)
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerup', onUp)
    stage.addEventListener('pointercancel', onUp)
    stage.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(onResize)
    ro.observe(stage)

    return () => {
      stage.removeEventListener('pointerdown', onDown)
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerup', onUp)
      stage.removeEventListener('pointercancel', onUp)
      stage.removeEventListener('wheel', onWheel)
      ro.disconnect()
    }
  }, [apply, clamp, fit, fitScale, layerRef, stageRef, width, height, zoomAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0' || e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        fit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fit, zoomIn, zoomOut])

  return { percent, minPercent: 100, maxPercent: MAX_REL * 100, zoomIn, zoomOut, fit, setRelative }
}
