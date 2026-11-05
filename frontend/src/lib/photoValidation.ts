export function photoType(bytes: Uint8Array): string | null {
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 4 && bytes[0] === 0x89 && text(1, 4) === 'PNG') return 'image/png'
  if (bytes.length >= 12 && text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp'
  if (bytes.length >= 12 && text(4, 8) === 'ftyp' && ['heic', 'heix', 'mif1'].includes(text(8, 12))) return 'image/heic'
  return null
}

export async function validatePhoto(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('PHOTO_TOO_LARGE')
  const type = photoType(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
  if (!type) throw new Error('PHOTO_INVALID')
  return type
}
