"use client"

import * as React from "react"
import { toast } from "sonner"
import { RiCheckLine, RiLoader4Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import { FlowCanvas } from "@/features/nano-flow/canvas"
import { useFlowStore } from "@/features/nano-flow/store"
import type { ImageFlow } from "@/features/nano-flow/types"

interface ScenePickerFlowDialogProps {
  projectId: string
  baseAvatarUrl: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (imageUrl: string) => void
}

export function ScenePickerFlowDialog({
  projectId,
  open,
  onOpenChange,
  onPick,
}: ScenePickerFlowDialogProps) {
  const [flow, setFlow] = React.useState<ImageFlow | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setFlow(null)
    setLoading(true)
    ;(async () => {
      try {
        const res = await api<{ flowId: string; flow: ImageFlow }>(
          `/projects/${projectId}/scene-flow`,
          { method: "GET" }
        )
        if (!cancelled) setFlow(res.flow)
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Falha ao carregar flow")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex h-[90vh] w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] flex-col gap-0 p-0 sm:!max-w-[calc(100vw-2rem)]">
        <DialogTitle className="sr-only">
          Nano Flow do projeto
        </DialogTitle>
        <div className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-2">
          <p className="text-muted-foreground font-mono text-xs">
            Nano Flow · workspace visual do projeto
          </p>
          <SelectedImageHint onPick={onPick} />
        </div>
        <div className="relative min-h-0 flex-1">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <RiLoader4Line className="size-4 animate-spin" />
                Carregando flow do projeto...
              </div>
            </div>
          )}
          {flow && <FlowCanvas initial={flow} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Watches the Nano Flow store for a selected Image node and shows the
 * "Definir como padrão" button when there is exactly one image selected.
 */
function SelectedImageHint({
  onPick,
}: {
  onPick: (imageUrl: string) => void
}) {
  // Return a primitive (string | null) so Zustand caches the snapshot correctly.
  // Returning a fresh object like `{ url }` causes an infinite re-render loop.
  const selectedImageUrl = useFlowStore((s) => {
    let found: string | null = null
    let count = 0
    for (const n of s.nodes) {
      if (!n.selected) continue
      count++
      if (count > 1) return null
      if (n.data.kind === "image") {
        found = (n.data as { url: string }).url
      } else {
        return null
      }
    }
    return found
  })

  if (!selectedImageUrl) return <div className="ml-auto" />

  return (
    <Button
      size="sm"
      className="ml-auto mr-8"
      onClick={() => onPick(selectedImageUrl)}
    >
      <RiCheckLine className="size-3.5" />
      Definir como padrão
    </Button>
  )
}
