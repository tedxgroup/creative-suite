import { NextRequest, NextResponse } from "next/server"
import { callAIWithFallback } from "@/lib/ai"
import { prepareImage } from "@/lib/imageHelpers"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const PROMPT_TEMPLATE = (script: string) => `Analyze this avatar image and the script below. Your job:

1. LOOK at the image carefully — note what the person is wearing, their pose, the environment, objects visible, lighting. You will NOT describe these in the prompts (VEO already extracts pixels), but you need to understand the context to write accurate mechanical actions.

2. The user has ALREADY divided the script into scenes. Each paragraph (separated by blank lines) is ONE scene. DO NOT split, merge, or rearrange paragraphs. Treat each paragraph exactly as one scene, in the exact order given. The dialogue for each scene is the FULL text of that paragraph — use it entirely, do not shorten or summarize it.

3. For EACH scene, build a STRUCTURED JSON prompt object optimized for Google VEO 3.1. This is a proven VEO 3 best practice — structured JSON gives more controllable, consistent outputs than plain text.

Each scene's "prompt" MUST be a JSON OBJECT (not a string) with this exact schema:

{
  "shot": {
    "type": "static | slow_zoom_in | slow_zoom_out | slight_push_in | handheld_slight",
    "framing": "vertical 9:16, medium close-up"
  },
  "subject": {
    "action": "concrete mechanical action with measurements, e.g. 'extends right index finger 15cm toward lens'",
    "expression": "single adjective like confident | serious | warm | tense",
    "posture": "optional — e.g. 'leans torso forward 8cm' or omit"
  },
  "interaction": "optional — object interaction like 'picks up honey jar with left hand' or omit",
  "environment": "ambient lighting/particle detail — e.g. 'warm overhead recessed light, soft shadows under jawline'",
  "dialogue": {
    "speaker_voice": "male voice | female voice",
    "delivery": "tone + pacing, e.g. 'authoritative, measured pacing'",
    "text": "the COMPLETE dialogue from this paragraph — do NOT cut or shorten"
  },
  "audio": {
    "voice_only": true,
    "ambient": "optional — e.g. 'quiet indoor ambient sound' or omit"
  },
  "negatives": [
    "subtitles",
    "text overlay",
    "background music",
    "sound effects",
    "graphic overlays",
    "motion graphics",
    "on-screen text",
    "logos",
    "arrows",
    "icons"
  ]
}

CRITICAL RULES:
- NEVER describe what's already visible in the image (clothing, hair, skin, background)
- The dialogue.text MUST contain the COMPLETE text of the paragraph — do NOT cut, trim, or reduce words
- Use concrete mechanical verbs with measurements (cm, degrees) in subject.action
- Vary shot.type and subject.action between scenes — don't repeat
- The ONLY audio is the person's voice speaking the dialogue
- negatives must ALWAYS include the full list shown above
- Omit optional fields (interaction, posture, audio.ambient) when not applicable

Return ONLY a JSON array of objects with this exact format:
[
  {
    "scene": 1,
    "dialogue": "the COMPLETE dialogue text from this paragraph",
    "prompt": { ...the structured JSON object as specified above... }
  },
  ...
]

Return ONLY the JSON array, no markdown, no explanation.

SCRIPT:
${script}`

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY)
    return NextResponse.json(
      { error: "Nenhuma API key configurada (Claude ou OpenAI)" },
      { status: 500 }
    )

  const { script, imageUrl } = await req.json()
  if (!script)
    return NextResponse.json(
      { error: "Script é obrigatório" },
      { status: 400 }
    )

  try {
    const imageBase64 = await prepareImage(imageUrl)
    const promptText = PROMPT_TEMPLATE(script)

    const claudeContent: any[] = []
    if (imageBase64) {
      claudeContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: imageBase64,
        },
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
      maxTokens: 8000,
    })

    let rawScenes: any[]
    try {
      const jsonStr = text
        .replace(/^```json?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim()
      rawScenes = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: "Falha ao interpretar resposta da IA", raw: text },
        { status: 500 }
      )
    }

    // Normalize: prompt can come as object or string — stringify objects
    const scenes = rawScenes.map((s) => ({
      scene: s.scene,
      dialogue: s.dialogue,
      prompt:
        typeof s.prompt === "string"
          ? s.prompt
          : JSON.stringify(s.prompt, null, 2),
    }))

    return NextResponse.json({ scenes })
  } catch (err: any) {
    console.error("[analyze-script]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
