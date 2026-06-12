// Landing page do Pulso - marketing/entrada do SaaS.
// Stack do projeto: React + Motion + CSS nativo (classes .lp-*). Tema claro,
// 1 accent (verde mint da marca). CTAs de entrada: "Entrar no Pulso" (login)
// e "Acessar demo" (entra direto na conta demo, sem formulário).
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import {
  IconArrowDown,
  IconBolt,
  IconChart,
  IconCheck,
  IconPulse,
  IconShield,
  IconSparkChat,
  IconTarget,
} from "./components/icons";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LandingPage({ onEnter, onDemo }: { onEnter: () => void; onDemo: () => void }) {
  const reduce = useReducedMotion();

  // reveal ao entrar na viewport (motivado: hierarquia/storytelling de scroll)
  const reveal = (delay = 0) => ({
    initial: reduce ? false : { opacity: 0, y: 26 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { duration: 0.6, delay, ease: EASE },
  });

  const scrollTo = (id: string) => () =>
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

  return (
    <div className="lp">
      {/* ============ NAV ============ */}
      <header className="lp-nav">
        <div className="lp-brand">
          <span className="lp-brand-mark"><IconBolt /></span>
          <b>Pulso</b>
        </div>
        <nav className="lp-nav-links">
          <button onClick={scrollTo("recursos")}>Recursos</button>
          <button onClick={scrollTo("open-finance")}>Open Finance</button>
          <button onClick={scrollTo("como-funciona")}>Como funciona</button>
        </nav>
        <div className="lp-nav-ctas">
          <button className="lp-btn lp-btn-ghost lp-btn-sm" onClick={onDemo}>Acessar demo</button>
          <button className="lp-btn lp-btn-primary lp-btn-sm" onClick={onEnter}>Entrar no Pulso</button>
        </div>
      </header>

      {/* ============ HERO (dobra limpa, centralizada — estilo Mobbin) ============ */}
      <section className="lp-hero">
        <div className="lp-mesh" aria-hidden />
        <motion.div
          className="lp-hero-copy"
          initial={reduce ? false : "hide"}
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
        >
          <motion.div variants={fadeUp(reduce)}>
            <HeroIconCycle reduce={reduce} />
          </motion.div>
          <motion.h1 className="lp-h1" variants={fadeUp(reduce)}>
            Seu assessor financeiro pessoal, <em>no bolso</em>.
          </motion.h1>
          <motion.p className="lp-sub" variants={fadeUp(reduce)}>
            O Pulso lê suas transações reais via Open Finance, projeta como o mês vai fechar
            e responde suas perguntas em segundos.
          </motion.p>
          <motion.div className="lp-hero-ctas" variants={fadeUp(reduce)}>
            <button className="lp-btn lp-btn-primary" onClick={onEnter}>Entrar no Pulso</button>
            <button className="lp-btn lp-btn-ghost" onClick={onDemo}>Acessar demo</button>
            <button className="lp-btn lp-btn-ghost" onClick={scrollTo("como-funciona")}>
              Ver como funciona <IconArrowDown />
            </button>
          </motion.div>
        </motion.div>
      </section>

      {/* ============ MARQUEE PARCEIROS (logo sob o hero) ============ */}
      <section className="lp-trust">
        <span className="lp-trust-lead">Dados reais, conexão regulada</span>
        <div className="lp-marquee" aria-label="Parceiros e padrões">
          <div className="lp-marquee-track">
            {[...PARCEIROS, ...PARCEIROS].map((P, i) => (
              <span className="lp-logo" key={i} aria-hidden={i >= PARCEIROS.length}>
                <P.Logo />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BENTO RECURSOS ============ */}
      <section className="lp-section" id="recursos">
        <motion.div {...reveal()} className="lp-section-head">
          <h2 className="lp-h2">Tudo que importa sobre seu mês, num lugar só.</h2>
          <p className="lp-lead">Dado real do banco entra, e o Pulso transforma em decisão.</p>
        </motion.div>

        <div className="lp-bento">
          <motion.div {...reveal(0.05)} className="lp-cell lp-cell-lg lp-cell-ink">
            <div className="lp-cell-ic"><IconSparkChat /></div>
            <h3>Assistente que lê suas transações</h3>
            <p>Pergunte em português e receba a resposta com base no seu extrato real, não em achismo.</p>
            <div className="lp-chatline">
              <span className="lp-chat-q">Onde estou gastando mais?</span>
              <span className="lp-chat-a">Pix e delivery puxaram o mês. Dá pra cortar R$ 240.</span>
            </div>
          </motion.div>

          <motion.div {...reveal(0.1)} className="lp-cell lp-cell-mint">
            <div className="lp-cell-ic"><IconChart /></div>
            <h3>Projeção do mês</h3>
            <p>Simulação Monte Carlo mostra o melhor e o pior cenário antes do fim do mês.</p>
            <Sparkline />
          </motion.div>

          <motion.div {...reveal(0.15)} className="lp-cell">
            <div className="lp-cell-ic"><IconPulse /></div>
            <h3>Score de saúde</h3>
            <p>Um número que resume fluxo, cartão e reserva, atualizado a cada sincronização.</p>
          </motion.div>

          <motion.div {...reveal(0.2)} className="lp-cell">
            <div className="lp-cell-ic"><IconTarget /></div>
            <h3>Metas com probabilidade real</h3>
            <p>Veja a chance de bater cada objetivo no ritmo atual e o quanto falta por mês.</p>
          </motion.div>
        </div>
      </section>

      {/* ============ PARCERIA CUMBUCA / OPEN FINANCE ============ */}
      <section className="lp-of" id="open-finance">
        <motion.div {...reveal()} className="lp-of-copy">
          <h2 className="lp-h2">Conexão real com seu banco, via Open Finance.</h2>
          <p className="lp-lead">
            Em parceria com a Cumbuca, especialista em Open Finance no Brasil, o Pulso acessa
            seus dados com seu consentimento, direto pelo padrão regulado pelo Banco Central.
          </p>
          <ul className="lp-of-list">
            <OfItem text="Você autoriza no seu próprio banco, com biometria ou senha do app dele." />
            <OfItem text="O Pulso nunca vê nem guarda a senha do seu banco." />
            <OfItem text="Saldo, transações e cartão entram prontos, sem digitar nada." />
          </ul>
          <button className="lp-btn lp-btn-primary" onClick={onEnter}>Entrar no Pulso</button>
        </motion.div>
        <motion.div
          {...reveal(0.15)}
          className="lp-of-art"
        >
          <div className="lp-of-flow">
            <FlowNode icon={<IconShield />} title="Você consente" sub="no seu banco" />
            <span className="lp-of-line" aria-hidden />
            <FlowNode icon={<IconBolt />} title="Cumbuca conecta" sub="Open Finance" mint />
            <span className="lp-of-line" aria-hidden />
            <FlowNode icon={<IconPulse />} title="Pulso analisa" sub="com IA" />
          </div>
        </motion.div>
      </section>

      {/* ============ COMO FUNCIONA (3 passos) ============ */}
      <section className="lp-section" id="como-funciona">
        <motion.div {...reveal()} className="lp-section-head lp-center">
          <h2 className="lp-h2">Do banco ao insight em três toques.</h2>
        </motion.div>
        <div className="lp-steps">
          <Step n="01" title="Conecte" body="Autorize seu banco pelo Open Finance. Leva menos de dois minutos." {...reveal(0.05)} />
          <Step n="02" title="Sincronize" body="Suas transações e saldo reais entram no Pulso, já categorizados." {...reveal(0.1)} />
          <Step n="03" title="Pergunte" body="O assistente e a projeção respondem o que fazer com seu dinheiro." {...reveal(0.15)} />
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section className="lp-cta">
        <div className="lp-mesh lp-mesh-2" aria-hidden />
        <motion.div {...reveal()} className="lp-cta-inner">
          <h2 className="lp-h2 lp-h2-light">Pronto pra ver seu mês com clareza?</h2>
          <p className="lp-lead lp-lead-light">Conecte seu banco e deixe a IA cuidar das contas com você.</p>
          <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onEnter}>Entrar no Pulso</button>
        </motion.div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="lp-footer">
        <div className="lp-brand">
          <span className="lp-brand-mark"><IconBolt /></span>
          <b>Pulso</b>
        </div>
        <p className="lp-footer-note">
          Conexão via Open Finance, parceria Cumbuca. Seus dados são usados só pra te mostrar
          sua saúde financeira, conforme a LGPD.
        </p>
        <button className="lp-footer-cta" onClick={onEnter}>
          Entrar <IconArrowDown />
        </button>
      </footer>
    </div>
  );
}

// ---------- helpers ----------
const fadeUp = (reduce: boolean | null) => ({
  hide: reduce ? {} : { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
});

// ícone-app no topo do hero que cicla entre as marcas do ecossistema (estilo Mobbin)
const HERO_BRANDS: { name: string; color: string; glyph: JSX.Element }[] = [
  { name: "Pulso", color: "var(--mint)", glyph: <IconBolt /> },
  {
    name: "Cumbuca",
    color: "#d14b42",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M3 10h18a9 9 0 0 1-18 0Z" fill="currentColor" />
        <path d="M8 7c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Open Finance Brasil",
    color: "#2b59c3",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9.4" cy="12" r="6.2" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="14.6" cy="12" r="6.2" stroke="currentColor" strokeWidth="1.9" opacity="0.55" />
      </svg>
    ),
  },
  {
    name: "Banco Central",
    color: "#1b3a5b",
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3 21 8H3l9-5Z" fill="currentColor" />
        <rect x="5" y="9.5" width="2" height="7" fill="currentColor" />
        <rect x="11" y="9.5" width="2" height="7" fill="currentColor" />
        <rect x="17" y="9.5" width="2" height="7" fill="currentColor" />
        <rect x="3" y="18" width="18" height="2.2" rx="1" fill="currentColor" />
      </svg>
    ),
  },
];

function HeroIconCycle({ reduce }: { reduce: boolean | null }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((p) => (p + 1) % HERO_BRANDS.length), 3600);
    return () => clearInterval(t);
  }, [reduce]);
  const b = HERO_BRANDS[i];
  return (
    <div className="lp-hero-deck" aria-label={`Ecossistema: ${b.name}`}>
      {/* pilha/sombra atrás (deck estilo Mobbin) */}
      <span className="lp-deck-ghost g2" aria-hidden />
      <span className="lp-deck-ghost g1" aria-hidden />
      <AnimatePresence initial={false}>
        <motion.div
          key={b.name}
          className="lp-deck-card"
          style={{ color: b.color }}
          initial={reduce ? false : { y: -14, scale: 0.82, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={reduce ? {} : { y: 26, scale: 1.22, opacity: 0 }}
          transition={{ duration: 0.75, ease: EASE }}
        >
          {b.glyph}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// logos dos parceiros (marcas geométricas próprias + wordmark, monocromático)
function Lockup({ glyph, name }: { glyph: JSX.Element; name: string }) {
  return (
    <span className="lp-logo-lockup">
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" aria-hidden>{glyph}</svg>
      <b>{name}</b>
    </span>
  );
}

const PARCEIROS = [
  {
    name: "Pulso",
    Logo: () => (
      <Lockup name="Pulso" glyph={
        <>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor" />
          <path d="M6 12h3l2-4 2 8 2-4h3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      } />
    ),
  },
  {
    name: "Open Finance Brasil",
    Logo: () => (
      <Lockup name="Open Finance Brasil" glyph={
        <>
          <circle cx="9" cy="12" r="6.2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15" cy="12" r="6.2" stroke="currentColor" strokeWidth="1.8" opacity="0.5" />
        </>
      } />
    ),
  },
  {
    name: "Cumbuca",
    Logo: () => (
      <Lockup name="Cumbuca" glyph={
        <>
          <path d="M3 10h18a9 9 0 0 1-18 0Z" fill="currentColor" />
          <path d="M8 7c0-1.5 1.5-2.5 4-2.5s4 1 4 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      } />
    ),
  },
  {
    name: "Banco Central",
    Logo: () => (
      <Lockup name="Banco Central" glyph={
        <>
          <path d="M12 3 21 8H3l9-5Z" fill="currentColor" />
          <rect x="5" y="9.5" width="2" height="7" fill="currentColor" />
          <rect x="11" y="9.5" width="2" height="7" fill="currentColor" />
          <rect x="17" y="9.5" width="2" height="7" fill="currentColor" />
          <rect x="3" y="18" width="18" height="2.2" rx="1" fill="currentColor" />
        </>
      } />
    ),
  },
];

function Sparkline() {
  // pequeno gráfico de projeção (banda + linha), ilustrativo do recurso real
  return (
    <svg className="lp-spark" viewBox="0 0 240 80" preserveAspectRatio="none" aria-hidden>
      <path d="M0,52 C40,46 70,30 110,34 C150,38 190,18 240,24 L240,80 L0,80 Z" fill="var(--mint)" opacity="0.12" />
      <path d="M0,52 C40,46 70,30 110,34 C150,38 190,18 240,24" fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function OfItem({ text }: { text: string }) {
  return (
    <li className="lp-of-item">
      <span className="lp-of-check"><IconCheck /></span>
      {text}
    </li>
  );
}

function FlowNode({ icon, title, sub, mint }: { icon: JSX.Element; title: string; sub: string; mint?: boolean }) {
  return (
    <div className={`lp-flow-node ${mint ? "mint" : ""}`}>
      <span className="lp-flow-ic">{icon}</span>
      <b>{title}</b>
      <span>{sub}</span>
    </div>
  );
}

function Step({ n, title, body, ...motionProps }: { n: string; title: string; body: string } & Record<string, unknown>) {
  return (
    <motion.div className="lp-step" {...motionProps}>
      <span className="lp-step-n">{n}</span>
      <h3>{title}</h3>
      <p>{body}</p>
    </motion.div>
  );
}
