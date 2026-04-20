import { NextRequest, NextResponse } from "next/server"
import { fetchClip, createClip, loadProject, updateClip } from "@/lib/db"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ id: string; clipId: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, clipId } = await params
  const project = await loadProject(id)
  if (!project)
    return NextResponse.json(
      { error: "Projeto não encontrado" },
      { status: 404 }
    )
  const original = await fetchClip(clipId)
  if (!original)
    return NextResponse.json(
      { error: "Clip não encontrado" },
      { status: 404 }
    )

  // Shift orders of clips after this one
  const after = project.clips.filter((c) => c.order > original.order)
  await Promise.all(
    after.map((c) => updateClip(c.id, { order: c.order + 1 }))
  )

  const newClip = await createClip({
    projectId: id,
    model: original.model || "veo3",
    imageUrl: original.imageUrl,
    audioUrl: original.audioUrl || null,
    prompt: original.prompt,
    dialogue: original.dialogue || null,
    order: original.order + 1,
  })

  return NextResponse.json(newClip)
}
