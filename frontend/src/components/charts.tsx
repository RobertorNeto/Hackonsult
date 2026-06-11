import { motion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

const brl0 = (n: number) => "R$ " + Math.round(n).toLocaleString("pt-BR");

/* ====== donut de gasto por área ======
   Fatia por categoria, total no centro, legenda embaixo. */
export function CategoryDonut({
  data,
  size = 184,
  thickness = 26,
  centerValue,
  centerLabel = "total gasto",
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  if (total <= 0) {
    return <div className="donut-empty">Sem gastos registrados no mês.</div>;
  }

  return (
    <div className="donut">
      <div className="donut-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--panel-3)" strokeWidth={thickness} />
          <motion.g
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ transformOrigin: `${cx}px ${cx}px` }}
          >
            {data.map((d) => {
              const len = (d.value / total) * circ;
              const off = acc;
              acc += len;
              return (
                <circle
                  key={d.label}
                  cx={cx} cy={cx} r={r} fill="none"
                  stroke={d.color} strokeWidth={thickness}
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-off}
                  transform={`rotate(-90 ${cx} ${cx})`}
                />
              );
            })}
          </motion.g>
        </svg>
        <div className="donut-center">
          <div className="donut-total">{centerValue ?? brl0(total)}</div>
          <div className="donut-cap">{centerLabel}</div>
        </div>
      </div>
      <div className="donut-legend">
        {data.map((d) => (
          <div className="donut-leg" key={d.label}>
            <span className="dot" style={{ background: d.color }} />
            <span className="dl-label">{d.label}</span>
            <span className="dl-val">{brl0(d.value)}</span>
            <span className="dl-pct">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====== Anel de score (estilo WHOOP) ======
   Arco de 270° com trilho tracejado + progresso com glow. */
export function ScoreRing({
  value,
  size = 220,
  thickness = 14,
  color = "var(--mint)",
  track = "var(--panel-3)",
  delay = 0.15,
  glow = false,
}: {
  value: number; // 0..100
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
  delay?: number;
  glow?: boolean;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const arc = 270; // graus visíveis
  const circ = 2 * Math.PI * r;
  const visible = (arc / 360) * circ;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const id = `g-${Math.round(r)}-${color.replace(/[^a-z]/gi, "")}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
        {glow && (
          <filter id={`f-${id}`}>
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      {/* gira pra abrir o gap embaixo (135°) */}
      <g transform={`rotate(135 ${cx} ${cx})`}>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${visible} ${circ}`}
        />
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          filter={glow ? `url(#f-${id})` : undefined}
          strokeDasharray={`${visible} ${circ}`}
          initial={{ strokeDashoffset: visible }}
          animate={{ strokeDashoffset: visible * (1 - pct) }}
          transition={{ duration: 1.4, ease: EASE, delay }}
        />
      </g>
    </svg>
  );
}

/* ====== mini medidor (vital) — círculo completo ====== */
export function VitalGauge({ value, color }: { value: number; color: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg className="gauge" viewBox="0 0 46 46" width="46" height="46">
      <circle cx="23" cy="23" r={r} fill="none" stroke="var(--panel-3)" strokeWidth="5" />
      <motion.circle
        cx="23"
        cy="23"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-90 23 23)"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - pct) }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: EASE }}
      />
    </svg>
  );
}

/* ====== aro de probabilidade / proximidade pequeno ====== */
export function ProbRing({ pct, color = "var(--coral)", size = 44 }: { pct: number; color?: string; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--panel-3)" strokeWidth="4.5" />
      <motion.circle
        cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`} strokeDasharray={c}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 1.2, ease: EASE }}
      />
      <text x={cx} y={cx + 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={size * 0.26} fill="var(--text)" fontWeight="600">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

/* ====== histórico de score (área + linha) — score dinâmico ====== */
export function ScoreHistory({ data }: { data: { m: string; v: number }[] }) {
  const W = 520, H = 150, padX = 12, padTop = 16, padBot = 26;
  const n = data.length;
  const vals = data.map((d) => d.v);
  const maxV = Math.max(...vals) + 6;
  const minV = Math.min(...vals) - 10;
  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
  const y = (v: number) => padTop + (1 - (v - minV) / (maxV - minV)) * (H - padTop - padBot);
  const line = data.map((d, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(d.v).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(n - 1)} ${H - padBot} L ${x(0)} ${H - padBot} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 150 }}>
      <defs>
        <linearGradient id="histArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mint)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--mint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill="url(#histArea)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
      <motion.path
        d={line} fill="none" stroke="var(--mint)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: EASE }}
      />
      {data.map((d, i) => (
        <g key={d.m}>
          <motion.circle
            cx={x(i)} cy={y(d.v)} r={i === n - 1 ? 5 : 3.2}
            fill={i === n - 1 ? "var(--coral)" : "var(--mint)"} stroke="var(--bg-2)" strokeWidth="2"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 + i * 0.08, type: "spring", stiffness: 300 }}
          />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--text-mute)">{d.m}</text>
        </g>
      ))}
    </svg>
  );
}

/* ====== projeção de saldo no mês — saldo corrente dia a dia ======
   Limpo: linha de saldo realizada (sólida) até hoje + projeção (tracejada),
   linha do plano (verde) quando há cortes, faixa até o zero tingida por sinal. */
export function ProjectionChart({
  median,
  todayIndex,
  plan,
  monthLabel = "mês",
}: {
  median: number[];
  todayIndex: number;
  plan?: number[];
  monthLabel?: string;
}) {
  const W = 660, H = 230, padL = 44, padR = 16, padTop = 18, padBot = 28;
  const n = median.length;
  const vals = [...median, ...(plan ?? []), 0];
  const rawMax = Math.max(...vals);
  const rawMin = Math.min(...vals);
  const padV = (rawMax - rawMin) * 0.12 || 100;
  const maxV = rawMax + padV;
  const minV = rawMin - padV;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padTop + (1 - (v - minV) / (maxV - minV)) * (H - padTop - padBot);
  const seg = (arr: number[], a: number, b: number) =>
    arr.slice(a, b + 1).map((v, k) => `${k ? "L" : "M"} ${x(a + k).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const areaTo = (arr: number[]) =>
    `${seg(arr, 0, n - 1)} L ${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;

  const tx = x(todayIndex);
  const endV = median[n - 1];
  const endPos = endV >= 0;
  const planEnd = plan ? plan[n - 1] : null;
  const planPos = planEnd != null && planEnd >= 0;

  // ticks Y: min, 0, max aproximados
  const yticks = [maxV, 0, minV].map((v) => Math.round(v / 100) * 100);

  return (
    <svg className="proj-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grade Y */}
      {yticks.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line-soft)" strokeWidth="1" strokeDasharray={v === 0 ? "0" : "3 5"} />
          <text x={padL - 8} y={y(v) + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">
            {v === 0 ? "R$ 0" : (v / 1000).toFixed(1).replace(".", ",") + "k"}
          </text>
        </g>
      ))}

      {/* área sob o saldo base */}
      <motion.path d={areaTo(median)} fill="url(#areaFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.15 }} />

      {/* realizado (até hoje) — sólido */}
      <motion.path
        d={seg(median, 0, todayIndex)} fill="none" stroke="var(--text)" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE }}
      />
      {/* projeção (depois de hoje) — tracejado */}
      <motion.path
        d={seg(median, todayIndex, n - 1)} fill="none" stroke="var(--text-mute)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 5"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
      />

      {/* plano (verde) */}
      {plan && (
        <motion.path
          d={seg(plan, todayIndex, n - 1)} fill="none" stroke="var(--mint)" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        />
      )}

      {/* hoje */}
      <line x1={tx} y1={padTop} x2={tx} y2={H - padBot} stroke="var(--text-mute)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
      <text x={tx} y={H - 9} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--text-dim)">hoje</text>
      <circle cx={tx} cy={y(median[todayIndex])} r="4" fill="var(--ink)" stroke="#fff" strokeWidth="2" />

      {/* fechamento base */}
      <circle cx={x(n - 1)} cy={y(endV)} r="5" fill={endPos ? "var(--mint)" : "var(--coral)"} stroke="#fff" strokeWidth="2" />
      {/* fechamento com plano */}
      {plan && planEnd != null && (
        <circle cx={x(n - 1)} cy={y(planEnd)} r="5" fill={planPos ? "var(--mint)" : "var(--amber)"} stroke="#fff" strokeWidth="2" />
      )}

      <text x={(padL + W - padR) / 2} y={H - 9} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">
        dias de {monthLabel}
      </text>
    </svg>
  );
}

/* ====== simulação de meta — acúmulo vs alvo dado o aporte mensal ====== */
export function GoalSim({
  saved,
  target,
  monthly,
  monthsLeft,
}: {
  saved: number;
  target: number;
  monthly: number;
  monthsLeft: number;
}) {
  const W = 460, H = 150, padL = 40, padR = 14, padTop = 14, padBot = 24;
  const reach = monthly > 0 ? (target - saved) / monthly : Infinity;
  const N = Math.max(monthsLeft, Math.min(48, Math.ceil(isFinite(reach) ? reach : monthsLeft) + 1), 3);
  const acc = (m: number) => saved + monthly * m;
  const maxV = Math.max(target * 1.12, acc(N));
  const x = (m: number) => padL + (m / N) * (W - padL - padR);
  const y = (v: number) => padTop + (1 - v / maxV) * (H - padTop - padBot);
  const line = Array.from({ length: N + 1 }, (_, m) => `${m ? "L" : "M"} ${x(m).toFixed(1)} ${y(acc(m)).toFixed(1)}`).join(" ");
  const onTime = isFinite(reach) && reach <= monthsLeft;
  const lineColor = onTime ? "var(--mint)" : "var(--coral)";
  const reachX = isFinite(reach) && reach <= N ? x(reach) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: 150 }}>
      <defs>
        <linearGradient id="goalSimFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.16" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* alvo */}
      <line x1={padL} y1={y(target)} x2={W - padR} y2={y(target)} stroke="var(--text-mute)" strokeWidth="1" strokeDasharray="4 4" />
      <text x={padL - 6} y={y(target) + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">alvo</text>

      {/* prazo (monthsLeft) */}
      {monthsLeft <= N && (
        <line x1={x(monthsLeft)} y1={padTop} x2={x(monthsLeft)} y2={H - padBot} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 3" />
      )}

      <motion.path
        d={`${line} L ${x(N).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`}
        fill="url(#goalSimFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
      />
      <motion.path
        key={`${monthly}-${target}-${saved}`}
        d={line} fill="none" stroke={lineColor} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE }}
      />

      {/* ponto onde cruza o alvo */}
      {reachX != null && (
        <circle cx={reachX} cy={y(target)} r="4.5" fill={lineColor} stroke="#fff" strokeWidth="2" />
      )}

      <text x={padL} y={H - 8} textAnchor="start" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">hoje</text>
      <text x={W - padR} y={H - 8} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">{N} meses</text>
    </svg>
  );
}

/* ====== resumo de metas — % concluído do total ao longo dos meses ====== */
export function GoalsProgressChart({
  goals,
  horizon = 12,
}: {
  goals: { saved: number; target: number; monthlyCurrent: number }[];
  horizon?: number;
}) {
  const W = 620, H = 170, padL = 42, padR = 16, padTop = 16, padBot = 26;
  const totalTarget = goals.reduce((a, g) => a + g.target, 0) || 1;
  const N = Math.max(3, horizon);
  const savedAt = (m: number) =>
    goals.reduce((a, g) => a + Math.min(g.target, g.saved + g.monthlyCurrent * m), 0);
  const pctAt = (m: number) => (savedAt(m) / totalTarget) * 100;
  const x = (m: number) => padL + (m / N) * (W - padL - padR);
  const y = (p: number) => padTop + (1 - p / 100) * (H - padTop - padBot);
  const line = Array.from({ length: N + 1 }, (_, m) => `${m ? "L" : "M"} ${x(m).toFixed(1)} ${y(pctAt(m)).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: 170 }}>
      <defs>
        <linearGradient id="goalsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mint)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--mint)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[100, 50, 0].map((p) => (
        <g key={p}>
          <line x1={padL} y1={y(p)} x2={W - padR} y2={y(p)} stroke="var(--line-soft)" strokeWidth="1" strokeDasharray={p === 100 ? "4 4" : "3 5"} />
          <text x={padL - 6} y={y(p) + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">{p}%</text>
        </g>
      ))}

      <motion.path
        d={`${line} L ${x(N).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`}
        fill="url(#goalsFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
      />
      <motion.path
        d={line} fill="none" stroke="var(--mint)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: EASE }}
      />
      <circle cx={x(0)} cy={y(pctAt(0))} r="4" fill="var(--ink)" stroke="#fff" strokeWidth="2" />

      <text x={padL} y={H - 8} textAnchor="start" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">hoje</text>
      <text x={W - padR} y={H - 8} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">{N} meses</text>
    </svg>
  );
}
