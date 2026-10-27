import { create } from "zustand";
import { errorMessage, getSessionVersion } from "../../api/client";
import { validateQuestion } from "../../api/validation";
import type { QuestionStore } from "../types";
import { useDataStore } from "../data/dataStore";
import { useMessageStore } from "../data/messageStore";
import { streamFirstAnswer, streamFollowUp, type AnswerEvent } from "../../api/stream";
import { createDraftWriter } from "./draftWriter";

let activeStream: AbortController | undefined;

export const useQuestionStore = create<QuestionStore>((set, get) => {
  const send = async (content: string, roomId: number | null, allowCaseSearch = false, caseSearchLawEvidenceIds?: string[]) => {
    if (get().loading || useDataStore.getState().roomLoading) return false;
    const invalid = validateQuestion(content);
    if (invalid) { set({ error: invalid }); return false; }
    if (caseSearchLawEvidenceIds?.length && (!allowCaseSearch || caseSearchLawEvidenceIds.some(id =>
      !useDataStore.getState().evidence.some(item => item.id === id && item.kind.startsWith("LAW_"))))) {
      set({ error: "현재 상담방의 법령 근거를 선택하고 판례 검색을 승인해 주세요." }); return false;
    }
    const version = getSessionVersion();
    const previous = useMessageStore.getState().messages;
    set({ loading: true, error: null, progress: "질문을 확인하고 있습니다…", draft: "", streamInfo: "" });
    useMessageStore.getState().addMessage({ sender: "USER", content });
    const controller = new AbortController();
    activeStream = controller;
    const writer = createDraftWriter((draft) => { if (version === getSessionVersion()) set({ draft }); }, controller.signal);
    const onEvent = (event: AnswerEvent) => {
      if (version !== getSessionVersion()) return;
      if (event.type === "progress") set({ progress: event.message || "답변을 준비하고 있습니다…" });
      if (event.type === "info") set({ streamInfo: event.info || "" });
      if (event.type === "answer_delta") writer.append(event.delta || "");
      if (event.type === "completed") set({ progress: "최종 답변을 정리하고 있습니다…" });
    };
    try {
      if (roomId === null) {
        const data = await streamFirstAnswer(content, onEvent, controller.signal);
        await writer.drain();
        if (version !== getSessionVersion()) return false;
        useDataStore.getState().setSelectedRoomID(data.id);
        useMessageStore.getState().setMessages(data.messages);
        await useDataStore.getState().loadEvidence(data.id);
      } else {
        const data = await streamFollowUp(roomId, content, allowCaseSearch, onEvent, controller.signal, caseSearchLawEvidenceIds);
        await writer.drain();
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
    } finally { writer.dispose(); if (version === getSessionVersion()) { activeStream = undefined; set({ loading: false, progress: "", draft: "", streamInfo: "" }); } }
  };
  return {
    loading: false, error: null, progress: "", draft: "", streamInfo: "", clearError: () => set({ error: null }),
    askQuestion: (content) => send(content, null),
    continueQuestion: (content, allowCaseSearch = false, caseSearchLawEvidenceIds) => {
      const id = useDataStore.getState().selectedChatRoomID;
      if (id === null) return Promise.resolve(false);
      return send(content, id, allowCaseSearch, caseSearchLawEvidenceIds);
    },
  };
});
window.addEventListener("molelaw:session-cleared", () => {
  activeStream?.abort();
  activeStream = undefined;
  useQuestionStore.setState({ loading: false, error: null, progress: "", draft: "", streamInfo: "" });
});
