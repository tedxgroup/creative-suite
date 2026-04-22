import { NextRequest, NextResponse } from "next/server"
import { deleteItem, getItem, updateItem } from "@/features/gallery/lib/db"
import { updateItemSchema } from "@/features/gallery/lib/validators"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const item = await getItem(id)
    if (!item)
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    return NextResponse.json(item)
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
    const parsed = updateItemSchema.parse(body)
    const item = await updateItem(id, parsed)
    if (!item)
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 })
    return NextResponse.json(item)
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
    await deleteItem(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
