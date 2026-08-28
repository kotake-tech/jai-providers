/**
 * Model metadata for the JAPAN AI CHAT API.
 *
 * `/v1/models` returns bare ids with no capability information, so limits and
 * reasoning-effort ladders are kept here.
 */

/** Reasoning effort ladders, surfaced to opencode as model variants. */
const EFFORTS_CLAUDE = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const
const EFFORTS_GPT = ["none", "low", "medium", "high", "xhigh"] as const
const EFFORTS_DEEPSEEK = ["none", "low", "medium", "high", "xhigh", "max"] as const

export type ModelMeta = {
  contextWindow: number
  maxOutput: number
  efforts?: readonly string[]
}

const DEFAULT_META: ModelMeta = {
  contextWindow: 128_000,
  maxOutput: 32_000,
}

/**
 * Per-vendor fallbacks for ids without an explicit catalog entry, so newly
 * released models get plausible limits without a code change. First match wins.
 */
const FAMILY_RULES: ReadonlyArray<{ match: RegExp; meta: Partial<ModelMeta> }> = [
  { match: /^claude-/, meta: { contextWindow: 200_000, maxOutput: 64_000 } },
  { match: /^gpt-5/, meta: { contextWindow: 272_000, maxOutput: 128_000 } },
  { match: /^gemini-/, meta: { contextWindow: 1_048_576, maxOutput: 65_536 } },
  { match: /^grok-/, meta: { contextWindow: 256_000, maxOutput: 32_000 } },
  { match: /^kimi-/, meta: { contextWindow: 262_144, maxOutput: 131_072 } },
  { match: /^deepseek-/, meta: { contextWindow: 131_072, maxOutput: 65_536 } },
  { match: /^glm-/, meta: { contextWindow: 202_752, maxOutput: 131_072 } },
  { match: /^minimax-/, meta: { contextWindow: 524_288, maxOutput: 131_072 } },
  { match: /^qwen/, meta: { contextWindow: 262_144, maxOutput: 65_536 } },
  { match: /^o3/, meta: { contextWindow: 200_000, maxOutput: 100_000 } },
]

/**
 * Known model ids, also used as the offline fallback list when `/v1/models`
 * cannot be reached. An empty object means "family defaults are fine".
 */
const CATALOG: Record<string, Partial<ModelMeta>> = {
  // Anthropic
  "claude-fable-5": { contextWindow: 1_000_000, maxOutput: 128_000, efforts: EFFORTS_CLAUDE },
  "claude-opus-5": { contextWindow: 1_000_000, maxOutput: 128_000, efforts: EFFORTS_CLAUDE },
  "claude-sonnet-5": { contextWindow: 1_000_000, maxOutput: 128_000, efforts: EFFORTS_CLAUDE },
  "claude-4-8-opus": { efforts: EFFORTS_CLAUDE },
  "claude-4-7-opus": { efforts: EFFORTS_CLAUDE },
  "claude-4-7-opus-200k": {},
  "claude-4-6-opus": {},
  "claude-4-5-opus": {},
  "claude-4-5-opus-thinking": {},
  "claude-4-opus": {},
  "claude-4-6-sonnet": {},
  "claude-4-5-sonnet": {},
  "claude-4-5-sonnet-thinking": {},
  "claude-4-5-haiku": {},

  // OpenAI
  "gpt-5.6-sol": { efforts: EFFORTS_GPT },
  "gpt-5.6-terra": { efforts: EFFORTS_GPT },
  "gpt-5.6-luna": { efforts: EFFORTS_GPT },
  "gpt-5.5": {},
  "gpt-5.4": { contextWindow: 1_000_000 },
  "gpt-5.4-pro": {},
  "gpt-5.4-mini": {},
  "gpt-5.4-nano": {},
  "gpt-5.3-codex": {},
  "gpt-5.2": {},
  "gpt-5.2-pro": {},
  "gpt-5.2-codex": {},
  "gpt-5.2-xhigh": {},
  "gpt-5.1-codex-high": {},
  "gpt-5-mini": {},
  "gpt-5-nano": {},
  "gpt-5-chat": {},
  "gpt-4.1": {},
  "gpt-4o-mini": {},
  o3: {},
  "o3-pro": {},

  // Google
  "gemini-3.1-pro": { maxOutput: 65_535 },
  "gemini-3.7-flash": {},
  "gemini-3.6-flash": {},
  "gemini-3.5-flash": {},
  "gemini-3-flash": {},
  "gemini-3.5-flash-lite": { maxOutput: 65_535 },
  "gemini-3.1-flash-lite": { maxOutput: 65_535 },
  "gemini-2.5-pro": {},
  "gemini-2.5-flash": { maxOutput: 65_535 },
  "gemini-2.5-flash-lite": { maxOutput: 65_535 },

  // xAI
  "grok-4-6": {},
  "grok-4-5": {},
  "grok-4-3": {},
  "grok-4-2": {},
  "grok-4-1-fast": {},
  "grok-4-fast": {},
  "grok-code-fast-1": {},

  // Moonshot
  "kimi-k3": {},
  "kimi-k2.7-code": {},
  "kimi-k2.6": { maxOutput: 262_144 },
  "kimi-k2.6-turbo": { maxOutput: 262_144 },

  // DeepSeek
  "deepseek-v4-pro": { contextWindow: 524_288, maxOutput: 131_072, efforts: EFFORTS_DEEPSEEK },
  "deepseek-v4-flash": { efforts: EFFORTS_DEEPSEEK },
  "deepseek-reasoner-r1": {},

  // Zhipu / MiniMax / Alibaba
  "glm-5.2": {},
  "glm-5.1": {},
  "minimax-m3": {},
  "qwen3.7-plus": {},
  "qwen3-coder": {},
}

export const KNOWN_MODEL_IDS: readonly string[] = Object.keys(CATALOG)

export function resolveMeta(id: string, online?: Partial<ModelMeta>): ModelMeta {
  const rule = FAMILY_RULES.find((r) => r.match.test(id))
  return { ...DEFAULT_META, ...rule?.meta, ...online, ...CATALOG[id] }
}

/** Tokens that must not go through generic capitalization. */
const NAME_TOKENS: Record<string, string> = {
  gpt: "GPT",
  deepseek: "DeepSeek",
  glm: "GLM",
  o3: "o3",
  "200k": "200K",
}

/** `deepseek-v4-pro` -> `DeepSeek V4 Pro`, so dynamically added ids stay readable. */
export function displayName(id: string): string {
  return id
    .split("-")
    .map((token) => NAME_TOKENS[token] ?? (/^[a-z]/.test(token) ? token[0]!.toUpperCase() + token.slice(1) : token))
    .join(" ")
}
