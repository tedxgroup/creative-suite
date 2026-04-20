// Object storage backed by Supabase Storage.
// Drop-in replacement for the previous S3 helpers — same API surface.

import { supabaseAdmin } from "./supabase/server"

export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "assets"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const publicBase = `${supabaseUrl}/storage/v1/object/public/${BUCKET}`

export interface UploadOptions {
  key: string
  body: Buffer | Uint8Array | Blob
  contentType?: string
  cacheControl?: string
  /** If true, upsert (overwrite existing). */
  upsert?: boolean
}

export async function uploadToStorage({
  key,
  body,
  contentType = "application/octet-stream",
  cacheControl = "31536000",
  upsert = false,
}: UploadOptions): Promise<{ key: string; url: string }> {
  const blob =
    body instanceof Blob
      ? body
      : new Blob([new Uint8Array(body as Buffer)], { type: contentType })

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(key, blob, {
      contentType,
      cacheControl,
      upsert,
    })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return { key, url: publicUrlForKey(key) }
}

export async function deleteFromStorage(key: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([key])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

export function publicUrlForKey(key: string): string {
  return `${publicBase}/${key}`
}

export function makeKey(prefix: string, originalName?: string): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const ext = originalName
    ? (originalName.split(".").pop() || "bin").split("?")[0]
    : "bin"
  return `${prefix}/${ts}-${rand}.${ext}`
}

/** Detect if a URL is already on our storage (for idempotency). */
export function isStorageUrl(url: string): boolean {
  return url.startsWith(publicBase)
}
