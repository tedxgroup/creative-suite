"use client"

import { nanoid } from "nanoid"
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react"
import { create } from "zustand"
import type {
  AspectRatio,
  FlowEdge,
  FlowNode,
  FlowNodeData,
  FlowViewport,
  GenerateNodeData,
  GeneratedResult,
  ImageNodeData,
  ReferenceNodeData,
  ReferenceTag,
} from "./types"

const IMAGE_NODE_WIDTH = 320
const REFERENCE_NODE_WIDTH = 180
const GENERATE_NODE_WIDTH = 380
const NODE_GAP_Y = 24
const NODE_GAP_X = 120
const COLLISION_GAP = 24
const LABEL_HEIGHT = 28

function aspectRatioValue(a: AspectRatio): number {
  const [w, h] = a.split(":").map(Number)
  return w / h
}

function imageNodeHeight(aspect: AspectRatio): number {
  return Math.round(IMAGE_NODE_WIDTH / aspectRatioValue(aspect))
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

function estimateNodeSize(node: FlowNode): { w: number; h: number } {
  const d = node.data
  if (d.kind === "image") {
    const aspect = (d as ImageNodeData).aspect
    return { w: IMAGE_NODE_WIDTH, h: imageNodeHeight(aspect) + LABEL_HEIGHT }
  }
  if (d.kind === "reference") {
    // Square image (width = height) + label + tag dropdown row (~40)
    return { w: REFERENCE_NODE_WIDTH, h: REFERENCE_NODE_WIDTH + LABEL_HEIGHT + 40 }
  }
  // generate
  return { w: GENERATE_NODE_WIDTH, h: 180 + LABEL_HEIGHT }
}

function overlaps(a: Box, b: Box): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  )
}

/**
 * Collect the given node plus every node reachable via outgoing edges.
 * Used to move a Generate node together with the images/branches it spawned.
 */
function collectSubgraph(
  rootIds: string[],
  nodes: FlowNode[],
  edges: FlowEdge[]
): Set<string> {
  const result = new Set<string>(rootIds)
  const queue = [...rootIds]
  while (queue.length) {
    const current = queue.shift()!
    for (const e of edges) {
      if (e.source === current && !result.has(e.target)) {
        result.add(e.target)
        queue.push(e.target)
      }
    }
  }
  return result
}

/**
 * Given a vertical column at `x` that wants to occupy [startY, startY+height],
 * find the smallest downward shift that clears any overlap with `others`.
 * Used when appending a batch of nodes to keep them together as one group.
 */
function shiftColumnDownToClear(
  others: FlowNode[],
  x: number,
  startY: number,
  width: number,
  height: number
): number {
  let y = startY
  for (let i = 0; i < 200; i++) {
    const box: Box = {
      x: x - COLLISION_GAP,
      y: y - COLLISION_GAP,
      w: width + COLLISION_GAP * 2,
      h: height + COLLISION_GAP * 2,
    }
    const blocker = others.find((n) => {
      const s = estimateNodeSize(n)
      return overlaps(box, {
        x: n.position.x,
        y: n.position.y,
        w: s.w,
        h: s.h,
      })
    })
    if (!blocker) return y
    const blockerSize = estimateNodeSize(blocker)
    y = blocker.position.y + blockerSize.h + COLLISION_GAP
  }
  return y
}

/** Find first node in `candidates` that overlaps the given box. */
function findCollider(
  candidates: FlowNode[],
  pos: { x: number; y: number },
  size: { w: number; h: number }
): FlowNode | null {
  const box: Box = {
    x: pos.x - COLLISION_GAP,
    y: pos.y - COLLISION_GAP,
    w: size.w + COLLISION_GAP * 2,
    h: size.h + COLLISION_GAP * 2,
  }
  for (const n of candidates) {
    const s = estimateNodeSize(n)
    if (
      overlaps(box, {
        x: n.position.x,
        y: n.position.y,
        w: s.w,
        h: s.h,
      })
    )
      return n
  }
  return null
}

/**
 * Find the closest non-overlapping slot for a new node. First tries vertical
 * offsets at the desired x (up/down, whichever is closer). If the nearest free
 * y is too far from the desired y, shifts x in the given direction (column-wise)
 * and retries, preferring proximity to the desired position.
 */
const MAX_Y_DISTANCE_BEFORE_X_SHIFT = 400
const X_SHIFT_STEP = 200

