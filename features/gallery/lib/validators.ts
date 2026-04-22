import { z } from "zod"
import { ASPECT_RATIOS, REFERENCE_TAGS } from "@/features/nano-flow/types"

export const saveItemSchema = z.object({
  kind: z.enum(["image", "reference"]),
  url: z.string().url(),
  title: z.string().max(200).optional(),
  aspect: z
    .enum(ASPECT_RATIOS as [string, ...string[]])
    .nullable()
    .optional(),
  refTag: z
    .enum(REFERENCE_TAGS as [string, ...string[]])
    .nullable()
    .optional(),
  sourceFlowId: z.string().uuid().optional(),
  sourceNodeId: z.string().optional(),
})

export const updateItemSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(50).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
})

export const categoryInputSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

export const categoryPatchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})
