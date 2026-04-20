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
    const promptText = `You are refining a VEO 3.1 video prompt for an 8-second image-to-video clip.

The prompt MUST use the VEO 3.1 OFFICIAL SCHEMA — only 6 keys, processed as independent computational axes:

{
  "camera": "",
  "description": "",
  "motion": "",
  "audio": "",
  "text": "none, no subtitles, no text overlay, no on-screen text, no watermarks, no logos",
  "ending": ""
}

═══════════════════════════════════════════════
FIELD RULES
═══════════════════════════════════════════════

• camera — shot type + framing + orientation (e.g. "Static shot, fixed camera, vertical 9:16, medium shot, shallow depth of field")

• description — body mechanics + environment TOGETHER. DO NOT describe subject appearance (the I2V image provides it). Use concrete mechanical verbs with measurements (cm, degrees, directions). Convert emotions into facial/body mechanics (e.g. "urgent" → "brow furrows, jaw tightens, leans forward 5cm"). Include locks like "eyes remain locked on the camera lens throughout the entire clip" or "he holds the phone steady in his right hand throughout the entire clip". End with environment/lighting detail.

• motion — ambient physics ONLY (fluids, particles, breathing, steam, micro-movements) — separate from subject action.

• audio — voice + SFX. DIALOGUE goes HERE. NEVER use quotes around speech (triggers subtitles). Use a COLON: "[voice description + pacing]: [the actual words]". CRITICAL: never invent, extend, or pad the dialogue — only use words the user wrote (in the current dialogue or their explicit chat request). SPELL OUT NUMBERS as the ONLY allowed transformation ("86" → "eighty six", "97%" → "ninety seven percent"). End with "No background music" or "No background music, no sound effects". For silent scenes: "No voice, no speech, no music. Soft ambient [specific sound]".

• text — ALWAYS exactly: "none, no subtitles, no text overlay, no on-screen text, no watermarks, no logos"

• ending — final frame state (body position + object state). Vital for continuity between clips.

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

• Keep the 6-key schema exactly — update only the fields the user asked to change
• If the dialogue in "audio" exceeds ~25 words (>8 seconds), you MUST split into two scenes (use newScene)
• If the user's request is about emotion, translate it into mechanical facial/body changes in "description"
• If the user asks about the spoken line, update it ONLY inside "audio" (after the colon, no quotes, numbers spelled out) — and ONLY with words the user explicitly provided; never invent or extend dialogue on your own
• Preserve the "text" field verbatim

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Return ONLY a JSON object (no markdown, no explanation):
{
  "prompt": {
    "camera": "...",
    "description": "...",
    "motion": "...",
    "audio": "...",
    "text": "none, no subtitles, no text overlay, no on-screen text, no watermarks, no logos",
    "ending": "..."
  },
  "dialogue": "the scene's spoken words in plain text (must match what appears after the colon in prompt.audio)",
  "newScene": null | {
    "prompt": { ...same 6-key schema... },
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

    // Normalize to the 6-key VEO schema + force the text blocker verbatim
    const TEXT_BLOCKER =
      "none, no subtitles, no text overlay, no on-screen text, no watermarks, no logos"

    const toStr = (p: unknown) => {
      let obj: any = p
      if (typeof p === "string") {
        try {
          obj = JSON.parse(p)
        } catch {
          return p
        }
      }
      if (!obj || typeof obj !== "object") return ""
      const normalized = {
        camera: obj.camera || "",
        description: obj.description || "",
        motion: obj.motion || "",
        audio: obj.audio || "",
        text: TEXT_BLOCKER,
        ending: obj.ending || "",
      }
      return JSON.stringify(normalized, null, 2)
    }

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
