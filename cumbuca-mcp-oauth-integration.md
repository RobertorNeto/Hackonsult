# Integrando o MCP da Cumbuca via OAuth 2.1

## Visão geral

O MCP da Cumbuca (`https://mcp.cumbuca.com/mcp`) expõe dados do Open Finance via protocolo MCP. Para acessá-lo, é obrigatório passar por um fluxo OAuth 2.1 com PKCE — não existe autenticação por API key ou token estático. O token válido só é emitido após o usuário autenticar com o próprio CPF e dar consent explícito no banco.

---

## Pré-requisitos

- Conta ativa no MCP da Cumbuca (teste gratuito disponível em `cumbuca-site-animated.vercel.app/launchweek/of-data-mcp`)
- Um `redirect_uri` acessível (domínio próprio em produção, `localhost` em desenvolvimento)
- `@modelcontextprotocol/sdk` instalado

```bash
npm install @modelcontextprotocol/sdk
```

---

## Fluxo completo de autenticação

```
1. Usuário clica "Conectar banco" no seu app
         ↓
2. Seu backend chama auth(provider, { serverUrl })
         ↓
3. SDK faz DCR automático no Keycloak da Cumbuca
   → recebe client_id único para seu app
         ↓
4. SDK monta URL de autorização (PKCE + state)
   → seu backend redireciona o usuário para essa URL
         ↓
5. Usuário vê a interface da Cumbuca:
   → digita CPF
   → seleciona banco (Nubank, Itaú, Bradesco...)
   → autentica no próprio banco
   → dá consent para compartilhar dados
         ↓
6. Cumbuca redireciona para seu redirect_uri:
   https://seuapp.com/api/auth/callback?code=ABC&state=XYZ
         ↓
7. Seu backend chama auth(provider, { authorizationCode: code })
   → SDK troca o code pelo access_token
   → SDK chama provider.saveTokens()
         ↓
8. Você salva o access_token cifrado no banco vinculado ao userId
         ↓
9. Sync worker usa esse token para chamar as tools do MCP em background
```

---

## Implementação do OAuthProvider

O SDK exige que você implemente um `OAuthProvider` — ele é a ponte entre o SDK e onde você persiste os tokens.

```typescript
// lib/mcp/oauth-provider.ts
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { encrypt, decrypt } from "@/lib/crypto";
import { db } from "@/lib/mongodb";

export class MongoOAuthProvider implements OAuthClientProvider {
  constructor(private userId: string) {}

  get redirectUrl() {
    return `${process.env.NEXT_PUBLIC_URL}/api/auth/callback`;
  }

  get clientMetadata() {
    return {
      client_name: "Seu SaaS",
      redirect_uris: [this.redirectUrl],
    };
  }

  async clientInformation() {
    const conn = await db.collection("bank_connections").findOne({ userId: this.userId });
    return conn?.oauthClient ?? undefined;
  }

  async saveClientInformation(info: { client_id: string; client_secret?: string }) {
    await db.collection("bank_connections").updateOne(
      { userId: this.userId },
      { $set: { oauthClient: info } },
      { upsert: true }
    );
  }

  async tokens() {
    const conn = await db.collection("bank_connections").findOne({ userId: this.userId });
    if (!conn?.encryptedTokens) return undefined;
    return JSON.parse(decrypt(conn.encryptedTokens)) as OAuthTokens;
  }

  async saveTokens(tokens: OAuthTokens) {
    await db.collection("bank_connections").updateOne(
      { userId: this.userId },
      { $set: { encryptedTokens: encrypt(JSON.stringify(tokens)) } },
      { upsert: true }
    );
  }

  async redirectToAuthorization(url: URL) {
    // No contexto de API route do Next.js, você retorna o redirect
    // O chamador usa essa URL para redirecionar o browser do usuário
    throw { redirectUrl: url.toString() };
  }

  async saveCodeVerifier(verifier: string) {
    await db.collection("bank_connections").updateOne(
      { userId: this.userId },
      { $set: { codeVerifier: verifier } },
      { upsert: true }
    );
  }

  async codeVerifier() {
    const conn = await db.collection("bank_connections").findOne({ userId: this.userId });
    return conn?.codeVerifier ?? "";
  }
}
```

---

## Rotas do Next.js

### Iniciar o fluxo — `app/api/bank/connect/route.ts`

