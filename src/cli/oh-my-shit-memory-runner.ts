#!/usr/bin/env bun
import { runOhMyShitMemoryCapture } from "../features/oh-my-shit-memory"

function parseArguments(rawArgs: string[]): { command: string; commandArgs: string[] } {
  const separatorIndex = rawArgs.indexOf("--")
  const payload = separatorIndex >= 0 ? rawArgs.slice(separatorIndex + 1) : rawArgs
  const [command, ...commandArgs] = payload

  if (!command) {
    throw new Error("Usage: bun run oh-my-shit-memory-runner.ts -- <command> [args...]")
  }

  return { command, commandArgs }
}

async function runFallback(command: string, commandArgs: string[]): Promise<number> {
  const proc = Bun.spawn({ cmd: [command, ...commandArgs], stdout: "inherit", stderr: "inherit" })
  return await proc.exited
}

async function main() {
  const { command, commandArgs } = parseArguments(process.argv.slice(2))

  try {
    const result = await runOhMyShitMemoryCapture({
      config: {
        enabled: true,
        sampling_interval_ms: Number.parseInt(process.env.OH_MY_SHIT_MEMORY_SAMPLING_MS ?? "1000", 10),
        artifact_dir: process.env.OH_MY_SHIT_MEMORY_ARTIFACT_DIR ?? ".oh-my-shit-memory/incidents",
        redacted_path_prefixes: [process.cwd()],
      },
      command,
      commandArgs,
      env: process.env,
    })

    if (result.reports) {
      console.log(`[oh-my-shit-memory] incident=${result.incident?.id} signature=${result.incident?.signature}`)
      console.log(`[oh-my-shit-memory] json=${result.reports.json_path}`)
      console.log(`[oh-my-shit-memory] markdown=${result.reports.markdown_path}`)
    }

    process.exit(result.exitCode)
  } catch (error) {
    console.error(`[oh-my-shit-memory] fail-open error: ${error instanceof Error ? error.message : String(error)}`)
    const fallbackCode = await runFallback(command, commandArgs)
    process.exit(fallbackCode)
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[oh-my-shit-memory] fatal error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  })
}
