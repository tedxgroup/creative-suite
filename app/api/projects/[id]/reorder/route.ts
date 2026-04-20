import { NextRequest, NextResponse } from "next/server"
import { reorderClips, loadProject } from "@/lib/db"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { clipIds } = await req.json()
  if (!Array.isArray(clipIds))
    return NextResponse.json(
      { error: "clipIds é obrigatório" },
      { status: 400 }
    )
  try {
    await reorderClips(id, clipIds)
    const project = await loadProject(id)
    return NextResponse.json(project)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
