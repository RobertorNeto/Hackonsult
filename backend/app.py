"""Pulso · API Flask + SQLite.
Serve todos os dados do app e aceita inserção de transações, metas e edição
do perfil. A parte de IA (chat) NÃO está aqui — fica local no front por enquanto.
Rodar: python app.py  (porta 5000)
"""
import calendar
import json
import math
import os
import random
import statistics
import time
from datetime import date, datetime, timedelta

from dotenv import load_dotenv
from flask import Flask, g, jsonify, redirect, request
from flask_cors import CORS

# .env fica na raiz do projeto (um nível acima de backend/)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import analysis
import assistant
import auth
import cumbuca
from db import get_conn, init_db

app = Flask(__name__)
CORS(app)


# ----------------------- auth gate -----------------------
# Rotas públicas (sem token). O resto de /api exige sessão válida.
_PUBLIC_PATHS = {
    "/api/health",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/change-password",
    "/api/auth/callback",     # callback do OAuth Cumbuca (redirect de browser, sem token)
}


def _bearer_token():
    h = request.headers.get("Authorization", "")
    if h.startswith("Bearer "):
        return h[7:].strip()
    return request.headers.get("X-Auth-Token") or None


@app.before_request
def _auth_gate():
    p = request.path
    if not p.startswith("/api/") or request.method == "OPTIONS":
        return None
    if p in _PUBLIC_PATHS:
        return None
    acct = auth.account_for_token(_bearer_token())
    if not acct:
        return jsonify(error="não autenticado"), 401
    g.account = acct
    return None


@app.post("/api/auth/register")
def auth_register():
    d = request.get_json(force=True) or {}
    try:
        return jsonify(auth.register(d.get("name"), d.get("email"), d.get("password"))), 201
    except auth.AuthError as e:
        return jsonify(error=str(e)), 400


@app.post("/api/auth/login")
def auth_login():
    d = request.get_json(force=True) or {}
    try:
        return jsonify(auth.login(d.get("email"), d.get("password")))
    except auth.AuthError as e:
        return jsonify(error=str(e)), 401


@app.post("/api/auth/change-password")
def auth_change_password():
    d = request.get_json(force=True) or {}
    try:
        return jsonify(auth.change_password(d.get("email"), d.get("new")))
    except auth.AuthError as e:
        return jsonify(error=str(e)), 400


@app.get("/api/auth/me")
def auth_me():
    return jsonify(user=g.account)


@app.post("/api/auth/logout")
def auth_logout():
    auth.logout(_bearer_token())
    return jsonify(ok=True)


# ----------------------- serialização -----------------------
_WEEKDAYS_PT = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
_MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
              "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]


def _today_label(d=None):
    """Rótulo do dia atual, ex.: 'segunda, 9 de junho'. Sempre o dia de hoje."""
    d = d or date.today()
    return f"{_WEEKDAYS_PT[d.weekday()]}, {d.day} de {_MONTHS_PT[d.month - 1]}"


def _month_label(d=None):
    d = d or date.today()
    return _MONTHS_PT[d.month - 1].capitalize()


def user_dict(r):
    # identidade vem da CONTA autenticada (fonte única); o dia/mês são sempre hoje.
    acct = getattr(g, "account", None)
    full = (acct.get("name") if acct else None) or r["full_name"] or r["name"] or "Você"
    parts = full.split()
    first = parts[0] if parts else full
    initials = ((parts[0][0] + (parts[1][0] if len(parts) > 1 else "")).upper()
                if parts else "VC")
    return {
        "name": first, "fullName": full, "initials": initials,
        "age": r["age"], "job": r["job"], "salary": r["salary"], "bank": r["bank"],
        "paydayDay": r["payday_day"], "todayLabel": _today_label(), "monthLabel": _month_label(),
    }


def balance_dict(r):
    return {
        "checking": r["checking"], "creditUsed": r["credit_used"], "creditLimit": r["credit_limit"],
        "creditDueDay": r["credit_due_day"], "income": r["income"], "spent": r["spent"],
        "estSpend": r["est_spend"], "vsLastMonthPct": r["vs_last_month_pct"],
    }


def goal_dict(r):
    return {
        "id": r["id"], "name": r["name"], "icon": r["icon"], "target": r["target"],
        "saved": r["saved"], "progress": r["progress"], "targetDate": r["target_date"],
        "monthsLeft": r["months_left"], "probability": r["probability"], "risk": r["risk"],
        "monthlyNeeded": r["monthly_needed"], "monthlyCurrent": r["monthly_current"],
        "actions": json.loads(r["actions_json"] or "[]"),
    }


def _when_label(iso: str) -> str:
    """Converte datetime ISO em label legível: 'Hoje, 14:32', 'Ontem, 09:00', '05/06, 18:45'."""
    try:
        dt = datetime.fromisoformat(iso)
        today = date.today()
        if dt.date() == today:
            return dt.strftime("Hoje, %H:%M")
        if dt.date() == today - timedelta(days=1):
            return dt.strftime("Ontem, %H:%M")
        return dt.strftime("%d/%m, %H:%M")
    except (ValueError, TypeError):
        return time.strftime("Hoje, %H:%M")


