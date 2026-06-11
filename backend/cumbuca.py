"""Cliente OAuth 2.1 + MCP para o Open Finance Data MCP da Cumbuca.

SPIKE — valida UMA incógnita: depois de autenticar via OAuth (DCR + PKCE +
consent no browser), um access_token Bearer puro consegue chamar as tools do
MCP (`mcp.cumbuca.com`) OU o resource exige token sender-constrained (DPoP/mTLS)?

Tudo em stdlib (urllib) pra não puxar dependência nova. DPoP NÃO está
implementado de propósito: se o resource exigir, a resposta dirá e a gente
adiciona depois. Tokens ficam em claro no SQLite — ACEITÁVEL só pra dev local;
cifrar antes de qualquer coisa séria.
"""
import base64
import hashlib
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

from db import get_auth_conn, get_conn, get_conn_for

# ----------------------- config -----------------------
MCP_URL       = os.environ.get("CUMBUCA_MCP_URL", "https://mcp.cumbuca.com/mcp")
RESOURCE      = os.environ.get("CUMBUCA_RESOURCE", "https://mcp.cumbuca.com")
BACKEND_URL   = os.environ.get("PULSO_BACKEND_URL", "http://localhost:5000")
FRONTEND_URL  = os.environ.get("PULSO_FRONTEND_URL", "http://localhost:5173")
REDIRECT_URI  = BACKEND_URL.rstrip("/") + "/api/auth/callback"
SCOPE         = "openid profile offline_access open-finance"
CLIENT_NAME   = "Pulso"

_discovery_cache: dict | None = None


# ----------------------- HTTP helpers (urllib) -----------------------
def _do(req: urllib.request.Request) -> tuple[int, dict, bytes]:
    """Executa request. Devolve (status, headers_lower, body_bytes). Não levanta em 4xx/5xx."""
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()


def _get_json(url: str) -> dict:
    st, _, body = _do(urllib.request.Request(url, headers={"Accept": "application/json"}))
    if st != 200:
        raise RuntimeError(f"GET {url} → {st}: {body[:300]!r}")
    return json.loads(body)


def _post_form(url: str, data: dict) -> tuple[int, dict]:
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
    )
    st, _, raw = _do(req)
    try:
        return st, json.loads(raw)
    except Exception:
        return st, {"_raw": raw.decode("utf-8", "replace")}


def _post_json(url: str, obj: dict, headers: dict) -> tuple[int, dict, bytes]:
    body = json.dumps(obj).encode()
    h = {"Content-Type": "application/json", **headers}
    return _do(urllib.request.Request(url, data=body, method="POST", headers=h))


# ----------------------- discovery -----------------------
def discovery() -> dict:
    """Resolve endpoints do AS a partir do resource metadata do MCP. Cacheado em memória."""
    global _discovery_cache
    if _discovery_cache:
        return _discovery_cache
    prm = _get_json(RESOURCE.rstrip("/") + "/.well-known/oauth-protected-resource")
    as_url = prm["authorization_servers"][0]
    cfg = _get_json(as_url.rstrip("/") + "/.well-known/openid-configuration")
    _discovery_cache = {
        "authorization_endpoint": cfg["authorization_endpoint"],
        "token_endpoint": cfg["token_endpoint"],
        "registration_endpoint": cfg["registration_endpoint"],
        "issuer": cfg["issuer"],
    }
    return _discovery_cache


