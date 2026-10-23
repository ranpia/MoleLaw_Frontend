import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../store/constants";

export interface ApiEnvelope<T> { success: boolean; data: T }
interface CsrfResponse { token: string; headerName: string }
interface ApiErrorBody { error?: { code?: string; message?: string } | string }
type RetryConfig = InternalAxiosRequestConfig & { sessionRetried?: boolean };
// The server's JSON token is the source of truth, including with HttpOnly
// cookies. Do not let Axios replace it with a readable local cookie value.
const transport = axios.create({ baseURL: API_BASE_URL, withCredentials: true, withXSRFToken: false, timeout: 20_000 });
export const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true, withXSRFToken: false, timeout: 20_000 });
let csrf: Promise<CsrfResponse> | undefined;
let renewal: Promise<void> | undefined;
let sessionVersion = 0;
export const getSessionVersion = () => sessionVersion;
export function clearSession() {
  sessionVersion += 1;
  csrf = undefined;
  window.dispatchEvent(new Event("molelaw:session-cleared"));
}
export function invalidateCsrf() { csrf = undefined; }
async function getCsrf() {
  csrf ??= transport.get<CsrfResponse>("/auth/csrf").then(({ data }) => {
    if (!data.token || data.headerName !== "X-XSRF-TOKEN") throw new Error("CSRF 응답을 확인할 수 없습니다.");
    return data;
  }).finally(() => { csrf = undefined; });
  return csrf;
}
api.interceptors.request.use(async (config) => {
  if (!["get", "head", "options"].includes(config.method?.toLowerCase() || "get")) {
    const token = await getCsrf();
    config.headers.set(token.headerName, token.token);
  }
  return config;
});
// A protected 401 never reached the controller. Retry once after renewal.
// Do not retry auth mutations, CSRF failures, or ambiguous network failures.
api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!axios.isAxiosError(error)) throw error;
  const config = error.config as RetryConfig | undefined;
  if (error.response?.status !== 401 || !config || config.url?.startsWith("/auth/") || config.sessionRetried) throw error;
  const version = sessionVersion;
  await renewSession();
  if (version !== sessionVersion) throw error;
  config.sessionRetried = true;
  return api.request(config);
});
export async function renewSession(): Promise<void> {
  if (renewal) return renewal;
  const version = sessionVersion;
  const renew = async () => {
    // Another tab may have already renewed the shared HttpOnly cookie.
    try { await transport.get("/users/me"); return; }
    catch (error) { if (!axios.isAxiosError(error) || error.response?.status !== 401) throw error; }
    const token = await getCsrf();
    await transport.post("/auth/refresh", undefined, { headers: { [token.headerName]: token.token } });
    invalidateCsrf();
  };
  renewal = (async () => {
    try {
      if (navigator.locks) await navigator.locks.request("molelaw-auth-renewal", renew);
      else await renew();
    } catch (error) {
      if (version === sessionVersion && axios.isAxiosError(error) && error.response?.status === 401) clearSession();
      throw error;
    } finally { renewal = undefined; }
  })();
  return renewal;
}
export function errorMessage(error: unknown, fallback = "요청을 처리하지 못했습니다.") {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return error instanceof Error ? error.message : fallback;
  const detail = error.response?.data?.error;
  if (detail && typeof detail === "object" && detail.message) return detail.message;
  if (error.response?.status === 401) return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  if (error.response?.status === 403) return "요청 권한 또는 보안 토큰을 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.";
  if (!error.response) return "서버 응답을 확인하지 못했습니다. 대화 기록을 확인한 뒤 다시 시도해 주세요.";
  return fallback;
}