def tx_dict(r):
    return {
        "id": r["id"], "merchant": r["merchant"], "category": r["category"], "icon": r["icon"],
        "amount": r["amount"], "when": r["when_label"], "flagged": bool(r["flagged"]),
        "createdAt": r["created_at"] or "",
    }


def _compute_projection(conn):
    """Simulação Monte Carlo do saldo diário para o mês corrente.

    Caminho realizado (dia 0 → hoje): determinístico, ajustado para fechar
    exatamente no saldo atual (`checking`).

    Caminho futuro: N_SIMS simulações com:
      - Gasto diário recorrente: Log-Normal(µ_ln, σ_ln) calibrada na média e
        desvio padrão reais das transações do mês.
      - Eventos agendados: salário (payday) e fatura do cartão (credit_due).
      - Despesas de emergência: processo de Poisson com taxa λ_monthly = 0,5
        emergências/mês. A cada dia restante, probabilidade diária
        p = 1 − exp(−λ/days_in_month) de ocorrer uma emergência; o valor é
        amostrado de uma Exponencial com média = max(R$200, salary × 0,10).

    Agregação:
      - `expected`  = média aritmética dos valores finais (estimador não-viesado)
      - `optimistic`/`pessimistic` = p80/p20 dos valores finais
      - `probabilityNegative` = fração das simulações que fecham < 0
      - chart bands = p20/p50/p80 por dia
    """
    today = date.today()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    today_index = today.day - 1  # 0-based

    b = conn.execute("SELECT * FROM balance WHERE id=1").fetchone()
    u = conn.execute("SELECT * FROM user WHERE id=1").fetchone()
    rec_rows = conn.execute(
        "SELECT day_of_month, amount FROM recurring WHERE active=1"
    ).fetchall()
    # lista de (day_of_month, amount) para gastos fixos ativos
    rec_items: list[tuple[int, float]] = [(int(r["day_of_month"]), float(r["amount"])) for r in rec_rows]

    checking    = float(b["checking"])
    # Entradas/saídas do mês derivadas do histórico de transações (fonte única
    # de verdade — balance.income/spent são campos manuais do perfil).
    _mp = today.strftime("%Y-%m-") + "%"
    _fl = conn.execute(
        """SELECT
             COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) AS inflow,
             COALESCE(SUM(CASE WHEN amount < 0 THEN -amount END), 0) AS outflow
           FROM transactions WHERE created_at LIKE ?""",
        (_mp,),
    ).fetchone()
    spent       = float(_fl["outflow"])   # total gasto no mês (positivo)
    income      = float(_fl["inflow"])    # total recebido no mês (positivo)
    credit_used = float(b["credit_used"])
    credit_due  = int(b["credit_due_day"])
    salary      = float(u["salary"])

    # RNG DETERMINÍSTICO: a projeção é estável entre chamadas/telas e só muda
    # quando os dados mudam (saldo, fluxo, fatura, dia, nº de transações).
    # Sem isso, cada GET re-sorteava 1000 sims → expected dançava entre views.
    n_tx = conn.execute("SELECT COUNT(*) c FROM transactions").fetchone()["c"]
    seed_val = int(round(checking * 100) + round(income * 100) + round(spent * 100)
                   + round(credit_used * 100)) + today.toordinal() * 7 + n_tx
    rng = random.Random(seed_val)
    payday      = int(u["payday_day"])

    days_elapsed = today_index + 1
    # Excluir recorrentes já pagos no mês para não inflacionar mean_daily.
    # Ex.: aluguel de R$1.200 no dia 5 entraria no cálculo de gasto diário
    # e seria contado duas vezes: via mean_daily E via rec_items no futuro.
    paid_rec_so_far = sum(amt for dom, amt in rec_items if dom <= today.day)
    discretionary_spent = max(0.0, spent - paid_rec_so_far)
    mean_daily = (discretionary_spent / days_elapsed) if days_elapsed > 0 and discretionary_spent > 0 else 50.0

    # ── Variância real: std dev dos totais diários de gasto do mês ──────────
    month_prefix = today.strftime("%Y-%m-")
    daily_rows = conn.execute(
        """SELECT strftime('%d', created_at) AS day, SUM(-amount) AS spend
           FROM transactions
           WHERE amount < 0 AND created_at LIKE ?
           GROUP BY day""",
        (month_prefix + "%",),
    ).fetchall()
    daily_spends = [float(r["spend"]) for r in daily_rows if r["spend"] and r["spend"] > 0]

    if len(daily_spends) >= 2:
        std_daily = statistics.stdev(daily_spends)
    else:
        # fallback: sem dados suficientes, usa 45 % da média
        std_daily = mean_daily * 0.45

    # ── Parâmetros Log-Normal ────────────────────────────────────────────────
    # X ~ LogNormal(µ_ln, σ_ln)  →  E[X] = mean_daily,  Std[X] = std_daily
    # σ_ln² = ln(1 + (std/mean)²)      µ_ln = ln(mean) − σ_ln²/2
    if mean_daily > 0 and std_daily > 0:
        cv2     = (std_daily / mean_daily) ** 2
        sig_ln  = math.sqrt(math.log(1.0 + cv2))
        mu_ln   = math.log(mean_daily) - sig_ln ** 2 / 2.0
        sample_spend = lambda: rng.lognormvariate(mu_ln, sig_ln)
    else:
        sample_spend = lambda: 0.0

    # ── Caminho realizado (determinístico) ───────────────────────────────────
    start_balance = checking - income + spent
    raw: list[float] = []
    bal = start_balance
    for i in range(today_index + 1):
        dom = i + 1
        if dom == payday:
            bal += salary
        if dom == credit_due:
            bal -= max(0.0, credit_used)
        for rec_dom, rec_amt in rec_items:
            if dom == rec_dom:
                bal -= rec_amt
        if i > 0:
            bal -= mean_daily
        raw.append(bal)

    if len(raw) > 1:
        drift    = checking - raw[-1]
        realized = [round(raw[i] + drift * i / (len(raw) - 1)) for i in range(len(raw))]
    else:
        realized = [round(checking)]

    # ── Parâmetros de emergência ─────────────────────────────────────────────
    LAMBDA_MONTHLY   = 0.5                         # emergências esperadas/mês
    mean_emergency   = max(200.0, salary * 0.10)   # valor médio de cada emergência

    # ── Monte Carlo (dias futuros) ───────────────────────────────────────────
    N_SIMS    = 1_000
    remaining = days_in_month - today_index - 1

    # probabilidade diária de uma emergência (processo de Poisson)
    p_emerg_day = 1.0 - math.exp(-LAMBDA_MONTHLY / days_in_month) if remaining > 0 else 0.0

    future_paths: list[list[float]] = []

    for _ in range(N_SIMS):
        path: list[float] = []
        bal = checking
        for d in range(remaining):
            dom = today_index + 2 + d  # 1-based
            if dom == payday:
                bal += salary
            if dom == credit_due:
                bal -= max(0.0, credit_used)
            # gastos fixos recorrentes (determinísticos)
            for rec_dom, rec_amt in rec_items:
                if dom == rec_dom:
                    bal -= rec_amt
            bal -= sample_spend()
            # emergência: Bernoulli(p_emerg_day) → valor Exponencial(mean_emergency)
            if rng.random() < p_emerg_day:
                bal -= rng.expovariate(1.0 / mean_emergency)
            path.append(bal)
        future_paths.append(path)

    # Percentis por dia futuro
    median_future: list[int] = []
    upper_future:  list[int] = []
    lower_future:  list[int] = []
    for d in range(remaining):
        day_vals = sorted(p[d] for p in future_paths)
        median_future.append(round(day_vals[int(N_SIMS * 0.50)]))
        upper_future.append( round(day_vals[int(N_SIMS * 0.80)]))
        lower_future.append( round(day_vals[int(N_SIMS * 0.20)]))

    # Agregação do fechamento
    if future_paths:
        final_vals  = [p[-1] for p in future_paths]
        expected    = round(statistics.mean(final_vals))          # estimador não-viesado
        sorted_vals = sorted(final_vals)
        optimistic  = round(sorted_vals[int(N_SIMS * 0.80)])
        pessimistic = round(sorted_vals[int(N_SIMS * 0.20)])
        prob_neg    = sum(1 for v in final_vals if v < 0) / N_SIMS
    else:
        expected = optimistic = pessimistic = round(checking)
        prob_neg = 0.0

    # Texto do driver
    upcoming = []
    if payday > today.day:
        upcoming.append(f"salário dia {payday}")
    if credit_due > today.day and credit_used > 0:
        upcoming.append(f"fatura de R${credit_used:.0f} dia {credit_due}")
    base = ("Eventos futuros: " + " · ".join(upcoming) + ".") if upcoming \
        else f"Gasto médio de R${mean_daily:.0f}/dia · σ R${std_daily:.0f}."
    driver = f"{base} Emergências: ~{LAMBDA_MONTHLY:.0%}/mês, média R${mean_emergency:.0f}."

    return {
        "expected": expected,
        "optimistic": optimistic,
        "pessimistic": pessimistic,
        "probabilityNegative": round(prob_neg, 3),
        "todayIndex": today_index,
        "daysInMonth": days_in_month,
        "driver": driver,
        "median": realized + median_future,
        "upper":  realized + upper_future,
        "lower":  realized + lower_future,
    }


