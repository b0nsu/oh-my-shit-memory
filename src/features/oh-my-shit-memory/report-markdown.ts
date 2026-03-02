import type { IncidentBundle } from "./types"
import { maskSensitiveText } from "./masker"

export function createIncidentMarkdownReport(bundle: IncidentBundle, redactedPathPrefixes: string[]): string {
  const mask = (value: string) => maskSensitiveText(value, redactedPathPrefixes)
  const renderMaskedList = (values: string[]) => values.map(mask).join(", ") || "none"

  const actions = bundle.recommended_actions.length > 0
    ? bundle.recommended_actions.map((action) => `- ${action}`).join("\n")
    : "- No immediate action required"

  return [
    `# oh-my-shit-memory Incident ${bundle.id}`,
    "",
    `- Signature: \`${bundle.signature}\``,
    `- Severity: **${bundle.severity}**`,
    `- Repro Priority: **${bundle.repro_priority}**`,
    `- Created At: ${bundle.created_at}`,
    `- CI: ${bundle.environment.ci ? "yes" : "no"}`,
    "",
    "## Recommended Actions",
    actions,
    "",
    "## Crash Metadata",
    `- Exit Code: ${bundle.crash.exit_code}`,
    `- Signal: ${bundle.crash.signal ?? "none"}`,
    `- Dump Pointer: ${bundle.crash.dump_pointer ? mask(bundle.crash.dump_pointer) : "none"}`,
    `- Symbol Reference: ${bundle.crash.symbol_reference ? mask(bundle.crash.symbol_reference) : "none"}`,
    `- Build Reference: ${bundle.crash.build_reference ? mask(bundle.crash.build_reference) : "none"}`,
    "",
    "## Analysis",
    `- Timed Out: ${bundle.analysis.timed_out}`,
    `- Top Functions: ${renderMaskedList(bundle.analysis.top_functions)}`,
    `- Modules: ${renderMaskedList(bundle.analysis.modules)}`,
    `- Leak Indicators: ${renderMaskedList(bundle.analysis.leak_indicators)}`,
    `- Overflow Indicators: ${renderMaskedList(bundle.analysis.overflow_indicators)}`,
    "",
    "## Sample Counts",
    `- Runtime Samples: ${bundle.samples.length}`,
    `- Phase Markers: ${bundle.phase_markers.length}`,
    "",
    "## stderr excerpt",
    "```text",
    maskSensitiveText(bundle.stderr_excerpt, redactedPathPrefixes),
    "```",
  ].join("\n")
}
