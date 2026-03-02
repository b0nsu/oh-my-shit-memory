import { maskJsonValue } from "./masker"
import type { IncidentBundle } from "./types"

export function createIncidentJsonReport(bundle: IncidentBundle, redactedPathPrefixes: string[]): string {
  const sanitized = maskJsonValue(bundle, redactedPathPrefixes)
  return JSON.stringify(sanitized, null, 2)
}
