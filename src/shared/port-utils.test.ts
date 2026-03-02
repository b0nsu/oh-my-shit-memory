import { afterEach, describe, expect, it, mock, spyOn } from "bun:test"
import { DEFAULT_SERVER_PORT, findAvailablePort, getAvailableServerPort, isPortAvailable } from "./port-utils"

function createServeStub() {
  return {
    stop: mock(() => {}),
  } as unknown as ReturnType<typeof Bun.serve>
}

describe("port-utils", () => {
  afterEach(() => {
    mock.restore()
  })

  describe("isPortAvailable", () => {
    it("#given unused port #when checking availability #then returns true", async () => {
      const serveSpy = spyOn(Bun, "serve").mockImplementation(() => createServeStub())

      const result = await isPortAvailable(59999)

      expect(result).toBe(true)
      expect(serveSpy).toHaveBeenCalledTimes(1)
    })

    it("#given port in use #when checking availability #then returns false", async () => {
      const serveSpy = spyOn(Bun, "serve").mockImplementation(() => {
        throw new Error("EADDRINUSE")
      })

      const result = await isPortAvailable(59998)

      expect(result).toBe(false)
      expect(serveSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe("findAvailablePort", () => {
    it("#given start port available #when finding port #then returns start port", async () => {
      const serveSpy = spyOn(Bun, "serve").mockImplementation(() => createServeStub())

      const startPort = 59997
      const result = await findAvailablePort(startPort)

      expect(result).toBe(startPort)
      expect(serveSpy).toHaveBeenCalledTimes(1)
      expect(serveSpy.mock.calls[0]?.[0].port).toBe(startPort)
    })

    it("#given start port blocked #when finding port #then returns next available", async () => {
      const startPort = 59996
      const serveSpy = spyOn(Bun, "serve").mockImplementation((options) => {
        if (options.port === startPort) {
          throw new Error("EADDRINUSE")
        }
        return createServeStub()
      })

      const result = await findAvailablePort(startPort)

      expect(result).toBe(startPort + 1)
      expect(serveSpy).toHaveBeenCalledTimes(2)
      expect(serveSpy.mock.calls[0]?.[0].port).toBe(startPort)
      expect(serveSpy.mock.calls[1]?.[0].port).toBe(startPort + 1)
    })

    it("#given multiple ports blocked #when finding port #then skips all blocked", async () => {
      const startPort = 59993
      const blockedPorts = new Set([startPort, startPort + 1, startPort + 2])
      const serveSpy = spyOn(Bun, "serve").mockImplementation((options) => {
        if (blockedPorts.has(options.port)) {
          throw new Error("EADDRINUSE")
        }
        return createServeStub()
      })

      const result = await findAvailablePort(startPort)

      expect(result).toBe(startPort + 3)
      expect(serveSpy).toHaveBeenCalledTimes(4)
    })
  })

  describe("getAvailableServerPort", () => {
    it("#given preferred port available #when getting port #then returns preferred with wasAutoSelected=false", async () => {
      spyOn(Bun, "serve").mockImplementation(() => createServeStub())

      const preferredPort = 59990
      const result = await getAvailableServerPort(preferredPort)

      expect(result.port).toBe(preferredPort)
      expect(result.wasAutoSelected).toBe(false)
    })

    it("#given preferred port blocked #when getting port #then returns alternative with wasAutoSelected=true", async () => {
      const preferredPort = 59989
      spyOn(Bun, "serve").mockImplementation((options) => {
        if (options.port === preferredPort) {
          throw new Error("EADDRINUSE")
        }
        return createServeStub()
      })

      const result = await getAvailableServerPort(preferredPort)

      expect(result.port).toBe(preferredPort + 1)
      expect(result.wasAutoSelected).toBe(true)
    })
  })

  describe("DEFAULT_SERVER_PORT", () => {
    it("#given constant #when accessed #then returns 4096", () => {
      expect(DEFAULT_SERVER_PORT).toBe(4096)
    })
  })
})
