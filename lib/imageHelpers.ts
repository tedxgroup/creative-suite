import sharp from "sharp"

/** Fetches an image (URL or relative path) and returns base64 JPEG resized to 1024x1024 */
export async function prepareImage(
  imageUrl: string | null
): Promise<string | null> {
  if (!imageUrl) return null

  let buffer: Buffer
  try {
    if (imageUrl.startsWith("http")) {
      const resp = await fetch(imageUrl)
      if (!resp.ok) return null
      buffer = Buffer.from(await resp.arrayBuffer())
    } else {
      // Legacy: local path (rare; should be migrated)
      const fs = await import("fs")
      const path = await import("path")
      const localPath = path.join(process.cwd(), imageUrl)
      if (!fs.existsSync(localPath)) return null
      buffer = fs.readFileSync(localPath)
    }
  } catch {
    return null
  }

  const resized = await sharp(buffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()
  return resized.toString("base64")
}
