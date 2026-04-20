import { NextRequest, NextResponse } from "next/server"
import { loadProjects, createProject } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const projects = await loadProjects()
    return NextResponse.json(projects)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name)
    return NextResponse.json(
      { error: "Nome do projeto é obrigatório" },
      { status: 400 }
    )
  try {
    const project = await createProject(name)
    return NextResponse.json(project)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
