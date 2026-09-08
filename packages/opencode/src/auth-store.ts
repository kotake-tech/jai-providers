import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type StoredAuth = {
  type?: string
  key?: string
  metadata?: Record<string, string>
}

function dataDir(): string {
  return process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share")
}

/**
 * Reads the credential `/connect` stored for a provider.
 *
 * The config hook runs before opencode resolves auth and the server API never
 * hands secrets back, so the store on disk is the only source available here.
 */
export async function readStoredAuth(providerID: string): Promise<StoredAuth | undefined> {
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
