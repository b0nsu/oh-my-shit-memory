import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { findLatestIncidentJson, readLatestIncidentSummary } from "./incident-finder"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("findLatestIncidentJson", () => {
  test("returns newest incident.json across nested directories", () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-incidents-"))
    temporaryDirectories.push(root)

    const oldDir = join(root, "local", "incident-old")
    const newDir = join(root, "ci", "incident-new")
    mkdirSync(oldDir, { recursive: true })
    mkdirSync(newDir, { recursive: true })

    const oldPath = join(oldDir, "incident.json")
    const newPath = join(newDir, "incident.json")

    writeFileSync(oldPath, JSON.stringify({ signature: "old" }))
    writeFileSync(newPath, JSON.stringify({ signature: "new" }))

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60_000)
    utimesSync(oldPath, oneMinuteAgo, oneMinuteAgo)
    utimesSync(newPath, now, now)

    expect(findLatestIncidentJson(root)).toBe(newPath)
  })
})

describe("readLatestIncidentSummary", () => {
  test("reads summary fields and companion paths", () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-summary-"))
    temporaryDirectories.push(root)

    const incidentDir = join(root, "ci", "incident-1")
    mkdirSync(incidentDir, { recursive: true })
    writeFileSync(
      join(incidentDir, "incident.json"),
      JSON.stringify({
        id: "incident-1",
        signature: "abc123",
        severity: "high",
        repro_priority: "p1",
        created_at: "2026-03-01T00:00:00.000Z",
      }),
    )
    writeFileSync(join(incidentDir, "incident.md"), "# incident")
    writeFileSync(join(incidentDir, "metadata.json"), JSON.stringify({ signature: "abc123" }))

    const summary = readLatestIncidentSummary(root)
    expect(summary?.incident?.signature).toBe("abc123")
    expect(summary?.markdownPath).toBe(join(incidentDir, "incident.md"))
    expect(summary?.metadataPath).toBe(join(incidentDir, "metadata.json"))
  })
})
