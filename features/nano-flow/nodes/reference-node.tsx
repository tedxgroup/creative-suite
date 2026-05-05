"use client"

import * as React from "react"
import Image from "next/image"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import {
  Bookmark,
  Trash2,
  Images,
  Pencil,
  Loader2,
  UploadCloud,
  Smile,
} from "lucide-react"
import { toast } from "sonner"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GalleryPicker } from "@/features/gallery/components/gallery-picker"
import { supabaseBrowser } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useFlowStore } from "../store"

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets"
import {
  REFERENCE_TAGS,
  type FlowNode,
  type ReferenceNodeData,
  type ReferenceTag,
} from "../types"

const NODE_WIDTH = 180

export function ReferenceNode(props: NodeProps<FlowNode>) {
  const { id, selected } = props
  const data = props.data as ReferenceNodeData
  const nodes = useFlowStore((s) => s.nodes)
  const updateNodeData = useFlowStore((s) => s.updateNodeData)
  const deleteNode = useFlowStore((s) => s.deleteNode)

  const flowId = useFlowStore((s) => s.flowId)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const [pickerOpen, setPickerOpen] = React.useState(false)

  async function saveToGallery() {
    if (!data.imageUrl) {
      toast.error("Faça upload de uma imagem primeiro")
      return
    }
    try {
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "reference",
          url: data.imageUrl,
          refTag: data.tag,
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

  const index = React.useMemo(
    () =>
      nodes
        .filter((n) => n.data.kind === "reference")
        .findIndex((n) => n.id === id) + 1,
    [nodes, id]
  )

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Somente imagens")
      return
    }
    setUploading(true)
    try {
      const signRes = await fetch("/api/flows/upload/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      })
      const signJson = await signRes.json()
      if (!signRes.ok) throw new Error(signJson.error || "Falha ao assinar upload")

      const { error: upErr } = await supabaseBrowser.storage
        .from(STORAGE_BUCKET)
        .uploadToSignedUrl(signJson.key, signJson.token, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        })
      if (upErr) throw new Error(upErr.message)

      const commitRes = await fetch("/api/flows/upload/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: signJson.key,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      })
      const commitJson = await commitRes.json()
      if (!commitRes.ok) throw new Error(commitJson.error || "Falha no commit")

      updateNodeData(id, { imageUrl: commitJson.url })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      className="group/node flex flex-col gap-2"
      style={{ width: NODE_WIDTH }}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-muted-foreground/40 !h-2 !w-2 !border-0"
      />

      <div className="flex items-center gap-1.5 px-1">
        <Smile className="text-muted-foreground size-3" />
        <span className="text-muted-foreground text-xs font-medium">
          Referência #{index}
        </span>
        <button
          onClick={() => deleteNode(id)}
          className="text-muted-foreground hover:text-destructive ml-auto opacity-0 transition-opacity group-hover/node:opacity-100"
          aria-label="Remover referência"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <div
        className={cn(
          "bg-card relative flex flex-col overflow-hidden rounded-md ring-1 ring-foreground/10 transition-[box-shadow]",
          selected && "ring-ring ring-2"
        )}
      >
        {data.imageUrl ? (
          <button
            key={data.imageUrl}
            onClick={() => inputRef.current?.click()}
            className="bg-muted/40 animate-in fade-in-0 zoom-in-95 relative aspect-square w-full overflow-hidden rounded-md duration-300 ease-out"
            aria-label="Trocar imagem"
          >
            <Image
              src={data.imageUrl}
              alt={data.tag}
              fill
              sizes="180px"
              className="object-cover"
              unoptimized
            />
          </button>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void uploadImage(f)
            }}
            className={cn(
              "bg-muted/30 text-muted-foreground flex aspect-square w-full flex-col items-center justify-center gap-1 transition-colors",
              dragOver && "bg-muted/60",
              uploading && "opacity-60"
            )}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <>
                <button
                  onClick={() => inputRef.current?.click()}
                  className="hover:bg-muted/60 flex flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-colors"
                >
                  <UploadCloud className="size-4" />
                  <span className="text-[11px]">Upload</span>
                </button>
                <span className="text-muted-foreground/60 text-[10px]">ou</span>
                <button
                  onClick={() => setPickerOpen(true)}
                  className="hover:bg-muted/60 flex flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-colors"
                >
                  <Images className="size-4" />
                  <span className="text-[11px]">Galeria</span>
                </button>
              </>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void uploadImage(f)
            e.target.value = ""
          }}
        />
        <div className="border-border border-t p-1.5">
          <Select
            value={data.tag}
            onValueChange={(v) => updateNodeData(id, { tag: v as ReferenceTag })}
          >
            <SelectTrigger className="hover:bg-muted h-7 border-0 bg-transparent text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFERENCE_TAGS.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <GalleryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(item) => {
          updateNodeData(id, {
            imageUrl: item.url,
            tag: item.refTag ?? data.tag,
            label: item.title ?? undefined,
          })
        }}
      />
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={saveToGallery} disabled={!data.imageUrl}>
          <Bookmark className="size-3.5" />
          Salvar na galeria
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => inputRef.current?.click()}>
          <Pencil className="size-3.5" />
          {data.imageUrl ? "Trocar imagem" : "Enviar imagem"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => deleteNode(id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-3.5" />
          Remover
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
