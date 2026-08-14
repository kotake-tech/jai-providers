import { KNOWN_MODEL_IDS, resolveMeta } from "@jai-providers/common/catalog"

/**
 * omp expresses "no reasoning" through the `:none` model selector rather than
 * an effort entry, so `none` is dropped from the ladders.
 */
function ompEfforts(efforts: readonly string[]): string[] {
  return efforts.filter((effort) => effort !== "none")
}

export type OmpModel = {
  id: string
  thinking?: { mode: "effort"; efforts: string[] }
  contextWindow: number
  maxTokens: number
}

/** Catalog order keeps the picker grouped by vendor; unknown ids trail alphabetically. */
function catalogOrder(ids: readonly string[]): string[] {
  const rank = new Map(KNOWN_MODEL_IDS.map((id, index) => [id, index]))
  return [...ids].sort((a, b) => {
    const rankA = rank.get(a) ?? Number.MAX_SAFE_INTEGER
    const rankB = rank.get(b) ?? Number.MAX_SAFE_INTEGER
    return rankA === rankB ? a.localeCompare(b) : rankA - rankB
  })
}

export function buildOmpModels(ids: readonly string[]): OmpModel[] {
  return catalogOrder(ids).map((id) => {
    const meta = resolveMeta(id)
    const efforts = meta.efforts ? ompEfforts(meta.efforts) : []
    return {
      id,
      ...(efforts.length > 0 ? { thinking: { mode: "effort" as const, efforts } } : {}),
      contextWindow: meta.contextWindow,
      maxTokens: meta.maxOutput,
    }
  })
}

/**
 * The gateway requires `userId` as a query param for personal API keys, and omp
 * appends `/chat/completions` to the provider baseUrl. The trailing `#` parks
 * that suffix in the (never-transmitted) fragment and keeps the query intact.
 */
export function chatCompletionsUrl(baseURL: string, userId: string): string {
  return `${baseURL.replace(/\/$/, "")}/chat/completions?userId=${encodeURIComponent(userId)}#`
}
