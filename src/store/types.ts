export interface User { email: string; nickname: string }
export interface Message {
  sender: "USER" | "BOT" | "INFO"; content: string; timestamp?: string; caseSearchRequested?: boolean;
}
export interface MessageData {
  messages: Message[]; addMessage: (msg: Message) => void;
  addMessages: (msgs: Message[]) => void; setMessages: (msgs: Message[]) => void;
}
export interface Chatroom { id: number; title: string; preview: string; createdAt: string }
export interface Evidence {
  id: string; kind: string; sourceId: string; title: string; sourceUrl: string;
  lawId?: string | null; effectiveDate?: string | null;
}
export interface EvidenceDetail {
  evidence: Evidence; content: string;
  caseInfo?: { caseNumber?: string; courtName?: string; decisionDate?: string; issues?: string; summary?: string; referenceLaws?: string; referenceCases?: string } | null;
}
export interface DataStore {
  chatRooms: Chatroom[]; selectedChatRoomID: number | null;
  listLoading: boolean; roomLoading: boolean; hasMore: boolean; page: number;
  error: string | null; evidence: Evidence[]; evidenceError: string | null;
  getChatRoom: (more?: boolean) => Promise<void>;
  getChatRoomMessage: (id: number) => Promise<boolean>;
  deleteChatroom: (id: number) => Promise<boolean>;
  setSelectedRoomID: (id: number | null) => void;
  loadEvidence: (id: number) => Promise<void>; newChat: () => void;
}
export interface QuestionStore {
  loading: boolean; error: string | null;
  askQuestion: (content: string) => Promise<boolean>;
  continueQuestion: (content: string, allowCaseSearch?: boolean) => Promise<boolean>;
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
  changePassword: (password: string) => Promise<string>;
}
