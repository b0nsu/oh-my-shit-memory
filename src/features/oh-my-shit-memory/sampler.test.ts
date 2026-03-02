import { describe, expect, test } from "bun:test"
import { parseProcStatLine } from "./sampler"

describe("parseProcStatLine", () => {
  test("parses stat lines when comm contains spaces and parentheses", () => {
    const parsed = parseProcStatLine(
      "1234 (Runner (iOS) Worker) R 456 1 1 0 -1 4194560 100 0 0 0 200 50 0 0 20 0 1 0 1000 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0",
    )

    expect(parsed.pid).toBe(1234)
    expect(parsed.ppid).toBe(456)
    expect(parsed.utimeTicks).toBe(200)
    expect(parsed.stimeTicks).toBe(50)
  })
})
