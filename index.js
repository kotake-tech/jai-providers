import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

export function createJapanAI({ userId, ...options }) {
  const originalFetch = options.fetch
  return createOpenAICompatible({
    ...options,
    fetch: async (url, init) => {
      const opts = { ...init }
      if (opts.method === "POST" && opts.body) {
        const body = JSON.parse(opts.body)
        body.userId = userId
        opts.body = JSON.stringify(body)
      }
      return (originalFetch ?? fetch)(url, opts)
    },
  })
}
