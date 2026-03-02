export const DEFAULT_SAMPLING_INTERVAL_MS = 1000
export const MIN_SAMPLING_INTERVAL_MS = 250
export const MAX_SAMPLING_INTERVAL_MS = 10_000
export const DEFAULT_ANALYSIS_TIMEOUT_MS = 120_000
export const DEFAULT_MAX_INCIDENT_BYTES = 500 * 1024 * 1024
export const DEFAULT_MAX_WORKFLOW_ARTIFACT_BYTES = 2 * 1024 * 1024 * 1024
export const DEFAULT_MONITOR_MEMORY_LIMIT_BYTES = 100 * 1024 * 1024

export type MemoryIncidentSeverity = "low" | "medium" | "high" | "critical"
export type MemoryIncidentPhase = "pre" | "during" | "post"

export interface OhMyShitMemoryConfig {
  enabled?: boolean
  sampling_interval_ms?: number
  analysis_timeout_ms?: number
  max_incident_artifact_bytes?: number
  max_workflow_artifacts_bytes?: number
  monitor_memory_limit_bytes?: number
  artifact_dir?: string
  redacted_path_prefixes?: string[]
}

export interface RuntimeSample {
  timestamp: string
  pid: number
  rss_bytes: number
  vsz_bytes: number
  cpu_user_seconds: number
  cpu_system_seconds: number
  io_read_bytes: number
  io_write_bytes: number
  thread_count: number
  process_tree: number[]
}

export interface PhaseMarker {
  phase: MemoryIncidentPhase
  timestamp: string
  context: "local" | "ci"
  command: string
}

export interface CrashCapture {
  exit_code: number
  signal: string | null
  dump_pointer: string | null
  symbol_reference: string | null
  build_reference: string | null
}

export interface AnalysisSummary {
  timed_out: boolean
  stack_trace_summary: string[]
  modules: string[]
  top_functions: string[]
  leak_indicators: string[]
  overflow_indicators: string[]
}

export interface IncidentBundle {
  id: string
  created_at: string
  signature: string
  severity: MemoryIncidentSeverity
  repro_priority: "p0" | "p1" | "p2"
  recommended_actions: string[]
  phase_markers: PhaseMarker[]
  samples: RuntimeSample[]
  crash: CrashCapture
  analysis: AnalysisSummary
  stdout_excerpt: string
  stderr_excerpt: string
  environment: {
    os: string
    arch: string
    ci: boolean
    workflow?: string
    run_id?: string
    sha?: string
  }
}

export interface IncidentReportFiles {
  directory: string
  json_path: string
  markdown_path: string
  metadata_path: string
}

export function normalizeOhMyShitMemoryConfig(
  config: OhMyShitMemoryConfig | undefined,
): Required<OhMyShitMemoryConfig> {
  const samplingInterval = Math.max(
    MIN_SAMPLING_INTERVAL_MS,
    Math.min(MAX_SAMPLING_INTERVAL_MS, config?.sampling_interval_ms ?? DEFAULT_SAMPLING_INTERVAL_MS),
  )

  return {
    enabled: config?.enabled ?? true,
    sampling_interval_ms: samplingInterval,
    analysis_timeout_ms: Math.max(1_000, config?.analysis_timeout_ms ?? DEFAULT_ANALYSIS_TIMEOUT_MS),
    max_incident_artifact_bytes: Math.max(1_024 * 1024, config?.max_incident_artifact_bytes ?? DEFAULT_MAX_INCIDENT_BYTES),
    max_workflow_artifacts_bytes: Math.max(1_024 * 1024, config?.max_workflow_artifacts_bytes ?? DEFAULT_MAX_WORKFLOW_ARTIFACT_BYTES),
    monitor_memory_limit_bytes: Math.max(1_024 * 1024, config?.monitor_memory_limit_bytes ?? DEFAULT_MONITOR_MEMORY_LIMIT_BYTES),
    artifact_dir: config?.artifact_dir ?? ".oh-my-shit-memory/incidents",
    redacted_path_prefixes: config?.redacted_path_prefixes ?? [],
  }
}
