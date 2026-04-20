import { NextRequest, NextResponse } from "next/server"
import { callAIWithFallback } from "@/lib/ai"
import { prepareImage } from "@/lib/imageHelpers"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const PROMPT_TEMPLATE = (script: string) => `You are generating VEO 3.1 prompts for an image-to-video pipeline. Each paragraph of the script below (separated by blank lines) is ONE scene. Do NOT split, merge, or reorder paragraphs.

═══════════════════════════════════════════════
CRITICAL RULES — VEO 3.1 best practices
═══════════════════════════════════════════════

1. DO NOT DESCRIBE APPEARANCE. The image-to-video pipeline already provides clothes, hair, skin, age, face, setting. Describing what is already visible wastes tokens and disperses the model's attention. Use the image ONLY as grounding for believable actions and object interactions — never restate what it shows.

2. FRONT-LOAD THE CAMERA. The FIRST clause of every prompt must declare camera behavior, even for static shots. "Static shot, fixed camera, vertical 9:16" frees 100% of the model's processing for physics of lips, hands, and objects — which is exactly what matters.

3. CONCRETE MECHANICAL VERBS, NEVER EMOTIONAL ONES. Instead of "speaks with urgency," describe the kinetic act: "opens mouth, gestures with right hand palm open, leans torso 10cm toward the lens." The model simulates mechanics, not emotions. Convert every emotion into body/face movements with measurements (cm, degrees, directions).

4. DIALOGUE WITHOUT QUOTES, WITH A COLON. Quotation marks activate the text decoder and burn subtitles onto the video. Always use a colon to introduce speech:
   ✓ He speaks clearly and slowly: the bacterium that eats your insulin…
   ✗ He says: "the bacterium that eats your insulin…"

5. NO SUBTITLES, NO OVERLAYS, NO ON-SCREEN TEXT. Every prompt MUST end with the exact phrase: (no subtitles, no text overlay). The model must not generate captions, watermarks, logos, burned-in titles, or any on-screen text under any circumstances. This is non-negotiable.

6. 100-150 WORDS PER SCENE. Under 100 the model fills with generic motion; over 150 it ignores the tail of the prompt.

7. AUDIO BLOCK LAST, SEPARATED FROM VISUALS. Voice tone + pacing + ambient sound come at the END, isolated from the body/action description. Example: "Male voice, clear mid-tone, deliberate pacing, no background music."

8. NEVER INVENT OR EXTEND DIALOGUE. Use the user's paragraph text VERBATIM after the colon. The ONLY allowed transformation is spelling numerals into words ("86" → "eighty six", "97%" → "ninety seven percent"). If a paragraph is short, leave it short — do not add filler phrases, do not paraphrase.

═══════════════════════════════════════════════
STRUCTURE (in this order)
═══════════════════════════════════════════════

[CAMERA] + [MECHANICAL BODY ACTION] + [OBJECT INTERACTION] + [ENVIRONMENT / LIGHTING / PARTICLES] + [DIALOGUE with colon, no quotes] + [AUDIO / VOICE] + (no subtitles, no text overlay)

═══════════════════════════════════════════════
EXAMPLE — talking-head scene
═══════════════════════════════════════════════
Static shot, fixed camera, vertical 9:16. He extends his right index finger toward the camera lens, leans his torso forward 10cm. His left hand rests flat on the marble surface near the herb jar. Warm overhead recessed light casts soft shadows under his jaw. He speaks clearly and slowly: the bacterium that eats your insulin and causes dangerous blood sugar spikes. Camera holds steady throughout. Male voice, clear mid-tone, deliberate pacing, no background music. (no subtitles, no text overlay)

═══════════════════════════════════════════════
EXAMPLE — preparation / POV scene
═══════════════════════════════════════════════
Static shot, fixed camera, vertical 9:16. His right hand picks up a pineapple peel from the glass bowl, moves it 30cm laterally and lowers it into the honey jar. His gaze follows his hand downward. Liquid in the jar ripples slightly on contact. Ambient warm overhead light, faint steam particles rising from the counter. He speaks while looking down: nine out of ten Americans have type two diabetes and less than one percent know this. Male voice, calm measured cadence, soft ambient kitchen hum. (no subtitles, no text overlay)

═══════════════════════════════════════════════
BEFORE GENERATING — study the image
═══════════════════════════════════════════════
Look at the avatar's setting, available props, lighting direction. Use this only to choose believable actions and object interactions. NEVER write anything that describes what the image already shows.

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════
Return ONLY a JSON array — no markdown fences, no commentary. Each element has this exact shape:

[
  {
    "scene": 1,
    "dialogue": "the complete paragraph as spoken (used for bookkeeping)",
    "prompt": "Static shot, fixed camera, vertical 9:16. [...full prose prompt ending with] (no subtitles, no text overlay)"
  },
  ...
]

═══════════════════════════════════════════════
SCRIPT TO PROCESS
═══════════════════════════════════════════════

${script}`

// Safety net: guarantee the subtitle blocker is present at the end of every prompt.
function enforceTextBlocker(prompt: string): string {
  const trimmed = (prompt || "").trim()
  if (/\(no subtitles,\s*no text overlay\)\s*$/i.test(trimmed)) return trimmed
  // If there's a half-formed variant, drop it before appending the canonical form.
  const cleaned = trimmed.replace(
    /\(?\s*no\s+subtitles[^)]*\)?\s*$/i,
    ""
  ).trim()
  return `${cleaned} (no subtitles, no text overlay)`
}

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

    const scenes = rawScenes.map((s) => ({
      scene: s.scene,
      dialogue: s.dialogue,
      prompt: enforceTextBlocker(
        typeof s.prompt === "string" ? s.prompt : JSON.stringify(s.prompt)
      ),
    }))

    return NextResponse.json({ scenes })
  } catch (err: any) {
    console.error("[analyze-script]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
