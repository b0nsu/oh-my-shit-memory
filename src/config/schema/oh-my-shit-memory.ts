import { z } from "zod"
import {
  DEFAULT_ANALYSIS_TIMEOUT_MS,
  DEFAULT_MAX_INCIDENT_BYTES,
  DEFAULT_MAX_WORKFLOW_ARTIFACT_BYTES,
  DEFAULT_MONITOR_MEMORY_LIMIT_BYTES,
  DEFAULT_SAMPLING_INTERVAL_MS,
  MAX_SAMPLING_INTERVAL_MS,
  MIN_SAMPLING_INTERVAL_MS,
} from "../../features/oh-my-shit-memory/types"

export const OhMyShitMemoryConfigSchema = z.object({
  enabled: z.boolean().optional(),
  sampling_interval_ms: z
    .number()
    .int()
    .min(MIN_SAMPLING_INTERVAL_MS)
    .max(MAX_SAMPLING_INTERVAL_MS)
    .default(DEFAULT_SAMPLING_INTERVAL_MS)
    .optional(),
  analysis_timeout_ms: z.number().int().min(1_000).max(DEFAULT_ANALYSIS_TIMEOUT_MS).default(DEFAULT_ANALYSIS_TIMEOUT_MS).optional(),
  max_incident_artifact_bytes: z.number().int().positive().max(DEFAULT_MAX_INCIDENT_BYTES).default(DEFAULT_MAX_INCIDENT_BYTES).optional(),
  max_workflow_artifacts_bytes: z
    .number()
    .int()
    .positive()
    .max(DEFAULT_MAX_WORKFLOW_ARTIFACT_BYTES)
    .default(DEFAULT_MAX_WORKFLOW_ARTIFACT_BYTES)
    .optional(),
  monitor_memory_limit_bytes: z.number().int().positive().max(DEFAULT_MONITOR_MEMORY_LIMIT_BYTES).default(DEFAULT_MONITOR_MEMORY_LIMIT_BYTES).optional(),
  artifact_dir: z.string().min(1).optional(),
  redacted_path_prefixes: z.array(z.string().min(1)).optional(),
})

export type OhMyShitMemoryConfig = z.infer<typeof OhMyShitMemoryConfigSchema>
