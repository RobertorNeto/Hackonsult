// ============================================================
// PULSO · tipos, helpers de formatação e seed do chat de IA.
// Os DADOS (user, balance, metas, transações…) agora vêm do
// backend Flask via store. Aqui ficam só:
//  - tipos compartilhados
//  - helpers de cor/formatação
//  - o roteiro do assistente (parte de IA — local por enquanto)
// ============================================================

// ——— tipos ———
export type Vital = {
  key: string;
  label: string;
  value: number; // 0..100
  status: "bom" | "atencao" | "critico";
  hint: string;
  detail: string;
};

export type Health = {
  score: number;
  scoreLabel: string;
  zone: "bom" | "atencao" | "critico";
  deltaMonth: number;
  headline: string;
  subline: string;
  history: { m: string; v: number }[];
  vitals: Vital[];
};

export type Goal = {
  id: string;
  name: string;
  icon: string;
  target: number;
  saved: number;
  progress: number; // 0..1
  targetDate: string;
  monthsLeft: number;
  probability: number; // 0..1
  risk: "Baixo" | "Médio" | "Alto";
  monthlyNeeded: number;
  monthlyCurrent: number;
  actions: string[];
};

export type Lever = {
  id: string;
  label: string;
  icon: string;
  current: number;
  max: number;
};

export type Reco = {
  id: string;
  icon: string;
  title: string;
  text: string;
  impact: string;
  cta: string;
  tone: "mint" | "amber" | "blue";
};

export type Tx = {
  id: string;
  merchant: string;
  category: string;
  icon: string;
  amount: number;
  when: string;
  flagged?: boolean;
  createdAt?: string;
};

export type User = {
  name: string;
  fullName: string;
  initials: string;
  age: number;
  job: string;
  salary: number;
  bank: string;
  paydayDay: number;
  todayLabel: string;
  monthLabel: string;
};

export type Balance = {
  checking: number;
  creditUsed: number;
  creditLimit: number;
  creditDueDay: number;
  income: number;
  spent: number;
  estSpend: number;
  vsLastMonthPct: number;
};

export type Projection = {
  expected: number;
  optimistic: number;
  pessimistic: number;
  probabilityNegative: number;
  todayIndex: number;
  daysInMonth: number;
  driver: string;
  median: number[];
  upper: number[];
  lower: number[];
};

export type Recurring = {
  id: string;
  label: string;
  icon: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
};

export type Insight = {
  badge: string;
  icon: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
};

export type Bootstrap = {
  user: User;
  balance: Balance;
  health: Health;
  goals: Goal[];
  transactions: Tx[];
  levers: Lever[];
  projection: Projection;
  recurring: Recurring[];
  recommendations: Reco[];
  insight: Insight;
  spendByCategory: Record<string, number>;
};

// ——— helpers de formatação / cor ———
export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brl0 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const zoneColor = (z: string) =>
  z === "bom" ? "var(--mint)" : z === "atencao" ? "var(--amber)" : "var(--coral)";
export const scoreZone = (s: number) => (s >= 70 ? "bom" : s >= 45 ? "atencao" : "critico");
export const riskColor = (r: string) =>
  r === "Baixo" ? "var(--mint)" : r === "Médio" ? "var(--amber)" : "var(--coral)";

// cor por progresso (0..1) — limiar crescente: vermelho → âmbar → verde.
export const progressColor = (p: number) =>
  p >= 0.75 ? "var(--mint)" : p >= 0.5 ? "var(--lime)" : p >= 0.25 ? "var(--amber)" : "var(--coral)";

// ——— Chat: captura conversacional (parte de IA — roteiro local) ———
export type ChatMsg = {
  id: string;
  from: "app" | "user";
  text: string;
  chips?: string[];
  card?: "objetivo";
};
export const chatSeed: ChatMsg[] = [
  { id: "c1", from: "app", text: "Oi, Lucas. Junho está pressionado: seu score caiu 12 pontos. Vamos estruturar um objetivo?" },
  {
    id: "c2",
    from: "app",
    text: "O que você gostaria de fazer com o seu dinheiro nos próximos meses?",
    chips: ["Guardar pra emergência", "Quitar o cartão", "Juntar pro intercâmbio"],
  },
];
export const chatScript: Record<string, ChatMsg[]> = {
  "Guardar pra emergência": [
    { id: "r1", from: "app", text: "Boa escolha. Pelo seu fluxo, dá pra começar com R$ 150/mês sem apertar, saindo logo depois do salário, dia 5." },
    { id: "r2", from: "app", text: "Em 6 meses isso vira R$ 900, quase 1 mês de colchão. Topa que eu separe automático?", chips: ["Pode separar R$ 150", "Quero começar com menos"], card: "objetivo" },
  ],
  "Quitar o cartão": [
    { id: "r3", from: "app", text: "Sua fatura está em R$ 1.870. Cortando o delivery 2x/semana, sobram ~R$ 240/mês pra abater." },
    { id: "r4", from: "app", text: "Nesse ritmo o cartão zera em 8 meses, sem juros novos. Quero te lembrar toda sexta?", chips: ["Pode lembrar", "Depois eu vejo"] },
  ],
  "Juntar pro intercâmbio": [
    { id: "r5", from: "app", text: "Você já tem R$ 8.160 dos R$ 12.000, 68% do caminho. Faltam R$ 3.840 até dezembro." },
    { id: "r6", from: "app", text: "Guardando R$ 640/mês a probabilidade de chegar na data sobe pra 84%. Reduzir R$ 80 de transporte leva pra 91%. Aplico?", chips: ["Aplicar plano", "Ver no detalhe"] },
  ],
  __default: [
    { id: "rd", from: "app", text: "Anotado. Vou acompanhar isso e te aviso se algo sair do trilho." },
  ],
};
