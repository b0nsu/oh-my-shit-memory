import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { writeIncidentArtifacts } from "./artifact-writer"

describe("writeIncidentArtifacts", () => {
  test("writes incident files and enforces deterministic size caps", () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-"))

    try {
      const reports = writeIncidentArtifacts({
        artifactRootDir: root,
        incidentId: "incident-1",
        jsonReport: JSON.stringify({ foo: "bar", text: "x".repeat(4000) }),
        markdownReport: "# Incident\n" + "y".repeat(4000),
        metadata: { signature: "sig-1" },
        maxIncidentBytes: 1024,
      })

      const metadata = JSON.parse(readFileSync(reports.metadata_path, "utf8")) as {
        truncated?: boolean
      }

      expect(reports.directory).toContain("incident-1")
      expect(typeof metadata.truncated).toBe("boolean")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
