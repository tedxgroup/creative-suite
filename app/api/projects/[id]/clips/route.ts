import { NextRequest, NextResponse } from "next/server"
import { createClip, loadProject } from "@/lib/db"
import type { ClipModel } from "@/lib/types"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await loadProject(id)
  if (!project)
    return NextResponse.json(
      { error: "Projeto não encontrado" },
      { status: 404 }
    )

  const { imageUrl, prompt, order, dialogue, audioUrl, model } = await req.json()
  const clipModel: ClipModel = model === "infinitetalk" ? "infinitetalk" : "veo3"

  if (clipModel === "infinitetalk") {
    if (!imageUrl || !audioUrl)
      return NextResponse.json(
        { error: "Imagem e áudio são obrigatórios" },
        { status: 400 }
      )
  } else {
    if (!prompt)
      return NextResponse.json(
        { error: "Prompt é obrigatório" },
        { status: 400 }
      )
  }

  try {
    const clip = await createClip({
      projectId: id,
      model: clipModel,
      imageUrl: imageUrl || null,
      audioUrl: audioUrl || null,
      prompt: prompt || "",
      dialogue: dialogue || null,
      order,
    })
    return NextResponse.json(clip)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
