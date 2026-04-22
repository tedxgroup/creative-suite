import { NextRequest, NextResponse } from "next/server"
import { loadFlow, softDeleteFlow, updateFlow } from "@/features/nano-flow/lib/db"
import { flowPatchSchema } from "@/features/nano-flow/lib/validators"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const flow = await loadFlow(id)
    if (!flow)
      return NextResponse.json({ error: "Flow não encontrado" }, { status: 404 })
    return NextResponse.json(flow)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const patch = flowPatchSchema.parse(body)
    const result = await updateFlow(id, patch)
    if (!result)
      return NextResponse.json({ error: "Flow não encontrado" }, { status: 404 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await softDeleteFlow(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
