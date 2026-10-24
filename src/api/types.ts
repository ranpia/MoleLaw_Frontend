export interface User { email: string; nickname: string }
export interface Message {
  sender: "USER" | "BOT" | "INFO"; content: string; timestamp?: string; caseSearchRequested?: boolean;
}
export interface Chatroom { id: number; title: string; preview: string; createdAt: string }
export interface CreatedRoom { id: number; messages: Message[] }
export interface Evidence {
  id: string; kind: string; sourceId: string; title: string; sourceUrl: string;
  lawId?: string | null; effectiveDate?: string | null;
}
export interface EvidenceDetail {
  evidence: Evidence; content: string;
  caseInfo?: { caseNumber?: string; courtName?: string; decisionDate?: string; issues?: string; summary?: string; referenceLaws?: string; referenceCases?: string } | null;
}
