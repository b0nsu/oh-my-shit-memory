# oh-my-shit-memory (Linux-first + iOS Simulator compatible)

`oh-my-shit-memory` is a Linux-first runtime incident pipeline for test/build commands, with compatibility support for iOS Simulator workflows.

It captures telemetry, crash pointers, and analysis reports, then emits:

- `incident.json` (machine-readable)
- `incident.md` (human triage summary)

## Local Linux usage

```bash
bun run script/oh-my-shit-memory-runner.ts -- bun test
```

Artifacts are written to:

```text
.oh-my-shit-memory/incidents/local/<incident-id>/
```

## iOS Simulator usage (compatibility mode)

You can wrap iOS simulator test commands the same way:

```bash
bun run script/oh-my-shit-memory-runner.ts -- xcodebuild test \
  -scheme MyApp \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

Useful simulator log commands are also supported:

```bash
bun run script/oh-my-shit-memory-runner.ts -- xcrun simctl spawn booted log show --last 5m
```

## Standalone plugin mode (Codex / Claude MCP)

`oh-my-shit-memory` can run as a standalone MCP server so Codex/Claude can use it without the full oh-my-opencode hook chain.

Start the MCP server:

```bash
npx --yes bun run script/oh-my-shit-memory-mcp.ts
```

### Claude Code (`.mcp.json`) example

```json
{
  "mcpServers": {
    "oh-my-shit-memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "bun", "run", "script/oh-my-shit-memory-mcp.ts"]
    }
  }
}
```

### MCP tools exposed

- `oh_my_shit_memory_capture` — wrap any command and return incident/report metadata
- `oh_my_shit_memory_latest_incident` — fetch latest incident summary from artifact dir
- `oh_my_shit_memory_integration_snippets` — prints setup snippets

## GitHub Actions usage

Use the wrapper in CI job steps:

```yaml
- run: bun run script/oh-my-shit-memory-runner.ts -- bun run typecheck
```

On failure, CI uploads `.oh-my-shit-memory` artifacts and attempts deduped issue creation (24h signature window).

## Docker runtime example

```dockerfile
FROM oven/bun:1
WORKDIR /workspace
COPY . .
RUN bun install
CMD ["bun", "run", "script/oh-my-shit-memory-runner.ts", "--", "bun", "test"]
```

Forced crash smoke example:

```bash
docker run --rm -v "$PWD":/workspace -w /workspace oven/bun:1 \
  bun run script/oh-my-shit-memory-runner.ts -- bash -lc 'kill -ABRT $$'
```

## Optional Sentry mapping example

```ts
import * as Sentry from "@sentry/node"

export function sendIncidentToSentry(incident: { signature: string; severity: string; repro_priority: string }) {
  Sentry.captureMessage("oh-my-shit-memory incident", {
    level: incident.severity === "critical" ? "fatal" : "error",
    tags: {
      incident_signature: incident.signature,
      repro_priority: incident.repro_priority,
      source: "oh-my-shit-memory",
    },
  })
}
```

## Budgets and guardrails

- Sampling interval: default `1000ms`, bounds `250ms`–`10000ms`
- Per-incident artifacts: max `500MB`
- Workflow artifact budget: max `2GB`
- Analyzer timeout: max `120s` (fail-open)
- Monitor process memory budget: max `100MB`
