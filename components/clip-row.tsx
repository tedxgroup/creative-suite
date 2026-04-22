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
  RiPriceTag3Line,
  RiCloseLine,
  RiCheckLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ClipStatusBadge } from "./clip-status-badge"
import { cn } from "@/lib/utils"
import type { VideoClip, ClipCategory } from "@/lib/types"
import { CLIP_CATEGORIES, CLIP_CATEGORY_LABEL } from "@/lib/types"

// Distinct hue per category — full Tailwind class strings so JIT picks them up.
const CATEGORY_STYLES: Record<ClipCategory, string> = {
  hook1:
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  hook2:
    "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  hook3:
    "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  hook4:
    "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  hook5:
    "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  broll:
    "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
}

// Tiny colored dot for the submenu row — same palette as the badge.
const CATEGORY_DOT: Record<ClipCategory, string> = {
  hook1: "bg-violet-500",
  hook2: "bg-sky-500",
  hook3: "bg-cyan-500",
  hook4: "bg-fuchsia-500",
  hook5: "bg-orange-500",
  broll: "bg-slate-500",
}

interface ClipRowProps {
  clip: VideoClip
  onPlay?: (id: string) => void
  onGenerate?: (id: string) => void
  onRetry?: (id: string) => void
  onDownload?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onToggleTag?: (id: string) => void
  onSetCategory?: (id: string, category: string | null) => void
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
  onSetCategory,
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
  const category = clip.category as ClipCategory | null | undefined

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Card
            size="sm"
            className={cn(
              "group/clip flex-row items-center gap-3 px-3 py-2.5 transition-colors hover:ring-foreground/20",
              isDragging && "ring-foreground/40 z-10"
            )}
          >
            {/* Drag handle + order */}
            <div className="flex items-center gap-1 text-muted-foreground">
              <span
                {...attributes}
                {...listeners}
                role="button"
                tabIndex={0}
                className="flex size-5 cursor-grab touch-none select-none items-center justify-center outline-none active:cursor-grabbing focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Arrastar para reordenar"
              >
                <RiDraggable className="size-3.5" />
              </span>
              <span className="font-mono text-xs w-5 text-right tabular-nums">
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
                  className="h-5 rounded-md px-1.5 font-mono text-[11px] font-normal text-muted-foreground"
                >
                  {isInfiniteTalk ? "InfiniteTalk" : "VEO 3.1"}
                </Badge>
                {category && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 rounded-md px-1.5 font-mono text-[11px] font-medium",
                      CATEGORY_STYLES[category]
                    )}
                  >
                    {CLIP_CATEGORY_LABEL[category]}
                  </Badge>
                )}
                {clip.regenerated && (
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md px-1.5 font-mono text-[11px] font-normal text-muted-foreground"
                  >
                    Regravado
                  </Badge>
                )}
                {clip.tagged && (
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md border-amber-500/30 bg-amber-500/10 px-1.5 font-mono text-[11px] font-normal text-amber-600 dark:text-amber-400"
                  >
                    Refazer
                  </Badge>
                )}
                {clip.error && (
                  <span className="text-destructive truncate font-mono text-[11px]">
                    {clip.error}
                  </span>
                )}
                {clip.localPath && (
                  <a
                    href={clip.localPath}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] hover:underline"
                  >
                    Salvo
                  </a>
                )}
              </div>
            </div>

            {/* Actions (inline — generate/retry/duplicate/delete only) */}
            <div className="flex flex-shrink-0 items-center gap-0.5">
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
        </ContextMenuTrigger>

        <ContextMenuContent className="w-52">
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <RiPriceTag3Line className="mr-2 size-3.5" />
              Tag
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              {CLIP_CATEGORIES.map((cat) => (
                <ContextMenuItem
                  key={cat}
                  onSelect={() =>
                    onSetCategory?.(clip.id, category === cat ? null : cat)
                  }
                >
                  <span
                    className={cn(
                      "mr-2 inline-block size-2 rounded-full",
                      CATEGORY_DOT[cat]
                    )}
                  />
                  {CLIP_CATEGORY_LABEL[cat]}
                  {category === cat && (
                    <RiCheckLine className="ml-auto size-3.5 text-primary" />
                  )}
                </ContextMenuItem>
              ))}
              {category && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => onSetCategory?.(clip.id, null)}
                    className="text-muted-foreground"
                  >
                    <RiCloseLine className="mr-2 size-3.5" />
                    Remover tag
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          <ContextMenuItem onSelect={() => onToggleTag?.(clip.id)}>
            <RiFlag2Line
              className={cn(
                "mr-2 size-3.5",
                clip.tagged && "text-amber-500"
              )}
            />
            {clip.tagged ? "Remover marcação" : "Marcar para refazer"}
          </ContextMenuItem>

          {hasVideo && !clip.localPath && (
            <ContextMenuItem
              onSelect={() => onDownload?.(clip.id)}
              className="text-emerald-700 dark:text-emerald-400"
            >
              <RiDownloadLine className="mr-2 size-3.5" />
              Baixar vídeo
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
