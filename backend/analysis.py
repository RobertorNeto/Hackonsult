"""Análise de saúde financeira por IA (gpt-5.4-mini).

Uma chamada por sync: recebe digest compacto dos dados REAIS (saldo, fluxo,
transações conta+cartão, projeção Monte Carlo pronta) e devolve JSON estrito
que sobrescreve health_meta, vitals, recommendations, insight e score_history.
A UI já lê essas tabelas — nada muda no front.

Economia de tokens: digest curto, Monte Carlo entra calculado (modelo não
simula nada), saída limitada por schema fixo + max_tokens.
"""
import json
import os
import time
from datetime import date

MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-mini")

MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
         "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

SYSTEM = """Você é o motor de análise de saúde financeira do app Pulso (BR).
Recebe dados financeiros REAIS e a projeção Monte Carlo JÁ CALCULADA.
Responda APENAS com JSON válido, exatamente neste schema:

{
 "score": <int 0-100, saúde financeira geral>,
 "scoreLabel": "<2-3 palavras, ex: 'precisa de atenção'>",
 "headline": "<1 frase de impacto sobre o estado atual, max 70 chars>",
 "subline": "<1 frase com o principal fator e uma direção, max 110 chars>",
 "vitals": [
   {"key":"fluxo","value":<0-100>,"hint":"<max 40 chars>","detail":"<max 90 chars>"},
   {"key":"cartao","value":<0-100>,"hint":"<...>","detail":"<...>"},
   {"key":"recorrentes","value":<0-100>,"hint":"<...>","detail":"<...>"},
   {"key":"reserva","value":<0-100>,"hint":"<...>","detail":"<...>"},
   {"key":"objetivo","value":<0-100>,"hint":"<...>","detail":"<...>"}
 ],
 "recommendations": [
   // ANÁLISE POR ÁREA DE GASTO: uma entrada por categoria relevante do histórico
   // (ex: Pix, Alimentação, Transporte). title = nome da área; text = padrão
   // observado nas transações REAIS dessa área (quantas, maior valor, pra quem/
   // onde foi) + 1 conselho; impact = total da área no mês.
   {"icon":"<food|card|film|gym|trend|shield|target>","title":"<área, max 30 chars>",
    "text":"<max 130 chars, padrão real observado + conselho>","impact":"<ex: 'R$ 2.743 no mês'>",
    "cta":"<max 20 chars>","tone":"<mint=saudável|amber=atenção|coral=problema>"}
   // exatamente 3, as áreas com MAIOR gasto primeiro
 ],
 "insight": {"icon":"<idem>","title":"<max 70 chars, com número real>",
             "body":"<max 140 chars>","primary":"<max 20 chars>","secondary":"<max 15 chars>"}
}

Regras: use SOMENTE números do contexto; vitals.value: 100=ótimo, 0=crítico;
score coerente com a projeção (prob. de negativo alta → score baixo);
recomendações concretas citando categorias e valores reais; PT-BR."""


def _digest(ctx: dict) -> str:
    b = ctx.get("balance", {})
    p = ctx.get("projection", {})
    lines = [
        f"Saldo: R${b.get('checking')}. Renda mês: R${b.get('income')}. Gasto mês: R${b.get('spent')}.",
        f"Cartão: fatura R${b.get('creditUsed')} vence dia {b.get('creditDueDay')}, limite R${b.get('creditLimit')}.",
        f"Projeção Monte Carlo fim do mês: esperado R${p.get('expected')}, otimista R${p.get('optimistic')}, "
        f"pessimista R${p.get('pessimistic')}, prob. negativo {round((p.get('probabilityNegative') or 0)*100)}%.",
    ]
    cats = ctx.get("topCategories") or []
    if cats:
        lines.append("Gasto por categoria (conta+cartão, mês): " +
                     "; ".join(f"{c['category']} R${c['total']}" for c in cats))
    rec = ctx.get("recurring") or []
    if rec:
        lines.append("Gastos fixos: " + "; ".join(f"{r['label']} R${r['amount']} dia {r['day']}" for r in rec))
    goals = ctx.get("goals") or []
    if goals:
        lines.append("Metas: " + "; ".join(
            f"{g['name']} R${g['saved']}/{g['target']} ({g['monthsLeft']}m)" for g in goals))
    atxs = ctx.get("transactions") or []
    if atxs:
        lines.append("Transações da conta (recentes):")
        for t in atxs[:15]:
            lines.append(f"  - {t['when']} {t['merchant']} ({t['category']}): R${t['amount']}")
    txs = ctx.get("cardTransactions") or []
    if txs:
        lines.append("Compras recentes no cartão: " + "; ".join(
            f"{t['merchant']} R${t['amount']}" for t in txs[:8]))
    return "\n".join(lines)


