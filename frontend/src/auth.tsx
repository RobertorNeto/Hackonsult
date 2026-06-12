// Login / Registro do Pulso - LIQUID GLASS largo (aprox. web de glassmorphism,
// nao o Apple oficial): prints da plataforma em diagonal no fundo; o painel de
// vidro por cima borra os prints que ficam atras (backdrop-filter). 2 colunas:
// colagem/headline a esquerda, formulario a direita.
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { api, loginAsDemo, setToken, type AuthUser } from "./lib/api";
import {
  IconBolt, IconEye, IconEyeOff, IconShield,
} from "./components/icons";

type Mode = "login" | "register";

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

  const [reset, setReset] = useState(false); // modo "trocar senha"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPass, setNewPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function toggleReset(on: boolean) {
    setReset(on); setErr(null); setDone(null); setPassword(""); setNewPass("");
  }

  async function loginDemo() {
    setBusy(true);
    setErr(null);
    try {
      onAuthed(await loginAsDemo());
    } catch {
      setErr("Não foi possível acessar a demo.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      if (reset) {
        await api.changePassword(email.trim(), newPass);
        setDone("Senha alterada! Entre com a nova senha.");
        setReset(false); setPassword(""); setNewPass("");
        return;
      }
      const res = isLogin
        ? await api.login(email.trim(), password)
        : await api.register(name.trim(), email.trim(), password);
      setToken(res.token);
      onAuthed(res.user);
    } catch (e2: any) {
      const raw = String(e2?.message ?? e2);
      const m = raw.match(/\{.*"error"\s*:\s*"([^"]+)"/);
      setErr(m ? m[1] : reset ? "Não foi possível trocar a senha." : isLogin ? "Não foi possível entrar." : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glx">

      <motion.div
        className="glx-card glass"
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <button className="glx-x" onClick={onBack} aria-label="voltar">×</button>

        <div className="glx-panel">
          <div className="glx-logo" aria-hidden><IconBolt /></div>
          <h1 className="glx-h">{reset ? "Trocar senha" : isLogin ? "Bem-vindo ao Pulso" : "Crie sua conta"}</h1>
          <p className="glx-tag">{reset ? "Confirme com a senha atual e defina a nova." : "Seu copiloto financeiro inteligente."}</p>

          <form className="glx-form" onSubmit={submit}>
            {!isLogin && !reset && (
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
            {!reset && (
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
            )}
            {reset && (
              <label className="glx-field">
                <span>Nova senha</span>
                <div className="glx-pass">
                  <input
                    type={show ? "text" : "password"} value={newPass} onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                  />
                  <button type="button" className="glx-eye" onClick={() => setShow((s) => !s)}
                    aria-label={show ? "ocultar senha" : "mostrar senha"}>
                    {show ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </label>
            )}

            {err && <div className="glx-err">{err}</div>}
            {done && <div className="glx-ok">{done}</div>}

            <button type="submit" className="glx-submit" disabled={busy}>
              {busy ? "Aguarde…" : reset ? "Trocar senha" : isLogin ? "Entrar no Pulso" : "Criar minha conta"}
            </button>
          </form>

          <p className="glx-switch">
            {reset ? (
              <>Lembrou a senha? <button onClick={() => toggleReset(false)}>Voltar ao login</button></>
            ) : isLogin ? (
              <>Ainda não tem conta? <button onClick={() => onSwitch("register")}>Criar conta</button></>
            ) : (
              <>Já tem conta? <button onClick={() => onSwitch("login")}>Entrar</button></>
            )}
          </p>
          {isLogin && !reset && (
            <button type="button" className="glx-reset-link" onClick={loginDemo} disabled={busy}>
              Acessar demo
            </button>
          )}
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
