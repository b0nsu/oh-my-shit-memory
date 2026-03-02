import { describe, expect, test } from "bun:test"
import { createTelemetryCollector } from "./collector"

describe("createTelemetryCollector", () => {
  test("emits pre/during/post markers and samples", async () => {
    const collector = createTelemetryCollector({
      command: "bun test",
      samplingIntervalMs: 250,
      memoryLimitBytes: 100 * 1024 * 1024,
      ci: false,
    })

    collector.start()
    await Bun.sleep(300)
    collector.stop()

    const markers = collector.getPhaseMarkers()
    expect(markers.map((marker) => marker.phase)).toEqual(["pre", "during", "post"])

    const samples = collector.getSamples()
    expect(samples.length).toBeGreaterThan(0)
    expect(samples[0]?.rss_bytes).toBeGreaterThanOrEqual(0)
    expect(samples[0]?.vsz_bytes).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(samples[0]?.process_tree)).toBe(true)
  })
})
