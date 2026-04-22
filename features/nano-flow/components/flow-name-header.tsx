"use client"

import * as React from "react"
import { useFlowStore } from "../store"

interface FlowNameHeaderProps {
  initialName: string
}

export function FlowNameHeader({ initialName }: FlowNameHeaderProps) {
  const storeName = useFlowStore((s) => s.name)
  const setName = useFlowStore((s) => s.setName)
  const [value, setValue] = React.useState(initialName)

  React.useEffect(() => {
    if (storeName && storeName !== value) setValue(storeName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeName])

  return (
    <input
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        setName(e.target.value)
      }}
      className="text-foreground w-full truncate border-0 bg-transparent text-sm font-semibold tracking-tight outline-none focus:outline-none"
      placeholder="Flow sem título"
    />
  )
}
