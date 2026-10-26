import { api } from "./client";
import type { Chatroom, Evidence, EvidenceDetail, Message } from "./types";

// Keep endpoint paths and transport details out of components and stores.
export const chatApi = {
  list: async (page: number, size: number) => (await api.get<Chatroom[]>("/chat-rooms", { params: { page, size } })).data,
  messages: async (id: number) => (await api.get<Message[]>(`/chat-rooms/${id}/messages`)).data,
  remove: async (id: number) => { await api.delete(`/chat-rooms/${id}`); },
  rename: async (id: number, title: string) => { await api.patch(`/chat-rooms/${id}/title`, { title }); },
  evidence: async (id: number) => (await api.get<Evidence[]>(`/chat-rooms/${id}/evidence`)).data,
  evidenceDetail: async (roomId: number, id: string, signal: AbortSignal) =>
    (await api.get<EvidenceDetail>(`/chat-rooms/${roomId}/evidence/${id}`, { signal })).data,
};
