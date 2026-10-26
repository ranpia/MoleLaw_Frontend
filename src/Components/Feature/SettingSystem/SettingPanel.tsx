import { useState, type FormEvent } from "react";
import { useAuthStore, useToastStore } from "../../../store/storeIndex";
import { validatePassword } from "../../../api/validation";

interface Props { show: boolean; showHandle: () => void }
export default function SettingPanel({ show, showHandle }: Props) {
  const { user, isLoading, changeNickname, changePassword, quit } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [quitOpen, setQuitOpen] = useState(false);
  const notify = (value: string) => { setMessage(value); useToastStore.getState().showToast(value); };
  const changeName = async (e: FormEvent) => { e.preventDefault(); notify(await changeNickname(nickname)); };
  const changePass = async (e: FormEvent) => {
    e.preventDefault();
    if (!validatePassword(password)) { notify("비밀번호는 8~72자 및 UTF-8 72바이트 이내로 입력해 주세요."); return; }
    if (password !== confirm) { notify("비밀번호가 일치하지 않습니다."); return; }
    notify(await changePassword(currentPassword, password));
    setCurrentPassword(""); setPassword(""); setConfirm("");
  };
  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || email !== user?.email || isLoading) return;
    if (!await quit()) notify(useAuthStore.getState().error || "탈퇴에 실패했습니다.");
  };
  if (!show) return null;
  return <div className="modal-backdrop" onClick={() => { if (!isLoading) showHandle(); }}>
    <section className="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Escape" && !isLoading) showHandle(); }}>
      <div className="section-heading"><h2 id="settings-title">계정 설정</h2><button autoFocus disabled={isLoading} onClick={showHandle} aria-label="설정 닫기">×</button></div>
      <p>{user?.email}</p>
      <form className="stack" onSubmit={(e) => void changeName(e)}>
        <label>닉네임<input value={nickname} minLength={2} maxLength={50} required disabled={isLoading} onChange={(e) => setNickname(e.target.value)} /></label>
        <button disabled={isLoading} type="submit">닉네임 저장</button>
      </form>
      <form className="stack" onSubmit={(e) => void changePass(e)}>
        <h3>비밀번호 변경</h3>
        <p className="muted">8~72자, UTF-8 72바이트 이내. 변경 후 다시 로그인해 주세요.</p>
        <label>현재 비밀번호<input type="password" autoComplete="current-password" required disabled={isLoading} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>
        <label>새 비밀번호<input type="password" autoComplete="new-password" required disabled={isLoading} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label>새 비밀번호 확인<input type="password" autoComplete="new-password" required disabled={isLoading} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <button disabled={isLoading} type="submit">비밀번호 변경</button>
      </form>
      {message && <p role="status">{message}</p>}
      <hr />
      <button className="danger" disabled={isLoading} onClick={() => setQuitOpen(!quitOpen)}>회원 탈퇴</button>
      {quitOpen && <form className="stack" onSubmit={(e) => void deleteAccount(e)}>
        <p>탈퇴하면 계정과 상담 기록이 삭제됩니다. 확인을 위해 이메일을 입력해 주세요.</p>
        <label>탈퇴 확인 이메일<input type="email" value={email} disabled={isLoading} onChange={(e) => setEmail(e.target.value)} /></label>
        <button type="submit" className="danger" disabled={isLoading || !email || email !== user?.email}>계정과 상담 기록 삭제</button>
      </form>}
    </section>
  </div>;
}
