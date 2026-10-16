export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Validate, then shrink an image to at most `max` px wide as a JPEG data URL (keeps storage small). */
export async function prepareImage(file: File, max = 900, onProgress?: (pct: number) => void): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Please choose a JPG, PNG or WEBP image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('That image is larger than 5 MB.')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 80))
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('The image could not be read.'))
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('That file is not a readable image.'))
    i.src = dataUrl
  })
  const scale = Math.min(1, max / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  onProgress?.(100)
  return canvas.toDataURL('image/jpeg', 0.82)
}
