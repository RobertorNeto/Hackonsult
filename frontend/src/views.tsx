import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  brl,
  brl0,
  chatScript,
  chatSeed,
  progressColor,
  zoneColor,
  type Goal,
  type Tx,
  type ChatMsg,
} from "./data/mock";
import { useData } from "./store";
import {
  GoalsProgressChart,
  ProbRing,
  ProjectionChart,
  ScoreHistory,
  ScoreRing,
} from "./components/charts";
import { CatIcon, VITAL_ICON } from "./components/caticon";
import { CutCategoryModal, GoalModal, TransactionModal } from "./components/modals";
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
import type { Lever } from "./data/mock";

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
  const { health, balance, user, goals, transactions } = data!;
  const [txOpen, setTxOpen] = useState(false);
  const [txEdit, setTxEdit] = useState<Tx | null>(null);

  const zone = zoneColor(health.zone);
  const creditPct = Math.round((balance.creditUsed / balance.creditLimit) * 100);
  const spentPct = balance.income ? Math.round((balance.spent / balance.income) * 100) : 0;
  const estPct = balance.income ? Math.round((balance.estSpend / balance.income) * 100) : 0;
  const monthClose = balance.income - balance.estSpend;
  const scale = Math.max(118, estPct + 12);
  const pos = (p: number) => (p / scale) * 100;
  const focusVitals = health.vitals.filter((v) => ["fluxo", "cartao", "reserva"].includes(v.key));

  function openAdd() { setTxEdit(null); setTxOpen(true); }
  function openEdit(t: Tx) { setTxEdit(t); setTxOpen(true); }

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
          <button className="btn btn-primary" onClick={() => go("health")}>Ver minha saúde</button>
          <button className="btn btn-ghost" onClick={() => go("assistant")}>Falar com a IA</button>
        </div>
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
          <span className="renda" style={{ left: `${pos(100)}%` }}><em>renda</em></span>
          <motion.span className="mark" style={{ left: `${pos(estPct)}%` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 1.2 }} />
        </div>
        <div className="flow-legend">
          <span className="lg"><i className="dot out" /> Gastou {spentPct}% da renda</span>
          <span className="lg"><i className="dot est" /> Estimativa: {estPct}% da renda</span>
        </div>
        <div className="flow-foot">Nesse ritmo o mês fecha <b style={{ color: monthClose < 0 ? "var(--coral)" : "var(--mint)" }}>{brl0(monthClose)}</b> · fatura {brl0(balance.creditUsed)} ({creditPct}% do limite)</div>
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
  const { health } = data!;
  const [open, setOpen] = useState<string | null>("cartao");

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
            <div><span className="k">Este mês</span><div className="v" style={{ color: "var(--coral)" }}>{health.deltaMonth} pts</div></div>
            <div><span className="k">Melhor mês</span><div className="v">73 · Mar</div></div>
            <div><span className="k">Média 6m</span><div className="v">68</div></div>
          </div>
        </motion.div>

        <motion.div {...fade(2)} className="panel span-7">
          <div className="panel-head"><h2>Evolução do score</h2><span className="hint-cap">6 meses</span></div>
          <ScoreHistory data={health.history} />
          <p className="chart-note">
            Caiu de <b style={{ color: "var(--text)" }}>73</b> (mar) para <b style={{ color: "var(--coral)" }}>58</b> agora. O cartão puxou pra baixo.
          </p>
        </motion.div>
      </div>

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

        <div className="span-5 grid" style={{ gap: 18, alignContent: "start" }}>
          <motion.div {...fade(4)} className="reco mint">
            <div className="ic"><IconBolt /></div>
            <h3>Como subir 9 pontos</h3>
            <p>Pague R$ 200 a mais na fatura este mês. Só isso tira o cartão da zona crítica e devolve ~9 pts ao seu score.</p>
            <div className="reco-foot"><span className="impact">+9 pts</span><button className="btn btn-primary btn-sm">Aplicar</button></div>
          </motion.div>
          <motion.div {...fade(5)} className="reco amber">
            <div className="ic"><IconShield /></div>
            <h3>Reserva ainda no começo</h3>
            <p>Seu colchão cobre 0,4 mês sem renda. Separar R$ 150 automático no dia do salário começa a virar esse jogo.</p>
            <div className="reco-foot"><span className="impact">0,4 → 1 mês</span><button className="btn btn-ghost btn-sm">Simular</button></div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   3. METAS — progresso colorido + editar + resumo
   ============================================================ */
