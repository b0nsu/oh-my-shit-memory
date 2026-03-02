import { afterEach, describe, expect, mock, test } from "bun:test"
import { findExistingIssueBySignature, getSignatureMarker } from "./oh-my-shit-memory-issue"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("findExistingIssueBySignature", () => {
  test("returns matching issue when signature marker exists in body", async () => {
    const signature = "sig-123"
    const marker = getSignatureMarker(signature)

    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          items: [
            { html_url: "https://example.com/1", body: "unrelated" },
            { html_url: "https://example.com/2", body: `details\n${marker}` },
          ],
        }),
        { status: 200 },
      )
    }) as typeof fetch

    const existing = await findExistingIssueBySignature({
      owner: "acme",
      repo: "repo",
      token: "token",
      signature,
    })

    expect(existing?.html_url).toBe("https://example.com/2")
  })
})
