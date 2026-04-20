import { NextRequest, NextResponse } from "next/server"
import { fetchClip, updateClip } from "@/lib/db"
import {
  submitVeoClip,
  submitInfiniteTalkClip,
  submitGeminiVeoClip,
} from "@/lib/providers"
import { KIE_API_KEY, GEMINI_API_KEY, WAVESPEED_API_KEY } from "@/lib/env"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ id: string; clipId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const { clipId } = await params
  const clip = await fetchClip(clipId)
  if (!clip)
    return NextResponse.json(
      { error: "Clip não encontrado" },
      { status: 404 }
    )

  const isInfiniteTalk = (clip.model || "veo3") === "infinitetalk"
  const body = await req.json().catch(() => ({}))

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
        console.log(`[generate] KIE failed for ${clip.id}: ${kieErr.message}`)
        if (!GEMINI_API_KEY) throw kieErr
        result = await submitGeminiVeoClip(clip, body)
        result.provider = "gemini"
      }
    }

    const updated = await updateClip(clipId, {
      taskId: result.taskId,
      provider: (result.provider as any) || (isInfiniteTalk ? "wavespeed" : "kie"),
      status: "submitted",
      error: null,
    })
    return NextResponse.json(updated)
  } catch (err: any) {
    const updated = await updateClip(clipId, {
      status: "fail",
      error: err.message,
    })
    return NextResponse.json(updated, { status: 500 })
  }
}
