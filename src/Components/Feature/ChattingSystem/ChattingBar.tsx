import { useEffect, useRef, useState } from "react";
import { validateQuestion } from "../../../api/validation";

interface Props {
  onSubmit: (message: string) => Promise<boolean>; disabled: boolean; onEdit: () => void;
}
export default function ChattingBar({ onSubmit, disabled, onEdit }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = `${Math.min(ref.current.scrollHeight, 180)}px`; }
  }, [input]);
  const submit = async () => {
    if (disabled || pending.current) return;
    const invalid = validateQuestion(input);
    if (invalid) { setError(invalid); return; }
    pending.current = true;
    try { if (await onSubmit(input.trim())) setInput(""); }
    finally { pending.current = false; }
  };
  const count = [...input].length;
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="sr-only" htmlFor="question">법률 질문</label>
      <textarea id="question" ref={ref} value={input} disabled={disabled} placeholder="어떤 고민이 있으신가요?"
        onChange={(e) => { setInput(e.target.value); setError(null); onEdit(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault(); void submit();
          }
        }} />
      <div className="composer-footer"><small className={count > 2000 ? "error" : "muted"}>{count.toLocaleString()} / 2,000자 · Shift+Enter 줄바꿈</small>
        <button className="primary" disabled={disabled || !input.trim() || count > 2000} type="submit">질문 보내기</button></div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
