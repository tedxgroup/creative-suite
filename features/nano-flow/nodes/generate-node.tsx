"use client"

import * as React from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiImageAddLine,
  RiImageCircleAiLine,
  RiLoader4Line,
  RiPlayFill,
  RiSubtractLine,
} from "@remixicon/react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useFocusNodes } from "../hooks/use-focus-nodes"
import { useFlowStore } from "../store"
import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  type AspectRatio,
  type Copies,
  type FlowNode,
  type GenerateNodeData,
  type ImageNodeData,
  type ReferenceNodeData,
  type ReferenceTag,
  type Resolution,
} from "../types"

const NODE_WIDTH = 380

export function GenerateNode(props: NodeProps<FlowNode>) {
  const { id, selected } = props
  const data = props.data as GenerateNodeData
  const nodes = useFlowStore((s) => s.nodes)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const deleteNode = useFlowStore((s) => s.deleteNode)
  const appendImageNodes = useFlowStore((s) => s.appendImageNodes)
  const createReferenceNode = useFlowStore((s) => s.createReferenceNode)
  const flowId = useFlowStore((s) => s.flowId)
  const focusNodes = useFocusNodes()

  const index = React.useMemo(
    () =>
      nodes
        .filter((n) => n.data.kind === "generate")
        .findIndex((n) => n.id === id) + 1,
    [nodes, id]
  )

  async function generate() {
    if (!flowId) {
      toast.error("Flow não inicializado")
      return
    }
    if (!data.prompt.trim()) {
      toast.error("Escreva um prompt")
      return
    }

    const state = useFlowStore.getState()
    const incomingEdges = state.edges.filter((e) => e.target === id)
    const refs: Array<{
      imageUrl: string
      tag: ReferenceTag
      label?: string
      isContinuityFrame?: boolean
    }> = []
    for (const edge of incomingEdges) {
      const src = state.nodes.find((n) => n.id === edge.source)
      if (!src) continue
      if (src.data.kind === "reference") {
        const d = src.data as ReferenceNodeData
        if (d.imageUrl) refs.push({ imageUrl: d.imageUrl, tag: d.tag, label: d.label })
      } else if (src.data.kind === "image") {
        const d = src.data as ImageNodeData
        // Marked as continuity: the Architect receives an explicit baseline instruction
        // in the user text and preserves everything not overridden by the prompt.
        refs.push({
          imageUrl: d.url,
          tag: "cenário",
          label: "frame anterior",
          isContinuityFrame: true,
        })
      }
    }

    updateNodeData(id, { status: "loading", error: undefined })
    try {
      const res = await fetch("/api/flows/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: data.prompt,
          references: refs,
          aspect: data.aspect,
          resolution: data.resolution,
          copies: data.copies,
          flowId,
          nodeId: id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha na geração")
      updateNodeData(id, { status: "idle" })
      const newIds = appendImageNodes(
        id,
        json.images,
        data.aspect,
        json.refined ?? data.prompt
      )
      focusNodes([id, ...newIds])
    } catch (err: any) {
      updateNodeData(id, { status: "error", error: err.message })
      toast.error(err.message)
    }
  }

  const loading = data.status === "loading"

  function decrementCopies() {
    if (data.copies > 1) updateNodeData(id, { copies: (data.copies - 1) as Copies })
  }
  function incrementCopies() {
    if (data.copies < 4) updateNodeData(id, { copies: (data.copies + 1) as Copies })
  }

  return (
    <div
      className="group/node relative flex flex-col gap-2"
      style={{ width: NODE_WIDTH }}
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

      {/* Label */}
      <div className="flex items-center gap-1.5 px-1">
        <RiImageCircleAiLine className="text-muted-foreground size-3" />
        <span className="text-muted-foreground text-xs font-medium">
          Gerar imagem #{index}
        </span>
        <button
          onClick={() => deleteNode(id)}
          className="text-muted-foreground hover:text-destructive ml-auto opacity-0 transition-opacity group-hover/node:opacity-100"
          aria-label="Remover nó"
        >
          <RiDeleteBinLine className="size-3" />
        </button>
      </div>

      {/* Body — compact */}
      <div
        className={cn(
          "bg-card text-card-foreground relative rounded-md p-2.5 ring-1 ring-foreground/10 transition-[box-shadow]",
          selected && "ring-ring ring-2"
        )}
      >
        <textarea
          value={data.prompt}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="Descreva a imagem que você deseja gerar..."
          rows={3}
          className="text-foreground placeholder:text-muted-foreground w-full resize-none bg-transparent text-sm outline-none"
        />
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex items-center rounded-md ring-1 ring-foreground/10">
            <button
              onClick={decrementCopies}
              disabled={data.copies <= 1}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 items-center justify-center disabled:opacity-40"
              aria-label="Menos cópias"
            >
              <RiSubtractLine className="size-3" />
            </button>
            <span className="text-foreground px-1.5 font-mono text-xs">
              x{data.copies}
            </span>
            <button
              onClick={incrementCopies}
              disabled={data.copies >= 4}
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 items-center justify-center disabled:opacity-40"
              aria-label="Mais cópias"
            >
              <RiAddLine className="size-3" />
            </button>
          </div>

          <Select
            value={data.resolution}
            onValueChange={(v) =>
              updateNodeData(id, { resolution: v as Resolution })
            }
          >
            <SelectTrigger className="hover:bg-muted h-7 min-w-0 gap-1 border-0 bg-transparent px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r} value={r} className="text-xs">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={data.aspect}
            onValueChange={(v) =>
              updateNodeData(id, { aspect: v as AspectRatio })
            }
          >
            <SelectTrigger className="hover:bg-muted h-7 min-w-0 gap-1 border-0 bg-transparent px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((a) => (
                <SelectItem key={a} value={a} className="text-xs">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            onClick={generate}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 ml-auto flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-50"
            aria-label="Gerar imagem"
          >
            {loading ? (
              <RiLoader4Line className="size-4 animate-spin" />
            ) : (
              <RiPlayFill className="size-4" />
            )}
          </button>
        </div>
        {data.status === "error" && data.error && (
          <p className="text-destructive mt-1.5 text-xs">{data.error}</p>
        )}
      </div>

      {/* Floating "+ Referência" button — left side, hover-visible */}
      <button
        onClick={() => {
          const newId = createReferenceNode(id)
          if (newId) focusNodes([id, newId])
        }}
        className="bg-card text-muted-foreground hover:text-foreground absolute -left-14 top-8 flex size-10 items-center justify-center rounded-md opacity-0 ring-1 ring-foreground/10 transition-opacity hover:ring-ring group-hover/node:opacity-100"
        aria-label="Adicionar referência"
        title="Adicionar referência"
      >
        <RiImageAddLine className="size-4" />
      </button>
    </div>
  )
}
