import { NextRequest, NextResponse } from "next/server"
import { updateProjectSceneDraft } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * PATCH body: { draft: SceneDraft | null }
 * Saves or clears the bulk-scenes-dialog draft for this project.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const draft = body?.draft ?? null
    await updateProjectSceneDraft(id, draft)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