function findFreeSlot(
  nodes: FlowNode[],
  desired: { x: number; y: number },
  size: { w: number; h: number },
  xShift: number = 0
): { x: number; y: number } {
  const blockerAt = (x: number, y: number): FlowNode | null => {
    const candidate: Box = {
      x: x - COLLISION_GAP,
      y: y - COLLISION_GAP,
      w: size.w + COLLISION_GAP * 2,
      h: size.h + COLLISION_GAP * 2,
    }
    for (const n of nodes) {
      const s = estimateNodeSize(n)
      if (
        overlaps(candidate, {
          x: n.position.x,
          y: n.position.y,
          w: s.w,
          h: s.h,
        })
      ) {
        return n
      }
    }
    return null
  }

  interface Candidate {
    x: number
    y: number
    distance: number
  }

  const tryColumn = (colX: number): Candidate | null => {
    if (!blockerAt(colX, desired.y)) {
      return { x: colX, y: desired.y, distance: Math.abs(colX - desired.x) }
    }
    let upY = desired.y
    let upOK = false
    for (let i = 0; i < 100; i++) {
      const b = blockerAt(colX, upY)
      if (!b) {
        upOK = true
        break
      }
      upY = b.position.y - size.h - COLLISION_GAP
    }
    let downY = desired.y
    let downOK = false
    for (let i = 0; i < 100; i++) {
      const b = blockerAt(colX, downY)
      if (!b) {
        downOK = true
        break
      }
      const bSize = estimateNodeSize(b)
      downY = b.position.y + bSize.h + COLLISION_GAP
    }
    const candidates: Candidate[] = []
    if (upOK) {
      candidates.push({
        x: colX,
        y: upY,
        distance: Math.abs(upY - desired.y) + Math.abs(colX - desired.x),
      })
    }
    if (downOK) {
      candidates.push({
        x: colX,
        y: downY,
        distance: Math.abs(downY - desired.y) + Math.abs(colX - desired.x),
      })
    }
    if (candidates.length === 0) return null
    candidates.sort((a, b) => a.distance - b.distance)
    return candidates[0]
  }

  // Try desired column first
  const primary = tryColumn(desired.x)
  const primaryYDist = primary ? Math.abs(primary.y - desired.y) : Infinity

  if (primary && (primaryYDist <= MAX_Y_DISTANCE_BEFORE_X_SHIFT || xShift === 0)) {
    return { x: primary.x, y: primary.y }
  }

  // Primary column too cramped and we have an x-shift direction: try shifted columns
  const best: Candidate = primary ?? { x: desired.x, y: desired.y, distance: Infinity }
  let current: Candidate = best
  for (let i = 1; i <= 4; i++) {
    const shiftedX = desired.x + xShift * X_SHIFT_STEP * i
    const candidate = tryColumn(shiftedX)
    if (candidate && candidate.distance < current.distance) {
      current = candidate
    }
  }
  return { x: current.x, y: current.y }
}

interface FlowState {
  flowId: string | null
  name: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport: FlowViewport
  isSaving: boolean
  lastSavedAt: number | null
  dirty: boolean

  hydrate: (payload: {
    flowId: string
    name: string
    nodes: FlowNode[]
    edges: FlowEdge[]
    viewport: FlowViewport
  }) => void
  reset: () => void

  setName: (name: string) => void
  setViewport: (viewport: FlowViewport) => void

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void
  onConnect: (connection: Connection) => void

  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void
  addGenerateNode: (position: { x: number; y: number }) => string
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  appendImageNodes: (
    generateNodeId: string,
    results: GeneratedResult[],
    aspect: AspectRatio,
    refinedPrompt: string
  ) => string[]
  branchFromImage: (imageNodeId: string) => string | null
  createReferenceNode: (
    targetGenerateId: string,
    seed?: { imageUrl: string; tag?: ReferenceTag; label?: string }
  ) => string

  markClean: (at: number) => void
  markSaving: (saving: boolean) => void
}

function defaultGenerateData(): GenerateNodeData {
  return {
    kind: "generate",
    prompt: "",
    aspect: "16:9",
    resolution: "2K",
    copies: 1,
    status: "idle",
  }
}

function canConnect(
  sourceKind: string | undefined,
  targetKind: string | undefined
): boolean {
  if (!sourceKind || !targetKind) return false
  if (targetKind !== "generate") return false
  return sourceKind === "reference" || sourceKind === "image"
}

