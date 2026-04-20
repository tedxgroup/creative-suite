import { NextRequest } from "next/server"
import archiver from "archiver"
import { loadProject } from "@/lib/db"
import { PassThrough } from "stream"

export const dynamic = "force-dynamic"
export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await loadProject(id)
  if (!project) return new Response("Projeto não encontrado", { status: 404 })

  const completedClips = project.clips
    .filter((c) => c.status === "success" && c.videoUrl)
    .sort((a, b) => a.order - b.order)
  if (!completedClips.length)
    return new Response("Nenhum vídeo pronto", { status: 400 })

  const safeName = project.name
    .replace(/[^a-zA-Z0-9_\-#\s]/g, "")
    .replace(/\s+/g, "_")
  const zipName = `${safeName}_${completedClips.length}videos.zip`

  const passthrough = new PassThrough()
  const archive = archiver("zip", { zlib: { level: 1 } })

  archive.on("error", (err) => {
    console.error("[zip]", err)
    passthrough.destroy(err)
  })
  archive.pipe(passthrough)

  // roteiro
  const scriptLines = completedClips
    .map((clip) => {
      const sceneNum = `Cena ${String(clip.order).padStart(3, "0")}`
      const dialogue = clip.dialogue || clip.prompt
      return `${sceneNum} - ${dialogue}`
    })
    .join("\n")
  archive.append(scriptLines, { name: "roteiro.txt" })

  ;(async () => {
    for (const clip of completedClips) {
      try {
        const filename = `Cena ${String(clip.order).padStart(3, "0")}.mp4`
        const response = await fetch(clip.videoUrl!)
        const buffer = Buffer.from(await response.arrayBuffer())
        archive.append(buffer, { name: filename })
      } catch (err: any) {
        console.error(`[zip] failed clip ${clip.id}:`, err.message)
      }
    }
    archive.finalize()
  })()

  return new Response(passthrough as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
    },
  })
}
