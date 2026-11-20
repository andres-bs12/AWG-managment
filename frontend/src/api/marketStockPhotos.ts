import { photoType } from '../lib/photoValidation'

// The ten reference photos belong to the numbered stock seeded in v3.1.
const seedPhotos = import.meta.glob<string>('../assets/market-stock/*.jpg', {
  eager: true, query: '?url', import: 'default',
})

export function seedMarketPhoto(id: string): string | undefined {
  return seedPhotos[`../assets/market-stock/${id}.jpg`]
}

export async function prepareMarketPhoto(file: File): Promise<Blob> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a photo of 25 MB or less.')

  const type = photoType(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
  if (!type) throw new Error('Choose a JPEG, PNG, WebP or HEIC photo.')
  const url = URL.createObjectURL(file.slice(0, file.size, type))
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new Error(type === 'image/heic'
        ? 'This browser cannot open the HEIC photo. Choose a JPEG copy.'
        : 'This photo could not be opened. Try a different file.')
    }
    const factor = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the photo. Try again.')
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
    if (!jpeg) throw new Error('Could not prepare the photo. Try again.')
    if (jpeg.size > 5 * 1024 * 1024) throw new Error('The prepared photo exceeds 5 MB. Choose a smaller photo.')
    return jpeg
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Downscale a full-size uploaded ornament photo to a compact object URL for picker and card thumbnails. */
export async function createMarketThumbnailUrl(
  sourceUrl: string,
  maxSide = 480,
): Promise<{ url: string; isObjectUrl: boolean }> {
  try {
    const image = new Image()
    image.src = sourceUrl
    await image.decode()
    const longest = Math.max(image.naturalWidth, image.naturalHeight)
    if (!longest || (longest <= maxSide && sourceUrl.length <= 64 * 1024)) {
      return { url: sourceUrl, isObjectUrl: false }
    }
    const factor = Math.min(1, maxSide / longest)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor))
    const context = canvas.getContext('2d')
    if (!context) return { url: sourceUrl, isObjectUrl: false }
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) return { url: sourceUrl, isObjectUrl: false }
    return { url: URL.createObjectURL(blob), isObjectUrl: true }
  } catch {
    return { url: sourceUrl, isObjectUrl: false }
  }
}
