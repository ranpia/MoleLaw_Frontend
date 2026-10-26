# MoleLaw 프론트 작업 지침

## 작업 범위

- 모든 파일 생성·수정과 실행 환경 구성은 이 프론트 프로젝트 안에서만 진행한다.
- 백엔드는 API와 동작을 확인하기 위한 읽기 전용 참조 대상이다. 백엔드 파일 수정, checkout, pull, 빌드, 컨테이너 설정 변경은 하지 않는다.
- 프론트 구조 파악·백엔드 대조 이후 API·인증·채팅·화면·로컬 Docker 설정을 수정 중이다. 2026-10-23 사용자 요청으로 중간 저장 후 일시 중지했다. 재개 전 [중간 저장](docs/checkpoint.md)을 먼저 읽는다.
- 현황, 확인 근거, 단계별 계획은 [작업 현황과 계획](docs/frontend-plan.md)에 기록한다. 후속 작업 완료 시 해당 문서를 갱신한다.

## 프로젝트 구조

- React 19 + TypeScript 5.8 + Vite 6 기반 SPA.
- Emotion 스타일, Zustand 상태 관리, Axios HTTP 요청, React Router 라우팅.
- `src/App.tsx`: 인증 확인, 로그인 패널, 토큰 갱신.
- `src/Views/MainView.tsx`: 메인 채팅 화면과 전송 흐름.
- `src/Components/Layout/`: 배경과 사이드바.
- `src/Components/Feature/`: 채팅, 로그인·회원가입, 프로필, 설정·탈퇴.
- `src/Components/UI/`: 공통 입력, 토스트, 애니메이션.
- `src/api/`: 인증·채팅 API, NDJSON 수신, 서버 타입과 환경설정.
- `src/store/`: 인증·대화·메시지 상태와 작업 흐름. API 모듈을 호출한다.
- `src/style/`, `public/`: 공통 스타일과 정적 자산.

## 백엔드 참조 기준

- 원격: https://github.com/ranpia/MoleLaw_backend.git
- 사용자가 최신 기준으로 지정한 브랜치: `dev`.
- 마지막 원격 확인: 2026-10-23, 커밋 `0eedbb12481b3713f47d25a37ac669bbc5d0515c`.
- 로컬 참조 경로: `C:/Users/KOSA/IdeaProjects/MoleLaw_backend`.
- 로컬 백엔드와 원격 `dev`는 서로 다르다. 로컬에서 발견한 기능을 원격 `dev`의 계약으로 간주하지 않는다.
- 사용자가 실행한 실제 서버 `http://localhost:8080`의 `/v3/api-docs`를 확인했다. 이전 원격 커밋보다 기능이 추가되어 있으므로 현재 구현은 이 실행 서버 계약을 기준으로 한다.
- 실행 서버에는 근거 목록·본문 조회 API, `caseSearchRequested` 응답, `allowCaseSearch` 요청 필드가 실제 존재한다. 원격 조사 시의 부재 기록과 혼동하지 않는다.

## 실행 환경 방향

- 사용자가 백엔드를 Docker로 실행했다. API는 `http://localhost:8080`, Swagger는 `http://localhost:8080/swagger-ui.html`이다. 2026-10-26 프론트 Docker 이미지 재빌드·기동과 5173의 HTTP 200을 확인했다.
- 프론트 Docker 관련 파일도 이 프로젝트 안에 둔다. 백엔드 Docker 파일은 변경하지 않는다.
- Vite 개발·미리보기 서버는 5173에서 `/api`, `/oauth2`, `/login/oauth2`를 백엔드로 프록시한다. 호스트 기본 target은 localhost:8080, Compose에서는 host.docker.internal:8080이다.
- 브라우저가 사용하는 주소와 컨테이너 내부 주소를 구분한다. OAuth 경로도 실제 설정을 확인한다.
- 인증 쿠키·CORS·CSRF를 백엔드 계약에 맞춘다. 연동 편의를 위해 보안 정책을 임의로 해제하지 않는다.
- 비밀값을 커밋하거나 로그에 출력하지 않는다. 환경변수 예시는 실제 비밀값 없이 작성한다.

## 검증과 보고

- 제공 스크립트: `npm run build`, `npm run lint`, `npm run dev`, `npm run preview`.
- Node v24.22.1, npm 11.19.1 설치 완료. 이 세션 PATH에는 미반영이므로 명령 실행 시 `C:/Program Files/nodejs`를 PATH에 추가했다. 사용자가 npm ci를 완료했다.
- 2026-10-24 구조 정리 이후 `npm.cmd run build -- --configLoader runner`, lint, `npm.cmd run verify:stream` 통과. 기본 config loader와 개발 사전 번들링은 이전 제한 환경에서 실패한 기록이 있다.
- 실제 API 19개 검사 이력과 최초·후속 NDJSON 실제 브라우저 검사 통과. 3000 포트에서 로그아웃·재로그인·쿠키 누락 갱신·프로필 검증도 통과했다. 2026-10-26에는 5173 Docker 기동과 사용자 수동 인증·후속 NDJSON 정상 동작 확인을 완료했다. 기존 Postman 모의 fixture의 NDJSON 전환은 남아 있다. 상세 결과는 `docs/frontend-plan.md` 참조.
- 변경 범위에 맞춰 검증하고, 소스 대조·모의 검증·실제 서버 연동 결과를 구분해 보고한다.
- API 작업 시 세션에서 제공되는 Postman 스킬 지침을 따른다. 소스 비교만을 위해 불필요한 워크스페이스 생성이나 게시를 하지 않는다.
