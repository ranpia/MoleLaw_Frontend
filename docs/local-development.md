# 로컬 실행과 검증

## 연결 기준

- 백엔드는 별도로 실행: `http://localhost:8080`
- Swagger: `http://localhost:8080/swagger-ui.html`
- OpenAPI: `http://localhost:8080/v3/api-docs`
- 프론트: `http://localhost:5173`
- 권장 Node: 24 LTS. 확인한 버전은 Node 24.22.1 / npm 11.19.1이다.

## 호스트에서 실행

프론트 디렉터리의 PowerShell에서:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run dev
```

기본 설정으로 localhost:8080에 연결되므로 `.env`를 만들 필요가 없다. 변경할 값이 있으면 `.env.example`을 `.env.local`로 복사해서 조정한다.

- `VITE_API_BASE_URL=/api`: 브라우저가 사용하는 API 경로. `/api`를 중복해서 붙이지 않는다.
- `VITE_OAUTH2_BASE_URL=/oauth2/authorization`: 소셜 로그인 진입 경로.
- `API_PROXY_TARGET=http://localhost:8080`: Vite 서버에서 접근하는 백엔드 주소.

브라우저는 같은 출처의 `/api`를 호출하고 Vite가 백엔드로 전달한다. `/oauth2`, `/login/oauth2`도 프록시한다. 브라우저 쿠키는 포트가 아니라 호스트 기준으로 공유되므로 `localhost`와 `127.0.0.1`을 혼용하지 않는다.

이 프로젝트의 API 클라이언트는 상태 변경 요청 전에 `/auth/csrf` JSON을 조회해 헤더를 설정한다. CSRF 쿠키를 직접 읽지 않으며 Axios의 자동 쿠키 기반 헤더 주입은 끈다. 401에는 공유 갱신 작업으로 복구 후 한 번만 다시 요청한다. 전송 결과를 알 수 없는 네트워크 실패나 Refresh 자체는 자동 재시도하지 않는다.

## 프론트도 Docker로 실행

사용자가 실행한 백엔드는 그대로 두고, 프론트 디렉터리에서:

```powershell
docker compose up --build -d
docker compose logs -f frontend
```

브라우저에서 `http://localhost:5173`을 연다. Compose는 프론트 컨테이너에서 `http://host.docker.internal:8080`으로 접근하도록 설정했다. 컨테이너의 localhost는 호스트 백엔드가 아니다.

현재 Dockerfile은 Vite 개발 서버를 제공한다. 소스 bind mount는 없으므로 소스 변경 후 다시 `docker compose up --build -d`를 실행한다. 호스트에서 Vite를 실행 중이면 같은 5173 포트를 쓰는 프로세스를 먼저 종료한다.

```powershell
docker compose down
```

이 명령은 이 프론트 Compose 서비스만 내린다. 백엔드 설정·컨테이너는 변경하지 않는다. 2026-10-26 `docker compose up --build -d frontend`로 이미지 빌드·컨테이너 기동을 확인했고, `http://localhost:5173`에서 HTTP 200 응답을 확인했다. 로그인·채팅 등 전체 기능 연동은 별도 검증이 필요하다.

OAuth는 공급자에 등록된 callback과 백엔드의 로그인 완료 리디렉션 주소가 실제 로컬 주소와 맞아야 한다. 현재 소셜 로그인 전체 흐름은 미검증이다. 프록시 설정만으로 공급자의 등록 주소가 바뀌지는 않는다.

