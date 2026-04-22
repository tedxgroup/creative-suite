import { NextRequest, NextResponse } from "next/server"
import { deleteCategory, updateCategory } from "@/features/gallery/lib/db"
import { categoryPatchSchema } from "@/features/gallery/lib/validators"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = categoryPatchSchema.parse(body)
    const category = await updateCategory(id, parsed)
    if (!category)
      return NextResponse.json(
        { error: "Categoria não encontrada" },
        { status: 404 }
      )
    return NextResponse.json({ category })
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
    await deleteCategory(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
