import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// No browser package needed: isolated headless Chrome via the DevTools protocol.
const mode = process.argv[2] || 'live';
const origin = ['simulation', 'account', 'suggestions', 'cases'].includes(mode) ? 'http://localhost:5174' : 'http://localhost:5173';
const directory = resolve('.artifacts.local', `browser-${mode}-${Date.now()}`);
await mkdir(directory, { recursive: true });
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0',
  `--user-data-dir=${directory}`, '--no-first-run', '--no-default-browser-check', 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
let socket;
let accountCreated = false;
let id = 0;
const pending = new Map();
const exceptions = [];
const responses = [];
const requests = [];
const results = [];
const email = `frontend-browser-${randomUUID()}@example.com`;
const password = `Check-${randomUUID()}!`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, name, timeout = 25_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { try { const result = await fn(); if (result) return result; } catch { /* startup/navigation */ } await pause(150); }
  throw new Error(`Timed out: ${name}`);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => { pending.delete(key); reject(new Error(`CDP timeout: ${method}`)); }, 25_000);
    pending.set(key, { resolve: (r) => { clearTimeout(timer); resolve(r); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
}
async function evaluate(expression) {
  const data = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (data.exceptionDetails) throw new Error(data.exceptionDetails.text);
  return data.result.value;
}
const value = (selector, text) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Input missing'); Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const clickText = (text) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!b) throw Error('Button missing'); b.click(); })()`);
const exists = (selector) => evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
function pass(name) { results.push(name); console.log(`PASS ${name}`); }
try {
  const port = await until(async () => (await readFile(resolve(directory, 'DevToolsActivePort'), 'utf8')).split('\n')[0], 'Chrome debugging');
  const debug = `http://127.0.0.1:${port}`;
  const tab = await (await fetch(`${debug}/json/new?${encodeURIComponent(origin)}`, { method: 'PUT' })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) { const task = pending.get(message.id); if (task) { pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); } }
    else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text);
    else if (message.method === 'Network.responseReceived' && new URL(message.params.response.url).pathname.startsWith('/api/')) responses.push({ path: new URL(message.params.response.url).pathname, status: message.params.response.status });
    else if (message.method === 'Network.requestWillBeSent' && new URL(message.params.request.url).pathname.startsWith('/api/')) {
      const req = message.params.request;
      const headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key.toLowerCase(), value]));
      requests.push({ path: new URL(req.url).pathname, method: req.method, contentType: headers['content-type'], csrfPresent: !!headers['x-xsrf-token'] });
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  if (mode === 'cases') {
    await until(() => exists('.room-select'), 'room list');
    await evaluate("document.querySelector('.room-select').click()");
    await until(() => evaluate("document.querySelectorAll('.case-search-laws input').length === 6"), 'law choices');
    assert.equal(await evaluate("document.querySelectorAll('.case-search-laws input:checked').length"), 0);
    assert.equal(await evaluate("document.querySelector('.case-search-laws').textContent.includes('기존 판례')"), false);
    await evaluate("document.querySelectorAll('.case-search-laws input').forEach(el=>el.click())");
    await clickText('지금은 검색하지 않기');
    assert.deepEqual(await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json(), []);
    pass('only room LAW_ evidence offered, none preselected; declining sends no search');
    const ask = async content => { await value('#question', content); await evaluate("document.querySelector('.composer').requestSubmit()"); await until(() => evaluate("!document.querySelector('#question').disabled"), 'turn complete'); };
    await ask('판례 검색 요청');
    await until(() => exists('.case-search-laws'), 'new consent');
    assert.equal(await evaluate("document.querySelectorAll('.case-search-laws input:checked').length"), 0);
    await evaluate("document.querySelectorAll('.case-search-laws input').forEach(el=>el.click())");
    await clickText('판례 검색 승인');
    await until(() => evaluate("!document.querySelector('#question').disabled && !document.querySelector('.consent-card')"), 'approved search');
    let posts = await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json();
    assert.equal(posts.at(-1).allowCaseSearch, true);
    assert.equal(posts.at(-1).caseSearchLawEvidenceIds.length, 6);
    assert.equal(new Set(posts.at(-1).caseSearchLawEvidenceIds).size, 6);
    pass('all six selected laws sent through actual follow-up NDJSON; no selection cap');
    await ask('일반 후속 질문');
    posts = await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json();
    assert.equal(posts.at(-1).allowCaseSearch, false);
    assert.equal(posts.at(-1).caseSearchLawEvidenceIds, undefined);
    pass('consent and law selection not reused on ordinary follow-up');
    await ask('판례 검색 요청');
    await until(() => exists('.case-search-laws'), 'next consent');
    assert.equal(await evaluate("document.querySelectorAll('.case-search-laws input:checked').length"), 0);
    await clickText('판례 검색 승인');
    await until(() => evaluate("!document.querySelector('#question').disabled && !document.querySelector('.consent-card')"), 'unfiltered search');
    posts = await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json();
    assert.equal(posts.at(-1).allowCaseSearch, true);
    assert.deepEqual(posts.at(-1).caseSearchLawEvidenceIds, []);
    pass('next consent starts empty; empty selection searches using original request');
  } else if (mode === 'suggestions') {
    await until(() => exists('.welcome'), 'new consultation');
    await value('#question', '사고 책임을 확인하고 싶습니다.');
    await clickText('질문 다듬기');
    await clickText('질문 다듬기');
    await until(() => exists('.question-suggestion'), 'suggestions');
    assert.equal(await exists('.conversation .question-suggestion'), true);
    assert.equal(await exists('.composer .question-suggestion'), false);
    assert.equal(requests.filter(r => r.path === '/api/legal-answers/suggestions').length, 1);
    assert.equal(requests.filter(r => r.path === '/api/chat-rooms/ndjson').length, 0);
    assert.equal(await evaluate("document.querySelectorAll('.user-message').length"), 0);
    await writeFile(resolve(directory, 'suggestions-desktop.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    pass('explicit suggestion request only; duplicate prevented; no consultation started');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await pause(150);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
    await writeFile(resolve(directory, 'suggestions-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await value('#question', '지연 추천 검증');
    assert.equal(await exists('.question-suggestion'), false);
    await clickText('질문 다듬기');
    await value('#question', '수정한 원문');
    await pause(1000);
    assert.equal(await exists('.question-suggestion'), false);
    assert.equal(await evaluate("document.querySelector('#question').value"), '수정한 원문');
    pass('editing cancels pending suggestion and discards stale response; mobile suggestions fit');
    await clickText('질문 다듬기');
    await until(() => exists('.question-suggestion'), 'updated suggestions');
    const selected = await evaluate("document.querySelector('.question-suggestion-text').textContent");
    await evaluate("document.querySelector('.question-suggestion').click(); document.querySelector('.question-suggestion').click()");
    await until(() => exists('.bot-message'), 'chosen question answer');
    await until(() => evaluate("!document.querySelector('#question').disabled"), 'stream completion');
    let posts = await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json();
    assert.equal(posts.length, 1); assert.equal(posts[0].content, selected);
    assert.equal(posts[0].allowCaseSearch, undefined);
    assert.equal(await exists('.question-suggestions'), false);
    assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='질문 다듬기')"), false);
    pass('selected question sent as content through first NDJSON; no search consent implied');
    await value('#question', '후속 질문입니다.');
    await evaluate("document.querySelector('.composer').requestSubmit()");
    await until(() => evaluate("document.querySelectorAll('.bot-message').length === 2 && !document.querySelector('#question').disabled"), 'follow-up answer');
    posts = await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json();
    assert.equal(posts[1].path, '/api/chat-rooms/42/messages/ndjson');
    assert.equal(posts[1].allowCaseSearch, false);
    pass('follow-up bypasses suggestions and keeps consent false');
    await clickText('＋ 새 상담');
    await value('#question', '추천 실패 검증');
    await clickText('질문 다듬기');
    await until(() => exists('.composer [role=alert]'), 'suggestion failure');
    assert.equal(await evaluate("document.querySelector('#question').value"), '추천 실패 검증');
    await clickText('원문으로 질문');
    await until(() => exists('.bot-message'), 'original question fallback');
    posts = await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json();
    assert.equal(posts.length, 3); assert.equal(posts[2].content, '추천 실패 검증');
    pass('suggestion failure retains draft and allows original question');
  } else if (mode === 'account') {
    await until(() => exists('.room-select'), 'fixture room list');
    const originalTitle = await evaluate("document.querySelector('.room-select').textContent");
    await evaluate("document.querySelector('.room-rename').click()");
    await value('.room-rename-form input', '취소할 이름');
    await clickText('취소');
    assert.equal(await evaluate("document.querySelector('.room-select').textContent"), originalTitle);
    await evaluate("document.querySelector('.room-rename').click()");
    await value('.room-rename-form input', '😀'.repeat(256));
    assert.equal(await evaluate("document.querySelector('.room-rename-form button[type=submit]').disabled"), true);
    await value('.room-rename-form input', '  변경한 상담방 😀  ');
    await evaluate("document.querySelector('.room-rename-form').requestSubmit()");
    await until(() => evaluate("document.querySelector('.room-select')?.textContent === '변경한 상담방 😀'"), 'renamed title');
    await send('Page.reload');
    await until(() => evaluate("document.querySelector('.room-select')?.textContent === '변경한 상담방 😀'"), 'persisted title');
    assert.ok(requests.some(r => r.method === 'PATCH' && r.path.endsWith('/title') && r.csrfPresent));
    pass('title cancel, Unicode limit, CSRF PATCH, trimmed title and reload persistence');
    await clickText('계정 설정');
    await value('input[autocomplete=current-password]', 'Wrong-password!123');
    await value('input[autocomplete=new-password]', 'New-fixture!123');
    await value('input[autocomplete=new-password]:not(:first-of-type)', 'New-fixture!123').catch(() => {});
    await evaluate(`(() => { const el = document.querySelectorAll('input[autocomplete=new-password]')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'New-fixture!123'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickText('비밀번호 변경');
    await until(() => evaluate("document.querySelector('.settings-card [role=status]')?.textContent.includes('현재 비밀번호')"), 'password mismatch message');
    assert.equal(await exists('.settings-card'), true);
    pass('wrong current password displays error and preserves authenticated screen');
    await value('input[autocomplete=current-password]', 'Fixture-password!123');
    await value('input[autocomplete=new-password]', 'New-fixture!123');
    await evaluate(`(() => { const el = document.querySelectorAll('input[autocomplete=new-password]')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'New-fixture!123'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickText('비밀번호 변경');
    await until(() => exists('.auth-card'), 'password change login screen');
    assert.ok(responses.some(r => r.path === '/api/users/me/password' && r.status === 200));
    pass('current and new password sent; successful change clears local session');
  } else if (mode === 'live' || mode === 'ndjson') {
    await until(() => exists('.auth-card'), 'login screen');
    pass('real server unauthenticated login screen');
    await clickText('회원가입');
    await value('input[autocomplete=email]', email);
    await value('input[autocomplete=nickname]', '브라우저검증');
    await value('input[autocomplete=new-password]', password);
    await value('input[autocomplete=new-password]:not(:first-of-type)', password).catch(() => {});
    await evaluate(`(() => { const el = document.querySelectorAll('input[autocomplete=new-password]')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(password)}); el.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('input[type=checkbox]').click(); })()`);
    await evaluate("document.querySelector('.auth-card form').requestSubmit()");
    await until(() => exists('.welcome'), 'signup authenticated screen');
    accountCreated = true;
    pass('browser signup, CSRF and authenticated profile');
    if (mode === 'ndjson') {
      await value('#question', '민법 제2조의 신의성실 원칙을 법령 근거와 함께 간단히 설명해 주세요.');
      await evaluate("document.querySelector('.composer').requestSubmit(); document.querySelector('.composer').requestSubmit()");
      await until(() => exists('.loading-dots'), 'loading animation');
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.loading-dots i')).animationName"), 'loading-bounce');
      pass('loading animation is active');
      await until(() => responses.some((r) => r.path === '/api/chat-rooms/ndjson' && r.status === 200), 'NDJSON response', 60_000);
      pass('browser NDJSON request accepted through Vite proxy');
      let sawDraft = false;
      let sawInfo = false;
      let sawProgress = false;
      await until(async () => {
        const state = await evaluate(`({ loading: !!document.querySelector('.loading-dots'), draft: !!document.querySelector('.bot-message small'), info: [...document.querySelectorAll('summary')].some(el => el.textContent === '확인 중인 근거'), progress: document.querySelector('.pending-message')?.textContent, error: document.querySelector('.error-card')?.textContent })`);
        sawDraft ||= state.draft;
        sawInfo ||= state.info;
        sawProgress ||= !!state.progress && !state.progress.includes('질문을 확인하고 있습니다');
        if (state.error) return true;
        return !state.loading;
      }, 'real streamed answer completion', 1_200_000);
      assert.ok(sawProgress, 'server progress rendered');
      assert.ok(sawInfo, 'stream evidence rendered');
      assert.ok(sawDraft, 'partial answer rendered');
      assert.equal(await exists('.error-card'), false);
      assert.ok((await evaluate("document.querySelector('.bot-message')?.textContent || ''")).length > 30);
      assert.equal(requests.filter((r) => r.path === '/api/chat-rooms/ndjson').length, 1);
      pass('progress, evidence, partial answer and final answer rendered; duplicate submission prevented');
      const persisted = await evaluate(`(async () => {
        const rooms = await (await fetch('/api/chat-rooms')).json();
        if (rooms.length !== 1) throw Error('Expected one disposable room');
        const messages = await (await fetch('/api/chat-rooms/' + rooms[0].id + '/messages')).json();
        const evidence = await (await fetch('/api/chat-rooms/' + rooms[0].id + '/evidence')).json();
        return { bot: messages.some(m => m.sender === 'BOT' && m.content.length > 0), evidence: evidence.length };
      })()`);
      assert.ok(persisted.bot);
      assert.ok(persisted.evidence > 0);
      await send('Page.reload');
      await until(() => exists('.room-select'), 'saved room after reload');
      await evaluate("document.querySelector('.room-select').click()");
      await until(() => exists('.bot-message'), 'saved answer restored');
      pass('final answer and evidence persisted; conversation restored after reload');
      await value('#question', '방금 설명한 원칙을 한 문장으로 요약해 주세요.');
      await evaluate("document.querySelector('.composer').requestSubmit()");
      await until(() => requests.some(r => /\/messages\/ndjson$/.test(r.path)), 'follow-up NDJSON request');
      await until(async () => !(await exists('.loading-dots')), 'follow-up completion', 1_200_000);
      assert.equal(await exists('.error-card'), false);
      assert.equal(await evaluate("document.querySelectorAll('.bot-message').length"), 2);
      const follow = requests.filter(r => /\/messages\/ndjson$/.test(r.path));
      assert.equal(follow.length, 1);
      assert.ok(responses.some(r => /\/messages\/ndjson$/.test(r.path) && r.status === 200));
      await send('Page.reload');
      await until(() => exists('.room-select'), 'room after follow-up reload');
      await evaluate("document.querySelector('.room-select').click()");
      await until(() => evaluate("document.querySelectorAll('.bot-message').length === 2"), 'persisted follow-up');
      pass('real follow-up NDJSON answer completed and restored from history');
    } else {
    await send('Page.reload');
    await until(() => exists('.welcome'), 'session after reload');
    pass('HttpOnly cookie session survives reload');
    const beforeRenewal = responses.filter((r) => r.path === '/api/auth/refresh' && r.status === 200).length;
    await send('Network.deleteCookies', { name: 'accessToken', url: origin, path: '/' });
    await send('Page.reload');
    await until(() => exists('.welcome'), 'expired access recovery');
    assert.equal(responses.filter((r) => r.path === '/api/auth/refresh' && r.status === 200).length - beforeRenewal, 1);
    pass('missing Access cookie recovers with exactly one Refresh request');
    await clickText('계정 설정');
    await until(() => exists('.settings-card'), 'settings');
    await value('.settings-card input', '이름변경검증');
    await clickText('닉네임 저장');
    await until(() => evaluate("document.querySelector('.profile-name')?.textContent === '이름변경검증'"), 'nickname response');
    pass('browser nickname update and profile refresh');
    await clickText('×');
    }
  } else {
    await until(() => exists('.room-select'), 'fixture room list');
    assert.equal(await evaluate("document.querySelectorAll('.room-select').length"), 20);
    await clickText('이전 상담 더 보기');
    await until(() => evaluate("document.querySelectorAll('.room-select').length === 21"), 'second room page');
    pass('room list loads the next page beyond the default 20');
    await evaluate("document.querySelector('.room-select').click()");
    await until(() => exists('.citation'), 'citation rendering');
    await evaluate("document.querySelector('.citation').click()");
    await until(() => exists('.evidence-detail pre'), 'evidence HTTP fetch');
    assert.equal(await evaluate("document.querySelector('.evidence-detail pre b') !== null"), false);
    assert.ok((await evaluate("document.querySelector('.evidence-detail pre').textContent")).includes('<b>'));
    pass('UUID citation opens evidence; raw provider HTML remains text');
    await clickText('지금은 검색하지 않기');
    assert.deepEqual(await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json(), []);
    pass('declining case search sends no external-search approval');
    await send('Page.reload');
    await until(() => exists('.room-select'), 'room list after reload');
    await evaluate("document.querySelector('.room-select').click()");
    await until(() => exists('.consent-card'), 'consent after reopening conversation');
    await clickText('판례 검색 승인');
    await until(() => evaluate("!document.querySelector('.composer textarea').disabled"), 'consent request complete');
    const posts = await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json();
    assert.equal(posts[0].allowCaseSearch, true);
    pass('only explicit approval sends allowCaseSearch=true');
    await value('#question', '근거 부족 검증');
    await evaluate("document.querySelector('.composer').requestSubmit()");
    await until(() => exists('.error-card'), '422 message');
    assert.equal(await evaluate("document.querySelector('#question').value"), '근거 부족 검증');
    assert.equal(await evaluate("[...document.querySelectorAll('.user-message')].some(el => el.textContent.includes('근거 부족 검증'))"), false);
    pass('422 error shown; failed turn rolled back and draft retained');
    await value('#question', '일반 후속 질문');
    await evaluate("document.querySelector('.composer').requestSubmit(); document.querySelector('.composer').requestSubmit()");
    await until(() => evaluate("document.querySelector('#question').value === '' && !document.querySelector('#question').disabled"), 'single question complete');
    const all = await (await fetch('http://127.0.0.1:4900/backend/__fixture/requests')).json();
    assert.equal(all.filter((r) => r.content === '일반 후속 질문').length, 1);
    assert.equal(all.at(-1).allowCaseSearch, false);
    pass('duplicate submit prevented and consent not reused');
    await value('#question', '서버 장애 검증');
    await evaluate("document.querySelector('.composer').requestSubmit()");
    await until(() => exists('.error-card'), '503 message');
    assert.ok((await evaluate("document.querySelector('.error-card').textContent")).includes('잠시 후'));
    pass('503 backend message displayed');
  }
  const screenshot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(directory, name), Buffer.from(data, 'base64'));
  };
  await screenshot('desktop.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(300);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await screenshot('mobile.png');
  pass('390px mobile layout has no horizontal overflow');
  if (mode === 'live') {
    await clickText('메뉴');
    await clickText('로그아웃');
    await until(() => exists('.auth-card'), 'logout screen');
    pass('browser logout clears authenticated screen');
    await value('input[autocomplete=email]', email);
    await value('input[autocomplete=current-password]', password);
    await evaluate("document.querySelector('.auth-card form').requestSubmit()");
    await until(() => exists('.welcome'), 'login again');
    pass('browser login with created account');
  }
  assert.deepEqual(exceptions, []);
  pass('no uncaught browser JavaScript exceptions');
} finally {
  try {
    if (accountCreated && socket?.readyState === WebSocket.OPEN) {
      const cleaned = await evaluate(`(async () => {
        const mutate = async (path, method, body) => { const csrf = await (await fetch('/api/auth/csrf')).json(); return fetch('/api' + path, { method, headers: { [csrf.headerName]: csrf.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); };
        let profile = await fetch('/api/users/me');
        if (profile.status === 401) { await mutate('/auth/login', 'POST', { email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)} }); profile = await fetch('/api/users/me'); }
        const user = await profile.json();
        if (user.data?.email !== ${JSON.stringify(email)}) throw Error('Refusing to delete an unexpected account');
        return (await mutate('/users/me', 'DELETE')).status;
      })()`);
      assert.equal(cleaned, 204);
      pass('browser disposable account deleted');
    }
  } finally {
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify({ mode, checks: results, exceptions, responses, requests }, null, 2));
  console.log(JSON.stringify({ responses, requests, alert: socket?.readyState === WebSocket.OPEN ? await evaluate("document.querySelector('[role=alert]')?.textContent") : null }));
  console.log(`Screenshots and summary: ${directory}`);
  if (socket?.readyState === WebSocket.OPEN) await send('Browser.close').catch(() => {});
  socket?.close();
  chrome.kill();
  }
}
