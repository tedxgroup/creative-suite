import { NextRequest, NextResponse } from "next/server"
import { loadProject, updateClip } from "@/lib/db"
import {
  checkVeoStatus,
  checkInfiniteTalkStatus,
  checkGeminiVeoStatus,
} from "@/lib/providers"
import { archiveVideoToS3 } from "@/lib/videoArchive"

export const dynamic = "force-dynamic"
export const maxDuration = 120

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await loadProject(id)
  if (!project)
    return NextResponse.json(
      { error: "Projeto não encontrado" },
      { status: 404 }
    )

  const activeClips = project.clips.filter(
    (c) => c.taskId && ["submitted", "generating"].includes(c.status)
  )

  for (const clip of activeClips) {
    try {
      const provider =
        clip.provider ||
        ((clip.model || "veo3") === "infinitetalk" ? "wavespeed" : "kie")
      if (provider === "gemini") await checkGeminiVeoStatus(clip)
      else if (provider === "wavespeed") await checkInfiniteTalkStatus(clip)
      else await checkVeoStatus(clip)

      // If newly success → archive to S3
      let finalVideoUrl = clip.videoUrl
      if (clip.status === "success" && clip.videoUrl) {
        const archived = await archiveVideoToS3(clip)
        if (archived) finalVideoUrl = archived
      }

      await updateClip(clip.id, {
        status: clip.status,
        videoUrl: finalVideoUrl,
        error: clip.error,
      })
      await new Promise((r) => setTimeout(r, 200))
    } catch (err: any) {
      console.error(`[check-status] error ${clip.id}:`, err.message)
    }
  }

  const updated = await loadProject(id)
  return NextResponse.json(updated)
}
