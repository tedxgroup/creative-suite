// Upload a file directly from the browser to Supabase Storage via a
// short-lived signed URL. Bypasses the Vercel 4.5MB body limit — the
// file bytes never pass through our serverless function.

import { supabaseBrowser } from "@/lib/supabase/client"

export type UploadKind = "image" | "audio" | "file"

export interface DirectUploadResult {
  url: string
  key: string
}

export async function uploadDirect(
  file: File,
  kind: UploadKind = "file"
): Promise<DirectUploadResult> {
  // 1. Ask server for a signed upload URL (tiny request — just filename)
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, kind }),
  })
  const sign = await signRes.json().catch(() => ({}))
  if (!signRes.ok || !sign.signedUrl) {
    throw new Error(sign.error || `Falha ao assinar upload (${signRes.status})`)
  }

  // 2. Browser uploads directly to Supabase Storage using the signed token
  const { error } = await supabaseBrowser.storage
    .from(sign.bucket)
    .uploadToSignedUrl(sign.key, sign.token, file, {
      contentType: file.type || "application/octet-stream",
    })
  if (error) throw new Error(error.message)

  return { url: sign.publicUrl, key: sign.key }
}
