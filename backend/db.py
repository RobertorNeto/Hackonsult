"""Camada de acesso ao SQLite. stdlib sqlite3, sem ORM.

Multi-tenant por ARQUIVO: cada conta tem seu próprio banco em data/acct_<id>.db
(toda a lógica single-tenant id=1 continua igual, só muda o arquivo). As contas,
sessões e fluxos OAuth ficam num banco central (pulso_auth.db).
"""
import json
import os
import sqlite3

_BASE = os.path.dirname(__file__)
# Em produção (Render/Fly) aponte PULSO_DATA_DIR pra um disco/volume persistente.
# Default = backend/data (igual ao dev). AUTH_DB fica ao lado dos dados.
DATA_DIR = os.environ.get("PULSO_DATA_DIR", os.path.join(_BASE, "data"))
AUTH_DB = os.environ.get("PULSO_AUTH_DB", os.path.join(_BASE, "pulso_auth.db"))


def _connect(path):
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # WAL: leitor não bloqueia escritor. Multi-tenant (1 arquivo/conta) + WAL
    # aguenta bem o pico de testes simultâneos da demo.
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def get_auth_conn():
    """Conexão com o banco central (accounts, sessions, oauth_flows)."""
    return _connect(AUTH_DB)


def account_db_path(account_id: int) -> str:
    return os.path.join(DATA_DIR, f"acct_{int(account_id)}.db")


def _ensure_account_db(path: str):
    """Cria o banco da conta na primeira vez, LIMPO (sem dados de demonstração).
    Só o esqueleto mínimo pra UI renderizar; o usuário conecta o banco pra popular."""
    os.makedirs(DATA_DIR, exist_ok=True)
    fresh = not os.path.exists(path)
    if fresh:
        conn = _connect(path)
        conn.executescript(SCHEMA)
        conn.commit()
        if not conn.execute("SELECT COUNT(*) c FROM user").fetchone()["c"]:
            _seed_blank(conn)
        conn.close()


def get_conn_for(account_id: int):
    """Conexão com o banco de uma conta específica (cria/semeia se novo)."""
    path = account_db_path(account_id)
    _ensure_account_db(path)
    return _connect(path)


def get_conn():
    """Conexão com o banco da conta autenticada na request atual (flask.g)."""
    from flask import g
    acct = getattr(g, "account", None)
    if not acct:
        raise RuntimeError("get_conn() sem conta autenticada no contexto")
    return get_conn_for(acct["id"])


SCHEMA = """
CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT, full_name TEXT, initials TEXT, age INTEGER, job TEXT,
  salary REAL, bank TEXT, payday_day INTEGER, today_label TEXT, month_label TEXT
);
CREATE TABLE IF NOT EXISTS balance (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  checking REAL, credit_used REAL, credit_limit REAL, credit_due_day INTEGER,
  income REAL, spent REAL, est_spend REAL, vs_last_month_pct REAL
);
CREATE TABLE IF NOT EXISTS health_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  score INTEGER, score_label TEXT, zone TEXT, delta_month INTEGER,
  headline TEXT, subline TEXT
);
CREATE TABLE IF NOT EXISTS vitals (
  key TEXT PRIMARY KEY, label TEXT, value INTEGER, status TEXT,
  hint TEXT, detail TEXT, ord INTEGER
);
CREATE TABLE IF NOT EXISTS score_history (
  ord INTEGER PRIMARY KEY, m TEXT, v INTEGER
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY, name TEXT, icon TEXT, target REAL, saved REAL,
  progress REAL, target_date TEXT, months_left INTEGER, probability REAL,
  risk TEXT, monthly_needed REAL, monthly_current REAL, actions_json TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY, merchant TEXT, category TEXT, icon TEXT,
  amount REAL, when_label TEXT, flagged INTEGER, created_at TEXT
);
CREATE TABLE IF NOT EXISTS levers (
  id TEXT PRIMARY KEY, label TEXT, icon TEXT, current REAL, max REAL, ord INTEGER
);
CREATE TABLE IF NOT EXISTS projection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  expected REAL, optimistic REAL, pessimistic REAL, prob_negative REAL,
  today_index INTEGER, days_in_month INTEGER, driver TEXT,
  median_json TEXT, upper_json TEXT, lower_json TEXT
);
CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY, icon TEXT, title TEXT, text TEXT, impact TEXT,
  cta TEXT, tone TEXT, ord INTEGER
);
CREATE TABLE IF NOT EXISTS insight (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  badge TEXT, icon TEXT, title TEXT, body TEXT, primary_cta TEXT, secondary_cta TEXT
);
CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'card',
  amount REAL NOT NULL,
  day_of_month INTEGER NOT NULL CHECK(day_of_month BETWEEN 1 AND 31),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT
);
"""


