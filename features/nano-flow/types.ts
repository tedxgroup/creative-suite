import type { Node, Edge } from "@xyflow/react"

export type ReferenceTag =
  | "pessoa"
  | "cenário"
  | "pose"
  | "ângulo"
  | "luz"
  | "estilo"
  | "objeto"

export const REFERENCE_TAGS: ReferenceTag[] = [
  "pessoa",
  "cenário",
  "pose",
  "ângulo",
  "luz",
  "estilo",
  "objeto",
]

export type AspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "2:3"
  | "3:2"

export const ASPECT_RATIOS: AspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "2:3",
  "3:2",
]

export type Resolution = "1K" | "2K" | "4K"
export const RESOLUTIONS: Resolution[] = ["1K", "2K", "4K"]

export const COPIES_RANGE = [1, 2, 3, 4] as const
export type Copies = (typeof COPIES_RANGE)[number]

export type FlowNodeKind = "generate" | "image" | "reference"

export type NodeStatus = "idle" | "loading" | "error"

export interface GeneratedResult {
  id: string
  url: string
}

export interface GenerateNodeData {
  kind: "generate"
  prompt: string
  aspect: AspectRatio
  resolution: Resolution
  copies: Copies
  status: NodeStatus
  error?: string
  [key: string]: unknown
}

export interface ImageNodeData {
  kind: "image"
  url: string
  generatedImageId: string
  aspect: AspectRatio
  prompt: string
  [key: string]: unknown
}

export interface ReferenceNodeData {
  kind: "reference"
  tag: ReferenceTag
  imageUrl: string | null
  label?: string
  [key: string]: unknown
}

export type FlowNodeData = GenerateNodeData | ImageNodeData | ReferenceNodeData

export type FlowNode = Node<FlowNodeData>
export type FlowEdge = Edge

export interface FlowViewport {
  x: number
  y: number
  zoom: number
}

export interface ImageFlow {
  id: string
  name: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: FlowViewport
  createdAt: string
  updatedAt: string
}

export interface ImageFlowSummary {
  id: string
  name: string
  updatedAt: string
  thumbnailUrl: string | null
}

export interface GeneratedImageRecord {
  id: string
  flowId: string
  nodeId: string
  url: string
  prompt: string
  refsUsed: Array<{ url: string; tag: ReferenceTag }>
  aspect: AspectRatio
  resolution: Resolution
  model: string
  createdAt: string
}
