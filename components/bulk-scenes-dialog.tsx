"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckLine,
  RiCloseLine,
  RiFolderImageLine,
  RiImageEditLine,
  RiLoader4Line,
  RiRefreshLine,
  RiSparkling2Line,
  RiUploadCloud2Line,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { uploadDirect } from "@/lib/uploadDirect"
import { cn } from "@/lib/utils"
import type { SceneDraft, VideoProject } from "@/lib/types"
import { ScenePickerFlowDialog } from "@/components/scene-picker-flow-dialog"
import { GalleryPicker } from "@/features/gallery/components/gallery-picker"

interface BulkScenesDialogProps {
  projectId: string
  taggedClips?: VideoProject["clips"]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  /** Optional draft from DB to restore on open */
  initialDraft?: SceneDraft | null
}

interface Scene {
  id: number
  dialogue: string
  prompt: string
  /** Per-scene image override (null = use base avatar imageUrl). */
  imageUrl: string | null
}

export function BulkScenesDialog({
  projectId,
  taggedClips = [],
  open,
  onOpenChange,
  onCreated,
  initialDraft,
}: BulkScenesDialogProps) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = React.useState(false)
  const [script, setScript] = React.useState("")
  const [scenes, setScenes] = React.useState<Scene[]>([])
  const [analyzing, setAnalyzing] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [flowPickerOpen, setFlowPickerOpen] = React.useState(false)
  const [galleryPickerOpen, setGalleryPickerOpen] = React.useState(false)
  const [pickerForSceneId, setPickerForSceneId] = React.useState<number | null>(
    null
  )
  const inputRef = React.useRef<HTMLInputElement>(null)

  const [draftStatus, setDraftStatus] = React.useState<
    "idle" | "saving" | "saved"
  >("idle")
  const draftTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = React.useRef(false)

  React.useEffect(() => {
    if (open) {
      hydratedRef.current = true
      if (initialDraft) {
        setImageUrl(initialDraft.baseImageUrl ?? null)
        setScript(initialDraft.script ?? "")
        setScenes(
          (initialDraft.scenes ?? []).map((s) => ({
            id: s.id,
            dialogue: s.dialogue ?? "",
            prompt: s.prompt ?? "",
            imageUrl: s.imageUrl ?? null,
          }))
        )
      } else {
        setImageUrl(null)
        setScript("")
        setScenes([])
      }
      setUploadingImage(false)
      setDraftStatus("idle")
    } else {
      hydratedRef.current = false
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current)
        draftTimerRef.current = null
      }
    }
  }, [open, initialDraft])

  // Autosave draft (debounced)
  React.useEffect(() => {
    if (!open || !hydratedRef.current) return
    // Skip saving when there's nothing meaningful to restore
    if (!script.trim() && scenes.length === 0 && !imageUrl) return

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(async () => {
      setDraftStatus("saving")
      try {
        const draft: SceneDraft = {
          script,
          baseImageUrl: imageUrl,
          scenes: scenes.map((s) => ({
            id: s.id,
            dialogue: s.dialogue,
            prompt: s.prompt,
            imageUrl: s.imageUrl,
          })),
          updatedAt: new Date().toISOString(),
        }
        await fetch(`/api/projects/${projectId}/scene-draft`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draft }),
        })
        setDraftStatus("saved")
      } catch {
        setDraftStatus("idle")
      }
    }, 800)
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [open, projectId, script, imageUrl, scenes])

  async function clearDraft() {
    try {
      await fetch(`/api/projects/${projectId}/scene-draft`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft: null }),
      })
    } catch {
      /* best-effort */
    }
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return
    setUploadingImage(true)
    try {
      const { url } = await uploadDirect(file, "image")
      setImageUrl(url)
    } catch (err: any) {
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
        .map((c) => c.dialogue || c.prompt)
        .join("\n\n")
    )
    const firstImage = taggedClips.find((c) => c.imageUrl)
    if (firstImage?.imageUrl) setImageUrl(firstImage.imageUrl)
    toast.success(`${taggedClips.length} fala(s) importada(s)`)
  }

  /** Local split — one scene per non-empty paragraph. No AI. */
  function splitScenes() {
    const trimmed = script.trim()
    if (!trimmed) {
      toast.error("Cole o script primeiro")
      return
    }
    const paragraphs = trimmed
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (paragraphs.length === 0) {
      toast.error("Nenhum parágrafo encontrado")
      return
    }
    setScenes(
      paragraphs.map((dialogue, i) => ({
        id: Date.now() + i,
        dialogue,
        prompt: "",
        imageUrl: null,
      }))
    )
    toast.success(`${paragraphs.length} cenas criadas`)
  }

  /** AI pass — generate Veo prompts for each scene with its own image context. */
  async function analyzeWithAI() {
    if (scenes.length === 0) {
      toast.error("Divida o script em cenas primeiro")
      return
    }
    setAnalyzing(true)
    try {
      const payload = {
        scenes: scenes.map((s) => ({
          dialogue: s.dialogue,
          imageUrl: s.imageUrl || imageUrl,
        })),
        fallbackImageUrl: imageUrl,
      }
      const result = await api<{ scenes: Array<{ prompt: string; dialogue: string }> }>(
        "/analyze-script",
        { method: "POST", body: payload }
      )
      if (result.scenes.length !== scenes.length) {
        toast.warning(
          `Modelo retornou ${result.scenes.length} prompts para ${scenes.length} cenas; aplicando em ordem.`
        )
      }
      setScenes((prev) =>
        prev.map((s, i) => {
          const ai = result.scenes[i]
          if (!ai) return s
          return {
            ...s,
            prompt: ai.prompt || s.prompt,
            dialogue: ai.dialogue || s.dialogue,
          }
        })
      )
      toast.success("Prompts gerados pelo Claude")
    } catch (err: any) {
      toast.error(err.message || "Erro na análise")
    } finally {
      setAnalyzing(false)
    }
  }

  function addScene() {
    setScenes((s) => [
      ...s,
      { id: Date.now(), dialogue: "", prompt: "", imageUrl: null },
    ])
  }

  function removeScene(id: number) {
    setScenes((s) => s.filter((x) => x.id !== id))
  }

  function updateScene(id: number, patch: Partial<Scene>) {
    setScenes((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  function backToEdit() {
    if (scenes.length && !confirm("Descartar as cenas e voltar?")) return
    setScenes([])
  }

  function openFlowForScene(sceneId: number) {
    setPickerForSceneId(sceneId)
    setFlowPickerOpen(true)
  }

  function openGalleryForScene(sceneId: number) {
    setPickerForSceneId(sceneId)
    setGalleryPickerOpen(true)
  }

  function handleFlowPick(url: string) {
    if (pickerForSceneId !== null) {
      updateScene(pickerForSceneId, { imageUrl: url })
      toast.success("Imagem definida como padrão")
    }
    setFlowPickerOpen(false)
    setPickerForSceneId(null)
  }

  function handleGalleryPick(url: string) {
    if (pickerForSceneId !== null) {
      updateScene(pickerForSceneId, { imageUrl: url })
      toast.success("Imagem da galeria aplicada")
    }
    setGalleryPickerOpen(false)
    setPickerForSceneId(null)
  }

  async function handleSceneUpload(sceneId: number, file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Somente imagens")
      return
    }
    try {
      const { url } = await uploadDirect(file, "image")
      updateScene(sceneId, { imageUrl: url })
      toast.success("Imagem enviada")
    } catch (err: any) {
      toast.error(err.message || "Falha no upload")
    }
  }

  async function submit() {
    const filled = scenes.filter((s) => s.dialogue.trim() || s.prompt.trim())
    if (!filled.length) {
      toast.error("Preencha pelo menos uma cena")
      return
    }
    setSubmitting(true)
    try {
      for (const scene of filled) {
        const promptToSend = scene.prompt.trim() || scene.dialogue.trim()
        await api(`/projects/${projectId}/clips`, {
          method: "POST",
          body: {
            prompt: promptToSend,
            dialogue: scene.dialogue.trim() || null,
            imageUrl: scene.imageUrl || imageUrl,
          },
        })
      }
      toast.success(`${filled.length} cenas adicionadas`)
      await clearDraft()
      onCreated?.()
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const hasScenes = scenes.length > 0
  const allHavePrompt = scenes.every((s) => s.prompt.trim().length > 0)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!flex !max-h-[92vh] !flex-col overflow-hidden sm:!max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {hasScenes ? "Cenas" : "Criar cenas"}
              {draftStatus !== "idle" && (
                <span className="text-muted-foreground mr-8 ml-auto font-mono text-[11px]">
                  {draftStatus === "saving" ? "salvando..." : "rascunho salvo"}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {analyzing && (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 py-20 text-center">
              <div className="relative">
                <div className="border-primary/20 border-t-primary size-12 animate-spin rounded-full border-2" />
                <RiSparkling2Line className="text-primary absolute inset-0 m-auto size-5 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <p className="text-foreground text-sm font-medium">
                  Gerando prompts
                </p>
                <p className="text-muted-foreground max-w-[280px] text-xs leading-relaxed">
                  Claude está vendo cada imagem da cena e escrevendo o prompt
                  Veo 3.1 correspondente.
                </p>
              </div>
            </div>
          )}

          {/* STEP 1: input */}
          {!hasScenes && !analyzing && (
            <>
              {taggedClips.length > 0 && (
                <div className="border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-2 border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-xs font-medium">
                      {taggedClips.length} clip
                      {taggedClips.length > 1 ? "s" : ""} marcado
                      {taggedClips.length > 1 ? "s" : ""} para refazer
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
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
                  <Label>Avatar base</Label>
                  <div
                    className={cn(
                      "border-border bg-muted/30 hover:bg-muted/60 relative flex h-[160px] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden border border-dashed text-center transition-colors",
                      imageUrl &&
                        "border-primary/40 bg-primary/5 border-solid",
                      uploadingImage && "pointer-events-none"
                    )}
                    onClick={() => inputRef.current?.click()}
                  >
                    {uploadingImage && (
                      <div className="bg-background/70 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                        <div className="border-primary/20 border-t-primary size-8 animate-spin rounded-full border-2" />
                        <p className="text-muted-foreground font-mono text-[11px]">
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
                          toast.error("Imagem não pôde ser carregada")
                          setImageUrl(null)
                        }}
                      />
                    ) : (
                      <>
                        <RiUploadCloud2Line className="text-muted-foreground/60 size-5" />
                        <p className="text-muted-foreground text-xs">
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
                    placeholder="Cole aqui o script. Um parágrafo por cena (separados por linha em branco)."
                    className="h-[280px] max-h-[280px] resize-none overflow-y-auto !text-[13px] leading-[1.6] [field-sizing:fixed]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-[160px_1fr] gap-4">
                <div />
                <div className="flex items-center gap-2">
                  <Button onClick={splitScenes}>
                    <RiCheckLine className="size-4" />
                    Dividir cenas
                  </Button>
                  <p className="text-muted-foreground text-[11px]">
                    Quebra o script em uma cena por parágrafo. Depois você
                    customiza imagens e roda a IA.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: scenes */}
          {hasScenes && !analyzing && (
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
                {allHavePrompt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={analyzeWithAI}
                    disabled={analyzing}
                    title="Reanalisar todas as cenas com IA"
                  >
                    <RiSparkling2Line className="size-3.5" />
                    Reanalisar
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="outline" className="rounded-md font-mono">
                    {scenes.length} {scenes.length === 1 ? "cena" : "cenas"}
                  </Badge>
                  <Button size="sm" variant="secondary" onClick={addScene}>
                    <RiAddLine className="size-3.5" />
                    Cena
                  </Button>
                </div>
              </div>
              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                <div className="space-y-1.5">
                  {scenes.map((scene, i) => (
                    <SceneRow
                      key={scene.id}
                      index={i}
                      scene={scene}
                      baseImageUrl={imageUrl}
                      onUpdate={(patch) => updateScene(scene.id, patch)}
                      onRemove={() => removeScene(scene.id)}
                      onOpenFlow={() => openFlowForScene(scene.id)}
                      onOpenGallery={() => openGalleryForScene(scene.id)}
                      onUploadFile={(file) => handleSceneUpload(scene.id, file)}
                    />
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
              {hasScenes && !allHavePrompt ? (
                <Button onClick={analyzeWithAI} disabled={analyzing}>
                  <RiSparkling2Line className="size-4" />
                  Analisar com IA
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  disabled={submitting || !hasScenes || !allHavePrompt}
                >
                  <RiCheckLine className="size-4" />
                  {submitting ? "Criando..." : "Criar todas as cenas"}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ScenePickerFlowDialog
        projectId={projectId}
        baseAvatarUrl={imageUrl}
        open={flowPickerOpen}
        onOpenChange={(o) => {
          setFlowPickerOpen(o)
          if (!o) setPickerForSceneId(null)
        }}
        onPick={handleFlowPick}
      />

      <GalleryPicker
        open={galleryPickerOpen}
        onOpenChange={(o) => {
          setGalleryPickerOpen(o)
          if (!o) setPickerForSceneId(null)
        }}
        onPick={(item) => handleGalleryPick(item.url)}
      />
    </>
  )
}

interface SceneRowProps {
  index: number
  scene: Scene
  baseImageUrl: string | null
  onUpdate: (patch: Partial<Scene>) => void
  onRemove: () => void
  onOpenFlow: () => void
  onOpenGallery: () => void
  onUploadFile: (file: File) => void
}

/** ≈ 3.3 words per second at 160 wpm narration */
function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.max(1, Math.round(words / 3.3))
}

function SceneRow({
  index,
  scene,
  baseImageUrl,
  onUpdate,
  onRemove,
  onOpenFlow,
  onOpenGallery,
  onUploadFile,
}: SceneRowProps) {
  const thumbUrl = scene.imageUrl || baseImageUrl
  const isCustom = !!scene.imageUrl
  const hasPrompt = !!scene.prompt.trim()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [promptOpen, setPromptOpen] = React.useState(false)

  const duration = estimateDuration(scene.dialogue)
  const promptPreview = scene.prompt.trim().slice(0, 120)

  return (
    <div className="group/scene bg-card text-card-foreground relative flex gap-0 rounded-md ring-1 ring-foreground/10 transition-colors hover:ring-foreground/20">
      {/* Timeline spine */}
      <div
        className={cn(
          "w-0.5 shrink-0 transition-colors",
          hasPrompt
            ? "bg-primary"
            : isCustom
              ? "bg-primary/40"
              : "bg-foreground/10"
        )}
        aria-hidden
      />

      {/* Scene index */}
      <div className="flex w-12 shrink-0 flex-col items-center justify-start gap-1 py-3">
        <span className="font-heading text-foreground text-lg font-semibold leading-none tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        {duration > 0 && (
          <span className="text-muted-foreground font-mono text-[10px] leading-none">
            ~{duration}s
          </span>
        )}
      </div>

      {/* Thumbnail */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "relative my-2.5 aspect-[9/16] w-[72px] shrink-0 cursor-context-menu overflow-hidden rounded-md ring-1 transition-all",
              isCustom
                ? "ring-primary/70 shadow-[0_0_0_1px_var(--primary)]"
                : "ring-foreground/15 group-hover/scene:ring-foreground/30"
            )}
            title="Clique com o botão direito pra editar"
          >
            {thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="bg-muted/60 text-muted-foreground flex size-full items-center justify-center">
                <RiImageEditLine className="size-4" />
              </div>
            )}
            {isCustom && (
              <div className="bg-primary text-primary-foreground absolute right-1 top-1 flex size-4 items-center justify-center rounded-md font-mono">
                <RiCheckLine className="size-2.5" />
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={() => fileInputRef.current?.click()}>
            <RiUploadCloud2Line className="size-3.5" />
            Fazer upload de imagem
          </ContextMenuItem>
          <ContextMenuItem onSelect={onOpenGallery}>
            <RiFolderImageLine className="size-3.5" />
            Carregar imagem da galeria
          </ContextMenuItem>
          <ContextMenuItem onSelect={onOpenFlow}>
            <RiImageEditLine className="size-3.5" />
            Customizar no Nano Flow
          </ContextMenuItem>
          {isCustom && (
            <ContextMenuItem
              onSelect={() => onUpdate({ imageUrl: null })}
              className="text-muted-foreground"
            >
              <RiRefreshLine className="size-3.5" />
              Voltar pro avatar base
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUploadFile(f)
          e.target.value = ""
        }}
      />

      {/* Main content */}
      <div className="min-w-0 flex-1 py-2.5 pl-3 pr-2.5">
        <Textarea
          value={scene.dialogue}
          onChange={(e) => onUpdate({ dialogue: e.target.value })}
          placeholder={`Fala da cena ${index + 1}...`}
          className="min-h-[44px] resize-none rounded-md border-0 !bg-transparent p-0 !text-[13px] leading-[1.55] shadow-none [field-sizing:content] focus-visible:ring-0"
        />

        {/* Status strip */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            onClick={() => setPromptOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide transition-colors",
              hasPrompt
                ? "text-foreground hover:text-primary"
                : "text-muted-foreground/70 hover:text-muted-foreground"
            )}
            aria-expanded={promptOpen}
          >
            <span
              className={cn(
                "size-1.5",
                hasPrompt ? "bg-primary" : "bg-foreground/20"
              )}
            />
            <span>Prompt Veo</span>
            {hasPrompt && (
              <span className="text-muted-foreground/60 font-mono text-[10px] normal-case">
                {scene.prompt.trim().split(/\s+/).length}w
              </span>
            )}
            {hasPrompt && !promptOpen && (
              <span className="text-muted-foreground hidden max-w-[32ch] truncate text-[11px] font-normal normal-case md:inline">
                · {promptPreview}…
              </span>
            )}
          </button>

          {isCustom && (
            <span className="text-primary flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide">
              <RiCheckLine className="size-2.5" />
              Imagem custom
            </span>
          )}
        </div>

        {/* Inline prompt editor */}
        {hasPrompt && promptOpen && (
          <Textarea
            value={scene.prompt}
            onChange={(e) => onUpdate({ prompt: e.target.value })}
            className="bg-muted/30 mt-2 min-h-[80px] resize-none rounded-md !text-xs leading-[1.55] [field-sizing:content]"
          />
        )}
      </div>

      {/* Actions (hover reveal) */}
      <div className="flex shrink-0 items-start pr-2 pt-2.5 opacity-0 transition-opacity group-hover/scene:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive size-6"
          onClick={onRemove}
          aria-label={`Remover cena ${index + 1}`}
        >
          <RiCloseLine className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
