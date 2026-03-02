import { describe, expect, test } from "bun:test"
import { maskJsonValue, maskSensitiveText } from "./masker"

describe("maskSensitiveText", () => {
  test("redacts common token formats", () => {
    const masked = maskSensitiveText(
      "token=abc123 api_key='secret-value' OPENAI_API_KEY=\"sk-proj-abcdefghijklmnopqrstuvwxyz123456\" Authorization: Bearer \"eyJabc.def.ghi\" ghp_abcdefghijklmnopqrstuvwxyz ghs_abcdefghijklmnopqrstuvwxyz github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    )
    expect(masked).toContain("token=<redacted>")
    expect(masked).toContain("api_key='<redacted>'")
    expect(masked).toContain("OPENAI_API_KEY=\"<redacted>\"")
    expect(masked).toContain("Authorization: Bearer \"<redacted>\"")
    expect(masked).not.toContain("secret-value")
    expect(masked).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz")
    expect(masked).not.toContain("ghs_abcdefghijklmnopqrstuvwxyz")
    expect(masked).not.toContain("github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456")
    expect(masked).not.toContain("eyJabc.def.ghi")
  })

  test("redacts configured path prefixes", () => {
    const masked = maskSensitiveText("/tmp/workspace/project/src", ["/tmp/workspace"])
    expect(masked).toContain("<redacted-path>")
  })

  test("redacts macOS home paths and bearer tokens", () => {
    const masked = maskSensitiveText("Authorization: Bearer super-secret-token /Users/alice/project")
    expect(masked).toContain("Authorization: Bearer <redacted>")
    expect(masked).toContain("/Users/<redacted>/")
    expect(masked).not.toContain("super-secret-token")
    expect(masked).not.toContain("/Users/alice/")
  })
})

describe("maskJsonValue", () => {
  test("masks nested object fields", () => {
    const output = maskJsonValue({ nested: { token: "token=abc" } })
    expect(output).toEqual({ nested: { token: "token=<redacted>" } })
  })
})
