import { useState } from "react";
import type { Evidence } from "../../../api/types";

interface Props {
  evidence: Evidence[]; disabled: boolean;
  onApprove: (ids: string[]) => void; onDecline: () => void;
}

export default function CaseSearchConsent({ evidence, disabled, onApprove, onDecline }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const laws = evidence.filter(item => item.kind.startsWith("LAW_"));
  return <section className="consent-card" aria-label="판례 검색 동의">
    <p>관련 판례를 추가로 검색할까요?</p>
    <small>승인하면 이번 질문에 한해 외부 판례 검색과 본문 수집을 진행합니다.</small>
    {laws.length > 0 && <fieldset className="case-search-laws" disabled={disabled}>
      <legend>검색에 참고할 법령 선택 (선택 사항)</legend>
      {laws.map(item => <label key={item.id}>
        <input type="checkbox" checked={selected.includes(item.id)} onChange={event => {
          setSelected(ids => event.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id));
        }} />
        <span>{item.title}</span>
      </label>)}
    </fieldset>}
    <p className="muted">법령을 선택하지 않으면 원래 질문만으로 검색합니다. 여러 법령을 선택할 수 있으며 선택은 이번 검색에만 적용됩니다.</p>
    <div className="button-row">
      <button disabled={disabled} className="primary" onClick={() => onApprove(laws.filter(item => selected.includes(item.id)).map(item => item.id))}>판례 검색 승인</button>
      <button disabled={disabled} onClick={onDecline}>지금은 검색하지 않기</button>
    </div>
  </section>;
}
