import { NextRequest, NextResponse } from "next/server"
import { callAIWithFallback } from "@/lib/ai"
import { prepareImage } from "@/lib/imageHelpers"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const PROMPT_TEMPLATE = (script: string) => `Analyze this avatar image and the script below. Your job:

1. LOOK at the image carefully — note what the person is wearing, their pose, the environment, objects visible, lighting. You will NOT describe these in the prompts (VEO already extracts pixels), but you need to understand the context to write accurate mechanical actions.

2. The user has ALREADY divided the script into scenes. Each paragraph (separated by blank lines) is ONE scene. DO NOT split, merge, or rearrange paragraphs. Treat each paragraph exactly as one scene, in the exact order given. The dialogue for each scene is the FULL text of that paragraph — use it entirely, do not shorten or summarize it.

3. For EACH scene, generate an optimized VEO 3.1 prompt following this exact structure:

[CAMERA] + [MECHANICAL BODY ACTION] + [OBJECT INTERACTION if any] + [ENVIRONMENT/PARTICLES if relevant] + [DIALOGUE with colon, no quotes — include the COMPLETE dialogue from the paragraph] + [AUDIO/VOICE] + (no subtitles, no text overlay, no background music, no sound effects, no graphic elements)

CRITICAL RULES:
- First block MUST declare camera behavior: "Static shot, fixed camera, vertical 9:16" (or slow zoom, etc.)
- Use concrete mechanical verbs with measurements: "extends right index finger 15cm toward lens", "leans torso forward 10cm", "tilts head 5 degrees left"
- NEVER describe what's already visible in the image (clothing, hair, skin, background)
- Dialogue uses COLON, never quotes: He speaks clearly: the words he says here
- The dialogue in the prompt MUST contain the COMPLETE text of the paragraph — do NOT cut, trim, or reduce words
- Audio description LAST: "Male/Female voice, [tone], [pacing], [ambient sound]"
- ALWAYS end with: (no subtitles, no text overlay, no background music, no sound effects, no graphic elements)
- NEVER include background music, sound effects, jingles, or any non-voice audio in the prompt
- NEVER include graphic overlays, circles, numbers, floating text, arrows, icons, or any visual effects/motion graphics
- The ONLY audio should be the person's voice speaking the dialogue — nothing else
- Each prompt should be 100-150 words
- Vary the camera and body mechanics between scenes — don't repeat the same movements
- Mix in: hand gestures, finger pointing, leaning forward/back, head tilts, looking down at objects then back to camera, picking up items if relevant

Return ONLY a JSON array of objects with this format:
[
  { "scene": 1, "dialogue": "the COMPLETE dialogue text from this paragraph", "prompt": "the full VEO 3.1 optimized prompt including ALL the dialogue" },
  ...
]

Return ONLY the JSON, no markdown, no explanation.

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

    let scenes
    try {
      const jsonStr = text
        .replace(/^```json?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim()
      scenes = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: "Falha ao interpretar resposta da IA", raw: text },
        { status: 500 }
      )
    }

    return NextResponse.json({ scenes })
  } catch (err: any) {
    console.error("[analyze-script]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
