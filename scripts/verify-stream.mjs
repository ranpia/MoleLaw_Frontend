import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function load(path, dependencies = {}) {
  let code = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [name, source] of Object.entries(dependencies)) code = code.replaceAll(`"${name}"`, JSON.stringify(moduleUrl(source)));
  return import(moduleUrl(code));
}
const { streamFirstAnswer, streamFollowUp } = await load('src/api/stream.ts', {
  './client': 'export const api = { get: async () => ({}) }; export const getCsrf = async () => ({ headerName: "X-XSRF-TOKEN", token: "test-token" }); export const getSessionVersion = () => 0;',
  './config': 'export const API_BASE_URL = "/api";',
});
const { createDraftWriter } = await load('src/store/chat/draftWriter.ts');
const originalFetch = globalThis.fetch;
let requests = [];
function response(events, options = {}) {
  requests = [];
  const bytes = new TextEncoder().encode(events.map(e => JSON.stringify(e)).join('\r\n') + (options.finalNewline ? '\n' : ''));
  globalThis.fetch = async (url, init) => {
    requests.push({ url, ...init });
    return new Response(new ReadableStream({ start(controller) {
      // One byte per chunk exercises UTF-8 characters and JSON line boundaries.
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
  };
}
try {
  const room = { id: 7, messages: [{ sender: 'BOT', content: '최종 답변' }] };
  response([{ type: 'heartbeat' }, { type: 'answer_delta', delta: '한글🙂' }, { type: 'completed', room }]);
  const seen = [];
  assert.deepEqual(await streamFirstAnswer('질문', e => seen.push(e), new AbortController().signal), room);
  assert.equal(seen[1].delta, '한글🙂');
  assert.equal(requests[0].headers.Accept, 'application/x-ndjson');
  assert.equal(requests[0].credentials, 'include');
  console.log('PASS split UTF-8, CRLF, heartbeat and final line without newline');

  const messageResult = { sender: 'BOT', content: '후속 답변', caseSearchRequested: true };
  response([{ type: 'completed', messageResult }], { finalNewline: true });
  assert.deepEqual(await streamFollowUp(7, '추가 질문', false, () => {}, new AbortController().signal), messageResult);
  assert.equal(requests[0].url, '/api/chat-rooms/7/messages/ndjson');
  assert.deepEqual(JSON.parse(requests[0].body), { content: '추가 질문', allowCaseSearch: false });
  console.log('PASS follow-up completion and explicit consent payload');
  const evidence = { id: '00000000-0000-0000-0000-000000000001', kind: 'LAW_CHUNK', title: '법령', sourceUrl: 'https://www.law.go.kr', sourceId: '1' };
  const snapshots = [];
  response([{ type: 'evidence', evidence: { roomId: 7, state: 'PREVIEW', items: [evidence, evidence] } },
    { type: 'evidence', evidence: { roomId: 7, state: 'PREVIEW', items: [] } },
    { type: 'progress', stage: 'ANSWER_REPAIR' },
    { type: 'evidence', evidence: { roomId: 7, state: 'SAVED', items: [evidence] } },
    { type: 'completed', response: { answer: '교정된 답변' }, messageResult }]);
  const repaired = await streamFollowUp(7, '질문', false, e => snapshots.push(e), new AbortController().signal);
  assert.equal(repaired.content, '교정된 답변');
  assert.deepEqual(snapshots.filter(e => e.type === 'evidence').map(e => e.evidence.items.length), [1, 0, 1]);
  response([{ type: 'evidence', evidence: { roomId: null, state: 'SAVED', items: [] } }]);
  await assert.rejects(streamFirstAnswer('질문', () => {}, new AbortController().signal), /근거 목록/);
  console.log('PASS evidence snapshots deduplicate, replace with empty list, saved validation and repaired final answer');
  const lawIds = Array.from({ length: 6 }, (_, i) => `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`);
  response([{ type: 'completed', messageResult }]);
  await streamFollowUp(7, '승인', true, () => {}, new AbortController().signal, [...lawIds, lawIds[0]]);
  assert.deepEqual(JSON.parse(requests[0].body).caseSearchLawEvidenceIds, lawIds);
  response([{ type: 'completed', messageResult }]);
  await streamFollowUp(7, '승인', true, () => {}, new AbortController().signal, []);
  assert.deepEqual(JSON.parse(requests[0].body).caseSearchLawEvidenceIds, []);
  requests = [];
  await assert.rejects(streamFollowUp(7, '일반 질문', false, () => {}, new AbortController().signal, lawIds), /승인/);
  assert.equal(requests.length, 0);
  console.log('PASS optional law context: uncapped selection, deduplication, empty selection and consent required');

  response([{ type: 'answer_delta', delta: '임시' }, { type: 'error', message: '근거 부족' }]);
  await assert.rejects(streamFirstAnswer('질문', () => {}, new AbortController().signal), /근거 부족/);
  assert.equal(requests.length, 1);
  response([{ type: 'heartbeat' }]);
  await assert.rejects(streamFirstAnswer('질문', () => {}, new AbortController().signal), /연결이 종료/);
  response([{ type: 'completed' }]);
  await assert.rejects(streamFollowUp(7, '질문', false, () => {}, new AbortController().signal), /저장된 후속/);
  console.log('PASS error event, interrupted stream, missing result; no replay');

  const controller = new AbortController();
  const updates = [];
  const writer = createDraftWriter(text => updates.push(text), controller.signal);
  writer.append('한글🙂가나다라마바사');
  assert.deepEqual(updates, []);
  await writer.drain();
  assert.ok(updates.length > 1);
  assert.equal(updates.at(-1), '한글🙂가나다라마바사');
  writer.append('버릴 초안'); writer.reset(); await writer.drain();
  assert.equal(updates.at(-1), '');
  writer.append('교정 초안'); await writer.drain();
  assert.equal(updates.at(-1), '교정 초안');
  writer.append('취소될 글자');
  const drained = writer.drain();
  controller.abort();
  await drained;
  assert.equal(updates.at(-1), '교정 초안');
  writer.dispose();
  console.log('PASS paced draft output, Unicode and cancellation');
} finally { globalThis.fetch = originalFetch; }
