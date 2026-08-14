#!/usr/bin/env bun
/**
 * Regenerates `providers.japan-ai.models` in omp's models.yml from `/v1/models`.
 *
 * omp has native discovery (`discovery.type: openai-models-list`), but it builds
 * `<baseUrl>/models` without the query string, and JAPAN AI rejects that request
 * without `userId`. Generating the list ahead of time avoids that gap.
 */
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { DEFAULT_BASE_URL } from "@japan-ai/core/api"
import { resolveCredentials } from "@japan-ai/core/credentials"
import { discoverModelIds } from "@japan-ai/core/discovery"
import { renderModelsYaml } from "../src/models-yaml.ts"

const PROVIDER_ID = "japan-ai"

function defaultTarget(): string {
  const agentDir = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".omp", "agent")
  return path.join(agentDir, "models.yml")
}

function parseArgs(argv: string[]) {
  const args = new Set(argv)
  const valueOf = (flag: string) => {
    const index = argv.indexOf(flag)
    return index >= 0 ? argv[index + 1] : undefined
  }
  return {
    stdout: args.has("--stdout"),
    force: args.has("--force"),
    target: valueOf("--out") ?? defaultTarget(),
    userId: valueOf("--user-id"),
  }
}

async function readIfExists(file: string): Promise<string | undefined> {
  try {
    return await fs.readFile(file, "utf8")
  } catch {
    return undefined
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const credentials = await resolveCredentials(PROVIDER_ID, options.userId)

  if (!credentials.apiKey) {
    throw new Error("No JAPAN AI credential found. Run `/connect japan-ai` in opencode or set JAPAN_AI_API_KEY.")
  }

  const ids = await discoverModelIds({ ...credentials, baseURL: DEFAULT_BASE_URL, ttlMs: options.force ? 0 : undefined })
  const current = await readIfExists(options.target)
  const next = renderModelsYaml({
    current,
    ids,
    baseURL: DEFAULT_BASE_URL,
    userId: credentials.userId,
  })

  if (options.stdout) {
    process.stdout.write(next)
    return
  }
  if (current === next) {
    console.log(`${options.target} is already up to date (${ids.length} models)`)
    return
  }

  await fs.mkdir(path.dirname(options.target), { recursive: true })
  await fs.writeFile(options.target, next, "utf8")
  console.log(`Wrote ${ids.length} models to ${options.target}`)
}

await main()
