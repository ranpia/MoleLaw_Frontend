import type { User, Message, Chatroom, Evidence, EvidenceUpdate } from "../api/types";
export type { User, Message, Chatroom, Evidence, EvidenceDetail } from "../api/types";
export interface MessageData {
  messages: Message[]; addMessage: (msg: Message) => void;
  addMessages: (msgs: Message[]) => void; setMessages: (msgs: Message[]) => void;
}
export interface DataStore {
  chatRooms: Chatroom[]; selectedChatRoomID: number | null;
  listLoading: boolean; roomLoading: boolean; hasMore: boolean; page: number;
  error: string | null; evidence: Evidence[]; evidenceError: string | null;
  deletingEvidenceId: string | null; removeEvidence: (id: string) => Promise<boolean>;
  getChatRoom: (more?: boolean) => Promise<void>;
  getChatRoomMessage: (id: number) => Promise<boolean>;
  deleteChatroom: (id: number) => Promise<boolean>;
  renameChatroom: (id: number, title: string) => Promise<boolean>;
  setSelectedRoomID: (id: number | null) => void;
  loadEvidence: (id: number) => Promise<void>; newChat: () => void;
}
export interface QuestionStore {
  loading: boolean; error: string | null;
  progress: string; draft: string; streamInfo: string;
  evidenceUpdate: EvidenceUpdate | null; hiddenPreviewIds: string[]; hidePreviewEvidence: (id: string) => void;
  askQuestion: (content: string) => Promise<boolean>;
  continueQuestion: (content: string, allowCaseSearch?: boolean, caseSearchLawEvidenceIds?: string[]) => Promise<boolean>;
  clearError: () => void;
}
export interface AuthStore {
  user: User | null; isLoading: boolean; error: string | null; isAuthenticated: boolean; initialized: boolean;
  checkAuthStatus: () => Promise<boolean>;
  googleLogin: () => void; kakaoLogin: () => void;
  logout: () => Promise<boolean>; quit: () => Promise<boolean>; refreshToken: () => Promise<boolean>;
  LocalLogin: (email: string, password: string) => Promise<string>;
  LocalSignUp: (email: string, password: string, nickname: string) => Promise<string>;
  changeNickname: (nickname: string) => Promise<string>;
  changePassword: (currentPassword: string, password: string) => Promise<string>;
}
