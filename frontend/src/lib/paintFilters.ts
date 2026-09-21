export const PAINT_FILTERS = [
  { id: 'color', label: 'Color', hint: 'Original photo' },
  { id: 'bw', label: 'B&W', hint: 'Black and white values' },
  { id: 'ink', label: 'Ink', hint: 'High-contrast drawing' },
  { id: 'lines', label: 'Lines', hint: 'Outline for painting' },
  { id: 'poster', label: 'Poster', hint: 'Big value shapes' },
  { id: 'soft', label: 'Soft', hint: 'Squint / block-in' },
] as const

export type PaintFilter = (typeof PAINT_FILTERS)[number]['id']

const MAX_EDGE = 2000

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n
}

function desaturate(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const y = luma(data[i], data[i + 1], data[i + 2])
    data[i] = y
    data[i + 1] = y
    data[i + 2] = y
  }
}

function contrastCurve(data: Uint8ClampedArray, gain: number, pivot = 0.46) {
  for (let i = 0; i < data.length; i += 4) {
    const y = luma(data[i], data[i + 1], data[i + 2]) / 255
    const t = (y - pivot) * gain + pivot
    const v = clampByte(t * 255)
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
}

function posterize(data: Uint8ClampedArray, levels: number) {
  const step = 255 / (levels - 1)
  for (let i = 0; i < data.length; i += 4) {
    const y = luma(data[i], data[i + 1], data[i + 2])
    const v = Math.round(y / step) * step
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
}

function boxBlur(data: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const tmp = new Uint8ClampedArray(data.length)
  const out = new Uint8ClampedArray(data.length)
  const pass = (
    src: Uint8ClampedArray,
    dst: Uint8ClampedArray,
    horizontal: boolean,
  ) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0
        let g = 0
        let b = 0
        let n = 0
        for (let k = -radius; k <= radius; k++) {
          const xx = horizontal ? Math.min(w - 1, Math.max(0, x + k)) : x
          const yy = horizontal ? y : Math.min(h - 1, Math.max(0, y + k))
          const i = (yy * w + xx) * 4
          r += src[i]
          g += src[i + 1]
          b += src[i + 2]
          n += 1
        }
        const o = (y * w + x) * 4
        dst[o] = r / n
        dst[o + 1] = g / n
        dst[o + 2] = b / n
        dst[o + 3] = 255
      }
    }
  }
  pass(data, tmp, true)
  pass(tmp, out, false)
  return out
}

function drawingLines(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const gray = new Float32Array(w * h)
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    gray[p] = luma(src[i], src[i + 1], src[i + 2])
  }
  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        const lifted = gray[y * w + x] * 0.38 + 148
        out[o] = lifted
        out[o + 1] = lifted
        out[o + 2] = lifted
        out[o + 3] = 255
        continue
      }
      const i = y * w + x
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1]
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1]
      const mag = Math.sqrt(gx * gx + gy * gy)
      const lifted = gray[i] * 0.36 + 150
      const edge = mag > 28 ? Math.max(0, 255 - mag * 1.05) : 255
      const v = Math.min(lifted, edge)
      out[o] = v
      out[o + 1] = v
      out[o + 2] = v
      out[o + 3] = 255
    }
  }
  return out
}

export function cssFallbackFilter(filter: PaintFilter): string {
  switch (filter) {
    case 'color':
      return 'none'
    case 'bw':
      return 'grayscale(1)'
    case 'ink':
      return 'grayscale(1) contrast(2.35) brightness(1.06)'
    case 'lines':
      return 'grayscale(1) contrast(1.85) brightness(1.12)'
    case 'poster':
      return 'grayscale(1) contrast(1.55) brightness(1.05)'
    case 'soft':
      return 'grayscale(0.55) blur(2.4px) contrast(0.92) brightness(1.04)'
  }
}

export function loadPaintImage(src: string): Promise<{ image: HTMLImageElement; cors: boolean }> {
  const load = (cors: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      if (cors) image.crossOrigin = 'anonymous'
      image.decoding = 'async'
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not load photo'))
      image.src = src
    })

  return load(true)
    .then((image) => ({ image, cors: true }))
    .catch(() => load(false).then((image) => ({ image, cors: false })))
}

export function rasterizePhoto(image: HTMLImageElement): {
  width: number
  height: number
  pixels: Uint8ClampedArray | null
} {
  const nw = image.naturalWidth || image.width
  const nh = image.naturalHeight || image.height
  const scale = Math.min(1, MAX_EDGE / Math.max(nw, nh))
  const width = Math.max(1, Math.round(nw * scale))
  const height = Math.max(1, Math.round(nh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { width, height, pixels: null }
  ctx.drawImage(image, 0, 0, width, height)
  try {
    return { width, height, pixels: new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data) }
  } catch {
    return { width, height, pixels: null }
  }
}

function toImageData(data: Uint8ClampedArray, width: number, height: number): ImageData {
  const image = new ImageData(width, height)
  image.data.set(data)
  return image
}

export function applyPaintFilter(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  filter: PaintFilter,
): ImageData {
  if (filter === 'lines') return toImageData(drawingLines(source, width, height), width, height)
  if (filter === 'soft') {
    const blurred = boxBlur(source, width, height, 7)
    desaturate(blurred)
    return toImageData(blurred, width, height)
  }

  const copy = new Uint8ClampedArray(source)
  if (filter === 'bw') desaturate(copy)
  if (filter === 'ink') contrastCurve(copy, 3.2)
  if (filter === 'poster') posterize(copy, 4)
  return toImageData(copy, width, height)
}
