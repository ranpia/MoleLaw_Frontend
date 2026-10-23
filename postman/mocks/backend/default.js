/* Contract fixture based on localhost:8080/v3/api-docs (2026-10-23).
 * Used only for frontend paths with expensive AI calls and controlled failures.
 * No owner mock was pulled: Postman CLI is signed out.
 */
const http = require('http');
const uuid = '00000000-0000-0000-0000-000000000001';
const evidence = { id: uuid, kind: 'LAW', sourceId: '123', title: '민법 제2조(신의성실)', sourceUrl: 'https://www.law.go.kr/법령/민법/제2조', lawId: '001706', effectiveDate: '20260101' };
const bot = (content, consent = false) => ({ sender: 'BOT', content, timestamp: '2026-10-23T07:00:00', caseSearchRequested: consent });
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(data === undefined ? '' : JSON.stringify(data)); };
  let state = await pm.state.get('molelaw-fixture');
  if (!state) { state = { messages: [{ sender: 'USER', content: '신의성실 원칙을 설명해 주세요.' }, bot(`신의에 좇아 성실히 이행해야 합니다. [[${uuid}]]`, true)], rooms: [{ id: 42, title: '신의성실 상담', preview: '신의성실 원칙', createdAt: '2026-10-23T07:00:00' }, ...Array.from({ length: 20 }, (_, index) => ({ id: index + 43, title: `이전 상담 ${index + 1}`, preview: '페이지 처리 검증', createdAt: '2026-10-22T07:00:00' }))], posts: [] }; await pm.state.set('molelaw-fixture', state); }
  if (path === '/api/auth/csrf' && req.method === 'GET') { res.setHeader('Set-Cookie', 'XSRF-TOKEN=fixture-token; Path=/; SameSite=Lax'); return send(200, { token: 'fixture-token', headerName: 'X-XSRF-TOKEN' }); }
  if (path === '/api/users/me' && req.method === 'GET') return send(200, { success: true, data: { email: 'fixture@example.com', nickname: '검증사용자' } });
  if (path === '/api/chat-rooms' && req.method === 'GET') {
    const size = Number(url.searchParams.get('size') || 20), page = Number(url.searchParams.get('page') || 0);
    return send(200, state.rooms.slice(page * size, (page + 1) * size));
  }
  if (path === '/api/chat-rooms/42/messages' && req.method === 'GET') return send(200, state.messages);
  if (path === '/api/chat-rooms/42/evidence' && req.method === 'GET') return send(200, [evidence]);
  if (path === `/api/chat-rooms/42/evidence/${uuid}` && req.method === 'GET') return send(200, { evidence, content: '<b>원문 표기</b> 권리의 행사와 의무의 이행은 신의에 좇아 성실히 하여야 한다.', caseInfo: null });
  if (req.method === 'POST' && (path === '/api/chat-rooms' || path === '/api/chat-rooms/42/messages')) {
    if (req.headers['x-xsrf-token'] !== 'fixture-token') return send(403);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    state.posts.push({ path, content: body?.content, allowCaseSearch: body?.allowCaseSearch });
    await pm.state.set('molelaw-fixture', state);
    if (body?.content === '근거 부족 검증') return send(422, { success: false, error: { status: 422, code: 'EVIDENCE_INSUFFICIENT', message: '확보한 근거가 충분하지 않습니다. 질문을 구체화해 주세요.' } });
    if (body?.content === '서버 장애 검증') return send(503, { success: false, error: { status: 503, code: 'RETRIEVAL_UNAVAILABLE', message: '법령 근거 검색을 사용할 수 없습니다. 잠시 후 다시 시도하세요.' } });
    const answer = bot(`근거를 확인했습니다. [[${uuid}]]`);
    state.messages.push({ sender: 'USER', content: body.content }, answer);
    await pm.state.set('molelaw-fixture', state);
    return setTimeout(() => send(200, path === '/api/chat-rooms' ? { id: 42, messages: state.messages } : answer), 900);
  }
  // Test-only fixture diagnostics; not part of the application API.
  if (path === '/__fixture/requests') return send(200, state.posts);
  return send(501, { error: 'This contract fixture does not model this endpoint.' });
}).listen(process.env.PORT || 4901);
