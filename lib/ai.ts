import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { ANTHROPIC_API_KEY, OPENAI_API_KEY } from "./env"

export type AIContent = Anthropic.Messages.MessageParam["content"]

export interface AIParams {
  claudeContent: AIContent
  openaiContent: OpenAI.Chat.Completions.ChatCompletionMessageParam["content"]
  maxTokens?: number
}

export async function callAIWithFallback(params: AIParams): Promise<string> {
  if (ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[ai] Claude attempt ${attempt + 1}...`)
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: params.maxTokens || 4000,
          messages: [{ role: "user", content: params.claudeContent }],
        })
        const block = response.content[0]
        if (block.type === "text") return block.text.trim()
      } catch (err: any) {
        const status = err?.status || err?.error?.status
        console.log(`[ai] Claude failed: ${status || err.code || err.message}`)
        const isRetryable =
          status === 529 ||
          status >= 500 ||
          err.code === "ECONNRESET"
        if (!isRetryable) throw err
        if (attempt < 1) await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  if (!OPENAI_API_KEY)
    throw new Error("Claude indisponível e OPENAI_API_KEY não configurada")
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

  console.log("[ai] OpenAI fallback...")
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: params.maxTokens || 4000,
    messages: [{ role: "user", content: params.openaiContent as any }],
  })
  return (response.choices[0].message.content || "").trim()
}
