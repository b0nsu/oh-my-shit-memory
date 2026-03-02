#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

type DedupeStore = Record<string, string>

function readStore(path: string): DedupeStore {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, "utf8")) as DedupeStore
  } catch {
    return {}
  }
}

function shouldCreateIssue(lastCreatedAt: string | undefined, now: Date): boolean {
  if (!lastCreatedAt) return true
  const diffMs = now.getTime() - new Date(lastCreatedAt).getTime()
  return diffMs >= 24 * 60 * 60 * 1000
}

export function getSignatureMarker(signature: string): string {
  return `<!-- oh-my-shit-memory-signature:${signature} -->`
}

type GithubIssue = { html_url?: string; body?: string | null; title?: string }

export async function findExistingIssueBySignature(args: {
  owner: string
  repo: string
  token: string
  signature: string
}): Promise<GithubIssue | null> {
  const query = encodeURIComponent(`repo:${args.owner}/${args.repo} is:issue "${args.signature}" in:body`)
  const response = await fetch(`https://api.github.com/search/issues?q=${query}&per_page=20`, {
    headers: {
      Authorization: `Bearer ${args.token}`,
      Accept: "application/vnd.github+json",
    },
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as { items?: GithubIssue[] }
  const marker = getSignatureMarker(args.signature)
  const existing = (payload.items ?? []).find((item) => item.body?.includes(marker))
  return existing ?? null
}

function usage(): never {
  console.error("Usage: bun run script/oh-my-shit-memory-issue.ts <signature> <title> <body-file>")
  process.exit(2)
}

async function main() {
  const [signature, title, bodyFile] = process.argv.slice(2)
  if (!signature || !title || !bodyFile) usage()

  const dedupePath = process.env.OH_MY_SHIT_MEMORY_DEDUPE_PATH ?? ".oh-my-shit-memory/signature-dedupe.json"
  const store = readStore(dedupePath)

  const now = new Date()
  if (!shouldCreateIssue(store[signature], now)) {
    console.log(`[oh-my-shit-memory] dedupe skip for signature=${signature}`)
    return
  }

  const body = readFileSync(bodyFile, "utf8")
  const bodyWithSignature = `${body}\n\n${getSignatureMarker(signature)}`
  const owner = process.env.GITHUB_REPOSITORY?.split("/")[0]
  const repo = process.env.GITHUB_REPOSITORY?.split("/")[1]

  if (!owner || !repo || !process.env.GITHUB_TOKEN) {
    console.log("[oh-my-shit-memory] missing GitHub context/token, writing pending issue payload only")
    mkdirSync(dirname(".oh-my-shit-memory/pending-issue.md"), { recursive: true })
    writeFileSync(".oh-my-shit-memory/pending-issue.md", `# ${title}\n\n${bodyWithSignature}`)
  } else {
    const existing = await findExistingIssueBySignature({
      owner,
      repo,
      token: process.env.GITHUB_TOKEN,
      signature,
    })
    if (existing) {
      console.log(`[oh-my-shit-memory] dedupe skip, existing issue: ${existing.html_url ?? "unknown-url"}`)
      store[signature] = now.toISOString()
      mkdirSync(dirname(dedupePath), { recursive: true })
      writeFileSync(dedupePath, JSON.stringify(store, null, 2))
      return
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: bodyWithSignature,
        labels: ["bug", "oh-my-shit-memory", "needs-triage"],
      }),
    })

    if (!response.ok) {
      const payload = await response.text()
      console.error(`[oh-my-shit-memory] issue creation failed: ${response.status} ${payload}`)
      process.exit(1)
    }

    const payload = (await response.json()) as { html_url?: string }
    console.log(`[oh-my-shit-memory] created issue: ${payload.html_url ?? "unknown-url"}`)
  }

  store[signature] = now.toISOString()
  mkdirSync(dirname(dedupePath), { recursive: true })
  writeFileSync(dedupePath, JSON.stringify(store, null, 2))
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[oh-my-shit-memory] issue helper error: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(0)
  })
}
