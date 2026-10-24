import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../../api/client";
import { chatApi } from "../../../api/chat";
import { useDataStore } from "../../../store/storeIndex";
import type { EvidenceDetail } from "../../../api/types";

function sourceUrl(value: string) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}
export default function EvidencePanel({ roomId, activeId, onSelect }: { roomId: number; activeId: string | null; onSelect: (id: string | null) => void }) {
  const { evidence, evidenceError, loadEvidence } = useDataStore();
  const [details, setDetails] = useState<Record<string, EvidenceDetail>>({});
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const active = evidence.find((item) => item.id === activeId);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    setError(null); setLoading(false);
    if (!activeId || !evidence.some((item) => item.id === activeId)) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (details[activeId]) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    void chatApi.evidenceDetail(roomId, activeId, controller.signal).then((data) => {
      if (!controller.signal.aborted) setDetails((old) => ({ ...old, [activeId]: data }));
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(errorMessage(reason, "근거 본문을 불러오지 못했습니다.")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeId, roomId, retry, evidence, details]);
  return <aside className="evidence-panel" ref={ref} aria-label="상담 근거">
    <h2>상담 근거 <span className="muted">{evidence.length}</span></h2>
    <p className="muted">답변의 근거 번호를 누르면 상담에 사용한 원문을 확인할 수 있습니다.</p>
    {evidenceError && <div role="alert" className="error"><p>{evidenceError}</p><button onClick={() => void loadEvidence(roomId)}>근거 다시 불러오기</button></div>}
    {!evidence.length && !evidenceError && <p>표시할 근거가 없습니다.</p>}
    <ol className="evidence-list">{evidence.map((item, index) => <li key={item.id} id={`evidence-${item.id}`}>
      <button className={activeId === item.id ? "active" : ""} onClick={() => onSelect(activeId === item.id ? null : item.id)} aria-expanded={activeId === item.id}>
        <span className="evidence-number">{index + 1}</span><span>{item.title}<small>{item.kind.startsWith("CASE") ? (item.kind === "CASE_METADATA" ? "판례 메타데이터" : "판례") : "법령"}{item.effectiveDate ? ` · 시행 ${item.effectiveDate}` : ""}</small></span>
      </button>
    </li>)}</ol>
    {active && <section className="evidence-detail" aria-label="근거 본문">
      <h3>{active.title}</h3>
      {sourceUrl(active.sourceUrl) && <a href={sourceUrl(active.sourceUrl)} target="_blank" rel="noopener noreferrer">공식 출처 보기 ↗</a>}
      {loading && <p role="status">원문을 불러오는 중…</p>}
      {error && <div role="alert"><p className="error">{error}</p><button onClick={() => setRetry(retry + 1)}>본문 다시 불러오기</button></div>}
      {details[active.id] && <>
        {details[active.id].caseInfo && <p className="muted">{[details[active.id].caseInfo?.courtName, details[active.id].caseInfo?.caseNumber, details[active.id].caseInfo?.decisionDate].filter(Boolean).join(" · ")}</p>}
        <pre>{details[active.id].content}</pre>
      </>}
    </section>}
  </aside>;
}