def _bootstrap(conn):
    hm = conn.execute("SELECT * FROM health_meta WHERE id=1").fetchone()
    vitals = [dict(label=v["label"], key=v["key"], value=v["value"], status=v["status"],
                   hint=v["hint"], detail=v["detail"])
              for v in conn.execute("SELECT * FROM vitals ORDER BY ord").fetchall()]
    history = [dict(m=h["m"], v=h["v"])
               for h in conn.execute("SELECT * FROM score_history ORDER BY ord").fetchall()]
    health = {
        "score": hm["score"], "scoreLabel": hm["score_label"], "zone": hm["zone"],
        "deltaMonth": hm["delta_month"], "headline": hm["headline"], "subline": hm["subline"],
        "history": history, "vitals": vitals,
    }
    projection = _compute_projection(conn)
    levers = [dict(id=l["id"], label=l["label"], icon=l["icon"], current=l["current"], max=l["max"])
              for l in conn.execute("SELECT * FROM levers ORDER BY ord").fetchall()]
    recos = [dict(id=r["id"], icon=r["icon"], title=r["title"], text=r["text"],
                  impact=r["impact"], cta=r["cta"], tone=r["tone"])
             for r in conn.execute("SELECT * FROM recommendations ORDER BY ord").fetchall()]
    ins = conn.execute("SELECT * FROM insight WHERE id=1").fetchone()
    insight = {
        "badge": ins["badge"], "icon": ins["icon"], "title": ins["title"], "body": ins["body"],
        "primary": ins["primary_cta"], "secondary": ins["secondary_cta"],
    }
    recurring = [recurring_dict(r) for r in conn.execute(
        "SELECT * FROM recurring ORDER BY day_of_month, created_at").fetchall()]
    return {
        "user": user_dict(conn.execute("SELECT * FROM user WHERE id=1").fetchone()),
        "balance": _balance_real(conn),
        "health": health,
        "goals": [goal_dict(g) for g in conn.execute("SELECT * FROM goals ORDER BY created_at, rowid").fetchall()],
        "transactions": [tx_dict(t) for t in conn.execute("SELECT * FROM transactions ORDER BY created_at DESC, rowid DESC").fetchall()],
        "levers": levers,
        "projection": projection,
        "recurring": recurring,
        "recommendations": recos,
        "insight": insight,
        "spendByCategory": _spend_by_category(conn),
        "cutPlan": _cut_plan(conn),
    }


