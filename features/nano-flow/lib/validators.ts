import { z } from "zod"
import {
  ASPECT_RATIOS,
  COPIES_RANGE,
  REFERENCE_TAGS,
  RESOLUTIONS,
} from "../types"

export const referenceTagSchema = z.enum(REFERENCE_TAGS as [string, ...string[]])
export const aspectSchema = z.enum(ASPECT_RATIOS as [string, ...string[]])
export const resolutionSchema = z.enum(RESOLUTIONS as [string, ...string[]])
export const copiesSchema = z
  .number()
  .int()
  .refine((n): n is (typeof COPIES_RANGE)[number] =>
    (COPIES_RANGE as readonly number[]).includes(n)
  )

export const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
})

export const flowPatchSchema = z.object({
  name: z.string().max(200).optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  viewport: viewportSchema.optional(),
})

export const generateRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  references: z
    .array(
      z.object({
        imageUrl: z.string().url(),
        tag: referenceTagSchema,
        label: z.string().optional(),
        isContinuityFrame: z.boolean().optional(),
      })
    )
    .max(14)
    .default([]),
  aspect: aspectSchema,
  resolution: resolutionSchema,
  copies: copiesSchema,
  flowId: z.string().uuid(),
  nodeId: z.string().min(1),
})

export const createFlowSchema = z.object({
  name: z.string().max(200).optional(),
})
