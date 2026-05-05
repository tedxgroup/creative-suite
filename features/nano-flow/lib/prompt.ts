import type { ReferenceTag } from "../types"

export interface PromptRef {
  tag: ReferenceTag
  label?: string
  isContinuityFrame?: boolean
}

export interface BuildPromptInput {
  basePrompt: string
  references: PromptRef[]
}

const TAG_INSTRUCTIONS: Record<ReferenceTag, string> = {
  pessoa: "use this image as the subject — face, skin, hair, build are STRICTLY locked to this reference",
  cenário: "use this image as the scene — environment, geometry, props, ambient lighting come from here",
  pose: "apply this body pose / posture to the subject",
  ângulo: "match the camera framing, angle and composition of this image",
  luz: "match the lighting condition, color temperature and direction shown here",
  estilo: "match the visual style and treatment of this image",
  objeto: "this object must appear in the scene, integrated naturally",
}

function buildReferenceLines(references: PromptRef[]): string[] {
  const continuity = references.filter((r) => r.isContinuityFrame)
  const tagged = references.filter((r) => !r.isContinuityFrame)
  const lines: string[] = []

  let index = 1
  for (const _ of continuity) {
    lines.push(
      `Reference Image ${index}: previous frame of the same scene — keep subject, clothing, lighting, angle, environment geometry and ALL props identical to this frame; only change what the user prompt explicitly asks for.`
    )
    index++
  }

  for (const r of tagged) {
    const labelHint = r.label ? ` (label: "${r.label}")` : ""
    lines.push(
      `Reference Image ${index} [${r.tag}]${labelHint}: ${TAG_INSTRUCTIONS[r.tag]}.`
    )
    index++
  }

  return lines
}

export function buildNanoBananaPrompt(input: BuildPromptInput): string {
  const sections: string[] = [input.basePrompt.trim()]

  if (input.references.length > 0) {
    sections.push(
      [
        "Reference images (in attached order, follow each tag strictly — do not mix attributes between subjects):",
        ...buildReferenceLines(input.references),
        "Do NOT cross-contaminate features between reference subjects. Each reference's role is locked to its tag.",
      ].join("\n")
    )
  }

  return sections.join("\n\n")
}
