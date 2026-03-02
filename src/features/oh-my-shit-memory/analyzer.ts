import type { AnalysisSummary, CrashCapture } from "./types"

function collectMatches(input: string, pattern: RegExp, max = 10): string[] {
  const matches = new Set<string>()
  let match: RegExpExecArray | null
  const regex = new RegExp(pattern.source, pattern.flags)
  while ((match = regex.exec(input)) && matches.size < max) {
    if (match[1]) {
      matches.add(match[1])
    }
  }
  return Array.from(matches)
}

function deriveSeverityIndicators(stderrText: string): {
  leakIndicators: string[]
  overflowIndicators: string[]
} {
  const lower = stderrText.toLowerCase()
  const leakIndicators = ["leak", "out of memory", "oom", "memory not freed"].filter((token) => lower.includes(token))
  const overflowIndicators = ["overflow", "stack smashing", "segmentation fault", "sigabrt"].filter((token) => lower.includes(token))

  return { leakIndicators, overflowIndicators }
}

async function buildAnalysis(args: {
  stderrText: string
  stdoutText: string
  crash: CrashCapture
}): Promise<AnalysisSummary> {
  const merged = `${args.stderrText}\n${args.stdoutText}`
  const stackTraceSummary = collectMatches(merged, /(?:at|#\d+)\s+([A-Za-z0-9_:\-.~<>]+\([^\)]*\)|[A-Za-z0-9_:\-.~<>]+)/g, 12)
  const modules = collectMatches(merged, /([A-Za-z0-9_\-/]+\.(?:so|dylib|node|dll))/g, 12)
  const topFunctions = stackTraceSummary.slice(0, 5)
  const indicators = deriveSeverityIndicators(args.stderrText)

  if (args.crash.dump_pointer && !modules.includes(args.crash.dump_pointer)) {
    modules.unshift(args.crash.dump_pointer)
  }

  return {
    timed_out: false,
    stack_trace_summary: stackTraceSummary,
    modules,
    top_functions: topFunctions,
    leak_indicators: indicators.leakIndicators,
    overflow_indicators: indicators.overflowIndicators,
  }
}

export async function analyzeIncident(args: {
  stderrText: string
  stdoutText: string
  crash: CrashCapture
  timeoutMs: number
}): Promise<AnalysisSummary> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<AnalysisSummary>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({
        timed_out: true,
        stack_trace_summary: [],
        modules: [],
        top_functions: [],
        leak_indicators: [],
        overflow_indicators: [],
      })
    }, args.timeoutMs)
  })

  try {
    return await Promise.race([buildAnalysis(args), timeoutPromise])
  } catch {
    return {
      timed_out: false,
      stack_trace_summary: [],
      modules: [],
      top_functions: [],
      leak_indicators: [],
      overflow_indicators: [],
    }
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
      timeoutHandle = null
    }
  }
}
