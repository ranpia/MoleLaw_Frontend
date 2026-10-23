import { useEffect, useRef } from "react";
import { useAuthStore, useDataStore, useMessageStore, useQuestionStore } from "../store/storeIndex";
import SideBar from "../Components/Layout/SideBar";
import ChattingBar from "../Components/Feature/ChattingSystem/ChattingBar";
import EvidencePanel from "../Components/Feature/ChattingSystem/EvidencePanel";
import MarkdownMessage from "../Components/Feature/ChattingSystem/MarkdownMessage";
import { useState } from "react";

export default function MainView() {
  const { selectedChatRoomID, roomLoading, evidence, newChat } = useDataStore();
  const { messages } = useMessageStore();
  const { loading, error, askQuestion, continueQuestion, clearError } = useQuestionStore();
  const { user } = useAuthStore();
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [declinedAt, setDeclinedAt] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);
  const send = (content: string, allowCaseSearch = false) => selectedChatRoomID === null ? askQuestion(content) : continueQuestion(content, allowCaseSearch);
  const last = messages[messages.length - 1];
  const consentKey = `${selectedChatRoomID}:${messages.length}`;
  const consent = last?.sender === "BOT" && last.caseSearchRequested && declinedAt !== consentKey;
  return (
    <div className="app-shell">
      <SideBar />
      <main className="chat-main">
        <header className="chat-header"><div><span className="eyebrow">법률 상담</span><h1>MoleLaw</h1></div>
          <button disabled={loading || roomLoading} onClick={() => { newChat(); clearError(); }}>새 상담</button></header>
        <div className="conversation" aria-busy={loading || roomLoading}>
          {!messages.length && <div className="welcome">
            <img src="/PointCircle.svg" alt="" /><h2>{user?.nickname}님,<br />어떤 고민이 있으신가요?</h2>
            <p>상황을 구체적으로 적어주시면 관련 법령과 근거를 함께 살펴봅니다.</p>
          </div>}
          {messages.map((message, index) => message.sender === "INFO" ?
            <details className="info-message" key={index}><summary>상담에 사용한 근거 안내</summary><MarkdownMessage content={message.content} evidence={evidence} onEvidence={setActiveEvidence} /></details>
            : <article key={index} className={`message ${message.sender === "USER" ? "user-message" : "bot-message"}`}>
              <span className="message-author">{message.sender === "USER" ? "나" : "MoleLaw"}</span>
              <MarkdownMessage content={message.content} evidence={evidence} onEvidence={setActiveEvidence} />
            </article>)}
          {consent && <section className="consent-card" aria-label="판례 검색 동의">
            <p>관련 판례를 추가로 검색할까요?</p><small>승인하면 이번 질문에 한해 외부 판례 검색과 본문 수집을 진행합니다.</small>
            <div className="button-row"><button disabled={loading || roomLoading} className="primary" onClick={() => void send("네, 관련 판례를 검색해 주세요.", true)}>판례 검색 승인</button>
              <button disabled={loading || roomLoading} onClick={() => setDeclinedAt(consentKey)}>지금은 검색하지 않기</button></div>
          </section>}
          {(loading || roomLoading) && <div className="pending-message" role="status"><span className="spinner" />{roomLoading ? "상담 기록을 불러오고 있습니다…" : "근거를 확인하고 답변을 준비하고 있습니다…"}
            {loading && <small>법령 수집이 필요한 첫 상담은 수 분 이상 걸릴 수 있습니다. 잠시 기다려 주세요.</small>}</div>}
          {error && <section className="error-card" role="alert"><p>{error}</p>
            <small>입력한 질문은 아래에 유지됩니다. 응답을 받지 못했다면 상담 기록을 먼저 확인해 주세요.</small>
            {selectedChatRoomID !== null && <button disabled={loading || roomLoading} onClick={() => { newChat(); clearError(); }}>새 상담에서 시작하기</button>}</section>}
          <div ref={end} />
        </div>
        <footer className="chat-footer">
          <ChattingBar key={selectedChatRoomID ?? "new"} disabled={loading || roomLoading} onSubmit={send} onEdit={clearError} />
        </footer>
      </main>
      {selectedChatRoomID !== null && <EvidencePanel key={selectedChatRoomID} roomId={selectedChatRoomID} activeId={activeEvidence} onSelect={setActiveEvidence} />}
    </div>
  );
}
