"""Cérebro do Assistente Pulso — OpenAI gpt-5.4-mini.

Recebe um CONTEXTO já montado (saldo, transações reais do MCP, e a projeção
Monte Carlo JÁ CALCULADA pelo backend) e responde em PT-BR. A projeção entra
pronta no prompt de propósito: o modelo NÃO refaz simulação, só interpreta os
números — economiza tokens e mantém a matemática no backend.
"""
import json
import os

MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-mini")

SYSTEM = """Você é o Assistente Pulso, copiloto de saúde financeira de um app brasileiro.
Fala PT-BR, direto, prático, tom amigável mas sem enrolação. Valores em R$.

REGRAS:
- Use SOMENTE os números do CONTEXTO abaixo. Nunca invente saldo, gasto ou data.
- A PROJEÇÃO Monte Carlo já está calculada (expected/optimistic/pessimistic/probNegativo).
  Use esses números direto para previsões. NÃO refaça simulação nem invente cenários.
- RESPOSTA CURTA: no MÁXIMO 2 frases (ou 3 bullets de uma linha). É chat, não relatório.
- Sem markdown pesado: nada de títulos, negrito no máximo 1 vez, sem listas longas.
- Não repita o contexto; vá direto ao número que responde a pergunta.
- Se faltar dado, diga que precisa sincronizar o banco (botão "Sincronizar") em vez de chutar.
- Quando fizer sentido, termine com UMA ação concreta (cortar categoria X, separar Y/mês)."""


def _digest(context: dict) -> str:
    """Serializa o contexto de forma compacta (poucos tokens)."""
    b = context.get("balance", {})
    p = context.get("projection", {})
    lines = []
    u = context.get("user", {})
    if u:
        lines.append(f"Usuário: {u.get('name')}, renda R${u.get('salary')}, salário dia {u.get('paydayDay')}.")
    lines.append(
        f"Saldo conta: R${b.get('checking')}. Renda mês: R${b.get('income')}. "
        f"Gasto mês: R${b.get('spent')}. Fatura cartão: R${b.get('creditUsed')} (vence dia {b.get('creditDueDay')})."
    )
    if p:
        lines.append(
            f"PROJEÇÃO Monte Carlo fim do mês — esperado R${p.get('expected')}, "
            f"otimista R${p.get('optimistic')}, pessimista R${p.get('pessimistic')}, "
            f"prob. ficar negativo {round((p.get('probabilityNegative') or 0)*100)}%. "
            f"Driver: {p.get('driver')}"
        )
    cats = context.get("topCategories") or []
    if cats:
        lines.append("Top gastos por categoria (mês): " +
                     "; ".join(f"{c['category']} R${c['total']}" for c in cats))
    txs = context.get("transactions") or []
    if txs:
        lines.append("Últimas transações (conta):")
        for t in txs:
            lines.append(f"  - {t.get('when')} {t.get('merchant')} ({t.get('category')}): R${t.get('amount')}")
    ctxs = context.get("cardTransactions") or []
    if ctxs:
        lines.append("Compras no cartão (fatura atual):")
        for t in ctxs:
            lines.append(f"  - {t.get('when')} {t.get('merchant')} ({t.get('category')}): R${t.get('amount')}")
    if not context.get("connected"):
        lines.append("ATENÇÃO: banco NÃO conectado — dados são de demonstração, não reais.")
    elif not context.get("syncedAt"):
        lines.append("ATENÇÃO: banco conectado mas ainda não sincronizado nesta sessão.")
    return "\n".join(lines)


def answer(message: str, history: list[dict], context: dict) -> dict:
    """Chama o modelo. history = [{from:'user'|'bot', text}]. Retorna {reply} ou {error}."""
    if not os.environ.get("OPENAI_API_KEY"):
        return {"error": "OPENAI_API_KEY ausente no ambiente (.env)."}

    from openai import OpenAI
    client = OpenAI()

    msgs = [
        {"role": "system", "content": SYSTEM},
        {"role": "system", "content": "CONTEXTO ATUAL:\n" + _digest(context)},
    ]
    for h in (history or [])[-8:]:  # janela curta = menos tokens
        role = "assistant" if h.get("from") in ("bot", "app", "assistant") else "user"
        text = (h.get("text") or "").strip()
        if text:
            msgs.append({"role": role, "content": text})
    msgs.append({"role": "user", "content": message})

    try:
        resp = client.chat.completions.create(
            model=MODEL, messages=msgs, max_completion_tokens=180,  # teto duro: chat curto
        )
        return {"reply": resp.choices[0].message.content.strip()}
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}
