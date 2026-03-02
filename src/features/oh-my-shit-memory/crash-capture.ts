import { existsSync, readdirSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { CrashCapture } from "./types"

const IOS_CRASH_FILE_EXTENSIONS = [".crash", ".ips"]

function resolveExistingPath(path: string | undefined): string | null {
  if (!path) return null
  return existsSync(path) ? path : null
}

function findNewestCrashFile(args: { directories: string[]; maxDepth: number }): string | null {
  let newestPath: string | null = null
  let newestMtime = -1

  const visit = (directory: string, depth: number) => {
    if (depth > args.maxDepth) return

    let entries: string[] = []
    try {
      entries = readdirSync(directory)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(directory, entry)
      let stats: ReturnType<typeof statSync>

      try {
        stats = statSync(fullPath)
      } catch {
        continue
      }

      if (stats.isDirectory()) {
        visit(fullPath, depth + 1)
        continue
      }

      if (!IOS_CRASH_FILE_EXTENSIONS.some((extension) => entry.toLowerCase().endsWith(extension))) {
        continue
      }

      const mtimeMs = stats.mtimeMs
      if (mtimeMs > newestMtime) {
        newestMtime = mtimeMs
        newestPath = fullPath
      }
    }
  }

  for (const directory of args.directories) {
    visit(directory, 0)
  }

  return newestPath
}

function findNewestCoreSimulatorCrashLog(devicesDirectory: string): string | null {
  let deviceEntries: string[] = []
  try {
    deviceEntries = readdirSync(devicesDirectory)
  } catch {
    return null
  }

  let newestPath: string | null = null
  let newestMtime = -1

  for (const deviceEntry of deviceEntries) {
    const crashDirectory = join(devicesDirectory, deviceEntry, "data/Library/Logs/CrashReporter")
    let crashEntries: string[] = []

    try {
      crashEntries = readdirSync(crashDirectory)
    } catch {
      continue
    }

    for (const crashEntry of crashEntries) {
      if (!IOS_CRASH_FILE_EXTENSIONS.some((extension) => crashEntry.toLowerCase().endsWith(extension))) {
        continue
      }

      const crashPath = join(crashDirectory, crashEntry)
      let stats: ReturnType<typeof statSync>
      try {
        stats = statSync(crashPath)
      } catch {
        continue
      }

      if (!stats.isFile()) continue
      if (stats.mtimeMs > newestMtime) {
        newestMtime = stats.mtimeMs
        newestPath = crashPath
      }
    }
  }

  return newestPath
}

function discoverCrashArtifact(workingDirectory: string): string | null {
  const fromEnv = resolveExistingPath(process.env.OH_MY_SHIT_MEMORY_DUMP_PATH)
  if (fromEnv) return fromEnv

  try {
    let newestPath: string | null = null
    let newestMtime = -1
    const candidates = readdirSync(workingDirectory).filter(
      (entry) =>
        entry.startsWith("core") ||
        entry.endsWith(".dmp") ||
        entry.endsWith(".core") ||
        IOS_CRASH_FILE_EXTENSIONS.some((extension) => entry.toLowerCase().endsWith(extension)),
    )

    for (const candidate of candidates) {
      const candidatePath = join(workingDirectory, candidate)
      let stats: ReturnType<typeof statSync>
      try {
        stats = statSync(candidatePath)
      } catch {
        continue
      }
      if (!stats.isFile()) continue
      if (stats.mtimeMs > newestMtime) {
        newestMtime = stats.mtimeMs
        newestPath = candidatePath
      }
    }

    if (newestPath) return newestPath
  } catch {
    // fail-open
  }

  const iosCrashFromEnv =
    resolveExistingPath(process.env.OH_MY_SHIT_MEMORY_IOS_CRASH_PATH) ??
    resolveExistingPath(process.env.SIMULATOR_CRASH_LOG_PATH)
  if (iosCrashFromEnv) return iosCrashFromEnv

  const iosCrashDirectories = [
    join(homedir(), "Library/Logs/DiagnosticReports"),
    join(homedir(), "Library/Logs/CrashReporter/MobileDevice"),
  ].filter((directory): directory is string => Boolean(directory))

  const simulatorLogRoot = process.env.SIMULATOR_LOG_ROOT
  if (simulatorLogRoot) {
    const simulatorCrash = findNewestCrashFile({
      directories: [simulatorLogRoot],
      maxDepth: 4,
    })
    if (simulatorCrash) return simulatorCrash
  }

  const latestIosCrash = findNewestCrashFile({
    directories: iosCrashDirectories,
    maxDepth: 2,
  })
  if (latestIosCrash) return latestIosCrash

  const coreSimulatorCrash = findNewestCoreSimulatorCrashLog(join(homedir(), "Library/Developer/CoreSimulator/Devices"))
  if (coreSimulatorCrash) return coreSimulatorCrash

  return null
}

function resolveSymbolReference(): string | null {
  const explicitSymbols = process.env.OH_MY_SHIT_MEMORY_SYMBOLS
  if (explicitSymbols) return explicitSymbols

  const dwarfDsymFolderPath = process.env.DWARF_DSYM_FOLDER_PATH
  const dwarfDsymFileName = process.env.DWARF_DSYM_FILE_NAME
  if (dwarfDsymFolderPath && dwarfDsymFileName) {
    return join(dwarfDsymFolderPath, dwarfDsymFileName)
  }

  const dSYMPath = process.env.DSYM_PATH
  if (dSYMPath) return dSYMPath

  return process.env.GITHUB_SHA ?? null
}

export function captureCrash(args: {
  exitCode: number
  signal: string | null
  workingDirectory: string
}): CrashCapture {
  const dumpPointer = discoverCrashArtifact(args.workingDirectory)

  return {
    exit_code: args.exitCode,
    signal: args.signal,
    dump_pointer: dumpPointer,
    symbol_reference: resolveSymbolReference(),
    build_reference: process.env.GITHUB_RUN_ID ?? null,
  }
}
