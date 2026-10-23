import { useState, type FormEvent } from "react";
import { useAuthStore, useToastStore } from "../../../store/storeIndex";
import { validatePassword } from "../../../api/validation";
import ReactMarkdown from "react-markdown";
import { TermsOfUseText } from "../../../data/TermsofUse";

export default function LoginPanel() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState("");
  const { LocalLogin, LocalSignUp, googleLogin, kakaoLogin, isLoading } = useAuthStore();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    if (mode === "signup") {
      if (!validatePassword(password)) { setMessage("비밀번호는 8~72자 및 UTF-8 72바이트 이내로 입력해 주세요."); return; }
      if (password !== confirm) { setMessage("비밀번호가 일치하지 않습니다."); return; }
      if (!agreed) { setMessage("이용 약관에 동의해 주세요."); return; }
    }
    const result = mode === "login" ? await LocalLogin(email, password) : await LocalSignUp(email, password, nickname);
    setMessage(result);
    useToastStore.getState().showToast(result);
  };
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <img className="brand-mark" src="/PointCircle.svg" alt="" />
        <h1 id="auth-title">MoleLaw</h1>
        <p className="muted">법령과 근거를 함께 살펴보는 법률 상담</p>
        <div className="auth-tabs">
          {(["login", "signup"] as const).map((value) => <button key={value} type="button" disabled={isLoading} aria-pressed={mode === value}
            onClick={() => { setMode(value); setMessage(""); setPassword(""); setConfirm(""); }}>{value === "login" ? "로그인" : "회원가입"}</button>)}
        </div>
        <form onSubmit={(event) => void submit(event)} className="stack">
          <label>이메일<input type="email" required maxLength={254} autoComplete="email" value={email} disabled={isLoading} onChange={(e) => setEmail(e.target.value)} /></label>
          {mode === "signup" && <label>닉네임<input required minLength={2} maxLength={50} autoComplete="nickname" value={nickname} disabled={isLoading} onChange={(e) => setNickname(e.target.value)} /><small>2~50자</small></label>}
          <label>비밀번호<input type="password" required maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} disabled={isLoading} onChange={(e) => setPassword(e.target.value)} />
            {mode === "signup" && <small>8~72자 · UTF-8 72바이트 이내</small>}</label>
          {mode === "signup" && <>
            <label>비밀번호 확인<input type="password" required autoComplete="new-password" value={confirm} disabled={isLoading} onChange={(e) => setConfirm(e.target.value)} /></label>
            <details className="terms"><summary>이용 약관 · 개인정보 수집 및 이용</summary><ReactMarkdown>{TermsOfUseText}</ReactMarkdown></details>
            <label className="checkbox-label"><input type="checkbox" checked={agreed} disabled={isLoading} onChange={(e) => setAgreed(e.target.checked)} />이용 약관에 동의합니다.</label>
          </>}
          {message && <p role="alert" className="error">{message}</p>}
          <button className="primary" type="submit" disabled={isLoading}>{isLoading ? "처리 중…" : mode === "login" ? "로그인" : "회원가입"}</button>
        </form>
        <div className="social-logins">
          <button disabled={isLoading} onClick={googleLogin}>Google로 로그인</button>
          <button disabled={isLoading} onClick={kakaoLogin}>카카오로 로그인</button>
        </div>
      </section>
    </main>
  );
}
