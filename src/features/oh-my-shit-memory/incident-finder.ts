import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import type { IncidentBundle } from "./types"

function listFilesRecursively(directory: string): string[] {
  const files: string[] = []

  let entries: Array<{ name: string; isDirectory: () => boolean }>
  try {
    entries = readdirSync(directory, { withFileTypes: true }) as Array<{ name: string; isDirectory: () => boolean }>
  } catch {
    return files
  }

  for (const entry of entries) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(fullPath))
      continue
    }
    files.push(fullPath)
  }

  return files
}

export function findLatestIncidentJson(artifactRootDir: string): string | null {
  const incidentFiles = listFilesRecursively(artifactRootDir).filter((filePath) => basename(filePath) === "incident.json")
  if (incidentFiles.length === 0) return null

  let latestPath: string | null = null
  let latestMtime = -1

  for (const filePath of incidentFiles) {
    let mtimeMs = -1
    try {
      mtimeMs = statSync(filePath).mtimeMs
    } catch {
      continue
    }
    if (mtimeMs > latestMtime) {
      latestMtime = mtimeMs
      latestPath = filePath
    }
  }

  return latestPath
}

export type LatestIncidentSummary = {
  jsonPath: string
  markdownPath: string | null
  metadataPath: string | null
  incident: Pick<IncidentBundle, "id" | "signature" | "severity" | "repro_priority" | "created_at"> | null
}

export function readLatestIncidentSummary(artifactRootDir: string): LatestIncidentSummary | null {
  const jsonPath = findLatestIncidentJson(artifactRootDir)
  if (!jsonPath) return null

  const incidentDir = dirname(jsonPath)
  const markdownPath = join(incidentDir, "incident.md")
  const metadataPath = join(incidentDir, "metadata.json")

  let incident: LatestIncidentSummary["incident"] = null
  try {
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8")) as IncidentBundle
    incident = {
      id: parsed.id,
      signature: parsed.signature,
      severity: parsed.severity,
      repro_priority: parsed.repro_priority,
      created_at: parsed.created_at,
    }
  } catch {
    incident = null
  }

  return {
    jsonPath,
    markdownPath: existsSync(markdownPath) ? markdownPath : null,
    metadataPath: existsSync(metadataPath) ? metadataPath : null,
    incident,
  }
}
