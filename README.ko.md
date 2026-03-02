# oh-my-shit-memory

`oh-my-shit-memory`는 `oh-my-opencode`에서 파생된 포크로, 빌드/테스트 워크플로우를 위한 런타임 인시던트 계측 기능에 집중합니다.

수집 항목:
- 런타임 리소스 샘플(RSS/VSZ/CPU/IO/스레드/프로세스 트리)
- 크래시 포인터 + 심볼/빌드 참조
- JSON/Markdown 형태의 인시던트 분석 및 트리아지 리포트

## 이 레포의 범위

현재 이 레포에는 아래가 포함됩니다:
- `oh-my-shit-memory` 기능 구현
- OpenCode 플러그인 훅 라이프사이클 통합
- CI 아티팩트 업로드 + 중복 제거 이슈 생성 흐름
- standalone runner + MCP 스크립트
- 포트 의존 flaky 테스트 안정화

## 빠른 시작

```bash
bun install
bun test
bun run typecheck
bun run build
```

아무 명령이든 계측 래퍼로 실행:

```bash
bun run script/oh-my-shit-memory-runner.ts -- bun test
```

## 주요 문서

- 가이드: `docs/guide/oh-my-shit-memory.md`
- 설정 레퍼런스: `docs/reference/configuration.md` (`oh_my_shit_memory`)
- MCP 스크립트: `script/oh-my-shit-memory-mcp.ts`

## 업스트림

원본 프로젝트:
- https://github.com/code-yeongyu/oh-my-opencode
