import type { AspectRatio, ReferenceTag } from "@/features/nano-flow/types"

export type GalleryItemKind = "image" | "reference"

export interface GalleryCategory {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
  itemCount?: number
}

export interface GalleryItem {
  id: string
  kind: GalleryItemKind
  url: string
  title: string | null
  notes: string | null
  tags: string[]
  aspect: AspectRatio | null
  refTag: ReferenceTag | null
  sourceFlowId: string | null
  sourceNodeId: string | null
  categories: GalleryCategory[]
  createdAt: string
  updatedAt: string
}

export interface GalleryItemSummary {
  id: string
  kind: GalleryItemKind
  url: string
  title: string | null
  aspect: AspectRatio | null
  refTag: ReferenceTag | null
  tags: string[]
  categories: Array<Pick<GalleryCategory, "id" | "name" | "color">>
  createdAt: string
}

export interface SaveGalleryItemInput {
  kind: GalleryItemKind
  url: string
  title?: string
  aspect?: AspectRatio | null
  refTag?: ReferenceTag | null
  sourceFlowId?: string
  sourceNodeId?: string
}

export interface UpdateGalleryItemInput {
  title?: string | null
  notes?: string | null
  tags?: string[]
  categoryIds?: string[]
}

export const CATEGORY_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#9ca3af", // gray (default)
] as const
