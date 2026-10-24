import type { Evidence, Message } from "../../../api/types";
import MarkdownMessage from "./MarkdownMessage";

interface Props {
  message: Message; evidence: Evidence[]; onEvidence: (id: string) => void; pending?: boolean;
}

export default function ConversationMessage({ message, evidence, onEvidence, pending = false }: Props) {
  const body = <MarkdownMessage content={message.content} evidence={evidence} onEvidence={onEvidence} />;
  if (message.sender === "INFO") return <details className="info-message"><summary>{pending ? "확인 중인 근거" : "상담에 사용한 근거 안내"}</summary>{body}</details>;
  const isUser = message.sender === "USER";
  return <article className={`message ${isUser ? "user-message" : "bot-message"}`}>
    <span className="message-author">{isUser ? "나" : pending ? "MoleLaw · 답변 작성 중" : "MoleLaw"}</span>
    {body}
    {pending && <small>근거를 검증한 뒤 최종 답변으로 확정합니다.</small>}
  </article>;
}
