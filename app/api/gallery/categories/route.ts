import { NextRequest, NextResponse } from "next/server"
import { createCategory, listCategories } from "@/features/gallery/lib/db"
import { categoryInputSchema } from "@/features/gallery/lib/validators"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const categories = await listCategories()
    return NextResponse.json({ categories })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = categoryInputSchema.parse(body)
    const category = await createCategory(parsed.name, parsed.color)
    return NextResponse.json({ category })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