# ----------------------- persistência (1 conexão, single-user) -----------------------
def _ensure_table(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS bank_connection (
             id INTEGER PRIMARY KEY CHECK (id = 1),
             client_id TEXT, client_secret TEXT, reg_access_token TEXT,
             code_verifier TEXT, state TEXT,
             tokens_json TEXT, obtained_at INTEGER, accounts_json TEXT,
             synced_at INTEGER
           )"""
    )
    # migração: db antigo pode ter a tabela sem a coluna synced_at
    try:
        conn.execute("ALTER TABLE bank_connection ADD COLUMN synced_at INTEGER")
    except Exception:
        pass


def _row():
    conn = get_conn()
    try:
        _ensure_table(conn)
        conn.commit()
        return conn.execute("SELECT * FROM bank_connection WHERE id=1").fetchone()
    finally:
        conn.close()


def _save(**fields):
    conn = get_conn()
    try:
        _ensure_table(conn)
        exists = conn.execute("SELECT 1 FROM bank_connection WHERE id=1").fetchone()
        if not exists:
            conn.execute("INSERT INTO bank_connection (id) VALUES (1)")
        sets = ", ".join(f"{k}=?" for k in fields)
        conn.execute(f"UPDATE bank_connection SET {sets} WHERE id=1", list(fields.values()))
        conn.commit()
    finally:
        conn.close()


# ----------------------- DCR -----------------------
def _register_client() -> tuple[str, str]:
    """Registra um client novo via DCR. Devolve (client_id, client_secret)."""
    d = discovery()
    payload = {
        "client_name": CLIENT_NAME,
        "redirect_uris": [REDIRECT_URI],
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": "client_secret_post",
        "scope": SCOPE,
    }
    st, _, body = _post_json(d["registration_endpoint"], payload, {"Accept": "application/json"})
    if st not in (200, 201):
        raise RuntimeError(f"DCR falhou {st}: {body[:400]!r}")
    info = json.loads(body)
    return info["client_id"], info.get("client_secret", "")


# ----------------------- PKCE + authorize URL -----------------------
def _pkce() -> tuple[str, str]:
    verifier = base64.urlsafe_b64encode(secrets.token_bytes(48)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    return verifier, challenge


def build_authorization_url(account_id: int) -> str:
    """DCR + PKCE + state vinculado à CONTA (banco central). Devolve a URL de consent.
    O state liga o callback à conta certa, sem depender de header de auth no redirect.
    """
    client_id, client_secret = _register_client()
    d = discovery()
    verifier, challenge = _pkce()
    state = secrets.token_urlsafe(24)
    conn = get_auth_conn()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO oauth_flows VALUES (?,?,?,?,?,?)",
            (state, account_id, verifier, client_id, client_secret,
             time.strftime("%Y-%m-%dT%H:%M:%S")),
        )
        conn.commit()
    finally:
        conn.close()
    qs = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPE,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    return f"{d['authorization_endpoint']}?{qs}"


# ----------------------- troca de code / refresh -----------------------
def exchange_code(code: str, state: str) -> int:
    """Troca o code pelo token e grava na conta dona do `state`. Devolve account_id."""
    conn = get_auth_conn()
    try:
        f = conn.execute("SELECT * FROM oauth_flows WHERE state=?", (state,)).fetchone()
    finally:
        conn.close()
    if not f:
        raise RuntimeError("state inválido (CSRF guard)")
    d = discovery()
    st, tok = _post_form(d["token_endpoint"], {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": f["code_verifier"],
        "client_id": f["client_id"],
        "client_secret": f["client_secret"],
    })
    if st != 200 or "access_token" not in tok:
        raise RuntimeError(f"token exchange {st}: {tok}")

    account_id = int(f["account_id"])
    conn = get_conn_for(account_id)   # banco da conta dona
    try:
        _ensure_table(conn)
        if not conn.execute("SELECT 1 FROM bank_connection WHERE id=1").fetchone():
            conn.execute("INSERT INTO bank_connection (id) VALUES (1)")
        conn.execute(
            """UPDATE bank_connection SET client_id=?, client_secret=?, tokens_json=?,
               obtained_at=?, code_verifier=NULL, state=NULL WHERE id=1""",
            (f["client_id"], f["client_secret"], json.dumps(tok), int(time.time())),
        )
        conn.commit()
    finally:
        conn.close()

    conn = get_auth_conn()
    try:
        conn.execute("DELETE FROM oauth_flows WHERE state=?", (state,))
        conn.commit()
    finally:
        conn.close()
    return account_id


def _refresh_if_needed(row) -> dict:
    tok = json.loads(row["tokens_json"])
    expires_in = tok.get("expires_in", 0)
    if expires_in and time.time() < row["obtained_at"] + expires_in - 60:
        return tok  # ainda válido
    if "refresh_token" not in tok:
        return tok  # sem refresh, tenta usar mesmo assim
    d = discovery()
    st, new = _post_form(d["token_endpoint"], {
        "grant_type": "refresh_token",
        "refresh_token": tok["refresh_token"],
        "client_id": row["client_id"],
        "client_secret": row["client_secret"],
    })
    if st == 200 and "access_token" in new:
        if "refresh_token" not in new:
            new["refresh_token"] = tok["refresh_token"]
        _save(tokens_json=json.dumps(new), obtained_at=int(time.time()))
        return new
    return tok  # refresh falhou; devolve o antigo pra ver o erro do resource


def access_token() -> str | None:
    row = _row()
    if not row or not row["tokens_json"]:
        return None
    return _refresh_if_needed(row).get("access_token")


# ----------------------- MCP (Streamable HTTP, JSON-RPC) -----------------------
def _parse_mcp_body(headers: dict, body: bytes) -> dict:
    ct = headers.get("content-type", "")
    text = body.decode("utf-8", "replace")
    if "text/event-stream" in ct:
        # pega o último frame `data:` e parseia
        chunks = [ln[5:].strip() for ln in text.splitlines() if ln.startswith("data:")]
        for c in reversed(chunks):
            try:
                return json.loads(c)
            except Exception:
                continue
        return {"_raw": text}
    try:
        return json.loads(text)
    except Exception:
        return {"_raw": text}


def _mcp(method: str, params: dict | None, token: str, session_id: str | None, rpc_id):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json, text/event-stream",
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    obj = {"jsonrpc": "2.0", "method": method}
    if rpc_id is not None:
        obj["id"] = rpc_id
    if params is not None:
        obj["params"] = params
    st, h, body = _post_json(MCP_URL, obj, headers)
    return st, h, _parse_mcp_body(h, body)


def probe_accounts() -> dict:
    """A PROVA. Faz initialize → tools/list → list_accounts → get_account com Bearer puro.
    Devolve trace completo pra inspeção: a gente lê pra saber se binding é exigido.
    """
    token = access_token()
    if not token:
        return {"ok": False, "stage": "auth", "error": "sem token — conecte o banco primeiro"}

    trace: dict = {"ok": True, "redirect_uri": REDIRECT_URI}

    # 1. initialize
    st, h, init = _mcp(
        "initialize",
        {"protocolVersion": "2025-06-18",
         "capabilities": {},
         "clientInfo": {"name": CLIENT_NAME, "version": "0.0.1"}},
        token, None, 1,
    )
    session_id = h.get("mcp-session-id")
    trace["initialize"] = {"http": st, "www_authenticate": h.get("www-authenticate"),
                           "session_id": session_id, "body": init}
    if st == 401:
        trace["ok"] = False
        trace["verdict"] = _verdict_from_401(h)
        return trace
    if st >= 400:
        trace["ok"] = False
        trace["verdict"] = f"initialize falhou HTTP {st}"
        return trace

    # 2. notifications/initialized (notification, sem id)
    _mcp("notifications/initialized", {}, token, session_id, None)

    # 3. tools/list
    st, h, tools = _mcp("tools/list", {}, token, session_id, 2)
    trace["tools_list"] = {"http": st, "body": tools}

    # 4. list_accounts
    st, h, accts = _mcp("tools/call", {"name": "list_accounts", "arguments": {}}, token, session_id, 3)
    trace["list_accounts"] = {"http": st, "www_authenticate": h.get("www-authenticate"), "body": accts}
    if st == 401:
        trace["ok"] = False
        trace["verdict"] = _verdict_from_401(h)
        return trace
    # guarda pra exibição no status (sobrevive a F5)
    _save(accounts_json=json.dumps(accts))
    trace["accounts"] = _summarize_accounts(accts)

    # 5. get_account no primeiro id, se houver
    acct_id = _first_account_id(accts)
    if acct_id:
        st, h, one = _mcp("tools/call",
                          {"name": "get_account", "arguments": {"account_id": acct_id}},
                          token, session_id, 4)
        trace["get_account"] = {"http": st, "account_id": acct_id, "body": one}

    trace["verdict"] = "Bearer puro FUNCIONA — binding não é forçado. Resto é plumbing."
    return trace


def _verdict_from_401(h: dict) -> str:
    wa = (h.get("www-authenticate") or "").lower()
    if "dpop" in wa:
        return "Resource exige DPoP. Adicionar prova DPoP (precisa de cryptography)."
    if "mtls" in wa or "certificate" in wa:
        return "Resource exige mTLS cert-bound. Bloqueio sério (cert ICP/OF)."
    return f"401 no resource. WWW-Authenticate: {h.get('www-authenticate')}"


def _first_account_id(tool_result: dict):
    """Extrai um account_id do retorno da tool (formato MCP: result.content[].text = JSON)."""
    try:
        content = tool_result.get("result", {}).get("content", [])
        for c in content:
            if c.get("type") == "text":
                data = json.loads(c["text"])
                items = data if isinstance(data, list) else data.get("accounts") or data.get("data") or []
                if items:
                    it = items[0]
                    return it.get("accountId") or it.get("account_id") or it.get("id")
    except Exception:
        pass
    return None


def _summarize_accounts(tool_result: dict) -> list[dict]:
    """Best-effort: extrai banco/conta de um retorno de tool pra exibição."""
    out: list[dict] = []
    try:
        content = tool_result.get("result", {}).get("content", [])
        for c in content:
            if c.get("type") != "text":
                continue
            data = json.loads(c["text"])
            items = data if isinstance(data, list) else (data.get("accounts") or data.get("data") or [data])
            for it in items:
                if not isinstance(it, dict):
                    continue
                out.append({
                    "institution": it.get("institution") or it.get("institutionName")
                                   or it.get("bank") or it.get("brandName") or it.get("companyName"),
                    "name": it.get("name") or it.get("nickname") or it.get("type") or it.get("accountType"),
                    "number": it.get("number") or it.get("accountNumber") or it.get("maskedNumber"),
                    "id": it.get("accountId") or it.get("account_id") or it.get("id"),
                })
    except Exception:
        pass
    return out


def disconnect() -> dict:
    """Reseta a conexão: apaga tokens/contas/fluxo. Mantém o client DCR registrado."""
    conn = get_conn()
    try:
        _ensure_table(conn)
        conn.execute(
            """UPDATE bank_connection
               SET tokens_json=NULL, obtained_at=NULL, accounts_json=NULL,
                   code_verifier=NULL, state=NULL WHERE id=1"""
        )
        conn.commit()
    finally:
        conn.close()
    return {"connected": False}


# ----------------------- mapper Open Finance → schema Pulso -----------------------
# Palavras-chave → (categoria legível, ícone Pulso). Primeiro match vence.
_RULES = [
    (("ifood", "rappi", "restaurante", "lanchonete", "bar ", "pizz"), "Alimentação", "card"),
    (("mercado", "supermerc", "atacad", "hortifr"), "Mercado", "card"),
    (("uber", "99 ", "99app", "cabify", "posto", "combust", "gasolina"), "Transporte", "trend"),
    (("netflix", "spotify", "prime", "hbo", "disney", "cinema"), "Lazer", "film"),
    (("academia", "smartfit", "gym", "farm", "drogaria", "saúde", "saude"), "Saúde", "gym"),
    (("aluguel", "condom", "luz", "energia", "água", "agua", "internet", "telefon", "celular"), "Moradia/Contas", "shield"),
    (("salário", "salario", "provento", "holerite"), "Renda", "trend"),
    (("investiment", "aplicação", "aplicacao", "resgate", "cdb", "tesouro"), "Investimento", "trend"),
    (("transfer", "ted", "doc "), "Transferência", "trend"),
]


def _classify(name: str, type_: str) -> tuple[str, str]:
    low = (name or "").lower()
    for keys, cat, icon in _RULES:
        if any(k in low for k in keys):
            return cat, icon
    by_type = {"PIX": ("Pix", "trend"), "TED": ("Transferência", "trend"),
               "DOC": ("Transferência", "trend"), "BOLETO": ("Boleto", "card")}
    return by_type.get((type_ or "").upper(), ("Outros", "card"))


def _iso_local(dt_z: str) -> str:
    """'2026-06-10T15:54:10.403Z' → 'YYYY-MM-DDTHH:MM:SS' (naive, hora local)."""
    try:
        s = dt_z.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo:
            dt = dt.astimezone().replace(tzinfo=None)
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    except Exception:
        return time.strftime("%Y-%m-%dT%H:%M:%S")


def _when_label(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso)
        today = date.today()
        if dt.date() == today:
            return dt.strftime("Hoje, %H:%M")
        if dt.date() == today - timedelta(days=1):
            return dt.strftime("Ontem, %H:%M")
        return dt.strftime("%d/%m, %H:%M")
    except Exception:
        return "—"


def map_transaction(raw: dict) -> dict | None:
    """Transação Open Finance → linha da tabela `transactions` do Pulso. None se inválida."""
    tid = raw.get("transactionId")
    amt_obj = raw.get("transactionAmount") or {}
    try:
        amount = float(amt_obj.get("amount"))
    except (TypeError, ValueError):
        return None
    if (raw.get("creditDebitType") or "").upper() == "DEBITO":
        amount = -abs(amount)
    else:
        amount = abs(amount)
    name = raw.get("transactionName") or raw.get("typeAdditionalInfo") or "Transação"
    category, icon = _classify(name, raw.get("type", ""))
    created_at = _iso_local(raw.get("transactionDateTime") or "")
    return {
        "id": f"cb-{tid}" if tid else f"cb-{int(time.time()*1000)}",
        "merchant": name, "category": category, "icon": icon,
        "amount": amount, "when_label": _when_label(created_at),
        "created_at": created_at,
    }


def _tool_payload(tool_result: dict) -> dict | list | None:
    """Extrai o JSON de dentro do result.content[].text de uma tool MCP."""
    try:
        for c in tool_result.get("result", {}).get("content", []):
            if c.get("type") == "text":
                return json.loads(c["text"])
    except Exception:
        pass
    return None


def _extract_balance(get_account_result: dict):
    """Best-effort: pega saldo disponível do retorno de get_account."""
    data = _tool_payload(get_account_result)
    if not isinstance(data, dict):
        return None
    # achata possíveis aninhamentos
    candidates = [data]
    for k in ("balance", "balances", "data", "account"):
        v = data.get(k)
        if isinstance(v, dict):
            candidates.append(v)
        elif isinstance(v, list) and v and isinstance(v[0], dict):
            candidates.append(v[0])
    for d in candidates:
        for key in ("availableAmount", "available_amount", "currentBalance",
                    "availableBalance", "amount", "value"):
            val = d.get(key)
            if isinstance(val, dict):
                val = val.get("amount") or val.get("value")
            if val is not None:
                try:
                    return float(val)
                except (TypeError, ValueError):
                    continue
    return None


def _ensure_card_table(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS card_transactions (
             id TEXT PRIMARY KEY, merchant TEXT, category TEXT, icon TEXT,
             amount REAL, bill_id TEXT, when_label TEXT, created_at TEXT
           )"""
    )


