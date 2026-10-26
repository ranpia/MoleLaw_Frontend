import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

// Uses only a new disposable account. Never logs or persists credentials/cookies.
const base = (process.env.API_URL || 'http://localhost:8080/api').replace(/\/$/, '');
const email = `frontend-check-${randomUUID()}@example.com`;
let password = `Check-${randomUUID()}!`;
const cookies = new Map();
const results = [];
let created = false;
async function request(method, path, body, csrf = true) {
  let token;
  if (csrf && method !== 'GET') token = (await request('GET', '/auth/csrf')).data.token;
  const target = new URL(`${base}${path}`);
  const response = await new Promise((resolve, reject) => {
    const timeout = path.startsWith('/chat-rooms') && method === 'POST' ? 1_200_000 : 20_000;
    const payload = body ? JSON.stringify(body) : undefined;
    const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = send(target, {
      method, headers: { Cookie: [...cookies.values()].filter((c) => target.pathname.startsWith(c.path)).map((c) => `${c.name}=${c.value}`).join('; '),
        ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'X-XSRF-TOKEN': token } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, cookies: res.headers['set-cookie'] || [], text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('API request timed out')));
    req.end(payload);
  });
  for (const header of response.cookies) {
    const [name, ...value] = header.split(';')[0].split('=');
    const cookiePath = /(?:^|;)\s*Path=([^;]+)/i.exec(header)?.[1] || '/';
    const key = `${name}|${cookiePath}`;
    if (/max-age=0(?:;|$)/i.test(header)) cookies.delete(key); else cookies.set(key, { name, value: value.join('='), path: cookiePath });
  }
  const text = response.text;
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, text };
}
function check(name, result, expected, validate = () => {}) {
  assert.equal(result.status, expected, `${name}: expected ${expected}, received ${result.status}`);
  validate(result.data);
  results.push({ name, status: result.status });
  console.log(`PASS ${name} (${result.status})`);
}
try {
  check('unauthenticated profile', await request('GET', '/users/me'), 401);
  check('CSRF required for login', await request('POST', '/auth/login', { email, password }, false), 403);
  check('CSRF JSON', await request('GET', '/auth/csrf'), 200, (d) => { assert.equal(d.headerName, 'X-XSRF-TOKEN'); assert.ok(d.token); });
  const signup = await request('POST', '/auth/signup', { email, password, nickname: '프론트검증' });
  created = signup.status === 200;
  check('signup', signup, 200, (d) => assert.equal(d.success, true));
  check('profile envelope', await request('GET', '/users/me'), 200, (d) => assert.equal(d.data.email, email));
  check('blank question rejected before AI', await request('POST', '/chat-rooms', { content: ' ' }), 400, (d) => assert.equal(d.error.code, 'INVALID_REQUEST'));
  check('room list array', await request('GET', '/chat-rooms?page=0&size=20'), 200, (d) => assert.deepEqual(d, []));
  check('blank suggestion rejected', await request('POST', '/legal-answers/suggestions', { query: ' ' }), 400);
  const longDraft = '가'.repeat(1990);
  check('long draft suggestion preserves original', await request('POST', '/legal-answers/suggestions', { query: longDraft }), 200, d => {
    assert.equal(d.suggestedQuestions.length, 1); assert.equal(d.suggestedQuestions[0].question, longDraft);
  });
  if (process.argv.includes('--suggestions')) {
    const query = '시공 하자와 관리 소홀이 함께 사고를 일으킨 경우 책임이 궁금합니다.';
    check('real model initial question suggestions', await request('POST', '/legal-answers/suggestions', { query }), 200, d => {
      assert.ok(d.suggestedQuestions.length >= 1 && d.suggestedQuestions.length <= 3);
      for (const item of d.suggestedQuestions) { assert.ok(item.id && item.label); assert.ok(item.question.includes(query)); assert.ok([...item.question].length <= 2000); }
    });
  }
  check('suggestions do not create rooms', await request('GET', '/chat-rooms?page=0&size=20'), 200, d => assert.deepEqual(d, []));
  check('evidence ownership / missing room', await request('GET', '/chat-rooms/9223372036854775807/evidence'), 404);
  check('nickname update empty body', await request('PATCH', '/users/me/nickname', { newNickname: '프론트검증변경' }), 200, (d) => assert.equal(d, ''));
  check('updated profile', await request('GET', '/users/me'), 200, (d) => assert.equal(d.data.nickname, '프론트검증변경'));
  check('refresh response envelope', await request('POST', '/auth/refresh'), 200, (d) => assert.ok(d.data.accessToken));
  check('logout', await request('POST', '/auth/logout'), 200);
  check('logged out profile', await request('GET', '/users/me'), 401);
  check('login raw access response', await request('POST', '/auth/login', { email, password }), 200, (d) => assert.ok(d.accessToken));
  const newPassword = `Updated-${randomUUID()}!`;
  check('missing current password rejected', await request('PATCH', '/users/me/password', { newPassword }), 400);
  check('wrong current password rejected', await request('PATCH', '/users/me/password', { currentPassword: 'Wrong-password!123', newPassword }), 400, (d) => assert.equal(d.error.code, 'PASSWORD_FAIL'));
  check('refresh preserved after wrong password', await request('POST', '/auth/refresh'), 200);
  check('rename missing room', await request('PATCH', '/chat-rooms/9223372036854775807/title', { title: '새 상담 이름' }), 404);
  check('password update empty body', await request('PATCH', '/users/me/password', { currentPassword: password, newPassword }), 200, (d) => assert.equal(d, ''));
  password = newPassword;
  check('logout after password change', await request('POST', '/auth/logout'), 200);
  check('login with changed password', await request('POST', '/auth/login', { email, password }), 200);
  if (process.argv.includes('--consultation')) {
    console.log('START real first consultation (AI/retrieval enabled; no automatic retries)');
    const turn = await request('POST', '/chat-rooms', { content: '민법 제2조의 신의성실 원칙에 관한 일반적인 법령 설명이 필요합니다.' });
    if (turn.status !== 200) console.log(`Consultation returned ${turn.status} / ${turn.data?.error?.code || 'unknown'}`);
    check('real first consultation', turn, 200, (d) => { assert.ok(d.id); assert.ok(d.messages.some((m) => m.sender === 'BOT')); });
    const room = turn.data.id;
    check('rename disposable conversation', await request('PATCH', `/chat-rooms/${room}/title`, { title: '  변경한 상담 이름 😀  ' }), 204);
    check('renamed conversation persisted', await request('GET', '/chat-rooms?page=0&size=20'), 200, (d) => assert.equal(d.find(r => r.id === room)?.title, '변경한 상담 이름 😀'));
    check('persisted conversation', await request('GET', `/chat-rooms/${room}/messages`), 200, (d) => assert.ok(d.some((m) => m.sender === 'BOT')));
    const evidence = await request('GET', `/chat-rooms/${room}/evidence`);
    check('real evidence list', evidence, 200, (d) => assert.ok(d.length));
    check('real evidence body', await request('GET', `/chat-rooms/${room}/evidence/${evidence.data[0].id}`), 200, (d) => { assert.equal(d.evidence.id, evidence.data[0].id); assert.ok(d.content); });
    check('real follow-up question', await request('POST', `/chat-rooms/${room}/messages`, { content: '방금 설명한 원칙을 한 문장으로 요약해 주세요.', allowCaseSearch: false }), 200, (d) => assert.equal(d.sender, 'BOT'));
    check('delete disposable conversation', await request('DELETE', `/chat-rooms/${room}`), 204);
  }
} finally {
  if (created) {
    if ((await request('GET', '/users/me')).status === 401) await request('POST', '/auth/login', { email, password });
    check('delete disposable account', await request('DELETE', '/users/me'), 204);
    check('deleted account session cleared', await request('GET', '/users/me'), 401);
  }
  console.log(`${results.length} API contract checks passed; credentials not persisted.`);
}
