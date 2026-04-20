import { NextRequest, NextResponse } from "next/server"
import { fetchClip, updateClip } from "@/lib/db"
import { archiveVideoToS3 } from "@/lib/videoArchive"

export const dynamic = "force-dynamic"
export const maxDuration = 120

interface Params {
  params: Promise<{ id: string; clipId: string }>
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { clipId } = await params
  const clip = await fetchClip(clipId)
  if (!clip || !clip.videoUrl)
    return NextResponse.json(
      { error: "Vídeo não disponível" },
      { status: 400 }
    )

  // Force archive to S3 (will skip if already there)
  const archived = await archiveVideoToS3(clip)
  if (archived && archived !== clip.videoUrl) {
    await updateClip(clipId, { videoUrl: archived })
  }
  return NextResponse.json({
    ok: true,
    url: archived || clip.videoUrl,
  })
}
