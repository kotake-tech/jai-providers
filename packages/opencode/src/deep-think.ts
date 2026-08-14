import { tool } from "@opencode-ai/plugin/tool"

import {
  DEEP_THINK_ARG_DESCRIPTION,
  DEEP_THINK_DESCRIPTION,
  DEEP_THINK_RESULT,
} from "@jai-providers/common/deep-think"

export const DEEP_THINK_TOOL = tool({
  description: DEEP_THINK_DESCRIPTION,
  args: {
    thoughts: tool.schema.string().describe(DEEP_THINK_ARG_DESCRIPTION),
  },
  execute: async (args, context) => {
    context.metadata({ title: "Thinking", metadata: { length: args.thoughts.length } })
    return { title: "Thinking", output: DEEP_THINK_RESULT }
  },
})
