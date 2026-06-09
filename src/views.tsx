import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  balance,
  brl,
  brl0,
  chatScript,
  chatSeed,
  goals,
  health,
  insight,
  levers,
  projection,
  recommendations,
  riskColor,
  transactions,
  user,
  zoneColor,
  type ChatMsg,
} from "./data/mock";
import {
  ProbRing,
  ProjectionChart,
  ScoreHistory,
  ScoreRing,
} from "./components/charts";
import {
  IconArrowIn,
  IconBolt,
  IconBriefcase,
  IconCar,
  IconCard,
  IconCheck,
  IconChevron,
  IconFilm,
  IconFood,
  IconGym,
  IconPlane,
  IconPlus,
  IconSend,
  IconShield,
  IconTrendUp,
} from "./components/icons";

/* mapa de ícones de categoria — substitui emojis */
const ICONS: Record<string, () => JSX.Element> = {
  plane: IconPlane,
  shield: IconShield,
  card: IconCard,
  food: IconFood,
  car: IconCar,
  film: IconFilm,
  gym: IconGym,
  briefcase: IconBriefcase,
  trend: IconTrendUp,
  "arrow-in": IconArrowIn,
};
function CatIcon({ name }: { name: string }) {
  const I = ICONS[name] ?? IconCard;
  return <I />;
}

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
  const zone = zoneColor(health.zone);
  const creditPct = Math.round((balance.creditUsed / balance.creditLimit) * 100);
  const focusVitals = health.vitals.filter((v) => ["fluxo", "cartao", "reserva"].includes(v.key));

  return (
    <div className="ov">
      {/* SCORE HERO centrado */}
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
            <div className="ring-wrap" style={{ width: 96, height: 96 }}>
              <ScoreRing value={v.value} size={96} thickness={9} color={zoneColor(v.status)} glow={false} delay={0.3} />
              <div className="ring-center">
                <div className="big" style={{ fontSize: 27, color: zoneColor(v.status) }}>{v.value}</div>
              </div>
            </div>
            <b>{v.label}</b>
            <small>{v.hint}</small>
          </button>
        ))}
      </motion.section>

      {/* STATS — faixa hairline, sem cards */}
      <motion.section {...fade(2)} className="stat-line">
        <div className="stat">
          <span className="k">Saldo em conta</span>
          <span className="v">{brl(balance.checking)}</span>
          <span className="f">saídas 38% menores que maio</span>
        </div>
        <div className="stat">
          <span className="k">Entradas no mês</span>
          <span className="v" style={{ color: "var(--mint)" }}>{brl0(balance.income)}</span>
          <span className="f">salário dia {user.paydayDay} + pix</span>
        </div>
        <div className="stat">
          <span className="k">Saídas no mês</span>
          <span className="v" style={{ color: "var(--coral)" }}>{brl0(balance.spent)}</span>
          <span className="f">delivery puxando a frente</span>
        </div>
        <div className="stat">
          <span className="k">Fatura do cartão</span>
          <span className="v">{brl0(balance.creditUsed)}</span>
          <span className="f warn">{creditPct}% do limite · vence dia {balance.creditDueDay}</span>
        </div>
      </motion.section>

      {/* INSIGHT DO DIA */}
      <motion.section {...fade(3)} className="insight-banner">
        <span className="ib-ic"><CatIcon name={insight.icon} /></span>
        <div className="txt">
          <h3>{insight.title}</h3>
          <p>{insight.body}</p>
        </div>
        <div className="acts">
          <button className="btn btn-primary btn-sm" onClick={() => go("assistant")}>{insight.primary}</button>
          <button className="btn btn-ghost btn-sm">{insight.secondary}</button>
        </div>
      </motion.section>

      {/* ATIVIDADE + METAS (abaixo da dobra) */}
      <div className="grid cols-12">
        <motion.div {...fade(4)} className="panel span-7">
          <div className="panel-head"><h2>Atividade recente</h2><a className="link">ver tudo</a></div>
          {transactions.slice(0, 5).map((t) => (
            <div className="tx" key={t.id}>
              <div className="ic"><CatIcon name={t.icon} /></div>
              <div className="info">
                <b>{t.merchant}{t.flagged && <span className="flag-dot">revisar</span>}</b>
                <small>{t.category} · {t.when}</small>
              </div>
              <div className={`amt ${t.amount > 0 ? "in" : ""}`}>{t.amount > 0 ? "+" : "−"}{brl(Math.abs(t.amount))}</div>
            </div>
          ))}
        </motion.div>

        <motion.div {...fade(5)} className="panel span-5">
          <div className="panel-head"><h2>Suas metas</h2><a className="link" onClick={() => go("goals")}>gerenciar</a></div>
          {goals.map((g) => (
            <div key={g.id} className="goal-peek" onClick={() => go("goals")}>
              <ProbRing pct={g.progress} color="var(--mint)" size={46} />
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
    </div>
  );
}

/* ============================================================
   2. SAÚDE FINANCEIRA — gráficos + vitais interativos
   ============================================================ */
export function HealthPage() {
  const [open, setOpen] = useState<string | null>("cartao");

  return (
    <div className="page">
      <PageHead
        kicker="seu pulso financeiro"
        title="Saúde financeira"
        right={<StatusTag zone={health.zone} label={`zona de ${health.scoreLabel}`} />}
      />

      <div className="grid cols-12">
        {/* anel + stats */}
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

        {/* evolução do score */}
        <motion.div {...fade(2)} className="panel span-7">
          <div className="panel-head"><h2>Evolução do score</h2><span className="hint-cap">6 meses</span></div>
          <ScoreHistory data={health.history} />
          <p className="chart-note">
            Caiu de <b style={{ color: "var(--text)" }}>73</b> (mar) para <b style={{ color: "var(--coral)" }}>58</b> agora. O cartão puxou pra baixo.
          </p>
        </motion.div>
      </div>

      <div className="grid cols-12">
        {/* vitais — accordion interativo */}
        <motion.div {...fade(3)} className="panel span-7">
          <div className="panel-head"><h2>Vitais financeiros</h2><span className="hint-cap">toque pra abrir</span></div>
          {health.vitals.map((v) => {
            const isOpen = open === v.key;
            return (
              <div key={v.key} className={`vital ${isOpen ? "open" : ""}`} onClick={() => setOpen(isOpen ? null : v.key)}>
                <div className="v-row">
                  <div className="ring-wrap gauge">
                    <ScoreRing value={v.value} size={44} thickness={5} color={zoneColor(v.status)} glow={false} delay={0.2} />
                  </div>
                  <div className="v-meta">
                    <b>{v.label}</b>
                    <span>{v.hint}</span>
                  </div>
                  <span className={`v-num status-${v.status}`}>{v.value}</span>
                  <span className="v-caret"><IconChevron /></span>
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="vital-detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.32, ease: EASE }}
                    >
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

        {/* como subir */}
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
   3. METAS — Score de Proximidade da Meta
   ============================================================ */
export function GoalsPage() {
  return (
    <div className="page">
      <PageHead
        kicker="onde você quer chegar"
        title="Metas"
        right={<button className="btn btn-primary"><span className="row" style={{ gap: 7 }}><IconPlus /> Nova meta</span></button>}
      />

      {goals.map((g, i) => (
        <motion.div {...fade(i + 1)} key={g.id} className="goal-card">
          <div className="goal-top">
            <div className="g-ic"><CatIcon name={g.icon} /></div>
            <div style={{ flex: 1 }}>
              <b>{g.name}</b>
              <small>{brl0(g.saved)} de {brl0(g.target)} · meta {g.targetDate} · faltam {g.monthsLeft} meses</small>
            </div>
            <span className="risk-badge" style={{ color: riskColor(g.risk), background: `color-mix(in srgb, ${riskColor(g.risk)} 15%, transparent)` }}>
              risco {g.risk.toLowerCase()}
            </span>
          </div>

          <div className="goal-body">
            <div className="ring-wrap" style={{ width: 130, height: 130 }}>
              <ScoreRing value={g.progress * 100} size={130} thickness={11} color="var(--mint)" glow={false} delay={0.2 + i * 0.1} />
              <div className="ring-center">
                <div className="big" style={{ fontSize: 34 }}>{Math.round(g.progress * 100)}<span className="unit">%</span></div>
                <div className="lbl" style={{ fontSize: 9, color: "var(--text-mute)" }}>progresso</div>
              </div>
            </div>

            <div className="goal-metrics">
              <div className="metric">
                <span className="k">Probabilidade de atingir até {g.targetDate}</span>
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

          <div className="goal-actions">
            <div className="ga-head">Ações sugeridas pela IA</div>
            {g.actions.map((a) => (
              <div className="action-item" key={a}>
                <span className="chk"><IconCheck /></span>{a}
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ============================================================
   4. PROJEÇÃO — Monte Carlo + what-if interativo
   ============================================================ */
export function ProjectionPage() {
  const [cuts, setCuts] = useState<Record<string, number>>(
    Object.fromEntries(levers.map((l) => [l.id, 0]))
  );
  const totalCut = Object.values(cuts).reduce((a, b) => a + b, 0);

  const plan = useMemo(() => {
    const { median, todayIndex, daysInMonth } = projection;
    const remaining = daysInMonth - 1 - todayIndex;
    return median.map((v, i) => {
      if (i <= todayIndex || remaining <= 0) return v;
      const ramp = (i - todayIndex) / remaining;
      return Math.round(v + totalCut * ramp);
    });
  }, [totalCut]);

  const newClose = plan[plan.length - 1];
  const baseClose = projection.expected;
  const newProbNeg = Math.max(0.04, projection.probabilityNegative - totalCut / 900);
  const isPos = newClose >= 0;

  return (
    <div className="page">
      <PageHead kicker="como o mês vai fechar" title={`Projeção de ${user.monthLabel}`} />

      <div className="grid cols-12">
        {/* gráfico */}
        <motion.div {...fade(1)} className="panel span-8">
          <div className="panel-head" style={{ marginBottom: 8 }}>
            <div>
              <span className="hint-cap">no ritmo atual · fechamento</span>
              <div className="proj-headline" style={{ marginTop: 8 }}>
                <div className={`big ${baseClose < 0 ? "neg" : "pos"}`}>{brl0(baseClose)}</div>
                {totalCut > 0 && (
                  <div className="row" style={{ gap: 8 }}>
                    <span className="muted">com plano →</span>
                    <span className="big" style={{ fontSize: 30, color: isPos ? "var(--mint)" : "var(--amber)" }}>{brl0(newClose)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <ProjectionChart
            median={projection.median}
            upper={projection.upper}
            lower={projection.lower}
            todayIndex={projection.todayIndex}
            plan={totalCut > 0 ? plan : undefined}
          />
          <div className="scenario-row">
            <div className="scenario" style={{ borderColor: "color-mix(in srgb, var(--mint) 28%, transparent)" }}><small>Otimista</small><div className="v" style={{ color: "var(--mint)" }}>{brl0(projection.optimistic)}</div></div>
            <div className="scenario" style={{ borderColor: "color-mix(in srgb, var(--amber) 30%, transparent)" }}><small>Provável</small><div className="v" style={{ color: "var(--amber)" }}>{brl0(projection.expected)}</div></div>
            <div className="scenario" style={{ borderColor: "color-mix(in srgb, var(--coral) 30%, transparent)" }}><small>Pessimista</small><div className="v" style={{ color: "var(--coral)" }}>{brl0(projection.pessimistic)}</div></div>
          </div>
          <div className="foot-note">simulação Monte Carlo · 2.000 cenários · linha tracejada = seu plano</div>
        </motion.div>

        {/* what-if */}
        <motion.div {...fade(2)} className="panel span-4">
          <div className="panel-head"><h2>E se eu cortar…</h2><span className="hint-cap">arraste</span></div>
          <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Veja o impacto de cada decisão <b style={{ color: "var(--text)" }}>antes</b> de tomá-la.</p>
          {levers.map((l) => (
            <div className="lever" key={l.id}>
              <div className="lv-top">
                <span className="e"><CatIcon name={l.icon} /></span>
                <b>{l.label}</b>
                <span className="cut">−{brl0(cuts[l.id])}</span>
              </div>
              <input
                type="range" min={0} max={l.max} step={10} value={cuts[l.id]}
                onChange={(e) => setCuts((c) => ({ ...c, [l.id]: Number(e.target.value) }))}
              />
              <div className="lv-scale"><span>R$ 0</span><span>gasto: {brl0(l.current)}/mês</span></div>
            </div>
          ))}
          <div className="whatif-result">
            <div>
              <div className="lbl">Novo fechamento</div>
              <div className="num" style={{ color: isPos ? "var(--mint)" : totalCut > 0 ? "var(--amber)" : "var(--coral)" }}>{brl0(newClose)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="lbl">Chance de vermelho</div>
              <div className="num" style={{ fontSize: 22 }}>{Math.round(newProbNeg * 100)}%</div>
            </div>
          </div>
          {totalCut > 0 && (
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }}>Transformar em plano</button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* ============================================================
   5. ASSISTENTE IA — captura conversacional + recomendações
   ============================================================ */
export function AssistantPage() {
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
                <motion.div
                  key={m.id} layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className={`bubble ${m.from}`}
                >
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
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(draft)}
              placeholder="Pergunte algo ou toque numa opção…"
            />
            <button className="send" onClick={() => send(draft)} aria-label="enviar"><IconSend /></button>
          </div>
        </motion.div>

        {/* recomendações personalizadas */}
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
