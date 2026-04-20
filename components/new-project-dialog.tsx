"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import type { VideoProject } from "@/lib/types"

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (project: VideoProject) => void
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: NewProjectDialogProps) {
  const [name, setName] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    if (open) setName("")
  }, [open])

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      const project = await api<VideoProject>("/projects", {
        method: "POST",
        body: { name: trimmed },
      })
      onOpenChange(false)
      onCreated?.(project)
      router.push(`/projetos/${project.id}`)
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar projeto")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Nome</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Criativo #01"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate()
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? "Criando..." : "Criar projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
