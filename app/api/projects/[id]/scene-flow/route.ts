import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"
import { loadProject, updateProjectAgentState } from "@/lib/db"
import { createFlow, loadFlow } from "@/features/nano-flow/lib/db"
import type {
  FlowEdge,
  FlowNode,
  ReferenceNodeData,
} from "@/features/nano-flow/types"
import { supabaseAdmin } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * GET  → returns { flowId, flow } (creates + seeds on first access)
 * POST → accepts { baseAvatarUrl } and forces a reseed if requested
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const project = await loadProject(projectId)
    if (!project)
      return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 })

    let flowId = project.sceneFlowId ?? null
    let flow = flowId ? await loadFlow(flowId) : null

    if (!flow) {
      // Create a new flow for this project, pre-seeded if avatar exists
      const created = await createFlow(`Cenas · ${project.name}`)
      flowId = created.id
      await updateProjectAgentState(projectId, { sceneFlowId: flowId })

      if (project.baseAvatarUrl) {
        const refId = `n_${nanoid(8)}`
        const refNode: FlowNode = {
          id: refId,
          type: "reference",
          position: { x: 80, y: 200 },
          data: {
            kind: "reference",
            tag: "pessoa",
            imageUrl: project.baseAvatarUrl,
            label: "avatar base",
          } as ReferenceNodeData,
        }
        const { error } = await supabaseAdmin
          .from("image_flows")
          .update({
            nodes: [refNode],
            edges: [] as FlowEdge[],
          })
          .eq("id", flowId)
        if (error) throw error
      }

      flow = await loadFlow(flowId)
    }

    return NextResponse.json({ flowId, flow })
  } catch (err: any) {
    console.error("[scene-flow GET]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
