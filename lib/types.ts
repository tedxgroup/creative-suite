// Domain types for Creative Suite

export type ClipModel = "veo3" | "infinitetalk"
export type ClipStatus =
  | "pending"
  | "submitted"
  | "generating"
  | "success"
  | "fail"
export type ClipProvider = "kie" | "gemini" | "wavespeed"

export type ClipKind = "talking_head" | "broll"

export interface SuggestedProp {
  tag: "pessoa" | "cenário" | "pose" | "ângulo" | "luz" | "estilo" | "objeto"
  description: string
}

export type ClipCategory =
  | "hook1"
  | "hook2"
  | "hook3"
  | "hook4"
  | "hook5"
  | "broll"

export const CLIP_CATEGORY_LABEL: Record<ClipCategory, string> = {
  hook1: "Hook 1",
  hook2: "Hook 2",
  hook3: "Hook 3",
  hook4: "Hook 4",
  hook5: "Hook 5",
  broll: "Broll",
}

export const CLIP_CATEGORIES: ClipCategory[] = [
  "hook1",
  "hook2",
  "hook3",
  "hook4",
  "hook5",
  "broll",
]

export interface VideoClip {
  id: string
  order: number
  model?: ClipModel
  imageUrl: string | null
  audioUrl?: string | null
  prompt: string
  dialogue?: string | null
  status: ClipStatus
  taskId: string | null
  provider?: ClipProvider
  videoUrl: string | null
  localPath?: string
  error: string | null
  trimStart?: number
  trimEnd?: number
  tagged?: boolean
  category?: ClipCategory | null
  regenerated?: boolean
  kind?: ClipKind
  visualDirection?: string | null
  suggestedProps?: SuggestedProp[]
  createdAt: string
}

export interface SceneDraftScene {
  id: number
  dialogue: string
  prompt: string
  imageUrl: string | null
}

export interface SceneDraft {
  script: string
  baseImageUrl: string | null
  scenes: SceneDraftScene[]
  updatedAt: string
}

export interface VideoProject {
  id: string
  name: string
  createdBy?: string | null
  baseAvatarUrl?: string | null
  copyText?: string | null
  sceneFlowId?: string | null
  sceneDraft?: SceneDraft | null
  createdAt: string
  clips: VideoClip[]
}

export interface VoiceHistoryItem {
  id: string
  type: "tts" | "voice-changer"
  voiceId: string
  voiceName: string
  text?: string
  inputAudioUrl?: string
  outputUrl: string
  createdAt: string
}
