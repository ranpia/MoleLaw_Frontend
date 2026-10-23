# 프론트 작업 현황과 계획

기록일: 2026-10-23 (Asia/Seoul)

> 후속 구현을 진행하다 사용자 요청으로 일시 중지했다. **현재 상태와 미해결 오류는 [중간 저장](checkpoint.md)이 최신**이다. 아래 조사 내용은 당시 원격 커밋 기준의 기록이며, 현재 실행 서버의 계약과 차이가 있다.

## 사용자 요청과 현재 상태

1. 프론트와 백엔드가 있는 MoleLaw 프로젝트에서 프론트 작업을 담당한다.
2. 백엔드를 참조하되 모든 파일 작업은 프론트 프로젝트 안에서만 한다.
3. 변경된 백엔드에 맞추기 전에 프론트 구조를 파악한다.
4. GitHub `ranpia/MoleLaw_backend`의 `dev`와 현재 프론트를 비교한다.
5. 프론트와 백엔드 모두 로컬 Docker 실행을 고려한다.
6. 현재까지 상황과 작업 계획을 문서로 저장한다.

현재 완료한 작업은 프론트 소스 조사, 원격 백엔드 API 대조, 이 문서와 AGENTS.md 작성이다. 앱 코드·환경·배포 설정은 변경하지 않았다. Docker 실행·빌드·린트·실제 API 요청 검증은 하지 않았다.

## 프론트 구조와 화면 흐름

- 기술: React 19.1, TypeScript 5.8, Vite 6, Emotion, Zustand, Axios, React Router 7, react-markdown.
- `main.tsx` → `App.tsx` → 인증 처리와 Router → `/Main`의 `MainView`.
- `/`는 `/Main`으로 이동한다. 로그인·회원가입·약관·설정은 별도 URL 대신 패널 상태로 전환한다.
- 미인증이면 메인 화면과 함께 로그인 패널을 렌더링한다.
- 사이드바는 대화 목록·조회·삭제, 법전 외부 링크, 설정·프로필 패널을 제공한다.
- `MainView`가 질문을 먼저 메시지 상태에 추가하고, 선택된 방 유무에 따라 최초·후속 요청을 구분한다.
- 답변과 INFO를 Markdown으로 출력하고 새 대화는 페이지 새로고침으로 처리한다.

| 파일 | 현재 책임 |
| --- | --- |
| `src/store/auth/authStore.ts` | 로그인·가입·내 정보·갱신·로그아웃·탈퇴·계정 변경 |
| `src/store/chat/questionStore.ts` | 최초·후속 질문, 로딩·오류 상태 |
| `src/store/data/dataStore.ts` | 방 목록·조회·삭제·선택 ID |
| `src/store/data/messageStore.ts` | 메시지 배열 |
| `src/store/utils/toastStore.ts` | 토스트 상태 |
| `src/store/types.ts` | 공통 타입; 사용자 타입은 현재 any |
| `src/store/constants.ts` | VITE_API_BASE_URL, VITE_OAUTH2_BASE_URL |

API 요청은 각 Zustand 스토어에서 직접 수행한다. 공통 Axios 클라이언트와 CSRF 처리 모듈은 없다.

## 백엔드 확인 기준

