"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import {
  RiArrowLeftLine,
  RiAddLine,
  RiListUnordered,
  RiPlayFill,
  RiRefreshLine,
  RiDownloadLine,
  RiAlertLine,
  RiLoader4Line,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { ClipList } from "@/components/clip-list"
import { AddClipDialog } from "@/components/add-clip-dialog"
import { BulkScenesDialog } from "@/components/bulk-scenes-dialog"
import { PreviewClipDialog } from "@/components/preview-clip-dialog"
import { api, fetcher } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { VideoProject } from "@/lib/types"

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const swrKey = `/api/projects/${id}`
  const { data: project, isLoading, mutate: mutateProject } =
    useSWR<VideoProject>(swrKey, fetcher)

  const [addOpen, setAddOpen] = React.useState(false)
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [previewClipId, setPreviewClipId] = React.useState<string | null>(null)

  // Auto-poll status when there are active clips
  const hasActive = React.useMemo(
    () =>
      project?.clips.some((c) =>
        ["submitted", "generating"].includes(c.status)
      ) || false,
    [project]
  )

  React.useEffect(() => {
    if (!hasActive) return
    const interval = setInterval(async () => {
      try {
        const updated = await api<VideoProject>(
          `/projects/${id}/check-status`,
          { method: "POST" }
        )
        mutateProject(updated, false)
      } catch (err) {
        console.error("[poll]", err)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [hasActive, id, mutateProject])

  const stats = React.useMemo(() => {
    if (!project) return null
    const total = project.clips.length
    const success = project.clips.filter((c) => c.status === "success").length
    const generating = project.clips.filter((c) =>
      ["submitted", "generating"].includes(c.status)
    ).length
    const pending = project.clips.filter((c) => c.status === "pending").length
    const failed = project.clips.filter((c) => c.status === "fail").length
    const duration = success * 8
    const min = Math.floor(duration / 60)
    const sec = duration % 60
    const durationStr = `${min}:${String(sec).padStart(2, "0")}`
    return { total, success, generating, pending, failed, durationStr }
  }, [project])

  // ============= Actions =============

  async function handleReorder(orderedIds: string[]) {
    if (!project) return
    // Optimistic update — build fresh references so SWR + useMemo detect the change
    const reorderedClips = orderedIds
      .map((cid, i) => {
        const c = project.clips.find((x) => x.id === cid)
        return c ? { ...c, order: i + 1 } : null
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
    mutateProject({ ...project, clips: reorderedClips }, false)
    try {
      await api(`/projects/${id}/reorder`, {
        method: "POST",
        body: { clipIds: orderedIds },
      })
    } catch (err: any) {
      toast.error("Erro ao reordenar")
      mutateProject() // refetch to recover server truth
    }
  }

  async function handleGenerate(clipId: string) {
    try {
      await api(`/projects/${id}/clips/${clipId}/generate`, {
        method: "POST",
        body: { model: "veo3_lite", aspect_ratio: "9:16" },
      })
      mutateProject()
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar")
    }
  }

  async function handleGenerateAll() {
    if (!stats) return
    const pendingCount = stats.pending + stats.failed
    if (pendingCount === 0) {
      toast.info("Nenhum clip pendente")
      return
    }
    if (!confirm(`Gerar ${pendingCount} clips?`)) return
    try {
      toast.info(`Enviando ${pendingCount} clips para geração...`)
      await api(`/projects/${id}/generate-all`, {
        method: "POST",
        body: { model: "veo3_lite", aspect_ratio: "9:16" },
      })
      mutateProject()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleCheckStatus() {
    try {
      const updated = await api<VideoProject>(
        `/projects/${id}/check-status`,
        { method: "POST" }
      )
      mutateProject(updated, false)
      toast.success("Status atualizado")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleRetry(clipId: string) {
    return handleGenerate(clipId)
  }

  async function handleDownload(clipId: string) {
    try {
      await api(`/projects/${id}/clips/${clipId}/download`, { method: "POST" })
      mutateProject()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleDownloadAll() {
    if (!stats || stats.success === 0) {
      toast.info("Nenhum vídeo pronto")
      return
    }
    window.location.href = `/api/projects/${id}/download-zip`
  }

  async function handleDuplicate(clipId: string) {
    try {
      await api(`/projects/${id}/clips/${clipId}/duplicate`, { method: "POST" })
      mutateProject()
      toast.success("Clip duplicado")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleDelete(clipId: string) {
    try {
      await api(`/projects/${id}/clips/${clipId}`, { method: "DELETE" })
      mutateProject()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleToggleTag(clipId: string) {
    if (!project) return
    const clip = project.clips.find((c) => c.id === clipId)
    if (!clip) return
    const newVal = !clip.tagged
    // Optimistic
    const updated = { ...project }
    const c = updated.clips.find((x) => x.id === clipId)
    if (c) c.tagged = newVal
    mutateProject(updated, false)
    try {
      await api(`/projects/${id}/clips/${clipId}`, {
        method: "PUT",
        body: { tagged: newVal },
      })
    } catch (err: any) {
      toast.error(err.message)
      mutateProject()
    }
  }

  async function handleDeleteProject() {
    try {
      await api(`/projects/${id}`, { method: "DELETE" })
      mutate("/api/projects")
      router.push("/")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <Skeleton className="h-8 w-64 rounded-none" />
        <Skeleton className="h-12 w-full rounded-none" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-none" />
        ))}
      </div>
    )
  }

  if (!project) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <RiAlertLine className="text-muted-foreground size-8" />
        <p className="text-foreground text-sm font-medium">
          Projeto não encontrado
        </p>
        <Button variant="secondary" onClick={() => router.push("/")}>
          <RiArrowLeftLine className="size-4" />
          Voltar para projetos
        </Button>
      </div>
    )
  }

  const needsGeneration = stats!.pending > 0 || stats!.failed > 0

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-3 px-4 py-5 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <RiArrowLeftLine className="size-4" />
            Voltar
          </Button>
          <p className="text-muted-foreground truncate font-mono text-[12px] tracking-tight">
            /projetos / <span className="text-foreground">{project.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasActive && (
            <Badge
              variant="outline"
              className="h-7 gap-1.5 rounded-none border-emerald-500/30 bg-emerald-500/10 px-2 font-mono text-[10px] text-emerald-600 dark:text-emerald-400"
            >
              <RiLoader4Line className="size-3 animate-spin" />
              Monitorando
            </Badge>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O projeto &ldquo;{project.name}
                  &rdquo; e todos os seus clips serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProject}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          <RiAddLine className="size-3.5" />
          Clip
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setBulkOpen(true)}
        >
          <RiListUnordered className="size-3.5" />
          Cenas
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          size="sm"
          onClick={handleGenerateAll}
          disabled={!needsGeneration}
        >
          <RiPlayFill className="size-3.5" />
          Gerar todos
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCheckStatus}
          className="text-muted-foreground"
        >
          <RiRefreshLine className="size-3.5" />
          Atualizar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDownloadAll}
          className="text-muted-foreground"
        >
          <RiDownloadLine className="size-3.5" />
          Baixar todos
        </Button>

        {/* Summary stats inline */}
        {stats!.total > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <SummaryPill label="clips" value={stats!.total} />
            <SummaryPill label="prontos" value={stats!.success} />
            {stats!.generating > 0 && (
              <SummaryPill label="gerando" value={stats!.generating} accent="amber" />
            )}
            {stats!.pending > 0 && (
              <SummaryPill label="fila" value={stats!.pending} accent="muted" />
            )}
            {stats!.failed > 0 && (
              <SummaryPill label="falhos" value={stats!.failed} accent="destructive" />
            )}
            <SummaryPill label="vídeo" value={stats!.durationStr} accent="primary" />
          </div>
        )}
      </div>

      {/* Empty state or list */}
      {project.clips.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
          <p className="text-foreground text-sm font-medium">
            Nenhum clip neste projeto
          </p>
          <p className="text-muted-foreground max-w-xs text-xs">
            Adicione clips manualmente ou use Cenas para gerar várias de um
            script.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => setAddOpen(true)}
          >
            <RiAddLine className="size-4" />
            Adicionar clip
          </Button>
        </div>
      ) : (
        <ClipList
          clips={project.clips}
          onReorder={handleReorder}
          onGenerate={handleGenerate}
          onRetry={handleRetry}
          onDownload={handleDownload}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onToggleTag={handleToggleTag}
          onPlay={(cid) => setPreviewClipId(cid)}
        />
      )}

      <AddClipDialog
        projectId={id}
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => mutateProject()}
      />

      <BulkScenesDialog
        projectId={id}
        taggedClips={project.clips.filter((c) => c.tagged)}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onCreated={() => mutateProject()}
      />

      <PreviewClipDialog
        project={project}
        clipId={previewClipId}
        onOpenChange={setPreviewClipId}
        onUpdated={() => mutateProject()}
      />
    </div>
  )
}

function SummaryPill({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: "amber" | "destructive" | "muted" | "primary"
}) {
  return (
    <div
      className={cn(
        "ring-foreground/10 inline-flex items-center gap-1.5 px-2.5 py-1 ring-1 font-mono text-[11px]",
        accent === "primary" && "ring-primary/40 bg-primary/5"
      )}
    >
      <span
        className={cn(
          "font-semibold tabular-nums",
          !accent && "text-foreground",
          accent === "amber" && "text-amber-600 dark:text-amber-400",
          accent === "destructive" && "text-destructive",
          accent === "muted" && "text-muted-foreground",
          accent === "primary" && "text-primary"
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
