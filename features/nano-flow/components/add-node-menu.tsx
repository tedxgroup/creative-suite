"use client"

import * as React from "react"
import { useReactFlow } from "@xyflow/react"
import { RiImageCircleAiLine } from "@remixicon/react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useFlowStore } from "../store"

interface CanvasContextMenuProps {
  children: React.ReactNode
}

export function CanvasContextMenu({ children }: CanvasContextMenuProps) {
  const addGenerateNode = useFlowStore((s) => s.addGenerateNode)
  const rf = useReactFlow()
  const lastPos = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  function handleContextMenu(e: React.MouseEvent) {
    // If right-click happened inside a node, the node's own ContextMenu handles it.
    // We preventDefault so this canvas-level menu doesn't also open on top.
    const target = e.target as HTMLElement | null
    if (target?.closest(".react-flow__node")) {
      e.preventDefault()
      return
    }
    lastPos.current = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        <div className="h-full w-full">{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={() => addGenerateNode({ ...lastPos.current })}>
          <RiImageCircleAiLine className="size-3.5" />
          Novo gerador
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
