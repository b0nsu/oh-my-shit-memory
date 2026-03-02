import { describe, expect, spyOn, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { runOhMyShitMemoryCapture } from "./index"

describe("runOhMyShitMemoryCapture", () => {
  test("does not write incident artifacts for successful runs", async () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-capture-success-"))

    try {
      const result = await runOhMyShitMemoryCapture({
        config: {
          artifact_dir: root,
          sampling_interval_ms: 250,
        },
        command: "bash",
        commandArgs: ["-lc", "echo ok"],
      })

      expect(result.exitCode).toBe(0)
      expect(result.incident).toBeNull()
      expect(result.reports).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("runs command and writes incident artifacts", async () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-capture-"))

    try {
      const result = await runOhMyShitMemoryCapture({
        config: {
          artifact_dir: root,
          sampling_interval_ms: 250,
        },
        command: "bash",
        commandArgs: ["-lc", "echo boom >&2; exit 1"],
      })

      expect(result.exitCode).toBe(1)
      expect(result.incident?.signature.length).toBeGreaterThan(0)
      expect(result.reports?.json_path).toBeTruthy()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("samples target process pid instead of wrapper pid", async () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-capture-pid-"))

    try {
      const result = await runOhMyShitMemoryCapture({
        config: {
          artifact_dir: root,
          sampling_interval_ms: 250,
        },
        command: "bun",
        commandArgs: ["-e", "console.log(process.pid); process.exit(1)"],
      })

      const targetPid = Number.parseInt((result.incident?.stdout_excerpt ?? "").trim(), 10)
      expect(Number.isFinite(targetPid)).toBe(true)
      expect(targetPid).not.toBe(process.pid)
      expect(result.incident?.samples[0]?.pid).toBe(targetPid)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("streams child output live and stores only bounded tails", async () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-capture-tail-"))
    const stdoutWriteSpy = spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderrWriteSpy = spyOn(process.stderr, "write").mockImplementation(() => true)

    try {
      const result = await runOhMyShitMemoryCapture({
        config: {
          artifact_dir: root,
          sampling_interval_ms: 250,
        },
        command: "bun",
        commandArgs: [
          "-e",
          [
            "const out = `OUT_BEGIN_${'O'.repeat(12000)}_OUT_END`;",
            "const err = `ERR_BEGIN_${'E'.repeat(12000)}_ERR_END`;",
            "process.stdout.write(out);",
            "process.stderr.write(err);",
            "process.exit(1);",
          ].join(" "),
        ],
      })

      const toText = (value: unknown): string => {
        if (typeof value === "string") return value
        if (value instanceof Uint8Array) return new TextDecoder().decode(value)
        return String(value)
      }

      const stdoutForwarded = stdoutWriteSpy.mock.calls.map((call) => toText(call[0])).join("")
      const stderrForwarded = stderrWriteSpy.mock.calls.map((call) => toText(call[0])).join("")

      expect(stdoutForwarded).toContain("_OUT_END")
      expect(stderrForwarded).toContain("_ERR_END")
      expect(result.incident?.stdout_excerpt.length).toBeLessThanOrEqual(10_000)
      expect(result.incident?.stderr_excerpt.length).toBeLessThanOrEqual(10_000)
      expect(result.incident?.stdout_excerpt).toContain("_OUT_END")
      expect(result.incident?.stderr_excerpt).toContain("_ERR_END")
      expect(result.incident?.stdout_excerpt).not.toContain("OUT_BEGIN_")
      expect(result.incident?.stderr_excerpt).not.toContain("ERR_BEGIN_")
    } finally {
      stdoutWriteSpy.mockRestore()
      stderrWriteSpy.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
