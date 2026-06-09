// Store global: carrega o bootstrap do backend e expõe dados + ações.
// Mantém a UI síncrona (os componentes leem do contexto, não do mock).
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./lib/api";
import type { Balance, Bootstrap, Goal, Tx, User } from "./data/mock";

type AddTx = {
  merchant: string;
  amount: number;
  category?: string;
  icon?: string;
  when?: string;
  flagged?: boolean;
};
type AddGoal = {
  name: string;
  target: number;
  saved?: number;
  icon?: string;
  targetDate?: string;
  monthsLeft?: number;
  monthlyCurrent?: number;
  risk?: string;
};

type EditTx = { merchant?: string; amount?: number; category?: string; icon?: string };
type EditGoal = {
  name?: string;
  target?: number;
  saved?: number;
  icon?: string;
  targetDate?: string;
  monthsLeft?: number;
  monthlyCurrent?: number;
};

type Ctx = {
  data: Bootstrap | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  addTransaction: (tx: AddTx) => Promise<void>;
  editTransaction: (id: string, tx: EditTx) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addGoal: (g: AddGoal) => Promise<void>;
  editGoal: (id: string, g: EditGoal) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addLever: (l: { label: string; current: number; icon?: string }) => Promise<void>;
  editLever: (id: string, l: { label?: string; current?: number; icon?: string }) => Promise<void>;
  deleteLever: (id: string) => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  updateBalance: (patch: Partial<Balance>) => Promise<void>;
};

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .bootstrap()
      .then(setData)
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const addTransaction = useCallback(async (tx: AddTx) => {
    const { transaction, balance } = await api.addTransaction(tx);
    setData((d) =>
      d ? { ...d, transactions: [transaction, ...d.transactions], balance } : d
    );
  }, []);

  const editTransaction = useCallback(async (id: string, tx: EditTx) => {
    const { transaction, balance } = await api.editTransaction(id, tx);
    setData((d) =>
      d ? { ...d, transactions: d.transactions.map((t) => (t.id === id ? transaction : t)), balance } : d
    );
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    const { balance } = await api.deleteTransaction(id);
    setData((d) =>
      d ? { ...d, transactions: d.transactions.filter((t) => t.id !== id), balance } : d
    );
  }, []);

  const addGoal = useCallback(async (g: AddGoal) => {
    const { goal } = await api.addGoal(g);
    setData((d) => (d ? { ...d, goals: [...d.goals, goal] } : d));
  }, []);

  const editGoal = useCallback(async (id: string, g: EditGoal) => {
    const { goal } = await api.editGoal(id, g);
    setData((d) => (d ? { ...d, goals: d.goals.map((x) => (x.id === id ? goal : x)) } : d));
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await api.deleteGoal(id);
    setData((d) => (d ? { ...d, goals: d.goals.filter((x) => x.id !== id) } : d));
  }, []);

  const addLever = useCallback(async (l: { label: string; current: number; icon?: string }) => {
    const { lever } = await api.addLever(l);
    setData((d) => (d ? { ...d, levers: [...d.levers, lever] } : d));
  }, []);

  const editLever = useCallback(async (id: string, l: { label?: string; current?: number; icon?: string }) => {
    const { lever } = await api.editLever(id, l);
    setData((d) => (d ? { ...d, levers: d.levers.map((x) => (x.id === id ? lever : x)) } : d));
  }, []);

  const deleteLever = useCallback(async (id: string) => {
    await api.deleteLever(id);
    setData((d) => (d ? { ...d, levers: d.levers.filter((x) => x.id !== id) } : d));
  }, []);

  const updateUser = useCallback(async (patch: Partial<User>) => {
    const user = await api.updateUser(patch);
    setData((d) => (d ? { ...d, user } : d));
  }, []);

  const updateBalance = useCallback(async (patch: Partial<Balance>) => {
    const balance = await api.updateBalance(patch);
    setData((d) => (d ? { ...d, balance } : d));
  }, []);

  const value: Ctx = {
    data, loading, error, reload: load,
    addTransaction, editTransaction, deleteTransaction,
    addGoal, editGoal, deleteGoal,
    addLever, editLever, deleteLever,
    updateUser, updateBalance,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Hook com os dados já carregados. Lança se usado fora do provider ou sem dados. */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData fora do DataProvider");
  return ctx;
}

// reexport de tipos úteis pra ações
export type { AddTx, AddGoal, Balance, Goal, Tx };
