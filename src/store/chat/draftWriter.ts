// Pace presentation independently of network chunks; preserve Unicode characters.
export function createDraftWriter(onText: (text: string) => void, signal: AbortSignal) {
  let queue = "";
  let displayed = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished: (() => void) | undefined;
  const tick = () => {
    const points = Array.from(queue);
    const count = Math.max(3, Math.ceil(points.length / 260));
    displayed += points.slice(0, count).join("");
    queue = points.slice(count).join("");
    onText(displayed);
    if (queue) timer = setTimeout(tick, 30);
    else { timer = undefined; finished?.(); finished = undefined; }
  };
  const stop = () => { clearTimeout(timer); timer = undefined; queue = ""; finished?.(); finished = undefined; };
  signal.addEventListener("abort", stop, { once: true });
  return {
    append(delta: string) { if (signal.aborted) return; queue += delta; if (queue && timer === undefined) timer = setTimeout(tick, 30); },
    drain: () => timer === undefined ? Promise.resolve() : new Promise<void>((resolve) => { finished = resolve; }),
    reset() { stop(); displayed = ""; onText(""); },
    dispose() { stop(); signal.removeEventListener("abort", stop); },
  };
}
