import { describe, expect, test } from "bun:test"
import { createIncidentMarkdownReport } from "./report-markdown"
import type { IncidentBundle } from "./types"

describe("createIncidentMarkdownReport", () => {
  test("masks sensitive crash and analysis string fields", () => {
    const bundle: IncidentBundle = {
      id: "incident-1",
      created_at: "2026-02-24T00:00:00.000Z",
      signature: "abc123",
      severity: "high",
      repro_priority: "p1",
      recommended_actions: ["Investigate memory leak"],
      phase_markers: [],
      samples: [],
      crash: {
        exit_code: 1,
        signal: "SIGABRT",
        dump_pointer: "/Users/alice/private/core.1 token=top-secret",
        symbol_reference: "api_key=secret-symbol",
        build_reference: "/Users/alice/project/builds/app",
      },
      analysis: {
        timed_out: false,
        stack_trace_summary: [],
        top_functions: ["foo password=hunter2"],
        modules: ["/Users/alice/project/libfoo.so"],
        leak_indicators: ["token=abc123"],
        overflow_indicators: ["authorization: bearer hidden-value"],
      },
      stdout_excerpt: "",
      stderr_excerpt: "stderr sample",
      environment: {
        os: "darwin",
        arch: "arm64",
        ci: false,
      },
    }

    const markdown = createIncidentMarkdownReport(bundle, ["/Users/alice/project"])

    expect(markdown).toContain("Dump Pointer: /Users/<redacted>/private/core.1 token=<redacted>")
    expect(markdown).toContain("Symbol Reference: api_key=<redacted>")
    expect(markdown).toContain("Build Reference: <redacted-path>/builds/app")
    expect(markdown).toContain("Top Functions: foo password=<redacted>")
    expect(markdown).toContain("Modules: <redacted-path>/libfoo.so")
    expect(markdown).toContain("Leak Indicators: token=<redacted>")
    expect(markdown).toContain("Overflow Indicators: authorization: bearer <redacted>")
    expect(markdown).not.toContain("top-secret")
    expect(markdown).not.toContain("secret-symbol")
    expect(markdown).not.toContain("hunter2")
    expect(markdown).not.toContain("hidden-value")
  })
})
