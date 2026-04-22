import { supabaseAdmin } from "@/lib/supabase/server"
import type {
  FlowEdge,
  FlowNode,
  FlowViewport,
  GeneratedImageRecord,
  ImageFlow,
  ImageFlowSummary,
  ReferenceTag,
} from "../types"

function mapFlow(row: Record<string, any>): ImageFlow {
  return {
    id: row.id,
    name: row.name,
    nodes: (row.nodes ?? []) as FlowNode[],
    edges: (row.edges ?? []) as FlowEdge[],
    viewport: (row.viewport ?? { x: 0, y: 0, zoom: 1 }) as FlowViewport,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapGeneratedImage(row: Record<string, any>): GeneratedImageRecord {
  return {
    id: row.id,
    flowId: row.flow_id,
    nodeId: row.node_id,
    url: row.url,
    prompt: row.prompt,
    refsUsed: row.refs_used ?? [],
    aspect: row.aspect,
    resolution: row.resolution,
    model: row.model,
    createdAt: row.created_at,
  }
}

// =============================================
// FLOWS
// =============================================

export async function listFlows(): Promise<ImageFlowSummary[]> {
  const { data: flows, error } = await supabaseAdmin
    .from("image_flows")
    .select("id, name, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
  if (error) throw error
  if (!flows || flows.length === 0) return []

  const ids = flows.map((f) => f.id)
  const { data: thumbs } = await supabaseAdmin
    .from("generated_images")
    .select("flow_id, url, created_at")
    .in("flow_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const thumbByFlow = new Map<string, string>()
  ;(thumbs || []).forEach((t) => {
    if (!thumbByFlow.has(t.flow_id)) thumbByFlow.set(t.flow_id, t.url)
  })

  return flows.map((f) => ({
    id: f.id,
    name: f.name,
    updatedAt: f.updated_at,
    thumbnailUrl: thumbByFlow.get(f.id) ?? null,
  }))
}

export async function loadFlow(id: string): Promise<ImageFlow | null> {
  const { data, error } = await supabaseAdmin
    .from("image_flows")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  return data ? mapFlow(data) : null
}

export async function createFlow(name?: string): Promise<ImageFlow> {
  const { data, error } = await supabaseAdmin
    .from("image_flows")
    .insert({
      name: name || "Flow sem título",
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    })
    .select()
    .single()
  if (error) throw error
  return mapFlow(data)
}

export async function updateFlow(
  id: string,
  patch: Partial<{
    name: string
    nodes: FlowNode[]
    edges: FlowEdge[]
    viewport: FlowViewport
  }>
): Promise<{ updatedAt: string } | null> {
  const update: Record<string, any> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.nodes !== undefined) update.nodes = patch.nodes
  if (patch.edges !== undefined) update.edges = patch.edges
  if (patch.viewport !== undefined) update.viewport = patch.viewport

  const { data, error } = await supabaseAdmin
    .from("image_flows")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select("updated_at")
    .maybeSingle()
  if (error) throw error
  return data ? { updatedAt: data.updated_at } : null
}

export async function softDeleteFlow(id: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from("image_flows")
    .update({ deleted_at: now })
    .eq("id", id)
  if (error) throw error
  // Cascade soft-delete generated images
  await supabaseAdmin
    .from("generated_images")
    .update({ deleted_at: now })
    .eq("flow_id", id)
}

// =============================================
// GENERATED IMAGES
// =============================================

export interface CreateGeneratedImageInput {
  flowId: string
  nodeId: string
  url: string
  prompt: string
  refsUsed: Array<{ url: string; tag: ReferenceTag }>
  aspect: string
  resolution: string
  model?: string
}

export async function createGeneratedImage(
  input: CreateGeneratedImageInput
): Promise<GeneratedImageRecord> {
  const { data, error } = await supabaseAdmin
    .from("generated_images")
    .insert({
      flow_id: input.flowId,
      node_id: input.nodeId,
      url: input.url,
      prompt: input.prompt,
      refs_used: input.refsUsed,
      aspect: input.aspect,
      resolution: input.resolution,
      model: input.model ?? "gemini-3-pro-image-preview",
    })
    .select()
    .single()
  if (error) throw error
  return mapGeneratedImage(data)
}

// =============================================
// REFERENCE ASSETS
// =============================================

export interface CreateReferenceAssetInput {
  url: string
  storageKey: string
  mimeType: string
  sizeBytes: number
}

export async function createReferenceAsset(
  input: CreateReferenceAssetInput
): Promise<{ id: string; url: string }> {
  const { data, error } = await supabaseAdmin
    .from("reference_assets")
    .insert({
      url: input.url,
      storage_key: input.storageKey,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select("id, url")
    .single()
  if (error) throw error
  return { id: data.id, url: data.url }
}
