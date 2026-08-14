import { displayName, resolveMeta, type ModelMeta } from "@jai-providers/common/catalog"

/** opencode variant entries are model option overrides, keyed by variant name. */
export type Variants = Record<string, Record<string, unknown>>

/**
 * Shape of a `provider.<id>.models.<id>` config entry.
 * Declared locally because `variants` is in the published config schema but
 * not yet in the SDK's generated types.
 */
export type ConfigModel = {
  name: string
  reasoning: boolean
  limit: { context: number; output: number }
  variants?: Variants
}

function buildVariants(meta: ModelMeta): Variants | undefined {
  if (!meta.efforts) return undefined
  return Object.fromEntries(meta.efforts.map((effort) => [effort, { reasoningEffort: effort }]))
}

export function buildConfigModels(ids: readonly string[]): Record<string, ConfigModel> {
  return Object.fromEntries(
    ids.map((id) => {
      const meta = resolveMeta(id)
      return [
        id,
        {
          name: displayName(id),
          reasoning: Boolean(meta.efforts),
          limit: { context: meta.contextWindow, output: meta.maxOutput },
          variants: buildVariants(meta),
        },
      ]
    }),
  )
}
