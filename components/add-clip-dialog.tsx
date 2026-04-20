"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  RiUploadCloud2Line,
  RiVoiceprintLine,
  RiCheckLine,
  RiSparkling2Line,
  RiLoader4Line,
  RiArrowLeftLine,
} from "@remixicon/react"
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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { VideoClip } from "@/lib/types"

interface AddClipDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded?: (clip: VideoClip) => void
}

type Model = "veo3" | "infinitetalk"

export function AddClipDialog({
  projectId,
  open,
  onOpenChange,
  onAdded,
}: AddClipDialogProps) {
  const [model, setModel] = React.useState<Model>("veo3")
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null)
  const [audioName, setAudioName] = React.useState<string | null>(null)
  const [prompt, setPrompt] = React.useState("")
  const [dialogue, setDialogue] = React.useState("")
  const [generatedPrompt, setGeneratedPrompt] = React.useState<string | null>(
    null
  )
  const [analyzing, setAnalyzing] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setImageUrl(null)
      setAudioUrl(null)
      setAudioName(null)
      setPrompt("")
      setDialogue("")
      setGeneratedPrompt(null)
    }
  }, [open])

  async function uploadImage(file: File) {
    const fd = new FormData()
    fd.append("image", file)
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const data = await res.json()
    if (data.url) setImageUrl(data.url)
  }
  async function uploadAudio(file: File) {
    const fd = new FormData()
    fd.append("audio", file)
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    const data = await res.json()
    if (data.url) {
      setAudioUrl(data.url)
      setAudioName(file.name)
    }
  }

  async function analyzeWithAI() {
    const text = dialogue.trim()
    if (!text) {
      toast.error("Digite a fala/roteiro primeiro")
      return
    }
    setAnalyzing(true)
    try {
      const result = await api<{ scenes: any[]; error?: string }>(
        "/analyze-script",
        { method: "POST", body: { script: text, imageUrl } }
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      const first = result.scenes?.[0]
      if (!first?.prompt) {
        toast.error("A IA não retornou prompt")
        return
      }
      setGeneratedPrompt(first.prompt)
      setPrompt(first.prompt)
      toast.success("Prompt gerado")
    } catch (err: any) {
      toast.error(err.message || "Erro na análise")
    } finally {
      setAnalyzing(false)
    }
  }

  function discardGenerated() {
    setGeneratedPrompt(null)
    setPrompt("")
  }

  async function submit(addAnother = false) {
    if (model === "infinitetalk") {
      if (!imageUrl || !audioUrl) {
        toast.error("Envie imagem e áudio")
        return
      }
    } else {
      const promptToSend = prompt.trim() || dialogue.trim()
      if (!promptToSend) {
        toast.error("Digite a fala ou o prompt")
        return
      }
    }
    setLoading(true)
    try {
      const promptToSend = prompt.trim() || dialogue.trim()
      const clip = await api<VideoClip>(`/projects/${projectId}/clips`, {
        method: "POST",
        body: {
          model,
          prompt: promptToSend,
          dialogue: dialogue.trim() || null,
          imageUrl,
          audioUrl,
        },
      })
      onAdded?.(clip)
      if (addAnother) {
        setPrompt("")
        setDialogue("")
        setGeneratedPrompt(null)
      } else {
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar clip")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Novo clip</DialogTitle>
        </DialogHeader>

        <Tabs value={model} onValueChange={(v) => setModel(v as Model)}>
          <TabsList className="w-full">
            <TabsTrigger value="veo3" className="flex-1">
              VEO 3.1
            </TabsTrigger>
            <TabsTrigger value="infinitetalk" className="flex-1">
              InfiniteTalk
            </TabsTrigger>
          </TabsList>

          <TabsContent value="veo3" className="space-y-4 pt-4">
            {analyzing ? (
              <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
                <div className="relative">
                  <div className="border-primary/20 border-t-primary size-12 animate-spin rounded-full border-2" />
                  <RiSparkling2Line className="text-primary absolute inset-0 m-auto size-5 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-foreground text-sm font-medium">
                    Analisando fala
                  </p>
                  <p className="text-muted-foreground max-w-[280px] text-[11px] leading-relaxed">
                    Claude está lendo a imagem e gerando o prompt estruturado
                    VEO 3.1.
                  </p>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10px]">
                  <RiLoader4Line className="size-3 animate-spin" />
                  <span>Isso pode levar 15-30 segundos</span>
                </div>
              </div>
            ) : generatedPrompt ? (
              <div className="grid grid-cols-[180px_1fr] gap-4">
                <div className="grid gap-2">
                  <Label>Imagem</Label>
                  <UploadArea
                    url={imageUrl}
                    accept="image/*"
                    label="Enviar imagem"
                    onFile={uploadImage}
                    className="h-[220px]"
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="prompt">Prompt gerado (VEO 3.1)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground -mr-2 h-7"
                      onClick={discardGenerated}
                    >
                      <RiArrowLeftLine className="size-3.5" />
                      Voltar
                    </Button>
                  </div>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="h-[220px] max-h-[220px] resize-none overflow-y-auto font-mono !text-[11px] leading-relaxed [field-sizing:fixed]"
                  />
                  {dialogue.trim() && (
                    <p className="text-muted-foreground text-[10px]">
                      Fala original preservada · {dialogue.trim().length} chars
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[180px_1fr] gap-4">
                <div className="grid gap-2">
                  <Label>Imagem (opcional)</Label>
                  <UploadArea
                    url={imageUrl}
                    accept="image/*"
                    label="Enviar imagem"
                    onFile={uploadImage}
                    className="h-[160px]"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="prompt">Fala / roteiro (~8 segundos)</Label>
                  <Textarea
                    id="prompt"
                    value={dialogue}
                    onChange={(e) => setDialogue(e.target.value)}
                    placeholder="O que o avatar fala ou faz neste clip..."
                    className="h-[160px] max-h-[160px] resize-none overflow-y-auto !text-[13px] leading-[1.6] [field-sizing:fixed]"
                    autoFocus
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-[10px]">
                      Digite a fala natural — a IA gera o prompt VEO 3.1
                      estruturado a partir dela e da imagem.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={analyzeWithAI}
                      disabled={!dialogue.trim()}
                      className="flex-shrink-0"
                    >
                      <RiSparkling2Line className="size-3.5" />
                      Analisar com IA
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="infinitetalk" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Imagem do avatar</Label>
                <UploadArea
                  url={imageUrl}
                  accept="image/*"
                  label="Enviar imagem"
                  onFile={uploadImage}
                />
              </div>
              <div className="grid gap-2">
                <Label>Áudio (voz)</Label>
                <UploadArea
                  url={audioUrl}
                  filename={audioName}
                  icon={<RiVoiceprintLine className="size-4" />}
                  accept="audio/*"
                  label="Enviar .mp3 ou .wav"
                  onFile={uploadAudio}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {!analyzing && (
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => submit(false)}
              disabled={loading}
            >
              Adicionar
            </Button>
            <Button onClick={() => submit(true)} disabled={loading}>
              Adicionar + novo
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function UploadArea({
  url,
  filename,
  icon,
  accept,
  label,
  onFile,
  className,
}: {
  url: string | null
  filename?: string | null
  icon?: React.ReactNode
  accept: string
  label: string
  onFile: (file: File) => Promise<void>
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  async function handle(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      await onFile(file)
    } finally {
      setUploading(false)
    }
  }

  const isImage = url && /\.(png|jpg|jpeg|webp|gif)$/i.test(url)

  return (
    <div
      className={cn(
        "border-border bg-muted/30 hover:bg-muted/60 group flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden border border-dashed text-center transition-colors",
        !url && "p-3",
        url && "border-solid border-primary/40 bg-primary/5",
        url && !isImage && "p-3",
        className
      )}
      onClick={() => inputRef.current?.click()}
    >
      {url && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="size-full object-cover"
        />
      ) : url ? (
        <>
          <RiCheckLine className="text-primary size-4" />
          <p className="text-foreground truncate text-[11px]">
            {filename || "Enviado"}
          </p>
        </>
      ) : (
        <>
          {icon || (
            <RiUploadCloud2Line className="text-muted-foreground/60 size-5" />
          )}
          <p className="text-muted-foreground text-[11px]">
            {uploading ? "Enviando..." : label}
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  )
}
