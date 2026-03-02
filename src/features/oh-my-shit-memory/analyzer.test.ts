import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { analyzeIncident } from "./analyzer"
import { buildIncidentSignature } from "./signature"

describe("analyzeIncident", () => {
  let clearTimeoutSpy: ReturnType<typeof spyOn> | null = null

  afterEach(() => {
    clearTimeoutSpy?.mockRestore()
    clearTimeoutSpy = null
  })

  test("extracts stack/functions/modules and indicators", async () => {
    const result = await analyzeIncident({
      stderrText: "SIGABRT overflow at foo::bar() libfoo.so out of memory",
      stdoutText: "#0 foo::bar()\n#1 baz::qux()",
      crash: {
        exit_code: 134,
        signal: "SIGABRT",
        dump_pointer: "/tmp/core.123",
        symbol_reference: "abc",
        build_reference: "run-1",
      },
      timeoutMs: 1000,
    })

    expect(result.top_functions.length).toBeGreaterThan(0)
    expect(result.modules.length).toBeGreaterThan(0)
    expect(result.leak_indicators).toContain("out of memory")
    expect(result.overflow_indicators).toContain("overflow")
  })

  test("enforces timeout fail-open", async () => {
    clearTimeoutSpy = spyOn(globalThis, "clearTimeout")
    const result = await analyzeIncident({
      stderrText: "",
      stdoutText: "",
      crash: {
        exit_code: 0,
        signal: null,
        dump_pointer: null,
        symbol_reference: null,
        build_reference: null,
      },
      timeoutMs: 1,
    })

    expect(typeof result.timed_out).toBe("boolean")
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})

describe("buildIncidentSignature", () => {
  test("is deterministic", () => {
    const input = {
      crashSignal: "SIGABRT",
      exitCode: 134,
      topFunctions: ["foo", "bar"],
      modules: ["liba.so", "libb.so"],
    }

    const first = buildIncidentSignature(input)
    const second = buildIncidentSignature(input)

    expect(first).toBe(second)
  })
})
