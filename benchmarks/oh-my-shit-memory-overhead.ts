#!/usr/bin/env bun
import { runOhMyShitMemoryCapture } from "../src/features/oh-my-shit-memory"

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

async function measureBaseline(iterations: number): Promise<number[]> {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    const proc = Bun.spawn({ cmd: ["bash", "-lc", "bun test src/features/oh-my-shit-memory --bail"], stdout: "ignore", stderr: "ignore" })
    await proc.exited
    times.push(performance.now() - start)
  }
  return times
}

async function measureInstrumented(iterations: number): Promise<number[]> {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await runOhMyShitMemoryCapture({
      config: {
        sampling_interval_ms: 1000,
        artifact_dir: ".oh-my-shit-memory/benchmark",
      },
      command: "bash",
      commandArgs: ["-lc", "bun test src/features/oh-my-shit-memory --bail"],
    })
    times.push(performance.now() - start)
  }
  return times
}

async function main() {
  const iterations = Number.parseInt(process.env.OH_MY_SHIT_MEMORY_BENCH_ITERATIONS ?? "3", 10)
  const baseline = await measureBaseline(iterations)
  const instrumented = await measureInstrumented(iterations)

  const baselineMedian = median(baseline)
  const instrumentedMedian = median(instrumented)
  const overheadPct = ((instrumentedMedian - baselineMedian) / baselineMedian) * 100

  console.log(JSON.stringify({ baselineMedian, instrumentedMedian, overheadPct }, null, 2))

  if (overheadPct > 10) {
    console.error(`Overhead budget exceeded: ${overheadPct.toFixed(2)}% > 10%`)
    process.exit(1)
  }
}

main()
