import { NextRequest, NextResponse } from "next/server"
import { loadProject, updateClip } from "@/lib/db"
import {
  submitVeoClip,
  submitInfiniteTalkClip,
  submitGeminiVeoClip,
} from "@/lib/providers"
import { KIE_API_KEY, GEMINI_API_KEY, WAVESPEED_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"
export const maxDuration = 300

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const project = await loadProject(id)
  if (!project)
    return NextResponse.json(
      { error: "Projeto não encontrado" },
      { status: 404 }
    )

  const body = await req.json().catch(() => ({}))
  const pendingClips = project.clips.filter(
    (c) => c.status === "pending" || c.status === "fail"
  )
  const results: any[] = []

  for (const clip of pendingClips) {
    const isInfiniteTalk = (clip.model || "veo3") === "infinitetalk"
    try {
      let result: { taskId: string; provider?: string }
      if (isInfiniteTalk) {
        if (!WAVESPEED_API_KEY)
          throw new Error("WAVESPEED_API_KEY não configurada")
        result = await submitInfiniteTalkClip(clip, body)
        result.provider = "wavespeed"
      } else {
        try {
          if (!KIE_API_KEY) throw new Error("KIE_API_KEY não configurada")
          result = await submitVeoClip(clip, body)
          result.provider = "kie"
        } catch (kieErr: any) {
          console.log(`[gen-all] KIE failed ${clip.id}: ${kieErr.message}`)
          if (!GEMINI_API_KEY) throw kieErr
          result = await submitGeminiVeoClip(clip, body)
          result.provider = "gemini"
        }
      }
      await updateClip(clip.id, {
        taskId: result.taskId,
        provider: result.provider as any,
        status: "submitted",
        error: null,
      })
      results.push({ clipId: clip.id, status: "submitted", provider: result.provider })
      await new Promise((r) => setTimeout(r, 500))
    } catch (err: any) {
      await updateClip(clip.id, {
        status: "fail",
        error: err.message,
      })
      results.push({ clipId: clip.id, status: "fail", error: err.message })
    }
  }

  return NextResponse.json({ submitted: results.length, results })
}
