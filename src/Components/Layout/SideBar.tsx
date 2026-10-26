import { useEffect, useState } from "react";
import { useAuthStore, useDataStore, useQuestionStore, useToastStore } from "../../store/storeIndex";
import SettingPanel from "../Feature/SettingSystem/SettingPanel";

export default function SideBar() {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const { chatRooms, getChatRoom, getChatRoomMessage, deleteChatroom, renameChatroom, newChat, selectedChatRoomID, listLoading, roomLoading, hasMore, error } = useDataStore();
  const { loading, clearError } = useQuestionStore();
  const { user, logout, isLoading } = useAuthStore();
  const busy = loading || roomLoading || deleting !== null || renaming;
  useEffect(() => { void getChatRoom(); }, [getChatRoom]);
  const start = () => { if (busy) return; newChat(); clearError(); setExpanded(false); };
  const remove = async (id: number) => {
    if (busy) return;
    setDeleting(id);
    try { if (await deleteChatroom(id)) clearError(); } finally { setDeleting(null); }
  };
  const signout = async () => {
    if (!await logout()) useToastStore.getState().showToast(useAuthStore.getState().error || "로그아웃하지 못했습니다.");
  };
  return (
    <>
      <button className="mobile-menu" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="sidebar">{expanded ? "메뉴 닫기" : "메뉴"}</button>
      <aside id="sidebar" className={`sidebar ${expanded ? "is-open" : ""}`}>
        <a className="sidebar-brand" href="/Main">MoleLaw</a>
        <button className="new-chat" disabled={busy} onClick={start}>＋ 새 상담</button>
        <h2>상담 기록</h2>
        <nav className="room-list" aria-label="상담 기록">
          {!chatRooms.length && !listLoading && <p className="muted">아직 상담 기록이 없습니다.</p>}
          {chatRooms.map((room) => <div key={room.id} className={`room-row ${selectedChatRoomID === room.id ? "selected" : ""}`}>
            {editing === room.id ? <form className="room-rename-form" onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setRenaming(true);
              try { if (await renameChatroom(room.id, title)) setEditing(null); }
              finally { setRenaming(false); }
            }}>
              <input autoFocus aria-label="상담방 이름" value={title} required disabled={busy}
                onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && !renaming) setEditing(null); }} />
              <div className="button-row"><button type="submit" disabled={busy || !title.trim() || [...title.trim()].length > 255}>저장</button>
                <button type="button" disabled={renaming} onClick={() => setEditing(null)}>취소</button></div>
              {[...title.trim()].length > 255 && <small role="alert">상담방 이름은 255자 이내로 입력해 주세요.</small>}
            </form> : <>
            <button className="room-select" disabled={busy} title={room.preview || room.title} aria-current={selectedChatRoomID === room.id ? "true" : undefined}
              onClick={async () => { clearError(); if (await getChatRoomMessage(room.id)) setExpanded(false); }}>{room.title}</button>
            <button className="room-rename" disabled={busy} aria-label={`${room.title} 이름 변경`} onClick={() => { setEditing(room.id); setTitle(room.title); }}>✎</button>
            <button className="room-delete" disabled={busy} aria-label={`${room.title} 삭제`} onClick={() => void remove(room.id)}>×</button>
            </>}
          </div>)}
          {listLoading && <p role="status">기록을 불러오는 중…</p>}
          {hasMore && <button disabled={listLoading || busy} onClick={() => void getChatRoom(true)}>이전 상담 더 보기</button>}
          {error && <div role="alert" className="sidebar-error">{error}<button disabled={listLoading || busy} onClick={() => void getChatRoom()}>목록 다시 불러오기</button></div>}
        </nav>
        <div className="sidebar-bottom">
          <a href="https://www.law.go.kr/" target="_blank" rel="noopener noreferrer">국가법령정보센터 ↗</a>
          <button disabled={busy} onClick={() => setSettings(true)}>계정 설정</button>
          <span className="profile-name">{user?.nickname}</span><small>{user?.email}</small>
          <button disabled={isLoading || busy} onClick={() => void signout()}>로그아웃</button>
        </div>
      </aside>
      {settings && <SettingPanel show={settings} showHandle={() => setSettings(false)} />}
    </>
  );
}