# ----------------------- rotas -----------------------
@app.get("/api/projection")
def get_projection():
    conn = get_conn()
    try:
        return jsonify(_compute_projection(conn))
    finally:
        conn.close()


@app.get("/api/health")
def healthcheck():
    return jsonify(ok=True)


# ----------------------- Cumbuca MCP (OAuth connect, por conta) -----------------------
@app.get("/api/bank/connect-url")
def bank_connect_url():
    """Autenticado: gera a URL de consent vinculada à conta atual (via state central)."""
    return jsonify(url=cumbuca.build_authorization_url(g.account["id"]))


@app.get("/api/auth/callback")
def bank_callback():
    """Recebe o code da Cumbuca (público, sem token) e grava na conta dona do state."""
    err = request.args.get("error")
    if err:
        return redirect(f"{cumbuca.FRONTEND_URL}/?bank=error&msg={err}", code=302)
    code = request.args.get("code")
    state = request.args.get("state")
    if not code or not state:
        return redirect(f"{cumbuca.FRONTEND_URL}/?bank=error&msg=missing_code", code=302)
    try:
        cumbuca.exchange_code(code, state)
        return redirect(f"{cumbuca.FRONTEND_URL}/?bank=connected", code=302)
    except Exception as e:
        return redirect(f"{cumbuca.FRONTEND_URL}/?bank=error&msg={e}", code=302)


@app.get("/api/bank/status")
def bank_status():
    return jsonify(cumbuca.status())


@app.get("/api/bank/accounts")
def bank_accounts():
    """A PROVA: tenta chamar as tools do MCP com Bearer puro e devolve o trace."""
    return jsonify(cumbuca.probe_accounts())


@app.delete("/api/bank/disconnect")
def bank_disconnect():
    return jsonify(cumbuca.disconnect())


@app.post("/api/bank/sync")
def bank_sync():
    """Puxa saldo + transações reais do MCP e injeta no Pulso. Consome cota — só sob clique."""
    return jsonify(cumbuca.sync())


# ----------------------- Assistente (OpenAI + contexto Monte Carlo) -----------------------
def _month_flows(conn) -> tuple[float, float]:
    """(entrou, saiu) do mês corrente, derivados do histórico de transações.
    Fonte ÚNICA de verdade — usada por bootstrap, projeção, análise e chat."""
    mp = date.today().strftime("%Y-%m-") + "%"
    r = conn.execute(
        """SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) AS inflow,
                  COALESCE(SUM(CASE WHEN amount < 0 THEN -amount END), 0) AS outflow
           FROM transactions WHERE created_at LIKE ?""",
        (mp,),
    ).fetchone()
    return round(r["inflow"], 2), round(r["outflow"], 2)


def _balance_real(conn) -> dict:
    """balance com income/spent derivados do histórico (não os campos stale da tabela)."""
    b = balance_dict(conn.execute("SELECT * FROM balance WHERE id=1").fetchone())
    b["income"], b["spent"] = _month_flows(conn)
    return b


def _top_categories(conn, limit=6):
    """Gasto por categoria do mês: conta + cartão combinados."""
    mp = date.today().strftime("%Y-%m-") + "%"
    cumbuca._ensure_card_table(conn)
    rows = conn.execute(
        """SELECT category, SUM(spend) AS total FROM (
             SELECT category, -amount AS spend FROM transactions
               WHERE amount < 0 AND created_at LIKE ?
             UNION ALL
             SELECT category, amount AS spend FROM card_transactions
               WHERE amount > 0 AND created_at LIKE ?
           ) GROUP BY category ORDER BY total DESC LIMIT ?""",
        (mp, mp, limit),
    ).fetchall()
    return [{"category": r["category"], "total": round(r["total"], 2)} for r in rows]


