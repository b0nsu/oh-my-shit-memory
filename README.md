# oh-my-shit-memory

![oh-my-shit-memory constellation hero](assets/readme/constellation-hero.svg)

`oh-my-shit-memory` is a focused fork of `oh-my-opencode` with Linux-first runtime incident instrumentation for build/test workflows.

> A constellation for runtime incident intelligence.

It captures:
- runtime resource samples (RSS/VSZ/CPU/IO/threads/process tree)
- crash pointers and symbol/build references
- incident analysis and triage outputs in JSON + Markdown

## Repository scope

This repository currently includes:
- the `oh-my-shit-memory` feature implementation
- hook integration into the OpenCode plugin lifecycle
- CI artifact upload and deduped incident issue flow
- standalone runner + MCP scripts
- stability fixes for flaky port-dependent tests

## Constellation architecture

![Constellation architecture map for config, hooks, runtime instrumentation, and incident outputs](assets/readme/constellation-system-map.svg)

If you want to extend this README visual language, use the concept guide:
- `docs/branding/constellation-readme-concept.md`

## Quick start

```bash
bun install
bun test
bun run typecheck
bun run build
```

Run instrumentation around any command:

```bash
bun run script/oh-my-shit-memory-runner.ts -- bun test
```

## Key docs

- Guide: `docs/guide/oh-my-shit-memory.md`
- Config reference: `docs/reference/configuration.md` (`oh_my_shit_memory`)
- MCP script: `script/oh-my-shit-memory-mcp.ts`

## Upstream

This work originated from:
- https://github.com/code-yeongyu/oh-my-opencode
