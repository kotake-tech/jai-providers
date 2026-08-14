import YAML from "yaml"

import { KNOWN_MODEL_IDS, resolveMeta } from "@japan-ai/core/catalog"

const PROVIDER_ID = "japan-ai"

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

/** Catalog order keeps the file grouped by vendor; unknown ids trail alphabetically. */
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

const TEMPLATE = `providers:
  japan-ai:
    # The gateway requires userId as a query param for personal API keys.
    # omp appends \`/chat/completions\` to baseUrl, so the trailing \`#\` parks that
    # suffix in the (never-transmitted) fragment and keeps the query intact.
    baseUrl: ''
    api: openai-completions
    apiKey: '!jq -r ''."japan-ai".key'' ~/.local/share/opencode/auth.json'
    auth: apiKey
    models: []
`

function chatCompletionsUrl(baseURL: string, userId: string): string {
  return `${baseURL.replace(/\/$/, "")}/chat/completions?userId=${userId}#`
}

/**
 * Rewrites only `providers.japan-ai.models`, leaving the rest of the document
 * (other providers, credentials, and comments) exactly as the user wrote it.
 */
export function renderModelsYaml(input: {
  current?: string
  ids: readonly string[]
  baseURL: string
  userId?: string
}): string {
  const doc = YAML.parseDocument(input.current?.trim() ? input.current : TEMPLATE)

  const existingUrl = doc.getIn(["providers", PROVIDER_ID, "baseUrl"])
  if (typeof existingUrl !== "string" || existingUrl.length === 0) {
    if (!input.userId) {
      throw new Error("userId is required to write a new japan-ai provider block")
    }
    doc.setIn(["providers", PROVIDER_ID, "baseUrl"], chatCompletionsUrl(input.baseURL, input.userId))
  }

  doc.setIn(["providers", PROVIDER_ID, "models"], buildOmpModels(input.ids))
  return doc.toString({ lineWidth: 0 })
}
