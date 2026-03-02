import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { createTelemetryCollector } from "./collector"
import { captureCrash } from "./crash-capture"
import { analyzeIncident } from "./analyzer"
import { isWorkflowArtifactBudgetExceeded, writeIncidentArtifacts } from "./artifact-writer"
import { createIncidentJsonReport } from "./report-json"
import { createIncidentMarkdownReport } from "./report-markdown"
import { buildIncidentSignature, deriveIncidentSeverity, deriveReproPriority } from "./signature"
import { maskSensitiveText } from "./masker"
import {
  normalizeOhMyShitMemoryConfig,
  type IncidentBundle,
  type IncidentReportFiles,
  type OhMyShitMemoryConfig,
} from "./types"

const INCIDENT_EXCERPT_CHAR_LIMIT = 10_000

function appendBoundedTail(current: string, chunk: string, maxChars: number): string {
  const next = current + chunk
  if (next.length <= maxChars) {
    return next
  }
  return next.slice(next.length - maxChars)
}

async function teeAndCaptureTail(
  stream: ReadableStream<Uint8Array> | null,
  sink: NodeJS.WriteStream,
  maxTailChars: number,
): Promise<string> {
  if (!stream) {
    return ""
  }

  const decoder = new TextDecoder()
  const reader = stream.getReader()
  let tail = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      sink.write(value)
      tail = appendBoundedTail(tail, decoder.decode(value, { stream: true }), maxTailChars)
    }

    tail = appendBoundedTail(tail, decoder.decode(), maxTailChars)
  } finally {
    reader.releaseLock()
  }

  return tail
}

function resolveActions(bundle: Pick<IncidentBundle, "analysis" | "crash">): string[] {
  const actions: string[] = []
  if (bundle.crash.signal) {
    actions.push("Collect symbols for stack unwinding and inspect signal root cause")
  }
  if (bundle.analysis.leak_indicators.length > 0) {
    actions.push("Run heap profiling and compare growth across repeated test runs")
  }
  if (bundle.analysis.overflow_indicators.length > 0) {
    actions.push("Enable ASAN/UBSAN for reproducer command and inspect overflow source")
  }
  if (actions.length === 0) {
    actions.push("Re-run with OH_MY_SHIT_MEMORY_SAMPLING_MS=250 for higher-fidelity samples")
  }
  return actions
}

export async function runOhMyShitMemoryCapture(args: {
  config?: OhMyShitMemoryConfig
  command: string
  commandArgs: string[]
  cwd?: string
  env?: Record<string, string | undefined>
}): Promise<{ exitCode: number; reports: IncidentReportFiles | null; incident: IncidentBundle | null }> {
  const normalized = normalizeOhMyShitMemoryConfig(args.config)
  const cwd = args.cwd ?? process.cwd()

  if (!normalized.enabled) {
    const subprocess = Bun.spawn({ cmd: [args.command, ...args.commandArgs], cwd, env: args.env })
    const code = await subprocess.exited
    return { exitCode: code, reports: null, incident: null }
  }

  const ci = process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true"
  mkdirSync(normalized.artifact_dir, { recursive: true })

  const subprocess = Bun.spawn({
    cmd: [args.command, ...args.commandArgs],
    cwd,
    env: args.env,
    stdout: "pipe",
    stderr: "pipe",
  })

  const collector = createTelemetryCollector({
    pid: subprocess.pid,
    command: [args.command, ...args.commandArgs].join(" "),
    samplingIntervalMs: normalized.sampling_interval_ms,
    memoryLimitBytes: normalized.monitor_memory_limit_bytes,
    ci,
  })

  collector.start()

  const [exitCode, stdoutRaw, stderrRaw] = await Promise.all([
    subprocess.exited,
    teeAndCaptureTail(subprocess.stdout, process.stdout, INCIDENT_EXCERPT_CHAR_LIMIT),
    teeAndCaptureTail(subprocess.stderr, process.stderr, INCIDENT_EXCERPT_CHAR_LIMIT),
  ])

  collector.stop()

  const crash = captureCrash({
    exitCode,
    signal: subprocess.signalCode,
    workingDirectory: cwd,
  })
  const shouldCaptureIncident = exitCode !== 0 || crash.signal !== null
  if (!shouldCaptureIncident) {
    return {
      exitCode,
      reports: null,
      incident: null,
    }
  }

  const analysis = await analyzeIncident({
    stderrText: stderrRaw,
    stdoutText: stdoutRaw,
    crash,
    timeoutMs: normalized.analysis_timeout_ms,
  })

  const signature = buildIncidentSignature({
    crashSignal: crash.signal,
    exitCode,
    topFunctions: analysis.top_functions,
    modules: analysis.modules,
  })

  const createdAt = new Date().toISOString()
  const incidentId = `${createdAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${signature}`

  const partialIncident: IncidentBundle = {
    id: incidentId,
    created_at: createdAt,
    signature,
    severity: "low",
    repro_priority: "p2",
    recommended_actions: [],
    phase_markers: collector.getPhaseMarkers(),
    samples: collector.getSamples(),
    crash,
    analysis,
    stdout_excerpt: maskSensitiveText(stdoutRaw, normalized.redacted_path_prefixes),
    stderr_excerpt: maskSensitiveText(stderrRaw, normalized.redacted_path_prefixes),
    environment: {
      os: process.platform,
      arch: process.arch,
      ci,
      workflow: process.env.GITHUB_WORKFLOW,
      run_id: process.env.GITHUB_RUN_ID,
      sha: process.env.GITHUB_SHA,
    },
  }

  partialIncident.severity = deriveIncidentSeverity(partialIncident)
  partialIncident.repro_priority = deriveReproPriority(partialIncident.severity)
  partialIncident.recommended_actions = resolveActions(partialIncident)

  const jsonReport = createIncidentJsonReport(partialIncident, normalized.redacted_path_prefixes)
  const markdownReport = createIncidentMarkdownReport(partialIncident, normalized.redacted_path_prefixes)

  let reports: IncidentReportFiles | null = null
  let workflowBudgetExceeded = false
  try {
    reports = writeIncidentArtifacts({
      artifactRootDir: join(normalized.artifact_dir, ci ? "ci" : "local"),
      incidentId,
      jsonReport,
      markdownReport,
      metadata: {
        signature,
        severity: partialIncident.severity,
        repro_priority: partialIncident.repro_priority,
        generated_at: createdAt,
      },
      maxIncidentBytes: normalized.max_incident_artifact_bytes,
    })

    workflowBudgetExceeded = isWorkflowArtifactBudgetExceeded(
      normalized.artifact_dir,
      normalized.max_workflow_artifacts_bytes,
    )
  } catch {
    // fail-open: never fail command on monitoring pipeline error
    reports = null
  }

  return {
    exitCode,
    reports,
    incident: {
      ...partialIncident,
      recommended_actions: workflowBudgetExceeded
        ? [...partialIncident.recommended_actions, "Workflow artifact budget exceeded; prune historical incidents"]
        : partialIncident.recommended_actions,
    },
  }
}

export * from "./types"
