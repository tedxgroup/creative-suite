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
    const promptText = `You are refining a VEO 3.1 video prompt for an 8-second clip. The prompt follows Google VEO 3 best practice: STRUCTURED JSON, not plain text.

CURRENT PROMPT:
${clip.prompt}

CURRENT DIALOGUE:
${clip.dialogue || "(none)"}

USER REQUEST:
${message}

SCHEMA for the prompt JSON object:
{
  "shot": {
    "type": "static | slow_zoom_in | slow_zoom_out | slight_push_in | handheld_slight",
    "framing": "vertical 9:16, medium close-up"
  },
  "subject": {
    "action": "concrete mechanical action with measurements",
    "expression": "single adjective",
    "posture": "optional — omit if not needed"
  },
  "interaction": "optional — object interaction or omit",
  "environment": "ambient lighting/particle detail",
  "dialogue": {
    "speaker_voice": "male voice | female voice",
    "delivery": "tone + pacing",
    "text": "the COMPLETE dialogue"
  },
  "audio": { "voice_only": true, "ambient": "optional" },
  "negatives": ["subtitles","text overlay","background music","sound effects","graphic overlays","motion graphics","on-screen text","logos","arrows","icons"]
}

RULES:
- Keep the JSON schema above — update only the fields the user asked
- Use concrete mechanical verbs with measurements (cm, degrees) in subject.action
- Do NOT describe what's already visible in the image
- Each scene's dialogue.text should fit ~8 seconds (15-25 words max)
- negatives must always include the full list

IMPORTANT: If the dialogue exceeds 25 words after your edits, split into two scenes.

Return ONLY a JSON object (no markdown):
{
  "prompt": { ...the structured JSON prompt object as specified above... },
  "dialogue": "the dialogue text for this scene (matches prompt.dialogue.text)",
  "newScene": null or {
    "prompt": { ...structured JSON for overflow scene... },
    "dialogue": "overflow dialogue"
  }
}

Return ONLY the JSON object, no markdown, no explanation.`

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

    // Stringify JSON prompts coming from Claude (passed as strings to VEO)
    const toStr = (p: unknown) =>
      typeof p === "string" ? p : JSON.stringify(p, null, 2)

    // Update current clip
    const updatedClip = await updateClip(clipId, {
      prompt: toStr(result.prompt),
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
        prompt: toStr(result.newScene.prompt),
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
