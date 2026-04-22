"use client"

import * as React from "react"
import { useFlowStore } from "../store"

const DEBOUNCE_MS = 800

export function useAutosave(flowId: string | null) {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const viewport = useFlowStore((s) => s.viewport)
  const name = useFlowStore((s) => s.name)
  const dirty = useFlowStore((s) => s.dirty)
  const markSaving = useFlowStore((s) => s.markSaving)
  const markClean = useFlowStore((s) => s.markClean)

  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (!flowId) return
    if (!dirty) return

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      markSaving(true)
      try {
        const res = await fetch(`/api/flows/${flowId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, nodes, edges, viewport }),
        })
        if (res.ok) markClean(Date.now())
      } catch {
        // swallow — next change will retry
      } finally {
        markSaving(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [flowId, dirty, nodes, edges, viewport, name, markSaving, markClean])
}
