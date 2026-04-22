import { supabaseAdmin } from "@/lib/supabase/server"
import type {
  GalleryCategory,
  GalleryItem,
  GalleryItemKind,
  GalleryItemSummary,
  SaveGalleryItemInput,
  UpdateGalleryItemInput,
} from "../types"
import type { AspectRatio, ReferenceTag } from "@/features/nano-flow/types"

function mapCategory(row: Record<string, any>): GalleryCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    itemCount: row.item_count,
  }
}

function mapItem(
  row: Record<string, any>,
  categories: GalleryCategory[] = []
): GalleryItem {
  return {
    id: row.id,
    kind: row.kind as GalleryItemKind,
    url: row.url,
    title: row.title ?? null,
    notes: row.notes ?? null,
    tags: (row.tags as string[]) ?? [],
    aspect: (row.aspect ?? null) as AspectRatio | null,
    refTag: (row.ref_tag ?? null) as ReferenceTag | null,
    sourceFlowId: row.source_flow_id ?? null,
    sourceNodeId: row.source_node_id ?? null,
    categories,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function summarize(item: GalleryItem): GalleryItemSummary {
  return {
    id: item.id,
    kind: item.kind,
    url: item.url,
    title: item.title,
    aspect: item.aspect,
    refTag: item.refTag,
    tags: item.tags,
    categories: item.categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    createdAt: item.createdAt,
  }
}

// =============================================
// CATEGORIES
// =============================================

export async function listCategories(): Promise<GalleryCategory[]> {
  const { data, error } = await supabaseAdmin
    .from("gallery_categories")
    .select("*")
    .order("name", { ascending: true })
  if (error) throw error
  if (!data || data.length === 0) return []

  // Count items per category
  const { data: counts } = await supabaseAdmin
    .from("gallery_item_categories")
    .select("category_id")

  const counter = new Map<string, number>()
  for (const row of counts ?? []) {
    counter.set(row.category_id, (counter.get(row.category_id) ?? 0) + 1)
  }

  return data.map((row) =>
    mapCategory({ ...row, item_count: counter.get(row.id) ?? 0 })
  )
}

export async function createCategory(
  name: string,
  color: string
): Promise<GalleryCategory> {
  const { data, error } = await supabaseAdmin
    .from("gallery_categories")
    .insert({ name, color })
    .select()
    .single()
  if (error) throw error
  return mapCategory({ ...data, item_count: 0 })
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string }
): Promise<GalleryCategory | null> {
  const update: Record<string, any> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.color !== undefined) update.color = patch.color
  const { data, error } = await supabaseAdmin
    .from("gallery_categories")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? mapCategory(data) : null
}

export async function deleteCategory(id: string): Promise<void> {
  // Cascade deletes join rows
  const { error } = await supabaseAdmin
    .from("gallery_categories")
    .delete()
    .eq("id", id)
  if (error) throw error
}

// =============================================
// ITEMS
// =============================================

async function hydrateCategoriesFor(itemIds: string[]): Promise<Map<string, GalleryCategory[]>> {
  const result = new Map<string, GalleryCategory[]>()
  if (itemIds.length === 0) return result

  const { data: joins, error } = await supabaseAdmin
    .from("gallery_item_categories")
    .select("item_id, category_id, gallery_categories(id, name, color, created_at, updated_at)")
    .in("item_id", itemIds)
  if (error) throw error

  for (const row of joins ?? []) {
    const cat = (row as any).gallery_categories
    if (!cat) continue
    const list = result.get(row.item_id) ?? []
    list.push(mapCategory(cat))
    result.set(row.item_id, list)
  }
  for (const list of result.values()) list.sort((a, b) => a.name.localeCompare(b.name))
  return result
}

export interface ListItemsFilter {
  kind?: GalleryItemKind
  categoryId?: string
  tag?: string
  search?: string
}

export async function listItems(
  filter: ListItemsFilter = {}
): Promise<GalleryItemSummary[]> {
  let query = supabaseAdmin
    .from("gallery_items")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (filter.kind) query = query.eq("kind", filter.kind)
  if (filter.search) {
    query = query.or(`title.ilike.%${filter.search}%,notes.ilike.%${filter.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  if (!data) return []

  let rows = data

  // Optional category filter (post-fetch for simplicity)
  if (filter.categoryId) {
    const { data: joins } = await supabaseAdmin
      .from("gallery_item_categories")
      .select("item_id")
      .eq("category_id", filter.categoryId)
    const ids = new Set((joins ?? []).map((j) => j.item_id))
    rows = rows.filter((r) => ids.has(r.id))
  }

  if (filter.tag) {
    rows = rows.filter((r) =>
      (r.tags as string[] | null)?.some(
        (t) => t.toLowerCase() === filter.tag!.toLowerCase()
      )
    )
  }

  const ids = rows.map((r) => r.id)
  const cats = await hydrateCategoriesFor(ids)

  return rows.map((r) => summarize(mapItem(r, cats.get(r.id) ?? [])))
}

export async function getItem(id: string): Promise<GalleryItem | null> {
  const { data, error } = await supabaseAdmin
    .from("gallery_items")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const cats = await hydrateCategoriesFor([data.id])
  return mapItem(data, cats.get(data.id) ?? [])
}

export async function getItemByUrl(url: string): Promise<GalleryItem | null> {
  const { data, error } = await supabaseAdmin
    .from("gallery_items")
    .select("*")
    .eq("url", url)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const cats = await hydrateCategoriesFor([data.id])
  return mapItem(data, cats.get(data.id) ?? [])
}

export async function saveItem(
  input: SaveGalleryItemInput
): Promise<GalleryItem> {
  // Upsert-ish: if already saved, return existing
  const existing = await getItemByUrl(input.url)
  if (existing) return existing

  const { data, error } = await supabaseAdmin
    .from("gallery_items")
    .insert({
      kind: input.kind,
      url: input.url,
      title: input.title ?? null,
      aspect: input.aspect ?? null,
      ref_tag: input.refTag ?? null,
      source_flow_id: input.sourceFlowId ?? null,
      source_node_id: input.sourceNodeId ?? null,
      tags: [],
    })
    .select()
    .single()
  if (error) throw error
  return mapItem(data, [])
}

export async function updateItem(
  id: string,
  patch: UpdateGalleryItemInput
): Promise<GalleryItem | null> {
  const update: Record<string, any> = {}
  if (patch.title !== undefined) update.title = patch.title
  if (patch.notes !== undefined) update.notes = patch.notes
  if (patch.tags !== undefined) update.tags = patch.tags

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin
      .from("gallery_items")
      .update(update)
      .eq("id", id)
    if (error) throw error
  }

  if (patch.categoryIds !== undefined) {
    // Replace the category set
    const { error: delErr } = await supabaseAdmin
      .from("gallery_item_categories")
      .delete()
      .eq("item_id", id)
    if (delErr) throw delErr

    if (patch.categoryIds.length > 0) {
      const rows = patch.categoryIds.map((cid) => ({
        item_id: id,
        category_id: cid,
      }))
      const { error: insErr } = await supabaseAdmin
        .from("gallery_item_categories")
        .insert(rows)
      if (insErr) throw insErr
    }
  }

  return getItem(id)
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("gallery_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}
