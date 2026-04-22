"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { RiAddLine, RiImageLine, RiDeleteBinLine } from "@remixicon/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { fetcher } from "@/lib/api"
import type { ImageFlowSummary } from "@/features/nano-flow/types"

function relativeTime(iso: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (diff < 60) return `há ${diff}s`
  const m = Math.floor(diff / 60)
  if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

export default function FlowsPage() {
  const router = useRouter()
  const { data, isLoading, mutate } = useSWR<{ flows: ImageFlowSummary[] }>(
    "/api/flows",
    fetcher
  )
  const [creating, setCreating] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null)

  async function createFlow() {
    setCreating(true)
    try {
      const res = await fetch("/api/flows", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha ao criar flow")
      router.push(`/imagens/${json.id}`)
    } catch (err: any) {
      toast.error(err.message)
      setCreating(false)
    }
  }

  async function deleteFlow(id: string) {
    try {
      const res = await fetch(`/api/flows/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Falha ao remover")
      }
      toast.success("Flow removido")
      mutate()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setPendingDelete(null)
    }
  }

  const flows = data?.flows ?? []

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 font-mono text-xs tracking-tight">
            /imagens
          </p>
          <h1 className="font-heading text-foreground text-2xl leading-none font-semibold tracking-tight">
            Imagens
          </h1>
          <p className="text-muted-foreground mt-2 max-w-md text-xs">
            Canvas visual para compor prompts e gerar imagens com Nano Banana Pro.
          </p>
        </div>
        <Button onClick={createFlow} disabled={creating}>
          <RiAddLine className="size-4" />
          Nova flow
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-md" />
          ))}
        </div>
      )}

      {!isLoading && flows.length === 0 && (
        <Card className="flex-1">
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center">
              <RiImageLine className="size-6" />
            </div>
            <p className="text-foreground text-sm font-medium">
              Nenhuma flow ainda
            </p>
            <p className="text-muted-foreground max-w-xs text-xs">
              Crie uma flow para começar a orquestrar referências, prompts e imagens
              num canvas visual.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={createFlow}
              disabled={creating}
            >
              <RiAddLine className="size-4" />
              Criar flow
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && flows.length > 0 && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {flows.map((f) => (
            <div key={f.id} className="group relative flex flex-col gap-2">
              <Link
                href={`/imagens/${f.id}`}
                className="border-border bg-muted/30 hover:border-ring relative block aspect-video overflow-hidden rounded-md border transition-colors"
              >
                {f.thumbnailUrl ? (
                  <Image
                    src={f.thumbnailUrl}
                    alt={f.name}
                    fill
                    sizes="400px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                    <RiImageLine className="size-6" />
                  </div>
                )}
              </Link>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/imagens/${f.id}`}
                    className="text-foreground hover:text-primary block truncate text-xs font-medium"
                  >
                    {f.name}
                  </Link>
                  <p className="text-muted-foreground font-mono text-[11px]">
                    {relativeTime(f.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive size-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => setPendingDelete(f.id)}
                  aria-label="Remover flow"
                >
                  <RiDeleteBinLine className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover flow?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação move a flow e todas as imagens geradas para a lixeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteFlow(pendingDelete)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
