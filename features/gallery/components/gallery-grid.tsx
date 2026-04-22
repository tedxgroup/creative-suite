"use client"

import * as React from "react"
import Image from "next/image"
import { RiImageLine, RiUserSmileLine } from "@remixicon/react"
import { cn } from "@/lib/utils"
import type { GalleryItemSummary } from "../types"

interface GalleryGridProps {
  items: GalleryItemSummary[]
  onOpen: (item: GalleryItemSummary) => void
}

export function GalleryGrid({ items, onOpen }: GalleryGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <GalleryCard key={item.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  )
}

function aspectClass(aspect: string | null, kind: string): string {
  if (kind === "reference") return "aspect-square"
  if (!aspect) return "aspect-video"
  const [w, h] = aspect.split(":").map(Number)
  const ratio = w && h ? w / h : 16 / 9
  if (ratio >= 1.7) return "aspect-video"
  if (ratio >= 0.9 && ratio <= 1.1) return "aspect-square"
  if (ratio <= 0.6) return "aspect-[9/16]"
  if (ratio <= 0.8) return "aspect-[3/4]"
  return "aspect-[4/3]"
}

function GalleryCard({
  item,
  onOpen,
}: {
  item: GalleryItemSummary
  onOpen: (item: GalleryItemSummary) => void
}) {
  const isRef = item.kind === "reference"
  const Icon = isRef ? RiUserSmileLine : RiImageLine

  return (
    <button
      onClick={() => onOpen(item)}
      className="group flex flex-col gap-1.5 text-left"
    >
      <div
        className={cn(
          "bg-muted/40 border-border hover:border-ring relative overflow-hidden rounded-md border transition-colors",
          aspectClass(item.aspect, item.kind)
        )}
      >
        <Image
          src={item.url}
          alt={item.title || item.kind}
          fill
          sizes="240px"
          className="object-cover"
          unoptimized
        />
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
          <div className="bg-background/80 text-foreground flex size-5 items-center justify-center rounded-full backdrop-blur">
            <Icon className="size-2.5" />
          </div>
          {isRef && item.refTag && (
            <span className="bg-background/80 text-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
              {item.refTag}
            </span>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1 px-0.5">
        <p className="text-foreground truncate text-xs font-medium">
          {item.title || (isRef ? "Referência" : "Imagem gerada")}
        </p>
        {item.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.categories.slice(0, 3).map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-0.5 text-[10px]"
                style={{ color: c.color }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
