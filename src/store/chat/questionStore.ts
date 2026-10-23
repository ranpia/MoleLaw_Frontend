import { create } from "zustand";
import { api, errorMessage, getSessionVersion } from "../../api/client";
import { validateQuestion } from "../../api/validation";
import type { Message, QuestionStore } from "../types";
import { useDataStore } from "../data/dataStore";
import { useMessageStore } from "../data/messageStore";

export const useQuestionStore = create<QuestionStore>((set, get) => {
  const send = async (content: string, roomId: number | null, allowCaseSearch = false) => {
    if (get().loading || useDataStore.getState().roomLoading) return false;
    const invalid = validateQuestion(content);
    if (invalid) { set({ error: invalid }); return false; }
    const version = getSessionVersion();
    const previous = useMessageStore.getState().messages;
    set({ loading: true, error: null });
    useMessageStore.getState().addMessage({ sender: "USER", content });
    try {
      if (roomId === null) {
        const { data } = await api.post<{ id: number; messages: Message[] }>("/chat-rooms", { content }, { timeout: 20 * 60_000 });
        if (version !== getSessionVersion()) return false;
        useDataStore.getState().setSelectedRoomID(data.id);
        useMessageStore.getState().setMessages(data.messages);
        await useDataStore.getState().loadEvidence(data.id);
      } else {
        const { data } = await api.post<Message>(`/chat-rooms/${roomId}/messages`, { content, allowCaseSearch }, { timeout: 20 * 60_000 });
        if (version !== getSessionVersion()) return false;
        useMessageStore.getState().addMessage(data);
        await useDataStore.getState().loadEvidence(roomId);
      }
      await useDataStore.getState().getChatRoom();
      return true;
    } catch (error) {
      if (version === getSessionVersion()) {
        useMessageStore.getState().setMessages(previous);
        set({ error: errorMessage(error, "답변을 생성하지 못했습니다. 과거 상담이라면 새 상담에서 다시 시작해 주세요.") });
      }
      return false;
    } finally { if (version === getSessionVersion()) set({ loading: false }); }
  };
  return {
    loading: false, error: null, clearError: () => set({ error: null }),
    askQuestion: (content) => send(content, null),
    continueQuestion: (content, allowCaseSearch = false) => {
      const id = useDataStore.getState().selectedChatRoomID;
      if (id === null) return Promise.resolve(false);
      return send(content, id, allowCaseSearch);
    },
  };
});
window.addEventListener("molelaw:session-cleared", () => useQuestionStore.setState({ loading: false, error: null }));