```typescript
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { MongoOAuthProvider } from "@/lib/mcp/oauth-provider";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function GET() {
  const session = await requireSession();
  const provider = new MongoOAuthProvider(session.user.id);

  try {
    const result = await auth(provider, {
      serverUrl: process.env.CUMBUCA_MCP_URL!,
    });

    if (result === "AUTHORIZED") {
      redirect("/dashboard"); // já tinha token válido
    }
  } catch (err: any) {
    if (err?.redirectUrl) {
      redirect(err.redirectUrl); // manda o usuário para a Cumbuca
    }
    throw err;
  }
}
```

### Receber o callback — `app/api/auth/callback/route.ts`

```typescript
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { MongoOAuthProvider } from "@/lib/mcp/oauth-provider";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const session = await requireSession();

  if (!code) {
    redirect("/dashboard?error=auth_failed");
  }

  const provider = new MongoOAuthProvider(session.user.id);

  const result = await auth(provider, {
    serverUrl: process.env.CUMBUCA_MCP_URL!,
    authorizationCode: code,
  });

  if (result === "AUTHORIZED") {
    // Token salvo pelo provider.saveTokens() — inicia o sync
    await fetch(`${process.env.NEXT_PUBLIC_URL}/api/sync/trigger`, {
      method: "POST",
      headers: { "x-user-id": session.user.id },
    });
    redirect("/dashboard?connected=true");
  }

  redirect("/dashboard?error=auth_failed");
}
```

---

## Chamando as tools do MCP após autenticado

Com o `access_token` salvo, você não precisa mais do browser. O sync worker chama o MCP diretamente:

```typescript
// lib/mcp/invoke.ts
export async function invokeTool(
  accessToken: string,
  tool: string,
  args: Record<string, unknown>
) {
  const response = await fetch(process.env.CUMBUCA_MCP_URL!, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: tool, arguments: args },
      id: crypto.randomUUID(),
    }),
  });

  const data = await response.json();
  const text = data.result?.content?.find((c: any) => c.type === "text")?.text;
  return JSON.parse(text);
}

// Uso no sync worker:
const token = decrypt(conn.encryptedTokens).access_token;

const accounts = await invokeTool(token, "list_accounts", {});
const balance  = await invokeTool(token, "get_account", { account_id: accounts[0].accountId });
const txns     = await invokeTool(token, "list_account_transactions", {
  account_id: accounts[0].accountId,
  from_date: "2026-05-01",
  to_date:   "2026-06-10",
});
```

---

## Tools disponíveis no MCP da Cumbuca

| Tool | Descrição |
|---|---|
| `list_accounts` | Lista contas bancárias do usuário |
| `get_account` | Saldo e detalhes de uma conta |
| `list_account_transactions` | Transações por período |
| `list_credit_cards` | Cartões de crédito |
| `list_credit_card_bills` | Faturas do cartão |
| `list_credit_card_bill_transactions` | Transações de uma fatura |

---

## Por que o LLM direto não funciona

Quando você tenta usar um LLM (Claude, LangChain, etc.) como cliente MCP sem autenticação prévia:

1. O MCP retorna `401 Unauthorized`
2. O SDK tenta iniciar o OAuth — gera a URL de autorização
3. **O LLM não tem browser** — não consegue abrir a URL para o usuário
4. **O LLM não tem redirect_uri** — ou usa o do próprio Claude (`claude.ai/callback`)
5. O fluxo trava — nenhum `code` chega de volta

O Claude Desktop e o Claude.ai funcionam porque **eles mesmos são clientes MCP completos** — têm browser, redirect_uri próprio e armazenamento local de tokens. Quando você usa o MCP via Claude, é o Claude que autentica, não o seu código.

Para um SaaS, a autenticação deve sempre acontecer no **seu backend + browser do usuário**. O LLM só entra depois, para processar os dados que o sync worker já buscou.

---

## Ponto crítico a validar

Antes de construir, confirme se o Keycloak da Cumbuca aceita DCR com qualquer `redirect_uri` ou só domínios pré-aprovados:

```bash
curl -X POST https://idc.cumbuca.com/realms/cumbuca-mcp/clients-registrations/openid-connect \
  -H "Content-Type: application/json" \
  -d '{
    "redirect_uris": ["https://seuapp.com/api/auth/callback"],
    "client_name": "teste-saas"
  }'
```

- `201` → DCR aberto, qualquer domínio funciona
- `403` → exige aprovação prévia da Cumbuca
