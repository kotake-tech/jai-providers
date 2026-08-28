import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export type CachedIds = {
  updatedAt: number
  ids: string[]
}

export type CachedValue<T> = {
  updatedAt: number
  value: T
}

function cacheFile(name: string): string {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache")
  return path.join(base, "opencode", name)
}

function isCachedIds(value: unknown): value is CachedIds {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as CachedIds
  return typeof candidate.updatedAt === "number" && Array.isArray(candidate.ids)
}

/** Returns the cached ids regardless of age; callers decide whether they are fresh enough. */
export async function readCachedIds(name: string): Promise<CachedIds | undefined> {
  let raw: string
  try {
    raw = await fs.readFile(cacheFile(name), "utf8")
  } catch {
    return undefined // first run
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return isCachedIds(parsed) ? parsed : undefined
  } catch {
    return undefined // a corrupt cache is simply refetched
  }
}

export async function writeCachedIds(name: string, ids: readonly string[]): Promise<void> {
  const file = cacheFile(name)
  const payload: CachedIds = { updatedAt: Date.now(), ids: [...ids] }
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(payload), "utf8")
  } catch (error) {
    console.warn(`[japan-ai] could not write ${file}:`, error)
  }
}

export async function readCachedValue<T>(
  name: string,
  validate: (value: unknown) => value is T,
): Promise<CachedValue<T> | undefined> {
  let raw: string
  try {
    raw = await fs.readFile(cacheFile(name), "utf8")
  } catch {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return undefined
    const cached = parsed as CachedValue<unknown>
    return typeof cached.updatedAt === "number" && validate(cached.value)
      ? (cached as CachedValue<T>)
      : undefined
  } catch {
    return undefined
  }
}

export async function writeCachedValue<T>(name: string, value: T): Promise<void> {
  const file = cacheFile(name)
  const payload: CachedValue<T> = { updatedAt: Date.now(), value }
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify(payload), "utf8")
  } catch (error) {
    console.warn(`[japan-ai] could not write ${file}:`, error)
  }
}
