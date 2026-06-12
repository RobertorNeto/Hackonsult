import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useData } from "./store";
import { api, clearToken, getToken, loginAsDemo, type AuthUser } from "./lib/api";
import {
  IconBell,
  IconBolt,
  IconChart,
  IconGrid,
  IconLogout,
  IconPulse,
  IconTarget,
} from "./components/icons";
import { EditProfileModal } from "./components/modals";
import LandingPage from "./landing";
import AuthPage from "./auth";
import {
  AssistantSheet,
  GoalsPage,
  HealthPage,
  OverviewPage,
  ProjectionPage,
} from "./views";

type Tab = "overview" | "health" | "goals" | "projection";

const NAV: { id: Tab; label: string; Icon: () => JSX.Element }[] = [
  { id: "overview", label: "Visão geral", Icon: IconGrid },
  { id: "health", label: "Saúde", Icon: IconPulse },
  { id: "goals", label: "Metas", Icon: IconTarget },
  { id: "projection", label: "Projeção", Icon: IconChart },
];

/* mesmo "spark" do antigo FAB — agora vira o botão de IA no topbar */
const SparkMark = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 1.8c.9 5.3 3.9 8.3 9.2 9.2-5.3.9-8.3 3.9-9.2 9.2-.9-5.3-3.9-8.3-9.2-9.2 5.3-.9 8.3-3.9 9.2-9.2Z" fill="currentColor" />
  </svg>
);

export default function App() {
  const { data, loading, error, reload } = useData();
  // aba persistida: F5 mantém você na mesma aba (não volta pro começo)
  const [tab, setTab] = useState<Tab>(() => {
    const t = localStorage.getItem("pulso_tab");
    return t === "health" || t === "goals" || t === "projection" ? (t as Tab) : "overview";
  });
  const [editOpen, setEditOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // com token salvo, já abre direto na plataforma (F5 não joga pra landing)
  const [view, setView] = useState<"landing" | "login" | "register" | "app">(
    () => (getToken() ? "app" : "landing"),
  );
  const [account, setAccount] = useState<AuthUser | null>(null);
  // enquanto valida o token salvo, segura a tela de boot (sem piscar landing/erro)
  const [booting, setBooting] = useState<boolean>(() => !!getToken());
  // "assistant" não é mais uma aba: abre o bottom-sheet. Resto troca de aba.
  const go = (t: string) => (t === "assistant" ? setAssistantOpen(true) : setTab(t as Tab));

  useEffect(() => { localStorage.setItem("pulso_tab", tab); }, [tab]);

  // sessão existente? valida o token no mount e entra direto na plataforma
  useEffect(() => {
    if (!getToken()) return;
    api.me()
      .then((r) => setAccount(r.user))
      .catch(() => { clearToken(); setView("landing"); })
      .finally(() => setBooting(false));
  }, []);

  function enterApp(u: AuthUser) {
    setAccount(u);
    reload();              // busca o bootstrap agora que há token
    setView("app");
  }
  function onLandingEnter() {
    if (account) enterApp(account);   // já logado → direto pra plataforma
    else setView("login");
  }
  // entra (ou troca) direto pra conta demo, sem passar pelo formulário de login
  async function enterDemo() {
    if (getToken()) api.logout().catch(() => {});   // encerra a sessão atual, se houver
    try {
      enterApp(await loginAsDemo());
    } catch {
      clearToken();
      setAccount(null);
      setView("login");   // fallback: na tela de login dá pra tentar de novo
    }
  }
  function logout() {
    api.logout().catch(() => {});
    clearToken();
    setAccount(null);
    reload();              // limpa os dados (sem token o store zera)
    setView("landing");
  }

  if (view === "landing") {
    return <LandingPage onEnter={onLandingEnter} onDemo={enterDemo} />;
  }
  if (view === "login" || view === "register") {
    return (
      <AuthPage
        mode={view}
        onAuthed={enterApp}
        onSwitch={(m) => setView(m)}
        onBack={() => setView("landing")}
      />
    );
  }

  if (booting || loading) {
    return (
      <div className="boot">
        <div className="boot-mark"><IconBolt /></div>
        <span className="boot-msg">Carregando seu pulso financeiro…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="boot">
        <div className="boot-mark err"><IconBolt /></div>
        <span className="boot-msg">Não consegui falar com o servidor.</span>
        <span className="boot-sub">{error ?? "Sem dados."} Verifique se o backend está rodando em :5000.</span>
        <button className="btn btn-primary" onClick={reload}>Tentar de novo</button>
      </div>
    );
  }

  const { user, goals } = data;
  const goalBadge = goals.length ? String(goals.length) : undefined;

  return (
    <div className="app">
      {/* ============ TOPBAR + PILL NAV ============ */}
      <header className="topbar">
        <div className="brand">
          <div className="mark"><IconBolt /></div>
          <b>Pulso</b>
        </div>

        <nav className="nav-pill" aria-label="navegação principal">
          {NAV.map(({ id, label, Icon }) => {
            const active = tab === id;
            const badge = id === "goals" ? goalBadge : undefined;
            return (
              <button key={id} className={`np-item ${active ? "active" : ""}`} onClick={() => setTab(id)}>
                {active && (
                  <motion.span
                    layoutId="np-glow"
                    className="np-bg"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="np-ic"><Icon /></span>
                <span className="np-lb">{label}</span>
                {badge && <span className="badge-n">{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="actions">
          <button className="ai-btn" onClick={() => setAssistantOpen(true)} aria-label="Falar com a IA" title="Falar com a IA">
            <SparkMark />
          </button>
          <button className="icon-btn" aria-label="notificações"><IconBell /><span className="ping" /></button>
          <button className="avatar" title="Editar perfil" onClick={() => setEditOpen(true)}>{user.initials}</button>
          <button className="icon-btn" title="Sair" aria-label="sair" onClick={logout}><IconLogout /></button>
        </div>
      </header>

      {/* ============ CONTEÚDO ============ */}
      <main className="content">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "overview" && <OverviewPage go={go} onDemo={enterDemo} />}
            {tab === "health" && <HealthPage />}
            {tab === "goals" && <GoalsPage />}
            {tab === "projection" && <ProjectionPage />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ============ DOCK MOBILE ============ */}
      <nav className="dock" aria-label="navegação principal">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} className={`dk ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            <Icon />
            {label.split(" ")[0]}
          </button>
        ))}
      </nav>

      {/* FAB inferior: mesmo atalho do botão do topbar, abre o bottom-sheet */}
      {!assistantOpen && (
        <button className="fab-ai" onClick={() => setAssistantOpen(true)} aria-label="Falar com a IA" title="Falar com a IA">
          <SparkMark />
        </button>
      )}

      {/* Assistente é um bottom-sheet (sobe de baixo, folga no topo) */}
      <AnimatePresence>
        {assistantOpen && <AssistantSheet onClose={() => setAssistantOpen(false)} />}
      </AnimatePresence>

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
