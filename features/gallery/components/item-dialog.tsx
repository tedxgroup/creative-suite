"use client"

import * as React from "react"
import Image from "next/image"
import useSWR from "swr"
import {
  RiCloseLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiFileCopyLine,
} from "@remixicon/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { fetcher } from "@/lib/api"
import type { GalleryCategory, GalleryItem } from "../types"

interface ItemDialogProps {
  itemId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function ItemDialog({
  itemId,
  open,
  onOpenChange,
  onChanged,
}: ItemDialogProps) {
  const { data: item, mutate } = useSWR<GalleryItem>(
    open && itemId ? `/api/gallery/${itemId}` : null,
    fetcher
  )
  const { data: catsData } = useSWR<{ categories: GalleryCategory[] }>(
    open ? "/api/gallery/categories" : null,
    fetcher
  )
  const categories = catsData?.categories ?? []

  const [title, setTitle] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [tagsInput, setTagsInput] = React.useState("")
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (item) {
      setTitle(item.title ?? "")
      setNotes(item.notes ?? "")
      setTagsInput(item.tags.join(", "))
      setSelectedCategories(item.categories.map((c) => c.id))
    }
  }, [item])

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!item) return
    setSaving(true)
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      const res = await fetch(`/api/gallery/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          notes: notes.trim() || null,
          tags,
          categoryIds: selectedCategories,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Falha ao salvar")
      }
      toast.success("Item atualizado")
      await mutate()
      onChanged()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm("Remover este item da galeria?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/gallery/${item.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Falha ao remover")
      toast.success("Item removido")
      onChanged()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-5xl">
        <DialogTitle className="sr-only">Detalhes do item</DialogTitle>
        {!item ? (
          <div className="text-muted-foreground py-16 text-center text-sm">
            Carregando...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="bg-muted/40 border-border relative flex h-[70vh] items-center justify-center overflow-hidden rounded-md border">
              <Image
                src={item.url}
                alt={item.title ?? "item"}
                fill
                sizes="800px"
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1">
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium uppercase">
                  {item.kind === "image" ? "Imagem" : "Referência"}
                </span>
                {item.refTag && (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
                    {item.refTag}
                  </span>
                )}
                {item.aspect && (
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {item.aspect}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground text-[11px] font-medium uppercase">
                  Título
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Sem título"
                  className="text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground text-[11px] font-medium uppercase">
                  Notas
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contexto, uso, observações..."
                  rows={3}
                  className="resize-none text-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground text-[11px] font-medium uppercase">
                  Tags (separadas por vírgula)
                </label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="vsl, diabetes, estudio"
                  className="text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-muted-foreground text-[11px] font-medium uppercase">
                  Categorias
                </label>
                {categories.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Nenhuma ainda. Crie no painel lateral.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {categories.map((c) => {
                      const active = selectedCategories.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleCategory(c.id)}
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                            active
                              ? "text-foreground"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                          style={
                            active
                              ? { backgroundColor: c.color + "30", borderColor: c.color }
                              : undefined
                          }
                        >
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1 border-t pt-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                >
                  <a href={item.url} download target="_blank" rel="noopener">
                    <RiDownloadLine className="size-3" />
                    baixar
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(item.url)
                    toast.success("URL copiada")
                  }}
                >
                  <RiFileCopyLine className="size-3" />
                  copiar url
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive h-7 text-xs"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <RiDeleteBinLine className="size-3" />
                  remover
                </Button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Fechar
          </Button>
          <Button onClick={handleSave} disabled={saving || !item}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
