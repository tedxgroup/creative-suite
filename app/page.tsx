"use client"

import * as React from "react"
import useSWR from "swr"
import { RiAddLine, RiFolderOpenLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectCard } from "@/components/project-card"
import { NewProjectDialog } from "@/components/new-project-dialog"
import { fetcher } from "@/lib/api"
import type { VideoProject } from "@/lib/types"

export default function ProjectsPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const { data: projects, isLoading } = useSWR<VideoProject[]>(
    "/api/projects",
    fetcher
  )

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 font-mono text-[11px] tracking-tight">
            /projetos
          </p>
          <h1 className="font-heading text-foreground text-2xl leading-none font-semibold tracking-tight">
            Projetos
          </h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <RiAddLine className="size-4" />
          Novo projeto
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-video rounded-none" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && projects && projects.length === 0 && (
        <Card className="flex-1">
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center">
              <RiFolderOpenLine className="size-6" />
            </div>
            <p className="text-foreground text-sm font-medium">
              Nenhum projeto ainda
            </p>
            <p className="text-muted-foreground max-w-xs text-xs">
              Crie seu primeiro projeto para começar a gerar clipes de vídeo
              com IA.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => setDialogOpen(true)}
            >
              <RiAddLine className="size-4" />
              Criar projeto
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grid */}
      {!isLoading && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {projects
            .slice()
            .reverse()
            .map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
        </div>
      )}

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
