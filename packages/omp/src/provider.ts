import { DEFAULT_BASE_URL } from "@jai-providers/common/api"
import { resolveCredentials } from "@jai-providers/common/credentials"
import { DEFAULT_TTL_MS, discoverModelIds } from "@jai-providers/common/discovery"
import { discoverModelMetadata } from "@jai-providers/common/model-metadata"

import { buildOmpModels, chatCompletionsUrl } from "./models.ts"

const PROVIDER_ID = "japan-ai"
const API = "openai-completions"

export type RegisterProviderOptions = {
  baseURL?: string
  /** Account email, when it is not already in opencode's auth store or the environment. */
  userId?: string
}

/**
 * Registers the provider and its model list at extension load.
 *
 * omp's own `discovery.type: openai-models-list` cannot be used here: it
 * rebuilds the URL from protocol, host, and pathname only, so the `userId`
 * query the gateway requires is dropped and `/models` answers 403. Fetching the
 * list here sidesteps that normalization entirely.
 */
export async function registerJapanAIProvider(pi: any, options: RegisterProviderOptions = {}): Promise<void> {
  const baseURL = options.baseURL ?? DEFAULT_BASE_URL
  const credentials = await resolveCredentials(PROVIDER_ID, options.userId)

  if (!credentials.apiKey || !credentials.userId) {
    console.warn(
      `[${PROVIDER_ID}] no credential found; skipping provider registration. ` +
        "Run `/connect japan-ai` in opencode, or set JAPAN_AI_API_KEY and JAPAN_AI_USER_ID.",
    )
    return
  }

  const ids = await discoverModelIds({ ...credentials, baseURL })
  const metadata = await discoverModelMetadata(ids, DEFAULT_TTL_MS)

  pi.registerProvider(PROVIDER_ID, {
    baseUrl: chatCompletionsUrl(baseURL, credentials.userId),
    api: API,
    apiKey: credentials.apiKey,
    models: buildOmpModels(ids, metadata),
  })
}
