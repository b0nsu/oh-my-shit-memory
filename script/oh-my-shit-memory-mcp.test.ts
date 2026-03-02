import { describe, expect, test } from "bun:test"
import { createMergedEnv, isAllowedCommand, isAllowedInvocation, isUnsafeModeEnabled } from "./oh-my-shit-memory-mcp"

describe("oh-my-shit-memory-mcp security helpers", () => {
  test("uses allowlist for command execution by default", () => {
    expect(isAllowedCommand("xcodebuild")).toBe(true)
    expect(isAllowedCommand("xcrun")).toBe(true)
    expect(isAllowedCommand("BUN")).toBe(false)
    expect(isAllowedCommand("/usr/bin/xcrun")).toBe(false)
    expect(isAllowedCommand("./npm")).toBe(false)
    expect(isAllowedCommand("bash")).toBe(false)
  })

  test("applies invocation policy for risky executables", () => {
    expect(isAllowedInvocation("bun", ["test"])).toBe(true)
    expect(isAllowedInvocation("bun", ["run", "build"])).toBe(true)
    expect(isAllowedInvocation("bun", ["run", "-e", "process.exit(0)"])).toBe(false)
    expect(isAllowedInvocation("npm", ["run", "typecheck"])).toBe(true)
    expect(isAllowedInvocation("npm", ["exec", "bash"])).toBe(false)
    expect(isAllowedInvocation("xcrun", ["simctl", "list", "devices"])).toBe(true)
    expect(isAllowedInvocation("xcrun", ["xctrace"])).toBe(false)
    expect(isAllowedInvocation("docker", ["run", "alpine", "sh"])).toBe(false)
  })

  test("filters env pass-through in safe mode", () => {
    const merged = createMergedEnv(
      {
        PATH: "/tmp/path",
        SECRET_TOKEN: "should-not-pass",
        OH_MY_SHIT_MEMORY_SAMPLING_MS: "250",
      },
      {
        PATH: "/usr/bin",
        HOME: "/Users/alice",
        SECRET_TOKEN: "abc",
      } as NodeJS.ProcessEnv,
    )

    expect(merged.PATH).toBe("/usr/bin")
    expect(merged.HOME).toBe("/Users/alice")
    expect(merged.OH_MY_SHIT_MEMORY_SAMPLING_MS).toBe("250")
    expect(merged.SECRET_TOKEN).toBeUndefined()
  })

  test("allows full env pass-through in unsafe mode", () => {
    const merged = createMergedEnv(
      {
        EXTRA: "yes",
      },
      {
        OH_MY_SHIT_MEMORY_MCP_ALLOW_UNSAFE: "1",
        SECRET_TOKEN: "abc",
      } as NodeJS.ProcessEnv,
    )

    expect(isUnsafeModeEnabled({ OH_MY_SHIT_MEMORY_MCP_ALLOW_UNSAFE: "1" } as NodeJS.ProcessEnv)).toBe(true)
    expect(merged.SECRET_TOKEN).toBe("abc")
    expect(merged.EXTRA).toBe("yes")
  })
})
