"use client"

import Link from "next/link"
import { RiImageLine } from "@remixicon/react"
import { cn } from "@/lib/utils"
import type { VideoProject } from "@/lib/types"

interface ProjectCardProps {
  project: VideoProject
  index?: number
}

export function ProjectCard({ project, index = 0 }: ProjectCardProps) {
  const total = project.clips?.length || 0
  const success =
    project.clips?.filter((c) => c.status === "success").length || 0
  const generating =
    project.clips?.filter((c) =>
      ["submitted", "generating"].includes(c.status)
    ).length || 0
  const failed =
    project.clips?.filter((c) => c.status === "fail").length || 0

  const date = new Date(project.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })

  const thumbClip = project.clips?.find((c) => c.imageUrl)
  const thumbUrl = thumbClip?.imageUrl

  // Subtle status indication
  const allDone = total > 0 && success === total
  const statusColor =
    failed > 0
      ? "bg-destructive"
      : generating > 0
        ? "bg-amber-500"
        : allDone
          ? "bg-emerald-500"
          : "bg-muted-foreground/40"

  return (
    <Link
      href={`/projetos/${project.id}`}
      className="group block focus-visible:outline-none"
      style={{ animation: `fadeIn 0.2s ease-out ${index * 25}ms both` }}
    >
      <div className="relative">
        {/* Thumbnail (clean, no overlays) */}
        <div className="bg-muted ring-foreground/10 group-hover:ring-foreground/30 relative aspect-video w-full overflow-hidden ring-1 transition-all">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              style={{ objectPosition: "center 25%" }}
            />
          ) : (
            <div className="text-muted-foreground/30 flex size-full items-center justify-center">
              <RiImageLine className="size-7" />
            </div>
          )}
        </div>

        {/* Info area below */}
        <div className="mt-2.5 flex items-baseline justify-between gap-3">
          <p className="text-foreground group-hover:text-primary truncate text-[13px] font-medium tracking-tight transition-colors">
            {project.name}
          </p>
          <span className="text-muted-foreground flex-shrink-0 font-mono text-[11px]">
            {date}
          </span>
        </div>

        {/* Subtle meta line */}
        <div className="text-muted-foreground mt-1 flex items-center gap-1.5 font-mono text-[10px]">
          <span
            className={cn("inline-block size-1.5 rounded-full", statusColor)}
          />
          <span>
            {total === 0
              ? "vazio"
              : allDone
                ? `${total} clips`
                : `${success}/${total} clips`}
          </span>
        </div>
      </div>
    </Link>
  )
}
