import { photoType } from '../lib/photoValidation'

// The ten reference photos belong to the numbered stock seeded in v3.1.
const seedPhotos = import.meta.glob<string>('../assets/market-stock/*.jpg', {
  eager: true, query: '?url', import: 'default',
})

export function seedMarketPhoto(id: string): string | undefined {
  return seedPhotos[`../assets/market-stock/${id}.jpg`]
}

export async function prepareMarketPhoto(file: File): Promise<Blob> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.')

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
    const factor = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare the photo. Try again.')
    context.fillStyle = 'white'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!jpeg || jpeg.size > 1024 * 1024) throw new Error('Choose a smaller photo.')
    return jpeg
  } finally {
    URL.revokeObjectURL(url)
  }
}
