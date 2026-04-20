// Auto-archive generated videos to Supabase Storage once status flips to success.
import {
  uploadToStorage,
  makeKey,
  isStorageUrl,
} from "./storage-bucket"
import type { VideoClip } from "./types"

/**
 * Download a video from a temporary provider URL and upload to storage.
 * Returns the new permanent URL, or null if archival was skipped.
 */
export async function archiveVideoToS3(
  clip: VideoClip
): Promise<string | null> {
  if (!clip.videoUrl) return null

  // Skip if already on storage (idempotency)
  if (isStorageUrl(clip.videoUrl)) return clip.videoUrl

  try {
    console.log(`[archive] downloading ${clip.id} → storage`)
    const resp = await fetch(clip.videoUrl)
    if (!resp.ok) {
      console.warn(`[archive] fetch failed ${resp.status} for ${clip.id}`)
      return null
    }
    const buffer = Buffer.from(await resp.arrayBuffer())
    const key = makeKey("videos", `${clip.id}.mp4`)
    const { url } = await uploadToStorage({
      key,
      body: buffer,
      contentType: "video/mp4",
    })
    console.log(`[archive] saved ${clip.id} → ${url}`)
    return url
  } catch (err: any) {
    console.error(`[archive] failed for ${clip.id}:`, err.message)
    return null
  }
}
