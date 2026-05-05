import { NextRequest, NextResponse } from "next/server"
import { publicUrlForKey } from "@/lib/storage-bucket"
import { createReferenceAsset } from "@/features/nano-flow/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { key, mimeType, sizeBytes } = (await req.json()) as {
      key?: string
      mimeType?: string
      sizeBytes?: number
    }
    if (!key) throw new Error("key ausente")

    const url = publicUrlForKey(key)
    const asset = await createReferenceAsset({
      url,
      storageKey: key,
      mimeType: mimeType || "application/octet-stream",
      sizeBytes: sizeBytes ?? 0,
    })

    return NextResponse.json({ url: asset.url, referenceAssetId: asset.id })
  } catch (err: any) {
    console.error("[flows/upload/commit]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
