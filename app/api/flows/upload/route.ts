import { NextRequest, NextResponse } from "next/server"
import { makeKey, uploadToStorage } from "@/lib/storage-bucket"
import { createReferenceAsset } from "@/features/nano-flow/lib/db"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")
    if (!(file instanceof File))
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })

    if (!file.type.startsWith("image/"))
      return NextResponse.json(
        { error: "Somente imagens são aceitas" },
        { status: 400 }
      )
    if (file.size > MAX_BYTES)
      return NextResponse.json(
        { error: "Imagem acima de 10MB" },
        { status: 400 }
      )

    const buffer = Buffer.from(await file.arrayBuffer())
    const key = makeKey("flow-refs", file.name)
    const { url } = await uploadToStorage({
      key,
      body: buffer,
      contentType: file.type || "image/png",
    })

    const asset = await createReferenceAsset({
      url,
      storageKey: key,
      mimeType: file.type || "image/png",
      sizeBytes: file.size,
    })

    return NextResponse.json({ url: asset.url, referenceAssetId: asset.id })
  } catch (err: any) {
    console.error("[flows/upload]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
