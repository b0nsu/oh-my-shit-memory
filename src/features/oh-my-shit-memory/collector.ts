import { type MemoryIncidentPhase, type PhaseMarker, type RuntimeSample } from "./types"
import { createSampler } from "./sampler"

export function createTelemetryCollector(args: {
  pid?: number
  command: string
  samplingIntervalMs: number
  memoryLimitBytes: number
  ci: boolean
  onError?: (error: unknown) => void
}) {
  const pid = args.pid ?? process.pid
  const phaseMarkers: PhaseMarker[] = []
  const samples: RuntimeSample[] = []

  const sampler = createSampler({
    pid,
    samplingIntervalMs: args.samplingIntervalMs,
    memoryLimitBytes: args.memoryLimitBytes,
    onError: args.onError,
    onSample: (sample) => {
      samples.push(sample)
      if (samples.length > 10_000) {
        samples.splice(0, samples.length - 10_000)
      }
    },
  })

  const markPhase = (phase: MemoryIncidentPhase) => {
    phaseMarkers.push({
      phase,
      timestamp: new Date().toISOString(),
      context: args.ci ? "ci" : "local",
      command: args.command,
    })
  }

  return {
    start: () => {
      markPhase("pre")
      sampler.start()
      markPhase("during")
    },
    stop: () => {
      markPhase("post")
      sampler.stop()
    },
    getPhaseMarkers: () => [...phaseMarkers],
    getSamples: () => [...samples],
  }
}
