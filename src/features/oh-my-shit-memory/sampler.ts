import { readdirSync, readFileSync } from "node:fs"
import { type RuntimeSample } from "./types"

function parseKeyValueFile(path: string): Record<string, string> {
  const content = readFileSync(path, "utf8")
  const output: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const idx = line.indexOf(":")
    if (idx < 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    output[key] = value
  }
  return output
}

function parseStatusNumber(status: Record<string, string>, key: string): number {
  const raw = status[key]
  if (!raw) return 0
  const number = Number.parseInt(raw.split(" ")[0] ?? "0", 10)
  return Number.isFinite(number) ? number * 1024 : 0
}

function parseIoValue(path: string, key: string): number {
  const map = parseKeyValueFile(path)
  return Number.parseInt(map[key] ?? "0", 10) || 0
}

export function parseProcStatLine(statLine: string): { pid: number; ppid: number; utimeTicks: number; stimeTicks: number } {
  const trimmed = statLine.trim()
  const commEndIndex = trimmed.lastIndexOf(")")
  if (commEndIndex < 0) {
    throw new Error("invalid /proc stat format: missing comm terminator")
  }

  const pidPart = trimmed.slice(0, trimmed.indexOf("(")).trim()
  const pid = Number.parseInt(pidPart, 10)
  if (!Number.isFinite(pid)) {
    throw new Error("invalid /proc stat format: invalid pid")
  }

  const suffix = trimmed.slice(commEndIndex + 1).trim()
  const values = suffix.split(/\s+/)
  const ppid = Number.parseInt(values[1] ?? "0", 10)
  const utimeTicks = Number.parseInt(values[11] ?? "0", 10)
  const stimeTicks = Number.parseInt(values[12] ?? "0", 10)

  return {
    pid,
    ppid: Number.isFinite(ppid) ? ppid : 0,
    utimeTicks: Number.isFinite(utimeTicks) ? utimeTicks : 0,
    stimeTicks: Number.isFinite(stimeTicks) ? stimeTicks : 0,
  }
}

function parseCpuTimes(statPath: string): { user: number; system: number } {
  const stat = readFileSync(statPath, "utf8")
  const parsed = parseProcStatLine(stat)
  const ticksPerSecond = 100
  return {
    user: parsed.utimeTicks / ticksPerSecond,
    system: parsed.stimeTicks / ticksPerSecond,
  }
}

function createFallbackSample(pid: number): RuntimeSample {
  const usage = process.memoryUsage()
  const cpu = process.cpuUsage()
  return {
    timestamp: new Date().toISOString(),
    pid,
    rss_bytes: usage.rss,
    vsz_bytes: usage.heapTotal,
    cpu_user_seconds: cpu.user / 1_000_000,
    cpu_system_seconds: cpu.system / 1_000_000,
    io_read_bytes: 0,
    io_write_bytes: 0,
    thread_count: 0,
    process_tree: [pid],
  }
}

export function getProcessTree(rootPid: number): number[] {
  const processTree = new Set<number>([rootPid])
  const queue: number[] = [rootPid]

  try {
    while (queue.length > 0) {
      const parent = queue.shift()
      if (!parent) break

      const procEntries = readdirSync("/proc").filter((entry) => /^\d+$/.test(entry))
      for (const entry of procEntries) {
        const pid = Number.parseInt(entry, 10)
        if (!Number.isFinite(pid) || processTree.has(pid)) continue

        try {
          const stat = readFileSync(`/proc/${pid}/stat`, "utf8")
          const parsed = parseProcStatLine(stat)
          const ppid = parsed.ppid
          if (ppid === parent) {
            processTree.add(pid)
            queue.push(pid)
          }
        } catch {
          // fail-open for ephemeral process entries
        }
      }
    }
  } catch {
    // fail-open: keep only root pid
  }

  return Array.from(processTree).sort((a, b) => a - b)
}

export function sampleRuntime(pid: number): RuntimeSample {
  try {
    const status = parseKeyValueFile(`/proc/${pid}/status`)
    const cpuTimes = parseCpuTimes(`/proc/${pid}/stat`)
    const ioPath = `/proc/${pid}/io`

    return {
      timestamp: new Date().toISOString(),
      pid,
      rss_bytes: parseStatusNumber(status, "VmRSS"),
      vsz_bytes: parseStatusNumber(status, "VmSize"),
      cpu_user_seconds: cpuTimes.user,
      cpu_system_seconds: cpuTimes.system,
      io_read_bytes: parseIoValue(ioPath, "read_bytes"),
      io_write_bytes: parseIoValue(ioPath, "write_bytes"),
      thread_count: Number.parseInt(status["Threads"] ?? "0", 10) || 0,
      process_tree: getProcessTree(pid),
    }
  } catch {
    return createFallbackSample(pid)
  }
}

export function createSampler(args: {
  pid: number
  samplingIntervalMs: number
  memoryLimitBytes: number
  onSample: (sample: RuntimeSample) => void
  onError?: (error: unknown) => void
}) {
  const { pid, samplingIntervalMs, memoryLimitBytes, onSample, onError } = args
  let timer: ReturnType<typeof setInterval> | null = null

  const sampleOnce = () => {
    try {
      const sample = sampleRuntime(pid)
      onSample(sample)

      const processMemory = process.memoryUsage.rss()
      if (processMemory > memoryLimitBytes) {
        onError?.(new Error(`monitor memory limit exceeded: ${processMemory} > ${memoryLimitBytes}`))
      }
    } catch (error) {
      onError?.(error)
    }
  }

  return {
    start: () => {
      if (timer) return
      sampleOnce()
      timer = setInterval(sampleOnce, samplingIntervalMs)
    },
    stop: () => {
      if (!timer) return
      clearInterval(timer)
      timer = null
    },
  }
}

export function trySampleRuntime(pid: number): RuntimeSample | null {
  try {
    return sampleRuntime(pid)
  } catch {
    return null
  }
}
