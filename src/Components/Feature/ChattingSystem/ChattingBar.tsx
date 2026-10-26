import { useEffect, useRef, useState } from "react";
import { validateQuestion } from "../../../api/validation";
import { chatApi } from "../../../api/chat";
import { errorMessage } from "../../../api/client";
import type { SuggestedQuestion } from "../../../api/types";

interface Props {
  onSubmit: (message: string) => Promise<boolean>; disabled: boolean; onEdit: () => void; suggestInitial?: boolean;
}
export default function ChattingBar({ onSubmit, disabled, onEdit, suggestInitial = false }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef(false);
  const [suggestions, setSuggestions] = useState<SuggestedQuestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const suggestionRequest = useRef<AbortController | null>(null);
  useEffect(() => () => suggestionRequest.current?.abort(), []);
  const cancelSuggestions = () => {
    suggestionRequest.current?.abort();
    suggestionRequest.current = null;
    setSuggesting(false); setSuggestions([]);
  };
  useEffect(() => {
    if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = `${Math.min(ref.current.scrollHeight, 180)}px`; }
  }, [input]);
  const submit = async (question = input.trim()) => {
    if (disabled || suggesting || pending.current) return;
    const invalid = validateQuestion(question);
    if (invalid) { setError(invalid); return; }
    pending.current = true;
    try { if (await onSubmit(question)) { setInput(""); setSuggestions([]); } }
    finally { pending.current = false; }
  };
  const suggest = async () => {
    if (disabled || pending.current || suggestionRequest.current) return;
    const invalid = validateQuestion(input);
    if (invalid) { setError(invalid); return; }
    const controller = new AbortController();
    suggestionRequest.current = controller;
    setSuggesting(true); setError(null); setSuggestions([]);
    try {
      const items = await chatApi.suggest(input.trim(), controller.signal);
      if (!controller.signal.aborted) setSuggestions(items);
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason, "질문을 다듬지 못했습니다. 원문으로 질문하거나 다시 시도해 주세요."));
    } finally {
      if (suggestionRequest.current === controller) { suggestionRequest.current = null; setSuggesting(false); }
    }
  };
  const count = [...input].length;
  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <label className="sr-only" htmlFor="question">법률 질문</label>
      <textarea id="question" ref={ref} value={input} disabled={disabled} placeholder="어떤 고민이 있으신가요?"
        onChange={(e) => { cancelSuggestions(); setInput(e.target.value); setError(null); onEdit(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault(); void submit();
          }
        }} />
      <div className="composer-footer"><small className={count > 2000 ? "error" : "muted"}>{count.toLocaleString()} / 2,000자 · Shift+Enter 줄바꿈</small>
        <div className="button-row">
          {suggestInitial && <button type="button" disabled={disabled || suggesting || !input.trim() || count > 2000} onClick={() => void suggest()}>질문 다듬기</button>}
          <button className="primary" disabled={disabled || suggesting || !input.trim() || count > 2000} type="submit">{suggestInitial ? "원문으로 질문" : "질문 보내기"}</button>
        </div></div>
      {suggesting && <p role="status">질문을 다듬고 있습니다… <button type="button" onClick={cancelSuggestions}>취소</button></p>}
      {suggestInitial && suggestions.length > 0 && <section className="question-suggestions" aria-label="추천 질문">
        <p>어떤 방향으로 상담할까요?</p><small className="muted">선택한 질문으로 상담을 시작합니다.</small>
        {suggestions.map((item, index) => <div className="question-suggestion" key={`${item.id}:${index}`}>
          <strong>{item.label}</strong><p>{item.question}</p>
          <button type="button" disabled={disabled} onClick={() => void submit(item.question)}>이 질문으로 상담 시작</button>
        </div>)}
        <button type="button" disabled={disabled} onClick={cancelSuggestions}>추천 닫기</button>
      </section>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
