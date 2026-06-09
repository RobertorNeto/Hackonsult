// Cliente da API Flask. Em dev o Vite faz proxy de /api → :5000.
import type { Balance, Bootstrap, Goal, Lever, Tx, User } from "../data/mock";

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${msg}`);
  }
  return res.json() as Promise<T>;
}

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
};