## 빌드와 API 검증

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run verify:api
```

`verify:api`는 실제 서버에 무작위 임시 계정을 만들고 계정·인증·입력 검증 19개를 확인한 뒤 해당 계정만 삭제한다. 기본 검사에는 실제 AI 요청이 없다. 다른 서버는 환경변수 `API_URL`로 지정한다.

실제 검색·AI·근거 조회·후속 질문까지 한 번 검증하려면:

```powershell
node scripts/verify-local-api.mjs --consultation
```

이 옵션은 외부 모델·검색 비용과 긴 처리 시간을 발생시킨다. 요청을 자동 재시도하지 않는다. 실패하면 종료 코드와 서버 오류 코드를 확인하고, 프론트 화면 검사와 실제 AI 응답 성공을 구분한다.

작업 도구의 Windows sandbox에서는 esbuild의 상위 디렉터리 탐색이 거부됐다. 그 환경에서 확인한 빌드·미리보기 명령은 다음과 같다. 일반 사용자 환경에서도 같은 제한이 있을 때만 사용한다.

```powershell
npm.cmd run build -- --configLoader runner
npm.cmd run preview -- --host 127.0.0.1 --port 5173 --strictPort --configLoader runner
```

개발 서버의 사전 번들링도 같은 제한을 받을 수 있다. 이 경우 위 빌드 결과의 preview로 검증한다.

## 실제 브라우저 검사

5173에서 프론트를 실행하고 백엔드가 켜진 상태에서:

```powershell
npm.cmd run verify:browser
```

Windows Chrome을 별도 임시 프로필로 실행한다. 기본 실행 파일은 `C:/Program Files/Google/Chrome/Application/chrome.exe`이며 다른 환경은 `CHROME_PATH`를 설정한다. 매 실행마다 전용 DevTools 포트를 사용하고 생성한 테스트 브라우저만 종료한다.

가입, 세션 유지, Access 쿠키 제거 후 복구, 프로필 변경, 모바일 화면, 로그아웃·재로그인을 검사하고 만든 계정을 삭제한다. 사용자 Chrome 프로필은 사용하지 않는다.

## 비용 없는 채팅 화면 검사

Postman CLI 1.74.0에서 확인했다. 미로그인 상태라 소유 팀 mock을 가져오지 않았으며 실행 서버 OpenAPI에 근거한 로컬 fixture를 사용한다. 게시·배포하지 않는다.

첫 번째 터미널:

```powershell
postman simulation run postman/simulations/frontend.sim.yaml --port 4900 --no-history --output ndjson
```

두 번째 터미널:

```powershell
$env:API_PROXY_TARGET = 'http://127.0.0.1:4900/backend'
npm.cmd run preview -- --host 127.0.0.1 --port 5174 --strictPort --configLoader runner
```

세 번째 터미널:

```powershell
npm.cmd run verify:simulation
```

상담 목록 페이지, 근거 UUID·본문, HTML 원문의 텍스트 표시, 판례 검색 승인·거절, 동의 재사용 방지, 이중 전송, 422·503, 모바일 너비와 JS 예외를 검사한다. 같은 테스트를 반복하려면 simulation을 종료 후 다시 실행해 fixture 상태를 초기화한다.

이 결과는 실제 프론트가 모의 HTTP API를 호출한 결과다. 실제 AI의 답변 품질이나 외부 판례 수집 성공을 입증하지 않는다. simulation 로그에는 요청 이벤트가 있어야 한다.

단일 실제 CSRF 계약도 로컬에서 검사할 수 있다:

```powershell
postman request http://localhost:8080/api/auth/csrf --no-report-events --script-post-request '@postman/csrf-check.js'
```

## 산출물

최초·후속 NDJSON 실제 브라우저 검증: `npm.cmd run verify:ndjson` (5173 포트 프론트와 8080 백엔드 필요). 별도 임시 계정으로 실제 AI를 호출하고 검증 후 삭제한다. 스트림 파서·답변 표시 속도의 모의 검증은 `npm.cmd run verify:stream`으로 실행한다. 기존 Postman simulation은 JSON 채팅 계약 기준이므로 NDJSON fixture 갱신 전이다.

브라우저 프로필·스크린샷·요약은 Git에서 제외한 `.artifacts.local/`에 저장한다. 인증 쿠키가 있을 수 있으므로 커밋하거나 공유하지 않는다. 비밀값은 `VITE_*` 환경변수에 넣지 않는다. 이번 변경과 검증 결과는 [현황 문서](frontend-plan.md)에 기록한다.

## 이름·비밀번호 변경 화면 검사

위 Postman simulation과 5174 프론트를 새로 실행한 뒤 node scripts/browser-check.mjs account로 확인한다. 실행할 때마다 fixture 비밀번호가 바뀌므로 재검사 전 simulation을 다시 시작한다. 이 검사는 모의 서버 대상이며 실제 사용자 계정은 변경하지 않는다.

## 최초 질문 다듬기 실험

`experiment/initial-question-suggestions` 브랜치에서 새 상담의 **질문 다듬기**로 추천을 요청하고 채팅 영역에 표시된 추천 말풍선을 누르면 바로 질문을 전송한다. 추천 생성에는 모델 호출이 발생할 수 있지만 상담방은 아직 생성하지 않는다. **원문으로 질문**은 기존 최초 NDJSON을 바로 사용한다.

실제 서버 추천 검사(임시 계정 생성·삭제, 실제 모델 1회 포함): `node scripts/verify-local-api.mjs --suggestions`.
모의 브라우저 검사: Postman simulation과 5174 프론트를 새로 실행하고 `node scripts/browser-check.mjs suggestions`를 실행한다. 첫·후속 스트림은 테스트용 확정 응답이며 실제 AI 상담·검색 품질을 검증하지 않는다.

## 판례 검색 시 법령 선택

판례 검색 승인 카드에서 같은 상담방의 법령을 선택할 수 있다. 기본 선택은 없고 개수 제한도 없다. 선택하지 않으면 기존 질문만으로 검색한다. 선택한 법령은 이번 승인에만 사용한다.

Postman simulation과 5174 프론트를 새로 실행한 뒤 `node scripts/browser-check.mjs cases`로 법령 다중 선택·미선택 승인·동의 미승계를 검사한다. 실제 서버의 입력 검증은 `npm.cmd run verify:api`에 포함되며 외부 판례 검색은 호출하지 않는다.

## 실시간 근거와 삭제

스트림 중 PREVIEW 근거는 저장 전 미리보기다. 본문 조회는 저장 후에만 가능하다. 미리보기에서 제외한 근거가 상담 완료 후 실제 저장 목록에 남으면 그때 DELETE하고 목록을 재조회한다. 이미 진행 중인 답변에는 소급 적용하지 않는다. 상담 실패 시 제외 예약을 버린다.

저장된 근거는 생성이 끝난 뒤 삭제 확인을 거쳐 제거하며 기존 대화는 유지한다. SAVED를 받은 뒤 completed 전에 연결이 끊기면 POST를 재전송하지 않고 저장된 메시지·근거를 GET으로 복구한다.

모의 검사: simulation·5174 프론트를 각각 새로 실행한 상태에서 `node scripts/browser-check.mjs evidence` 또는 `node scripts/browser-check.mjs evidence-recovery`를 실행한다. 실제 서버의 `node scripts/browser-check.mjs ndjson`은 AI 상담을 한 번씩 실행하고 저장 근거 삭제까지 확인한 뒤 임시 계정을 삭제한다.