export function GoalsPage() {
  const { data, deleteGoal } = useData();
  const { goals } = data!;
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalEdit, setGoalEdit] = useState<Goal | null>(null);

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
        right={<button className="btn btn-primary" onClick={openAdd}><span className="row" style={{ gap: 7 }}><IconPlus /> Nova meta</span></button>}
      />

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
export function ProjectionPage() {
  const { data } = useData();
  const { projection, levers, user } = data!;

  // áreas ativas (sugeridas), trocáveis; mantém-se válidas se o pool mudar
  const [activeIds, setActiveIds] = useState<string[]>(() => levers.slice(0, 3).map((l) => l.id));
  const [cuts, setCuts] = useState<Record<string, number>>({});
  const [catOpen, setCatOpen] = useState(false);
  const [catEdit, setCatEdit] = useState<Lever | null>(null);

  useEffect(() => {
    setActiveIds((prev) => {
      const valid = prev.filter((id) => levers.some((l) => l.id === id));
      const extra = levers.map((l) => l.id).filter((id) => !valid.includes(id));
      const want = Math.min(3, levers.length);
      return [...valid, ...extra].slice(0, want);
    });
  }, [levers]);

  const byId = useMemo(() => Object.fromEntries(levers.map((l) => [l.id, l])), [levers]);
  // corte por área limitado ao gasto total da área
  const totalCut = activeIds.reduce((a, id) => a + Math.min(cuts[id] || 0, byId[id]?.current ?? 0), 0);

  const plan = useMemo(() => {
    const { median, todayIndex, daysInMonth } = projection;
    const remaining = daysInMonth - 1 - todayIndex;
    return median.map((v, i) => {
      if (i <= todayIndex || remaining <= 0) return v;
      const ramp = (i - todayIndex) / remaining;
      return Math.round(v + totalCut * ramp);
    });
  }, [totalCut, projection]);

  const newClose = plan[plan.length - 1];
  const baseClose = projection.expected;
  const newProbNeg = Math.max(0.04, projection.probabilityNegative - totalCut / 900);
  const isPos = newClose >= 0;
  const ganho = newClose - baseClose;

  function swap(slot: number, newId: string) {
    setActiveIds((ids) => ids.map((id, i) => (i === slot ? newId : id)));
  }
  function setCut(id: string, v: number) {
    setCuts((c) => ({ ...c, [id]: v }));
  }
  function openAddCat() { setCatEdit(null); setCatOpen(true); }
  function openEditCat(l: Lever) { setCatEdit(l); setCatOpen(true); }

  return (
    <div className="page">
      <PageHead kicker="como o mês vai fechar" title={`Projeção de ${user.monthLabel}`} />

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
              {totalCut > 0 && <span><i className="ln plan" /> com plano</span>}
            </div>
          </div>
          <ProjectionChart median={projection.median} todayIndex={projection.todayIndex} plan={totalCut > 0 ? plan : undefined} monthLabel={user.monthLabel} />
          <div className="foot-note">simulação Monte Carlo · {projection.driver}</div>
        </motion.div>

        {/* áreas de corte */}
        <motion.div {...fade(3)} className="panel span-4">
          <div className="panel-head">
            <h2>Onde você corta</h2>
            <button className="link-add" onClick={openAddCat}><IconPlus /> categoria</button>
          </div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Arraste quanto cortar em cada área. Troque a categoria no menu ou edite o gasto no lápis.</p>

          {activeIds.length === 0 && <div className="empty">Sem categorias. Adicione uma pra simular cortes.</div>}

          {activeIds.map((id, slot) => {
            const l = byId[id];
            if (!l) return null;
            const cut = Math.min(cuts[id] || 0, l.current);
            const options = levers.filter((o) => o.id === id || !activeIds.includes(o.id));
            return (
              <div className="cut" key={id}>
                <div className="cut-head">
                  <span className="cut-ic"><CatIcon name={l.icon} /></span>
                  <select className="cut-select" value={id} onChange={(e) => swap(slot, e.target.value)}>
                    {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  <button className="cut-edit" aria-label="editar categoria" onClick={() => openEditCat(l)}><IconEdit /></button>
                </div>
                <input type="range" min={0} max={l.current} step={10} value={cut} onChange={(e) => setCut(id, Number(e.target.value))} />
                <div className="cut-scale">
                  <span>cortar <b style={{ color: cut > 0 ? "var(--mint)" : "var(--text-mute)" }}>{brl0(cut)}</b></span>
                  <span>de {brl0(l.current)}/mês</span>
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
          {totalCut > 0 && <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }}>Transformar em plano</button>}
        </motion.div>
      </div>

      <CutCategoryModal open={catOpen} onClose={() => setCatOpen(false)} edit={catEdit} />
    </div>
  );
}

/* ============================================================
   5. ASSISTENTE IA — roteiro local; recomendações do backend
   ============================================================ */
export function AssistantPage() {
  const { data } = useData();
  const { recommendations } = data!;
  const [msgs, setMsgs] = useState<ChatMsg[]>(chatSeed);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, typing]);

  function send(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMsg = { id: `u${msgs.length}-${text.slice(0, 4)}`, from: "user", text };
    setMsgs((m) => [...m.map((x) => ({ ...x, chips: undefined })), userMsg]);
    setDraft("");
    setTyping(true);
    const replies = chatScript[text] ?? chatScript.__default;
    replies.forEach((r, i) => {
      setTimeout(() => {
        if (i === 0) setTyping(false);
        setMsgs((m) => [...m, { ...r, id: `${r.id}-${m.length}` }]);
        if (i < replies.length - 1) setTyping(true);
      }, 850 + i * 1100);
    });
  }

  const lastChips = !typing ? msgs[msgs.length - 1]?.chips : undefined;
  const showGoal = msgs.some((m) => m.card === "objetivo") && !typing;

  return (
    <div className="page">
      <PageHead kicker="captura conversacional" title="Assistente Pulso" />

      <div className="chat-shell">
        <motion.div {...fade(1)} className="chat-panel">
          <div className="chat-head">
            <div className="av"><IconBolt /></div>
            <div><b>Assistente Pulso</b><small>online · lê suas transações em tempo real</small></div>
          </div>
          <div className="chat-thread">
            <AnimatePresence initial={false}>
              {msgs.map((m) => (
                <motion.div key={m.id} layout initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.32, ease: EASE }} className={`bubble ${m.from}`}>
                  {m.text}
                </motion.div>
              ))}
            </AnimatePresence>

            {showGoal && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chat-goal">
                <div className="cg-top"><b>Reserva de emergência</b><span className="cg-amt">R$ 150/mês</span></div>
                <div className="track"><i style={{ width: "16%" }} /></div>
                <small>R$ 150 de R$ 900 · meta de 6 meses · separa automático no dia 5</small>
              </motion.div>
            )}

            {typing && <div className="typing"><i /><i /><i /></div>}

            {lastChips && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="chips" style={{ marginTop: 2 }}>
                {lastChips.map((c) => <button key={c} className="chip" onClick={() => send(c)}>{c}</button>)}
              </motion.div>
            )}
            <div ref={endRef} />
          </div>
          <div className="composer">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(draft)} placeholder="Pergunte algo ou toque numa opção…" />
            <button className="send" onClick={() => send(draft)} aria-label="enviar"><IconSend /></button>
          </div>
        </motion.div>

        <motion.div {...fade(2)} className="chat-side">
          {recommendations.map((r) => (
            <div className={`reco ${r.tone}`} key={r.id}>
              <div className="ic"><CatIcon name={r.icon} /></div>
              <h3>{r.title}</h3>
              <p>{r.text}</p>
              <div className="reco-foot"><span className="impact">{r.impact}</span><button className="btn btn-ghost btn-sm">{r.cta}</button></div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
