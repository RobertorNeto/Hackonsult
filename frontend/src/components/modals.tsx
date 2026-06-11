// Modais de entrada/edição: transação (add/editar), meta (add/editar com
// simulação ao vivo) e perfil (inclui renda, que reflete na barra de gastos).
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useData } from "../store";
import { ICON_OPTIONS } from "./caticon";
import { GoalSim } from "./charts";
import { brl0, type Goal, type Lever, type Recurring, type Tx } from "../data/mock";
import { api, type BankStatus } from "../lib/api";

const EASE = [0.22, 1, 0.36, 1] as const;
const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

/** Retorna a data/hora atual no formato que o input datetime-local espera: "YYYY-MM-DDTHH:MM" */
function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converte "YYYY-MM-DDTHH:MM:SS" (vindo do backend) para o formato do input */
function toDatetimeLocal(iso: string): string {
  if (!iso) return nowDatetimeLocal();
  return iso.slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

// ——— helpers de prazo (mês) ⇄ meses restantes ———
const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const nowYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const ymToLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m ? `${MES[m - 1]} ${y}` : "";
};
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const diffMonths = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const now = new Date();
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
};

/* ---------- shell genérico ---------- */
function Modal({
  open,
  onClose,
  title,
  subtitle,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-scrim"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }} onClick={onClose}
        >
          <motion.div
            className={`modal ${wide ? "wide" : ""}`}
            initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.26, ease: EASE }}
            onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
          >
            <div className="modal-head">
              <div>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
              </div>
              <button className="modal-x" onClick={onClose} aria-label="fechar">×</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-k">{label}</span>
      {children}
    </label>
  );
}
const ErrorMsg = ({ msg }: { msg: string | null }) => (msg ? <div className="form-error">{msg}</div> : null);

