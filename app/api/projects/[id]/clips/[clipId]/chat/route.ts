import { NextRequest, NextResponse } from "next/server"
import { updateClip, createClip, loadProject } from "@/lib/db"
import { callAIWithFallback } from "@/lib/ai"
import { prepareImage } from "@/lib/imageHelpers"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 120

interface Params {
  params: Promise<{ id: string; clipId: string }>
}

// Safety net: guarantee the subtitle blocker is present at the end of every prompt.
function enforceTextBlocker(prompt: string): string {
  const trimmed = (prompt || "").trim()
  if (/\(no subtitles,\s*no text overlay\)\s*$/i.test(trimmed)) return trimmed
  const cleaned = trimmed.replace(
    /\(?\s*no\s+subtitles[^)]*\)?\s*$/i,
    ""
  ).trim()
  return `${cleaned} (no subtitles, no text overlay)`
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
    const promptText = `You are refining a VEO 3.1 prompt for an 8-second image-to-video clip.

═══════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════

1. DO NOT DESCRIBE APPEARANCE (clothes, hair, skin, face, setting). The I2V image already provides those pixels — describing them wastes tokens and disperses the model's attention.

2. FRONT-LOAD THE CAMERA. The prompt must START with camera behavior. Default: "Static shot, fixed camera, vertical 9:16" unless the scene requires motion.

3. CONCRETE MECHANICAL VERBS, NEVER EMOTIONAL ONES. Convert emotions into body/face mechanics with measurements. "Urgent" → "brow furrows, leans 5cm forward, jaw tightens." "Confident" → "chest rises, shoulders square, chin lifts 3 degrees."

4. DIALOGUE WITH A COLON, NO QUOTES. Quotation marks activate the text decoder and burn subtitles onto the video. Example: "He speaks clearly: the bacterium that eats your insulin…"

5. EVERY PROMPT MUST END WITH: (no subtitles, no text overlay). The model MUST NOT generate captions, on-screen text, watermarks, or any overlays. This is non-negotiable.

6. 100-150 WORDS.

7. AUDIO BLOCK LAST, separated from visuals. Voice tone + pacing + ambient sound at the end.

8. NEVER INVENT OR EXTEND DIALOGUE. Use only the words the user explicitly wrote (either in the current dialogue or in their chat request below). The ONLY allowed transformation is spelling numerals out ("86" → "eighty six").

═══════════════════════════════════════════════
STRUCTURE
═══════════════════════════════════════════════
[CAMERA] + [BODY MECHANICS] + [OBJECT INTERACTION] + [ENVIRONMENT] + [DIALOGUE with colon] + [AUDIO / VOICE] + (no subtitles, no text overlay)

═══════════════════════════════════════════════
CURRENT STATE
═══════════════════════════════════════════════

CURRENT PROMPT:
${clip.prompt}

CURRENT DIALOGUE:
${clip.dialogue || "(none)"}

USER REQUEST:
${message}

═══════════════════════════════════════════════
RULES FOR THE EDIT
═══════════════════════════════════════════════

• Preserve the prose structure and length (100-150 words).
• Change ONLY what the user asked. Do not rewrite untouched details.
• If the user's request is about emotion, translate it into mechanical facial/body movements.
• If the spoken dialogue exceeds ~25 words (>8 seconds at normal pace), split into two scenes (use newScene for the overflow).
• If the user asks about the spoken line, update it ONLY with words they provided — never invent filler.
• Always end with (no subtitles, no text overlay).

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Return ONLY a JSON object — no markdown, no explanation:

{
  "prompt": "the full prose prompt as ONE string, starting with the camera and ending with (no subtitles, no text overlay)",
  "dialogue": "the scene's spoken words in plain text (must match what appears after the colon in prompt)",
  "newScene": null | {
    "prompt": "...",
    "dialogue": "overflow spoken words"
  }
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

    const toPrompt = (p: unknown): string => {
      const s = typeof p === "string" ? p : JSON.stringify(p)
      return enforceTextBlocker(s)
    }

    // Update current clip
    const updatedClip = await updateClip(clipId, {
      prompt: toPrompt(result.prompt),
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
        prompt: toPrompt(result.newScene.prompt),
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
