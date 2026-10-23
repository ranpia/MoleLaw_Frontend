import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// No browser package needed: isolated headless Chrome via the DevTools protocol.
const mode = process.argv[2] || 'live';
const origin = mode === 'simulation' ? 'http://localhost:5174' : 'http://localhost:5173';
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
    else if (message.method === 'Network.responseReceived' && message.params.response.url.includes('/api/')) responses.push({ path: new URL(message.params.response.url).pathname, status: message.params.response.status });
    else if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/api/')) {
      const req = message.params.request;
      const headers = Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [key.toLowerCase(), value]));
      requests.push({ path: new URL(req.url).pathname, method: req.method, contentType: headers['content-type'], csrfPresent: !!headers['x-xsrf-token'] });
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  if (mode === 'live') {
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
