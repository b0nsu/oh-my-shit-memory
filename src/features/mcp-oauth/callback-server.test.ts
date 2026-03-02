import { afterEach, describe, expect, it, mock, spyOn } from "bun:test"
import { startCallbackServer, type CallbackServer } from "./callback-server"

type ServeOptions = Parameters<typeof Bun.serve>[0]

function createServeHarness(args?: { blockedPorts?: Set<number> }) {
  let callbackFetch: ServeOptions["fetch"] | null = null
  const stopMock = mock(() => {})

  const serveSpy = spyOn(Bun, "serve").mockImplementation((options) => {
    const blockedPorts = args?.blockedPorts ?? new Set<number>()
    if (blockedPorts.has(options.port)) {
      throw new Error("EADDRINUSE")
    }

    if (options.fetch.length > 0) {
      callbackFetch = options.fetch
      return {
        stop: stopMock,
      } as unknown as ReturnType<typeof Bun.serve>
    }

    return {
      stop: mock(() => {}),
    } as unknown as ReturnType<typeof Bun.serve>
  })

  const getCallbackFetch = () => {
    if (!callbackFetch) {
      throw new Error("callback fetch handler was not captured")
    }
    return callbackFetch
  }

  return {
    serveSpy,
    stopMock,
    getCallbackFetch,
  }
}

describe("startCallbackServer", () => {
  let server: CallbackServer | null = null

  afterEach(() => {
    server?.close()
    server = null
    mock.restore()
  })

  it("starts server and returns port", async () => {
    createServeHarness()

    server = await startCallbackServer(19877)

    expect(server.port).toBe(19877)
    expect(typeof server.waitForCallback).toBe("function")
    expect(typeof server.close).toBe("function")
  })

  it("resolves callback with code and state from query params", async () => {
    const harness = createServeHarness()
    server = await startCallbackServer(19877)

    const callbackFetch = harness.getCallbackFetch()
    const callbackRequest = new Request("http://127.0.0.1:19877/oauth/callback?code=test-code&state=test-state")

    const [result, response] = await Promise.all([
      server.waitForCallback(),
      callbackFetch(callbackRequest),
    ])

    expect(result).toEqual({ code: "test-code", state: "test-state" })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain("Authorization successful")
  })

  it("returns 404 for non-callback routes", async () => {
    const harness = createServeHarness()
    server = await startCallbackServer(19877)

    const callbackFetch = harness.getCallbackFetch()
    const response = await callbackFetch(new Request("http://127.0.0.1:19877/other"))

    expect(response.status).toBe(404)
  })

  it("returns 400 and rejects when code is missing", async () => {
    const harness = createServeHarness()
    server = await startCallbackServer(19877)
    const callbackRejection = server.waitForCallback().catch((error: Error) => error)

    const callbackFetch = harness.getCallbackFetch()
    const response = await callbackFetch(new Request("http://127.0.0.1:19877/oauth/callback?state=s"))

    expect(response.status).toBe(400)
    const error = await callbackRejection
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain("missing code or state")
  })

  it("returns 400 and rejects when state is missing", async () => {
    const harness = createServeHarness()
    server = await startCallbackServer(19877)
    const callbackRejection = server.waitForCallback().catch((error: Error) => error)

    const callbackFetch = harness.getCallbackFetch()
    const response = await callbackFetch(new Request("http://127.0.0.1:19877/oauth/callback?code=c"))

    expect(response.status).toBe(400)
    const error = await callbackRejection
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain("missing code or state")
  })

  it("close stops the server immediately", async () => {
    const harness = createServeHarness()
    server = await startCallbackServer(19877)

    server.close()
    server = null

    expect(harness.stopMock).toHaveBeenCalled()
  })

  it("selects the next available port when preferred port is blocked", async () => {
    createServeHarness({ blockedPorts: new Set([19877]) })

    server = await startCallbackServer(19877)

    expect(server.port).toBe(19878)
  })
})
