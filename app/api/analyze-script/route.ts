import { NextRequest, NextResponse } from "next/server"
import { callAIWithFallback } from "@/lib/ai"
import { prepareImage } from "@/lib/imageHelpers"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const PER_SCENE_CONCURRENCY = 5

const LEGACY_PROMPT = (script: string) => `You are generating VEO 3.1 prompts for an image-to-video pipeline. Each paragraph of the script below (separated by blank lines) is ONE scene. Do NOT split, merge, or reorder paragraphs.

═══════════════════════════════════════════════
CRITICAL RULES — VEO 3.1 best practices
═══════════════════════════════════════════════

1. DO NOT DESCRIBE APPEARANCE. The image already provides clothes, hair, skin, age, face, setting. Never restate what it shows.
2. FRONT-LOAD THE CAMERA. First clause = camera behavior, even for static shots.
3. CONCRETE MACRO ACTIONS, NOT MICRO DETAIL. Describe general body motion ("extends right hand forward", "leans in slightly"). Avoid finger positions, finger counting, or centimeter/degree measurements — Veo 3.1 Lite glitches on fine finger articulation.
4. NO EMOTIONAL ADJECTIVES. Translate emotion into mechanics, keep it general.
5. DIALOGUE WITH A COLON, NEVER QUOTES. Quotes activate the subtitle engine.
   ✓ He speaks clearly and slowly: the bacterium that eats your insulin…
   ✗ He says: "the bacterium that eats your insulin…"
6. NO SUBTITLES, NO OVERLAYS. Every prompt MUST end with: (no subtitles, no text overlay)
7. 70-100 WORDS PER SCENE.
8. AUDIO BLOCK LAST, SEPARATED FROM VISUALS.
9. NEVER INVENT OR EXTEND DIALOGUE. Use paragraph text VERBATIM after the colon. Only allowed: numerals to words.

STRUCTURE (in order):
[CAMERA] + [2-3 MACRO ACTIONS] + [SUBTLE ENVIRONMENT] + [DIALOGUE with colon] + [AUDIO] + (no subtitles, no text overlay)

OUTPUT FORMAT
Return ONLY a JSON array:
[
  { "scene": 1, "dialogue": "...", "prompt": "..." },
  ...
]

SCRIPT
${script}`

const SINGLE_SCENE_PROMPT = (
  dialogue: string,
  hasImage: boolean
) => `You are generating ONE VEO 3.1 prompt for an image-to-video pipeline. You receive ${hasImage ? "ONE reference image attached to this message" : "NO reference image — describe visually from the dialogue alone"} and ONE scene's dialogue.

═══════════════════════════════════════════════
CRITICAL RULES — VEO 3.1 best practices
═══════════════════════════════════════════════

1. DO NOT DESCRIBE APPEARANCE. The reference image already provides clothes, hair, skin, age, face, setting, props. NEVER restate what it shows — your job is to describe what HAPPENS in the scene.
2. FRONT-LOAD THE CAMERA. First clause = camera behavior ("Static shot, fixed camera, vertical 9:16." or similar).
3. CONCRETE MACRO ACTIONS, NOT MICRO DETAIL. Describe general body motion ("extends right hand toward jar", "leans in", "glances down"). AVOID finger positions, finger counting, or centimeter/degree measurements — Veo 3.1 Lite glitches on fine finger articulation.
4. NO EMOTIONAL ADJECTIVES. Translate emotion into mechanics, keep it general ("speaks calmly", "expression softens").
5. DIALOGUE WITH A COLON, NEVER QUOTES. Quotes activate the subtitle engine.
   ✓ He speaks clearly and slowly: the bacterium that eats your insulin…
   ✗ He says: "the bacterium that eats your insulin…"
6. NO SUBTITLES, NO OVERLAYS. The prompt MUST end with: (no subtitles, no text overlay)
7. 70-100 WORDS.
8. AUDIO BLOCK LAST, SEPARATED FROM VISUALS.
9. NEVER INVENT OR EXTEND DIALOGUE. Use the provided dialogue VERBATIM after the colon. Only allowed transform: numerals to words.
10. **GROUND THE PROMPT IN THE ATTACHED IMAGE.** Action and environment must match what is in this specific image — not a generic baseline.

STRUCTURE:
[CAMERA] + [2-3 MACRO ACTIONS grounded in the attached image] + [SUBTLE ENVIRONMENTAL DETAIL] + [DIALOGUE with colon] + [AUDIO] + (no subtitles, no text overlay)

═══════════════════════════════════════════════
SCENE DIALOGUE (verbatim)
═══════════════════════════════════════════════

"${dialogue}"

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Return ONLY the prompt text — no JSON, no markdown, no commentary, no scene numbering. Just the full Veo prompt ending with (no subtitles, no text overlay).`

