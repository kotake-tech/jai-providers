import type { Config, Plugin, PluginOptions } from "@opencode-ai/plugin"

import { DEFAULT_BASE_URL } from "@jai-providers/common/api"
import { KNOWN_MODEL_IDS } from "@jai-providers/common/catalog"
import { resolveCredentials } from "@jai-providers/common/credentials"
import { DEEP_THINK_PROMPT } from "@jai-providers/common/deep-think"
import { DEFAULT_TTL_MS, discoverModelIds } from "@jai-providers/common/discovery"
import { discoverModelMetadata } from "@jai-providers/common/model-metadata"
import { DEEP_THINK_TOOL } from "./deep-think.ts"
import { buildConfigModels } from "./models.ts"

const PROVIDER_ID = "japan-ai"
const PROVIDER_NAME = "JAPAN AI"
const PROVIDER_NPM = "@ai-sdk/openai-compatible"

export type JapanAIOptions = {
  /**
   * Account email. Normally captured by `/connect`; set it here for
   * non-interactive setups.
   */
  userId?: string
  baseURL?: string
  /** Register the ids `/v1/models` reports instead of the bundled catalog. Default true. */
  dynamicModels?: boolean
  /** Age at which the cached model list is refetched. Default 6 hours. */
  ttlMs?: number
  /** Regex sources for discovered ids to drop. Defaults to `DEFAULT_EXCLUDE`. */
  exclude?: string[]
  /**
   * Register the `deep_think` tool and tell this provider's models to use it.
   * Default true. See `deep-think.ts` for why it exists.
   */
  deepThink?: boolean
  /**
   * Pin `reasoningEffort` on every request to this provider, overriding the
   * variant. Off by default; `"none"` is the setting that avoids the 60s limit.
   */
  forceEffort?: string
}

type Settings = Required<Pick<JapanAIOptions, "baseURL" | "dynamicModels" | "deepThink">> &
  Pick<JapanAIOptions, "userId" | "ttlMs" | "exclude" | "forceEffort">

function parseOptions(options?: PluginOptions): Settings {
  const raw = (options ?? {}) as JapanAIOptions
  return {
    userId: raw.userId,
    baseURL: raw.baseURL ?? DEFAULT_BASE_URL,
    dynamicModels: raw.dynamicModels ?? true,
    ttlMs: raw.ttlMs,
    exclude: raw.exclude,
    deepThink: raw.deepThink ?? true,
    forceEffort: raw.forceEffort,
  }
}

async function resolveModelIds(settings: Settings): Promise<readonly string[]> {
  if (!settings.dynamicModels) return KNOWN_MODEL_IDS
  const credentials = await resolveCredentials(PROVIDER_ID, settings.userId)
  return discoverModelIds({
    ...credentials,
    baseURL: settings.baseURL,
    ttlMs: settings.ttlMs,
    exclude: settings.exclude,
  })
}

export const JapanAIPlugin: Plugin = async (_input, options) => {
  const settings = parseOptions(options)

  return {
    /**
     * `/connect japan-ai` collects the account email on top of the API key.
     *
     * Only the email is declared as a prompt: opencode always adds its own key
     * prompt for `type: "api"` methods, stores that as the credential, and keeps
     * every declared prompt as metadata. Declaring the key here would ask for it
     * twice and leave a plaintext copy in metadata. For the same reason there is
     * no `authorize` callback — opencode never invokes it for api methods.
     */
    auth: {
      provider: PROVIDER_ID,
      methods: [
        {
          type: "api",
          label: "API Key",
          prompts: [
            {
              type: "text",
              key: "userId",
              message: "Account email (userId)",
              placeholder: "you@example.com",
              validate: (value) => (value.includes("@") ? undefined : "メールアドレスを入力してください"),
            },
          ],
        },
      ],
      loader: async (getAuth) => {
        const auth = await getAuth()
        const userId = (auth.type === "api" ? auth.metadata?.userId : undefined) ?? settings.userId
        return {
          ...("key" in auth ? { apiKey: auth.key } : {}),
          ...(userId ? { queryParams: { userId } } : {}),
        }
      },
    },

    /**
     * Registers the provider so the model list lives in code instead of
     * opencode.json.
     *
     * Discovery happens here too: the `provider.models` hook only fires for
     * providers opencode already has in its database, which never includes a
     * config-defined one.
     */
    config: async (config: Config) => {
      const providers = (config.provider ??= {})
      const existing = providers[PROVIDER_ID]
      const ids = await resolveModelIds(settings)
      const metadata = await discoverModelMetadata(ids, settings.ttlMs ?? DEFAULT_TTL_MS)

      providers[PROVIDER_ID] = {
        name: PROVIDER_NAME,
        npm: PROVIDER_NPM,
        ...existing,
        options: {
          baseURL: settings.baseURL,
          ...(settings.userId ? { queryParams: { userId: settings.userId } } : {}),
          ...existing?.options,
        },
        // Entries written by hand in opencode.json win over generated ones.
        models: {
          ...buildConfigModels(ids, metadata),
          ...existing?.models,
        } as NonNullable<typeof existing>["models"],
      }
    },

    // Registered unconditionally: opencode has no per-provider tool scoping.
    // The system prompt below is what points this provider's models at it.
    ...(settings.deepThink ? { tool: { deep_think: DEEP_THINK_TOOL } } : {}),

    "experimental.chat.system.transform": async (input, output) => {
      if (!settings.deepThink) return
      if (input.model.providerID !== PROVIDER_ID) return
      output.system.push(DEEP_THINK_PROMPT)
    },

    "chat.params": async (input, output) => {
      if (!settings.forceEffort) return
      if (input.model.providerID !== PROVIDER_ID) return
      output.options.reasoningEffort = settings.forceEffort
    },
  }
}

export default JapanAIPlugin
