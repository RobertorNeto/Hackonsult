// ============================================================
// PULSO · camada de dados MOCKADA
// Espelha o que o backend deveria devolver. Cada bloco isolado
// pra trocar por chamadas reais depois sem mexer na UI.
// Persona: Lucas Mendes, 26, analista jr, R$ 3.400/mês, CLT 2 anos.
// ============================================================

export const user = {
  name: "Lucas",
  fullName: "Lucas Mendes",
  initials: "LM",
  age: 26,
  job: "Analista Jr",
  salary: 3400,
  bank: "Banco",
  paydayDay: 5,
  todayLabel: "segunda, 9 de junho",
  monthLabel: "Junho",
};

export const balance = {
  checking: 1284.37,
  creditUsed: 1870.0,
  creditLimit: 4200.0,
  creditDueDay: 15,
  income: 3550.0, // entradas no mês
  spent: 2265.0, // saídas no mês
  vsLastMonthPct: -38,
};

// ——— Score de saúde financeira (vitais, estilo Whoop) ———
export type Vital = {
  key: string;
  label: string;
  value: number; // 0..100
  status: "bom" | "atencao" | "critico";
  hint: string;
  detail: string;
};

export const health = {
  score: 58,
  scoreLabel: "Atenção",
  zone: "atencao" as const,
  deltaMonth: -12,
  headline: "Sua saúde financeira caiu 12 pontos este mês.",
  subline: "O cartão subiu e o objetivo ficou pra trás. Dá pra reverter.",
  // histórico mensal do score (score dinâmico — acompanhar evolução)
  history: [
    { m: "Jan", v: 71 },
    { m: "Fev", v: 68 },
    { m: "Mar", v: 73 },
    { m: "Abr", v: 70 },
    { m: "Mai", v: 70 },
    { m: "Jun", v: 58 },
  ],
  vitals: [
    { key: "fluxo", label: "Fluxo de caixa", value: 44, status: "atencao", hint: "Gastando mais rápido que recebe", detail: "Ritmo de saída vs. entrada no mês" },
    { key: "cartao", label: "Uso do cartão", value: 31, status: "critico", hint: "Fatura em 45% do limite", detail: "Quanto do limite está comprometido" },
    { key: "recorrentes", label: "Assinaturas", value: 61, status: "atencao", hint: "R$ 218/mês em recorrências", detail: "Peso dos gastos fixos no orçamento" },
    { key: "reserva", label: "Reserva", value: 22, status: "critico", hint: "0,4 meses de colchão", detail: "Meses que você aguenta sem renda" },
    { key: "objetivo", label: "Objetivos", value: 38, status: "atencao", hint: "Intercâmbio 68% · Reserva 17%", detail: "Progresso médio das metas" },
  ] as Vital[],
};

// ——— Metas + Score de Proximidade da Meta ———
export type Goal = {
  id: string;
  name: string;
  icon: string; // chave do mapa de ícones (views)
  target: number;
  saved: number;
  progress: number; // 0..1
  targetDate: string;
  monthsLeft: number;
  probability: number; // 0..1 — chance de atingir até a data
  risk: "Baixo" | "Médio" | "Alto";
  monthlyNeeded: number; // quanto precisa guardar/mês
  monthlyCurrent: number; // quanto guarda hoje
  actions: string[];
};

export const goals: Goal[] = [
  {
    id: "g-intercambio",
    name: "Intercâmbio",
    icon: "plane",
    target: 12000,
    saved: 8160,
    progress: 0.68,
    targetDate: "Dez 2026",
    monthsLeft: 6,
    probability: 0.84,
    risk: "Médio",
    monthlyNeeded: 640,
    monthlyCurrent: 480,
    actions: [
      "Reduzir gastos com transporte em R$ 80",
      "Aplicar saldo parado automaticamente",
    ],
  },
  {
    id: "g-reserva",
    name: "Reserva de emergência",
    icon: "shield",
    target: 5400,
    saved: 900,
    progress: 0.17,
    targetDate: "Mar 2027",
    monthsLeft: 9,
    probability: 0.61,
    risk: "Alto",
    monthlyNeeded: 500,
    monthlyCurrent: 150,
    actions: [
      "Separar R$ 150 automático no dia 5 (salário)",
      "Direcionar 50% do 13º pra reserva",
    ],
  },
  {
    id: "g-cartao",
    name: "Quitar o cartão",
    icon: "card",
    target: 1870,
    saved: 0,
    progress: 0.0,
    targetDate: "Fev 2027",
    monthsLeft: 8,
    probability: 0.73,
    risk: "Médio",
    monthlyNeeded: 240,
    monthlyCurrent: 90,
    actions: [
      "Cortar 2 deliveries/semana libera ~R$ 240/mês",
      "Pausar 1 assinatura não usada (−R$ 34)",
    ],
  },
];

