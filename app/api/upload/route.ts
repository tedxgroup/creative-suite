import { NextRequest, NextResponse } from "next/server"
import { uploadToStorage, makeKey } from "@/lib/storage-bucket"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const KIND_PREFIX: Record<string, string> = {
  image: "images",
  audio: "audios",
  file: "files",
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  let file: File | null = null
  let kind = "file"
  for (const k of ["image", "audio", "file"]) {
    const f = formData.get(k)
    if (f instanceof File) {
      file = f
      kind = k
      break
    }
  }

  if (!file)
    return NextResponse.json(
      { error: "Nenhum arquivo enviado" },
      { status: 400 }
    )

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const prefix = KIND_PREFIX[kind] || "files"
    const key = makeKey(prefix, file.name)
    const { url } = await uploadToStorage({
      key,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    })
    return NextResponse.json({ url, key })
  } catch (err: any) {
    console.error("[upload]", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
