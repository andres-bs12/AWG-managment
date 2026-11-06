/** WCAG sRGB contrast for opaque CSS colours. Translucent colours need compositing. */
export function contrastRatio(foreground, background) {
  function luminance(value) {
    let channels
    if (/^#[\da-f]{6}$/i.test(value)) channels = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16))
    else if (/^#[\da-f]{3}$/i.test(value)) channels = [...value.slice(1)].map(channel => parseInt(channel + channel, 16))
    else {
      const match = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i)
      if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) return null
      channels = match.slice(1, 4).map(Number)
    }
    if (channels.some(channel => channel < 0 || channel > 255)) return null
    const linear = channels.map(channel => { const srgb = channel / 255; return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4 })
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  const a = luminance(foreground), b = luminance(background)
  return a === null || b === null ? null : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
