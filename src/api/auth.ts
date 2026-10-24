import { api, type ApiEnvelope } from "./client";
import type { User } from "./types";

export const authApi = {
  profile: async () => (await api.get<ApiEnvelope<User>>("/users/me")).data.data,
  login: async (email: string, password: string) => { await api.post("/auth/login", { email, password }); },
  signup: async (email: string, password: string, nickname: string) => { await api.post("/auth/signup", { email, password, nickname }); },
  logout: async () => { await api.post("/auth/logout"); },
  remove: async () => { await api.delete("/users/me"); },
  nickname: async (newNickname: string) => { await api.patch("/users/me/nickname", { newNickname }); },
  password: async (newPassword: string) => { await api.patch("/users/me/password", { newPassword }); },
};
