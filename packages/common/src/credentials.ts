import { exec } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
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

type ConfigFile = {
  apiKey?: string
  userId?: string
}

export function configFilePath(): string {
  const configDir = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config")
  return path.join(configDir, "jai-providers", "config.json")
}

/** Reads `config.json`; a missing file means the credentials live elsewhere. */
async function readConfigFile(providerID: string): Promise<ConfigFile> {
  const file = configFilePath()
  let raw: string
  try {
    raw = await fs.readFile(file, "utf8")
  } catch {
    return {}
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) {
      console.warn(`[${providerID}] ${file} is not a JSON object; ignoring it`)
      return {}
    }
    const { apiKey, userId } = parsed as Record<string, unknown>
    return {
      apiKey: typeof apiKey === "string" ? apiKey : undefined,
      userId: typeof userId === "string" ? userId : undefined,
    }
  } catch (error) {
    console.warn(`[${providerID}] could not parse ${file}:`, error)
    return {}
  }
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
  const config = await readConfigFile(providerID)
  const apiKeyConfig = config.apiKey ?? process.env[ENV_API_KEY]
  return {
    apiKey: await resolveSecretValue(apiKeyConfig, providerID),
    apiKeyConfig,
    userId: config.userId ?? fallbackUserId ?? process.env[ENV_USER_ID],
  }
}
