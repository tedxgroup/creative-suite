import { supabaseAdmin } from "./supabase/server"
import type {
  VideoProject,
  VideoClip,
  VoiceHistoryItem,
  ClipModel,
  ClipStatus,
  ClipProvider,
  ClipKind,
  SuggestedProp,
} from "./types"

// =============================================
// Mappers (DB row → domain type)
// =============================================
function mapClip(row: Record<string, any>): VideoClip {
  return {
    id: row.id,
    order: row.order,
    model: row.model as ClipModel,
    imageUrl: row.image_url ?? null,
    audioUrl: row.audio_url ?? null,
    prompt: row.prompt ?? "",
    dialogue: row.dialogue ?? null,
    status: row.status as ClipStatus,
    taskId: row.task_id ?? null,
    provider: row.provider as ClipProvider | undefined,
    videoUrl: row.video_url ?? null,
    localPath: row.local_path ?? undefined,
    error: row.error ?? null,
    trimStart: row.trim_start != null ? Number(row.trim_start) : undefined,
    trimEnd: row.trim_end != null ? Number(row.trim_end) : undefined,
    tagged: row.tagged ?? false,
    category: row.category ?? null,
    regenerated: row.regenerated ?? false,
    kind: (row.kind as ClipKind) ?? "talking_head",
    visualDirection: row.visual_direction ?? null,
    suggestedProps: (row.suggested_props as SuggestedProp[]) ?? [],
    createdAt: row.created_at,
  }
}

function mapProject(row: Record<string, any>, clips: VideoClip[] = []): VideoProject {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by ?? null,
    baseAvatarUrl: row.base_avatar_url ?? null,
    copyText: row.copy_text ?? null,
    sceneFlowId: row.scene_flow_id ?? null,
    sceneDraft: row.scene_draft ?? null,
    createdAt: row.created_at,
    clips,
  }
}

export async function updateProjectSceneDraft(
  id: string,
  draft: unknown | null
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("video_projects")
    .update({ scene_draft: draft })
    .eq("id", id)
  if (error) throw error
}

// =============================================
// PROJECTS
// =============================================

export async function loadProjects(): Promise<VideoProject[]> {
  // Fetch projects + all clips
  const { data: projects, error } = await supabaseAdmin
    .from("video_projects")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error

  if (!projects || projects.length === 0) return []

  const projectIds = projects.map((p) => p.id)
  const { data: clipsRaw, error: cErr } = await supabaseAdmin
    .from("video_clips")
    .select("*")
    .in("project_id", projectIds)
    .order("order", { ascending: true })
  if (cErr) throw cErr

  const clipsByProject = new Map<string, VideoClip[]>()
  ;(clipsRaw || []).forEach((c) => {
    const arr = clipsByProject.get(c.project_id) || []
    arr.push(mapClip(c))
    clipsByProject.set(c.project_id, arr)
  })

  return projects.map((p) => mapProject(p, clipsByProject.get(p.id) || []))
}

export async function loadProject(id: string): Promise<VideoProject | null> {
  const { data: project, error } = await supabaseAdmin
    .from("video_projects")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!project) return null

  const { data: clips, error: cErr } = await supabaseAdmin
    .from("video_clips")
    .select("*")
    .eq("project_id", id)
    .order("order", { ascending: true })
  if (cErr) throw cErr

  return mapProject(project, (clips || []).map(mapClip))
}

export async function createProject(name: string, userId?: string | null): Promise<VideoProject> {
  const { data, error } = await supabaseAdmin
    .from("video_projects")
    .insert({ name, created_by: userId || null })
    .select()
    .single()
  if (error) throw error
  return mapProject(data, [])
}

export async function updateProjectName(id: string, name: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("video_projects")
    .update({ name })
    .eq("id", id)
  if (error) throw error
}

export async function updateProjectAgentState(
  id: string,
  patch: {
    baseAvatarUrl?: string | null
    copyText?: string | null
    sceneFlowId?: string | null
  }
): Promise<void> {
  const update: Record<string, any> = {}
  if (patch.baseAvatarUrl !== undefined) update.base_avatar_url = patch.baseAvatarUrl
  if (patch.copyText !== undefined) update.copy_text = patch.copyText
  if (patch.sceneFlowId !== undefined) update.scene_flow_id = patch.sceneFlowId
  if (Object.keys(update).length === 0) return
  const { error } = await supabaseAdmin
    .from("video_projects")
    .update(update)
    .eq("id", id)
  if (error) throw error
}

export async function deleteProject(id: string): Promise<void> {
  // Cascade deletes clips automatically
  const { error } = await supabaseAdmin
    .from("video_projects")
    .delete()
    .eq("id", id)
  if (error) throw error
}

// =============================================
// CLIPS
// =============================================

export interface CreateClipInput {
  projectId: string
  model: ClipModel
  imageUrl?: string | null
  audioUrl?: string | null
  prompt: string
  dialogue?: string | null
  order?: number
  kind?: ClipKind
  visualDirection?: string | null
  suggestedProps?: SuggestedProp[]
  category?: string | null
}

