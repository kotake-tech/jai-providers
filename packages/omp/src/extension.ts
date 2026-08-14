/**
 * omp extension implementing the JAPAN AI 60-second first-token workaround.
 *
 * Load it with `omp -e <path>/packages/omp/src/extension.ts`, or symlink it into
 * `~/.omp/agent/extensions/` for automatic discovery.
 *
 * Model metadata is not handled here: omp reads it from models.yml, which
 * `bin/omp-models.ts` regenerates.
 */
import {
  DEEP_THINK_ARG_DESCRIPTION,
  DEEP_THINK_DESCRIPTION,
  DEEP_THINK_NAME,
  DEEP_THINK_PROMPT,
  DEEP_THINK_RESULT,
} from "@japan-ai/core/deep-think"

const PROVIDER_ID = "japan-ai"

export type JapanAIExtensionOptions = {
  /** Register `deep_think` and steer this provider's models at it. */
  deepThink: boolean
  /** Pin `reasoning_effort` on every request to this provider, or `false` to leave it. */
  forceEffort: string | false
}

const OPTIONS: JapanAIExtensionOptions = {
  deepThink: true,
  forceEffort: "none",
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

export default function japanAiExtension(pi: any) {
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

  pi.on("before_provider_request", async (event: any, ctx: any) => {
    if (ctx?.model?.provider !== PROVIDER_ID) return
    const payload = event?.payload
    if (!payload) return

    if (OPTIONS.forceEffort) payload.reasoning_effort = OPTIONS.forceEffort
    if (OPTIONS.deepThink && Array.isArray(payload.tools)) {
      const present = payload.tools.some((tool: any) => tool?.function?.name === DEEP_THINK_NAME)
      if (!present) payload.tools.push(WIRE_TOOL)
    }
    return { payload }
  })
}
