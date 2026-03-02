import { describe, expect, test } from "bun:test"
import { createOhMyShitMemoryHook } from "./index"

describe("createOhMyShitMemoryHook", () => {
  test("routes matching commands through runner wrapper and injects env", async () => {
    const hook = createOhMyShitMemoryHook({} as never, {
      enabled: true,
      sampling_interval_ms: 500,
    })

    const output: { args: Record<string, unknown> } = {
      args: {
        command: "xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=iPhone 16'",
      },
    }

    await hook["tool.execute.before"]({ tool: "bash", sessionID: "session-1" }, output)

    expect(output.args.command).toEqual(expect.stringContaining("oh-my-shit-memory-runner"))
    expect(output.args.env).toEqual({
      OH_MY_SHIT_MEMORY_ENABLED: "1",
      OH_MY_SHIT_MEMORY_SAMPLING_MS: "500",
      OH_MY_SHIT_MEMORY_WRAPPED: "1",
    })
  })

  test("does not match false positives in quoted content", async () => {
    const hook = createOhMyShitMemoryHook({} as never, {
      enabled: true,
      sampling_interval_ms: 250,
    })

    const output: { args: Record<string, unknown> } = {
      args: {
        command: "echo 'xcodebuild test'",
      },
    }

    await hook["tool.execute.before"]({ tool: "bash", sessionID: "session-2" }, output)

    expect(output.args.command).toBe("echo 'xcodebuild test'")
    expect(output.args.env).toBeUndefined()
  })

  test("avoids double wrapping when command already wrapped", async () => {
    const hook = createOhMyShitMemoryHook({} as never, {
      enabled: true,
      sampling_interval_ms: 250,
    })

    const alreadyWrappedCommand = "bun run /tmp/oh-my-shit-memory-runner.ts -- bash -lc 'xcrun simctl list'"
    const output: { args: Record<string, unknown> } = {
      args: {
        command: alreadyWrappedCommand,
      },
    }

    await hook["tool.execute.before"]({ tool: "bash", sessionID: "session-3" }, output)

    expect(output.args.command).toBe(alreadyWrappedCommand)
    expect((output.args.env as Record<string, unknown>)?.OH_MY_SHIT_MEMORY_WRAPPED).toBe("1")
  })
})
