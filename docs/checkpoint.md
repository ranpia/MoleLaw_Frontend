# 중간 저장 — 2026-10-23

사용자 요청: “중간 저장하고 잠깐 멈춰줘”. 현재 일시 중지 상태다. 사용자 재개 요청 전 추가 구현·검증을 진행하지 않는다. 커밋·푸시는 하지 않았으며 변경사항은 작업 디렉터리에 저장했다.

## 현재 실행 환경

- 백엔드: 사용자가 Docker로 실행한 http://localhost:8080
- Swagger: http://localhost:8080/swagger-ui.html
- 실제 계약: http://localhost:8080/v3/api-docs
- 실제 서버에는 이전 원격 dev 조사와 달리 evidence 조회와 판례 검색 승인 필드가 있다. 현재 프론트는 실행 서버 기준으로 수정했다.
- Node v24.22.1, npm 11.19.1: C:/Program Files/nodejs. 세션 실행 시 PATH 앞에 이 경로를 추가했다.
- npm 의존성 설치는 도구의 외부 네트워크가 차단되어 사용자가 직접 npm ci를 실행해 완료했다.
- Docker 엔진은 도구에서 접근 권한이 없어 제어하지 못한다. 백엔드는 변경하지 않았다.

## 저장한 구현

- `src/api/client.ts`: 공통 Axios, CSRF JSON 조회·헤더, 401 시 갱신 후 1회 재요청, 갱신 단일 Promise와 Web Locks, 세션 초기화 이벤트, 공통 오류 문구.
- `src/api/validation.ts`: 질문 코드포인트·UTF-8 바이트, 비밀번호 길이·바이트 검증.
- 인증 스토어: users/me·auth/refresh 경로, 가입 후 내 정보 조회, 토큰 상태·계정 변경·탈퇴·로그아웃 처리, any 제거.
- 채팅·데이터 스토어: 새 상담 POST 경로, messages 조회, 근거 조회, 페이지 목록, 세션/방 전환의 오래된 응답 방어, 오류 시 사용자 메시지 복구.
- 화면: 반응형 로그인·가입·계정 설정·사이드바·채팅, 중복 전송 방지·IME Enter 대응·실패 시 입력 유지, 근거 UUID 연결과 원문 읽기, 명시적 판례 검색 승인.
- 스타일: 로컬 Pretendard 사용, 기본 Vite 전역 스타일 교체, 모바일 배치.
- Vite: /api와 OAuth 프록시, 5173 고정, 긴 상담 요청 대기.
- Dockerfile·compose.yaml·.dockerignore·.env.example 작성. Docker 실행 검증 전이다.
- `scripts/verify-local-api.mjs`: 새 임시 계정으로 실제 API 검사 후 삭제. 비밀값을 출력·저장하지 않는다.
- `scripts/browser-check.mjs`: 별도 프로필의 headless Chrome + CDP로 실제 화면과 모의 화면 검사. 검증 스크립트 자체도 아직 정리 중이다.
- `postman/mocks/backend/`, `postman/simulations/frontend.sim.yaml`: 실행 서버 OpenAPI 기반 로컬 모의 계약. Postman은 미로그인이라 소유 팀 mock 검색은 생략했다. 게시하지 않았다.
- `postman/csrf-check.js`: 단일 CSRF 응답 검사.

## 검증 결과와 실패

### 통과

- `npm.cmd run lint`: UI·스토어 변경 당시 통과. 그 뒤 추가한 scripts/postman 파일은 재린트 전이다.
- `npm.cmd run build -- --configLoader runner`: TypeScript와 Vite 프로덕션 빌드 통과. 397 modules, JS 약 474KB.
- `node scripts/verify-local-api.mjs`: 실제 서버 API 19개 검사 통과, 해당 임시 계정 삭제 204 확인.
- API 검사 범위: 미인증 401, CSRF 없는 로그인 403, CSRF JSON, 가입·프로필, 공백 질문 400, 목록 배열, 없는 방 evidence 404, 닉네임 변경·재조회, Refresh, 로그아웃·로그인, 비밀번호 변경·새 비밀번호 로그인, 탈퇴·세션 제거.
- 실제 브라우저: 로그인 화면, 가입 후 인증·프로필, 새로고침 세션 유지, 닉네임 변경, 390px 가로 넘침 없음까지 통과.

### 미해결 / 다음 재개 지점