export async function createClip(input: CreateClipInput): Promise<VideoClip> {
  // Compute order if not provided
  let order = input.order
  if (order == null) {
    const { count } = await supabaseAdmin
      .from("video_clips")
      .select("*", { count: "exact", head: true })
      .eq("project_id", input.projectId)
    order = (count || 0) + 1
  }

  const { data, error } = await supabaseAdmin
    .from("video_clips")
    .insert({
      project_id: input.projectId,
      model: input.model,
      image_url: input.imageUrl ?? null,
      audio_url: input.audioUrl ?? null,
      prompt: input.prompt,
      dialogue: input.dialogue ?? null,
      order,
      status: "pending",
      kind: input.kind ?? "talking_head",
      visual_direction: input.visualDirection ?? null,
      suggested_props: input.suggestedProps ?? [],
      category: input.category ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return mapClip(data)
}

export async function updateClip(
  clipId: string,
  patch: Partial<{
    imageUrl: string | null
    audioUrl: string | null
    prompt: string
    dialogue: string | null
    order: number
    status: ClipStatus
    taskId: string | null
    provider: ClipProvider | null
    videoUrl: string | null
    localPath: string | null
    error: string | null
    trimStart: number | null
    trimEnd: number | null
    tagged: boolean
    category: string | null
    regenerated: boolean
    kind: ClipKind
    visualDirection: string | null
    suggestedProps: SuggestedProp[]
  }>
): Promise<VideoClip | null> {
  const update: Record<string, any> = {}
  if (patch.imageUrl !== undefined) update.image_url = patch.imageUrl
  if (patch.audioUrl !== undefined) update.audio_url = patch.audioUrl
  if (patch.prompt !== undefined) update.prompt = patch.prompt
  if (patch.dialogue !== undefined) update.dialogue = patch.dialogue
  if (patch.order !== undefined) update.order = patch.order
  if (patch.status !== undefined) update.status = patch.status
  if (patch.taskId !== undefined) update.task_id = patch.taskId
  if (patch.provider !== undefined) update.provider = patch.provider
  if (patch.videoUrl !== undefined) update.video_url = patch.videoUrl
  if (patch.localPath !== undefined) update.local_path = patch.localPath
  if (patch.error !== undefined) update.error = patch.error
  if (patch.trimStart !== undefined) update.trim_start = patch.trimStart
  if (patch.kind !== undefined) update.kind = patch.kind
  if (patch.visualDirection !== undefined) update.visual_direction = patch.visualDirection
  if (patch.suggestedProps !== undefined) update.suggested_props = patch.suggestedProps
  if (patch.trimEnd !== undefined) update.trim_end = patch.trimEnd
  if (patch.tagged !== undefined) update.tagged = patch.tagged
  if (patch.category !== undefined) update.category = patch.category
  if (patch.regenerated !== undefined) update.regenerated = patch.regenerated

  const { data, error } = await supabaseAdmin
    .from("video_clips")
    .update(update)
    .eq("id", clipId)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? mapClip(data) : null
}

export async function deleteClip(clipId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("video_clips")
    .delete()
    .eq("id", clipId)
  if (error) throw error
}

export async function fetchClip(clipId: string): Promise<VideoClip | null> {
  const { data, error } = await supabaseAdmin
    .from("video_clips")
    .select("*")
    .eq("id", clipId)
    .maybeSingle()
  if (error) throw error
  return data ? mapClip(data) : null
}

/** Reorder clips by setting new order values */
export async function reorderClips(
  projectId: string,
  orderedIds: string[]
): Promise<void> {
  // Bulk update in parallel
  await Promise.all(
    orderedIds.map((id, idx) =>
      supabaseAdmin
        .from("video_clips")
        .update({ order: idx + 1 })
        .eq("id", id)
        .eq("project_id", projectId)
    )
  )
}

// =============================================
// VOICE HISTORY
// =============================================

function mapVoice(row: Record<string, any>): VoiceHistoryItem {
  return {
    id: row.id,
    type: row.type,
    voiceId: row.voice_id,
    voiceName: row.voice_name,
    text: row.text ?? undefined,
    inputAudioUrl: row.input_audio_url ?? undefined,
    outputUrl: row.output_url,
    createdAt: row.created_at,
  }
}

export async function loadVoiceHistory(): Promise<VoiceHistoryItem[]> {
  const { data, error } = await supabaseAdmin
    .from("voice_history")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data || []).map(mapVoice)
}

export async function createVoiceHistoryItem(
  item: Omit<VoiceHistoryItem, "id" | "createdAt">
): Promise<VoiceHistoryItem> {
  const { data, error } = await supabaseAdmin
    .from("voice_history")
    .insert({
      type: item.type,
      voice_id: item.voiceId,
      voice_name: item.voiceName,
      text: item.text ?? null,
      input_audio_url: item.inputAudioUrl ?? null,
      output_url: item.outputUrl,
    })
    .select()
    .single()
  if (error) throw error
  return mapVoice(data)
}

export async function deleteVoiceHistoryItem(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("voice_history")
    .delete()
    .eq("id", id)
  if (error) throw error
}
