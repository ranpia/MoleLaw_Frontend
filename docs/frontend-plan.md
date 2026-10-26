# 프론트 작업 현황과 계획

문서 정리일: 2026-10-26 (Asia/Seoul)

## 현재 상태

- 작업 브랜치는 `dev`이며 `origin/dev`를 추적한다.
- 2026-10-26 원격 확인 시 `main`과 `dev`는 모두 `3abd260`이었다. `main` pull 결과는 이미 최신 상태였으며 이후 `dev`로 전환했다.
- `origin/stream`의 `4a10816`을 2026-10-26 dev에 fast-forward 병합했다. 원격 dev에는 아직 푸시하지 않았다.
- 아래 2026-10-23 검증 표는 과거 기록이다. 병합된 브랜치의 2026-10-24 후속 검증 기록은 다음 절을 우선한다. 현재 프론트 포트는 사용자 요청에 따라 5173이다.
- 당시 검증 결과와 미해결 항목은 [중간 저장](checkpoint.md), 실행 방법은 [로컬 개발 안내](local-development.md)를 참고한다.

## 작업 범위와 참조 기준

모든 수정과 실행 환경 구성은 프론트 프로젝트 안에서 진행한다. 백엔드는 읽기 전용 참조 대상이다.

백엔드 원격 조사 기준은 `ranpia/MoleLaw_backend`의 `dev`, 커밋 `0eedbb12481b3713f47d25a37ac669bbc5d0515c`였다. 이후 사용자가 실행한 `http://localhost:8080/v3/api-docs`에서 근거 조회 API와 `caseSearchRequested`, `allowCaseSearch` 필드를 확인해 실행 서버 계약을 기준으로 프론트를 수정했다. 과거 원격 조사에서 해당 기능이 없었다는 기록을 현재 구현 기준으로 사용하지 않는다. 이번 문서 정리에서는 백엔드 최신 상태를 다시 확인하지 않았다.

## 구현된 범위

- 공통 Axios 클라이언트, CSRF 조회·헤더 처리, 401 갱신 후 1회 재요청과 갱신 중복 방지.
- 계정 API 경로와 가입 후 사용자 조회, 계정 변경·탈퇴·로그아웃 상태 처리.
- 최초·후속 질문과 메시지 조회, 질문 길이 검증, 중복 전송 방지와 실패 복구.
- 대화 목록 더 보기, 방 전환 시 오래된 응답 방어, 근거 인용·원문 보기와 판례 검색 승인.
- 반응형 화면, 공통 스타일 정리, 로컬 폰트 적용.
- Vite API·OAuth 프록시, 프론트 Docker 설정과 환경변수 예시.
- 실제 API 검사·브라우저 검사 스크립트와 로컬 Postman 모의 계약.

구현 여부와 검증 완료 여부는 구분한다. 특히 브라우저 로그아웃 403은 미해결이다.

## 검증 현황

2026-10-23 기록 기준이며 이번 문서 수정에서는 재실행하지 않았다.

| 구분 | 결과 |
| --- | --- |
| 프로덕션 빌드 | `npm.cmd run build -- --configLoader runner` 통과 |
| 린트 | UI·스토어 수정 당시 통과, 이후 추가된 검증 파일은 재린트 필요 |
| 실제 API | 19개 검사 통과, 해당 검사 임시 계정 삭제 확인 |
| 실제 브라우저 | 가입·프로필·새로고침 세션 유지·닉네임 변경·모바일 너비 확인, 로그아웃 403 |
| 모의 브라우저 | 상태 저장 비동기 호출 수정 후 재실행 필요 |
| 실제 AI 상담·근거 조회 | 성공 흐름 검증 전 |
| OAuth·Docker·동시 탭·자동 만료 복구 | 검증 전 |

기본 Vite 설정 로더와 개발 사전 번들링은 당시 도구의 상위 폴더 접근 제한으로 실패했다. 현재 환경에서도 재현되는지는 확인하지 않았다.

## 다음 작업

1. 실행 서버 계약과 현재 작업 트리를 확인한다.
2. 브라우저 로그아웃 403의 CSRF 요청을 확인하고 인증 흐름을 재검증한다. 이전 실패 검사의 임시 계정 정리 여부도 확인한다.
3. Postman simulation을 재실행해 정상 답변, 검색 승인, 422/503 오류, 중복 전송, 원문 표시를 확인한다.
4. 필요한 실제 상담 흐름을 임시 계정으로 검증하고 계정을 삭제한다.
5. 목록 20개 초과, 만료 복구·동시 탭, OAuth와 Docker 실행을 검증한다.
6. 최종 lint/build와 화면 검증 후 결과를 문서에 반영한다.

## 조사 근거

아래 링크는 과거 조사 커밋에 고정된 참조이며 현재 실행 서버 계약을 대신하지 않는다.

