import { NextRequest, NextResponse } from "next/server"
import { makeKey, uploadToStorage } from "@/lib/storage-bucket"
import { createGeneratedImage } from "@/features/nano-flow/lib/db"
import { saveItem as saveGalleryItem } from "@/features/gallery/lib/db"
import {
  generateWithNanoBananaPro,
  NANO_BANANA_PRO_MODEL,
} from "@/features/nano-flow/lib/nano-banana"
import { buildNanoBananaPrompt } from "@/features/nano-flow/lib/prompt"
import { generateRequestSchema } from "@/features/nano-flow/lib/validators"
import type { ReferenceTag } from "@/features/nano-flow/types"

export const dynamic = "force-dynamic"
export const maxDuration = 180

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = generateRequestSchema.parse(body)

    const refs = parsed.references.slice(0, 14)

    const finalPrompt = buildNanoBananaPrompt({
      basePrompt: parsed.prompt,
      references: refs.map((r) => ({
        tag: r.tag as ReferenceTag,
        label: r.label,
        isContinuityFrame: r.isContinuityFrame,
      })),
    })

    // Run N generations in parallel
    const results = await Promise.allSettled(
      Array.from({ length: parsed.copies }).map(() =>
        generateWithNanoBananaPro({
          prompt: finalPrompt,
          referenceImageUrls: refs.map((r) => r.imageUrl),
          aspect: parsed.aspect,
          resolution: parsed.resolution,
        })
      )
    )

    const successes = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof generateWithNanoBananaPro>>> =>
        r.status === "fulfilled"
    )
    const failures = results.filter((r) => r.status === "rejected")

    if (successes.length === 0) {
      const firstErr = failures[0] as PromiseRejectedResult | undefined
      throw new Error(
        (firstErr?.reason as Error)?.message || "Todas as gerações falharam"
      )
    }

    const persisted = await Promise.all(
      successes.map(async (r) => {
        const { base64, mimeType } = r.value
        const ext = mimeType.split("/")[1]?.split("+")[0] || "png"
        const key = makeKey("generated-images", `nano.${ext}`)
        const buffer = Buffer.from(base64, "base64")
        const { url } = await uploadToStorage({
          key,
          body: buffer,
          contentType: mimeType,
        })
        const record = await createGeneratedImage({
          flowId: parsed.flowId,
          nodeId: parsed.nodeId,
          url,
          prompt: finalPrompt,
          refsUsed: refs.map((rr) => ({
            url: rr.imageUrl,
            tag: rr.tag as ReferenceTag,
          })),
          aspect: parsed.aspect,
          resolution: parsed.resolution,
          model: NANO_BANANA_PRO_MODEL,
        })
        // Auto-save every generation to the gallery (no-op if already present)
        try {
          await saveGalleryItem({
            kind: "image",
            url,
            aspect: parsed.aspect as any,
            sourceFlowId: parsed.flowId,
            sourceNodeId: parsed.nodeId,
          })
        } catch (e) {
          console.warn("[flows/generate] auto-gallery save failed:", e)
        }
        return { id: record.id, url: record.url }
      })
    )

    return NextResponse.json({
      images: persisted,
      refined: finalPrompt,
      partial: failures.length > 0 ? failures.length : undefined,
    })
  } catch (err: any) {
    console.error("[flows/generate]", err)
    const status = err?.status || err?.statusCode
    const message = err.message || "Falha na geração"
    return NextResponse.json(
      { error: message },
      { status: status && status >= 400 && status < 600 ? status : 500 }
    )
  }
}
