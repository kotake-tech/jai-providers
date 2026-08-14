import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const ENV_API_KEY = "JAPAN_AI_API_KEY"
const ENV_USER_ID = "JAPAN_AI_USER_ID"

export type Credentials = {
  apiKey?: string
  /** JAPAN AI rejects personal API keys that arrive without the account email. */
  userId?: string
}

function dataDir(): string {
  return process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share")
}

type StoredAuth = {
  type?: string
  key?: string
  metadata?: Record<string, string>
}

/**
 * Reads the credential `/connect` stored for a provider.
 *
 * The config hook runs before opencode resolves auth and the server API never
 * hands secrets back, so the store on disk is the only source available here.
 */
async function readStoredAuth(providerID: string): Promise<StoredAuth | undefined> {
  const file = path.join(dataDir(), "opencode", "auth.json")
  let raw: string
  try {
    raw = await fs.readFile(file, "utf8")
  } catch {
    return undefined // not logged in yet
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return undefined
    const entry = (parsed as Record<string, unknown>)[providerID]
    if (typeof entry !== "object" || entry === null) return undefined
    return entry as StoredAuth
  } catch (error) {
    console.warn(`[${providerID}] could not parse ${file}:`, error)
    return undefined
  }
}

export async function resolveCredentials(providerID: string, fallbackUserId?: string): Promise<Credentials> {
  const stored = await readStoredAuth(providerID)
  return {
    apiKey: stored?.key ?? process.env[ENV_API_KEY],
    userId: stored?.metadata?.userId ?? fallbackUserId ?? process.env[ENV_USER_ID],
  }
}
