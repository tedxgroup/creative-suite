"use client"

import { useReactFlow } from "@xyflow/react"
import { useCallback } from "react"

/**
 * Animate the viewport to include the given node IDs.
 * Defers one frame so newly-added nodes have their measured dimensions.
 */
export function useFocusNodes() {
  const rf = useReactFlow()
  return useCallback(
    (ids: string[], opts?: { padding?: number; duration?: number; maxZoom?: number }) => {
      if (ids.length === 0) return
      // Two rAFs to ensure React Flow has measured the new nodes
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          rf.fitView({
            nodes: ids.map((id) => ({ id })),
            padding: opts?.padding ?? 0.25,
            duration: opts?.duration ?? 400,
            maxZoom: opts?.maxZoom ?? 1.2,
          })
        })
      })
    },
    [rf]
  )
}
