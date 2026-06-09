// Modais de entrada/edição: transação (add/editar), meta (add/editar com
// simulação ao vivo) e perfil (inclui renda, que reflete na barra de gastos).
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useData } from "../store";
import { ICON_OPTIONS } from "./caticon";
import { GoalSim } from "./charts";
import { brl0, type Goal, type Lever, type Tx } from "../data/mock";

const EASE = [0.22, 1, 0.36, 1] as const;
const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

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
  const [category, setCategory] = useState("Outros");
  const [icon, setIcon] = useState("card");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setMerchant(edit.merchant);
      setValue(String(Math.abs(edit.amount)).replace(".", ","));
      setKind(edit.amount >= 0 ? "entrada" : "saida");
      setCategory(edit.category);
      setIcon(edit.icon);
    } else {
      setMerchant(""); setValue(""); setKind("saida"); setCategory("Outros"); setIcon("card");
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
    setBusy(true); setErr(null);
    try {
      if (edit) await editTransaction(edit.id, { merchant: merchant.trim(), amount, category, icon });
      else await addTransaction({ merchant: merchant.trim(), amount, category, icon });
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
          <Field label="Categoria">
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Delivery" />
          </Field>
        </div>
        <Field label="Ícone">
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

/* ---------- editar perfil (inclui renda) ---------- */
export function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, updateUser, updateBalance } = useData();
  const u = data?.user;
  const b = data?.balance;
  const [fullName, setFullName] = useState("");
  const [job, setJob] = useState("");
  const [age, setAge] = useState("");
  const [income, setIncome] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open && u && b) {
      setFullName(u.fullName);
      setJob(u.job);
      setAge(String(u.age));
      setIncome(String(b.income).replace(".", ","));
      setErr(null);
    }
  }, [open, u, b]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setErr("O nome não pode ficar vazio.");
      return;
    }
    const parts = fullName.trim().split(/\s+/);
    const initials = (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
    const inc = num(income);
    setBusy(true); setErr(null);
    try {
      await updateUser({
        fullName: fullName.trim(), name: parts[0], initials,
        job: job.trim(), age: Number(age) || u?.age, salary: inc || u?.salary,
      });
      // renda alimenta a barra de gastos (entradas do mês)
      if (inc > 0 && inc !== b?.income) await updateBalance({ income: inc });
      onClose();
    } catch (e2: any) {
      setErr(String(e2?.message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar perfil" subtitle="Dados pessoais e renda mensal.">
      <form className="form" onSubmit={submit}>
        <Field label="Nome completo">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Lucas Mendes" autoFocus />
        </Field>
        <Field label="Ocupação">
          <input value={job} onChange={(e) => setJob(e.target.value)} placeholder="Analista Jr" />
        </Field>
        <div className="field-row">
          <Field label="Idade">
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="26" inputMode="numeric" />
          </Field>
          <Field label="Renda mensal (R$)">
            <input value={income} onChange={(e) => setIncome(e.target.value)} placeholder="3550" inputMode="decimal" />
          </Field>
        </div>
        <p className="field-hint">A renda é a referência da barra de gastos e da estimativa do mês.</p>
        <ErrorMsg msg={err} />
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}
