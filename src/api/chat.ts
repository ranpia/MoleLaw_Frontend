import { api } from "./client";
import type { Chatroom, Evidence, EvidenceDetail, Message, SuggestedQuestion } from "./types";
import { validateQuestion } from "./validation";

// Keep endpoint paths and transport details out of components and stores.
export const chatApi = {
  suggest: async (query: string, signal: AbortSignal) => {
    const { data } = await api.post<{ suggestedQuestions: SuggestedQuestion[] }>("/legal-answers/suggestions", { query }, { signal });
    if (!Array.isArray(data?.suggestedQuestions) || data.suggestedQuestions.length < 1 || data.suggestedQuestions.length > 3 ||
      data.suggestedQuestions.some(item => !item || typeof item.id !== "string" || typeof item.label !== "string" || !item.label.trim() || typeof item.question !== "string" || validateQuestion(item.question))) {
      throw new Error("추천 질문을 확인하지 못했습니다. 원문으로 질문하거나 다시 시도해 주세요.");
    }
    return data.suggestedQuestions;
  },
  list: async (page: number, size: number) => (await api.get<Chatroom[]>("/chat-rooms", { params: { page, size } })).data,
  messages: async (id: number) => (await api.get<Message[]>(`/chat-rooms/${id}/messages`)).data,
  remove: async (id: number) => { await api.delete(`/chat-rooms/${id}`); },
  rename: async (id: number, title: string) => { await api.patch(`/chat-rooms/${id}/title`, { title }); },
  evidence: async (id: number) => (await api.get<Evidence[]>(`/chat-rooms/${id}/evidence`)).data,
  evidenceDetail: async (roomId: number, id: string, signal: AbortSignal) =>
    (await api.get<EvidenceDetail>(`/chat-rooms/${roomId}/evidence/${id}`, { signal })).data,
};
