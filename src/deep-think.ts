import { tool } from "@opencode-ai/plugin/tool"

/**
 * JAPAN AI drops a request when the first token has not arrived within 60
 * seconds. Hidden reasoning emits nothing on the wire, so a long chain of
 * thought trips that limit before the answer starts.
 *
 * `deep_think` moves the reasoning into tool-call arguments, which stream as
 * they are produced and keep the connection alive. Pair it with a low or
 * disabled reasoning effort.
 */
export const DEEP_THINK_TOOL = tool({
  description: [
    "Think privately before acting.",
    "Write your complete reasoning into `thoughts`.",
    "Use terse working notes, not polished prose.",
    "Call this once before any non-trivial answer or multi-step tool plan.",
  ].join(" "),
  args: {
    thoughts: tool.schema.string().describe("Your internal reasoning."),
  },
  execute: async (args, context) => {
    context.metadata({ title: "Thinking", metadata: { length: args.thoughts.length } })
    return { title: "Thinking", output: "Recorded. Continue with the task." }
  },
})

export const DEEP_THINK_PROMPT = [
  "This provider aborts a request when no token arrives within 60 seconds, and hidden reasoning emits no tokens.",
  "Before any non-trivial answer or multi-step plan, call the `deep_think` tool once and put your full reasoning in `thoughts`.",
  "Keep that reasoning in the tool call rather than in hidden reasoning, so the response starts streaming immediately.",
].join(" ")
