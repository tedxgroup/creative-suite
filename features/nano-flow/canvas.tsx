"use client"

import * as React from "react"
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useShallow } from "zustand/react/shallow"
import { GenerateNode } from "./nodes/generate-node"
import { ImageNode } from "./nodes/image-node"
import { ReferenceNode } from "./nodes/reference-node"
import { CanvasContextMenu } from "./components/add-node-menu"
import { FlowToolbar } from "./components/flow-toolbar"
import { useAutosave } from "./hooks/use-autosave"
import { useFlowStore } from "./store"
import type { FlowEdge, FlowNode, ImageFlow } from "./types"

const nodeTypes = {
  generate: GenerateNode,
  image: ImageNode,
  reference: ReferenceNode,
}

interface FlowCanvasProps {
  initial: ImageFlow
}

function CanvasInner({ initial }: FlowCanvasProps) {
  const hydrated = React.useRef(false)
  const hydrate = useFlowStore((s) => s.hydrate)
  const reset = useFlowStore((s) => s.reset)

  React.useEffect(() => {
    hydrate({
      flowId: initial.id,
      name: initial.name,
      nodes: initial.nodes,
      edges: initial.edges,
      viewport: initial.viewport,
    })
    hydrated.current = true
    return () => reset()
  }, [initial.id, hydrate, reset, initial.name, initial.nodes, initial.edges, initial.viewport])

  useAutosave(initial.id)

  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, setViewport } =
    useFlowStore(
      useShallow((s) => ({
        nodes: s.nodes,
        edges: s.edges,
        onNodesChange: s.onNodesChange as OnNodesChange<FlowNode>,
        onEdgesChange: s.onEdgesChange as OnEdgesChange<FlowEdge>,
        onConnect: s.onConnect as OnConnect,
        setViewport: s.setViewport,
      }))
    )

  if (!hydrated.current) return null

  return (
    <div className="relative h-full w-full">
      <CanvasContextMenu>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMoveEnd={(_, vp) => setViewport(vp)}
          defaultViewport={initial.viewport}
          nodeTypes={nodeTypes}
          minZoom={0.3}
          maxZoom={1.75}
          deleteKeyCode={["Backspace", "Delete"]}
          panOnDrag
          zoomOnScroll
          snapToGrid
          snapGrid={[18, 18]}
          proOptions={{ hideAttribution: true }}
          colorMode="system"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color="var(--border)"
          />
        </ReactFlow>
      </CanvasContextMenu>
      <div className="pointer-events-none absolute right-3 top-3 z-10 flex items-start gap-2">
        <FlowToolbar />
      </div>
    </div>
  )
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
