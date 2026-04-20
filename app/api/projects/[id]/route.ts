import { NextRequest, NextResponse } from "next/server"
import {
  loadProject,
  updateProjectName,
  deleteProject,
} from "@/lib/db"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const project = await loadProject(id)
    if (!project)
      return NextResponse.json(
        { error: "Projeto não encontrado" },
        { status: 404 }
      )
    return NextResponse.json(project)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { name } = await req.json()
  if (!name)
    return NextResponse.json(
      { error: "name é obrigatório" },
      { status: 400 }
    )
  try {
    await updateProjectName(id, name)
    const project = await loadProject(id)
    return NextResponse.json(project)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    await deleteProject(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
