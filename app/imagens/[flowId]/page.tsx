import Link from "next/link"
import { notFound } from "next/navigation"
import { RiArrowLeftLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { FlowCanvas } from "@/features/nano-flow/canvas"
import { FlowNameHeader } from "@/features/nano-flow/components/flow-name-header"
import { loadFlow } from "@/features/nano-flow/lib/db"

export const dynamic = "force-dynamic"

export default async function FlowCanvasPage({
  params,
}: {
  params: Promise<{ flowId: string }>
}) {
  const { flowId } = await params
  const flow = await loadFlow(flowId)
  if (!flow) notFound()

  return (
    <div className="flex h-[calc(100svh-3rem)] flex-col">
      <div className="border-border bg-background flex shrink-0 items-center gap-3 border-b px-4 py-2 sm:px-6">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-7"
        >
          <Link href="/imagens" aria-label="Voltar">
            <RiArrowLeftLine className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="text-muted-foreground font-mono text-[11px] tracking-tight">
            /imagens/{flowId.slice(0, 8)}
          </p>
          <FlowNameHeader initialName={flow.name} />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <FlowCanvas initial={flow} />
      </div>
    </div>
  )
}
