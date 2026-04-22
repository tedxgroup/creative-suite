import { NextRequest, NextResponse } from "next/server"
import { callAIWithFallback } from "@/lib/ai"
import { prepareImage } from "@/lib/imageHelpers"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 180

const MAX_SCENES_PER_BATCH = 10

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

const PER_SCENE_PROMPT = (
  scenes: Array<{ dialogue: string; hasImage: boolean }>
) => `You are generating VEO 3.1 prompts for an image-to-video pipeline. You receive a numbered sequence of scenes. Each scene has its OWN reference image attached in the same message (in order). Scene N uses the Nth image.

═══════════════════════════════════════════════
CRITICAL RULES — VEO 3.1 best practices
═══════════════════════════════════════════════

1. DO NOT DESCRIBE APPEARANCE. The image for each scene already provides clothes, hair, skin, age, face, setting, props. NEVER restate what it shows — your job is to describe what HAPPENS in the scene.
2. FRONT-LOAD THE CAMERA. First clause of every prompt = camera behavior ("Static shot, fixed camera, vertical 9:16." or similar).
3. CONCRETE MACRO ACTIONS, NOT MICRO DETAIL. Describe general body motion ("extends right hand toward jar", "leans in", "glances down"). AVOID finger positions, finger counting, or centimeter/degree measurements — Veo 3.1 Lite glitches on fine finger articulation.
4. NO EMOTIONAL ADJECTIVES. Translate emotion into mechanics, keep it general ("speaks calmly", "expression softens").
5. DIALOGUE WITH A COLON, NEVER QUOTES. Quotes activate the subtitle engine.
   ✓ He speaks clearly and slowly: the bacterium that eats your insulin…
   ✗ He says: "the bacterium that eats your insulin…"
6. NO SUBTITLES, NO OVERLAYS. Every prompt MUST end with: (no subtitles, no text overlay)
7. 70-100 WORDS PER SCENE.
8. AUDIO BLOCK LAST, SEPARATED FROM VISUALS.
9. NEVER INVENT OR EXTEND DIALOGUE. Use the provided dialogue VERBATIM after the colon. Only allowed transform: numerals to words.
10. **EACH SCENE'S PROMPT MUST REFLECT ITS OWN IMAGE.** If scene 2's image shows the avatar in a pharmacy holding a box, scene 2's prompt describes action IN THAT CONTEXT — not in the base kitchen.

STRUCTURE per scene:
[CAMERA] + [2-3 MACRO ACTIONS grounded in that scene's image] + [SUBTLE ENVIRONMENTAL DETAIL] + [DIALOGUE with colon] + [AUDIO] + (no subtitles, no text overlay)

═══════════════════════════════════════════════
SCENES (dialogue + index of image to use)
═══════════════════════════════════════════════

${scenes
  .map(
    (s, i) =>
      `Scene ${i + 1}${s.hasImage ? ` — uses Image #${i + 1}` : " — NO IMAGE (describe visually from dialogue)"}:\n"${s.dialogue}"`
  )
  .join("\n\n")}

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Return ONLY a JSON array with one element per scene, in order. No markdown, no commentary.

[
  { "scene": 1, "dialogue": "<verbatim dialogue>", "prompt": "<full Veo prompt ending with (no subtitles, no text overlay)>" },
  { "scene": 2, "dialogue": "...", "prompt": "..." }
]`

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

async function analyzePerScene(
  scenes: PerSceneInput[],
  fallbackImageUrl: string | null
) {
  // Fetch all images in parallel (unique URLs only, then map back)
  const urls = scenes.map((s) => s.imageUrl || fallbackImageUrl || null)
  const uniqueUrls = Array.from(new Set(urls.filter((u): u is string => !!u)))
  const fetchedByUrl = new Map<string, string>()
  await Promise.all(
    uniqueUrls.map(async (u) => {
      const b64 = await prepareImage(u)
      if (b64) fetchedByUrl.set(u, b64)
    })
  )

  const promptText = PER_SCENE_PROMPT(
    scenes.map((s, i) => {
      const u = urls[i]
      return { dialogue: s.dialogue, hasImage: !!(u && fetchedByUrl.get(u)) }
    })
  )

  const claudeContent: any[] = []
  const openaiContent: any[] = []
  // Attach images in scene order
  for (const u of urls) {
    const b64 = u ? fetchedByUrl.get(u) : null
    if (b64) {
      claudeContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: b64,
        },
      })
      openaiContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${b64}` },
      })
    }
  }
  claudeContent.push({ type: "text", text: promptText })
  openaiContent.push({ type: "text", text: promptText })

  const text = await callAIWithFallback({
    claudeContent,
    openaiContent,
    maxTokens: 16000,
  })
  return parseScenes(text)
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

      // Batch if too many — LLM context + attachment cap
      const batches: PerSceneInput[][] = []
      for (let i = 0; i < scenes.length; i += MAX_SCENES_PER_BATCH) {
        batches.push(scenes.slice(i, i + MAX_SCENES_PER_BATCH))
      }

      const out: Array<{ scene: number; dialogue: string; prompt: string }> = []
      for (const batch of batches) {
        const result = await analyzePerScene(batch, fallbackImageUrl)
        for (const r of result) {
          out.push({ ...r, scene: out.length + 1 })
        }
      }
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
