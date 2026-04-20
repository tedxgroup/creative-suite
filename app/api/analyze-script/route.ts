import { NextRequest, NextResponse } from "next/server"
import { callAIWithFallback } from "@/lib/ai"
import { prepareImage } from "@/lib/imageHelpers"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const PROMPT_TEMPLATE = (script: string) => `You are generating VEO 3.1 prompts for an image-to-video pipeline. The user will paste a script — each paragraph (separated by blank lines) is ONE scene. Do NOT split, merge, or reorder paragraphs.

═══════════════════════════════════════════════
CRITICAL: VEO 3.1 OFFICIAL SCHEMA — ONLY 6 KEYS
═══════════════════════════════════════════════

VEO 3.1 processes these 6 keys as independent computational axes. Using any other keys (like "shot", "subject", "dialogue", "negatives") makes the model ignore them or read them as generic text, producing inconsistent results.

The ONLY valid keys are:

{
  "camera": "",
  "description": "",
  "motion": "",
  "audio": "",
  "text": "none, no subtitles, no text overlay, no on-screen text, no watermarks, no logos",
  "ending": ""
}

═══════════════════════════════════════════════
FIELD-BY-FIELD RULES
═══════════════════════════════════════════════

┌─ camera ─ ALWAYS first key
│ Shot type + framing + orientation + lens feel
│ Examples:
│   "Static shot, fixed camera, vertical 9:16, medium shot, shallow depth of field"
│   "Handheld slight natural sway, vertical 9:16, POV first-person perspective"
│   "Slow push-in, vertical 9:16, medium close-up"
│ Vary between scenes — don't repeat identical camera.
└──

┌─ description ─ Body mechanics + environment, TOGETHER
│ - DO NOT describe subject appearance (clothes, hair, skin, age) — the I2V image already provides that
│ - Use CONCRETE mechanical verbs with measurements (cm, degrees, directions)
│ - Convert emotions into facial/body mechanics:
│     "urgent" → "brow furrows, jaw tightens, leans forward 5cm"
│     "confident" → "chest rises, shoulders square, chin lifts 3 degrees"
│     "serious" → "lips press together, eyes narrow slightly"
│ - Include environment/lighting at the END of description
│ - To LOCK objects/gaze (avoid unwanted movement), add phrases like:
│     "eyes remain locked on the camera lens throughout the entire clip"
│     "the glucose meter remains absolutely frozen with its display unchanged"
│     "he holds the phone steady in his right hand throughout the entire clip"
└──

┌─ motion ─ Ambient physics ONLY (separate from subject action)
│ Fluids, particles, micro-movements, breathing, steam, ambient sway
│ Examples:
│   "Honey dripping in slow viscous strand, chest rises and falls with breathing"
│   "Subtle natural hand micro-movements, faint steam rising from tea surface"
│   "Slow circular dipper rotation inside cup, thick honey folding with visible viscosity"
└──

┌─ audio ─ Voice + SFX + (absence of) music
│ - DIALOGUE goes HERE (never in other fields)
│ - NEVER use quotes around the spoken text (quotes trigger on-screen subtitles)
│ - Use a COLON to separate voice description from the spoken text
│ - Format: "[voice description + pacing/tone]: [the actual words the speaker says]"
│ - CRITICAL: Use the user's paragraph text VERBATIM after the colon. NEVER add, extend, invent, paraphrase, or pad the dialogue with extra words. The script is the source of truth — every spoken word must come from the original paragraph.
│ - SPELL OUT ALL NUMBERS: "86" → "eighty six", "97%" → "ninety seven percent", "2" → "two" (this is the ONLY allowed transformation — spelling numerals into words)
│ - If the paragraph is shorter than 12 words, leave it as-is. Do NOT fabricate filler content. (The 12-word soft-minimum is a VEO audio-engine heuristic — it is BETTER to pass the short line through than to invent words the user didn't write.)
│ - End with explicit absence markers: "No background music" or "No background music, no sound effects"
│ - For scenes WITHOUT dialogue: "No voice, no speech, no music. Soft ambient [describe ambient sound]"
│ Examples:
│   "Male voice speaks with confident authoritative pacing: mix pineapple skin in hot water with these two ingredients and never worry about your blood sugar levels ever again. No background music"
│   "Female voice speaks off-camera with steady measured reading tone: [complete dialogue]. No background music"
│   "No voice, no speech, no music. Soft ambient kitchen hum, gentle wooden stick stirring against glass"
└──

┌─ text ─ Subtitle blocker, ALWAYS fixed value with redundancy
│ ALWAYS exactly: "none, no subtitles, no text overlay, no on-screen text, no watermarks, no logos"
└──

┌─ ending ─ Final frame state
│ Describe the resting position of body + objects at the end of the 8s clip
│ Vital for continuity when the final frame is reused as input image for the next clip
│ Examples:
│   "Final frame shows him with right hand resting on counter, eyes locked on camera"
│   "Final frame shows honey dipper lowered into the jar with honey settled on surface"
│   "Final frame shows her holding the cup at chest height with steam still rising"
└──

═══════════════════════════════════════════════
SCENE TYPE PATTERNS (use the one that matches)
═══════════════════════════════════════════════

1. Talking head — person facing camera, speaking
   camera: "Static shot, fixed camera, vertical 9:16, medium shot"
   description: body gestures + "eyes remain locked on camera lens"
   motion: "subtle hand micro-movements, chest rises with breathing"
   audio: "Male/Female voice speaks with [tone] pacing: [dialogue]. No background music"

2. POV preparation — hands manipulating objects, narrator off-camera
   camera: "Handheld slight natural sway, vertical 9:16, POV first-person"
   description: hand mechanics + object locks ("glucose meter remains absolutely frozen")
   motion: fluid physics (honey dripping, steam rising)
   audio: "[voice] speaks off-camera with [tone]: [dialogue]. [ambient SFX], no background music"

3. Phone reading — person holding phone, reading aloud
   camera: "Static shot, fixed camera, vertical 9:16, medium close-up"
   description: "holds phone steady in right hand at chest height throughout entire clip without lowering"
   audio: "Male/Female voice speaks with steady measured reading tone: [dialogue]. No background music"

4. Silent action — animation only, no dialogue
   camera: "Static shot, fixed camera, vertical 9:16, medium close-up"
   description: body mechanics describing the action
   motion: the visual effect being shown
   audio: "No voice, no speech, no music. Soft ambient [specific sound], [ambient detail]"

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Return ONLY a JSON array, no markdown fences, no explanation. Each element must follow exactly this shape:

[
  {
    "scene": 1,
    "dialogue": "the complete paragraph text (used for bookkeeping)",
    "prompt": {
      "camera": "...",
      "description": "...",
      "motion": "...",
      "audio": "...",
      "text": "none, no subtitles, no text overlay, no on-screen text, no watermarks, no logos",
      "ending": "..."
    }
  },
  ...
]

═══════════════════════════════════════════════
BEFORE GENERATING, STUDY THE IMAGE:
═══════════════════════════════════════════════

Look at the avatar image — note setting, objects on counter/desk, lighting direction, available props. Use this context to choose believable actions and shot types. NEVER describe what's visible in the image (the I2V pipeline preserves it).

═══════════════════════════════════════════════
SCRIPT TO PROCESS:
═══════════════════════════════════════════════

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

    // Ensure text field always has the subtitle blocker
    const TEXT_BLOCKER =
      "none, no subtitles, no text overlay, no on-screen text, no watermarks, no logos"

    const scenes = rawScenes.map((s) => {
      let p = s.prompt
      // If prompt came as a string, try to parse it back
      if (typeof p === "string") {
        try {
          p = JSON.parse(p)
        } catch {
          p = { camera: "", description: p, motion: "", audio: "", text: TEXT_BLOCKER, ending: "" }
        }
      }
      // Enforce 6-key schema + always-correct text blocker
      const normalized = {
        camera: p.camera || "",
        description: p.description || "",
        motion: p.motion || "",
        audio: p.audio || "",
        text: TEXT_BLOCKER,
        ending: p.ending || "",
      }
      return {
        scene: s.scene,
        dialogue: s.dialogue,
        prompt: JSON.stringify(normalized, null, 2),
      }
    })

    return NextResponse.json({ scenes })
  } catch (err: any) {
    console.error("[analyze-script]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
