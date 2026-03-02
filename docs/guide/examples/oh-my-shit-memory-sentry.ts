import * as Sentry from "@sentry/node"

type IncidentSummary = {
  signature: string
  severity: "low" | "medium" | "high" | "critical"
  repro_priority: "p0" | "p1" | "p2"
}

export function forwardOhMyShitMemoryIncidentToSentry(incident: IncidentSummary): void {
  const level = incident.severity === "critical"
    ? "fatal"
    : incident.severity === "high"
      ? "error"
      : "warning"

  Sentry.captureMessage("oh-my-shit-memory incident", {
    level,
    tags: {
      incident_signature: incident.signature,
      incident_severity: incident.severity,
      repro_priority: incident.repro_priority,
      source: "oh-my-shit-memory",
    },
  })
}
