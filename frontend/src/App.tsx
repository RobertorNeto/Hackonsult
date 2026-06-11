import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useData } from "./store";
import { api, clearToken, getToken, type AuthUser } from "./lib/api";
import {
  IconBell,
  IconBolt,
  IconChart,
  IconGrid,
  IconLogout,
  IconPulse,
  IconSparkChat,
  IconTarget,
} from "./components/icons";
import { EditProfileModal } from "./components/modals";
import LandingPage from "./landing";
import AuthPage from "./auth";
import {
  AssistantPage,
  GoalsPage,
  HealthPage,
  OverviewPage,
  ProjectionPage,
} from "./views";

type Tab = "overview" | "health" | "goals" | "projection" | "assistant";

const NAV: { id: Tab; label: string; Icon: () => JSX.Element }[] = [
  { id: "overview", label: "Visão geral", Icon: IconGrid },
  { id: "health", label: "Saúde", Icon: IconPulse },
  { id: "goals", label: "Metas", Icon: IconTarget },
  { id: "projection", label: "Projeção", Icon: IconChart },
  { id: "assistant", label: "Assistente", Icon: IconSparkChat },
];

export default function App() {
  const { data, loading, error, reload } = useData();
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [view, setView] = useState<"landing" | "login" | "register" | "app">("landing");
  const [account, setAccount] = useState<AuthUser | null>(null);
  const go = (t: string) => setTab(t as Tab);

  // sessão existente? valida o token no mount (não entra sozinho na plataforma)
  useEffect(() => {
    if (!getToken()) return;
    api.me().then((r) => setAccount(r.user)).catch(() => clearToken());
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
  function logout() {
    api.logout().catch(() => {});
    clearToken();
    setAccount(null);
    reload();              // limpa os dados (sem token o store zera)
    setView("landing");
  }

  if (view === "landing") {
    return <LandingPage onEnter={onLandingEnter} />;
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

  if (loading) {
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
            {tab === "overview" && <OverviewPage go={go} />}
            {tab === "health" && <HealthPage />}
            {tab === "goals" && <GoalsPage />}
            {tab === "projection" && <ProjectionPage />}
            {tab === "assistant" && <AssistantPage />}
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

      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
