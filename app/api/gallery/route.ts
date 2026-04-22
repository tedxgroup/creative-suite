import { NextRequest, NextResponse } from "next/server"
import { listItems, saveItem } from "@/features/gallery/lib/db"
import { saveItemSchema } from "@/features/gallery/lib/validators"
import type { GalleryItemKind } from "@/features/gallery/types"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const kindParam = url.searchParams.get("kind")
    const categoryId = url.searchParams.get("category") || undefined
    const tag = url.searchParams.get("tag") || undefined
    const search = url.searchParams.get("q") || undefined
    const kind =
      kindParam === "image" || kindParam === "reference"
        ? (kindParam as GalleryItemKind)
        : undefined

    const items = await listItems({ kind, categoryId, tag, search })
    return NextResponse.json({ items })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = saveItemSchema.parse(body)
    const item = await saveItem(parsed as any)
    return NextResponse.json({ item })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
