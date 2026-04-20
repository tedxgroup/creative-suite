"use client"

import * as React from "react"
import { toast } from "sonner"
import { RiUploadCloud2Line, RiVoiceprintLine, RiCheckLine } from "@remixicon/react"
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
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setImageUrl(null)
      setAudioUrl(null)
      setAudioName(null)
      setPrompt("")
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

  async function submit(addAnother = false) {
    if (model === "infinitetalk") {
      if (!imageUrl || !audioUrl) {
        toast.error("Envie imagem e áudio")
        return
      }
    } else {
      if (!prompt.trim()) {
        toast.error("Digite o prompt")
        return
      }
    }
    setLoading(true)
    try {
      const clip = await api<VideoClip>(`/projects/${projectId}/clips`, {
        method: "POST",
        body: {
          model,
          prompt: prompt.trim(),
          imageUrl,
          audioUrl,
        },
      })
      onAdded?.(clip)
      if (addAnother) {
        setPrompt("")
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
            <div className="grid grid-cols-[180px_1fr] gap-4">
              <div className="grid gap-2">
                <Label>Imagem (opcional)</Label>
                <UploadArea
                  url={imageUrl}
                  accept="image/*"
                  label="Enviar imagem"
                  onFile={uploadImage}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt">Prompt (~8 segundos)</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="O que o avatar fala ou faz neste clip..."
                  className="h-[160px] max-h-[160px] resize-none overflow-y-auto [field-sizing:fixed]"
                  autoFocus
                />
              </div>
            </div>
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
}: {
  url: string | null
  filename?: string | null
  icon?: React.ReactNode
  accept: string
  label: string
  onFile: (file: File) => Promise<void>
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
        "border-border bg-muted/30 hover:bg-muted/60 group flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed p-3 text-center transition-colors",
        url && "border-solid border-primary/40 bg-primary/5"
      )}
      onClick={() => inputRef.current?.click()}
    >
      {url && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="max-h-24 w-auto object-contain"
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
