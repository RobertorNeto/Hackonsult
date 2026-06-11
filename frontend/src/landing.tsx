// Landing page do Pulso - marketing/entrada do SaaS.
// Stack do projeto: React + Motion + CSS nativo (classes .lp-*). Tema claro,
// 1 accent (verde mint da marca). CTA único de entrada: "Entrar no Pulso".
import { motion, useReducedMotion } from "motion/react";
import { ScoreRing } from "./components/charts";
import {
  IconArrowDown,
  IconArrowIn,
  IconBolt,
  IconChart,
  IconCheck,
  IconFood,
  IconPulse,
  IconShield,
  IconSparkChat,
  IconTarget,
} from "./components/icons";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function LandingPage({ onEnter }: { onEnter: () => void }) {
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
        <button className="lp-btn lp-btn-primary lp-btn-sm" onClick={onEnter}>Entrar no Pulso</button>
      </header>

      {/* ============ HERO (centralizado, celular embaixo) ============ */}
      <section className="lp-hero">
        <div className="lp-mesh" aria-hidden />
        <motion.div
          className="lp-hero-copy"
          initial={reduce ? false : "hide"}
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
        >
          <motion.h1 className="lp-h1" variants={fadeUp(reduce)}>
            Seu dinheiro com um <span className="lp-h1-glyph"><IconSparkChat /></span> copiloto
            que <em>entende o mês inteiro</em>.
          </motion.h1>
          <motion.p className="lp-sub" variants={fadeUp(reduce)}>
            O Pulso lê suas transações reais via Open Finance, projeta como o mês vai fechar
            e responde suas perguntas em segundos.
          </motion.p>
          <motion.div className="lp-hero-ctas" variants={fadeUp(reduce)}>
            <button className="lp-btn lp-btn-primary" onClick={onEnter}>Entrar no Pulso</button>
            <button className="lp-btn lp-btn-ghost" onClick={scrollTo("como-funciona")}>
              Ver como funciona
            </button>
          </motion.div>
        </motion.div>

        {/* app aberto: mockup de celular com a UI real do Pulso + cards flutuantes */}
        <motion.div
          className="lp-hero-art"
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
        >
          <motion.div
            className="lp-phone"
            animate={reduce ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="lp-phone-notch" />
            <div className="lp-phone-screen">
              <div className="lp-app-top">
                <div className="lp-app-brand"><span className="lp-brand-mark sm"><IconBolt /></span>Pulso</div>
                <span className="lp-app-av">LM</span>
              </div>
              <div className="lp-app-greet">Bom te ver, Lucas</div>
              <div className="lp-app-ring">
                <div className="ring-wrap" style={{ width: 156, height: 156 }}>
                  <ScoreRing value={72} size={156} thickness={12} color="var(--mint)" />
                  <div className="ring-center">
                    <div className="big" style={{ fontSize: 44, color: "var(--mint)" }}>72</div>
                    <div className="lbl" style={{ color: "var(--text-mute)" }}>saúde</div>
                  </div>
                </div>
              </div>
              <div className="lp-app-flow">
                <div><span>Entrou</span><b className="in">R$ 3.731</b></div>
                <div><span>Saiu</span><b className="out">R$ 3.708</b></div>
              </div>
              <div className="lp-app-tx">
                <div className="lp-app-txrow">
                  <span className="lp-app-txic"><IconFood /></span>
                  <span className="lp-app-txname">iFood</span>
                  <span className="lp-app-txval">- R$ 47,90</span>
                </div>
                <div className="lp-app-txrow">
                  <span className="lp-app-txic mint"><IconArrowIn /></span>
                  <span className="lp-app-txname">Pix recebido</span>
                  <span className="lp-app-txval in">+ R$ 1.666</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* cards flutuantes (prova tangível, estilo app aberto) */}
          <motion.div
            className="lp-float lp-float-proj"
            animate={reduce ? undefined : { y: [0, -14, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          >
            <span className="lp-float-k"><IconChart /> Projeção do mês</span>
            <Sparkline />
            <b>Fecha em <span className="mint">R$ 1.240</span></b>
          </motion.div>

          <motion.div
            className="lp-float lp-float-chat"
            animate={reduce ? undefined : { y: [0, 12, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.9 }}
          >
            <span className="lp-float-ic"><IconSparkChat /></span>
            <span>“Vou fechar o mês no positivo?”</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ============ MARQUEE PARCEIROS (sob o hero) ============ */}
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
