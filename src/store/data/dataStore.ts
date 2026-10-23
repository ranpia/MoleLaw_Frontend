import { create } from "zustand";
import { api, errorMessage, getSessionVersion } from "../../api/client";
import type { Chatroom, DataStore, Evidence, Message } from "../types";
import { useMessageStore } from "./messageStore";

const PAGE_SIZE = 20;
let selectionVersion = 0;
export const useDataStore = create<DataStore>((set, get) => ({
  chatRooms: [], selectedChatRoomID: null, listLoading: false, roomLoading: false,
  error: null, hasMore: false, page: 0, evidence: [], evidenceError: null,
  setSelectedRoomID: (id) => { selectionVersion += 1; set({ selectedChatRoomID: id, evidence: [], evidenceError: null }); },
  newChat: () => {
    selectionVersion += 1;
    set({ selectedChatRoomID: null, evidence: [], evidenceError: null, error: null, roomLoading: false });
    useMessageStore.getState().setMessages([]);
  },
  getChatRoom: async (more = false) => {
    if (get().listLoading) return;
    const version = getSessionVersion();
    const page = more ? get().page + 1 : 0;
    set({ listLoading: true, error: null });
    try {
      const { data } = await api.get<Chatroom[]>("/chat-rooms", { params: { page, size: PAGE_SIZE } });
      if (version !== getSessionVersion()) return;
      set({ chatRooms: more ? [...get().chatRooms, ...data.filter((room) => !get().chatRooms.some((old) => old.id === room.id))] : data,
        page, hasMore: data.length === PAGE_SIZE });
    } catch (error) { if (version === getSessionVersion()) set({ error: errorMessage(error) }); }
    finally { if (version === getSessionVersion()) set({ listLoading: false }); }
  },
  getChatRoomMessage: async (id) => {
    const version = ++selectionVersion;
    const session = getSessionVersion();
    set({ roomLoading: true, error: null });
    try {
      const { data } = await api.get<Message[]>(`/chat-rooms/${id}/messages`);
      if (version !== selectionVersion || session !== getSessionVersion()) return false;
      useMessageStore.getState().setMessages(data);
      set({ selectedChatRoomID: id, evidence: [], evidenceError: null });
      await get().loadEvidence(id);
      return true;
    } catch (error) { if (version === selectionVersion && session === getSessionVersion()) set({ error: errorMessage(error) }); return false; }
    finally { if (version === selectionVersion && session === getSessionVersion()) set({ roomLoading: false }); }
  },
  loadEvidence: async (id) => {
    const version = selectionVersion;
    const session = getSessionVersion();
    try {
      const { data } = await api.get<Evidence[]>(`/chat-rooms/${id}/evidence`);
      if (version === selectionVersion && session === getSessionVersion() && get().selectedChatRoomID === id) set({ evidence: data, evidenceError: null });
    } catch (error) { if (version === selectionVersion && session === getSessionVersion()) set({ evidenceError: errorMessage(error, "근거 목록을 불러오지 못했습니다.") }); }
  },
  deleteChatroom: async (id) => {
    const session = getSessionVersion();
    try {
      await api.delete(`/chat-rooms/${id}`);
      if (session !== getSessionVersion()) return false;
      if (get().selectedChatRoomID === id) get().newChat();
      set({ chatRooms: get().chatRooms.filter((room) => room.id !== id) });
      await get().getChatRoom();
      return true;
    } catch (error) { if (session === getSessionVersion()) set({ error: errorMessage(error) }); return false; }
  },
}));
window.addEventListener("molelaw:session-cleared", () => {
  useDataStore.getState().newChat();
  useDataStore.setState({ chatRooms: [], hasMore: false, page: 0, listLoading: false });
});
