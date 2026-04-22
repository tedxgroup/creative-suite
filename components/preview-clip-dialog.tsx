"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiSendPlaneFill,
} from "@remixicon/react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { VideoProject, VideoClip } from "@/lib/types"

interface PreviewClipDialogProps {
  project: VideoProject
  clipId: string | null
  onOpenChange: (clipId: string | null) => void
  onUpdated?: () => void
}

export function PreviewClipDialog({
  project,
  clipId,
  onOpenChange,
  onUpdated,
}: PreviewClipDialogProps) {
  const readyClips = React.useMemo(
    () =>
      project.clips
        .filter((c) => c.status === "success" && c.videoUrl)
        .sort((a, b) => a.order - b.order),
    [project]
  )
  const idx = clipId ? readyClips.findIndex((c) => c.id === clipId) : -1
  const clip = idx >= 0 ? readyClips[idx] : null
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < readyClips.length - 1

  const [chatMessages, setChatMessages] = React.useState<
    { role: "user" | "ai" | "system"; text: string }[]
  >([])
  const [chatInput, setChatInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const chatBodyRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setChatMessages([])
    setChatInput("")
  }, [clipId])

  React.useEffect(() => {
    if (chatBodyRef.current)
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
  }, [chatMessages])

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!clipId) return
      if (e.key === "ArrowLeft" && hasPrev)
        onOpenChange(readyClips[idx - 1].id)
      if (e.key === "ArrowRight" && hasNext)
        onOpenChange(readyClips[idx + 1].id)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [clipId, hasPrev, hasNext, idx, readyClips, onOpenChange])

  const isInfiniteTalk = (clip?.model || "veo3") === "infinitetalk"

  async function sendMessage() {
    if (!clip || !chatInput.trim()) return
    const message = chatInput.trim()
    const target = clip.id
    setChatMessages((m) => [...m, { role: "user", text: message }])
    setChatInput("")
    setSending(true)
    try {
      const result = await api<any>(
        `/projects/${project.id}/clips/${target}/chat`,
        { method: "POST", body: { message } }
      )
      if (result.error) {
        setChatMessages((m) => [
          ...m,
          { role: "ai", text: "Erro: " + result.error },
        ])
      } else {
        setChatMessages((m) => [
          ...m,
          { role: "ai", text: "Prompt atualizado. Gerando..." },
        ])
        if (result.newClipId) {
          setChatMessages((m) => [
            ...m,
            { role: "system", text: "Nova cena criada com o restante da fala." },
          ])
        }
        // Auto-generate
        api(`/projects/${project.id}/clips/${target}/generate`, {
          method: "POST",
          body: { model: "veo3_lite", aspect_ratio: "9:16" },
        }).then(() => onUpdated?.())
      }
    } catch (err: any) {
      setChatMessages((m) => [
        ...m,
        { role: "ai", text: "Erro: " + err.message },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open={!!clip}
      onOpenChange={(o) => {
        if (!o) onOpenChange(null)
      }}
    >
      <DialogContent
        className="!grid-cols-1 !flex !max-h-[92vh] !w-[max-content] !max-w-[calc(100vw-2rem)] !gap-0 !overflow-hidden !p-0 sm:!max-w-[calc(100vw-2rem)]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          Preview {clip?.order ? `Cena ${clip.order}` : ""}
        </DialogTitle>
        {clip && (
          <>
            {/* Video side — floating nav overlay */}
            <div className="bg-card relative flex flex-shrink-0 items-center justify-center p-3">
              <video
                key={clip.id}
                src={clip.videoUrl!}
                autoPlay
                controls
                playsInline
                className="ring-foreground/10 block max-h-[80vh] w-auto rounded-md ring-1"
              />
              {/* Floating navigation pill over video */}
              <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-1.5 py-1 backdrop-blur-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto size-6 rounded-full text-white/90 hover:bg-white/10 hover:text-white disabled:opacity-30"
                  onClick={() =>
                    hasPrev && onOpenChange(readyClips[idx - 1].id)
                  }
                  disabled={!hasPrev}
                >
                  <RiArrowLeftSLine className="size-3.5" />
                </Button>
                <span className="px-1.5 font-mono text-[11px] text-white/85">
                  {String(clip.order).padStart(2, "0")} /{" "}
                  {String(readyClips.length).padStart(2, "0")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="pointer-events-auto size-6 rounded-full text-white/90 hover:bg-white/10 hover:text-white disabled:opacity-30"
                  onClick={() =>
                    hasNext && onOpenChange(readyClips[idx + 1].id)
                  }
                  disabled={!hasNext}
                >
                  <RiArrowRightSLine className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Right panel */}
            <div className="bg-card flex w-[400px] flex-shrink-0 flex-col border-l">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="text-muted-foreground font-mono text-xs tracking-tight">
                  Detalhes da cena
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => onOpenChange(null)}
                >
                  <RiCloseLine className="size-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-4 p-4">
                  {clip.dialogue && (
                    <Section label="Fala">
                      <p className="text-primary border-l-2 border-primary/40 bg-primary/5 px-3 py-2.5 text-[12px] leading-relaxed">
                        {clip.dialogue}
                      </p>
                    </Section>
                  )}
                  {clip.prompt && (
                    <Section
                      label={isInfiniteTalk ? "Prompt de estilo" : "Prompt VEO 3.1"}
                    >
                      <p className="text-muted-foreground text-[12px] leading-relaxed">
                        {clip.prompt}
                      </p>
                    </Section>
                  )}
                </div>
              </ScrollArea>

              {/* Chat — only for VEO clips */}
              {!isInfiniteTalk && (
                <div className="flex h-[280px] flex-col border-t">
                  <div
                    ref={chatBodyRef}
                    className="flex-1 space-y-2 overflow-y-auto p-3"
                  >
                    <ChatMessage role="ai">
                      Precisa ajustar algo? Descreva a mudança.
                    </ChatMessage>
                    {chatMessages.map((m, i) => (
                      <ChatMessage key={i} role={m.role}>
                        {m.text}
                      </ChatMessage>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 border-t p-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ajustar gesto, câmera..."
                      disabled={sending}
                      className="h-8 rounded-md text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="size-8 flex-shrink-0"
                      onClick={sendMessage}
                      disabled={sending || !chatInput.trim()}
                    >
                      <RiSendPlaneFill className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 font-mono text-[11px] uppercase tracking-wider">
        {label}
      </p>
      {children}
    </div>
  )
}

function ChatMessage({
  role,
  children,
}: {
  role: "user" | "ai" | "system"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "max-w-[90%] px-2.5 py-1.5 text-xs leading-relaxed",
        role === "user" &&
          "bg-primary text-primary-foreground ml-auto",
        role === "ai" &&
          "bg-muted text-foreground ring-1 ring-foreground/10",
        role === "system" &&
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto font-mono text-center text-[11px]"
      )}
    >
      {children}
    </div>
  )
}
