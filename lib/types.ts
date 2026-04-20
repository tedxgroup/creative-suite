// Domain types for Creative Suite

export type ClipModel = "veo3" | "infinitetalk"
export type ClipStatus =
  | "pending"
  | "submitted"
  | "generating"
  | "success"
  | "fail"
export type ClipProvider = "kie" | "gemini" | "wavespeed"

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
  regenerated?: boolean
  createdAt: string
}

export interface VideoProject {
  id: string
  name: string
  createdBy?: string | null
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
