"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  RiDraggable,
  RiPlayCircleFill,
  RiImageLine,
  RiFlag2Line,
  RiFileCopyLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiRefreshLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ClipStatusBadge } from "./clip-status-badge"
import { cn } from "@/lib/utils"
import type { VideoClip } from "@/lib/types"

interface ClipRowProps {
  clip: VideoClip
  onPlay?: (id: string) => void
  onGenerate?: (id: string) => void
  onRetry?: (id: string) => void
  onDownload?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onToggleTag?: (id: string) => void
}

export function ClipRow({
  clip,
  onPlay,
  onGenerate,
  onRetry,
  onDownload,
  onDuplicate,
  onDelete,
  onToggleTag,
}: ClipRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isInfiniteTalk = (clip.model || "veo3") === "infinitetalk"
  const hasVideo = clip.status === "success" && clip.videoUrl
  const text = isInfiniteTalk
    ? clip.prompt || "Clip com áudio"
    : clip.dialogue || clip.prompt

  return (
    <Card
      ref={setNodeRef}
      style={style}
      size="sm"
      className={cn(
        "group/clip flex-row items-center gap-3 px-3 py-2.5 transition-colors hover:ring-foreground/20",
        isDragging && "ring-foreground/40 z-10"
      )}
    >
      {/* Drag handle + order */}
      <div className="flex items-center gap-1 text-muted-foreground">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <RiDraggable className="size-3.5" />
        </button>
        <span className="font-mono text-[11px] w-5 text-right tabular-nums">
          {String(clip.order).padStart(2, "0")}
        </span>
      </div>

      {/* Thumbnail */}
      <div
        className={cn(
          "bg-muted relative flex aspect-video w-20 flex-shrink-0 items-center justify-center overflow-hidden ring-1 ring-foreground/10",
          hasVideo && "cursor-pointer hover:ring-primary/50"
        )}
        onClick={hasVideo ? () => onPlay?.(clip.id) : undefined}
      >
        {clip.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.imageUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <RiImageLine className="text-muted-foreground/40 size-4" />
        )}
        {hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover/clip:opacity-100">
            <RiPlayCircleFill className="size-7 text-white drop-shadow-md" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-foreground line-clamp-2 text-[12px]/relaxed">
          {text}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ClipStatusBadge status={clip.status} />
          <Badge
            variant="outline"
            className="h-5 rounded-none px-1.5 font-mono text-[10px] font-normal text-muted-foreground"
          >
            {isInfiniteTalk ? "InfiniteTalk" : "VEO 3.1"}
          </Badge>
          {clip.regenerated && (
            <Badge
              variant="outline"
              className="h-5 rounded-none px-1.5 font-mono text-[10px] font-normal text-muted-foreground"
            >
              Regravado
            </Badge>
          )}
          {clip.tagged && (
            <Badge
              variant="outline"
              className="h-5 rounded-none border-amber-500/30 bg-amber-500/10 px-1.5 font-mono text-[10px] font-normal text-amber-600 dark:text-amber-400"
            >
              Refazer
            </Badge>
          )}
          {clip.error && (
            <span className="text-destructive truncate font-mono text-[10px]">
              {clip.error}
            </span>
          )}
          {clip.localPath && (
            <a
              href={clip.localPath}
              download
              onClick={(e) => e.stopPropagation()}
              className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px] hover:underline"
            >
              Salvo
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-7",
            clip.tagged
              ? "text-amber-500 hover:text-amber-600"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={clip.tagged ? "Remover marcação" : "Marcar para refazer"}
          onClick={() => onToggleTag?.(clip.id)}
        >
          <RiFlag2Line className="size-3.5" />
        </Button>

        {clip.status === "fail" && (
          <Button
            size="sm"
            variant="default"
            className="h-7"
            onClick={() => onRetry?.(clip.id)}
          >
            <RiRefreshLine className="size-3" />
            Retry
          </Button>
        )}
        {clip.status === "pending" && (
          <Button
            size="sm"
            variant="default"
            className="h-7"
            onClick={() => onGenerate?.(clip.id)}
          >
            Gerar
          </Button>
        )}
        {hasVideo && !clip.localPath && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-emerald-600 dark:text-emerald-400"
            onClick={() => onDownload?.(clip.id)}
          >
            <RiDownloadLine className="size-3" />
            Baixar
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7"
          title="Duplicar"
          onClick={() => onDuplicate?.(clip.id)}
        >
          <RiFileCopyLine className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-7"
          title="Excluir"
          onClick={() => onDelete?.(clip.id)}
        >
          <RiDeleteBinLine className="size-3.5" />
        </Button>
      </div>
    </Card>
  )
}
