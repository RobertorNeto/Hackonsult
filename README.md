# Pulso

Monolito em duas pastas: **frontend** (React + Vite + Motion) e **backend** (Flask + SQLite).
A parte de IA (chat do Assistente) ainda é local/mockada — integração com IA fica pra depois.

```
Projeto-Hackaton/
├── frontend/   app React (UI, gráficos, modais)
├── backend/    API Flask + SQLite (persistência)
└── scripts/    launcher dev (sobe os dois juntos)
```

## Rodar tudo de uma vez (recomendado)

Na **raiz** do projeto:

```bash
npm run setup   # 1ª vez: cria venv, instala deps do back e do front
npm run dev     # sobe backend (:5000) + frontend (:5173) juntos
```

`npm run dev` usa um launcher Node (`scripts/dev.mjs`, sem dependências externas):
saída prefixada `[back]`/`[front]` e Ctrl+C derruba os dois. Abra http://localhost:5173.

Scripts auxiliares: `npm run dev:front`, `npm run dev:back`.

---

Para rodar cada parte separadamente:

## Backend (porta 5000)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

Na primeira execução cria `pulso.db` e popula com os dados iniciais (`seed.py`).
Apagar `pulso.db` reseta tudo pro seed.

### Endpoints

| Método | Rota | O que faz |
|--------|------|-----------|
| GET | `/api/bootstrap` | Devolve todos os dados do app num payload só |
| POST | `/api/transactions` | Adiciona transação e atualiza o saldo/fluxo |
| POST | `/api/goals` | Cria meta (calcula progresso e mensal necessário) |
| PATCH | `/api/user` | Edita o perfil do usuário |
| PATCH | `/api/balance` | Edita os valores de saldo/renda/gasto |

## Frontend (porta 5173)

```powershell
cd frontend
pnpm install
pnpm dev
```

O Vite faz proxy de `/api` → `http://127.0.0.1:5000`, então **suba o backend antes**.
Sem backend o app mostra a tela de "não consegui falar com o servidor" com botão de retry.

## Onde inserir dados pela UI

- **Adicionar transação** — botão "adicionar" no card *Atividade recente* (Visão geral).
- **Nova meta** — botão no topo da aba *Metas*.
- **Editar perfil** — clique no avatar (canto superior direito).
