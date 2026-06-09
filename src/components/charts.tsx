import { motion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

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

/* ====== projeção Monte Carlo + linha de plano (what-if) ====== */
export function ProjectionChart({
  median,
  upper,
  lower,
  todayIndex,
  plan,
}: {
  median: number[];
  upper: number[];
  lower: number[];
  todayIndex: number;
  plan?: number[]; // linha alternativa do cenário "com plano"
}) {
  const W = 640, H = 240, padX = 10, padTop = 18, padBot = 26;
  const n = median.length;
  const all = [...upper, ...lower, ...(plan ?? [])];
  const maxV = Math.max(...all);
  const minV = Math.min(...all);
  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
  const y = (v: number) => padTop + (1 - (v - minV) / (maxV - minV)) * (H - padTop - padBot);
  const toPath = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const band =
    upper.map((v, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ") + " " +
    [...lower].reverse().map((v, i) => `L ${x(n - 1 - i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ") + " Z";
  const zeroY = y(0);
  const tx = x(todayIndex);

  return (
    <svg className="proj-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mint)" stopOpacity="0.18" />
          <stop offset="55%" stopColor="var(--amber)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--coral)" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="medGrad" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--mint)" />
          <stop offset="55%" stopColor="var(--amber)" />
          <stop offset="100%" stopColor="var(--coral)" />
        </linearGradient>
      </defs>

      <motion.path d={band} fill="url(#bandGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }} />

      <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
      <text x={W - padX} y={zeroY - 5} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-mute)">R$ 0</text>

      {/* cenário base */}
      <motion.path
        d={toPath(median)} fill="none" stroke="url(#medGrad)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, ease: EASE, delay: 0.2 }}
      />

      {/* cenário com plano (verde, tracejado) */}
      {plan && (
        <motion.path
          key="plan"
          d={toPath(plan)} fill="none" stroke="var(--mint)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="6 5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
        />
      )}

      {/* marcador hoje */}
      <line x1={tx} y1={padTop - 4} x2={tx} y2={H - padBot} stroke="var(--text-mute)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
      <text x={tx} y={H - 8} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--text-dim)">hoje</text>
      <circle cx={tx} cy={y(median[todayIndex])} r="4.5" fill="var(--blue)" stroke="var(--bg-2)" strokeWidth="2" />

      {/* fechamento base */}
      <circle cx={x(n - 1)} cy={y(median[n - 1])} r="5" fill="var(--coral)" stroke="var(--bg-2)" strokeWidth="2" />
      {/* fechamento com plano */}
      {plan && <circle cx={x(n - 1)} cy={y(plan[n - 1])} r="5" fill="var(--mint)" stroke="var(--bg-2)" strokeWidth="2" />}
    </svg>
  );
}