- [인증 API](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/src/main/java/com/MoleLaw_backend/auth/controller/AuthController.java)
- [CSRF API](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/src/main/java/com/MoleLaw_backend/auth/controller/CsrfController.java)
- [채팅 API](https://github.com/ranpia/MoleLaw_backend/blob/0eedbb12481b3713f47d25a37ac669bbc5d0515c/src/main/java/com/MoleLaw_backend/chat/controller/ChatRoomController.java)

## Docker 실행 확인 — 2026-10-26

현재 dev 작업 트리로 프론트 이미지를 다시 빌드하고 컨테이너를 실행했다. Vite 준비 로그와 http://localhost:5173 의 HTTP 200 응답을 확인했다. 백엔드 컨테이너는 변경하지 않았다. 이번 확인은 프론트 기동에 한정하며 인증·채팅·OAuth 전체 연동은 재검증하지 않았다.

## 병합한 브랜치의 검증 기록 — 2026-10-24

### 구조 정리 및 후속 NDJSON 연결

- 최종 구조 정리 후 build·lint·verify:stream 재통과. `node scripts/browser-check.mjs live`도 통과하여 가입·프로필·새로고침 유지·Access 쿠키 누락 시 단일 Refresh 복구·닉네임 변경·로그아웃 200·재로그인·임시 계정 삭제를 확인했다. 이전 5173 Origin에서의 브라우저 로그아웃 403은 현재 3000 환경에서는 재현되지 않았다. 인증 산출물 `.artifacts.local/browser-live-1792835194607/`.

- API 환경설정과 서버 타입을 `src/api/config.ts`, `types.ts`로 이동하고 인증·채팅 JSON 호출을 `auth.ts`, `chat.ts`로 모았다. 스토어는 상태와 작업 흐름을 담당하고 근거 패널은 API 모듈을 사용한다.
- 메시지 렌더링을 ConversationMessage, 로딩 표시를 LoadingIndicator로 분리하고 실제 import에서 사용하지 않는 이전 화면·스타일 12개 파일을 제거했다. 자세한 배치는 [프로젝트 구조](project-structure.md)에 기록했다.
- 로컬 Swagger 재조회에서 `POST /api/chat-rooms/{roomId}/messages/ndjson` 추가 확인. `{ content, allowCaseSearch }`를 보내고 `completed.messageResult`를 최종 BOT 메시지로 반영한다. 판례 검색 동의는 요청별로 유지한다.
- 최초·후속 공통 스트림 파서와 draftWriter를 사용한다. 임시 답변은 기본 30ms마다 3코드포인트씩 표시하며 긴 대기는 완화한다. 완료 이벤트 뒤 대기 중인 임시 텍스트 표시를 마친 후 검증된 저장 결과로 교체한다. 오류·세션 종료 시 대기 타이머와 임시 결과를 정리한다.
- `node scripts/verify-stream.mjs` 통과: 바이트별 한글·이모지 청크, CRLF·마지막 개행 누락, heartbeat, 후속 결과·동의 필드, 오류·미완료 스트림·완료 결과 누락, 자동 재시도 없음, 표시 속도와 취소.
- `node scripts/browser-check.mjs ndjson` 실제 서버·브라우저 검증 통과: 최초·후속 NDJSON 200, 임시·최종 표시, 중복 전송 방지, 저장·새로고침 복원, 모바일, JS 예외 없음, 임시 계정 삭제 204. 산출물 `.artifacts.local/browser-ndjson-1792835092109/`.
- 이전 JSON API용 Postman simulation fixture는 NDJSON 전환에 맞춘 갱신이 필요하다. 실제 서버 연동 결과와 모의 fixture 검증 결과를 혼동하지 않는다.

## 병합 후 확인 — 2026-10-26

stream 병합 후 lint, 프로덕션 build(configLoader runner), verify:stream 모두 통과했다. 실제 서버 인증·AI 흐름은 이번에 재실행하지 않았다. 사용자 요청으로 Vite·Docker·브라우저 검사 기본 포트를 5173으로 유지했다. 이전 3000 검증 결과가 5173의 인증 성공을 보장하지는 않는다.

## 사용자 연동 확인 및 게시 — 2026-10-26

사용자가 5173에서 인증과 후속 NDJSON의 정상 동작을 직접 확인했다. 이는 사용자 수동 확인 결과이며 에이전트의 추가 자동 검사 결과는 아니다. Docker 재빌드·기동과 HTTP 200도 확인했다. stream 병합 및 5173 유지 설정, 문서 정리를 dev에 커밋해 origin/dev로 푸시한다.

## 스트리밍 중 스크롤 위치 유지 — 2026-10-26

답변 조각마다 무조건 실행하던 scrollIntoView를 제거했다. 대화 컨테이너 하단을 추적하다가 사용자가 위로 스크롤하면 추적을 중지하고, 하단 근처로 돌아오거나 새 질문을 보내면 재개한다. 진행 상태·근거·최종 답변 갱신에도 사용자가 읽던 위치를 유지하며, 연속 smooth 스크롤은 제거했다.

검증: lint, build(configLoader runner), verify:stream 통과. 실제 Chrome에서 API 요청을 차단하고 화면 스토어에 샘플 대화·스트림 상태를 넣어 하단 추적, 청크 갱신 중 수동 위치 유지, 완료 시 위치 유지, 하단 복귀 후 추적 재개를 확인했다. 실제 AI 요청은 하지 않았다. 검사 스크립트는 로컬 산출물 .artifacts.local/verify-scroll.mjs에 있다. 5173 프론트 컨테이너도 다시 빌드·기동했다.

## 채팅방 이름·현재 비밀번호 계약 반영 — 2026-10-26

프론트 원격 dev 확인 결과 새 커밋은 없었으며, 실행 서버 OpenAPI에서 PATCH /api/chat-rooms/{roomId}/title과 필수 currentPassword를 확인했다. 사이드바 이름 변경·저장·취소와 Unicode 1~255자 검증, 성공 후 목록 반영을 추가했다. 비밀번호 변경은 현재 비밀번호를 공백 제거 없이 전송하고 실패 시 로그인 상태를 유지하며 성공 시 세션을 초기화한다.

검증: 실제 서버 API 23개 통과(현재 비밀번호 누락·불일치 거절, 불일치 후 Refresh 유지, 정상 변경·새 비밀번호 로그인, 없는 상담방 이름 변경 404). 임시 계정 삭제 204 확인. 실제 상담방 이름 변경 성공은 AI 비용을 피하기 위해 실행하지 않았으며 선택적 consultation 검사에 추가했다. Postman simulation + 실제 Chrome에서는 제목 취소·이모지 길이 제한·204 저장·새로고침 유지와 현재 비밀번호 오류·정상 변경 후 로그인 화면을 확인했다. backend 멤버의 실제 PATCH 요청 이벤트도 확인했다. 모의 결과는 실서버 이름 변경 성공을 보장하지 않는다. 호스트 Vite의 Chrome Cookies 감시 EBUSY를 피하도록 로컬 산출물을 감시에서 제외했다.

## 최초 질문 추천 실험 — 2026-10-26

브랜치: `experiment/initial-question-suggestions` (`dev`에서 분리). 실행 서버 OpenAPI의 `POST /api/legal-answers/suggestions`를 기준으로 초안 `{ query }` → `suggestedQuestions` 1~3개를 연결했다. 추천은 명시적으로 요청하며 선택한 `question`을 기존 최초 NDJSON의 `content`로 전송한다. 원문 바로 전송과 후속 NDJSON은 유지하고 추천 선택으로 판례 검색에 동의하지 않는다. 추천 조회 자체는 방·메시지를 만들지 않는다.

입력 수정·추천 취소·컴포넌트 해제 시 요청을 중단하고 늦은 응답은 버린다. 추천 오류·응답 계약 오류는 입력을 보존하며 원문으로 계속 질문할 수 있다. 추천을 선택해 상담이 실패하면 원문과 추천을 유지한다.

검증: lint/build/verify:stream 통과. 실제 서버 API 27개 통과(실제 모델 추천 1회, 원문 보존, 긴 초안 원문 반환, 추천 후 방 목록 빈 배열, 기존 인증·비밀번호 검사와 임시 계정 삭제 포함). 실제 최초·후속 AI 상담은 이번에 반복하지 않았다. Postman simulation + Chrome 7개 검사 통과: 명시적·중복 방지 추천, 입력 수정 후 늦은 응답 무시, 모바일 너비, 선택 문장 최초 NDJSON 전송과 동의 없음, 후속 NDJSON 우회, 500 후 원문 전송, JS 예외 없음. backend 멤버의 추천·최초·후속 요청 이벤트 확인. 산출물: `.artifacts.local/browser-suggestions-1793002666257/`.

운영 중인 프론트는 실험 브랜치로 다시 빌드하며 5173 포트를 유지한다. dev에는 병합하지 않는다.

## 추천 질문 말풍선 UI — 2026-10-26

실험 브랜치에서 추천 질문·추천 중 상태를 입력 폼 밖의 채팅 영역으로 옮겼다. 추천 말풍선 전체가 클릭·키보드 선택 가능한 버튼이며, 선택 시 별도 확인 버튼 없이 해당 문장을 기존 최초 NDJSON으로 전송한다. 중복 전송 방지와 원문·추천 취소 흐름은 유지한다. lint/build 통과. Postman simulation + Chrome 7개 검사에서 채팅 영역 배치, 말풍선 두 번 클릭 시 최초 요청 1회, 선택 문장 전송, 후속 NDJSON, 취소·오류 복구와 모바일 너비를 확인했다. 실제 AI 호출은 반복하지 않았다. 산출물: .artifacts.local/browser-suggestions-1793003798741/.
