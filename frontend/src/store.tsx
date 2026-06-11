// Store global: carrega o bootstrap do backend e expõe dados + ações.
// Mantém a UI síncrona (os componentes leem do contexto, não do mock).
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken } from "./lib/api";
import type { Balance, Bootstrap, CutPlanItem, Goal, Recurring, Tx, User } from "./data/mock";

type AddTx = {
  merchant: string;
  amount: number;
  category?: string;
  icon?: string;
  when?: string;
  flagged?: boolean;
};
type AddRecurring = { label: string; amount: number; dayOfMonth: number; icon?: string };
type EditRecurring = { label?: string; amount?: number; dayOfMonth?: number; icon?: string; active?: boolean };

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

type EditTx = { merchant?: string; amount?: number; category?: string; icon?: string; when?: string };
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
  saveCutPlan: (items: CutPlanItem[]) => Promise<void>;
  clearCutPlan: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  updateBalance: (patch: Partial<Balance>) => Promise<void>;
  addRecurring: (r: AddRecurring) => Promise<void>;
  editRecurring: (id: string, r: EditRecurring) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
};

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    // sem sessão não busca dados (endpoints protegidos): evita 401 na landing/login
    if (!getToken()) {
      setData(null);
      setLoading(false);
      return;
    }
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

  const saveCutPlan = useCallback(async (items: CutPlanItem[]) => {
    const { cutPlan } = await api.saveCutPlan(items);
    setData((d) => (d ? { ...d, cutPlan } : d));
  }, []);

  const clearCutPlan = useCallback(async () => {
    const { cutPlan } = await api.clearCutPlan();
    setData((d) => (d ? { ...d, cutPlan } : d));
  }, []);

  const addRecurring = useCallback(async (r: AddRecurring) => {
    const { recurring } = await api.addRecurring(r);
    setData((d) => (d ? { ...d, recurring: [...d.recurring, recurring] } : d));
  }, []);

  const editRecurring = useCallback(async (id: string, r: EditRecurring) => {
    const { recurring } = await api.editRecurring(id, r);
    setData((d) => (d ? { ...d, recurring: d.recurring.map((x) => (x.id === id ? recurring : x)) } : d));
  }, []);

  const deleteRecurring = useCallback(async (id: string) => {
    await api.deleteRecurring(id);
    setData((d) => (d ? { ...d, recurring: d.recurring.filter((x) => x.id !== id) } : d));
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
    saveCutPlan, clearCutPlan,
    updateUser, updateBalance,
    addRecurring, editRecurring, deleteRecurring,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Hook com os dados ja carregados. Lanca se usado fora do provider ou sem dados. */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData fora do DataProvider");
  return ctx;
}

// reexport de tipos uteis pra acoes
export type { AddTx, AddGoal, Balance, Goal, Recurring, Tx };
