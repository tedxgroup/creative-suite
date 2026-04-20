"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  RiUploadCloud2Line,
  RiSparkling2Line,
  RiAddLine,
  RiCloseLine,
  RiCheckLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { VideoProject } from "@/lib/types"

interface BulkScenesDialogProps {
  projectId: string
  taggedClips?: VideoProject["clips"]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

interface Scene {
  id: number
  prompt: string
  dialogue?: string
}

export function BulkScenesDialog({
  projectId,
  taggedClips = [],
  open,
  onOpenChange,
  onCreated,
}: BulkScenesDialogProps) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [script, setScript] = React.useState("")
  const [scenes, setScenes] = React.useState<Scene[]>([])
  const [analyzing, setAnalyzing] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setImageUrl(null)
      setScript("")
      setScenes([])
    }
  }, [open])

  async function uploadImage(file: File | undefined) {
    if (!file) return
    const fd = new FormData()
    fd.append("image", file)
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const data = await res.json()
    if (data.url) setImageUrl(data.url)
  }

  function importTagged() {
    if (!taggedClips.length) return
    setScript(
      taggedClips
        .sort((a, b) => a.order - b.order)
        .map((c) => `--- Cena ${c.order} ---\n${c.dialogue || c.prompt}`)
        .join("\n\n")
    )
    const firstImage = taggedClips.find((c) => c.imageUrl)
    if (firstImage?.imageUrl) setImageUrl(firstImage.imageUrl)
    toast.success(`${taggedClips.length} fala(s) importada(s)`)
  }

  async function analyze() {
    if (!script.trim()) {
      toast.error("Cole o script primeiro")
      return
    }
    setAnalyzing(true)
    try {
      const result = await api<{ scenes: any[]; error?: string }>(
        "/analyze-script",
        { method: "POST", body: { script: script.trim(), imageUrl } }
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      setScenes(
        result.scenes.map((s, i) => ({
          id: Date.now() + i,
          prompt: s.prompt,
          dialogue: s.dialogue,
        }))
      )
      toast.success(`${result.scenes.length} cenas geradas`)
    } catch (err: any) {
      toast.error(err.message || "Erro na análise")
    } finally {
      setAnalyzing(false)
    }
  }

  function showManualMode() {
    setScenes([
      { id: Date.now(), prompt: "" },
      { id: Date.now() + 1, prompt: "" },
      { id: Date.now() + 2, prompt: "" },
    ])
  }

  function addScene() {
    setScenes((s) => [...s, { id: Date.now(), prompt: "" }])
  }

  function removeScene(id: number) {
    setScenes((s) => s.filter((x) => x.id !== id))
  }

  function updateScene(id: number, value: string) {
    setScenes((s) =>
      s.map((x) => (x.id === id ? { ...x, prompt: value } : x))
    )
  }

  async function submit() {
    const filled = scenes.filter((s) => s.prompt.trim())
    if (!filled.length) {
      toast.error("Preencha pelo menos uma cena")
      return
    }
    setSubmitting(true)
    try {
      for (const scene of filled) {
        await api(`/projects/${projectId}/clips`, {
          method: "POST",
          body: {
            prompt: scene.prompt.trim(),
            dialogue: scene.dialogue || null,
            imageUrl,
          },
        })
      }
      toast.success(`${filled.length} cenas adicionadas`)
      onCreated?.()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Criar cenas</DialogTitle>
        </DialogHeader>

        {/* Tagged clips suggestion */}
        {taggedClips.length > 0 && scenes.length === 0 && (
          <div className="border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-2 border p-3">
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-xs font-medium">
                {taggedClips.length} clip{taggedClips.length > 1 ? "s" : ""}{" "}
                marcado{taggedClips.length > 1 ? "s" : ""} para refazer
              </p>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                Importar as falas para reescrever os prompts.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/30 text-amber-700 dark:text-amber-400"
              onClick={importTagged}
            >
              Importar falas
            </Button>
          </div>
        )}

        {/* Step 1: image + script */}
        <div className="grid grid-cols-[160px_1fr] gap-4">
          <div className="grid gap-2">
            <Label>Avatar / Imagem</Label>
            <div
              className={cn(
                "border-border bg-muted/30 hover:bg-muted/60 flex h-[160px] cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed text-center transition-colors",
                imageUrl && "border-primary/40 bg-primary/5 border-solid"
              )}
              onClick={() => inputRef.current?.click()}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <>
                  <RiUploadCloud2Line className="text-muted-foreground/60 size-5" />
                  <p className="text-muted-foreground text-[11px]">
                    Enviar imagem
                  </p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadImage(e.target.files?.[0])}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="script">Script / Copy completa</Label>
            <Textarea
              id="script"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Cole aqui o script. O Claude vai dividir em cenas com prompts otimizados..."
              rows={6}
              className="resize-none text-[12px] leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={analyze} disabled={analyzing}>
            <RiSparkling2Line className="size-4" />
            {analyzing ? "Analisando..." : "Analisar e dividir em cenas"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground ml-auto"
            onClick={showManualMode}
          >
            Modo manual
          </Button>
        </div>

        {/* Generated scenes */}
        {scenes.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col border-t pt-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-foreground text-xs font-medium">
                Cenas geradas
              </span>
              <Badge variant="outline" className="rounded-none font-mono">
                {scenes.length}
              </Badge>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="secondary" onClick={addScene}>
                  <RiAddLine className="size-3.5" />
                  Cena
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-1.5">
                {scenes.map((scene, i) => (
                  <Card
                    key={scene.id}
                    size="sm"
                    className="flex-row gap-3 px-3 py-2"
                  >
                    <div className="flex w-6 flex-shrink-0 items-center pt-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0 flex-1">
                      {scene.dialogue && (
                        <p className="text-primary mb-1.5 line-clamp-2 border-l-2 border-primary/40 bg-primary/5 px-2 py-1 text-[10px]">
                          <span className="font-mono font-medium text-muted-foreground">
                            Fala:{" "}
                          </span>
                          {scene.dialogue}
                        </p>
                      )}
                      <Textarea
                        value={scene.prompt}
                        onChange={(e) => updateScene(scene.id, e.target.value)}
                        placeholder={`Prompt da cena ${i + 1}...`}
                        rows={2}
                        className="resize-none rounded-none text-[11px]"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-7 flex-shrink-0"
                      onClick={() => removeScene(scene.id)}
                    >
                      <RiCloseLine className="size-3.5" />
                    </Button>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || scenes.length === 0}
          >
            <RiCheckLine className="size-4" />
            {submitting ? "Criando..." : "Criar todas as cenas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
