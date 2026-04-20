import { NextRequest, NextResponse } from "next/server"
import { fetchClip, updateClip, createClip, loadProject } from "@/lib/db"
import { callAIWithFallback } from "@/lib/ai"
import { prepareImage } from "@/lib/imageHelpers"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 120

interface Params {
  params: Promise<{ id: string; clipId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY)
    return NextResponse.json(
      { error: "Nenhuma API key configurada" },
      { status: 500 }
    )

  const { id, clipId } = await params
  const project = await loadProject(id)
  if (!project)
    return NextResponse.json(
      { error: "Projeto não encontrado" },
      { status: 404 }
    )
  const clip = project.clips.find((c) => c.id === clipId)
  if (!clip)
    return NextResponse.json(
      { error: "Clip não encontrado" },
      { status: 404 }
    )

  const { message } = await req.json()
  if (!message)
    return NextResponse.json(
      { error: "Mensagem é obrigatória" },
      { status: 400 }
    )

  try {
    const imageBase64 = await prepareImage(clip.imageUrl)
    const promptText = `You are refining a VEO 3.1 video prompt for an 8-second clip. Here is the current state:

CURRENT PROMPT:
${clip.prompt}

CURRENT DIALOGUE:
${clip.dialogue || "(none)"}

USER REQUEST:
${message}

RULES:
- Follow VEO 3.1 prompt structure: [CAMERA] + [MECHANICAL BODY ACTION] + [DIALOGUE with colon] + [AUDIO] + (no subtitles, no text overlay, no background music, no sound effects, no graphic elements)
- Do NOT describe what's already visible in the image
- Use concrete mechanical verbs with measurements (cm, degrees)
- Dialogue uses colon, never quotes
- Each scene's dialogue should fit in ~8 seconds (15-25 words max)
- Prompt should be 100-150 words

IMPORTANT: If the dialogue exceeds 25 words, you MUST split it into two scenes. Return the second scene separately.

Return ONLY a JSON object (no markdown):
{
  "prompt": "the updated full VEO 3.1 prompt for this scene",
  "dialogue": "the dialogue text for this scene",
  "newScene": null or { "prompt": "prompt for overflow", "dialogue": "overflow dialogue" }
}`

    const claudeContent: any[] = []
    if (imageBase64) {
      claudeContent.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: imageBase64 },
      })
    }
    claudeContent.push({ type: "text", text: promptText })

    const openaiContent: any[] = []
    if (imageBase64) {
      openaiContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
      })
    }
    openaiContent.push({ type: "text", text: promptText })

    const text = await callAIWithFallback({
      claudeContent,
      openaiContent,
      maxTokens: 2000,
    })

    let result
    try {
      const jsonStr = text
        .replace(/^```json?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim()
      result = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: "Falha ao interpretar resposta", raw: text },
        { status: 500 }
      )
    }

    // Update current clip
    const updatedClip = await updateClip(clipId, {
      prompt: result.prompt,
      dialogue: result.dialogue,
      status: "pending",
      taskId: null,
      videoUrl: null,
      error: null,
      regenerated: true,
    })

    let newClipCreated: string | null = null
    if (result.newScene) {
      // Shift orders after current clip
      const after = project.clips.filter((c) => c.order > clip.order)
      await Promise.all(
        after.map((c) => updateClip(c.id, { order: c.order + 1 }))
      )
      const newClip = await createClip({
        projectId: id,
        model: clip.model || "veo3",
        imageUrl: clip.imageUrl,
        prompt: result.newScene.prompt,
        dialogue: result.newScene.dialogue,
        order: clip.order + 1,
      })
      newClipCreated = newClip.id
    }

    const updatedProject = await loadProject(id)
    return NextResponse.json({
      clip: updatedClip,
      newClipId: newClipCreated,
      project: updatedProject,
    })
  } catch (err: any) {
    console.error("[clip-chat]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
