import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { captureCrash } from "./crash-capture"

const originalEnv = { ...process.env }
const tempDirectories: string[] = []

afterEach(() => {
  process.env = { ...originalEnv }
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("captureCrash", () => {
  test("picks newest working-directory crash candidate by mtime", () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-wd-crash-"))
    tempDirectories.push(root)

    const olderCrashPath = join(root, "core.old")
    const newerCrashPath = join(root, "z-last.dmp")
    writeFileSync(olderCrashPath, "old")
    writeFileSync(newerCrashPath, "new")

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60_000)
    utimesSync(olderCrashPath, oneMinuteAgo, oneMinuteAgo)
    utimesSync(newerCrashPath, now, now)

    const capture = captureCrash({
      exitCode: 1,
      signal: "SIGABRT",
      workingDirectory: root,
    })

    expect(capture.dump_pointer).toBe(newerCrashPath)
  })

  test("detects iOS simulator crash artifacts from simulator log roots", () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-ios-crash-"))
    tempDirectories.push(root)

    const olderCrashPath = join(root, "simulator", "old.crash")
    mkdirSync(join(root, "simulator"), { recursive: true })
    writeFileSync(olderCrashPath, "older crash")

    const newerCrashPath = join(root, "simulator", "nested", "new.ips")
    mkdirSync(join(root, "simulator", "nested"), { recursive: true })
    writeFileSync(newerCrashPath, "newer crash")

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60_000)
    utimesSync(olderCrashPath, oneMinuteAgo, oneMinuteAgo)
    utimesSync(newerCrashPath, now, now)

    process.env.SIMULATOR_LOG_ROOT = join(root, "simulator")

    const capture = captureCrash({
      exitCode: 1,
      signal: "SIGABRT",
      workingDirectory: root,
    })

    expect(capture.dump_pointer).toBe(newerCrashPath)
  })

  test("builds symbol reference from dSYM environment variables", () => {
    const root = mkdtempSync(join(tmpdir(), "oh-my-shit-memory-dsym-"))
    tempDirectories.push(root)

    process.env.DWARF_DSYM_FOLDER_PATH = root
    process.env.DWARF_DSYM_FILE_NAME = "Runner.app.dSYM"

    const capture = captureCrash({
      exitCode: 1,
      signal: "SIGABRT",
      workingDirectory: root,
    })

    expect(capture.symbol_reference).toBe(join(root, "Runner.app.dSYM"))
  })
})
