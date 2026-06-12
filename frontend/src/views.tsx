import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  brl,
  brl0,
  progressColor,
  zoneColor,
  type Goal,
  type Tx,
  type ChatMsg,
} from "./data/mock";
import { useData } from "./store";
import {
  CategoryDonut,
  GoalsProgressChart,
  ProbRing,
  ProjectionChart,
  ScoreHistory,
  ScoreRing,
} from "./components/charts";
import { CatIcon, ICON_OPTIONS, VITAL_ICON } from "./components/caticon";
import { BankModal, GoalModal, RecurringModal, SyncModal, TransactionModal } from "./components/modals";
import { api, type BankStatus, type WhatIf } from "./lib/api";
import {
  IconBolt,
  IconCheck,
  IconChevron,
  IconEdit,
  IconPlus,
  IconSend,
  IconShield,
  IconTrash,
} from "./components/icons";
import type { Recurring } from "./data/mock";

const EASE = [0.22, 1, 0.36, 1] as const;
const fade = (i = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.05 * i, ease: EASE },
});

type Go = (t: string) => void;

function StatusTag({ zone, label }: { zone: string; label: string }) {
  const c = zoneColor(zone);
  return (
    <span className="zone-tag" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>
      {label}
    </span>
  );
}

function PageHead({ kicker, title, right }: { kicker: string; title: string; right?: JSX.Element }) {
  return (
    <motion.div {...fade(0)} className="page-head">
      <div className="ph-txt">
        <small>{kicker}</small>
        <h1>{title}</h1>
      </div>
      {right}
    </motion.div>
  );
}

/* ============================================================
   1. VISÃO GERAL — home estilo WHOOP: score gigante + vitais
   ============================================================ */