/* ---------- transação (add / editar) ---------- */
export function TransactionModal({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Tx | null;
}) {
  const { addTransaction, editTransaction } = useData();
  const [merchant, setMerchant] = useState("");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<"saida" | "entrada">("saida");
  const [icon, setIcon] = useState("card");
  const [when, setWhen] = useState(nowDatetimeLocal);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setMerchant(edit.merchant);
      setValue(String(Math.abs(edit.amount)).replace(".", ","));
      setKind(edit.amount >= 0 ? "entrada" : "saida");
      setIcon(edit.icon);
      setWhen(toDatetimeLocal(edit.createdAt ?? ""));
    } else {
      setMerchant(""); setValue(""); setKind("saida"); setIcon("card");
      setWhen(nowDatetimeLocal());
    }
    setErr(null);
  }, [open, edit]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = num(value);
    if (!merchant.trim() || v <= 0) {
      setErr("Informe um nome e um valor maior que zero.");
      return;
    }
    const amount = kind === "saida" ? -Math.abs(v) : Math.abs(v);
    // categoria = label legível do ícone selecionado
    const resolvedCategory = ICON_OPTIONS.find((o) => o.key === icon)?.label ?? icon;
    setBusy(true); setErr(null);
    try {
      if (edit) await editTransaction(edit.id, { merchant: merchant.trim(), amount, category: resolvedCategory, icon, when });
      else await addTransaction({ merchant: merchant.trim(), amount, category: resolvedCategory, icon, when });
      onClose();
    } catch (e2: any) {
      setErr(String(e2?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Editar transação" : "Adicionar transação"} subtitle="Entra no seu fluxo e atualiza o saldo.">
      <form className="form" onSubmit={submit}>
        <div className="seg">
          <button type="button" className={kind === "saida" ? "on" : ""} onClick={() => setKind("saida")}>Saída</button>
          <button type="button" className={kind === "entrada" ? "on" : ""} onClick={() => setKind("entrada")}>Entrada</button>
        </div>
        <Field label="Descrição">
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="iFood, Uber, salário…" autoFocus />
        </Field>
        <div className="field-row">
          <Field label="Valor (R$)">
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Data e hora">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
        </div>
        <Field label="Categoria">
          <select value={icon} onChange={(e) => setIcon(e.target.value)}>
            {ICON_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </Field>
        <ErrorMsg msg={err} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : edit ? "Salvar" : "Adicionar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- meta (add / editar) com simulação de aporte ---------- */
export function GoalModal({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Goal | null;
}) {
  const { addGoal, editGoal } = useData();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [targetMonth, setTargetMonth] = useState(addMonths(nowYM(), 6));
  const [monthsLeft, setMonthsLeft] = useState("6");
  const [monthly, setMonthly] = useState("0");
  const [icon, setIcon] = useState("target");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setName(edit.name);
      setTarget(String(edit.target).replace(".", ","));
      setSaved(String(edit.saved).replace(".", ","));
      setMonthsLeft(String(edit.monthsLeft));
      setTargetMonth(addMonths(nowYM(), edit.monthsLeft));
      setMonthly(String(edit.monthlyCurrent).replace(".", ","));
      setIcon(edit.icon);
    } else {
      setName(""); setTarget(""); setSaved(""); setMonthsLeft("6"); setTargetMonth(addMonths(nowYM(), 6)); setMonthly("0"); setIcon("target");
    }
    setErr(null);
  }, [open, edit]);

  // prazo (mês) ⇄ meses restantes: alterar um recalcula o outro
  function onMonth(ym: string) {
    setTargetMonth(ym);
    setMonthsLeft(String(diffMonths(ym)));
  }
  function onMonths(v: string) {
    setMonthsLeft(v);
    const n = Math.max(1, Number(v) || 1);
    setTargetMonth(addMonths(nowYM(), n));
  }

  const t = num(target), s = num(saved), m = num(monthly), ml = Math.max(1, num(monthsLeft) || 1);
  const sim = useMemo(() => {
    const falta = Math.max(0, t - s);
    const meses = m > 0 ? falta / m : Infinity;
    const noPrazo = isFinite(meses) && meses <= ml;
    return { meses, noPrazo, falta };
  }, [t, s, m, ml]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || t <= 0) {
      setErr("Informe um nome e um valor-alvo maior que zero.");
      return;
    }
    const payload = {
      name: name.trim(), target: t, saved: s, targetDate: ymToLabel(targetMonth),
      monthsLeft: ml, monthlyCurrent: m, icon,
    };
    setBusy(true); setErr(null);
    try {
      if (edit) await editGoal(edit.id, payload);
      else await addGoal(payload);
      onClose();
    } catch (e2: any) {
      setErr(String(e2?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={edit ? "Editar meta" : "Nova meta"} subtitle="Ajuste o aporte e veja a simulação atualizar.">
      <form className="form" onSubmit={submit}>
        <div className="goal-form-grid">
          <div className="gf-fields">
            <Field label="Nome da meta">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Intercâmbio, reserva…" autoFocus />
            </Field>
            <div className="field-row">
              <Field label="Valor-alvo (R$)">
                <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="12000" inputMode="decimal" />
              </Field>
              <Field label="Já guardado (R$)">
                <input value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="0" inputMode="decimal" />
              </Field>
            </div>
            <div className="field-row">
              <Field label="Prazo (mês/ano)">
                <input type="month" value={targetMonth} onChange={(e) => onMonth(e.target.value)} />
              </Field>
              <Field label="Meses até o prazo">
                <input value={monthsLeft} onChange={(e) => onMonths(e.target.value)} placeholder="6" inputMode="numeric" />
              </Field>
            </div>
            <p className="field-hint">Mude o prazo ou os meses — o outro se ajusta sozinho ({ymToLabel(targetMonth)}).</p>
            <Field label="Ícone">
              <select value={icon} onChange={(e) => setIcon(e.target.value)}>
                {ICON_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="gf-sim">
            <div className="sim-aporte">
              <div className="spread">
                <span className="field-k">Aporte por mês</span>
                <span className="sim-aporte-v">{brl0(m)}</span>
              </div>
              <input
                type="range" min={0} max={Math.max(2000, Math.ceil((sim.falta || t) / 3))} step={10}
                value={m} onChange={(e) => setMonthly(e.target.value)}
              />
            </div>
            <GoalSim saved={s} target={t || 1} monthly={m} monthsLeft={ml} />
            <div className={`sim-verdict ${sim.noPrazo ? "ok" : "no"}`}>
              {t <= 0
                ? "Defina um valor-alvo pra simular."
                : m <= 0
                ? "Defina um aporte mensal pra ver quando você chega lá."
                : sim.noPrazo
                ? `No ritmo de ${brl0(m)}/mês você chega em ~${Math.ceil(sim.meses)} meses — dentro do prazo.`
                : `Nesse aporte leva ~${Math.ceil(sim.meses)} meses, além dos ${ml} do prazo. Aumente o aporte.`}
            </div>
          </div>
        </div>
        <ErrorMsg msg={err} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : edit ? "Salvar" : "Criar meta"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- categoria de corte (add / editar / excluir) ---------- */
export function CutCategoryModal({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Lever | null;
}) {
  const { addLever, editLever, deleteLever } = useData();
  const [label, setLabel] = useState("");
  const [current, setCurrent] = useState("");
  const [icon, setIcon] = useState("card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setLabel(edit.label);
      setCurrent(String(edit.current).replace(".", ","));
      setIcon(edit.icon);
    } else {
      setLabel(""); setCurrent(""); setIcon("card");
    }
    setErr(null);
  }, [open, edit]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = num(current);
    if (!label.trim() || c <= 0) {
      setErr("Informe um nome e o gasto mensal da categoria.");
      return;
    }
    setBusy(true); setErr(null);
    try {
      if (edit) await editLever(edit.id, { label: label.trim(), current: c, icon });
      else await addLever({ label: label.trim(), current: c, icon });
      onClose();
    } catch (e2: any) {
      setErr(String(e2?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!edit) return;
    setBusy(true);
    try {
      await deleteLever(edit.id);
      onClose();
    } catch (e2: any) {
      setErr(String(e2?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Editar categoria" : "Nova categoria de corte"} subtitle="Onde dá pra cortar e quanto você gasta nela por mês.">
      <form className="form" onSubmit={submit}>
        <Field label="Categoria">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Delivery, lazer…" autoFocus />
        </Field>
        <div className="field-row">
          <Field label="Gasto mensal (R$)">
            <input value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="340" inputMode="decimal" />
          </Field>
          <Field label="Ícone">
            <select value={icon} onChange={(e) => setIcon(e.target.value)}>
              {ICON_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <p className="field-hint">Você poderá cortar até esse valor na simulação.</p>
        <ErrorMsg msg={err} />
        <div className="form-actions">
          {edit && <button type="button" className="btn btn-ghost danger" onClick={remove} disabled={busy} style={{ marginRight: "auto" }}>Excluir</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : edit ? "Salvar" : "Adicionar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- gasto fixo / recorrente (add / editar / excluir) ---------- */
export function RecurringModal({
  open,
  onClose,
  edit,
}: {
  open: boolean;
  onClose: () => void;
  edit?: Recurring | null;
}) {
  const { addRecurring, editRecurring, deleteRecurring } = useData();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("5");
  const [icon, setIcon] = useState("card");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setLabel(edit.label);
      setAmount(String(edit.amount).replace(".", ","));
      setDayOfMonth(String(edit.dayOfMonth));
      setIcon(edit.icon);
      setActive(edit.active);
    } else {
      setLabel(""); setAmount(""); setDayOfMonth("5"); setIcon("card"); setActive(true);
    }
    setErr(null);
  }, [open, edit]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = num(amount);
    const dom = Math.max(1, Math.min(31, Number(dayOfMonth) || 1));
    if (!label.trim() || a <= 0) {
      setErr("Informe um nome e um valor maior que zero.");
      return;
    }
    setBusy(true); setErr(null);
    try {
      if (edit) await editRecurring(edit.id, { label: label.trim(), amount: a, dayOfMonth: dom, icon, active });
      else await addRecurring({ label: label.trim(), amount: a, dayOfMonth: dom, icon });
      onClose();
    } catch (e2: any) {
      setErr(String(e2?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!edit) return;
    setBusy(true);
    try {
      await deleteRecurring(edit.id);
      onClose();
    } catch (e2: any) {
      setErr(String(e2?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={edit ? "Editar gasto fixo" : "Novo gasto fixo"} subtitle="Cobrança mensal aplicada como evento determinístico na simulação.">
      <form className="form" onSubmit={submit}>
        <Field label="Descrição">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Aluguel, academia, plano…" autoFocus />
        </Field>
        <div className="field-row">
          <Field label="Valor (R$)">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="350" inputMode="decimal" />
          </Field>
          <Field label="Dia do mês">
            <input value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} placeholder="5" inputMode="numeric" min={1} max={31} />
          </Field>
        </div>
        <Field label="Ícone / Categoria">
          <select value={icon} onChange={(e) => setIcon(e.target.value)}>
            {ICON_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </Field>
        {edit && (
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: "auto" }} />
            <span className="field-k" style={{ marginBottom: 0 }}>Ativo na simulação</span>
          </label>
        )}
        <p className="field-hint">O valor será deduzido do saldo no dia {dayOfMonth || "?"} de cada mês na projeção.</p>
        <ErrorMsg msg={err} />
        <div className="form-actions">
          {edit && <button type="button" className="btn btn-ghost danger" onClick={remove} disabled={busy} style={{ marginRight: "auto" }}>Excluir</button>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : edit ? "Salvar" : "Adicionar"}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- sincronizar banco (confirmação → sync → análise IA) ---------- */
export function SyncModal({
  open,
  onClose,
  onDone,
  bankName,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  bankName?: string | null;
}) {
  const { reload } = useData();
  const [stage, setStage] = useState<"confirm" | "sync" | "ai" | "done" | "error">("confirm");
  const [summary, setSummary] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setStage("confirm"); setSummary([]); setErr(null); }
  }, [open]);

  async function start() {
    setStage("sync"); setErr(null);
    try {
      const s = await api.bankSync();
      if (!s.ok) { setErr(s.error ?? "Falha na sincronização."); setStage("error"); return; }
      const lines = [
        `${s.imported ?? 0} transações da conta importadas`,
        ...(s.card?.cards
          ? [`Cartão: ${s.card.cardName ?? "encontrado"} · ${s.card.billTxs} compras na fatura`]
          : []),
        `Saldo atualizado: R$ ${s.balance ?? "—"}`,
        ...(s.levers ? [`${s.levers} categorias de corte recalculadas`] : []),
      ];
      setStage("ai");
      const a = await api.analyze();
      if (a.ok) lines.push(`IA reavaliou sua saúde: score ${a.score} (${a.zone})`);
      else lines.push(`Análise da IA falhou: ${a.error}`);
      setSummary(lines);
      reload();          // app inteiro recarrega com dado real
      onDone();
      setStage("done");
    } catch (e: any) {
      setErr(String(e?.message ?? e));
      setStage("error");
    }
  }

  const busy = stage === "sync" || stage === "ai";

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Sincronizar com seu banco"
      subtitle="Open Finance via Cumbuca · dados reais entram no app."
    >
      <div className="form">
        {stage === "confirm" && (
          <>
            {bankName && (
              <div className="sync-bank">
                <span className="sync-bank-dot" /> Conta conectada: <b>{bankName}</b>
              </div>
            )}
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
              O Pulso vai buscar no seu banco, com o seu consentimento já autorizado:
            </p>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
              <li>Saldo atual da conta</li>
              <li>Transações dos últimos 7 dias</li>
              <li>Cartão de crédito: fatura e compras</li>
            </ul>
            <p className="field-hint">
              Depois, a IA reanalisa sua saúde financeira com os números reais.
              Consome algumas requisições da sua cota mensal do Open Finance — por isso pedimos confirmação.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Agora não</button>
              <button type="button" className="btn btn-primary" onClick={start}>Sincronizar agora</button>
            </div>
          </>
        )}

        {busy && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "8px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="typing" style={{ display: "inline-flex" }}><i /><i /><i /></span>
              <b style={{ fontSize: 14 }}>
                {stage === "sync" ? "Buscando seus dados no banco…" : "IA analisando sua saúde financeira…"}
              </b>
            </div>
            <p className="field-hint">
              {stage === "sync"
                ? "Saldo, transações e cartão via Open Finance."
                : "gpt-5.4-mini lendo seus números reais + projeção Monte Carlo."}
            </p>
          </div>
        )}

        {stage === "done" && (
          <>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
              {summary.map((l) => <li key={l}>{l}</li>)}
            </ul>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>Ver meu painel</button>
            </div>
          </>
        )}

        {stage === "error" && (
          <>
            <ErrorMsg msg={err} />
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
              <button type="button" className="btn btn-primary" onClick={start}>Tentar de novo</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------- conexão bancária Cumbuca (status / trocar / desconectar) ---------- */
export function BankModal({
  open,
  onClose,
  status,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  status: BankStatus | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<"" | "load" | "reset">("");
  const [err, setErr] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);

  useEffect(() => { if (open) { setErr(null); setVerdict(null); } }, [open]);

  // NÃO puxa contas ao abrir: list_accounts/get_account = 8 req/mês/usuário.
  // Mostra o cache do /status (custo zero). Só consulta o MCP sob clique explícito.
  function refreshAccounts() {
    setBusy("load"); setErr(null); setVerdict(null);
    api.bankAccounts()
      .then((r) => { setVerdict(r.verdict ?? null); if (!r.ok) setErr(r.verdict ?? "Falha ao ler contas."); })
      .catch((e) => setErr(String(e?.message ?? e)))
      .finally(() => { setBusy(""); onChanged(); });
  }

  const accounts = status?.accounts?.filter((a) => a.institution || a.number || a.name) ?? [];
  const since = status?.obtainedAt ? status.obtainedAt.replace("T", " ").slice(0, 16) : null;

  async function reset() {
    setBusy("reset"); setErr(null);
    try {
      await api.bankDisconnect();
      onChanged();
      onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy("");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Conexão bancária" subtitle="Open Finance via Cumbuca.">
      <div className="form">
        <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 9, height: 9, borderRadius: "50%",
              background: status?.connected ? "#2ecc71" : "#e5484d",
            }}
          />
          <span className="field-k" style={{ marginBottom: 0 }}>
            {status?.connected ? "Conectado" : "Desconectado"}
          </span>
        </div>

        {since && <p className="field-hint">Autorizado em {since}.</p>}

        {accounts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {accounts.map((a, i) => (
              <div key={i} style={{ padding: "10px 12px", border: "1px solid var(--line,#2a2a2a)", borderRadius: 10 }}>
                <b>{a.institution || "Conta"}</b>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {[a.name, a.number].filter(Boolean).join(" · ") || a.id}
                </div>
              </div>
            ))}
          </div>
        )}

        {status?.connected && accounts.length === 0 && !err && (
          <p className="field-hint">Conectado. Toque em "Atualizar dados" pra ler as contas (consome cota mensal).</p>
        )}

        {verdict && !err && <p className="field-hint">{verdict}</p>}

        <button
          type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }}
          onClick={refreshAccounts} disabled={!!busy || !status?.connected}
        >
          {busy === "load" ? "Lendo no banco…" : "Atualizar dados (1 req/mês)"}
        </button>

        <ErrorMsg msg={err} />

        <div className="form-actions">
          <button
            type="button" className="btn btn-ghost danger" style={{ marginRight: "auto" }}
            onClick={reset} disabled={!!busy}
          >
            {busy === "reset" ? "Desconectando…" : "Desconectar"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
          <button
            type="button" className="btn btn-primary"
            onClick={() => { api.bankConnectUrl().then((r) => { window.location.href = r.url; }).catch(() => {}); }} disabled={!!busy}
          >
            Trocar banco
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- editar perfil (inclui renda e configurações financeiras) ---------- */
export function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, updateUser, updateBalance } = useData();
  const u = data?.user;
  const b = data?.balance;

  // dados pessoais
  const [fullName, setFullName] = useState("");
  const [job, setJob] = useState("");
  const [age, setAge] = useState("");

  // configurações financeiras (renda, fatura, limite e vencimento = manuais;
  // saldo em conta vem do cache do banco e é só leitura)
  const [income, setIncome] = useState("");
  const [paydayDay, setPaydayDay] = useState("");
  const [creditUsed, setCreditUsed] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [creditDueDay, setCreditDueDay] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && u && b) {
      setFullName(u.fullName);
      setJob(u.job);
      setAge(String(u.age));
      setIncome(String(u.salary).replace(".", ","));
      setPaydayDay(String(u.paydayDay));
      setCreditUsed(String(b.creditUsed).replace(".", ","));
      setCreditLimit(String(b.creditLimit).replace(".", ","));
      setCreditDueDay(String(b.creditDueDay));
      setErr(null);
    }
  }, [open, u, b]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setErr("O nome não pode ficar vazio."); return; }
    const parts = fullName.trim().split(/\s+/);
    const initials = (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
    const inc        = num(income);
    const pday       = Math.max(1, Math.min(31, Number(paydayDay) || u!.paydayDay));
    const credUsed   = num(creditUsed);
    const credLimit  = num(creditLimit);
    const credDueDay = Math.max(1, Math.min(31, Number(creditDueDay) || b!.creditDueDay));
    setBusy(true); setErr(null);
    try {
      await updateUser({
        fullName: fullName.trim(), name: parts[0], initials,
        job: job.trim(), age: Number(age) || u?.age,
        salary: inc || u?.salary,
        paydayDay: pday,
      });
      // saldo em conta NÃO é editável: vem do cache da sincronização bancária
      await updateBalance({
        creditUsed:   credUsed,
        creditLimit:  credLimit || b?.creditLimit,
        creditDueDay: credDueDay,
      });
      onClose();
    } catch (e2: any) {
      setErr(String(e2?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} wide title="Editar perfil" subtitle="Dados pessoais e configurações financeiras.">
      <form className="form" onSubmit={submit}>

        {/* ── dados pessoais ── */}
        <p className="field-section-label">Dados pessoais</p>
        <Field label="Nome completo">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Lucas Mendes" autoFocus />
        </Field>
        <div className="field-row">
          <Field label="Ocupação">
            <input value={job} onChange={(e) => setJob(e.target.value)} placeholder="Analista Jr" />
          </Field>
          <Field label="Idade">
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="26" inputMode="numeric" />
          </Field>
        </div>

        {/* ── configurações financeiras ── */}
        <p className="field-section-label" style={{ marginTop: 20 }}>Configurações financeiras</p>
        <div className="field-row">
          <Field label="Renda mensal (R$)">
            <input value={income} onChange={(e) => setIncome(e.target.value)} placeholder="3550" inputMode="decimal" />
          </Field>
          <Field label="Dia do salário">
            <input value={paydayDay} onChange={(e) => setPaydayDay(e.target.value)} placeholder="5" inputMode="numeric" />
          </Field>
        </div>
        <Field label="Saldo em conta (sincronizado do banco)">
          <input
            value={`R$ ${String(b?.checking ?? "—").replace(".", ",")}`}
            disabled readOnly
            style={{ opacity: 0.65, cursor: "not-allowed" }}
          />
        </Field>
        <p className="field-hint">O saldo vem da última sincronização com seu banco — não é editável.</p>
        <div className="field-row">
          <Field label="Fatura atual do cartão (R$)">
            <input value={creditUsed} onChange={(e) => setCreditUsed(e.target.value)} placeholder="1870" inputMode="decimal" />
          </Field>
          <Field label="Limite do cartão (R$)">
            <input value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="6000" inputMode="decimal" />
          </Field>
        </div>
        <Field label="Dia de vencimento da fatura">
          <input value={creditDueDay} onChange={(e) => setCreditDueDay(e.target.value)} placeholder="15" inputMode="numeric" />
        </Field>
        <p className="field-hint">Fatura, limite e vencimento são manuais e entram na projeção do mês.</p>

        <ErrorMsg msg={err} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}
