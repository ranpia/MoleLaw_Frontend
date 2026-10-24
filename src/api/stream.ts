import { api, getCsrf, getSessionVersion } from "./client";
import { API_BASE_URL } from "./config";
import type { CreatedRoom, Message } from "./types";

export interface AnswerEvent {
  type: "progress" | "info" | "answer_delta" | "completed" | "error" | "heartbeat";
  message?: string; info?: string; delta?: string; code?: string;
  room?: CreatedRoom;
  messageResult?: Message;
}

async function streamAnswer(path: string, body: object, onEvent: (event: AnswerEvent) => void, signal: AbortSignal): Promise<AnswerEvent> {
  const version = getSessionVersion();
  // Refresh authentication before sending a mutation that must never be replayed.
  await api.get("/users/me", { signal });
  const csrf = await getCsrf();
  if (version !== getSessionVersion() || signal.aborted) throw new Error("상담 요청이 취소되었습니다.");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include", signal,
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", [csrf.headerName]: csrf.token },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error?.message || (response.status === 401 ? "로그인이 만료되었습니다. 다시 로그인해 주세요." : `상담 요청을 처리하지 못했습니다. (${response.status})`));
  }
  if (!response.headers.get("content-type")?.includes("application/x-ndjson") || !response.body) throw new Error("서버의 스트리밍 응답 형식을 확인하지 못했습니다.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AnswerEvent;
    if (event.type === "error") throw new Error(event.message || "답변을 생성하지 못했습니다.");
    onEvent(event);
    return event.type === "completed" ? event : undefined;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const result = consume(line);
        if (result) return result;
      }
      if (done) {
        const result = consume(buffer);
        if (result) return result;
        throw new Error("답변 완료 전에 연결이 종료되었습니다. 상담 기록을 확인해 주세요.");
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function streamFirstAnswer(content: string, onEvent: (event: AnswerEvent) => void, signal: AbortSignal): Promise<CreatedRoom> {
  const { room } = await streamAnswer("/chat-rooms/ndjson", { content }, onEvent, signal);
  if (!room || !Number.isSafeInteger(room.id) || !Array.isArray(room.messages)) throw new Error("저장된 상담 결과를 확인하지 못했습니다. 상담 기록을 확인해 주세요.");
  return room;
}

export async function streamFollowUp(roomId: number, content: string, allowCaseSearch: boolean, onEvent: (event: AnswerEvent) => void, signal: AbortSignal): Promise<Message> {
  const { messageResult } = await streamAnswer(`/chat-rooms/${roomId}/messages/ndjson`, { content, allowCaseSearch }, onEvent, signal);
  if (!messageResult || messageResult.sender !== "BOT" || typeof messageResult.content !== "string") throw new Error("저장된 후속 답변을 확인하지 못했습니다. 상담 기록을 확인해 주세요.");
  return messageResult;
}
