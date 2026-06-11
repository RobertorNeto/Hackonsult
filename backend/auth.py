"""Autenticação do Pulso — contas + sessões por token.

Stdlib só (pbkdf2_hmac pra hash de senha, secrets pra token). Sem dependência
nova. Tabelas: accounts (credenciais) e sessions (token -> conta).

Nota de escopo: os dados financeiros do app são single-tenant por enquanto
(uma base de demonstração / a conexão bancária do dono). A auth controla o
ACESSO à plataforma; isolar dados por usuário é um passo seguinte.
"""
import hashlib
import hmac
import re
import secrets
import time

from db import get_auth_conn

_PBKDF_ITER = 200_000
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _ensure(conn):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          account_id INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS oauth_flows (
          state TEXT PRIMARY KEY,
          account_id INTEGER NOT NULL,
          code_verifier TEXT NOT NULL,
          client_id TEXT NOT NULL,
          client_secret TEXT,
          created_at TEXT NOT NULL
        );
        """
    )


def init():
    conn = get_auth_conn()
    try:
        _ensure(conn)
        conn.commit()
    finally:
        conn.close()


# ----------------------- hashing -----------------------
def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF_ITER)
    return f"pbkdf2_sha256${_PBKDF_ITER}${salt.hex()}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def _account_dict(row) -> dict:
    return {"id": row["id"], "name": row["name"], "email": row["email"]}


def _new_session(conn, account_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions VALUES (?,?,?)",
        (token, account_id, time.strftime("%Y-%m-%dT%H:%M:%S")),
    )
    return token


# ----------------------- API -----------------------
class AuthError(ValueError):
    """Erro de validação/credencial — vira 400/401 na rota."""


def register(name: str, email: str, password: str) -> dict:
    name = (name or "").strip()
    email = (email or "").strip().lower()
    if not name:
        raise AuthError("Informe seu nome.")
    if not _EMAIL_RE.match(email):
        raise AuthError("E-mail inválido.")
    if len(password or "") < 6:
        raise AuthError("A senha precisa de ao menos 6 caracteres.")
    conn = get_auth_conn()
    try:
        _ensure(conn)
        if conn.execute("SELECT 1 FROM accounts WHERE email=?", (email,)).fetchone():
            raise AuthError("Já existe uma conta com esse e-mail.")
        cur = conn.execute(
            "INSERT INTO accounts (name, email, password_hash, created_at) VALUES (?,?,?,?)",
            (name, email, _hash_password(password), time.strftime("%Y-%m-%dT%H:%M:%S")),
        )
        token = _new_session(conn, cur.lastrowid)
        conn.commit()
        row = conn.execute("SELECT * FROM accounts WHERE id=?", (cur.lastrowid,)).fetchone()
        _personalize(cur.lastrowid, name)
        return {"token": token, "user": _account_dict(row)}
    finally:
        conn.close()


def _personalize(account_id: int, name: str):
    """Cria o banco LIMPO da conta e grava o nome real (avatar/perfil)."""
    from db import get_conn_for
    parts = name.split()
    initials = (parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper() if parts else "VC"
    dc = get_conn_for(account_id)
    try:
        dc.execute(
            "UPDATE user SET name=?, full_name=?, initials=? WHERE id=1",
            (parts[0] if parts else name, name, initials),
        )
        dc.commit()
    finally:
        dc.close()


def update_account_name(account_id: int, name: str) -> None:
    """Atualiza o nome da conta (fonte única da identidade exibida no app)."""
    name = (name or "").strip()
    if not name:
        return
    conn = get_auth_conn()
    try:
        _ensure(conn)
        conn.execute("UPDATE accounts SET name=? WHERE id=?", (name, account_id))
        conn.commit()
    finally:
        conn.close()


def login(email: str, password: str) -> dict:
    email = (email or "").strip().lower()
    conn = get_auth_conn()
    try:
        _ensure(conn)
        row = conn.execute("SELECT * FROM accounts WHERE email=?", (email,)).fetchone()
        if not row or not _verify_password(password or "", row["password_hash"]):
            raise AuthError("E-mail ou senha incorretos.")
        token = _new_session(conn, row["id"])
        conn.commit()
        return {"token": token, "user": _account_dict(row)}
    finally:
        conn.close()


def change_password(email: str, new: str) -> dict:
    """Troca a senha só pelo e-mail + nova senha (sem confirmar a atual).
    Nota: sem prova de posse — qualquer um que saiba o e-mail pode trocar."""
    email = (email or "").strip().lower()
    if len(new or "") < 6:
        raise AuthError("A nova senha precisa de ao menos 6 caracteres.")
    conn = get_auth_conn()
    try:
        _ensure(conn)
        row = conn.execute("SELECT * FROM accounts WHERE email=?", (email,)).fetchone()
        if not row:
            raise AuthError("Não há conta com esse e-mail.")
        conn.execute(
            "UPDATE accounts SET password_hash=? WHERE id=?",
            (_hash_password(new), row["id"]),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def account_for_token(token: str | None) -> dict | None:
    if not token:
        return None
    conn = get_auth_conn()
    try:
        _ensure(conn)
        s = conn.execute("SELECT account_id FROM sessions WHERE token=?", (token,)).fetchone()
        if not s:
            return None
        row = conn.execute("SELECT * FROM accounts WHERE id=?", (s["account_id"],)).fetchone()
        return _account_dict(row) if row else None
    finally:
        conn.close()


def logout(token: str | None) -> None:
    if not token:
        return
    conn = get_auth_conn()
    try:
        _ensure(conn)
        conn.execute("DELETE FROM sessions WHERE token=?", (token,))
        conn.commit()
    finally:
        conn.close()
