import type { PluginInput } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import type { OhMyShitMemoryConfig } from "../../features/oh-my-shit-memory"
import { normalizeOhMyShitMemoryConfig } from "../../features/oh-my-shit-memory"
import { log } from "../../shared"

const RUNNER_JS_PATH = fileURLToPath(new URL("../../cli/oh-my-shit-memory-runner.js", import.meta.url))
const RUNNER_TS_PATH = fileURLToPath(new URL("../../cli/oh-my-shit-memory-runner.ts", import.meta.url))
const RUNNER_PATH = existsSync(RUNNER_JS_PATH) ? RUNNER_JS_PATH : RUNNER_TS_PATH
const RUNNER_MARKER = "oh-my-shit-memory-runner"

function splitCommandSegments(command: string): string[] {
  return command
    .split(/(?:&&|\|\||;|\n)/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function isBuildOrTestCommandSegment(segment: string): boolean {
  const pattern =
    /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:'[^']*'|"[^"]*"|\S+)\s+)*(?:(?:env|command|time|nohup)\s+)*(?:bun\s+(?:test|run\s+(?:build|typecheck))|npm\s+(?:test|run\s+build)|pnpm\s+(?:test|build)|docker\s+run|xcodebuild(?:\s+[^\n\r]*)?\s+\b(?:test|build-for-testing|test-without-building)\b|xcrun\s+simctl)\b/i
  return pattern.test(segment)
}

function isBuildOrTestCommand(command: string): boolean {
  return splitCommandSegments(command).some((segment) => isBuildOrTestCommandSegment(segment))
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`
}

function buildWrappedCommand(command: string): string {
  const quotedRunnerPath = shellQuote(RUNNER_PATH)
  const quotedOriginalCommand = shellQuote(command)
  return `if command -v bun >/dev/null 2>&1; then bun run ${quotedRunnerPath} -- bash -lc ${quotedOriginalCommand}; else bash -lc ${quotedOriginalCommand}; fi`
}

function isAlreadyWrapped(command: string, env: Record<string, unknown>): boolean {
  const wrappedFromEnv = typeof env.OH_MY_SHIT_MEMORY_WRAPPED === "string" && env.OH_MY_SHIT_MEMORY_WRAPPED === "1"
  const wrappedFromCommand = command.includes(RUNNER_MARKER)
  return wrappedFromEnv || wrappedFromCommand
}

export function createOhMyShitMemoryHook(_ctx: PluginInput, config: OhMyShitMemoryConfig | undefined) {
  const normalized = normalizeOhMyShitMemoryConfig(config)
  let initialized = false

  const safeLog = (message: string, meta?: Record<string, unknown>) => {
    try {
      log(`[oh-my-shit-memory] ${message}`, meta)
    } catch {
      // fail-open
    }
  }

  return {
    event: async (input: { event: { type: string } }) => {
      if (!normalized.enabled) return
      if (input.event.type === "session.created" && !initialized) {
        initialized = true
        safeLog("initialized", {
          sampling_interval_ms: normalized.sampling_interval_ms,
          artifact_dir: normalized.artifact_dir,
        })
      }
      if (input.event.type === "session.deleted") {
        initialized = false
      }
    },
    "tool.execute.before": async (
      input: { tool: string; sessionID: string },
      output: { args: Record<string, unknown> },
    ) => {
      try {
        if (!normalized.enabled) return
        if (input.tool.toLowerCase() !== "bash") return
        const command = typeof output.args.command === "string" ? output.args.command : ""

        const currentEnv =
          typeof output.args.env === "object" && output.args.env ? (output.args.env as Record<string, unknown>) : {}
        const alreadyWrapped = isAlreadyWrapped(command, currentEnv)
        if (!alreadyWrapped && !isBuildOrTestCommand(command)) return

        output.args.env = {
          ...currentEnv,
          OH_MY_SHIT_MEMORY_ENABLED: "1",
          OH_MY_SHIT_MEMORY_SAMPLING_MS: String(normalized.sampling_interval_ms),
          OH_MY_SHIT_MEMORY_WRAPPED: "1",
        }

        if (!alreadyWrapped) {
          output.args.command = buildWrappedCommand(command)
        }

        safeLog("instrumentation hints applied", {
          sessionID: input.sessionID,
        })
      } catch (error) {
        safeLog("instrumentation failed-open", {
          sessionID: input.sessionID,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }
}
