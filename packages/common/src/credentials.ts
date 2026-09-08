import { exec } from "node:child_process"
import { promisify } from "node:util"

const ENV_API_KEY = "JAPAN_AI_API_KEY"
const ENV_USER_ID = "JAPAN_AI_USER_ID"

const COMMAND_PREFIX = "!"
const COMMAND_TIMEOUT_MS = 10_000

const execAsync = promisify(exec)

export type Credentials = {
  apiKey?: string
  /**
   * The API key as configured, before a `!command` is run. omp resolves this
   * form itself, so requests can pick up a rotated key without a restart.
   */
  apiKeyConfig?: string
  /** JAPAN AI rejects personal API keys that arrive without the account email. */
  userId?: string
}

/**
 * Runs a `!command` value and returns its output, so the key can live in a
 * secret store instead of a file or the environment. Other values pass through.
 */
export async function resolveSecretValue(value: string | undefined, providerID: string): Promise<string | undefined> {
  if (!value?.startsWith(COMMAND_PREFIX)) return value

  const command = value.slice(COMMAND_PREFIX.length).trim()
  try {
    const { stdout } = await execAsync(command, { timeout: COMMAND_TIMEOUT_MS, encoding: "utf8" })
    return stdout.trim() || undefined
  } catch (error) {
    console.warn(`[${providerID}] credential command failed:`, error)
    return undefined
  }
}

export async function resolveCredentials(providerID: string, fallbackUserId?: string): Promise<Credentials> {
  const apiKeyConfig = process.env[ENV_API_KEY]
  return {
    apiKey: await resolveSecretValue(apiKeyConfig, providerID),
    apiKeyConfig,
    userId: fallbackUserId ?? process.env[ENV_USER_ID],
  }
}
