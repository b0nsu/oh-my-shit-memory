#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { runOhMyShitMemoryCapture } from "../src/features/oh-my-shit-memory"
import { readLatestIncidentSummary } from "../src/features/oh-my-shit-memory/incident-finder"

const MCP_ALLOW_UNSAFE_ENV = "OH_MY_SHIT_MEMORY_MCP_ALLOW_UNSAFE"
const SAFE_COMMAND_ALLOWLIST = new Set([
  "bun",
  "npm",
  "pnpm",
  "yarn",
  "xcodebuild",
  "xcrun",
  "swift",
  "gradle",
  "gradlew",
  "docker",
])
const SAFE_SCRIPT_TASKS = new Set(["build", "typecheck", "test"])

const SAFE_ENV_KEYS = new Set([
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "PWD",
  "SHELL",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "USER",
  "LOGNAME",
  "CI",
  "GITHUB_ACTIONS",
  "GITHUB_RUN_ID",
  "GITHUB_SHA",
  "GITHUB_WORKFLOW",
])

function toJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function isUnsafeModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[MCP_ALLOW_UNSAFE_ENV] === "1"
}

export function isAllowedCommand(command: string): boolean {
  const trimmed = command.trim()
  if (trimmed.length === 0) return false
  if (trimmed !== command) return false
  if (/[\/\\\s]/.test(trimmed)) return false
  if (!/^[a-z0-9._-]+$/.test(trimmed)) return false
  return SAFE_COMMAND_ALLOWLIST.has(trimmed)
}

export function isAllowedInvocation(command: string, args: string[]): boolean {
  if (!isAllowedCommand(command)) return false

  switch (command) {
    case "bun":
      return args[0] === "test" || (args[0] === "run" && SAFE_SCRIPT_TASKS.has(args[1] ?? ""))
    case "npm":
    case "pnpm":
      return args[0] === "test" || (args[0] === "run" && SAFE_SCRIPT_TASKS.has(args[1] ?? ""))
    case "yarn":
      return args[0] === "test" || SAFE_SCRIPT_TASKS.has(args[0] ?? "")
    case "xcodebuild":
      return args.some((arg) => arg === "test" || arg === "build-for-testing" || arg === "test-without-building")
    case "xcrun":
      return args[0] === "simctl"
    case "swift":
      return args[0] === "test" || args[0] === "build"
    case "gradle":
    case "gradlew":
      return args.some((arg) => /^(test|build|assemble|check)$/i.test(arg))
    case "docker":
      return false
    default:
      return false
  }
}

function isSafeEnvKey(key: string): boolean {
  return SAFE_ENV_KEYS.has(key) || key.startsWith("LC_") || key.startsWith("OH_MY_SHIT_MEMORY_")
}

export function createMergedEnv(argsEnv?: Record<string, string>, sourceEnv: NodeJS.ProcessEnv = process.env): Record<string, string> {
  if (isUnsafeModeEnabled(sourceEnv)) {
    return {
      ...Object.fromEntries(Object.entries(sourceEnv).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
      ...(argsEnv ?? {}),
    }
  }

  const merged: Record<string, string> = {}
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (typeof value !== "string") continue
    if (!isSafeEnvKey(key)) continue
    merged[key] = value
  }

  for (const [key, value] of Object.entries(argsEnv ?? {})) {
    if (key === "PATH") continue
    if (!isSafeEnvKey(key)) continue
    merged[key] = value
  }

  return merged
}

const selfPath = fileURLToPath(import.meta.url)
const server = new McpServer({
  name: "oh-my-shit-memory-mcp",
  version: "0.1.0",
})

server.registerTool(
  "oh_my_shit_memory_capture",
  {
    title: "Capture runtime incident",
    description: "Run a command with oh-my-shit-memory instrumentation and return incident/report metadata.",
    inputSchema: {
      command: z.string().min(1),
      args: z.array(z.string()).default([]),
      cwd: z.string().optional(),
      artifact_dir: z.string().optional(),
      sampling_interval_ms: z.number().int().min(250).max(10_000).optional(),
      analysis_timeout_ms: z.number().int().min(1_000).max(120_000).optional(),
      env: z.record(z.string(), z.string()).optional(),
    },
  },
  async (args) => {
    try {
      if (!isUnsafeModeEnabled(process.env) && !isAllowedInvocation(args.command, args.args ?? [])) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `command invocation not allowed by default policy: ${args.command} ${(args.args ?? []).join(" ")}. Set ${MCP_ALLOW_UNSAFE_ENV}=1 to allow arbitrary commands.`,
            },
          ],
        }
      }

      const mergedEnv = createMergedEnv(args.env)

      const result = await runOhMyShitMemoryCapture({
        config: {
          enabled: true,
          artifact_dir: args.artifact_dir,
          sampling_interval_ms: args.sampling_interval_ms,
          analysis_timeout_ms: args.analysis_timeout_ms,
          redacted_path_prefixes: [args.cwd ?? process.cwd()],
        },
        command: args.command,
        commandArgs: args.args ?? [],
        cwd: args.cwd,
        env: mergedEnv,
      })

      return {
        content: [
          {
            type: "text",
            text: toJsonText({
              exit_code: result.exitCode,
              incident: result.incident
                ? {
                    id: result.incident.id,
                    signature: result.incident.signature,
                    severity: result.incident.severity,
                    repro_priority: result.incident.repro_priority,
                    created_at: result.incident.created_at,
                  }
                : null,
              reports: result.reports,
            }),
          },
        ],
      }
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `oh-my-shit-memory capture failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      }
    }
  },
)

server.registerTool(
  "oh_my_shit_memory_latest_incident",
  {
    title: "Read latest incident",
    description: "Read the latest incident summary from an artifact directory.",
    inputSchema: {
      artifact_dir: z.string().optional(),
    },
  },
  async (args) => {
    const artifactDir = args.artifact_dir ?? ".oh-my-shit-memory/incidents"
    const summary = readLatestIncidentSummary(artifactDir)

    if (!summary) {
      return {
        content: [
          {
            type: "text",
            text: `No incident found in ${artifactDir}`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: "text",
          text: toJsonText(summary),
        },
      ],
    }
  },
)

server.registerTool(
  "oh_my_shit_memory_integration_snippets",
  {
    title: "Integration snippets",
    description: "Return ready-to-use MCP configuration snippets for Claude Code and Codex.",
    inputSchema: {},
  },
  async () => {
    const snippets = {
      claude_code_mcp_json: {
        mcpServers: {
          "oh-my-shit-memory": {
            type: "stdio",
            command: "npx",
            args: ["--yes", "bun", "run", selfPath],
          },
        },
      },
      codex_mcp_command: `npx --yes bun run ${selfPath}`,
      notes: [
        "Use the absolute script path above to avoid breakage when cwd/repo location changes.",
        "Default security policy only allows known build/test executables. Set OH_MY_SHIT_MEMORY_MCP_ALLOW_UNSAFE=1 for arbitrary commands.",
        "Call oh_my_shit_memory_capture to execute capture.",
      ],
    }

    return {
      content: [
        {
          type: "text",
          text: toJsonText(snippets),
        },
      ],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[oh-my-shit-memory-mcp] fatal: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
