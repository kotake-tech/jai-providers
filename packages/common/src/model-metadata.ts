import { readCachedValue, writeCachedValue } from "./cache.ts"
import type { ModelMeta } from "./catalog.ts"

const MODELS_DEV_URL = "https://models.dev/api.json"
const CACHE_NAME = "japan-ai-model-metadata.json"
const FETCH_TIMEOUT_MS = 5_000

type OnlineMeta = Pick<ModelMeta, "contextWindow" | "maxOutput">
export type OnlineModelMetadata = Record<string, OnlineMeta>

type CachedMetadata = {
  checkedIds: string[]
  models: OnlineModelMetadata
}

type ModelsDevModel = {
  limit?: { context?: unknown; output?: unknown }
}

type ModelsDevProvider = {
  models?: Record<string, ModelsDevModel>
}

const PROVIDERS: ReadonlyArray<{ match: RegExp; id: string }> = [
  { match: /^claude-/, id: "anthropic" },
  { match: /^(gpt-|o3)/, id: "openai" },
  { match: /^gemini-/, id: "google" },
  { match: /^grok-/, id: "xai" },
  { match: /^kimi-/, id: "moonshotai" },
  { match: /^deepseek-/, id: "deepseek" },
  { match: /^glm-/, id: "zai" },
  { match: /^minimax-/, id: "minimax" },
  { match: /^qwen/, id: "alibaba" },
]

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function isOnlineModelMetadata(value: unknown): value is OnlineModelMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  return Object.values(value).every(
    (meta) =>
      typeof meta === "object" &&
      meta !== null &&
      isPositiveNumber((meta as OnlineMeta).contextWindow) &&
      isPositiveNumber((meta as OnlineMeta).maxOutput),
  )
}

function isCachedMetadata(value: unknown): value is CachedMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const cached = value as CachedMetadata
  return Array.isArray(cached.checkedIds) &&
    cached.checkedIds.every((id) => typeof id === "string") &&
    isOnlineModelMetadata(cached.models)
}

function parseMetadata(value: unknown, ids: readonly string[]): OnlineModelMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("models.dev returned an unexpected payload")
  }

  const providers = value as Record<string, ModelsDevProvider>
  return Object.fromEntries(
    ids.flatMap((id) => {
      const providerId = PROVIDERS.find((provider) => provider.match.test(id))?.id
      const limit = providerId ? providers[providerId]?.models?.[id]?.limit : undefined
      return isPositiveNumber(limit?.context) && isPositiveNumber(limit.output)
        ? [[id, { contextWindow: limit.context, maxOutput: limit.output }]]
        : []
    }),
  )
}

export async function discoverModelMetadata(
  ids: readonly string[],
  ttlMs: number,
): Promise<OnlineModelMetadata> {
  const cached = await readCachedValue(CACHE_NAME, isCachedMetadata)
  const coversIds = cached && ids.every((id) => cached.value.checkedIds.includes(id))
  if (coversIds && Date.now() - cached.updatedAt < ttlMs) return cached.value.models

  try {
    const response = await fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) throw new Error(`models.dev failed: ${response.status} ${response.statusText}`)
    const metadata = parseMetadata(await response.json(), ids)
    await writeCachedValue(CACHE_NAME, { checkedIds: [...ids], models: metadata })
    return metadata
  } catch (error) {
    console.warn("[japan-ai] model metadata discovery failed, using cached/bundled metadata:", error)
    return cached?.value.models ?? {}
  }
}
