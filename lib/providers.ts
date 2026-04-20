import fs from "fs"
import path from "path"
import os from "os"
import sharp from "sharp"
import {
  KIE_API_KEY,
  WAVESPEED_API_KEY,
  GEMINI_API_KEY,
  GEMINI_BASE,
} from "./env"
import type { VideoClip } from "./types"

const TMP_DIR = os.tmpdir()

// =============================================
// Upload helpers (KIE / WaveSpeed)
// =============================================

export async function uploadImageToKie(imageUrl: string): Promise<string> {
  // Accept either remote URL or local relative path
  let fileBuffer: Buffer
  if (imageUrl.startsWith("http")) {
    const resp = await fetch(imageUrl)
    if (!resp.ok)
      throw new Error(`Falha ao baixar imagem: ${resp.status}`)
    fileBuffer = Buffer.from(await resp.arrayBuffer())
  } else {
    const absolutePath = path.join(process.cwd(), imageUrl)
    if (!fs.existsSync(absolutePath))
      throw new Error(`Arquivo não encontrado: ${imageUrl}`)
    fileBuffer = fs.readFileSync(absolutePath)
  }

  const base64Data = fileBuffer.toString("base64")
  const ext = (path.extname(imageUrl).slice(1) || "png").split("?")[0]
  const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`
  const dataUrl = `data:${mimeType};base64,${base64Data}`

  const response = await fetch(
    "https://kieai.redpandaai.co/api/file-base64-upload",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify({
        base64Data: dataUrl,
        uploadPath: "tedx-video/images",
        fileName: path.basename(imageUrl.split("?")[0]),
      }),
    }
  )

  const data: any = await response.json()
  if (data.success && data.data?.downloadUrl) return data.data.downloadUrl
  throw new Error(`Upload KIE falhou: ${data.msg || JSON.stringify(data)}`)
}

export async function resolveImageUrl(
  imageUrl: string | null
): Promise<string | null> {
  if (!imageUrl) return null
  if (imageUrl.startsWith("http")) return imageUrl
  return await uploadImageToKie(imageUrl)
}

export async function uploadFileToWavespeed(fileUrl: string): Promise<string> {
  let fileBuffer: Buffer
  let filename: string
  if (fileUrl.startsWith("http")) {
    const resp = await fetch(fileUrl)
    if (!resp.ok)
      throw new Error(`Falha ao baixar arquivo: ${resp.status}`)
    fileBuffer = Buffer.from(await resp.arrayBuffer())
    filename = path.basename(new URL(fileUrl).pathname) || "file"
  } else {
    const absolutePath = path.join(process.cwd(), fileUrl)
    if (!fs.existsSync(absolutePath))
      throw new Error(`Arquivo não encontrado: ${fileUrl}`)
    fileBuffer = fs.readFileSync(absolutePath)
    filename = path.basename(fileUrl)
  }
  const ext = path.extname(filename).slice(1).toLowerCase()
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
  }
  const mimeType = mimeMap[ext] || "application/octet-stream"

  const form = new FormData()
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType })
  form.append("file", blob, filename)

  const response = await fetch(
    "https://api.wavespeed.ai/api/v3/media/upload/binary",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${WAVESPEED_API_KEY}` },
      body: form,
    }
  )
  const data: any = await response.json()
  if (data.code === 200 && data.data?.download_url) return data.data.download_url
  throw new Error(
    `Upload WaveSpeed falhou: ${data.message || JSON.stringify(data)}`
  )
}

export async function resolveUrlForWavespeed(
  url: string | null
): Promise<string | null> {
  if (!url) return null
  if (url.startsWith("http")) return url
  return await uploadFileToWavespeed(url)
}

// =============================================
// Submit clip to provider
// =============================================

export async function submitVeoClip(
  clip: VideoClip,
  opts: { model?: string; aspect_ratio?: string }
): Promise<{ taskId: string }> {
  const body: any = {
    prompt: clip.prompt,
    model: opts.model || "veo3_fast",
    aspect_ratio: opts.aspect_ratio || "9:16",
    enableTranslation: false,
  }
  if (clip.imageUrl) {
    const publicUrl = await resolveImageUrl(clip.imageUrl)
    body.imageUrls = [publicUrl]
    body.generationType = "FIRST_AND_LAST_FRAMES_2_VIDEO"
  } else {
    body.generationType = "TEXT_2_VIDEO"
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        "https://api.kie.ai/api/v1/veo/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${KIE_API_KEY}`,
          },
          body: JSON.stringify(body),
        }
      )
      const data: any = await response.json()
      if (data.code === 200 && data.data?.taskId)
        return { taskId: data.data.taskId }
      if (data.code && data.code < 500)
        throw new Error(data.msg || `Erro código ${data.code}`)
      throw new Error(data.msg || `Erro ${data.code || response.status}`)
    } catch (err: any) {
      const isRetryable =
        err.message?.includes("500") ||
        err.message?.includes("502") ||
        err.message?.includes("503") ||
        err.code === "ECONNRESET" ||
        err.cause?.code === "ECONNRESET"
      if (!isRetryable || attempt === 2) throw err
      const delay = 2000 * (attempt + 1)
      console.log(`[veo-retry] attempt ${attempt + 1} retrying in ${delay}ms...`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error("VEO submission failed after retries")
}

export async function submitInfiniteTalkClip(
  clip: VideoClip,
  opts: { resolution?: string }
): Promise<{ taskId: string }> {
  if (!WAVESPEED_API_KEY)
    throw new Error("WAVESPEED_API_KEY não configurada no .env")
  if (!clip.imageUrl || !clip.audioUrl)
    throw new Error("Imagem e áudio são obrigatórios")

  const imageUrl = await resolveUrlForWavespeed(clip.imageUrl)
  const audioUrl = await resolveUrlForWavespeed(clip.audioUrl)

  const body: any = {
    image: imageUrl,
    audio: audioUrl,
    resolution: opts.resolution || "480p",
    seed: -1,
  }
  if (clip.prompt) body.prompt = clip.prompt

  const response = await fetch(
    "https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WAVESPEED_API_KEY}`,
      },
      body: JSON.stringify(body),
    }
  )
  const data: any = await response.json()
  if (data.code === 200 && data.data?.id) return { taskId: data.data.id }
  throw new Error(data.message || `Erro código ${data.code}`)
}

