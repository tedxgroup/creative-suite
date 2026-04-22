"use client"

import * as React from "react"
import Image from "next/image"
import useSWR from "swr"
import { RiSearchLine } from "@remixicon/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { fetcher } from "@/lib/api"
import type { GalleryItemKind, GalleryItemSummary } from "../types"

interface GalleryPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (item: GalleryItemSummary) => void
}

export function GalleryPicker({ open, onOpenChange, onPick }: GalleryPickerProps) {
  const [kind, setKind] = React.useState<GalleryItemKind | "all">("all")
  const [search, setSearch] = React.useState("")

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams()
    if (kind !== "all") params.set("kind", kind)
    if (search.trim()) params.set("q", search.trim())
    const qs = params.toString()
    return qs ? `?${qs}` : ""
  }, [kind, search])

  const { data } = useSWR<{ items: GalleryItemSummary[] }>(
    open ? `/api/gallery${queryString}` : null,
    fetcher
  )
  const items = data?.items ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Escolher da galeria</DialogTitle>
          <DialogDescription>
            Selecione uma imagem ou referência salva pra usar neste flow.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 border-b pb-3">
          <Tabs value={kind} onValueChange={(v) => setKind(v as any)}>
            <TabsList>
              <TabsTrigger value="all" className="text-xs">
                Todos
              </TabsTrigger>
              <TabsTrigger value="image" className="text-xs">
                Imagens
              </TabsTrigger>
              <TabsTrigger value="reference" className="text-xs">
                Referências
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative ml-auto">
            <RiSearchLine className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título"
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Nenhum item salvo ainda.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onPick(item)
                    onOpenChange(false)
                  }}
                  className={cn(
                    "group flex flex-col gap-1.5 text-left"
                  )}
                >
                  <div className="bg-muted/40 border-border group-hover:border-ring relative aspect-square overflow-hidden rounded-md border transition-colors">
                    <Image
                      src={item.url}
                      alt={item.title ?? item.kind}
                      fill
                      sizes="160px"
                      className="object-cover"
                      unoptimized
                    />
                    {item.refTag && (
                      <span className="bg-background/85 text-foreground absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
                        {item.refTag}
                      </span>
                    )}
                  </div>
                  {(item.title || item.categories.length > 0) && (
                    <div className="min-w-0 px-0.5">
                      {item.title && (
                        <p className="text-foreground truncate text-xs font-medium">
                          {item.title}
                        </p>
                      )}
                      {item.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {item.categories.slice(0, 2).map((c) => (
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
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
