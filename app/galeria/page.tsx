"use client"

import * as React from "react"
import useSWR from "swr"
import { RiFolderImageLine, RiSearchLine } from "@remixicon/react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { fetcher } from "@/lib/api"
import { CategorySidebar } from "@/features/gallery/components/category-sidebar"
import { GalleryGrid } from "@/features/gallery/components/gallery-grid"
import { ItemDialog } from "@/features/gallery/components/item-dialog"
import type {
  GalleryCategory,
  GalleryItemKind,
  GalleryItemSummary,
} from "@/features/gallery/types"

type KindFilter = "all" | GalleryItemKind

export default function GaleriaPage() {
  const [kind, setKind] = React.useState<KindFilter>("all")
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const [openItemId, setOpenItemId] = React.useState<string | null>(null)

  const queryString = React.useMemo(() => {
    const params = new URLSearchParams()
    if (kind !== "all") params.set("kind", kind)
    if (categoryId) params.set("category", categoryId)
    if (search.trim()) params.set("q", search.trim())
    const qs = params.toString()
    return qs ? `?${qs}` : ""
  }, [kind, categoryId, search])

  const { data, isLoading, mutate } = useSWR<{ items: GalleryItemSummary[] }>(
    `/api/gallery${queryString}`,
    fetcher
  )
  const { data: catsData, mutate: mutateCats } = useSWR<{
    categories: GalleryCategory[]
  }>("/api/gallery/categories", fetcher)

  const items = data?.items ?? []
  const categories = catsData?.categories ?? []

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 font-mono text-xs tracking-tight">
            /galeria
          </p>
          <h1 className="font-heading text-foreground text-2xl leading-none font-semibold tracking-tight">
            Galeria
          </h1>
          <p className="text-muted-foreground mt-2 max-w-md text-xs">
            Catálogo de imagens geradas e referências salvas. Clique com o botão
            direito num nó de imagem ou referência pra adicionar aqui.
          </p>
        </div>
      </div>

      <div className="flex flex-1 gap-6">
        <CategorySidebar
          categories={categories}
          activeId={categoryId}
          onSelect={setCategoryId}
          onChanged={() => {
            void mutateCats()
            void mutate()
          }}
        />

        <section className="flex flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
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
                placeholder="Buscar por título ou notas"
                className="h-8 w-60 pl-8 text-xs"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="flex-1">
              <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
                <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center">
                  <RiFolderImageLine className="size-6" />
                </div>
                <p className="text-foreground text-sm font-medium">
                  Galeria vazia
                </p>
                <p className="text-muted-foreground max-w-xs text-xs">
                  Abra um flow de imagens, clique com o botão direito numa
                  referência ou imagem gerada e escolha "Salvar na galeria".
                </p>
              </CardContent>
            </Card>
          ) : (
            <GalleryGrid items={items} onOpen={(i) => setOpenItemId(i.id)} />
          )}
        </section>
      </div>

      <ItemDialog
        itemId={openItemId}
        open={openItemId !== null}
        onOpenChange={(o) => !o && setOpenItemId(null)}
        onChanged={() => {
          void mutate()
          void mutateCats()
        }}
      />
    </div>
  )
}
