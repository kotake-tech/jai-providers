/**
 * omp extension for the JAPAN AI CHAT API: registers the provider with its
 * model list, and works around the 60-second first-token limit.
 *
 * Load it with `omp -e <path>/packages/omp/src/extension.ts`, or symlink it into
 * `~/.omp/agent/extensions/` for automatic discovery. Nothing needs to be
 * written to models.yml.
 */
import {
  DEEP_THINK_ARG_DESCRIPTION,
  DEEP_THINK_DESCRIPTION,
  DEEP_THINK_NAME,
  DEEP_THINK_PROMPT,
  DEEP_THINK_RESULT,
} from "@jai-providers/common/deep-think"

import { registerJapanAIProvider } from "./provider.ts"

const PROVIDER_ID = "japan-ai"

export type JapanAIExtensionOptions = {
  /** Register `deep_think` and steer this provider's models at it. */
  deepThink: boolean
  /** Pin `reasoning_effort` on every request to this provider, or `false` to leave it. */
  forceEffort: string | false
  /** Register the provider and its models. Turn off to define them in models.yml instead. */
  registerProvider: boolean
}

const OPTIONS: JapanAIExtensionOptions = {
  deepThink: true,
  forceEffort: "none",
  registerProvider: true,
}

/**
 * omp keeps extension tools off the wire and reachable through `hub` instead,
 * which defeats the purpose here, so the schema is injected into the request.
 */
const WIRE_TOOL = {
  type: "function",
  function: {
    name: DEEP_THINK_NAME,
    description: DEEP_THINK_DESCRIPTION,
    parameters: {
      type: "object",
      properties: { thoughts: { type: "string", description: DEEP_THINK_ARG_DESCRIPTION } },
      required: ["thoughts"],
    },
  },
}

export default async function japanAiExtension(pi: any) {
  // Awaited by omp before the registry is built, so the models are in place by
  // the time the picker and `--model` resolution run.
  if (OPTIONS.registerProvider) await registerJapanAIProvider(pi)

  if (OPTIONS.deepThink) {
    pi.registerTool({
      name: DEEP_THINK_NAME,
      label: "Deep Think",
      description: DEEP_THINK_DESCRIPTION,
      parameters: pi.zod.object({ thoughts: pi.zod.string().describe(DEEP_THINK_ARG_DESCRIPTION) }),
      async execute() {
        return { content: [{ type: "text", text: DEEP_THINK_RESULT }] }
      },
    })
  }

  pi.on("before_agent_start", async (event: any, ctx: any) => {
    if (!OPTIONS.deepThink) return
    if (ctx?.model?.provider !== PROVIDER_ID) return
    return { systemPrompt: [...(event.systemPrompt ?? []), DEEP_THINK_PROMPT] }
  })

  /** The handler's return value replaces the request body wholesale, so the whole payload is returned. */
  pi.on("before_provider_request", async (event: any, ctx: any) => {
    if (ctx?.model?.provider !== PROVIDER_ID) return
    const payload = event?.payload
    if (!payload) return

    const hasDeepThink =
      Array.isArray(payload.tools) && payload.tools.some((tool: any) => tool?.function?.name === DEEP_THINK_NAME)

    return {
      ...payload,
      ...(OPTIONS.forceEffort ? { reasoning_effort: OPTIONS.forceEffort } : {}),
      ...(OPTIONS.deepThink && Array.isArray(payload.tools) && !hasDeepThink
        ? { tools: [...payload.tools, WIRE_TOOL] }
        : {}),
    }
  })
}