def _spend_by_category(conn):
    """Gasto do mês por categoria, conta + cartão combinados (todas as categorias).
    Mesma fonte do donut e das barras de corte — bate 100% com o Cumbuca."""
    mp = date.today().strftime("%Y-%m-") + "%"
    cumbuca._ensure_card_table(conn)
    rows = conn.execute(
        """SELECT category, SUM(spend) AS total FROM (
             SELECT category, -amount AS spend FROM transactions
               WHERE amount < 0 AND created_at LIKE ?
             UNION ALL
             SELECT category, amount AS spend FROM card_transactions
               WHERE amount > 0 AND created_at LIKE ?
           ) GROUP BY category""",
        (mp, mp),
    ).fetchall()
    return {r["category"]: round(r["total"], 2) for r in rows}


def _ensure_cut_plan(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS cut_plan (
             label TEXT NOT NULL,
             icon  TEXT NOT NULL DEFAULT 'card',
             cut   REAL NOT NULL,
             ord   INTEGER NOT NULL
           )"""
    )


def _cut_plan(conn):
    _ensure_cut_plan(conn)
    rows = conn.execute("SELECT label, icon, cut FROM cut_plan ORDER BY ord").fetchall()
    return [{"label": r["label"], "icon": r["icon"], "cut": round(r["cut"], 2)} for r in rows]


def _card_txs(conn, limit=10):
    cumbuca._ensure_card_table(conn)
    rows = conn.execute(
        "SELECT * FROM card_transactions ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    return [{"when": t["when_label"], "merchant": t["merchant"],
             "category": t["category"], "amount": t["amount"]} for t in rows]


def _build_assistant_context(conn) -> dict:
    u = conn.execute("SELECT * FROM user WHERE id=1").fetchone()
    # transações recentes (compactas)
    tx_rows = conn.execute(
        "SELECT * FROM transactions ORDER BY created_at DESC, rowid DESC LIMIT 15"
    ).fetchall()
    transactions = [
        {"when": t["when_label"], "merchant": t["merchant"],
         "category": t["category"], "amount": t["amount"]}
        for t in tx_rows
    ]
    st = cumbuca.status()
    return {
        "user": user_dict(u),
        "balance": _balance_real(conn),
        "projection": _compute_projection(conn),  # Monte Carlo JÁ pronto
        "transactions": transactions,
        "cardTransactions": _card_txs(conn, 8),
        "topCategories": _top_categories(conn, 5),
        "connected": st.get("connected"),
        "syncedAt": st.get("syncedAt"),
    }


@app.post("/api/analyze")
def analyze():
    """IA (gpt-5.4-mini) analisa os dados reais e reescreve score/vitais/recomendações/insight."""
    conn = get_conn()
    try:
        rec = conn.execute("SELECT label, amount, day_of_month FROM recurring WHERE active=1").fetchall()
        goals = conn.execute("SELECT name, saved, target, months_left FROM goals").fetchall()
        tx_rows = conn.execute(
            "SELECT * FROM transactions ORDER BY created_at DESC, rowid DESC LIMIT 15"
        ).fetchall()
        ctx = {
            "balance": _balance_real(conn),
            "projection": _compute_projection(conn),
            "topCategories": _top_categories(conn, 6),
            "transactions": [{"when": t["when_label"], "merchant": t["merchant"],
                              "category": t["category"], "amount": t["amount"]} for t in tx_rows],
            "cardTransactions": _card_txs(conn, 10),
            "recurring": [{"label": r["label"], "amount": r["amount"], "day": r["day_of_month"]} for r in rec],
            "goals": [{"name": g["name"], "saved": g["saved"], "target": g["target"],
                       "monthsLeft": g["months_left"]} for g in goals],
        }
        result = analysis.run(ctx, conn)
        code = 200 if result.get("ok") else 502
        return jsonify(result), code
    finally:
        conn.close()


@app.post("/api/assistant")
def assistant_chat():
    d = request.get_json(force=True) or {}
    message = (d.get("message") or "").strip()
    if not message:
        return jsonify(error="message vazio"), 400
    history = d.get("history") or []
    conn = get_conn()
    try:
        ctx = _build_assistant_context(conn)
    finally:
        conn.close()
    result = assistant.answer(message, history, ctx)
    code = 200 if "reply" in result else 502
    return jsonify(result), code


@app.get("/api/bootstrap")
def bootstrap():
    conn = get_conn()
    try:
        return jsonify(_bootstrap(conn))
    finally:
        conn.close()


def _apply_balance(conn, amount, factor):
    """factor +1 aplica a transação no balanço, -1 reverte."""
    a = amount * factor
    b = conn.execute("SELECT * FROM balance WHERE id=1").fetchone()
    checking = b["checking"] + a
    income = b["income"] + (a if amount > 0 else 0)
    spent = b["spent"] + (-a if amount < 0 else 0)
    conn.execute(
        "UPDATE balance SET checking=?, income=?, spent=? WHERE id=1",
        (checking, income, spent),
    )


@app.post("/api/transactions")
def add_transaction():
    d = request.get_json(force=True) or {}
    try:
        amount = float(d["amount"])
    except (KeyError, TypeError, ValueError):
        return jsonify(error="amount inválido"), 400
    merchant = (d.get("merchant") or "").strip()
    if not merchant:
        return jsonify(error="merchant obrigatório"), 400

    # aceita datetime ISO do frontend; fallback para agora
    raw_when = (d.get("when") or "").strip()
    if raw_when:
        try:
            datetime.fromisoformat(raw_when)  # valida
            created_at = raw_when if "T" in raw_when else raw_when + "T00:00:00"
        except ValueError:
            created_at = time.strftime("%Y-%m-%dT%H:%M:%S")
    else:
        created_at = time.strftime("%Y-%m-%dT%H:%M:%S")
    when_label = _when_label(created_at)

    tx_id = f"t{int(time.time() * 1000)}"
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)",
            (tx_id, merchant, d.get("category") or "Outros", d.get("icon") or "card",
             amount, when_label, 1 if d.get("flagged") else 0,
             created_at),
        )
        _apply_balance(conn, amount, +1)
        conn.commit()
        tx = tx_dict(conn.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone())
        bal = balance_dict(conn.execute("SELECT * FROM balance WHERE id=1").fetchone())
        return jsonify(transaction=tx, balance=bal), 201
    finally:
        conn.close()


@app.patch("/api/transactions/<tx_id>")
def edit_transaction(tx_id):
    d = request.get_json(force=True) or {}
    conn = get_conn()
    try:
        old = conn.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone()
        if not old:
            return jsonify(error="transação não encontrada"), 404
        merchant = (d.get("merchant") if d.get("merchant") is not None else old["merchant"]).strip() or old["merchant"]
        amount = float(d["amount"]) if d.get("amount") is not None else old["amount"]
        category = d.get("category") if d.get("category") is not None else old["category"]
        icon = d.get("icon") if d.get("icon") is not None else old["icon"]
        flagged = 1 if d.get("flagged") else old["flagged"]
        raw_when = (d.get("when") or "").strip()
        if raw_when:
            try:
                datetime.fromisoformat(raw_when)
                created_at = raw_when if "T" in raw_when else raw_when + "T00:00:00"
            except ValueError:
                created_at = old["created_at"] or time.strftime("%Y-%m-%dT%H:%M:%S")
        else:
            created_at = old["created_at"] or time.strftime("%Y-%m-%dT%H:%M:%S")
        when_label = _when_label(created_at)
        # reverte o efeito antigo, aplica o novo
        _apply_balance(conn, old["amount"], -1)
        conn.execute(

            "UPDATE transactions SET merchant=?, category=?, icon=?, amount=?, flagged=?, when_label=?, created_at=? WHERE id=?",
            (merchant, category, icon, amount, flagged, when_label, created_at, tx_id),
        )
        _apply_balance(conn, amount, +1)
        conn.commit()
        tx = tx_dict(conn.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone())
        bal = balance_dict(conn.execute("SELECT * FROM balance WHERE id=1").fetchone())
        return jsonify(transaction=tx, balance=bal)
    finally:
        conn.close()


@app.delete("/api/transactions/<tx_id>")
def delete_transaction(tx_id):
    conn = get_conn()
    try:
        old = conn.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone()
        if not old:
            return jsonify(error="transação não encontrada"), 404
        _apply_balance(conn, old["amount"], -1)
        conn.execute("DELETE FROM transactions WHERE id=?", (tx_id,))
        conn.commit()
        bal = balance_dict(conn.execute("SELECT * FROM balance WHERE id=1").fetchone())
        return jsonify(deleted=tx_id, balance=bal)
    finally:
        conn.close()


def _goal_prob(target, saved, monthly_current, months_left):
    falta = max(0.0, target - saved)
    if falta <= 0:
        return 0.97
    if monthly_current <= 0 or months_left <= 0:
        return 0.05
    meses_necessarios = falta / monthly_current
    ratio = months_left / meses_necessarios
    return round(max(0.05, min(0.97, ratio * 0.9)), 2)


def _goal_risk(prob):
    return "Baixo" if prob >= 0.8 else "Médio" if prob >= 0.55 else "Alto"


@app.post("/api/goals")
def add_goal():
    d = request.get_json(force=True) or {}
    name = (d.get("name") or "").strip()
    try:
        target = float(d["target"])
    except (KeyError, TypeError, ValueError):
        return jsonify(error="target inválido"), 400
    if not name or target <= 0:
        return jsonify(error="name e target obrigatórios"), 400

    saved = float(d.get("saved") or 0)
    months_left = int(d.get("monthsLeft") or 6)
    monthly_current = float(d.get("monthlyCurrent") or 0)
    progress = max(0.0, min(1.0, saved / target)) if target else 0.0
    monthly_needed = d.get("monthlyNeeded")
    if monthly_needed in (None, ""):
        monthly_needed = round((target - saved) / months_left, 2) if months_left else (target - saved)
    prob = _goal_prob(target, saved, monthly_current, months_left)
    goal_id = f"g-{int(time.time() * 1000)}"
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO goals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (goal_id, name, d.get("icon") or "target", target, saved, progress,
             d.get("targetDate") or "", months_left, prob,
             _goal_risk(prob), float(monthly_needed), monthly_current,
             json.dumps(d.get("actions") or []), time.strftime("%Y-%m-%dT%H:%M:%S")),
        )
        conn.commit()
        g = goal_dict(conn.execute("SELECT * FROM goals WHERE id=?", (goal_id,)).fetchone())
        return jsonify(goal=g), 201
    finally:
        conn.close()


@app.patch("/api/goals/<goal_id>")
def edit_goal(goal_id):
    d = request.get_json(force=True) or {}
    conn = get_conn()
    try:
        old = conn.execute("SELECT * FROM goals WHERE id=?", (goal_id,)).fetchone()
        if not old:
            return jsonify(error="meta não encontrada"), 404
        name = (d.get("name") if d.get("name") is not None else old["name"]).strip() or old["name"]
        target = float(d["target"]) if d.get("target") is not None else old["target"]
        saved = float(d["saved"]) if d.get("saved") is not None else old["saved"]
        months_left = int(d["monthsLeft"]) if d.get("monthsLeft") is not None else old["months_left"]
        monthly_current = float(d["monthlyCurrent"]) if d.get("monthlyCurrent") is not None else old["monthly_current"]
        icon = d.get("icon") if d.get("icon") is not None else old["icon"]
        target_date = d.get("targetDate") if d.get("targetDate") is not None else old["target_date"]
        actions = json.dumps(d["actions"]) if d.get("actions") is not None else old["actions_json"]
        progress = max(0.0, min(1.0, saved / target)) if target else 0.0
        monthly_needed = round((target - saved) / months_left, 2) if months_left else (target - saved)
        prob = _goal_prob(target, saved, monthly_current, months_left)
        conn.execute(
            """UPDATE goals SET name=?, icon=?, target=?, saved=?, progress=?, target_date=?,
               months_left=?, probability=?, risk=?, monthly_needed=?, monthly_current=?, actions_json=?
               WHERE id=?""",
            (name, icon, target, saved, progress, target_date, months_left, prob,
             _goal_risk(prob), monthly_needed, monthly_current, actions, goal_id),
        )
        conn.commit()
        g = goal_dict(conn.execute("SELECT * FROM goals WHERE id=?", (goal_id,)).fetchone())
        return jsonify(goal=g)
    finally:
        conn.close()


@app.delete("/api/goals/<goal_id>")
def delete_goal(goal_id):
    conn = get_conn()
    try:
        conn.execute("DELETE FROM goals WHERE id=?", (goal_id,))
        conn.commit()
        return jsonify(deleted=goal_id)
    finally:
        conn.close()


def recurring_dict(r):
    return {
        "id": r["id"], "label": r["label"], "icon": r["icon"],
        "amount": r["amount"], "dayOfMonth": r["day_of_month"], "active": bool(r["active"]),
    }


def lever_dict(r):
    return {"id": r["id"], "label": r["label"], "icon": r["icon"],
            "current": r["current"], "max": r["max"]}


@app.post("/api/levers")
def add_lever():
    d = request.get_json(force=True) or {}
    label = (d.get("label") or "").strip()
    try:
        current = float(d["current"])
    except (KeyError, TypeError, ValueError):
        return jsonify(error="gasto inválido"), 400
    if not label or current <= 0:
        return jsonify(error="label e gasto obrigatórios"), 400
    lid = f"l-{int(time.time() * 1000)}"
    conn = get_conn()
    try:
        ordv = (conn.execute("SELECT COALESCE(MAX(ord),-1)+1 o FROM levers").fetchone()["o"])
        conn.execute("INSERT INTO levers VALUES (?,?,?,?,?,?)",
                     (lid, label, d.get("icon") or "card", current, current, ordv))
        conn.commit()
        return jsonify(lever=lever_dict(conn.execute("SELECT * FROM levers WHERE id=?", (lid,)).fetchone())), 201
    finally:
        conn.close()


@app.patch("/api/levers/<lever_id>")
def edit_lever(lever_id):
    d = request.get_json(force=True) or {}
    conn = get_conn()
    try:
        old = conn.execute("SELECT * FROM levers WHERE id=?", (lever_id,)).fetchone()
        if not old:
            return jsonify(error="categoria não encontrada"), 404
        label = (d.get("label") if d.get("label") is not None else old["label"]).strip() or old["label"]
        icon = d.get("icon") if d.get("icon") is not None else old["icon"]
        current = float(d["current"]) if d.get("current") is not None else old["current"]
        conn.execute("UPDATE levers SET label=?, icon=?, current=?, max=? WHERE id=?",
                     (label, icon, current, current, lever_id))
        conn.commit()
        return jsonify(lever=lever_dict(conn.execute("SELECT * FROM levers WHERE id=?", (lever_id,)).fetchone()))
    finally:
        conn.close()


@app.delete("/api/levers/<lever_id>")
def delete_lever(lever_id):
    conn = get_conn()
    try:
        conn.execute("DELETE FROM levers WHERE id=?", (lever_id,))
        conn.commit()
        return jsonify(deleted=lever_id)
    finally:
        conn.close()


@app.put("/api/cut-plan")
def save_cut_plan():
    """Salva (substitui) o plano de corte de gastos da conta."""
    d = request.get_json(force=True) or {}
    items = d.get("items") or []
    conn = get_conn()
    try:
        _ensure_cut_plan(conn)
        conn.execute("DELETE FROM cut_plan")
        for i, it in enumerate(items):
            try:
                cut = float(it.get("cut"))
            except (TypeError, ValueError):
                continue
            if cut <= 0:
                continue
            conn.execute(
                "INSERT INTO cut_plan (label, icon, cut, ord) VALUES (?,?,?,?)",
                ((it.get("label") or "").strip() or "Categoria", it.get("icon") or "card", cut, i),
            )
        conn.commit()
        return jsonify(cutPlan=_cut_plan(conn))
    finally:
        conn.close()


@app.delete("/api/cut-plan")
def clear_cut_plan():
    conn = get_conn()
    try:
        _ensure_cut_plan(conn)
        conn.execute("DELETE FROM cut_plan")
        conn.commit()
        return jsonify(cutPlan=[])
    finally:
        conn.close()


@app.get("/api/recurring")
def list_recurring():
    conn = get_conn()
    try:
        rows = conn.execute("SELECT * FROM recurring ORDER BY day_of_month, created_at").fetchall()
        return jsonify([recurring_dict(r) for r in rows])
    finally:
        conn.close()


@app.post("/api/recurring")
def add_recurring():
    d = request.get_json(force=True) or {}
    label = (d.get("label") or "").strip()
    try:
        amount = float(d["amount"])
        dom = int(d["dayOfMonth"])
    except (KeyError, TypeError, ValueError):
        return jsonify(error="amount e dayOfMonth obrigatórios"), 400
    if not label or amount <= 0 or not (1 <= dom <= 31):
        return jsonify(error="label, amount > 0 e dayOfMonth 1-31 obrigatórios"), 400
    rid = f"r-{int(time.time() * 1000)}"
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO recurring VALUES (?,?,?,?,?,1,?)",
            (rid, label, d.get("icon") or "card", amount, dom, time.strftime("%Y-%m-%dT%H:%M:%S")),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM recurring WHERE id=?", (rid,)).fetchone()
        return jsonify(recurring=recurring_dict(row)), 201
    finally:
        conn.close()


@app.patch("/api/recurring/<rec_id>")
def edit_recurring(rec_id):
    d = request.get_json(force=True) or {}
    conn = get_conn()
    try:
        old = conn.execute("SELECT * FROM recurring WHERE id=?", (rec_id,)).fetchone()
        if not old:
            return jsonify(error="gasto fixo não encontrado"), 404
        label = (d.get("label") if d.get("label") is not None else old["label"]).strip() or old["label"]
        amount = float(d["amount"]) if d.get("amount") is not None else old["amount"]
        dom = int(d["dayOfMonth"]) if d.get("dayOfMonth") is not None else old["day_of_month"]
        icon = d.get("icon") if d.get("icon") is not None else old["icon"]
        active = int(d["active"]) if d.get("active") is not None else old["active"]
        conn.execute(
            "UPDATE recurring SET label=?, icon=?, amount=?, day_of_month=?, active=? WHERE id=?",
            (label, icon, amount, dom, active, rec_id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM recurring WHERE id=?", (rec_id,)).fetchone()
        return jsonify(recurring=recurring_dict(row))
    finally:
        conn.close()


@app.delete("/api/recurring/<rec_id>")
def delete_recurring(rec_id):
    conn = get_conn()
    try:
        conn.execute("DELETE FROM recurring WHERE id=?", (rec_id,))
        conn.commit()
        return jsonify(deleted=rec_id)
    finally:
        conn.close()


@app.patch("/api/user")
def update_user():
    d = request.get_json(force=True) or {}
    cols = {
        "name": "name", "fullName": "full_name", "initials": "initials", "age": "age",
        "job": "job", "salary": "salary", "paydayDay": "payday_day", "monthLabel": "month_label",
    }
    sets, vals = [], []
    for k, col in cols.items():
        if k in d and d[k] is not None:
            sets.append(f"{col}=?")
            vals.append(d[k])
    conn = get_conn()
    try:
        if sets:
            conn.execute(f"UPDATE user SET {', '.join(sets)} WHERE id=1", vals)
            conn.commit()
        # identidade é servida a partir da CONTA: propaga edição de nome pra lá
        new_name = d.get("fullName") or d.get("name")
        if new_name and new_name.strip():
            auth.update_account_name(g.account["id"], new_name.strip())
            g.account["name"] = new_name.strip()
        return jsonify(user_dict(conn.execute("SELECT * FROM user WHERE id=1").fetchone()))
    finally:
        conn.close()


@app.patch("/api/balance")
def update_balance():
    d = request.get_json(force=True) or {}
    cols = {
        "checking": "checking", "creditUsed": "credit_used", "creditLimit": "credit_limit",
        "creditDueDay": "credit_due_day", "income": "income", "spent": "spent",
        "estSpend": "est_spend",
    }
    sets, vals = [], []
    for k, col in cols.items():
        if k in d and d[k] is not None:
            sets.append(f"{col}=?")
            vals.append(d[k])
    conn = get_conn()
    try:
        if sets:
            conn.execute(f"UPDATE balance SET {', '.join(sets)} WHERE id=1", vals)
            conn.commit()
        return jsonify(balance_dict(conn.execute("SELECT * FROM balance WHERE id=1").fetchone()))
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
    auth.init()
    debug = os.environ.get("FLASK_DEBUG") == "1"
    app.run(host="127.0.0.1", port=5000, debug=debug, use_reloader=False)