1. **실제 브라우저 로그아웃이 403**이다. 같은 서버를 향한 Node HTTP 검사에서는 로그아웃이 통과한다. 가입·로그인 뒤 CSRF 캐시 무효화는 구현했다. 브라우저의 최신 CSRF 쿠키/헤더와 로그아웃 요청을 비교해야 한다. 이 오류를 해결하기 전 인증 완료로 보고하지 않는다.
2. **모의 서버 상태 저장 호출을 수정했으나 재실행 전**이다. 첫 실행에서 `pm.state.get()`이 Promise임을 놓쳐 방 목록이 null이었다. 마지막 변경으로 handler를 async로 바꾸고 get/set을 await 처리했다. 중지 요청 직전에 수정했으며 아직 결과를 검증하지 않았다.
3. `npm run build` 기본 설정 로더와 `npm run dev -- --configLoader runner`의 사전 번들링은 esbuild가 상위 폴더에 접근하다 sandbox 권한 오류로 실패한다. 프로덕션 build + preview에 runner를 사용하면 통과한다. 사용자 일반 환경·Docker에서도 같은 문제인지 미확인이다. 이 제한 때문에 프로젝트 기본 스크립트는 임의 변경하지 않았다.
4. 브라우저 검증 스크립트가 고정 디버깅 포트 9223을 사용한다. 이전 Chrome 프로세스와 겹치지 않는지 확인하고, 필요하면 임의 포트·종료 처리를 개선한다. 사용자 Chrome 프로세스를 무차별 종료하지 않는다.
5. 최초 Postman collection 검증은 가입 뒤 CSRF 갱신 누락으로 여러 요청과 정리가 실패했다. 해당 collection은 제거하고 Node 검증 스크립트로 대체했다. **초기 Postman 임시 계정의 삭제는 확인하지 못했다.** 이후 통과한 API 검사의 임시 계정은 삭제 확인했다. 마지막 브라우저 실패 실행도 삭제 확인 로그가 없어 임시 계정 정리를 확인해야 한다. 사용자의 실제 계정이나 prefix 일괄 삭제는 하지 않는다.
6. 실제 AI 정상 질문·후속 답변·근거 본문·판례 검색은 아직 호출해 성공을 확인하지 않았다. 모의 UI 검사도 수정 후 재개해야 한다. 단순 입력 오류 검증은 AI 호출 전에 끝난다.
7. 더 보기의 20개 이상 데이터, 자동 만료 복구·동시 탭, OAuth, Docker 실행은 검증 전이다.
8. 새 테스트 fixture JS의 require/pm 전역과 ESLint 범위를 확인해야 한다. 에러가 있으면 테스트 파일에 맞는 제한된 설정을 추가한다.

## 로컬 산출물과 프로세스

- 무시되는 `.artifacts.local/` 안에 서버 OpenAPI, 생성된 일회성 mock, Chrome 프로필·스크린샷·검증 요약이 있다. 쿠키가 포함될 수 있으므로 커밋하지 않는다.
- 실제 브라우저 첫 검사 산출물: `.artifacts.local/browser-live-1792741307858/` (임시 계정 삭제 확인).
- 모의 첫 실패: `.artifacts.local/browser-simulation-1792741368941/`.
- 실제 브라우저 마지막 실패: `.artifacts.local/browser-live-1792741385327/`.
- 프론트 preview 세션 62108 (5173), 모의용 preview 세션 82233 (5174)은 중지 요청에 따라 종료한다.
- Postman simulation 세션 47153은 이미 Ctrl+C로 종료했다. 마지막 mock 수정 후 재시작하지 않았다.
- 백엔드 Docker 서버는 그대로 둔다.

## 재개 시 권장 순서

1. 작업 트리와 이 문서를 읽고 현재 서버 OpenAPI에 변화가 있는지 확인.
2. 브라우저 로그아웃 403 원인 확인·수정. 실제 인증 흐름과 임시 계정 정리 재검증.
3. Postman simulation 재시작 → mock 프록시 preview → 브라우저 simulation 검사. 요청 로그로 실제 프론트 호출·동의 true/false·422/503·중복 전송·원문 텍스트 처리 확인.
4. 필요한 경우 한 번의 실제 상담 흐름을 별도 임시 계정에서 검증하고 삭제. AI 호출은 비용·시간을 쓰므로 의미 없는 반복 금지.
5. 최종 lint/build, 스크린샷 확인, README와 실행·검증 문서 갱신.
6. Docker 실행은 사용자 환경에서 검증 가능 여부를 확인하고 결과를 명확히 구분.
