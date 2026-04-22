"use client"

import * as React from "react"
import { useReactFlow } from "@xyflow/react"
import { RiFocus3Line, RiZoomInLine, RiZoomOutLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { useFlowStore } from "../store"

function relativeTime(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (diff < 5) return "agora"
  if (diff < 60) return `há ${diff}s`
  const m = Math.floor(diff / 60)
  if (m < 60) return `há ${m}min`
  return `há ${Math.floor(m / 60)}h`
}

export function FlowToolbar() {
  const rf = useReactFlow()
  const isSaving = useFlowStore((s) => s.isSaving)
  const lastSavedAt = useFlowStore((s) => s.lastSavedAt)
  const [, tick] = React.useReducer((x) => x + 1, 0)

  React.useEffect(() => {
    const t = setInterval(tick, 10_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="bg-card/80 border-border pointer-events-auto flex items-center gap-1 rounded-md border p-1 shadow-sm backdrop-blur">
      <span className="text-muted-foreground px-1.5 text-[11px]">
        {isSaving
          ? "salvando..."
          : lastSavedAt
            ? `salvo ${relativeTime(lastSavedAt)}`
            : "não salvo"}
      </span>
      <div className="bg-border mx-0.5 h-4 w-px" />
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => rf.zoomIn()}
        aria-label="Zoom in"
      >
        <RiZoomInLine className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => rf.zoomOut()}
        aria-label="Zoom out"
      >
        <RiZoomOutLine className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => rf.fitView({ padding: 0.2, duration: 300 })}
        aria-label="Fit view"
      >
        <RiFocus3Line className="size-3.5" />
      </Button>
    </div>
  )
}
