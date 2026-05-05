import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/server"
import { BUCKET, makeKey, publicUrlForKey } from "@/lib/storage-bucket"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { filename } = (await req.json()) as { filename?: string }
    const key = makeKey("flow-refs", filename)

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(key)

    if (error || !data)
      throw new Error(error?.message || "Falha ao assinar upload")

    return NextResponse.json({
      key,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: publicUrlForKey(key),
    })
  } catch (err: any) {
    console.error("[flows/upload/sign]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
