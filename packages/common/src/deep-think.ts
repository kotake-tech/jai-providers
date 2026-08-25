/**
 * JAPAN AI drops a request when the first token has not arrived within 60
 * seconds. Hidden reasoning emits nothing on the wire, so a long chain of
 * thought trips that limit before the answer starts.
 *
 * `deep_think` moves the reasoning into tool-call arguments, which stream as
 * they are produced and keep the connection alive. Pair it with a low or
 * disabled reasoning effort.
 *
 * Each agent wraps these strings in its own tool definition.
 */

export const DEEP_THINK_NAME = "deep_think"

export const DEEP_THINK_DESCRIPTION = [
  "Your reasoning scratchpad, and a full replacement for hidden reasoning.",
  "Whatever you would have worked through internally, work through it here instead, at the same length.",
  "Restate what is actually being asked and what the request assumes.",
  "Name what you do not yet know.",
  "Weigh at least three approaches and say why you reject the ones you reject.",
  "Name the conditions under which your chosen approach breaks.",
  "Then commit to a plan.",
  "Prose can stay rough, but the thinking must not be.",
  "Call it before any non-trivial answer or multi-step tool plan, and again whenever new information changes the picture.",
].join(" ")

export const DEEP_THINK_ARG_DESCRIPTION = [
  "Your full reasoning: the restated problem and its assumptions, the open unknowns,",
  "the approaches you considered with the rejected ones and why, the ways your choice could fail,",
  "and the plan you settle on.",
].join(" ")

export const DEEP_THINK_PROMPT = [
  "Before any non-trivial answer or multi-step plan, call the `deep_think` tool and put your entire reasoning in `thoughts`.",
  "Treat it as the place you do your thinking, not as a summary of thinking done elsewhere:",
  "reason to the depth the problem deserves, consider and reject alternatives explicitly, and state what would make your approach wrong.",
  "Call it again whenever new information changes the picture.",
  "Reason there rather than in hidden reasoning: this provider aborts a request when no token arrives within 60 seconds,",
  "and hidden reasoning emits nothing on the wire, while tool-call arguments stream as they are produced.",
].join(" ")

export const DEEP_THINK_RESULT = "Recorded. Continue with the task."
