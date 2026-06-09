import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { user } from "./data/mock";
import {
  IconBell,
  IconBolt,
  IconChart,
  IconGrid,
  IconPulse,
  IconSparkChat,
  IconTarget,
} from "./components/icons";
import {
  AssistantPage,
  GoalsPage,
  HealthPage,
  OverviewPage,
  ProjectionPage,
} from "./views";

type Tab = "overview" | "health" | "goals" | "projection" | "assistant";

const NAV: { id: Tab; label: string; Icon: () => JSX.Element; badge?: string }[] = [
  { id: "overview", label: "Visão geral", Icon: IconGrid },
  { id: "health", label: "Saúde", Icon: IconPulse },
  { id: "goals", label: "Metas", Icon: IconTarget, badge: "3" },
  { id: "projection", label: "Projeção", Icon: IconChart },
  { id: "assistant", label: "Assistente", Icon: IconSparkChat },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const go = (t: string) => setTab(t as Tab);

  return (
    <div className="app">
      {/* ============ TOPBAR + PILL NAV ============ */}
      <header className="topbar">
        <div className="brand">
          <div className="mark"><IconBolt /></div>
          <b>Pulso</b>
        </div>

        <nav className="nav-pill" aria-label="navegação principal">
          {NAV.map(({ id, label, Icon, badge }) => {
            const active = tab === id;
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
          <div className="avatar" title={`${user.fullName} · ${user.job}`}>{user.initials}</div>
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
    </div>
  );
}