function enforceTextBlocker(prompt: string): string {
  const trimmed = (prompt || "").trim()
  if (/\(no subtitles,\s*no text overlay\)\s*$/i.test(trimmed)) return trimmed
  const cleaned = trimmed
    .replace(/\(?\s*no\s+subtitles[^)]*\)?\s*$/i, "")
    .trim()
  return `${cleaned} (no subtitles, no text overlay)`
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim()
}

interface PerSceneInput {
  dialogue: string
  imageUrl?: string | null
}

async function analyzeLegacy(script: string, imageUrl: string | null) {
  const imageBase64 = imageUrl ? await prepareImage(imageUrl) : null
  const promptText = LEGACY_PROMPT(script)
  const claudeContent: any[] = []
  const openaiContent: any[] = []
  if (imageBase64) {
    claudeContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: imageBase64,
      },
    })
    openaiContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    })
  }
  claudeContent.push({ type: "text", text: promptText })
  openaiContent.push({ type: "text", text: promptText })
  const text = await callAIWithFallback({
    claudeContent,
    openaiContent,
    maxTokens: 8000,
  })
  return parseScenes(text)
}

async function analyzeSingleScene(
  scene: PerSceneInput,
  fallbackImageUrl: string | null
): Promise<string> {
  const url = scene.imageUrl || fallbackImageUrl || null
  const imageBase64 = url ? await prepareImage(url) : null
  const promptText = SINGLE_SCENE_PROMPT(scene.dialogue, !!imageBase64)

  const claudeContent: any[] = []
  const openaiContent: any[] = []
  if (imageBase64) {
    claudeContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: imageBase64,
      },
    })
    openaiContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    })
  }
  claudeContent.push({ type: "text", text: promptText })
  openaiContent.push({ type: "text", text: promptText })

  const text = await callAIWithFallback({
    claudeContent,
    openaiContent,
    maxTokens: 2000,
  })
  return enforceTextBlocker(stripMarkdownFences(text))
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return results
}

function parseScenes(
  text: string
): Array<{ scene: number; dialogue: string; prompt: string }> {
  const jsonStr = stripMarkdownFences(text)
  const raw = JSON.parse(jsonStr)
  if (!Array.isArray(raw)) throw new Error("Resposta não é uma lista")
  return raw.map((s: any, idx: number) => ({
    scene: s.scene ?? idx + 1,
    dialogue: typeof s.dialogue === "string" ? s.dialogue : "",
    prompt: enforceTextBlocker(
      typeof s.prompt === "string" ? s.prompt : JSON.stringify(s.prompt)
    ),
  }))
}

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY)
    return NextResponse.json(
      { error: "Nenhuma API key configurada (Claude ou OpenAI)" },
      { status: 500 }
    )

  const body = await req.json()

  try {
    // New per-scene flow: body has { scenes: [{dialogue, imageUrl}], fallbackImageUrl? }
    if (Array.isArray(body.scenes)) {
      const scenes: PerSceneInput[] = body.scenes
      const fallbackImageUrl = body.fallbackImageUrl ?? null

      if (scenes.length === 0) {
        return NextResponse.json({ scenes: [] })
      }

      // ONE LLM call per scene — eliminates cross-image bleed when refs differ.
      const prompts = await runWithConcurrency(
        scenes,
        PER_SCENE_CONCURRENCY,
        (scene) => analyzeSingleScene(scene, fallbackImageUrl)
      )

      const out = scenes.map((s, i) => ({
        scene: i + 1,
        dialogue: s.dialogue,
        prompt: prompts[i],
      }))
      return NextResponse.json({ scenes: out })
    }

    // Legacy: body has { script, imageUrl }
    const { script, imageUrl } = body
    if (!script)
      return NextResponse.json(
        { error: "Script é obrigatório" },
        { status: 400 }
      )
    const result = await analyzeLegacy(script, imageUrl ?? null)
    return NextResponse.json({ scenes: result })
  } catch (err: any) {
    console.error("[analyze-script]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
