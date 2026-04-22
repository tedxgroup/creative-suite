"use client"

import * as React from "react"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiFolder3Line,
} from "@remixicon/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CATEGORY_COLORS, type GalleryCategory } from "../types"

interface CategorySidebarProps {
  categories: GalleryCategory[]
  activeId: string | null
  onSelect: (id: string | null) => void
  onChanged: () => void
}

export function CategorySidebar({
  categories,
  activeId,
  onSelect,
  onChanged,
}: CategorySidebarProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<GalleryCategory | null>(null)

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(cat: GalleryCategory) {
    setEditing(cat)
    setDialogOpen(true)
  }

  async function handleDelete(cat: GalleryCategory) {
    if (!confirm(`Remover categoria "${cat.name}"?`)) return
    try {
      const res = await fetch(`/api/gallery/categories/${cat.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Falha ao remover")
      toast.success("Categoria removida")
      if (activeId === cat.id) onSelect(null)
      onChanged()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          Categorias
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-6"
          onClick={openCreate}
          aria-label="Nova categoria"
          title="Nova categoria"
        >
          <RiAddLine className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-0.5">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
            activeId === null && "bg-muted text-foreground font-medium"
          )}
        >
          <RiFolder3Line className="text-muted-foreground size-3.5" />
          Todas
        </button>
        {categories.map((cat) => (
          <div key={cat.id} className="group/cat flex items-center">
            <button
              onClick={() => onSelect(cat.id)}
              className={cn(
                "hover:bg-muted/60 flex flex-1 items-center gap-2 truncate rounded-md px-2 py-1.5 text-left text-xs",
                activeId === cat.id && "bg-muted text-foreground font-medium"
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="truncate">{cat.name}</span>
              {cat.itemCount !== undefined && cat.itemCount > 0 && (
                <span className="text-muted-foreground ml-auto text-[11px]">
                  {cat.itemCount}
                </span>
              )}
            </button>
            <div className="flex opacity-0 transition-opacity group-hover/cat:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-5"
                onClick={() => openEdit(cat)}
                aria-label="Editar"
              >
                <RiEditLine className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-5"
                onClick={() => handleDelete(cat)}
                aria-label="Remover"
              >
                <RiDeleteBinLine className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false)
          onChanged()
        }}
      />
    </aside>
  )
}

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: GalleryCategory | null
  onSaved: () => void
}

function CategoryDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: CategoryDialogProps) {
  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState<string>(CATEGORY_COLORS[8])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(editing?.name ?? "")
      setColor(editing?.color ?? CATEGORY_COLORS[8])
    }
  }, [open, editing])

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Nome obrigatório")
      return
    }
    setSaving(true)
    try {
      const url = editing
        ? `/api/gallery/categories/${editing.id}`
        : "/api/gallery/categories"
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Falha ao salvar")
      }
      toast.success(editing ? "Categoria atualizada" : "Categoria criada")
      onSaved()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar categoria" : "Nova categoria"}
          </DialogTitle>
          <DialogDescription>
            Dê um nome e escolha uma cor para agrupar itens da galeria.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-[11px] font-medium uppercase">
              Nome
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Diabetes, Estúdio, Luxo"
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-[11px] font-medium uppercase">
              Cor
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full transition-transform",
                    color === c && "ring-ring ring-2 ring-offset-2 ring-offset-background"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
