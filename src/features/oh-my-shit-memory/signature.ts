import { createHash } from "node:crypto"
import type { IncidentBundle } from "./types"

export function buildIncidentSignature(input: {
  crashSignal: string | null
  exitCode: number
  topFunctions: string[]
  modules: string[]
}): string {
  const payload = JSON.stringify({
    crashSignal: input.crashSignal,
    exitCode: input.exitCode,
    topFunctions: input.topFunctions.slice(0, 5),
    modules: input.modules.slice(0, 5),
  })

  return createHash("sha256").update(payload).digest("hex").slice(0, 20)
}

export function deriveIncidentSeverity(bundle: Pick<IncidentBundle, "analysis" | "crash">): IncidentBundle["severity"] {
  if (bundle.crash.signal || bundle.crash.exit_code >= 134) return "critical"
  if (bundle.analysis.overflow_indicators.length > 0) return "high"
  if (bundle.analysis.leak_indicators.length > 0) return "medium"
  return "low"
}

export function deriveReproPriority(severity: IncidentBundle["severity"]): IncidentBundle["repro_priority"] {
  switch (severity) {
    case "critical":
      return "p0"
    case "high":
      return "p1"
    default:
      return "p2"
  }
}
