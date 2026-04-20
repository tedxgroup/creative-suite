import { NextRequest, NextResponse } from "next/server"
import { updateClip, deleteClip } from "@/lib/db"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ id: string; clipId: string }>
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { clipId } = await params
  const body = await req.json()

  try {
    const clip = await updateClip(clipId, {
      imageUrl: body.imageUrl,
      prompt: body.prompt,
      order: body.order,
      trimStart: body.trimStart,
      trimEnd: body.trimEnd,
      tagged: body.tagged,
    })
    if (!clip)
      return NextResponse.json(
        { error: "Clip não encontrado" },
        { status: 404 }
      )
    return NextResponse.json(clip)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { clipId } = await params
  try {
    await deleteClip(clipId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
