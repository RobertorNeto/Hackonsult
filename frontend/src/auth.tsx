// Login / Registro do Pulso - LIQUID GLASS largo (aprox. web de glassmorphism,
// nao o Apple oficial): prints da plataforma em diagonal no fundo; o painel de
// vidro por cima borra os prints que ficam atras (backdrop-filter). 2 colunas:
// colagem/headline a esquerda, formulario a direita.
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { api, setToken, type AuthUser } from "./lib/api";
import { ScoreRing } from "./components/charts";
import {
  IconArrowIn, IconChart, IconEye, IconEyeOff, IconFood, IconShield, IconSparkChat,
} from "./components/icons";

type Mode = "login" | "register";

// prints da plataforma (emulados) espalhados em diagonal no fundo
function Prints() {
  return (
    <div className="glx-prints" aria-hidden>
      <div className="glx-prints-rot">
        <div className="glx-print p1">
          <div className="gp-k">Saúde financeira</div>
          <div className="gp-ring">
            <div className="ring-wrap" style={{ width: 92, height: 92 }}>
              <ScoreRing value={72} size={92} thickness={8} color="var(--mint)" glow={false} />
              <div className="ring-center"><div className="big" style={{ fontSize: 26, color: "var(--mint)" }}>72</div></div>
            </div>
          </div>
        </div>

        <div className="glx-print p2 mint">
          <div className="gp-k"><IconArrowIn /> Nova entrada</div>
          <div className="gp-big">R$ 1.666</div>
          <div className="gp-up">+13% no mês</div>
        </div>

        <div className="glx-print p3">
          <div className="gp-k"><IconChart /> Projeção do mês</div>
          <svg className="gp-spark" viewBox="0 0 200 60" preserveAspectRatio="none">
            <path d="M0,44 C36,38 60,20 100,26 C140,32 168,12 200,18" fill="none" stroke="var(--mint)" strokeWidth="3" strokeLinecap="round" />
            <path d="M0,44 C36,38 60,20 100,26 C140,32 168,12 200,18 L200,60 L0,60Z" fill="var(--mint)" opacity="0.12" />
          </svg>
          <div className="gp-foot">fecha em <b>R$ 1.240</b></div>
        </div>

        <div className="glx-print p4">
          <div className="gp-k">Atividade</div>
          <div className="gp-row"><span className="gp-ic"><IconFood /></span> iFood <b className="out">-47,90</b></div>
          <div className="gp-row"><span className="gp-ic mint"><IconArrowIn /></span> Pix recebido <b className="in">+1.666</b></div>
        </div>

        <div className="glx-print p5">
          <div className="gp-k">Gasto por categoria</div>
          <div className="gp-bars"><i style={{ height: "70%" }} /><i style={{ height: "100%" }} /><i style={{ height: "45%" }} /><i style={{ height: "62%" }} /><i style={{ height: "30%" }} /></div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage({
  mode,
  onAuthed,
  onSwitch,
  onBack,
}: {
  mode: Mode;
  onAuthed: (user: AuthUser) => void;
  onSwitch: (m: Mode) => void;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = isLogin
        ? await api.login(email.trim(), password)
        : await api.register(name.trim(), email.trim(), password);
      setToken(res.token);
      onAuthed(res.user);
    } catch (e2: any) {
      const raw = String(e2?.message ?? e2);
      const m = raw.match(/\{.*"error"\s*:\s*"([^"]+)"/);
      setErr(m ? m[1] : isLogin ? "Não foi possível entrar." : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  const Tab = ({ m, label }: { m: Mode; label: string }) => {
    const active = mode === m;
    return (
      <button type="button" className={`glx-tab ${active ? "on" : ""}`} onClick={() => onSwitch(m)}>
        {label}
        {active && <motion.span layoutId="glx-tab-ind" className="glx-tab-ind"
          transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
      </button>
    );
  };

  return (
    <div className="glx">
      <Prints />

      <motion.div
        className="glx-card glass"
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <button className="glx-x" onClick={onBack} aria-label="voltar">×</button>

        <div className="glx-grid">
          {/* lado esquerdo: convite sobre o vidro (prints borram atrás) */}
          <div className="glx-aside">
            <h2 className="glx-aside-h">Seu mês,<br /><em>com clareza</em>.</h2>
            <p className="glx-aside-p">
              Conecte seu banco e a IA do Pulso lê suas transações, projeta o mês e te diz o que fazer.
            </p>
            <div className="glx-aside-chips">
              <span><IconChart /> Projeção Monte Carlo</span>
              <span><IconSparkChat /> Assistente com IA</span>
            </div>
          </div>

          {/* lado direito: formulário */}
          <div className="glx-right">
            <div className="glx-tabs">
              <Tab m="login" label="Entrar" />
              <Tab m="register" label="Criar conta" />
            </div>

            <form className="glx-form" onSubmit={submit}>
              {!isLogin && (
                <label className="glx-field">
                  <span>Nome</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como devo te chamar?" autoFocus />
                </label>
              )}
              <label className="glx-field">
                <span>E-mail</span>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com" autoComplete="email" autoFocus={isLogin}
                />
              </label>
              <label className="glx-field">
                <span>Senha</span>
                <div className="glx-pass">
                  <input
                    type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={isLogin ? "Sua senha" : "Mínimo 6 caracteres"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                  />
                  <button type="button" className="glx-eye" onClick={() => setShow((s) => !s)}
                    aria-label={show ? "ocultar senha" : "mostrar senha"}>
                    {show ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </label>

              {err && <div className="glx-err">{err}</div>}

              <button type="submit" className="glx-submit" disabled={busy}>
                {busy ? "Aguarde…" : isLogin ? "Entrar no Pulso" : "Criar minha conta"}
              </button>
            </form>

            <p className="glx-switch">
              {isLogin ? (
                <>Ainda não tem conta? <button onClick={() => onSwitch("register")}>Criar conta</button></>
              ) : (
                <>Já tem conta? <button onClick={() => onSwitch("login")}>Entrar</button></>
              )}
            </p>
          </div>
        </div>
      </motion.div>

      {/* footer: benefícios + conexão */}
      <motion.footer
        className="glx-footer"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="glx-conn">
          <span className="glx-conn-mark"><IconShield /> Pulso</span>
          <span className="glx-conn-x" aria-hidden />
          <span>conexão segura via <b>Cumbuca</b> · Open Finance regulado pelo Banco Central</span>
        </div>
      </motion.footer>
    </div>
  );
}
