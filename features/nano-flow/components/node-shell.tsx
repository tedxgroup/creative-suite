"use client"

import * as React from "react"
import { RiCloseLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useFlowStore } from "../store"

interface NodeShellProps {
  nodeId: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  selected?: boolean
  width?: number
  className?: string
  headerRight?: React.ReactNode
}

export function NodeShell({
  nodeId,
  icon: Icon,
  label,
  children,
  selected,
  width = 280,
  className,
  headerRight,
}: NodeShellProps) {
  const deleteNode = useFlowStore((s) => s.deleteNode)

  return (
    <div
      className={cn(
        "bg-card text-card-foreground border-border flex flex-col overflow-hidden rounded-lg border shadow-sm",
        selected && "ring-ring ring-2",
        className
      )}
      style={{ width }}
    >
      <div className="border-border bg-muted/30 flex items-center gap-2 border-b px-2.5 py-1.5">
        <Icon className="text-muted-foreground size-3.5" />
        <span className="text-muted-foreground font-mono text-[11px] font-semibold tracking-wider uppercase">
          {label}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {headerRight}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              deleteNode(nodeId)
            }}
            className="text-muted-foreground hover:text-foreground size-5"
            aria-label="Remover nó"
          >
            <RiCloseLine className="size-3" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-2.5">{children}</div>
    </div>
  )
}
