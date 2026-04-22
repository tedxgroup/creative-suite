import type { ComponentType } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface PlaceholderViewProps {
  breadcrumb: string
  title: string
  icon: ComponentType<{ className?: string }>
  description?: string
}

export function PlaceholderView({
  breadcrumb,
  title,
  icon: Icon,
  description,
}: PlaceholderViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <p className="text-muted-foreground mb-1 font-mono text-xs tracking-tight">
          {breadcrumb}
        </p>
        <h1 className="font-heading text-foreground text-2xl leading-none font-semibold tracking-tight">
          {title}
        </h1>
      </div>

      <Card className="flex-1">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center">
            <Icon className="size-6" />
          </div>
          <p className="text-foreground text-sm font-medium">Em breve</p>
          {description && (
            <p className="text-muted-foreground max-w-sm text-xs">
              {description}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
