import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Evidence } from "../../../store/types";

export default function MarkdownMessage({ content, evidence, onEvidence }: { content: string; evidence: Evidence[]; onEvidence: (id: string) => void }) {
  const formatted = content.replace(/\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]\]/g, (original, id: string) => {
    const index = evidence.findIndex((item) => item.id === id);
    return index < 0 ? original : `[근거 ${index + 1}](#evidence-${id})`;
  });
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => href?.startsWith("#evidence-")
      ? <a href={href} className="citation" onClick={(event) => { event.preventDefault(); onEvidence(href.slice(10)); }}>{children}</a>
      : <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  }}>{formatted}</ReactMarkdown></div>;
}