def _amount_of(obj) -> float | None:
    """Extrai valor numérico de formatos OF variados: 123.4 | '123.4' | {'amount':'123.4'}."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        obj = obj.get("amount") or obj.get("value")
    try:
        return float(obj)
    except (TypeError, ValueError):
        return None


def _first(d: dict, *keys):
    for k in keys:
        v = d.get(k)
        if v is not None:
            return v
    return None


def _sync_credit_card(token: str, sid: str, conn) -> dict:
    """Cartão: list_credit_cards → bills → transações da fatura mais recente.
    3 chamadas por sync (tools de cartão não anunciam cota tipo 8/mês, mas
    tratamos conservador: só no sync explícito, só 1 cartão, só 1 fatura).
    """
    out: dict = {"cards": 0, "billTxs": 0}

    st, h, cards_res = _mcp("tools/call", {"name": "list_credit_cards", "arguments": {}}, token, sid, 10)
    if st >= 400:
        out["error"] = f"list_credit_cards HTTP {st}"
        return out
    payload = _tool_payload(cards_res) or {}
    cards = (payload.get("credit_cards") or payload.get("creditCardAccounts")
             or payload.get("accounts") or payload.get("data") or []) if isinstance(payload, dict) else payload
    out["cards"] = len(cards)
    if not cards:
        return out
    card = cards[0]
    card_id = _first(card, "creditCardAccountId", "accountId", "id")
    out["cardName"] = _first(card, "name", "brandName", "productName")
    # limite, se vier no payload do cartão
    limit = _amount_of(_first(card, "creditLimit", "limitAmount", "availableAmount"))

    st, h, bills_res = _mcp("tools/call",
                            {"name": "list_credit_card_bills",
                             "arguments": {"credit_card_account_id": card_id}}, token, sid, 11)
    if st >= 400:
        out["error"] = f"list_credit_card_bills HTTP {st}"
        return out
    bpayload = _tool_payload(bills_res) or {}
    bills = (bpayload.get("bills") or bpayload.get("credit_card_bills")
             or bpayload.get("data") or []) if isinstance(bpayload, dict) else bpayload
    if not bills:
        # sem fatura no banco → não mexe: fatura é campo manual do perfil
        return out
    # fatura mais recente pela dueDate
    def _due(b):
        return _first(b, "dueDate", "billDueDate") or ""
    bills = sorted(bills, key=_due, reverse=True)
    bill = bills[0]
    bill_id = _first(bill, "billId", "id")
    bill_total = _amount_of(_first(bill, "billTotalAmount", "totalAmount", "amount"))
    due_raw = _due(bill)
    due_day = None
    try:
        due_day = datetime.fromisoformat(due_raw[:10]).day
    except Exception:
        pass

    st, h, txs_res = _mcp("tools/call",
                          {"name": "list_credit_card_bill_transactions",
                           "arguments": {"credit_card_account_id": card_id, "bill_id": bill_id}},
                          token, sid, 12)
    if st >= 400:
        out["error"] = f"bill_transactions HTTP {st}"
    else:
        tpayload = _tool_payload(txs_res) or {}
        raw_txs = (tpayload.get("transactions") or tpayload.get("bill_transactions")
                   or tpayload.get("data") or []) if isinstance(tpayload, dict) else tpayload
        _ensure_card_table(conn)
        for raw in raw_txs:
            tid = _first(raw, "transactionId", "id") or f"{bill_id}-{raw_txs.index(raw)}"
            name = _first(raw, "transactionName", "name", "merchantName", "description") or "Compra"
            amount = _amount_of(_first(raw, "amount", "transactionAmount", "brazilianAmount"))
            if amount is None:
                continue
            # crédito na fatura (estorno/pagamento) vem como CREDITO → sinal negativo no gasto
            if (raw.get("creditDebitType") or "").upper() == "CREDITO":
                amount = -abs(amount)
            created_at = _iso_local(_first(raw, "transactionDateTime", "transactionDate", "date") or "")
            category, icon = _classify(name, raw.get("type", ""))
            conn.execute(
                """INSERT INTO card_transactions VALUES (?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET
                     merchant=excluded.merchant, category=excluded.category,
                     icon=excluded.icon, amount=excluded.amount,
                     bill_id=excluded.bill_id, when_label=excluded.when_label,
                     created_at=excluded.created_at""",
                (f"cc-{tid}", name, category, icon, amount, bill_id,
                 _when_label(created_at), created_at),
            )
            out["billTxs"] += 1

    # fatura/limite são campos MANUAIS do perfil — sync não sobrescreve.
    # Mantém só informativo no retorno (modal mostra o que o banco reportou).
    out["billTotal"] = bill_total
    out["dueDay"] = due_day
    out["limit"] = limit
    return out


def _regen_levers(conn):
    """Recria as alavancas de corte a partir do gasto real por categoria
    (conta + cartão do mês), excluindo transferências/investimentos."""
    mp = date.today().strftime("%Y-%m-") + "%"
    skip = ("Transferência", "Investimento", "Renda")
    rows = conn.execute(
        """SELECT category, icon, SUM(spend) AS total FROM (
             SELECT category, icon, -amount AS spend FROM transactions
               WHERE amount < 0 AND created_at LIKE ?
             UNION ALL
             SELECT category, icon, amount AS spend FROM card_transactions
               WHERE amount > 0 AND created_at LIKE ?
           ) GROUP BY category ORDER BY total DESC LIMIT 6""",
        (mp, mp),
    ).fetchall()
    real = [r for r in rows if r["category"] not in skip and r["total"] and r["total"] > 0]
    if not real:
        return 0
    conn.execute("DELETE FROM levers")
    for i, r in enumerate(real):
        lid = "lv-" + "".join(ch if ch.isalnum() else "-" for ch in r["category"].lower())
        conn.execute("INSERT INTO levers VALUES (?,?,?,?,?,?)",
                     (lid, r["category"], r["icon"] or "card",
                      round(r["total"], 2), round(r["total"], 2), i))
    return len(real)


def sync(days: int = 7) -> dict:
    """Puxa saldo + transações + cartão do MCP, mapeia e persiste.
    CUIDADO COM COTA: usa accounts cacheados (8/mês); get_account (saldo 420/mês)
    e list_account_transactions (240/mês p/ 7d) por sync. Cartão: 3 chamadas.
    Não fazer polling.
    """
    token = access_token()
    if not token:
        return {"ok": False, "error": "banco não conectado"}

    # 1. sessão MCP
    st, h, _ = _mcp("initialize",
                    {"protocolVersion": "2025-06-18", "capabilities": {},
                     "clientInfo": {"name": CLIENT_NAME, "version": "0.0.1"}},
                    token, None, 1)
    if st == 401:
        return {"ok": False, "error": _verdict_from_401(h)}
    if st >= 400:
        return {"ok": False, "error": f"initialize HTTP {st}"}
    sid = h.get("mcp-session-id")
    _mcp("notifications/initialized", {}, token, sid, None)

    # 2. accounts: reusa cache (8/mês!) se já temos
    row = _row()
    accts_result = json.loads(row["accounts_json"]) if row and row["accounts_json"] else None
    if not accts_result:
        st, h, accts_result = _mcp("tools/call", {"name": "list_accounts", "arguments": {}}, token, sid, 2)
        if st >= 400:
            return {"ok": False, "error": f"list_accounts HTTP {st}"}
        _save(accounts_json=json.dumps(accts_result))
    acct_id = _first_account_id(accts_result)
    if not acct_id:
        return {"ok": False, "error": "nenhuma conta encontrada"}

    # 3. saldo
    st, h, acct = _mcp("tools/call", {"name": "get_account", "arguments": {"account_id": acct_id}}, token, sid, 3)
    balance_val = _extract_balance(acct) if st < 400 else None

    # 4. transações (últimos `days` dias)
    today = date.today()
    frm = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    to = today.strftime("%Y-%m-%d")
    st, h, txres = _mcp("tools/call",
                        {"name": "list_account_transactions",
                         "arguments": {"account_id": acct_id, "from_date": frm, "to_date": to}},
                        token, sid, 4)
    if st == 401:
        return {"ok": False, "error": _verdict_from_401(h)}
    if st >= 400:
        return {"ok": False, "error": f"list_account_transactions HTTP {st}"}
    payload = _tool_payload(txres) or {}
    raw_txs = payload.get("transactions", []) if isinstance(payload, dict) else []

    # 5. persiste (dedupe por id cb-*) + atualiza saldo + recalcula mês
    imported = 0
    conn = get_conn()
    try:
        _ensure_card_table(conn)
        for raw in raw_txs:
            tx = map_transaction(raw)
            if not tx:
                continue
            cur = conn.execute(
                """INSERT INTO transactions VALUES (?,?,?,?,?,?,0,?)
                   ON CONFLICT(id) DO UPDATE SET
                     merchant=excluded.merchant, category=excluded.category,
                     icon=excluded.icon, amount=excluded.amount,
                     when_label=excluded.when_label, created_at=excluded.created_at""",
                (tx["id"], tx["merchant"], tx["category"], tx["icon"],
                 tx["amount"], tx["when_label"], tx["created_at"]),
            )
            imported += 1 if cur.rowcount else 0
        # saldo real (cache do banco; perfil exibe readonly)
        if balance_val is not None:
            conn.execute("UPDATE balance SET checking=? WHERE id=1", (balance_val,))
        # income/spent NÃO são tocados: app deriva do histórico de transações;
        # renda mensal e fatura são campos manuais do perfil.

        # 6. cartão de crédito (cards → fatura recente → transações) + alavancas reais
        card = _sync_credit_card(token, sid, conn)
        levers_n = _regen_levers(conn)
        conn.commit()
    finally:
        conn.close()

    _save(synced_at=int(time.time()))
    return {
        "ok": True, "imported": imported, "fetched": len(raw_txs),
        "balance": balance_val, "accountId": acct_id,
        "card": card, "levers": levers_n,
        "from": frm, "to": to,
    }


def status() -> dict:
    row = _row()
    connected = bool(row and row["tokens_json"])
    obtained_at = row["obtained_at"] if row else None
    accounts = []
    if row and row["accounts_json"]:
        try:
            accounts = _summarize_accounts(json.loads(row["accounts_json"]))
        except Exception:
            accounts = []
    synced_at = row["synced_at"] if row and "synced_at" in row.keys() else None
    return {
        "connected": connected,
        "redirectUri": REDIRECT_URI,
        "hasClient": bool(row and row["client_id"]),
        "obtainedAt": (time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(obtained_at))
                       if obtained_at else None),
        "syncedAt": (time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(synced_at))
                     if synced_at else None),
        "accounts": accounts,
    }
