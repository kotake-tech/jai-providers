import { listModelIds } from "./api.ts"
import { readCachedIds, writeCachedIds } from "./cache.ts"
import { KNOWN_MODEL_IDS } from "./catalog.ts"
import type { Credentials } from "./credentials.ts"

const CACHE_NAME = "japan-ai-models.json"

/** Long enough that startup rarely hits the network, short enough to pick up new models same-day. */
export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1_000

/**
 * `/v1/models` advertises ids that `/chat/completions` then rejects with
 * "Invalid model name": alias ids, free tiers, and the console-only router
 * models. They are dropped so the picker only offers callable models.
 */
export const DEFAULT_EXCLUDE: readonly string[] = [
  "-latest$",
  "-free$",
  "^jai-auto",
  "^glm-5$",
  "^deepseek-chat-v3$",
]

export type DiscoveryInput = Credentials & {
  baseURL: string
  ttlMs?: number
  exclude?: readonly string[]
}

function compile(patterns: readonly string[]): RegExp[] {
  return patterns.flatMap((pattern) => {
    try {
      return [new RegExp(pattern)]
    } catch (error) {
      console.warn(`[japan-ai] ignoring invalid exclude pattern ${pattern}:`, error)
      return []
    }
  })
}

function applyExclude(ids: readonly string[], patterns: readonly string[]): string[] {
  const compiled = compile(patterns)
  return ids.filter((id) => !compiled.some((pattern) => pattern.test(id)))
}

/**
 * Resolves the model ids to register, preferring a fresh `/v1/models` response
 * and degrading through the on-disk cache to the bundled catalog.
 */
export async function discoverModelIds(input: DiscoveryInput): Promise<readonly string[]> {
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS
  const exclude = input.exclude ?? DEFAULT_EXCLUDE
  const cached = await readCachedIds(CACHE_NAME)
  const fallback = () => (cached?.ids.length ? applyExclude(cached.ids, exclude) : KNOWN_MODEL_IDS)

  if (cached && Date.now() - cached.updatedAt < ttlMs && cached.ids.length > 0) {
    return applyExclude(cached.ids, exclude)
  }
  if (!input.apiKey) return fallback()

  try {
    const ids = await listModelIds({ baseURL: input.baseURL, apiKey: input.apiKey, userId: input.userId })
    if (ids.length === 0) throw new Error("JAPAN AI /models returned no models")
    // Cached unfiltered so changing `exclude` does not require a refetch.
    await writeCachedIds(CACHE_NAME, ids)
    return applyExclude(ids, exclude)
  } catch (error) {
    console.warn("[japan-ai] model discovery failed, using cached/bundled model list:", error)
    return fallback()
  }
}