export const useFlowStore = create<FlowState>((set, get) => ({
  flowId: null,
  name: "Flow sem título",
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  isSaving: false,
  lastSavedAt: null,
  dirty: false,

  hydrate: (payload) =>
    set({
      flowId: payload.flowId,
      name: payload.name,
      nodes: payload.nodes,
      edges: payload.edges,
      viewport: payload.viewport,
      dirty: false,
      lastSavedAt: Date.now(),
    }),

  reset: () =>
    set({
      flowId: null,
      name: "Flow sem título",
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      dirty: false,
      lastSavedAt: null,
    }),

  setName: (name) => set({ name, dirty: true }),
  setViewport: (viewport) => set({ viewport, dirty: true }),

  onNodesChange: (changes) => {
    const next = applyNodeChanges(changes, get().nodes) as FlowNode[]
    const meaningful = changes.some(
      (c) => c.type !== "select" && c.type !== "dimensions"
    )
    set({ nodes: next, dirty: meaningful || get().dirty })
  },

  onEdgesChange: (changes) => {
    const next = applyEdgeChanges(changes, get().edges) as FlowEdge[]
    const meaningful = changes.some((c) => c.type !== "select")
    set({ edges: next, dirty: meaningful || get().dirty })
  },

  onConnect: (connection) => {
    const { edges, nodes } = get()
    const source = nodes.find((n) => n.id === connection.source)
    const target = nodes.find((n) => n.id === connection.target)
    if (!canConnect(source?.data.kind, target?.data.kind)) return
    // Prevent duplicate edges
    const exists = edges.some(
      (e) => e.source === connection.source && e.target === connection.target
    )
    if (exists) return
    const newEdge: FlowEdge = {
      ...connection,
      id: `e_${nanoid(8)}`,
      source: connection.source!,
      target: connection.target!,
    }
    set({ edges: addEdge(newEdge, edges) as FlowEdge[], dirty: true })
  },

  updateNodeData: (id, patch) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } as FlowNodeData } : n
      ),
      dirty: true,
    })
  },

  addGenerateNode: (position) => {
    const id = `n_${nanoid(8)}`
    const node: FlowNode = {
      id,
      type: "generate",
      position,
      data: defaultGenerateData(),
    }
    set({ nodes: [...get().nodes, node], dirty: true })
    return id
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      dirty: true,
    })
  },

  duplicateNode: (id) => {
    const source = get().nodes.find((n) => n.id === id)
    if (!source) return
    const copy: FlowNode = {
      ...source,
      id: `n_${nanoid(8)}`,
      position: { x: source.position.x + 40, y: source.position.y + 40 },
      selected: false,
      data:
        source.data.kind === "generate"
          ? { ...source.data, status: "idle", error: undefined }
          : { ...source.data },
    }
    set({ nodes: [...get().nodes, copy], dirty: true })
  },

  appendImageNodes: (generateNodeId, results, aspect, refinedPrompt) => {
    const { nodes, edges } = get()
    const source = nodes.find((n) => n.id === generateNodeId)
    if (!source) return []

    const imgH = imageNodeHeight(aspect) + LABEL_HEIGHT
    const baseX = source.position.x + GENERATE_NODE_WIDTH + NODE_GAP_X

    // Existing image children of THIS generate (stay where they are)
    const existingImageIds = edges
      .filter(
        (e) =>
          e.source === generateNodeId &&
          nodes.find((n) => n.id === e.target)?.data.kind === "image"
      )
      .map((e) => e.target)
    const existingImages = existingImageIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is FlowNode => !!n)

    const createdIds: string[] = []
    const newImages: FlowNode[] = results.map((r) => {
      const id = `n_${nanoid(8)}`
      createdIds.push(id)
      const data: ImageNodeData = {
        kind: "image",
        url: r.url,
        generatedImageId: r.id,
        aspect,
        prompt: refinedPrompt,
      }
      return {
        id,
        type: "image",
        position: { x: baseX, y: 0 },
        data,
      }
    })

    // Ideal starting y for the new batch:
    // - if there are existing siblings, place the batch just below the bottom-most
    // - otherwise, center the batch vertically around the source
    const newBatchH = newImages.length * imgH + (newImages.length - 1) * NODE_GAP_Y
    let idealStartY: number
    if (existingImages.length > 0) {
      const bottomMost = Math.max(
        ...existingImages.map(
          (n) => n.position.y + estimateNodeSize(n).h
        )
      )
      idealStartY = bottomMost + NODE_GAP_Y
    } else {
      const sourceH = estimateNodeSize(source).h
      const sourceCenterY = source.position.y + sourceH / 2
      idealStartY = sourceCenterY - newBatchH / 2
    }

    // Collision-avoid: shift the batch down past any non-sibling node that
    // overlaps the column for the full batch height.
    const siblingIds = new Set<string>([
      source.id,
      ...existingImageIds,
      ...createdIds,
    ])
    const others = nodes.filter((n) => !siblingIds.has(n.id))
    const startY = shiftColumnDownToClear(
      others,
      baseX,
      idealStartY,
      IMAGE_NODE_WIDTH,
      newBatchH
    )

    const placedNewImages = newImages.map((n, i) => ({
      ...n,
      position: { x: baseX, y: startY + i * (imgH + NODE_GAP_Y) },
    }))

    const newEdges: FlowEdge[] = createdIds.map((id) => ({
      id: `e_${nanoid(8)}`,
      source: generateNodeId,
      target: id,
    }))

    set({
      nodes: [...nodes, ...placedNewImages],
      edges: [...edges, ...newEdges],
      dirty: true,
    })
    return createdIds
  },

  branchFromImage: (imageNodeId) => {
    const { nodes, edges } = get()
    const source = nodes.find((n) => n.id === imageNodeId)
    if (!source || source.data.kind !== "image") return null
    const sourceData = source.data as ImageNodeData

    const genH = 180 + LABEL_HEIGHT
    const baseX = source.position.x + IMAGE_NODE_WIDTH + NODE_GAP_X

    // Existing Generate branches from this image, in edge order
    const existingBranchIds = edges
      .filter(
        (e) =>
          e.source === imageNodeId &&
          nodes.find((n) => n.id === e.target)?.data.kind === "generate"
      )
      .map((e) => e.target)
    const existingBranches = existingBranchIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is FlowNode => !!n)

    const newId = `n_${nanoid(8)}`
    const newData: GenerateNodeData = {
      kind: "generate",
      prompt: "",
      aspect: sourceData.aspect,
      resolution: "2K",
      copies: 1,
      status: "idle",
    }
    // Ideal y for the new branch: below the bottom-most existing branch,
    // or centered on the source image when there are none.
    let idealY: number
    if (existingBranches.length > 0) {
      const bottomMost = Math.max(
        ...existingBranches.map(
          (n) => n.position.y + estimateNodeSize(n).h
        )
      )
      idealY = bottomMost + NODE_GAP_Y
    } else {
      const sourceH = estimateNodeSize(source).h
      const sourceCenterY = source.position.y + sourceH / 2
      idealY = sourceCenterY - genH / 2
    }

    // Collision-avoid: push the new branch past any non-sibling node in the column
    const siblingIds = new Set<string>([source.id, ...existingBranchIds])
    const others = nodes.filter((n) => !siblingIds.has(n.id))
    const placedY = shiftColumnDownToClear(
      others,
      baseX,
      idealY,
      GENERATE_NODE_WIDTH,
      genH
    )

    const newBranch: FlowNode = {
      id: newId,
      type: "generate",
      position: { x: baseX, y: placedY },
      data: newData,
    }
    const newEdge: FlowEdge = {
      id: `e_${nanoid(8)}`,
      source: imageNodeId,
      target: newId,
    }
    set({
      nodes: [...nodes, newBranch],
      edges: [...edges, newEdge],
      dirty: true,
    })
    return newId
  },

  createReferenceNode: (targetGenerateId, seed) => {
    const { nodes, edges } = get()
    const target = nodes.find((n) => n.id === targetGenerateId)
    if (!target) return ""

    const refW = REFERENCE_NODE_WIDTH
    const refH = REFERENCE_NODE_WIDTH + LABEL_HEIGHT + 40
    const baseX = target.position.x - refW - NODE_GAP_X

    // Existing refs pointing at this Generate, preserved in their edge order
    const existingRefIds = edges
      .filter(
        (e) =>
          e.target === targetGenerateId &&
          nodes.find((n) => n.id === e.source)?.data.kind === "reference"
      )
      .map((e) => e.source)
    const existingRefs = existingRefIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is FlowNode => !!n)

    const newId = `n_${nanoid(8)}`
    const data: ReferenceNodeData = {
      kind: "reference",
      tag: seed?.tag ?? "pessoa",
      imageUrl: seed?.imageUrl ?? null,
      label: seed?.label,
    }
    const newRef: FlowNode = {
      id: newId,
      type: "reference",
      position: { x: baseX, y: 0 },
      data,
    }

    const allRefs = [...existingRefs, newRef]
    const targetH = estimateNodeSize(target).h
    const targetCenterY = target.position.y + targetH / 2
    const totalH = allRefs.length * refH + (allRefs.length - 1) * NODE_GAP_Y
    const startY = targetCenterY - totalH / 2

    const positionY = new Map<string, number>()
    allRefs.forEach((n, i) => {
      positionY.set(n.id, startY + i * (refH + NODE_GAP_Y))
    })

    const updatedNodes = nodes.map((n) =>
      positionY.has(n.id)
        ? { ...n, position: { x: baseX, y: positionY.get(n.id)! } }
        : n
    )
    const placedNewRef = {
      ...newRef,
      position: { x: baseX, y: positionY.get(newId)! },
    }
    const newEdge: FlowEdge = {
      id: `e_${nanoid(8)}`,
      source: newId,
      target: targetGenerateId,
    }
    set({
      nodes: [...updatedNodes, placedNewRef],
      edges: [...edges, newEdge],
      dirty: true,
    })
    return newId
  },

  markClean: (at) => set({ dirty: false, lastSavedAt: at }),
  markSaving: (saving) => set({ isSaving: saving }),
}))

export type { ReferenceTag }
