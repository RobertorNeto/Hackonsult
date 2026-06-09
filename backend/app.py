"""Pulso · API Flask + SQLite.
Serve todos os dados do app e aceita inserção de transações, metas e edição
do perfil. A parte de IA (chat) NÃO está aqui — fica local no front por enquanto.
Rodar: python app.py  (porta 5000)
"""
import json
import os
import time

from flask import Flask, jsonify, request
from flask_cors import CORS

from db import get_conn, init_db

app = Flask(__name__)
CORS(app)


# ----------------------- serialização -----------------------
def user_dict(r):
    return {
        "name": r["name"], "fullName": r["full_name"], "initials": r["initials"],
        "age": r["age"], "job": r["job"], "salary": r["salary"], "bank": r["bank"],
        "paydayDay": r["payday_day"], "todayLabel": r["today_label"], "monthLabel": r["month_label"],
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


def tx_dict(r):
    return {
        "id": r["id"], "merchant": r["merchant"], "category": r["category"], "icon": r["icon"],
        "amount": r["amount"], "when": r["when_label"], "flagged": bool(r["flagged"]),
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
    p = conn.execute("SELECT * FROM projection WHERE id=1").fetchone()
    projection = {
        "expected": p["expected"], "optimistic": p["optimistic"], "pessimistic": p["pessimistic"],
        "probabilityNegative": p["prob_negative"], "todayIndex": p["today_index"],
        "daysInMonth": p["days_in_month"], "driver": p["driver"],
        "median": json.loads(p["median_json"]), "upper": json.loads(p["upper_json"]),
        "lower": json.loads(p["lower_json"]),
    }
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
    return {
        "user": user_dict(conn.execute("SELECT * FROM user WHERE id=1").fetchone()),
        "balance": balance_dict(conn.execute("SELECT * FROM balance WHERE id=1").fetchone()),
        "health": health,
        "goals": [goal_dict(g) for g in conn.execute("SELECT * FROM goals ORDER BY created_at, rowid").fetchall()],
        "transactions": [tx_dict(t) for t in conn.execute("SELECT * FROM transactions ORDER BY created_at DESC, rowid DESC").fetchall()],
        "levers": levers,
        "projection": projection,
        "recommendations": recos,
        "insight": insight,
    }


# ----------------------- rotas -----------------------
@app.get("/api/health")
def healthcheck():
    return jsonify(ok=True)


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

    tx_id = f"t{int(time.time() * 1000)}"
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?)",
            (tx_id, merchant, d.get("category") or "Outros", d.get("icon") or "card",
             amount, d.get("when") or "Agora", 1 if d.get("flagged") else 0,
             time.strftime("%Y-%m-%dT%H:%M:%S")),
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
        # reverte o efeito antigo, aplica o novo
        _apply_balance(conn, old["amount"], -1)
        conn.execute(
            "UPDATE transactions SET merchant=?, category=?, icon=?, amount=?, flagged=? WHERE id=?",
            (merchant, category, icon, amount, flagged, tx_id),
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
    """Heurística simples: chance de bater a meta no prazo dado o aporte atual."""
    falta = max(0.0, target - saved)
    if falta <= 0:
        return 0.97
    if monthly_current <= 0 or months_left <= 0:
        return 0.05
    meses_necessarios = falta / monthly_current
    ratio = months_left / meses_necessarios  # >=1 => dá tempo
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
    debug = os.environ.get("FLASK_DEBUG") == "1"
    app.run(host="127.0.0.1", port=5000, debug=debug, use_reloader=False)
