import { create } from "zustand";
import { clearSession, errorMessage, getSessionVersion, invalidateCsrf, renewSession } from "../../api/client";
import { authApi } from "../../api/auth";
import { validatePassword } from "../../api/validation";
import { OAUTH2_URL } from "../../api/config";
import type { AuthStore } from "../types";

let initialization: Promise<boolean> | undefined;
export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null, isAuthenticated: false, isLoading: false, error: null, initialized: false,
  checkAuthStatus: () => {
    if (initialization) return initialization;
    const version = getSessionVersion();
    initialization = (async () => {
      try {
        const user = await authApi.profile();
        if (version !== getSessionVersion()) return false;
        set({ user, isAuthenticated: true, error: null });
        return true;
      } catch (error) {
        if (version === getSessionVersion()) set({ user: null, isAuthenticated: false, error: errorMessage(error) });
        return false;
      } finally { set({ initialized: true }); initialization = undefined; }
    })();
    return initialization;
  },
  refreshToken: async () => {
    try { await renewSession(); return true; }
    catch (error) { set({ error: errorMessage(error) }); return false; }
  },
  LocalLogin: async (email, password) => {
    if (get().isLoading) return "로그인 처리 중입니다.";
    set({ isLoading: true, error: null });
    try {
      await authApi.login(email.trim(), password);
      invalidateCsrf();
      return await get().checkAuthStatus() ? "로그인 성공" : "로그인 후 사용자 정보를 확인하지 못했습니다.";
    } catch (error) { const message = errorMessage(error, "로그인에 실패했습니다."); set({ error: message }); return message; }
    finally { set({ isLoading: false }); }
  },
  LocalSignUp: async (email, password, nickname) => {
    if (get().isLoading) return "가입 처리 중입니다.";
    if (!validatePassword(password)) return "비밀번호는 8~72자 및 UTF-8 72바이트 이내로 입력해 주세요.";
    if (nickname.trim().length < 2 || nickname.trim().length > 50) return "닉네임은 2~50자로 입력해 주세요.";
    set({ isLoading: true, error: null });
    try {
      await authApi.signup(email.trim(), password, nickname.trim());
      invalidateCsrf();
      return await get().checkAuthStatus() ? "가입 성공" : "가입은 완료했지만 사용자 정보를 확인하지 못했습니다. 로그인해 주세요.";
    } catch (error) { const message = errorMessage(error, "가입에 실패했습니다."); set({ error: message }); return message; }
    finally { set({ isLoading: false }); }
  },
  googleLogin: () => { window.location.assign(`${OAUTH2_URL}/google`); },
  kakaoLogin: () => { window.location.assign(`${OAUTH2_URL}/kakao`); },
  logout: async () => {
    if (get().isLoading) return false;
    set({ isLoading: true, error: null });
    try { await authApi.logout(); clearSession(); return true; }
    catch (error) { set({ error: errorMessage(error, "로그아웃에 실패했습니다.") }); return false; }
    finally { set({ isLoading: false }); }
  },
  quit: async () => {
    if (get().isLoading) return false;
    set({ isLoading: true, error: null });
    try { await authApi.remove(); clearSession(); return true; }
    catch (error) { set({ error: errorMessage(error, "탈퇴에 실패했습니다.") }); return false; }
    finally { set({ isLoading: false }); }
  },
  changeNickname: async (nickname) => {
    if (nickname.trim().length < 2 || nickname.trim().length > 50) return "닉네임은 2~50자로 입력해 주세요.";
    if (get().isLoading) return "변경 처리 중입니다.";
    set({ isLoading: true });
    try {
      await authApi.nickname(nickname.trim());
      await get().checkAuthStatus();
      return "닉네임 변경에 성공하였습니다.";
    } catch (error) { return errorMessage(error, "닉네임 변경에 실패했습니다."); }
    finally { set({ isLoading: false }); }
  },
  changePassword: async (currentPassword, password) => {
    if (!currentPassword || new TextEncoder().encode(currentPassword).length > 72) return "현재 비밀번호를 72바이트 이내로 입력해 주세요.";
    if (!validatePassword(password)) return "비밀번호는 8~72자 및 UTF-8 72바이트 이내로 입력해 주세요.";
    if (get().isLoading) return "변경 처리 중입니다.";
    set({ isLoading: true });
    try {
      await authApi.password(currentPassword, password);
      clearSession();
      return "비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해 주세요.";
    } catch (error) { return errorMessage(error, "비밀번호 변경에 실패했습니다."); }
    finally { set({ isLoading: false }); }
  },
}));
window.addEventListener("molelaw:session-cleared", () => {
  useAuthStore.setState({ user: null, isAuthenticated: false, error: null });
});
