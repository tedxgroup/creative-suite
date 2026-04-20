"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  RiUploadCloud2Line,
  RiSparkling2Line,
  RiAddLine,
  RiCloseLine,
  RiCheckLine,
  RiArrowLeftLine,
  RiLoader4Line,
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
import { uploadDirect } from "@/lib/uploadDirect"
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
  const [uploadingImage, setUploadingImage] = React.useState(false)
  const [script, setScript] = React.useState("")
  const [scenes, setScenes] = React.useState<Scene[]>([])
  const [analyzing, setAnalyzing] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setImageUrl(null)
      setUploadingImage(false)
      setScript("")
      setScenes([])
    }
  }, [open])

  async function uploadImage(file: File | undefined) {
    if (!file) return
    setUploadingImage(true)
    try {
      const { url } = await uploadDirect(file, "image")
      setImageUrl(url)
    } catch (err: any) {
      console.error("[upload]", err)
      toast.error(err.message || "Erro no upload")
    } finally {
      setUploadingImage(false)
      if (inputRef.current) inputRef.current.value = ""
    }
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
      { id: Date.now(), prompt: "", dialogue: "" },
      { id: Date.now() + 1, prompt: "", dialogue: "" },
      { id: Date.now() + 2, prompt: "", dialogue: "" },
    ])
  }

  function addScene() {
    setScenes((s) => [...s, { id: Date.now(), prompt: "", dialogue: "" }])
  }

  function removeScene(id: number) {
    setScenes((s) => s.filter((x) => x.id !== id))
  }

  function updateDialogue(id: number, value: string) {
    setScenes((s) =>
      s.map((x) => (x.id === id ? { ...x, dialogue: value } : x))
    )
  }

  function backToEdit() {
    if (scenes.length && !confirm("Descartar as cenas geradas e voltar?")) return
    setScenes([])
  }

  async function submit() {
    const filled = scenes.filter((s) => (s.prompt.trim() || s.dialogue?.trim()))
    if (!filled.length) {
      toast.error("Preencha pelo menos uma cena")
      return
    }
    setSubmitting(true)
    try {
      for (const scene of filled) {
        // If scene only has dialogue (manual mode, no AI prompt),
        // use dialogue as prompt so VEO has something to generate
        const promptToSend = scene.prompt.trim() || scene.dialogue?.trim() || ""
        await api(`/projects/${projectId}/clips`, {
          method: "POST",
          body: {
            prompt: promptToSend,
            dialogue: scene.dialogue?.trim() || null,
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

  const hasScenes = scenes.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !max-h-[92vh] !flex-col overflow-hidden sm:!max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {hasScenes ? "Cenas geradas" : "Criar cenas"}
          </DialogTitle>
        </DialogHeader>

        {/* LOADING — analyzing script */}
        {analyzing && (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 py-20 text-center">
            <div className="relative">
              <div className="border-primary/20 border-t-primary size-12 animate-spin rounded-full border-2" />
              <RiSparkling2Line className="text-primary absolute inset-0 m-auto size-5 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <p className="text-foreground text-sm font-medium">
                Analisando script
              </p>
              <p className="text-muted-foreground max-w-[280px] text-[11px] leading-relaxed">
                Claude está lendo seu script e dividindo em cenas otimizadas
                para VEO 3.1 com prompts estruturados.
              </p>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10px]">
              <RiLoader4Line className="size-3 animate-spin" />
              <span>Isso pode levar 30-60 segundos</span>
            </div>
          </div>
        )}

        {/* STEP 1 — input (hidden when scenes exist or analyzing) */}
        {!hasScenes && !analyzing && (
          <>
            {taggedClips.length > 0 && (
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

            <div className="grid grid-cols-[160px_1fr] items-start gap-4">
              <div className="flex flex-col gap-2">
                <Label>Avatar / Imagem</Label>
                <div
                  className={cn(
                    "border-border bg-muted/30 hover:bg-muted/60 relative flex h-[160px] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden border border-dashed text-center transition-colors",
                    imageUrl && "border-primary/40 bg-primary/5 border-solid",
                    uploadingImage && "pointer-events-none"
                  )}
                  onClick={() => inputRef.current?.click()}
                >
                  {uploadingImage && (
                    <div className="bg-background/70 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                      <div className="relative">
                        <div className="border-primary/20 border-t-primary size-8 animate-spin rounded-full border-2" />
                        <div className="bg-primary absolute inset-0 m-auto size-2 animate-ping rounded-full" />
                      </div>
                      <p className="text-muted-foreground font-mono text-[10px]">
                        Enviando…
                      </p>
                    </div>
                  )}
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={imageUrl}
                      src={imageUrl}
                      alt=""
                      className="animate-in fade-in zoom-in-95 size-full object-cover duration-500"
                      onError={() => {
                        console.error("[img-load-error]", imageUrl)
                        toast.error("Imagem não pôde ser carregada")
                        setImageUrl(null)
                      }}
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="script">Script / Copy completa</Label>
                <Textarea
                  id="script"
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="Cole aqui o script. O Claude vai dividir em cenas com prompts otimizados..."
                  className="h-[280px] max-h-[280px] resize-none overflow-y-auto !text-[13px] leading-[1.6] [field-sizing:fixed]"
                />
              </div>
            </div>

            <div className="grid grid-cols-[160px_1fr] gap-4">
              <div />
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
            </div>
          </>
        )}

        {/* STEP 2 — scenes only */}
        {hasScenes && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground -ml-2"
                onClick={backToEdit}
              >
                <RiArrowLeftLine className="size-3.5" />
                Voltar
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="rounded-none font-mono">
                  {scenes.length} {scenes.length === 1 ? "cena" : "cenas"}
                </Badge>
                <Button size="sm" variant="secondary" onClick={addScene}>
                  <RiAddLine className="size-3.5" />
                  Cena
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 -mx-1 overflow-y-auto px-1">
              <div className="space-y-1.5">
                {scenes.map((scene, i) => (
                  <Card
                    key={scene.id}
                    size="sm"
                    className="flex-row items-start gap-3 px-3 py-2.5"
                  >
                    <div className="flex w-6 flex-shrink-0 items-center pt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0 flex-1">
                      {scene.dialogue ? (
                        <p className="text-foreground text-[12px] leading-relaxed">
                          {scene.dialogue}
                        </p>
                      ) : (
                        <Textarea
                          value={scene.dialogue || ""}
                          onChange={(e) =>
                            updateDialogue(scene.id, e.target.value)
                          }
                          placeholder={`Fala da cena ${i + 1}...`}
                          className="h-[60px] max-h-[60px] resize-none rounded-none !text-[12px] [field-sizing:fixed]"
                        />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive size-6 flex-shrink-0"
                      onClick={() => removeScene(scene.id)}
                    >
                      <RiCloseLine className="size-3.5" />
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {!analyzing && (
          <DialogFooter className="border-t pt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !hasScenes}
            >
              <RiCheckLine className="size-4" />
              {submitting ? "Criando..." : "Criar todas as cenas"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