def init_db():
    """Bancos de conta são criados sob demanda em get_conn_for(); aqui só o dir."""
    os.makedirs(DATA_DIR, exist_ok=True)


_MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]


def _seed_blank(conn):
    """Esqueleto mínimo p/ conta nova: estrutura válida, ZERO dados de demo.
    Sem transações, metas, gastos fixos, vitais, histórico ou recomendações."""
    from datetime import date
    today = date.today()
    mes = _MESES[today.month - 1]
    conn.execute(
        "INSERT INTO user VALUES (1,?,?,?,?,?,?,?,?,?,?)",
        ("Você", "Você", "VC", 0, "", 0.0, "", 5,
         today.strftime("%d/%m"), mes),
    )
    conn.execute(
        "INSERT INTO balance VALUES (1,?,?,?,?,?,?,?,?)",
        (0.0, 0.0, 0.0, 10, 0.0, 0.0, 0.0, 0),
    )
    conn.execute(
        "INSERT INTO health_meta VALUES (1,?,?,?,?,?,?)",
        (0, "sem dados", "atencao", 0,
         "Conecte seu banco pra ver sua saúde financeira.",
         "Sincronize e a IA analisa seus dados reais."),
    )
    conn.execute(
        "INSERT INTO insight VALUES (1,?,?,?,?,?,?)",
        ("Comece aqui", "trend", "Conecte seu banco pra começar.",
         "Em parceria com a Cumbuca via Open Finance, seus dados entram prontos.",
         "Conectar banco", "Agora não"),
    )
    conn.commit()


def _seed(conn):
    from seed import SEED

    u = SEED["user"]
    conn.execute(
        "INSERT INTO user VALUES (1,?,?,?,?,?,?,?,?,?,?)",
        (u["name"], u["fullName"], u["initials"], u["age"], u["job"], u["salary"],
         u["bank"], u["paydayDay"], u["todayLabel"], u["monthLabel"]),
    )
    b = SEED["balance"]
    conn.execute(
        "INSERT INTO balance VALUES (1,?,?,?,?,?,?,?,?)",
        (b["checking"], b["creditUsed"], b["creditLimit"], b["creditDueDay"],
         b["income"], b["spent"], b["estSpend"], b["vsLastMonthPct"]),
    )
    h = SEED["health"]
    conn.execute(
        "INSERT INTO health_meta VALUES (1,?,?,?,?,?,?)",
        (h["score"], h["scoreLabel"], h["zone"], h["deltaMonth"], h["headline"], h["subline"]),
    )
    for i, v in enumerate(h["vitals"]):
        conn.execute(
            "INSERT INTO vitals VALUES (?,?,?,?,?,?,?)",
            (v["key"], v["label"], v["value"], v["status"], v["hint"], v["detail"], i),
        )
    for i, p in enumerate(h["history"]):
        conn.execute("INSERT INTO score_history VALUES (?,?,?)", (i, p["m"], p["v"]))

    for g in SEED["goals"]:
        conn.execute(
            "INSERT INTO goals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (g["id"], g["name"], g["icon"], g["target"], g["saved"], g["progress"],
             g["targetDate"], g["monthsLeft"], g["probability"], g["risk"],
             g["monthlyNeeded"], g["monthlyCurrent"], json.dumps(g["actions"]), ""),
        )
    for t in SEED["transactions"]:
        conn.execute(
            "INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)",
            (t["id"], t["merchant"], t["category"], t["icon"], t["amount"],
             t["when"], 1 if t.get("flagged") else 0, ""),
        )
    for i, l in enumerate(SEED["levers"]):
        conn.execute(
            "INSERT INTO levers VALUES (?,?,?,?,?,?)",
            (l["id"], l["label"], l["icon"], l["current"], l["max"], i),
        )
    p = SEED["projection"]
    conn.execute(
        "INSERT INTO projection VALUES (1,?,?,?,?,?,?,?,?,?,?)",
        (p["expected"], p["optimistic"], p["pessimistic"], p["probabilityNegative"],
         p["todayIndex"], p["daysInMonth"], p["driver"],
         json.dumps(p["median"]), json.dumps(p["upper"]), json.dumps(p["lower"])),
    )
    for i, r in enumerate(SEED["recommendations"]):
        conn.execute(
            "INSERT INTO recommendations VALUES (?,?,?,?,?,?,?,?)",
            (r["id"], r["icon"], r["title"], r["text"], r["impact"], r["cta"], r["tone"], i),
        )
    ins = SEED["insight"]
    conn.execute(
        "INSERT INTO insight VALUES (1,?,?,?,?,?,?)",
        (ins["badge"], ins["icon"], ins["title"], ins["body"], ins["primary"], ins["secondary"]),
    )
    # Sem gastos fixos semeados: o usuário adiciona os reais (ou viram dados reais
    # via análise). Nada de Aluguel/Netflix fictícios poluindo a projeção.
    conn.commit()