export async function submitGeminiVeoClip(
  clip: VideoClip,
  opts: { aspect_ratio?: string }
): Promise<{ taskId: string }> {
  if (!GEMINI_API_KEY)
    throw new Error("GEMINI_API_KEY não configurada no .env")

  const instances: any[] = [{ prompt: clip.prompt }]

  if (clip.imageUrl) {
    let imgBuf: Buffer | null = null
    try {
      if (clip.imageUrl.startsWith("http")) {
        const r = await fetch(clip.imageUrl)
        if (r.ok) imgBuf = Buffer.from(await r.arrayBuffer())
      } else {
        const localPath = path.join(process.cwd(), clip.imageUrl)
        if (fs.existsSync(localPath)) imgBuf = fs.readFileSync(localPath)
      }
    } catch {}
    if (imgBuf) {
      const imgBuffer = await sharp(imgBuf)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      instances[0].image = {
        inlineData: {
          mimeType: "image/jpeg",
          data: imgBuffer.toString("base64"),
        },
      }
    }
  }

  const parameters: any = {}
  if (opts.aspect_ratio) parameters.aspectRatio = opts.aspect_ratio

  const response = await fetch(
    `${GEMINI_BASE}/models/veo-3.1-lite-generate-preview:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ instances, parameters }),
    }
  )
  const data: any = await response.json()
  console.log("[gemini-submit]", JSON.stringify(data).slice(0, 300))

  if (data.name) return { taskId: data.name }
  throw new Error(
    data.error?.message || `Gemini erro: ${JSON.stringify(data).slice(0, 200)}`
  )
}

// =============================================
// Status checks
// =============================================

export async function checkVeoStatus(clip: VideoClip): Promise<void> {
  const response = await fetch(
    `https://api.kie.ai/api/v1/veo/record-info?taskId=${clip.taskId}`,
    { headers: { Authorization: `Bearer ${KIE_API_KEY}` } }
  )
  const data: any = await response.json()
  if (data.code === 200 && data.data) {
    const task = data.data
    if (task.successFlag === 1) {
      clip.status = "success"
      const urls = task.response?.resultUrls || task.response?.originUrls || []
      clip.videoUrl = Array.isArray(urls) ? urls[0] : urls
    } else if (task.successFlag === 2 || task.successFlag === 3) {
      clip.status = "fail"
      clip.error = task.errorMessage || "Geração falhou"
    } else if (task.successFlag === 0) {
      clip.status = "generating"
    }
  }
}

export async function checkInfiniteTalkStatus(clip: VideoClip): Promise<void> {
  const response = await fetch(
    `https://api.wavespeed.ai/api/v3/predictions/${clip.taskId}/result`,
    { headers: { Authorization: `Bearer ${WAVESPEED_API_KEY}` } }
  )
  const data: any = await response.json()
  if (data.code === 200 && data.data) {
    const task = data.data
    if (task.status === "completed") {
      clip.status = "success"
      const outputs = task.outputs || []
      clip.videoUrl = Array.isArray(outputs) ? outputs[0] : outputs
    } else if (task.status === "failed") {
      clip.status = "fail"
      clip.error = task.error || "Geração falhou"
    } else if (task.status === "processing" || task.status === "created") {
      clip.status = "generating"
    }
  }
}

export async function checkGeminiVeoStatus(clip: VideoClip): Promise<void> {
  const response = await fetch(`${GEMINI_BASE}/${clip.taskId}`, {
    headers: { "x-goog-api-key": GEMINI_API_KEY! },
  })
  const data: any = await response.json()
  if (data.done === true) {
    const samples = data.response?.generateVideoResponse?.generatedSamples
    if (samples && samples[0]?.video?.uri) {
      const videoUri = samples[0].video.uri
      // Download with auth header into a /tmp file then upload to S3
      const videoResp = await fetch(videoUri, {
        headers: { "x-goog-api-key": GEMINI_API_KEY! },
      })
      if (!videoResp.ok) {
        clip.status = "fail"
        clip.error = `Gemini download failed: ${videoResp.status}`
        return
      }
      const buffer = Buffer.from(await videoResp.arrayBuffer())
      const { uploadToStorage, makeKey } = await import("./storage-bucket")
      const key = makeKey("videos", `${clip.id}.mp4`)
      const { url } = await uploadToStorage({
        key,
        body: buffer,
        contentType: "video/mp4",
      })
      clip.status = "success"
      clip.videoUrl = url
    } else {
      clip.status = "fail"
      clip.error = data.error?.message || "Gemini: vídeo não retornado"
    }
  } else if (data.done === false) {
    clip.status = "generating"
  } else if (data.error) {
    clip.status = "fail"
    clip.error = data.error.message || "Gemini: erro na geração"
  }
}
