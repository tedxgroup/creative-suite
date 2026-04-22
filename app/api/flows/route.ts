import { NextRequest, NextResponse } from "next/server"
import { createFlow, listFlows } from "@/features/nano-flow/lib/db"
import { createFlowSchema } from "@/features/nano-flow/lib/validators"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const flows = await listFlows()
    return NextResponse.json({ flows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = createFlowSchema.parse(body)
    const flow = await createFlow(parsed.name)
    return NextResponse.json({ id: flow.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