def run(ctx: dict, conn) -> dict:
    """Roda a análise e persiste. Retorna {ok, score} ou {ok:False, error}."""
    if not os.environ.get("OPENAI_API_KEY"):
        return {"ok": False, "error": "OPENAI_API_KEY ausente"}

    from openai import OpenAI
    client = OpenAI()
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": "DADOS REAIS:\n" + _digest(ctx)},
            ],
        )
        data = json.loads(resp.choices[0].message.content)
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}

    score = max(0, min(100, int(data.get("score", 50))))
    zone = "bom" if score >= 70 else "atencao" if score >= 45 else "critico"

    # delta vs mês anterior no histórico
    prev = conn.execute("SELECT v FROM score_history ORDER BY ord DESC LIMIT 1 OFFSET 1").fetchone()
    today = date.today()
    cur_m = MESES[today.month - 1]
    last = conn.execute("SELECT ord, m FROM score_history ORDER BY ord DESC LIMIT 1").fetchone()
    if last and last["m"] == cur_m:
        conn.execute("UPDATE score_history SET v=? WHERE ord=?", (score, last["ord"]))
        prev_v = prev["v"] if prev else score
    else:
        nxt = (last["ord"] + 1) if last else 0
        conn.execute("INSERT INTO score_history VALUES (?,?,?)", (nxt, cur_m, score))
        prev_v = last["v"] if last else score
    delta = score - prev_v

    conn.execute(
        """UPDATE health_meta SET score=?, score_label=?, zone=?, delta_month=?,
           headline=?, subline=? WHERE id=1""",
        (score, data.get("scoreLabel", ""), zone, delta,
         data.get("headline", ""), data.get("subline", "")),
    )

    valid_status = lambda v: "bom" if v >= 70 else "atencao" if v >= 45 else "critico"
    for v in data.get("vitals", []):
        val = max(0, min(100, int(v.get("value", 50))))
        conn.execute(
            "UPDATE vitals SET value=?, status=?, hint=?, detail=? WHERE key=?",
            (val, valid_status(val), v.get("hint", ""), v.get("detail", ""), v.get("key")),
        )

    recos = data.get("recommendations", [])[:3]
    if recos:
        conn.execute("DELETE FROM recommendations")
        for i, r in enumerate(recos):
            tone = r.get("tone") if r.get("tone") in ("mint", "amber", "coral") else "amber"
            conn.execute(
                "INSERT INTO recommendations VALUES (?,?,?,?,?,?,?,?)",
                (f"ai-r{i}", r.get("icon", "trend"), r.get("title", ""), r.get("text", ""),
                 r.get("impact", ""), r.get("cta", "Ver plano"), tone, i),
            )

    ins = data.get("insight")
    if ins:
        conn.execute(
            """UPDATE insight SET badge=?, icon=?, title=?, body=?, primary_cta=?, secondary_cta=?
               WHERE id=1""",
            ("Análise da IA · " + time.strftime("%d/%m %H:%M"), ins.get("icon", "trend"),
             ins.get("title", ""), ins.get("body", ""),
             ins.get("primary", "Ver detalhes"), ins.get("secondary", "Agora não")),
        )

    conn.commit()
    return {"ok": True, "score": score, "zone": zone, "delta": delta}
