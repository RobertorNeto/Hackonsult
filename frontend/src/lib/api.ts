// Cliente da API Flask. Em dev o Vite faz proxy de /api → :5000.
import type { Balance, Bootstrap, Goal, Lever, Recurring, Tx, User } from "../data/mock";

const BASE = "/api";
const TOKEN_KEY = "pulso_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    throw new Error("401 não autenticado");
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

export type AuthUser = { id: number; name: string; email: string };

export const api = {
  bootstrap: () => req<Bootstrap>("/bootstrap"),

  addTransaction: (tx: {
    merchant: string;
    amount: number;
    category?: string;
    icon?: string;
    when?: string;
    flagged?: boolean;
  }) =>
    req<{ transaction: Tx; balance: Balance }>("/transactions", {
      method: "POST",
      body: JSON.stringify(tx),
    }),

  editTransaction: (
    id: string,
    tx: { merchant?: string; amount?: number; category?: string; icon?: string }
  ) =>
    req<{ transaction: Tx; balance: Balance }>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(tx),
    }),

  deleteTransaction: (id: string) =>
    req<{ deleted: string; balance: Balance }>(`/transactions/${id}`, {
      method: "DELETE",
    }),

  addGoal: (goal: {
    name: string;
    target: number;
    saved?: number;
    icon?: string;
    targetDate?: string;
    monthsLeft?: number;
    monthlyCurrent?: number;
    risk?: string;
  }) =>
    req<{ goal: Goal }>("/goals", {
      method: "POST",
      body: JSON.stringify(goal),
    }),

  editGoal: (
    id: string,
    goal: {
      name?: string;
      target?: number;
      saved?: number;
      icon?: string;
      targetDate?: string;
      monthsLeft?: number;
      monthlyCurrent?: number;
    }
  ) =>
    req<{ goal: Goal }>(`/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(goal),
    }),

  deleteGoal: (id: string) =>
    req<{ deleted: string }>(`/goals/${id}`, { method: "DELETE" }),

  addLever: (lever: { label: string; current: number; icon?: string }) =>
    req<{ lever: Lever }>("/levers", { method: "POST", body: JSON.stringify(lever) }),

  editLever: (id: string, lever: { label?: string; current?: number; icon?: string }) =>
    req<{ lever: Lever }>(`/levers/${id}`, { method: "PATCH", body: JSON.stringify(lever) }),

  deleteLever: (id: string) =>
    req<{ deleted: string }>(`/levers/${id}`, { method: "DELETE" }),

  updateUser: (patch: Partial<User>) =>
    req<User>("/user", { method: "PATCH", body: JSON.stringify(patch) }),

  updateBalance: (patch: Partial<Balance>) =>
    req<Balance>("/balance", { method: "PATCH", body: JSON.stringify(patch) }),

  addRecurring: (r: { label: string; amount: number; dayOfMonth: number; icon?: string }) =>
    req<{ recurring: Recurring }>("/recurring", { method: "POST", body: JSON.stringify(r) }),

  editRecurring: (id: string, r: { label?: string; amount?: number; dayOfMonth?: number; icon?: string; active?: boolean }) =>
    req<{ recurring: Recurring }>(`/recurring/${id}`, { method: "PATCH", body: JSON.stringify(r) }),

  deleteRecurring: (id: string) =>
    req<{ deleted: string }>(`/recurring/${id}`, { method: "DELETE" }),

  // ── Cumbuca / Open Finance ──
  bankStatus: () => req<BankStatus>("/bank/status"),
  bankConnectUrl: () => req<{ url: string }>("/bank/connect-url"),
  bankAccounts: () => req<BankProbe>("/bank/accounts"),
  bankDisconnect: () => req<{ connected: boolean }>("/bank/disconnect", { method: "DELETE" }),
  bankSync: () =>
    req<{
      ok: boolean;
      imported?: number;
      fetched?: number;
      balance?: number;
      levers?: number;
      card?: { cards: number; billTxs: number; cardName?: string; billTotal?: number };
      recurringCandidates?: RecurringCandidate[];
      error?: string;
    }>("/bank/sync", { method: "POST" }),

  analyze: () =>
    req<{ ok: boolean; score?: number; zone?: string; delta?: number; error?: string }>(
      "/analyze",
      { method: "POST" }
    ),

  // ── Assistente (OpenAI) ──
  assistant: (message: string, history: { from: string; text: string }[]) =>
    req<{ reply?: string; error?: string }>("/assistant", {
      method: "POST",
      body: JSON.stringify({ message, history }),
    }),

  // ── Auth ──
  register: (name: string, email: string, password: string) =>
    req<{ token: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    req<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  changePassword: (email: string, newPassword: string) =>
    req<{ ok: boolean }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ email, new: newPassword }),
    }),
  me: () => req<{ user: AuthUser }>("/auth/me"),
  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};

export type RecurringCandidate = {
  merchant: string;
  amount: number;
  category: string;
  icon: string;
  suggestedDay: number | null;
};

export type BankAccount = {
  institution?: string | null;
  name?: string | null;
  number?: string | null;
  id?: string | null;
};
export type BankStatus = {
  connected: boolean;
  redirectUri: string;
  hasClient: boolean;
  obtainedAt: string | null;
  syncedAt: string | null;
  accounts: BankAccount[];
};
export type BankProbe = {
  ok: boolean;
  verdict?: string;
  accounts?: BankAccount[];
  [k: string]: unknown;
};
