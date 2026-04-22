"use client"

import * as React from "react"
import Image from "next/image"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  RiBookmarkLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiImage2Line,
  RiShuffleLine,
} from "@remixicon/react"
import { toast } from "sonner"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/lib/utils"
import { useFocusNodes } from "../hooks/use-focus-nodes"
import { useFlowStore } from "../store"
import type { AspectRatio, FlowNode, ImageNodeData } from "../types"

const IMAGE_NODE_WIDTH = 320

function aspectRatioValue(a: AspectRatio): number {
  const [w, h] = a.split(":").map(Number)
  return w / h
}

export function ImageNode(props: NodeProps<FlowNode>) {
  const { id, selected } = props
  const data = props.data as ImageNodeData
  const nodes = useFlowStore((s) => s.nodes)
  const flowId = useFlowStore((s) => s.flowId)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const branchFromImage = useFlowStore((s) => s.branchFromImage)
  const focusNodes = useFocusNodes()

  const index = React.useMemo(
    () =>
      nodes.filter((n) => n.data.kind === "image").findIndex((n) => n.id === id) + 1,
    [nodes, id]
  )

  async function saveToGallery() {
    try {
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "image",
          url: data.url,
          aspect: data.aspect,
          sourceFlowId: flowId,
          sourceNodeId: id,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Falha ao salvar")
      }
      toast.success("Salvo na galeria")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="group/node flex flex-col gap-2"
          style={{ width: IMAGE_NODE_WIDTH }}
        >
          <Handle
            type="target"
            position={Position.Left}
            className="!bg-muted-foreground/40 !h-2 !w-2 !border-0"
          />
          <Handle
            type="source"
            position={Position.Right}
            className="!bg-muted-foreground/40 !h-2 !w-2 !border-0"
          />

          <div className="flex items-center gap-1.5 px-1">
            <RiImage2Line className="text-muted-foreground size-3" />
            <span className="text-muted-foreground text-xs font-medium">
              Imagem #{index}
            </span>
            <button
              onClick={() => deleteNode(id)}
              className="text-muted-foreground hover:text-destructive ml-auto opacity-0 transition-opacity group-hover/node:opacity-100"
              aria-label="Remover imagem"
            >
              <RiDeleteBinLine className="size-3" />
            </button>
          </div>

          <div
            className={cn(
              "bg-card relative overflow-hidden rounded-md ring-1 ring-foreground/10 transition-[box-shadow]",
              selected && "ring-ring ring-2"
            )}
            style={{ aspectRatio: aspectRatioValue(data.aspect) }}
          >
            <Image
              src={data.url}
              alt={data.prompt}
              fill
              sizes="320px"
              className="object-cover"
              unoptimized
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end gap-1 p-1.5 opacity-0 transition-opacity group-hover/node:opacity-100">
              <a
                href={data.url}
                download
                target="_blank"
                rel="noopener"
                className="bg-background/90 text-foreground hover:bg-background pointer-events-auto flex size-7 items-center justify-center rounded-md backdrop-blur ring-1 ring-foreground/10"
                aria-label="Baixar"
              >
                <RiDownloadLine className="size-3.5" />
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(data.url)
                  toast.success("URL copiada")
                }}
                className="bg-background/90 text-foreground hover:bg-background pointer-events-auto flex size-7 items-center justify-center rounded-md backdrop-blur ring-1 ring-foreground/10"
                aria-label="Copiar URL"
              >
                <RiFileCopyLine className="size-3.5" />
              </button>
              <button
                onClick={() => {
                  const newId = branchFromImage(id)
                  if (newId) focusNodes([id, newId])
                }}
                className="bg-background/90 text-foreground hover:bg-background pointer-events-auto flex size-7 items-center justify-center rounded-md backdrop-blur ring-1 ring-foreground/10"
                aria-label="Ramificar"
                title="Ramificar"
              >
                <RiShuffleLine className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={saveToGallery}>
          <RiBookmarkLine className="size-3.5" />
          Salvar na galeria
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            const newId = branchFromImage(id)
            if (newId) focusNodes([id, newId])
          }}
        >
          <RiShuffleLine className="size-3.5" />
          Ramificar
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            navigator.clipboard.writeText(data.url)
            toast.success("URL copiada")
          }}
        >
          <RiFileCopyLine className="size-3.5" />
          Copiar URL
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => deleteNode(id)}
          className="text-destructive focus:text-destructive"
        >
          <RiDeleteBinLine className="size-3.5" />
          Remover
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
