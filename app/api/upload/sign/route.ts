import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { BUCKET, makeKey, publicUrlForKey } from "@/lib/storage-bucket"

export const dynamic = "force-dynamic"

const KIND_PREFIX: Record<string, string> = {
  image: "images",
  audio: "audios",
  file: "files",
}

// Issues a short-lived signed upload URL so the browser can PUT the file
// directly to Supabase Storage. This bypasses Vercel's 4.5MB body limit
// on the serverless function that would otherwise proxy the bytes.
export async function POST(req: NextRequest) {
  try {
    const { filename, kind } = await req.json()
    const prefix = KIND_PREFIX[kind as string] || "files"
    const key = makeKey(prefix, filename)

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(key)

    if (error || !data) {
      console.error("[upload-sign]", error)
      return NextResponse.json(
        { error: error?.message || "Falha ao assinar upload" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      bucket: BUCKET,
      key,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: publicUrlForKey(key),
    })
  } catch (err: any) {
    console.error("[upload-sign]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
