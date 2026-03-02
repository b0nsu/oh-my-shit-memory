# README 별자리 컨셉 가이드

이 문서는 `oh-my-shit-memory` README를 별자리(컨스텔레이션) 콘셉트로 정리하기 위한 비주얼/카피 기준안입니다.
벤치마킹 기준은 [`code-yeongyu/oh-my-opencode`](https://github.com/code-yeongyu/oh-my-opencode) 저장소의 구조적 설명 방식과 모듈 중심 소개 스타일입니다.

## 1) 핵심 콘셉트

- **메타포:** 런타임 인시던트 데이터를 "밤하늘의 별"로 표현
- **메시지:** 흩어진 오류 신호를 연결해 "진단 가능한 별자리"로 만든다
- **톤:** 공학적 + 관측 장비 느낌 (관측/기록/추적)
- **차별점:** 단순 모니터링이 아닌 "사건 복원(incident reconstruction)"에 초점

## 2) README 섹션 구성 제안

1. **Hero 배너**
   - 프로젝트명 + 태그라인
   - "Benchmark-inspired by oh-my-opencode" 텍스트를 배너 하단에 작게 표기
2. **What this constellation tracks**
   - RSS/VSZ/CPU/IO/threads/process tree
   - crash pointers + symbols + build references
   - JSON/Markdown triage outputs
3. **Constellation architecture map**
   - Config → Managers → Tools → Hooks → Plugin Interface
   - Runtime → Incident engine → Output artifacts
4. **Quick start**
5. **Docs / Upstream links**

## 3) 비주얼 에셋

- Hero 이미지: `assets/readme/constellation-hero.svg`
- 구조도 이미지: `assets/readme/constellation-system-map.svg`

둘 다 SVG라서 README에서 선명도를 유지하고, 다크/라이트 테마에서도 대비가 유지되도록 채도와 명도를 조절했습니다.

## 4) 컬러 팔레트

- Deep Space Navy: `#090A1F`
- Cosmic Indigo: `#11193E`
- Nebula Purple: `#1B1040`
- Starlight Cyan: `#5DE0FF`
- Orbit Blue: `#8B9CFF`
- Signal Magenta: `#E48CFF`
- Text Primary: `#DDE6FF`
- Text Secondary: `#9CB3E4`

## 5) 카피 문구 제안

- Tagline A: **A Constellation for Runtime Incident Intelligence**
- Tagline B: **Turn noisy crashes into navigable star maps**
- Tagline C: **Observe, connect, and explain runtime failures**

## 6) AI 이미지 확장용 프롬프트 (선택)

필요 시 README OG 이미지나 docs 표지 이미지를 추가 생성할 때 사용할 프롬프트입니다.

```text
A dark-space engineering poster for a developer tool called "oh-my-shit-memory",
constellation lines connecting glowing stars,
labels for runtime metrics (RSS, CPU, IO, threads),
incident analysis dashboard feeling,
clean typography area for title,
gradient colors: cyan, indigo, violet,
minimal, technical, high contrast, no characters, no logo parody.
```

## 7) 적용 시 체크리스트

- README 최상단에 Hero 이미지 노출
- 구조도는 "Repository scope" 또는 "How it works" 바로 아래 배치
- 배너 alt 텍스트를 기능 요약 중심으로 작성
- 기존 Quick start / Key docs / Upstream 링크는 유지