- [원격 dev](https://github.com/ranpia/MoleLaw_backend/tree/dev)
- 확인 커밋: [`0eedbb12481b3713f47d25a37ac669bbc5d0515c`](https://github.com/ranpia/MoleLaw_backend/commit/0eedbb12481b3713f47d25a37ac669bbc5d0515c)
- 커밋 시각: 2026-10-23 15:23:03 KST.
- 메시지: Merge pull request #8 / 법령 수집·본문 읽기와 검증된 RAG 흐름 완성.
- 확인 당시 main: `ec9d87bc3b960ac2a6e161635774dde61d73a815` (2026-10-13).
- 로컬 백엔드 HEAD: `c50f4fd194cda49a479051e3583005698e1859bb`.
- 로컬은 원격과 다른 상태이며 원격 API로 두 커밋 비교 요청 시 404였다. 로컬이 원격보다 단순히 이전 버전이라고 단정하지 않는다.
- 원격 소스를 커밋으로 고정해 직접 읽었다. 백엔드 checkout·pull·fetch나 파일 변경은 하지 않았다.

## API 불일치

프론트 경로는 `VITE_API_BASE_URL` 아래 상대 경로다. 아래 표는 해당 값에 `/api`가 포함되는 구성을 전제로 하며 현재 환경변수 값은 미확인이다.

| 기능 | 현재 프론트 경로 | 원격 dev의 전체 경로 |
| --- | --- | --- |
| 내 정보 | GET /auth/me | GET /api/users/me |
| 탈퇴 | DELETE /auth/me | DELETE /api/users/me |
| 닉네임 변경 | PATCH /auth/nickname | PATCH /api/users/me/nickname |
| 비밀번호 변경 | PATCH /auth/password | PATCH /api/users/me/password |
| 갱신 | POST /auth/reissue | POST /api/auth/refresh |
| 최초 질문 | POST /chat-rooms/first-message | POST /api/chat-rooms |
| 메시지 조회 | GET /chat-rooms/{id} | GET /api/chat-rooms/{id}/messages |

로그인·가입·로그아웃, 대화 목록·삭제·후속 질문은 경로 패턴이 유지되지만 CSRF와 인증 처리가 필요하다.

### 인증·응답 계약

- GET `/api/auth/csrf` → `{ token, headerName }`. 쿠키를 유지하고 상태 변경 요청의 `X-XSRF-TOKEN` 헤더에 token을 보낸다. 로그인·가입·로그아웃·갱신도 대상이다.
- 운영 CSRF 쿠키는 HttpOnly다. JavaScript 쿠키 읽기에 의존하지 않고 응답 JSON을 사용한다.
- 쿠키 인증을 사용하면 credentials가 필요하며, 교차 출처인 경우 백엔드가 허용한 Origin이어야 한다.
- Access 수명은 최대 5분. 현재 프론트의 14분 갱신 간격은 맞지 않는다.
- Refresh는 회전하며 이전 값 재사용 시 세션 family가 폐기된다. 갱신의 중복 호출·무조건 재시도를 피하는 설계가 필요하다.
- 현재 부팅 흐름은 내 정보 조회 실패 후 Refresh 복구가 없다. 인증 초기화 대기 중 로그인 패널이 표시될 여지도 있다.
- 로그인 성공: 원본 `{ accessToken }`; 내 정보: `{ success: true, data: { email, nickname } }`.
- 가입 성공은 사용자 객체가 아닌 성공 문자열 envelope다. 프론트의 `user = res.data` 처리를 수정해야 한다.
- 갱신: `{ success: true, data: { accessToken } }`; 닉네임·비밀번호 변경은 200 빈 본문; 탈퇴·방 삭제는 204 빈 본문.
- 일반 업무 오류: `{ success: false, error: { status, code, message } }`. 현재 질문 스토어의 `data.message`는 불일치한다.
- 인증 필터 401은 `{ error: "Unauthorized" }`, 일부 보안 403은 공통 JSON 계약이 없으므로 별도 방어 처리가 필요하다.
- 입력 검증: 가입 닉네임 2~50자, 비밀번호 8~72자 및 UTF-8 72바이트 이하, 이메일 최대 254자. 로그인 비밀번호에 가입 최소 8자 규칙을 재적용하지 않는다.
- 비밀번호 변경은 Refresh family를 폐기하므로 성공 이후 재로그인 안내·상태 처리를 고려한다.

### 채팅·화면 계약

- 방 생성 응답 `{ id, messages }`, 메시지 조회는 배열, 후속 답변은 단일 메시지다. 모든 성공 응답을 일괄 envelope로 해석하면 안 된다.
- 메시지는 `sender`, `content`, UTC `timestamp`를 갖는다. sender는 USER/BOT/INFO다.
- 질문은 Unicode 코드포인트 최대 2000자, UTF-8 최대 32KiB다. 프론트에 길이 검증과 안내가 없다.
- 목록은 page=0, size=20 기본이며 size 최대 100이다. 현재 프론트에는 더 보기 처리가 없다.
- 최초 상담은 검색·필요 시 수집과 색인·충분성 판단·답변·저장을 동기로 수행한다. SSE는 제공하지 않는다.
- 실제로 알 수 없는 서버 진행 단계를 퍼센트나 확정된 단계처럼 표시하지 않는다. 장시간 대기·중복 전송 방지·실패 후 복구를 설계한다.
- 답변 본문은 `[[UUID]]`로 근거를 인용한다. INFO에는 서버가 만든 근거 ID·제목·출처 URL·본문 Markdown이 들어간다.
- 원격 기준에는 별도 근거 조회 컨트롤러가 없다. INFO를 바탕으로 읽기 쉬운 근거 번호, 접기·펼치기, 출처 링크 연결을 검토한다.
- 로컬에 있는 `caseSearchRequested`, `allowCaseSearch`, 별도 evidence API는 확인한 원격 dev에 없다. 현재 구현 대상으로 삼지 않는다.
- 후속 질문은 최초 고정 근거와 대화를 사용하며 새로운 검색·수집을 하지 않는다.
- 근거 스냅샷이 없는 과거 방의 후속 질문은 실패한다. 자동 이관 API가 없으므로 새 상담 시작 안내가 필요하다.
- 주요 오류: 422 EVIDENCE_INSUFFICIENT, 503 RETRIEVAL_UNAVAILABLE / RETRIEVAL_BUSY, GPT_API_FAILURE.
- 실패하면 방 또는 해당 질문·답변을 저장하지 않는다. 현재 프론트가 먼저 추가한 사용자 메시지와 서버 저장 상태가 어긋나지 않도록 복구해야 한다.

## 프론트 자체 개선 지점

- 질문 오류를 화면에 표시하지 않는다. loading 중 추가 전송을 차단하지 않는다.
- 로그아웃·탈퇴 시 방 목록·메시지·선택 상태 초기화가 없다.
- 선택된 방 삭제 후 현재 대화 상태를 정리하는 처리가 없다.
- 메인 940px, 입력창 1000px, 로그인 500px, 설정 750px 등 고정 너비가 많다.
- Vite 기본 App.css·index.css와 Emotion 전역 스타일이 함께 남아 있다.
- 사용자 any, 스토어 비동기 반환 타입, 실패 시 chatRooms를 undefined로 설정하는 부분을 정리해야 한다.
- 새 대화는 새로고침 대신 명시적인 상태 초기화로 전환하는 편이 적절하다.

## 단계별 실행 계획

- [x] 프론트 구조·화면·스토어·설정 조사.
- [x] 원격 dev 커밋 확인과 인증·채팅 계약 대조.
- [x] 작업 지침 및 현황 문서 저장.
- [ ] 1. 구현 착수 시 dev 최신 커밋 재확인. 환경변수 경로 기준과 프론트 Docker 실행 방식 확정.
- [ ] 2. 공통 API 클라이언트, 응답·오류 타입, CSRF 조회·헤더 처리를 도입.
- [ ] 3. 계정 API 경로, 가입 후 인증 조회, 만료 복구와 갱신 중복 방지, 로그아웃·탈퇴 상태 초기화 수정.
- [ ] 4. 최초 질문·메시지 조회 경로, 요청 검증, 로딩·오류·실패 메시지 복구, 새 대화·방 삭제 상태 처리 수정.
- [ ] 5. UUID 인용과 INFO를 활용한 근거 표시, 장시간 대기 안내, 과거 방 실패 안내 구현.
- [ ] 6. 대화 목록 더 보기, 반응형 화면과 전역 CSS 정리.
- [ ] 7. 프론트 디렉터리 안에 Docker·프록시·비밀값 없는 환경변수 예시와 실행 안내 구성. 구체적인 개발/빌드 제공 방식은 아직 미확정.
- [ ] 8. build·lint, 브라우저와 로컬 Docker 연동을 검증하고 결과 기록.

단계는 의존 관계 기준이며 일부 환경 구성은 연동 검증에 필요하면 앞당긴다. 현재 요청은 현황·계획 저장까지이며 실제 구현은 아직 시작하지 않았다.

## 검증 계획과 남은 확인

- 프론트 빌드·린트 및 기존 오류와 신규 오류 구분.
- CSRF 없는 요청 실패와 정상 CSRF 요청 성공, 로그인·가입·로그아웃·닉네임·비밀번호·탈퇴 흐름.
- 새로고침 시 만료 복구, 갱신 요청 중복, Refresh 실패 시 로그인 안내.
- 최초·후속 질문, 재접속 후 이력 조회, 새 대화, 삭제, 목록 더 보기.
- 근거 인용·출처 표시, 422/503/401/403 처리, 중복 전송과 서버 저장 실패 시 화면 상태.
- 작은 화면·긴 본문·긴 답변에서 레이아웃과 스크롤 확인.
- Docker의 브라우저 주소·내부 네트워크·쿠키·프록시·OAuth 리디렉션 확인.
- 테스트 파일·테스트 스크립트·node_modules·환경변수 파일은 조사 시 확인되지 않았다. 아직 어떤 실행 검증도 통과했다고 보고하지 않는다.

## 주요 원격 근거

아래 링크는 조사 기준 커밋에 고정했다.

- [인증 API](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/src/main/java/com/MoleLaw_backend/auth/controller/AuthController.java)
- [사용자 API](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/src/main/java/com/MoleLaw_backend/user/controller/UserController.java)
- [CSRF API](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/src/main/java/com/MoleLaw_backend/auth/controller/CsrfController.java)
- [채팅 API](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/src/main/java/com/MoleLaw_backend/chat/controller/ChatRoomController.java)
- [보안 설정](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/src/main/java/com/MoleLaw_backend/auth/config/SecurityConfig.java)
- [최초 상담](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/docs/initial-consultation.md)
- [고정 근거와 인용](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/docs/room-evidence.md)