// ——— Projeção do mês (Monte Carlo) + alavancas what-if ———
export const projection = {
  expected: -180,
  optimistic: 320,
  pessimistic: -640,
  probabilityNegative: 0.72,
  todayIndex: 9,
  daysInMonth: 30,
  driver: "O que mais pesa: cartão + delivery na 1ª quinzena.",
  median: [
    1690, 1610, 1540, 1505, 1430, 3360, 3180, 2960, 1284, 1150, 1010, 880, 720,
    560, -120, -180, -260, -300, -340, -360, -390, -410, -440, -460, -480, -500,
    -520, -540, -560, -180,
  ],
  upper: [
    1740, 1700, 1660, 1640, 1600, 3520, 3400, 3220, 1620, 1540, 1470, 1390,
    1300, 1220, 980, 940, 900, 880, 860, 850, 840, 840, 850, 860, 880, 900, 930,
    960, 1000, 320,
  ],
  lower: [
    1640, 1520, 1420, 1370, 1260, 3200, 2960, 2700, 940, 760, 560, 360, 140,
    -80, -1020, -1100, -1180, -1240, -1300, -1350, -1400, -1450, -1500, -1550,
    -1600, -1650, -1700, -1750, -1800, -640,
  ],
};

// alavancas que o usuário arrasta pra ver o impacto ANTES de decidir
export type Lever = {
  id: string;
  label: string;
  icon: string;
  current: number; // gasto atual no mês (R$)
  max: number; // quanto dá pra cortar no máximo
};
export const levers: Lever[] = [
  { id: "delivery", label: "Delivery", icon: "food", current: 340, max: 240 },
  { id: "transporte", label: "Transporte por app", icon: "car", current: 180, max: 120 },
  { id: "assinaturas", label: "Assinaturas", icon: "film", current: 218, max: 90 },
];

// ——— Recomendações personalizadas por IA (plano de ação) ———
export type Reco = {
  id: string;
  icon: string;
  title: string;
  text: string;
  impact: string;
  cta: string;
  tone: "mint" | "amber" | "blue";
};
export const recommendations: Reco[] = [
  {
    id: "r-delivery",
    icon: "food",
    title: "Delivery está comendo seu mês",
    text: "Você gasta 22% da renda com delivery. Reduzir para 15% libera R$ 180 por mês.",
    impact: "+R$ 180 / mês",
    cta: "Aplicar no plano",
    tone: "amber",
  },
  {
    id: "r-salario",
    icon: "trend",
    title: "Aproveite os próximos aumentos",
    text: "Seu salário sobe ~8% ao ano. Investindo metade dos futuros aumentos, sua meta é antecipada em 14 meses.",
    impact: "−14 meses",
    cta: "Simular",
    tone: "mint",
  },
  {
    id: "r-transporte",
    icon: "car",
    title: "Transporte mexe na sua meta",
    text: "Cortar R$ 80/mês em transporte eleva a probabilidade do Intercâmbio de 84% para 91%.",
    impact: "+7% na meta",
    cta: "Aplicar",
    tone: "blue",
  },
];

// insight do dia (momento certo)
export const insight = {
  badge: "Insight de hoje",
  icon: "food",
  title: "Você gastou R$ 340 com delivery este mês.",
  body: "É 3x mais que em abril e já passou do que você gasta com mercado. Quer revisar?",
  primary: "Revisar gastos",
  secondary: "Agora não",
};

// ——— Transações ———
export type Tx = {
  id: string;
  merchant: string;
  category: string;
  icon: string;
  amount: number;
  when: string;
  flagged?: boolean;
};
export const transactions: Tx[] = [
  { id: "t1", merchant: "iFood", category: "Delivery", icon: "food", amount: -47.9, when: "Hoje, 12:40" },
  { id: "t2", merchant: "Netflix", category: "Assinatura", icon: "film", amount: -44.9, when: "Hoje, 03:00" },
  { id: "t3", merchant: "Uber", category: "Transporte", icon: "car", amount: -18.7, when: "Ontem, 22:15" },
  { id: "t4", merchant: "iFood", category: "Delivery", icon: "food", amount: -62.3, when: "Ontem, 20:50", flagged: true },
  { id: "t5", merchant: "Academia SmartFit", category: "Saúde", icon: "gym", amount: -109.9, when: "7 jun" },
  { id: "t6", merchant: "Pix recebido", category: "Entrada", icon: "arrow-in", amount: 150.0, when: "6 jun" },
  { id: "t7", merchant: "Salário", category: "Entrada", icon: "briefcase", amount: 3400.0, when: "5 jun" },
  { id: "t8", merchant: "Seguro Vida+", category: "Recorrente", icon: "shield", amount: -63.2, when: "5 jun", flagged: true },
];

// ——— Chat: captura conversacional + IA ———
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

// ——— helpers ———
export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brl0 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const zoneColor = (z: string) =>
  z === "bom" ? "var(--mint)" : z === "atencao" ? "var(--amber)" : "var(--coral)";
export const scoreZone = (s: number) => (s >= 70 ? "bom" : s >= 45 ? "atencao" : "critico");
export const riskColor = (r: string) =>
  r === "Baixo" ? "var(--mint)" : r === "Médio" ? "var(--amber)" : "var(--coral)";