export function OverviewPage({ go }: { go: Go }) {
  const { data, deleteTransaction } = useData();
  const { health, balance, user, goals, transactions, projection } = data!;
  const [txOpen, setTxOpen] = useState(false);
  const [txEdit, setTxEdit] = useState<Tx | null>(null);
  const [bankStatus, setBankStatus] = useState<BankStatus | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);

  const refreshBank = () => api.bankStatus().then(setBankStatus).catch(() => {});
  useEffect(() => { refreshBank(); }, []);

  const connected = !!bankStatus?.connected;
  const synced = !!bankStatus?.syncedAt;

  const zone = zoneColor(health.zone);
  const creditPct = balance.creditLimit ? Math.round((balance.creditUsed / balance.creditLimit) * 100) : 0;
  const spentPct = balance.income ? Math.round((balance.spent / balance.income) * 100) : 0;
  // Fechamento do mês = saldo final projetado (mesma fonte da aba Projeção e Saúde)
  const monthClose = projection.expected;
  // Projeção do TOTAL que vai ser gasto no mês = renda - saldo projetado de fechamento
  const projSpend = Math.max(0, balance.income - monthClose);
  const projSpendPct = balance.income ? Math.round((projSpend / balance.income) * 100) : 0;
  const scale = Math.max(118, spentPct + 12, projSpendPct + 12);
  const pos = (p: number) => (p / scale) * 100;
  // alinhamento dos rótulos da barra: evita estourar a borda quando a marca
  // fica perto do canto (ex.: projeção muito acima da renda)
  const markPos = pos(projSpendPct);
  const rendaPos = pos(100);
  const markAlign = markPos > 62 ? "mark-left" : markPos < 24 ? "mark-right" : "";
  const focusVitals = health.vitals.filter((v) => ["fluxo", "cartao", "reserva"].includes(v.key));

  function openAdd() { setTxEdit(null); setTxOpen(true); }
  function openEdit(t: Tx) { setTxEdit(t); setTxOpen(true); }

  const bankName = bankStatus?.accounts?.find((a) => a.institution)?.institution;
  const connect = () => api.bankConnectUrl().then((r) => { window.location.href = r.url; }).catch(() => {});
  // conta nova/sem dados: tela limpa, só o convite pra conectar o banco
  const fresh = !synced && transactions.length === 0;

  if (fresh) {
    return (
      <div className="ov">
        <motion.section {...fade(0)} className="ov-empty">
          <div className="ov-empty-ic"><IconBolt /></div>
          <h1 className="ov-empty-h">
            {connected ? "Tudo pronto. Sincronize seu banco." : "Conecte seu banco e veja sua vida financeira."}
          </h1>
          <p className="ov-empty-sub">
            O Pulso lê suas transações reais via Open Finance e a IA cuida da análise. Você não digita nada.
          </p>
          <button
            className="btn btn-primary ov-empty-cta"
            onClick={connected ? () => setSyncOpen(true) : connect}
          >
            {connected ? "Sincronizar agora" : "Conectar meu banco"}
          </button>
          <span className="ov-empty-note">
            <IconShield /> Parceria Cumbuca · conexão regulada pelo Banco Central
          </span>
        </motion.section>
        <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} onDone={refreshBank} bankName={bankName} />
      </div>
    );
  }

  return (
    <div className="ov">
      {/* SCORE HERO */}
      <motion.section {...fade(0)} className="ov-hero">
        <span className="kicker">{user.todayLabel} · bom te ver, {user.name}</span>
        <div className="ov-ring" style={{ "--zone": zone } as React.CSSProperties}>
          <div className="ring-wrap" style={{ width: 290, height: 290 }}>
            <ScoreRing value={health.score} size={290} thickness={18} color={zone} />
            <div className="ring-center">
              <div className="lbl-top">score · {user.monthLabel}</div>
              <div className="big" style={{ fontSize: 84, color: zone }}>{health.score}</div>
              <div className="lbl" style={{ color: zone }}>{health.scoreLabel}</div>
            </div>
          </div>
        </div>
        <h1 className="ov-headline">{health.headline}</h1>
        <p className="ov-sub">{health.subline}</p>
        <div className="ov-ctas">
          {connected ? (
            <button className="btn btn-primary" onClick={() => setSyncOpen(true)}>
              ↻ Sincronizar banco
            </button>
          ) : (
            <button className="btn btn-primary" onClick={connect}>
              Conectar meu banco
            </button>
          )}
          {connected && bankName && (
            <span className="ov-bank-chip"><IconCheck /> {bankName} conectado</span>
          )}
          <button className="btn btn-ghost" onClick={() => go("assistant")}>Falar com a IA</button>
        </div>
        <span className="kicker" style={{ marginTop: 10, opacity: 0.75 }}>
          {synced
            ? `● ${bankName ?? "banco"} · último sync ${bankStatus!.syncedAt!.slice(11, 16)}`
            : connected
            ? "banco conectado · sincronize para ver seus dados reais"
            : "conecte seu banco para ver seus dados reais"}
        </span>
      </motion.section>

      <SyncModal open={syncOpen} onClose={() => setSyncOpen(false)} onDone={refreshBank} bankName={bankName} />

      {/* ENTENDA SEUS NÚMEROS — guia rápido pro usuário ler a tela */}
      <motion.section {...fade(1)} className="ov-help">
        <button className="ov-help-head" onClick={() => setHelpOpen((o) => !o)} aria-expanded={helpOpen}>
          <span className="ov-help-title">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden width="16" height="16">
              <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 11v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="7.6" r="1.1" fill="currentColor" />
            </svg>
            Entenda seus números
          </span>
          <span className={`ov-help-chev ${helpOpen ? "open" : ""}`}><IconChevron /></span>
        </button>
        <AnimatePresence initial={false}>
          {helpOpen && (
            <motion.div
              className="ov-help-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <div className="ov-help-grid">
                <div className="ov-help-item">
                  <span className="ohi-dot" style={{ background: zone }} />
                  <div className="ohi-txt">
                    <b>Score {health.score} · {health.scoreLabel}</b>
                    <p>Sua saúde financeira numa nota de 0 a 100. Quanto maior, melhor — <b style={{ color: "var(--mint)" }}>verde</b> é saudável, amarelo pede atenção e vermelho é risco.</p>
                  </div>
                </div>
                <div className="ov-help-item">
                  <span className="ohi-rings" aria-hidden><i /><i /><i /></span>
                  <div className="ohi-txt">
                    <b>Os 3 anéis: Fluxo, Cartão e Reserva</b>
                    <p>Os pilares que formam o score. <b>Fluxo</b> = quanto sobra no mês · <b>Cartão</b> = quanto do limite você usa · <b>Reserva</b> = seu colchão pra imprevistos. Toque pra ver detalhes.</p>
                  </div>
                </div>
                <div className="ov-help-item">
                  <span className="ohi-bar" aria-hidden><i style={{ width: `${Math.min(100, spentPct)}%` }} /></span>
                  <div className="ohi-txt">
                    <b>Barra do mês — {spentPct}% gasto</b>
                    <p>Quanto da sua renda já saiu até agora. A marca <em>projeção</em> mostra quanto você deve gastar até fechar o mês ({projSpendPct}%), calculado pela IA.</p>
                  </div>
                </div>
                <div className="ov-help-item">
                  <span className="ohi-dot" style={{ background: monthClose < 0 ? "var(--coral)" : "var(--mint)" }} />
                  <div className="ohi-txt">
                    <b>Saldo projetado: {brl0(monthClose)}</b>
                    <p>Quanto deve sobrar (ou faltar) na sua conta no fim do mês, somando o que ainda entra e sai. Verde sobra, vermelho falta.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* TRIO DE VITAIS */}
      <motion.section {...fade(1)} className="trio">
        {focusVitals.map((v) => (
          <button key={v.key} className="trio-item" onClick={() => go("health")}>
            <div className="ring-wrap" style={{ width: 108, height: 108 }}>
              <ScoreRing value={v.value} size={108} thickness={9} color={zoneColor(v.status)} glow={false} delay={0.3} />
              <div className="ring-center">
                <div className="big" style={{ fontSize: 31, color: zoneColor(v.status) }}>{v.value}</div>
              </div>
            </div>
            <b>{v.label}</b>
          </button>
        ))}
      </motion.section>

      {/* FLUXO DO MÊS */}
      <motion.section {...fade(2)} className="flow">
        <div className="flow-top">
          <div className="flow-grp">
            <span className="flow-k">Entrou em {user.monthLabel}</span>
            <span className="flow-v in">{brl0(balance.income)}</span>
          </div>
          <div className="flow-grp right">
            <span className="flow-k">Saiu</span>
            <span className="flow-v out">{brl0(balance.spent)}</span>
          </div>
        </div>
        <div className="flow-bar">
          <span className="overzone" style={{ left: `${pos(100)}%` }} />
          <motion.i initial={{ width: 0 }} animate={{ width: `${pos(spentPct)}%` }} transition={{ duration: 1, ease: EASE, delay: 0.3 }} />
          {/* % de projeção fixada no fim do preenchimento, sempre dentro do limite da barra */}
          <motion.span
            className="flow-pct"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, left: `${pos(spentPct)}%` }}
            transition={{ duration: 1, ease: EASE, delay: 0.3 }}
          >
            {spentPct}%
          </motion.span>
          <span className={`renda${rendaPos > 80 ? " renda-left" : ""}`} style={{ left: `${rendaPos}%` }}><em>renda</em></span>
          {/* projeção do gasto total do mês (Monte Carlo) */}
          <span className={`mark ${markAlign}`} style={{ left: `${markPos}%` }}>
            <em>projeção {brl0(projSpend)} ({projSpendPct}%)</em>
          </span>
        </div>
        <div className="flow-legend">
          <span className="lg"><i className="dot out" /> Gastou {spentPct}% da renda este mês</span>
        </div>
        <div className="flow-foot">Saldo projetado pro fim do mês: <b style={{ color: monthClose < 0 ? "var(--coral)" : "var(--mint)" }}>{brl0(monthClose)}</b> · fatura {brl0(balance.creditUsed)} ({creditPct}% do limite)</div>
      </motion.section>

      {/* ATIVIDADE + METAS */}
      <div className="grid cols-12">
        <motion.div {...fade(4)} className="panel span-7">
          <div className="panel-head">
            <h2>Atividade recente</h2>
            <button className="link-add" onClick={openAdd}><IconPlus /> adicionar</button>
          </div>
          {transactions.length === 0 && <div className="empty">Nenhuma transação ainda. Toque em adicionar.</div>}
          <div className="tx-scroll">
            {transactions.map((t) => (
              <div className="tx" key={t.id}>
                <div className="ic"><CatIcon name={t.icon} /></div>
                <div className="info">
                  <b>{t.merchant}{t.flagged && <span className="flag-dot">revisar</span>}</b>
                  <small>{t.category} · {t.when}</small>
                </div>
                <div className={`amt ${t.amount > 0 ? "in" : ""}`}>{t.amount > 0 ? "+" : "−"}{brl(Math.abs(t.amount))}</div>
                <div className="tx-actions">
                  <button aria-label="editar" onClick={() => openEdit(t)}><IconEdit /></button>
                  <button aria-label="remover" className="danger" onClick={() => deleteTransaction(t.id)}><IconTrash /></button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div {...fade(5)} className="panel span-5">
          <div className="panel-head"><h2>Suas metas</h2><a className="link" onClick={() => go("goals")}>gerenciar</a></div>
          {goals.length === 0 && <div className="empty">Nenhuma meta ainda.</div>}
          {goals.map((g) => (
            <div key={g.id} className="goal-peek" onClick={() => go("goals")}>
              <ProbRing pct={g.progress} color={progressColor(g.progress)} size={46} />
              <div className="gp-info">
                <div className="spread">
                  <b>{g.name}</b>
                  <span className="gp-date">{g.targetDate}</span>
                </div>
                <small>{brl0(g.saved)} de {brl0(g.target)} · prob. {Math.round(g.probability * 100)}%</small>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      <TransactionModal open={txOpen} onClose={() => setTxOpen(false)} edit={txEdit} />
    </div>
  );
}

/* ============================================================
   2. SAÚDE FINANCEIRA — gráficos + vitais interativos
   ============================================================ */
export function HealthPage() {
  const { data } = useData();
  const { health, recommendations, spendByCategory, balance } = data!;
  const [open, setOpen] = useState<string | null>("cartao");

  const creditPct = balance.creditLimit ? Math.round((balance.creditUsed / balance.creditLimit) * 100) : 0;
  const creditFree = Math.max(0, balance.creditLimit - balance.creditUsed);
  const creditData = [
    { label: "Usado", value: balance.creditUsed, color: creditPct >= 80 ? "#bf4048" : creditPct >= 50 ? "#b45309" : "#1a7a4f" },
    { label: "Disponível", value: creditFree, color: "#d6d5cf" },
  ];

  // stats derivadas do histórico real (nada fixo) — seguro p/ histórico vazio
  const hist = health.history;
  const best = hist.length ? hist.reduce((a, b) => (b.v > a.v ? b : a), hist[0]) : null;
  const avg = hist.length ? Math.round(hist.reduce((s, h) => s + h.v, 0) / hist.length) : 0;
  const prev = hist.length > 1 ? hist[hist.length - 2] : null;

  // gasto do mês por área, do backend (conta + cartão). Transferências contam como investimentos.
  const CAT_COLORS = ["#1a7a4f", "#3a5bc7", "#b45309", "#bf4048", "#6f9e2e", "#0d9488", "#7c3aed", "#9c9b92"];
  const catData = (() => {
    const map: Record<string, number> = {};
    for (const [cat, val] of Object.entries(spendByCategory ?? {})) {
      if (val <= 0) continue;
      const c = /transfer/i.test(cat) ? "Investimentos" : cat || "Outros";
      map[c] = (map[c] || 0) + val;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: CAT_COLORS[i % CAT_COLORS.length] }));
  })();

  return (
    <div className="page">
      <PageHead
        kicker="seu pulso financeiro"
        title="Saúde financeira"
        right={<StatusTag zone={health.zone} label={`zona de ${health.scoreLabel}`} />}
      />

      <div className="grid cols-12">
        <motion.div {...fade(1)} className="panel span-5 health-hero">
          <div className="ring-wrap" style={{ width: 200, height: 200 }}>
            <ScoreRing value={health.score} size={200} thickness={14} color={zoneColor(health.zone)} />
            <div className="ring-center">
              <div className="big" style={{ fontSize: 56, color: zoneColor(health.zone) }}>{health.score}</div>
              <div className="lbl" style={{ color: "var(--text-mute)" }}>de 100</div>
            </div>
          </div>
          <div className="hh-stats">
            <div><span className="k">Este mês</span><div className="v" style={{ color: health.deltaMonth < 0 ? "var(--coral)" : "var(--mint)" }}>{health.deltaMonth > 0 ? "+" : ""}{health.deltaMonth} pts</div></div>
            <div><span className="k">Melhor mês</span><div className="v">{best ? `${best.v} · ${best.m}` : "—"}</div></div>
            <div><span className="k">Média {hist.length || 0}m</span><div className="v">{hist.length ? avg : "—"}</div></div>
          </div>
        </motion.div>

        <motion.div {...fade(2)} className="panel span-7">
          <div className="panel-head"><h2>Evolução do score</h2><span className="hint-cap">6 meses</span></div>
          <ScoreHistory data={health.history} />
          <p className="chart-note">
            {prev
              ? <>De <b style={{ color: "var(--text)" }}>{prev.v}</b> ({prev.m.toLowerCase()}) para <b style={{ color: health.score < prev.v ? "var(--coral)" : "var(--mint)" }}>{health.score}</b> agora. {health.subline}</>
              : health.subline}
          </p>
        </motion.div>
      </div>

      {/* Vitais | Recomendações da IA — lado a lado */}
      <div className="grid cols-12">
        <motion.div {...fade(3)} className="panel span-7">
          <div className="panel-head"><h2>Vitais financeiros</h2><span className="hint-cap">toque pra abrir</span></div>
          {health.vitals.map((v) => {
            const isOpen = open === v.key;
            return (
              <div key={v.key} className={`vital ${isOpen ? "open" : ""}`} onClick={() => setOpen(isOpen ? null : v.key)}>
                <div className="v-row">
                  <span
                    className="v-ic"
                    style={{ color: zoneColor(v.status), background: `color-mix(in srgb, ${zoneColor(v.status)} 12%, transparent)` }}
                  >
                    <CatIcon name={VITAL_ICON[v.key] ?? "card"} />
                  </span>
                  <div className="v-meta">
                    <b>{v.label}</b>
                    <span>{v.hint}</span>
                  </div>
                  <span className={`v-num status-${v.status}`}>{v.value}</span>
                  <span className="v-caret"><IconChevron /></span>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div className="vital-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.32, ease: EASE }}>
                      <div className="vd-inner">
                        <div className="track"><i style={{ width: `${v.value}%`, background: zoneColor(v.status) }} /></div>
                        <p>{v.detail}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>

        <div className="span-5 grid" style={{ gap: 14, alignContent: "start" }}>
          <div className="panel-head" style={{ marginBottom: -6 }}>
            <h2>Sugestões da IA</h2>
            <span className="hint-cap">gerada no último sync</span>
          </div>
          {recommendations.map((r, i) => (
            <motion.div {...fade(4 + i)} className={`reco ${r.tone}`} key={r.id}>
              <div className="ic"><CatIcon name={r.icon} /></div>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
              <div className="reco-foot"><span className="impact">{r.impact}</span></div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cartão de crédito | Análise por área — donuts lado a lado */}
      <div className="grid cols-12">
        <motion.div {...fade(5)} className="panel span-6">
          <div className="panel-head"><h2>Cartão de crédito</h2><span className="hint-cap">uso do limite</span></div>
          <CategoryDonut data={creditData} centerValue={`${creditPct}%`} centerLabel="do limite" />
          <div className="cc-foot" style={{ marginTop: 4 }}>
            <span>Fatura <b style={{ color: "var(--text)" }}>{brl0(balance.creditUsed)}</b> de {brl0(balance.creditLimit)}</span>
            <span>vence dia {balance.creditDueDay}</span>
          </div>
        </motion.div>
        <motion.div {...fade(6)} className="panel span-6">
          <div className="panel-head"><h2>Análise por área de gasto</h2><span className="hint-cap">gasto do mês</span></div>
          <CategoryDonut data={catData} />
        </motion.div>
      </div>
    </div>
  );
}

/* ============================================================
   3. METAS — progresso colorido + editar + resumo
   ============================================================ */
type GoalSuggestion = { goal: string; title: string; text: string; suggestedMonthly?: number | null };

export function GoalsPage() {
  const { data, deleteGoal, editGoal } = useData();
  const { goals } = data!;
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalEdit, setGoalEdit] = useState<Goal | null>(null);

  // sugestões de ajuste de metas via Gemini (com base no gasto real calculado)
  const [suggesting, setSuggesting] = useState(false);
  const [sugErr, setSugErr] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GoalSuggestion[] | null>(null);
  const [sugSummary, setSugSummary] = useState<string | null>(null);

  async function suggest() {
    setSuggesting(true); setSugErr(null);
    try {
      const r = await api.suggestGoals();
      if (r.error) { setSugErr(r.error); setSuggestions(null); }
      else { setSuggestions(r.suggestions || []); setSugSummary(r.summary ?? null); }
    } catch (e: any) {
      setSugErr(String(e?.message ?? e));
    } finally { setSuggesting(false); }
  }

  function applySuggestion(s: GoalSuggestion) {
    const g = goals.find((x) => x.name === s.goal);
    if (g && typeof s.suggestedMonthly === "number") editGoal(g.id, { monthlyCurrent: s.suggestedMonthly });
  }

  function openAdd() { setGoalEdit(null); setGoalOpen(true); }
  function openEdit(g: Goal) { setGoalEdit(g); setGoalOpen(true); }

  // resumo
  const totalTarget = goals.reduce((a, g) => a + g.target, 0);
  const totalSaved = goals.reduce((a, g) => a + g.saved, 0);
  const totalMonthly = goals.reduce((a, g) => a + g.monthlyNeeded, 0);
  const avgProb = goals.length ? goals.reduce((a, g) => a + g.probability, 0) / goals.length : 0;
  const totalPct = totalTarget ? totalSaved / totalTarget : 0;
  const horizon = goals.length ? Math.max(...goals.map((g) => g.monthsLeft), 6) : 12;

  return (
    <div className="page">
      <PageHead
        kicker="onde você quer chegar"
        title="Metas"
        right={
          <span className="row" style={{ gap: 8 }}>
            {goals.length > 0 && (
              <button className="btn btn-ghost" onClick={suggest} disabled={suggesting}>
                {suggesting ? "Analisando…" : "✦ Sugerir com IA"}
              </button>
            )}
            <button className="btn btn-primary" onClick={openAdd}><span className="row" style={{ gap: 7 }}><IconPlus /> Nova meta</span></button>
          </span>
        }
      />

      {(sugErr || suggestions) && (
        <motion.div {...fade(1)} className="panel sug-panel">
          <div className="panel-head">
            <h2>✦ Sugestões da IA</h2>
            <button className="link" onClick={() => { setSuggestions(null); setSugErr(null); }}>fechar</button>
          </div>
          {sugErr && <div className="glx-err" style={{ color: "var(--coral)" }}>{sugErr}</div>}
          {suggestions && sugSummary && <p className="chart-note" style={{ marginTop: 0 }}>{sugSummary}</p>}
          {suggestions && suggestions.map((s, i) => (
            <div className="sug-item" key={i}>
              <div className="sug-info">
                <b>{s.goal}</b>
                <span className="sug-title">{s.title}</span>
                <p>{s.text}</p>
              </div>
              {typeof s.suggestedMonthly === "number" && (
                <button className="btn-sm btn-mint" onClick={() => applySuggestion(s)}>
                  Aplicar {brl0(s.suggestedMonthly)}/mês
                </button>
              )}
            </div>
          ))}
          {suggestions && suggestions.length === 0 && <div className="empty">Sem sugestões no momento.</div>}
        </motion.div>
      )}

      {goals.length === 0 && (
        <motion.div {...fade(1)} className="panel" style={{ textAlign: "center", padding: 40 }}>
          <div className="empty">Você ainda não tem metas. Crie a primeira e o Pulso acompanha a probabilidade de chegar lá.</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}><span className="row" style={{ gap: 7 }}><IconPlus /> Nova meta</span></button>
        </motion.div>
      )}

      {/* RESUMO GERAL — no topo, antes das metas */}
      {goals.length > 0 && (
        <motion.div {...fade(1)} className="panel goals-summary">
          <div className="panel-head"><h2>Visão geral das metas</h2><span className="hint-cap">{goals.length} ativas</span></div>

          <div className="gs-stats">
            <div className="gs-stat">
              <span className="k">Já juntado do total</span>
              <span className="v">{brl0(totalSaved)}</span>
              <span className="f">de {brl0(totalTarget)}</span>
            </div>
            <div className="gs-stat">
              <span className="k">Concluído da meta</span>
              <span className="v" style={{ color: progressColor(totalPct) }}>{Math.round(totalPct * 100)}%</span>
              <span className="f">do valor total</span>
            </div>
            <div className="gs-stat">
              <span className="k">Guardar por mês</span>
              <span className="v">{brl0(totalMonthly)}</span>
              <span className="f">somando as {goals.length}</span>
            </div>
            <div className="gs-stat">
              <span className="k">Prob. média</span>
              <span className="v" style={{ color: avgProb >= 0.8 ? "var(--mint)" : avgProb >= 0.6 ? "var(--amber)" : "var(--coral)" }}>{Math.round(avgProb * 100)}%</span>
              <span className="f">concluir no prazo</span>
            </div>
          </div>

          <div className="gs-bar">
            <motion.i style={{ background: progressColor(totalPct) }} initial={{ width: 0 }} animate={{ width: `${Math.round(totalPct * 100)}%` }} transition={{ duration: 1, ease: EASE }} />
          </div>
          <div className="gs-bar-cap"><span>{brl0(totalSaved)} batido</span><span>{brl0(totalTarget)} total</span></div>

          <div className="gs-chart-head">Progresso projetado do total ao longo dos meses</div>
          <GoalsProgressChart goals={goals} horizon={horizon} />
        </motion.div>
      )}

      {goals.map((g, i) => {
        const color = progressColor(g.progress);
        return (
          <motion.div {...fade(i + 2)} key={g.id} className="goal-card">
            <div className="goal-top">
              <div className="g-ic"><CatIcon name={g.icon} /></div>
              <div style={{ flex: 1 }}>
                <b>{g.name}</b>
                <small>{brl0(g.saved)} de {brl0(g.target)} · meta {g.targetDate || "sem prazo"} · faltam {g.monthsLeft} meses</small>
              </div>
              <div className="goal-card-actions">
                <button aria-label="editar" onClick={() => openEdit(g)}><IconEdit /></button>
                <button aria-label="remover" className="danger" onClick={() => deleteGoal(g.id)}><IconTrash /></button>
              </div>
            </div>

            <div className="goal-body">
              <div className="ring-wrap" style={{ width: 130, height: 130 }}>
                <ScoreRing value={g.progress * 100} size={130} thickness={11} color={color} glow={false} delay={0.2 + i * 0.1} />
                <div className="ring-center">
                  <div className="big" style={{ fontSize: 34, color }}>{Math.round(g.progress * 100)}<span className="unit">%</span></div>
                  <div className="lbl" style={{ fontSize: 9, color: "var(--text-mute)" }}>progresso</div>
                </div>
              </div>

              <div className="goal-metrics">
                <div className="metric">
                  <span className="k">Probabilidade de atingir até {g.targetDate || "a data"}</span>
                  <span className="v" style={{ color: g.probability >= 0.8 ? "var(--mint)" : g.probability >= 0.6 ? "var(--amber)" : "var(--coral)" }}>{Math.round(g.probability * 100)}%</span>
                </div>
                <div className="metric">
                  <span className="k">Quanto guardar por mês</span>
                  <span className="v">{brl0(g.monthlyNeeded)}<span className="muted mono" style={{ fontSize: 12, fontWeight: 400 }}> / hoje {brl0(g.monthlyCurrent)}</span></span>
                </div>
                <div className="metric">
                  <span className="k">Falta juntar</span>
                  <span className="v">{brl0(g.target - g.saved)}</span>
                </div>
              </div>
            </div>

            {g.actions.length > 0 && (
              <div className="goal-actions">
                <div className="ga-head">Ações sugeridas pela IA</div>
                {g.actions.map((a) => (
                  <div className="action-item" key={a}><span className="chk"><IconCheck /></span>{a}</div>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}

      <GoalModal open={goalOpen} onClose={() => setGoalOpen(false)} edit={goalEdit} />
    </div>
  );
}

/* ============================================================
   4. PROJEÇÃO — saldo no mês + áreas de corte selecionáveis
   ============================================================ */
const WHATIF_EXEMPLOS = [
  "E se eu cortar metade do delivery?",
  "E se eu receber R$ 1.000 extra?",
  "E se eu adiar a fatura do cartão?",
  "E se eu gastar 20% a menos no mês?",
];

/** Traduz os knobs do motor em chips legíveis pro usuário. */
function adjLabels(adj: Record<string, number | boolean>): string[] {
  const out: string[] = [];
  const pct = (v: number) => `${v > 1 ? "+" : ""}${Math.round((v - 1) * 100)}%`;
  if (typeof adj.spendPct === "number" && adj.spendPct !== 1) out.push(`gasto variável ${pct(adj.spendPct)}`);
  if (typeof adj.recurringPct === "number" && adj.recurringPct !== 1) out.push(`gastos fixos ${pct(adj.recurringPct)}`);
  if (typeof adj.extraIncome === "number" && adj.extraIncome > 0) out.push(`+${brl0(adj.extraIncome)} de entrada`);
  if (typeof adj.oneOffExpense === "number" && adj.oneOffExpense > 0) out.push(`−${brl0(adj.oneOffExpense)} pontual`);
  if (adj.skipCreditBill === true) out.push("adia a fatura");
  return out;
}

export function ProjectionPage() {
  const { data, recurringCandidates, confirmRecurringCandidate, dismissRecurringCandidate, saveCutPlan, clearCutPlan } = useData();
  const { projection, user, recurring, balance, spendByCategory, cutPlan } = data!;

  const [cuts, setCuts] = useState<Record<string, number>>({});
  const [recOpen, setRecOpen] = useState(false);
  const [recEdit, setRecEdit] = useState<Recurring | null>(null);
  const [confirmingRec, setConfirmingRec] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set()); // áreas de corte ocultas
  const [chooserOpen, setChooserOpen] = useState(false);

  function toggleArea(id: string) {
    setHidden((h) => {
      const n = new Set(h);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // what-if por IA: usuário descreve um cenário → backend traduz e re-roda o MC
  const [wiDraft, setWiDraft] = useState("");
  const [wiLoading, setWiLoading] = useState(false);
  const [wiErr, setWiErr] = useState("");
  const [scenario, setScenario] = useState<WhatIf | null>(null);

  async function runWhatIf(text: string) {
    const t = text.trim();
    if (!t || wiLoading) return;
    setWiLoading(true);
    setWiErr("");
    try {
      const r = await api.projectionWhatIf(t);
      if (r.error) setWiErr(r.error);
      else setScenario(r);
    } catch (e: any) {
      setWiErr(String(e?.message ?? e));
    } finally {
      setWiLoading(false);
    }
  }
  function clearScenario() {
    setScenario(null);
    setWiDraft("");
    setWiErr("");
  }

  // áreas de corte = gasto real por categoria (conta+cartão) + gastos fixos
  // ativos que você cadastrou (esses não têm transação ainda, então não vêm no
  // gasto por categoria). Pula entradas/transferências/investimentos.
  const SKIP_CUT = /transfer|investiment|renda|entrada|sal[áa]rio/i;
  const iconByCat: Record<string, string> = Object.fromEntries(ICON_OPTIONS.map((o) => [o.label, o.key]));
  const catAreas = Object.entries(spendByCategory ?? {})
    .filter(([cat, v]) => v > 0 && !SKIP_CUT.test(cat))
    .map(([label, spent]) => ({ id: `cat:${label}`, label, spent, icon: iconByCat[label] ?? "card", fixo: false }));
  const catLabels = new Set(catAreas.map((a) => a.label.toLowerCase()));
  const recAreas = recurring
    .filter((r) => r.active && r.amount > 0 && !catLabels.has(r.label.toLowerCase()))
    .map((r) => ({ id: `rec:${r.id}`, label: r.label, spent: r.amount, icon: r.icon || "card", fixo: true }));
  const allAreas = [...catAreas, ...recAreas].sort((a, b) => b.spent - a.spent);

  // só as áreas escolhidas (não ocultas) entram no plano e na conta
  const cutAreas = allAreas.filter((a) => !hidden.has(a.id));

  // corte total: cada área pode ser cortada até zerar o próprio gasto
  const totalCut = cutAreas.reduce((a, x) => a + Math.min(cuts[x.id] || 0, x.spent), 0);

  const plan = useMemo(() => {
    const { median, todayIndex, daysInMonth } = projection;
    const remaining = daysInMonth - 1 - todayIndex;
    return median.map((v, i) => {
      if (i <= todayIndex || remaining <= 0) return v;
      const ramp = (i - todayIndex) / remaining;
      return Math.round(v + totalCut * ramp);
    });
  }, [totalCut, projection]);

  const baseClose = projection.expected;
  // Novo fechamento parte da MESMA base do "ritmo atual" (média da simulação)
  // e soma só o que você cortou — assim o "X melhor" = exatamente o total cortado,
  // sem o viés média/mediana que deslocava o número.
  const newClose = baseClose + totalCut;

  // Probabilidade derivada da distribuição Normal implícita da simulação.
  // spread p80–p20 ≈ 2,56σ → estimamos o σ dos valores finais.
  // P(saldo < 0) = Φ(−newClose / σ)
  const newProbNeg = useMemo(() => {
    const spread = projection.optimistic - projection.pessimistic; // p80 - p20
    const mcSigma = spread > 0 ? spread / 2.56 : 1;
    // Sigma do MC captura só variância dia-a-dia; como piso, usamos 6% da renda
    // mensal, que é a incerteza de planejamento relevante para avaliar cortes.
    const sigma = Math.max(mcSigma, balance.income * 0.06);
    const z = -newClose / sigma;
    // CDF normal aproximada (Abramowitz & Stegun)
    const absZ = Math.abs(z);
    const t = 1 / (1 + 0.2316419 * absZ);
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    return Math.min(1, Math.max(0, z < 0 ? p : 1 - p));
  }, [newClose, projection.optimistic, projection.pessimistic, balance.income]);

  const isPos = newClose >= 0;
  const ganho = newClose - baseClose;

  function setCut(id: string, v: number) {
    setCuts((c) => ({ ...c, [id]: v }));
  }
  async function transformPlan() {
    const items = cutAreas
      .map((a) => ({ label: a.label, icon: a.icon, cut: Math.min(cuts[a.id] || 0, a.spent) }))
      .filter((x) => x.cut > 0);
    await saveCutPlan(items);
  }
  const planTotal = cutPlan.reduce((a, x) => a + x.cut, 0);

  function openAddRec() { setRecEdit(null); setRecOpen(true); }
  function openEditRec(r: Recurring) { setRecEdit(r); setRecOpen(true); }

  const totalRecurring = recurring.filter((r) => r.active).reduce((a, r) => a + r.amount, 0);

  return (
    <div className="page">
      <PageHead kicker="como o mês vai fechar" title={`Projeção de ${user.monthLabel}`} />

      {/* WHAT-IF POR IA: descreve um cenário em PT-BR → IA recalcula o Monte Carlo */}
      <motion.div {...fade(0)} className="panel whatif-ai">
        <div className="panel-head">
          <h2>Simule um cenário com IA</h2>
          <span className="hint-cap">what-if</span>
        </div>
        <p className="chart-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Descreva uma mudança em português — a IA traduz e recalcula sua projeção do mês. Nada é salvo.
        </p>
        <div className="composer wifi-composer">
          <input
            value={wiDraft}
            onChange={(e) => setWiDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runWhatIf(wiDraft)}
            placeholder="Ex.: e se eu cortar metade do delivery?"
            disabled={wiLoading}
          />
          <button className="send" onClick={() => runWhatIf(wiDraft)} disabled={wiLoading} aria-label="simular">
            {wiLoading ? <span className="wifi-spin" /> : <IconSend />}
          </button>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {WHATIF_EXEMPLOS.map((c) => (
            <button key={c} className="chip" disabled={wiLoading} onClick={() => { setWiDraft(c); runWhatIf(c); }}>{c}</button>
          ))}
        </div>
        {wiErr && <div className="form-error" style={{ marginTop: 12 }}>Não consegui simular: {wiErr}</div>}
        {scenario && (
          <motion.div
            className="wifi-result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {scenario.note && <div className="wifi-note">💡 {scenario.note}</div>}
            <div className="wifi-cmp">
              <div className="wifi-col">
                <span className="lbl">No ritmo atual</span>
                <span className="num">{brl0(scenario.base.expected)}</span>
                <small>{Math.round(scenario.base.probabilityNegative * 100)}% no vermelho</small>
              </div>
              <div className="wifi-arrow">→</div>
              <div className="wifi-col">
                <span className="lbl">Nesse cenário</span>
                <span className="num" style={{ color: scenario.scenario.expected >= 0 ? "var(--mint)" : "var(--coral)" }}>
                  {brl0(scenario.scenario.expected)}
                </span>
                <small>{Math.round(scenario.scenario.probabilityNegative * 100)}% no vermelho</small>
              </div>
            </div>
            {(() => {
              const diff = scenario.scenario.expected - scenario.base.expected;
              const melhor = diff >= 0;
              return (
                <div className="wifi-delta" style={{ color: melhor ? "var(--mint)" : "var(--coral)" }}>
                  {melhor ? "▲" : "▼"} {brl0(Math.abs(diff))} {melhor ? "a mais" : "a menos"} no fim do mês
                </div>
              );
            })()}
            {adjLabels(scenario.adjustments).length > 0 && (
              <div className="wifi-chips">
                {adjLabels(scenario.adjustments).map((l) => <span key={l} className="wifi-tag">{l}</span>)}
              </div>
            )}
            <button className="link" onClick={clearScenario} style={{ marginTop: 4 }}>limpar cenário</button>
          </motion.div>
        )}
      </motion.div>

      {/* banner: gastos fixos detectados pelo Cumbuca aguardando confirmação */}
      {recurringCandidates.length > 0 && (
        <motion.div {...fade(0)} className="rec-candidates-banner">
          <div className="rcb-head">
            <span className="rcb-icon">📌</span>
            <div>
              <strong>Possíveis gastos fixos detectados</strong>
              <span className="rcb-sub">Confirme os que repetem todo mês para melhorar sua projeção</span>
            </div>
          </div>
          <div className="rcb-list">
            {recurringCandidates.map((c) => (
              <div key={c.merchant} className="rcb-item">
                <div className="rcb-info">
                  <span className="rcb-name">{c.merchant}</span>
                  <span className="rcb-meta">
                    {brl0(c.amount)}{c.suggestedDay ? ` · todo dia ${c.suggestedDay}` : ""}
                  </span>
                </div>
                <div className="rcb-actions">
                  <button
                    className="btn-sm btn-mint"
                    disabled={confirmingRec === c.merchant}
                    onClick={async () => {
                      setConfirmingRec(c.merchant);
                      await confirmRecurringCandidate(c);
                      setConfirmingRec(null);
                    }}
                  >
                    {confirmingRec === c.merchant ? "..." : "Confirmar"}
                  </button>
                  <button
                    className="btn-sm btn-ghost"
                    onClick={() => dismissRecurringCandidate(c.merchant)}
                  >
                    Ignorar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* topo: fechamento base vs com plano */}
      <motion.div {...fade(1)} className="proj-summary">
        <div className="ps-block">
          <span className="ps-k">No ritmo atual</span>
          <span className={`ps-v ${baseClose < 0 ? "neg" : "pos"}`}>{brl0(baseClose)}</span>
          <span className="ps-f">{Math.round(projection.probabilityNegative * 100)}% de chance de fechar no vermelho</span>
        </div>
        <div className="ps-arrow">→</div>
        <div className="ps-block">
          <span className="ps-k">Com seu plano de cortes</span>
          <span className="ps-v" style={{ color: isPos ? "var(--mint)" : totalCut > 0 ? "var(--amber)" : "var(--text-mute)" }}>{totalCut > 0 ? brl0(newClose) : "—"}</span>
          <span className="ps-f">{totalCut > 0 ? `${brl0(ganho)} melhor · ${Math.round(newProbNeg * 100)}% no vermelho` : "ajuste os cortes ao lado"}</span>
        </div>
      </motion.div>

      <div className="grid cols-12">
        {/* gráfico */}
        <motion.div {...fade(2)} className="panel span-8">
          <div className="panel-head">
            <h2>Saldo projetado no mês</h2>
            <div className="proj-legend">
              <span><i className="ln solid" /> realizado</span>
              <span><i className="ln dash" /> projeção</span>
              {scenario ? <span><i className="ln plan" /> cenário IA</span>
                : totalCut > 0 && <span><i className="ln plan" /> com plano</span>}
            </div>
          </div>
          <ProjectionChart median={projection.median} todayIndex={projection.todayIndex} plan={scenario ? scenario.scenario.median : totalCut > 0 ? plan : undefined} monthLabel={user.monthLabel} />
          <div className="foot-note">simulação Monte Carlo · {projection.driver}</div>
        </motion.div>

        {/* áreas de corte */}
        <motion.div {...fade(3)} className="panel span-4">
          <div className="panel-head">
            <h2>Onde você corta</h2>
            <button className="link-add" onClick={() => setChooserOpen((o) => !o)}>
              {chooserOpen ? "ok" : "escolher áreas"}
            </button>
          </div>

          {chooserOpen && (
            <div className="cut-chooser">
              {allAreas.length === 0 && <div className="empty">Nenhuma área disponível. Adicione gastos fixos abaixo.</div>}
              {allAreas.map((a) => {
                const on = !hidden.has(a.id);
                return (
                  <button key={a.id} className={`cut-pick ${on ? "on" : ""}`} onClick={() => toggleArea(a.id)} title={on ? "tocar p/ ocultar" : "tocar p/ incluir"}>
                    <span className="cp-ic"><CatIcon name={a.icon} /></span>
                    <span className="cp-lb">{a.label}</span>
                    {a.fixo && <em className="cp-fixo">fixo</em>}
                    <span className="cp-check">{on ? "✓" : "+"}</span>
                  </button>
                );
              })}
            </div>
          )}

          {cutAreas.length === 0 && <div className="empty">Nenhuma área selecionada. Toque em “escolher áreas”.</div>}

          {cutAreas.map((a) => {
            const spent     = a.spent;
            const cut       = Math.min(cuts[a.id] || 0, spent);
            const sliderVal = spent - cut;                 // gasto projetado (0..spent)
            const tp = spent > 0 ? (sliderVal / spent) * 100 : 0;

            const keepColor = "color-mix(in srgb,var(--text) 28%,var(--panel-3))";
            const cutColor  = "color-mix(in srgb,var(--mint) 45%,var(--panel-3))";
            const trackBg = `linear-gradient(to right,
              ${keepColor} 0%, ${keepColor} ${tp}%,
              ${cutColor} ${tp}%, ${cutColor} 100%)`;

            return (
              <div className="cut" key={a.id}>
                <div className="cut-head">
                  <span className="cut-ic"><CatIcon name={a.icon} /></span>
                  <span className="cut-label">{a.label}{a.fixo && <span className="cut-fixo">fixo</span>}</span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={spent}
                  step={1}
                  value={sliderVal}
                  disabled={spent === 0}
                  style={{ background: trackBg }}
                  onChange={(e) => setCut(a.id, spent - Number(e.target.value))}
                />
                <div className="cut-scale">
                  <span>
                    <span style={{ color: "var(--text-mute)" }}>{brl0(spent)} gastos</span>
                    {cut > 0 && (
                      <span> · cortar <b style={{ color: "var(--mint)" }}>{brl0(cut)}</b></span>
                    )}
                  </span>
                  <span style={{ color: "var(--text-mute)" }}>fica {brl0(sliderVal)}</span>
                </div>
              </div>
            );
          })}

          <div className="whatif-result">
            <div>
              <div className="lbl">Total cortado</div>
              <div className="num" style={{ color: totalCut > 0 ? "var(--mint)" : "var(--text-mute)" }}>{brl0(totalCut)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="lbl">Novo fechamento</div>
              <div className="num" style={{ fontSize: 22, color: isPos ? "var(--mint)" : totalCut > 0 ? "var(--amber)" : "var(--coral)" }}>{brl0(newClose)}</div>
            </div>
          </div>
          {totalCut > 0 && <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={transformPlan}>Transformar em plano</button>}
        </motion.div>
      </div>

      {/* gastos fixos */}
      <motion.div {...fade(4)} className="panel">
        <div className="panel-head">
          <h2>Gastos fixos mensais</h2>
          <button className="link-add" onClick={openAddRec}><IconPlus /> adicionar</button>
        </div>
        <p className="chart-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Aplicados como eventos determinísticos na simulação Monte Carlo · total ativo: <b>{brl0(totalRecurring)}/mês</b>
        </p>
        {recurring.length === 0 && <div className="empty">Nenhum gasto fixo. Adicione aluguel, planos de assinatura, etc.</div>}
        <div className="rec-list">
          {recurring.map((r) => (
            <div className={`rec-item ${r.active ? "" : "rec-inactive"}`} key={r.id}>
              <span className="rec-ic"><CatIcon name={r.icon} /></span>
              <div className="rec-info">
                <b>{r.label}</b>
                <small>dia {r.dayOfMonth} · {r.active ? "ativo" : "inativo"}</small>
              </div>
              <span className="rec-amt">{brl0(r.amount)}/mês</span>
              <button className="cut-edit" aria-label="editar" onClick={() => openEditRec(r)}><IconEdit /></button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* plano de corte — persistido no backend; criado ao "Transformar em plano" */}
      {cutPlan.length > 0 && (
        <motion.div {...fade(5)} className="panel">
          <div className="panel-head">
            <h2>Plano de corte de gastos</h2>
            <button className="link-add" onClick={() => clearCutPlan()}>limpar</button>
          </div>
          <p className="chart-note" style={{ marginTop: 0, marginBottom: 12 }}>
            Cortes que você decidiu aplicar este mês · economia total: <b style={{ color: "var(--mint)" }}>{brl0(planTotal)}/mês</b>
          </p>
          <div className="rec-list">
            {cutPlan.map((x) => (
              <div className="rec-item" key={x.label}>
                <span className="rec-ic"><CatIcon name={x.icon} /></span>
                <div className="rec-info">
                  <b>{x.label}</b>
                  <small>cortar deste mês</small>
                </div>
                <span className="rec-amt" style={{ color: "var(--mint)" }}>− {brl0(x.cut)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <RecurringModal open={recOpen} onClose={() => setRecOpen(false)} edit={recEdit} />
    </div>
  );
}

/* ============================================================
   5. ASSISTENTE IA — roteiro local; recomendações do backend
   ============================================================ */
const SUGESTOES = [
  "Vou fechar o mês no positivo?",
  "Onde estou gastando mais?",
  "Quanto dá pra guardar com segurança?",
  "Tem algum gasto fora do padrão?",
];


export function AssistantSheet({ onClose }: { onClose: () => void }) {
  const { data } = useData();
  const { recommendations } = data!;
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [bankStatus, setBankStatus] = useState<BankStatus | null>(null);
  const [bankErr, setBankErr] = useState(false);
  const [bankModal, setBankModal] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  const refreshBank = () => api.bankStatus().then(setBankStatus).catch(() => {});

  // Estado da conexão vem do BACKEND (sobrevive a F5), não do query param.
  useEffect(() => { refreshBank(); }, []);

  // Retorno do OAuth da Cumbuca: ?bank=connected | error
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("bank");
    if (p) {
      if (p === "error") setBankErr(true);
      if (p === "connected") refreshBank();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const connected = !!bankStatus?.connected;
  const syncedAt = bankStatus?.syncedAt ? bankStatus.syncedAt.slice(11, 16) : null;

  function onBankClick() {
    if (connected) setBankModal(true);          // conectado → abre gerência (não refaz OAuth)
    else api.bankConnectUrl().then((r) => { window.location.href = r.url; }).catch(() => {});
  }

  // Chat real: chama o backend (OpenAI gpt-5.4-mini lê o contexto Monte Carlo).
  async function send(text: string) {
    const t = text.trim();
    if (!t || typing) return;
    const history = msgs.map((m) => ({ from: m.from, text: m.text }));
    setMsgs((m) => [...m, { id: `u${m.length}`, from: "user", text: t }]);
    setDraft("");
    setTyping(true);
    try {
      const r = await api.assistant(t, history);
      const reply = r.reply ?? (r.error ? `⚠️ ${r.error}` : "Sem resposta do assistente.");
      setMsgs((m) => [...m, { id: `b${m.length}`, from: "app", text: reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { id: `b${m.length}`, from: "app", text: `⚠️ ${String(e?.message ?? e)}` }]);
    } finally {
      setTyping(false);
    }
  }

  const vazio = msgs.length === 0 && !typing;
  const subtitle = connected
    ? syncedAt ? `online · sincronizado ${syncedAt}` : "online · conecte e sincronize"
    : "modo demonstração · conecte seu banco";

  return (
    <motion.div
      className="ai-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="ai-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Assistente Pulso"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ai-grab" />
        <div className="chat-head">
          <div className="av"><IconBolt /></div>
          <div className="ai-head-txt"><b>Assistente Pulso</b><small>{subtitle}</small></div>
          <button className="btn btn-ghost btn-sm ai-bank-btn" onClick={onBankClick}>
            {connected ? "✓ Banco conectado" : "Conectar banco (Cumbuca)"}
          </button>
          <button className="modal-x" onClick={onClose} aria-label="fechar assistente">×</button>
        </div>
        {bankErr && (
          <div style={{ padding: "8px 14px", color: "var(--danger, #e5484d)", fontSize: 13 }}>
            Falha ao conectar o banco. Veja o console do backend.
          </div>
        )}
        <div className="chat-thread">
          {vazio ? (
            /* estado vazio estilo claude.ai: saudação + chips + recomendações */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center",
              }}
            >
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>
                Como posso ajudar com seu dinheiro?
              </h2>
              <div className="chips" style={{ justifyContent: "center", maxWidth: 480 }}>
                {SUGESTOES.map((c) => <button key={c} className="chip" onClick={() => send(c)}>{c}</button>)}
              </div>
              {recommendations.length > 0 && (
                <div className="ai-recos">
                  {recommendations.map((r) => (
                    <div className={`reco ${r.tone}`} key={r.id}>
                      <div className="ic"><CatIcon name={r.icon} /></div>
                      <h3>{r.title}</h3>
                      <p>{r.text}</p>
                      <div className="reco-foot"><span className="impact">{r.impact}</span><button className="btn btn-ghost btn-sm" onClick={() => send(r.title)}>{r.cta}</button></div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {msgs.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease: EASE }}
                    className="bubble-row"
                    style={{ textAlign: m.from === "user" ? "right" : "left" }}
                  >
                    <span className={`bubble ${m.from}`}>{m.text}</span>
                  </motion.div>
                ))}
              </AnimatePresence>

              {typing && <div className="typing"><i /><i /><i /></div>}
              <div ref={endRef} />
            </>
          )}
        </div>
        <div className="composer">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(draft)} placeholder="Pergunte algo ou toque numa opção…" />
          <button className="send" onClick={() => send(draft)} aria-label="enviar"><IconSend /></button>
        </div>

        <BankModal
          open={bankModal}
          onClose={() => setBankModal(false)}
          status={bankStatus}
          onChanged={refreshBank}
        />
      </motion.div>
    </motion.div>
  );
}
