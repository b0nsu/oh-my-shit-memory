const SECRET_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-(?:proj-|live-)?[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g,
]

const ASSIGNMENT_SECRET_PATTERNS = [
  /((?:api[_-]?key|token|password)\s*[=:]\s*)(["']?)([^"'\s]+)\2/gi,
  /(authorization\s*:\s*bearer\s+)(["']?)([^"'\s]+)\2/gi,
  /(^|\s)([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY)[A-Z0-9_]*)=(["']?)([^"'\s]+)\3/g,
]

export function maskSensitiveText(input: string, redactedPathPrefixes: string[] = []): string {
  let masked = input

  for (const pattern of SECRET_PATTERNS) {
    masked = masked.replace(pattern, "<redacted>")
  }

  masked = masked.replace(ASSIGNMENT_SECRET_PATTERNS[0], (_match, p1, quote = "") => `${p1}${quote}<redacted>${quote}`)
  masked = masked.replace(ASSIGNMENT_SECRET_PATTERNS[1], (_match, p1, quote = "") => `${p1}${quote}<redacted>${quote}`)
  masked = masked.replace(
    ASSIGNMENT_SECRET_PATTERNS[2],
    (_match, prefixWhitespace = "", variable, quote = "") => `${prefixWhitespace}${variable}=${quote}<redacted>${quote}`,
  )

  // Normalize lingering quoted JWTs or token-like values in auth contexts
  masked = masked.replace(/(["'])<redacted>\1/g, (_match, quote) => `${quote}<redacted>${quote}`)

  // Defense-in-depth: redact common env var names with quoted values after generic replacements
  for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GITHUB_TOKEN"]) {
    const keyPattern = new RegExp(`(${key}\\s*=\\s*)(["']?)([^"'\\s]+)\\2`, "g")
    masked = masked.replace(keyPattern, (_match, p1, quote = "") => `${p1}${quote}<redacted>${quote}`)
  }

  for (const prefix of redactedPathPrefixes) {
    if (!prefix) continue
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    masked = masked.replace(new RegExp(escaped, "g"), "<redacted-path>")
  }

  // Linux-first path masking (avoid exposing home/workspace paths)
  masked = masked.replace(/\/home\/[A-Za-z0-9._-]+\//g, "/home/<redacted>/")
  masked = masked.replace(/\/Users\/[A-Za-z0-9._-]+\//g, "/Users/<redacted>/")

  return masked
}

export function maskJsonValue<T>(value: T, redactedPathPrefixes: string[] = []): T {
  if (typeof value === "string") {
    return maskSensitiveText(value, redactedPathPrefixes) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskJsonValue(item, redactedPathPrefixes)) as T
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = maskJsonValue(item, redactedPathPrefixes)
    }
    return output as T
  }

  return value
}
