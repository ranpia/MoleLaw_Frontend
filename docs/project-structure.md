# 프론트 프로젝트 구조

## 역할과 의존 방향

- `src/api/config.ts`: API·OAuth 환경변수와 기본 경로.
- `src/api/types.ts`: 서버가 반환하는 사용자·대화·근거 타입. 스토어에 의존하지 않는다.
- `src/api/client.ts`: 공통 HTTP 클라이언트, CSRF, 세션 갱신과 오류 처리.
- `src/api/auth.ts`, `chat.ts`: 인증·채팅 JSON API 경로와 응답 추출.
- `src/api/stream.ts`: 최초·후속 NDJSON 전송과 UTF-8 줄 단위 파싱. 완료 결과 차이를 처리하며 상담 POST를 자동 재실행하지 않는다.
- `src/store/`: 화면 상태와 작업 흐름. API 모듈을 호출하며 인증·방 전환 시 오래된 응답을 방어한다. `types.ts`는 스토어 인터페이스를 정의하고 기존 import 호환용 서버 타입을 재노출한다.
- `src/store/chat/draftWriter.ts`: 서버 전송 속도와 독립적으로 임시 답변 표시를 조절하고 취소·종료 시 타이머를 정리한다.
- `src/Views/MainView.tsx`: 메인 화면 조합과 사용자 동작 연결.
- `src/Components/Feature/ChattingSystem/`: 입력, 메시지 표시, Markdown 인용, 근거 패널.
- `src/Components/UI/`: 토스트·로딩 표시 등 공통 UI.
- `src/index.css`, `src/style/`: 화면 스타일과 Emotion 전역 폰트·스타일.

화면은 API 경로를 직접 조합하지 않고 API 모듈을 사용한다. 스토어는 표시용 JSX를 갖지 않는다. 서버 타입과 환경설정은 API 계층에 두어 API → 스토어 역방향 의존을 피한다.

## 2026-10-24 정리

실제 entry point와 import를 대조해 현재 화면에서 참조하지 않는 이전 로그인·가입·탈퇴·프로필·채팅 버블·배경·입력·애니메이션 컴포넌트 및 Vite 기본 App.css를 제거했다. 현재 사용하는 LoginPanel, SettingPanel, ChattingBar 등은 유지했다. 폴더 전체 이름 변경은 하지 않아 경로 변경 범위를 제한했다.

## 검증

```powershell
npm.cmd run build -- --configLoader runner
npm.cmd run lint
npm.cmd run verify:stream
npm.cmd run verify:ndjson
```

`verify:stream`은 모의 네트워크로 UTF-8 청크 경계, CRLF, 마지막 개행 누락, error·미완료 종료, 후속 결과·동의 필드, 표시 속도와 취소를 확인한다. `verify:ndjson`은 실제 서버·브라우저에서 최초 및 후속 AI 상담을 호출하며 새 임시 계정을 만들고 검증 후 삭제한다. 비용이 발생할 수 있어 불필요한 반복은 피한다.

기존 Postman simulation fixture는 이전 JSON 채팅 경로 기준이므로 NDJSON 전환 이후 전체 simulation 성공을 주장하지 않는다. 해당 fixture를 스트림 계약에 맞추는 작업은 별도로 남아 있다.
