import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ClipStatus } from "@/lib/types"

const labels: Record<ClipStatus, string> = {
  pending: "Pendente",
  submitted: "Enviado",
  generating: "Gerando",
  success: "Pronto",
  fail: "Falhou",
}

const styles: Record<ClipStatus, string> = {
  pending: "border-border bg-muted text-muted-foreground",
  submitted:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  generating:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 animate-pulse",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  fail: "border-destructive/30 bg-destructive/10 text-destructive",
}

export function ClipStatusBadge({ status }: { status: ClipStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 rounded-md px-1.5 font-mono text-[11px] font-medium tracking-tight",
        styles[status]
      )}
    >
      {labels[status]}
    </Badge>
  )
}
