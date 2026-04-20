"use client"

import * as React from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { ClipRow } from "./clip-row"
import type { VideoClip } from "@/lib/types"

interface ClipListProps {
  clips: VideoClip[]
  onReorder?: (orderedIds: string[]) => void
  onPlay?: (id: string) => void
  onGenerate?: (id: string) => void
  onRetry?: (id: string) => void
  onDownload?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onToggleTag?: (id: string) => void
}

export function ClipList({ clips, onReorder, ...handlers }: ClipListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const sorted = React.useMemo(
    () => [...clips].sort((a, b) => a.order - b.order),
    [clips]
  )
  const ids = React.useMemo(() => sorted.map((c) => c.id), [sorted])

  function handleDragStart(event: DragStartEvent) {
    console.log("[dnd] drag start", event.active.id)
  }

  function handleDragEnd(event: DragEndEvent) {
    console.log("[dnd] drag end", {
      active: event.active.id,
      over: event.over?.id,
    })
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    const newOrder = arrayMove(ids, oldIndex, newIndex)
    onReorder?.(newOrder)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {sorted.map((clip) => (
            <ClipRow key={clip.id} clip={clip} {...handlers} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
