import { GoogleGenAI, Modality } from "@google/genai"
import { GEMINI_API_KEY } from "@/lib/env"

export const NANO_BANANA_PRO_MODEL = "gemini-3-pro-image-preview"

let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!GEMINI_API_KEY)
    throw new Error("GEMINI_API_KEY não configurada")
  if (!client) client = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  return client
}

export interface GenerateImageInput {
  prompt: string
  referenceImages: Array<{ data: string; mimeType: string }>
  aspect: string
  resolution: string
  /** Override the default Nano Banana Pro model (e.g. the faster flash variant for b-roll). */
  model?: string
}

export interface GeneratedImage {
  base64: string
  mimeType: string
}

function extractStatus(err: any): number | undefined {
  return (
    err?.status ??
    err?.error?.code ??
    err?.response?.status ??
    (typeof err?.code === "number" ? err.code : undefined)
  )
}

function isRetryable(err: any): boolean {
  const status = extractStatus(err)
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504)
    return true
  const msg = (err?.message ?? "").toLowerCase()
  return (
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("rate limit")
  )
}

async function callNanoBananaOnce(
  input: GenerateImageInput
): Promise<GeneratedImage> {
  const ai = getClient()

  const contents: Array<Record<string, unknown>> = [{ text: input.prompt }]
  for (const img of input.referenceImages) {
    contents.push({
      inlineData: { mimeType: img.mimeType, data: img.data },
    })
  }

  const response = await ai.models.generateContent({
    model: input.model ?? NANO_BANANA_PRO_MODEL,
    contents: contents as any,
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      imageConfig: {
        aspectRatio: input.aspect,
        imageSize: input.resolution,
      } as any,
    } as any,
  })

  const parts = response.candidates?.[0]?.content?.parts ?? []
  let textFromModel = ""

  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
      }
    }
    if (part.text) textFromModel += part.text
  }

  if (textFromModel.trim()) {
    throw new Error(`Modelo retornou apenas texto: ${textFromModel.slice(0, 300)}`)
  }
  throw new Error("Nano Banana Pro não retornou imagem")
}

export async function generateWithNanoBananaPro(
  input: GenerateImageInput
): Promise<GeneratedImage> {
  let lastErr: any
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callNanoBananaOnce(input)
    } catch (err) {
      lastErr = err
      const status = extractStatus(err)
      console.warn(
        `[nano-banana] attempt ${attempt + 1} failed (${status ?? "?"}): ${(err as Error).message}`
      )
      if (!isRetryable(err) || attempt === 2) throw err
      // Backoff: 2s, 6s
      await new Promise((r) => setTimeout(r, 2000 * 3 ** attempt))
    }
  }
  throw lastErr
}

export async function fetchImageAsBase64(url: string): Promise<{
  data: string
  mimeType: string
}> {
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Falha ao buscar referência (${res.status}): ${url}`)
  const arrayBuffer = await res.arrayBuffer()
  const data = Buffer.from(arrayBuffer).toString("base64")
  const mimeType = res.headers.get("content-type") || "image/png"
  return { data, mimeType }
}
