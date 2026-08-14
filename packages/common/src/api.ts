export const DEFAULT_BASE_URL = "https://api.japan-ai.co.jp/v1"

const LIST_TIMEOUT_MS = 5_000

export type ApiCredentials = {
  baseURL: string
  apiKey: string
  /** JAPAN AI requires the account email alongside personal API keys. */
  userId?: string
}

type ModelsResponse = {
  data: Array<{ id: unknown }>
}

function isModelsResponse(value: unknown): value is ModelsResponse {
  return typeof value === "object" && value !== null && Array.isArray((value as ModelsResponse).data)
}

/**
 * Fetches the model ids the API currently serves.
 * Throws on transport, status, or shape errors; callers fall back to the catalog.
 */
export async function listModelIds({ baseURL, apiKey, userId }: ApiCredentials): Promise<string[]> {
  const url = new URL(`${baseURL.replace(/\/$/, "")}/models`)
  if (userId) url.searchParams.set("userId", userId)

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`JAPAN AI /models failed: ${response.status} ${response.statusText}`)
  }

  const body: unknown = await response.json()
  if (!isModelsResponse(body)) {
    throw new Error("JAPAN AI /models returned an unexpected payload")
  }

  return body.data.map((model) => model.id).filter((id): id is string => typeof id === "string" && id.length > 0)
}
