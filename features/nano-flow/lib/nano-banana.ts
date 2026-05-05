import { KIE_API_KEY } from "@/lib/env"
import { resolveImageUrl } from "@/lib/providers"

export const NANO_BANANA_PRO_MODEL = "nano-banana-2"

const KIE_BASE = "https://api.kie.ai"
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 150_000

export interface GenerateImageInput {
  prompt: string
  referenceImageUrls: string[]
  aspect: string
  resolution: string
  outputFormat?: "png" | "jpg"
  model?: string
}

export interface GeneratedImage {
  base64: string
  mimeType: string
}

interface CreateTaskResponse {
  code: number
  msg: string
  data?: { taskId: string }
}

interface RecordInfoData {
  taskId: string
  state: "waiting" | "queuing" | "generating" | "success" | "fail"
  resultJson?: string
  failCode?: string
  failMsg?: string
}

interface RecordInfoResponse {
  code: number
  msg: string
  data?: RecordInfoData
}

function isRetryableHttp(status: number | undefined): boolean {
  if (!status) return false
  return status === 429 || (status >= 500 && status < 600)
}

async function submitTask(input: GenerateImageInput): Promise<string> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY não configurada")

  const body = {
    model: input.model ?? NANO_BANANA_PRO_MODEL,
    input: {
      prompt: input.prompt,
      image_input: input.referenceImageUrls,
      aspect_ratio: input.aspect,
      resolution: input.resolution,
      output_format: input.outputFormat ?? "png",
    },
  }

  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${KIE_API_KEY}`,
        },
        body: JSON.stringify(body),
      })
      const data = (await response.json()) as CreateTaskResponse
      if (data.code === 200 && data.data?.taskId) return data.data.taskId
      if (!isRetryableHttp(data.code))
        throw new Error(data.msg || `kie.ai erro ${data.code}`)
      lastErr = new Error(data.msg || `kie.ai erro ${data.code}`)
    } catch (err) {
      lastErr = err as Error
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
  }
  throw lastErr ?? new Error("kie.ai submit falhou")
}

async function pollTask(taskId: string): Promise<string[]> {
  if (!KIE_API_KEY) throw new Error("KIE_API_KEY não configurada")

  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const response = await fetch(
      `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${KIE_API_KEY}` } }
    )
    const data = (await response.json()) as RecordInfoResponse

    if (data.code === 200 && data.data) {
      const { state, resultJson, failMsg } = data.data
      if (state === "success") {
        try {
          const parsed = JSON.parse(resultJson ?? "{}") as { resultUrls?: string[] }
          const urls = parsed.resultUrls ?? []
          if (urls.length > 0) return urls
        } catch (err) {
          throw new Error(`kie.ai resultJson inválido: ${(err as Error).message}`)
        }
        throw new Error("kie.ai sucesso mas sem resultUrls")
      }
      if (state === "fail") {
        throw new Error(failMsg || "kie.ai geração falhou")
      }
    } else if (data.code && !isRetryableHttp(data.code)) {
      throw new Error(data.msg || `kie.ai erro ${data.code}`)
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error(`kie.ai timeout após ${POLL_TIMEOUT_MS / 1000}s`)
}

async function downloadAsBase64(url: string): Promise<GeneratedImage> {
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Falha ao baixar imagem gerada (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const mimeType = res.headers.get("content-type") || "image/png"
  return { base64: buffer.toString("base64"), mimeType }
}

export async function generateWithNanoBananaPro(
  input: GenerateImageInput
): Promise<GeneratedImage> {
  // kie.ai exige URLs publicamente acessíveis. Garante upload se for path local.
  const resolvedUrls = await Promise.all(
    input.referenceImageUrls.map(async (u) => {
      const resolved = await resolveImageUrl(u)
      if (!resolved) throw new Error(`Referência inválida: ${u}`)
      return resolved
    })
  )

  const taskId = await submitTask({ ...input, referenceImageUrls: resolvedUrls })
  const [resultUrl] = await pollTask(taskId)
  return await downloadAsBase64(resultUrl)
}

