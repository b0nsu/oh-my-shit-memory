import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { IncidentReportFiles } from "./types"

function directorySizeBytes(directory: string): number {
  let total = 0
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) {
      total += directorySizeBytes(full)
    } else {
      total += statSync(full).size
    }
  }
  return total
}

function listFilesRecursively(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(full))
    } else {
      files.push(full)
    }
  }
  return files.sort()
}

function enforceBundleLimit(directory: string, maxBytes: number): { truncated: boolean; final_size_bytes: number } {
  let size = directorySizeBytes(directory)
  if (size <= maxBytes) {
    return { truncated: false, final_size_bytes: size }
  }

  const files = listFilesRecursively(directory)
  for (const file of files.reverse()) {
    if (size <= maxBytes) break
    const current = readFileSync(file)
    const keepBytes = Math.max(0, current.length - (size - maxBytes))
    const truncated = current.subarray(0, keepBytes)
    writeFileSync(file, truncated)
    size = directorySizeBytes(directory)
  }

  return { truncated: true, final_size_bytes: size }
}

export function writeIncidentArtifacts(args: {
  artifactRootDir: string
  incidentId: string
  jsonReport: string
  markdownReport: string
  metadata: Record<string, unknown>
  maxIncidentBytes: number
}): IncidentReportFiles {
  const incidentDir = join(args.artifactRootDir, args.incidentId)
  mkdirSync(incidentDir, { recursive: true })

  const jsonPath = join(incidentDir, "incident.json")
  const markdownPath = join(incidentDir, "incident.md")
  const metadataPath = join(incidentDir, "metadata.json")

  writeFileSync(jsonPath, args.jsonReport)
  writeFileSync(markdownPath, args.markdownReport)
  writeFileSync(metadataPath, JSON.stringify(args.metadata, null, 2))

  const limitResult = enforceBundleLimit(incidentDir, args.maxIncidentBytes)
  if (limitResult.truncated) {
    writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          ...args.metadata,
          truncated: true,
          final_size_bytes: limitResult.final_size_bytes,
        },
        null,
        2,
      ),
    )
  }

  return {
    directory: incidentDir,
    json_path: jsonPath,
    markdown_path: markdownPath,
    metadata_path: metadataPath,
  }
}

export function isWorkflowArtifactBudgetExceeded(artifactRootDir: string, maxWorkflowBytes: number): boolean {
  try {
    return directorySizeBytes(artifactRootDir) > maxWorkflowBytes
  } catch {
    return false
  }
}
