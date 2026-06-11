"""Migração única: pulso.db (single-tenant) -> multi-tenant por arquivo.

- pulso_auth.db (central): copia accounts + sessions; cria oauth_flows.
- data/acct_<id>.db: o banco financeiro de cada conta.
  A conta DONA dos dados atuais (rbcorreaneto@gmail.com) recebe uma cópia
  integral do pulso.db (transações reais + bank_connection + tudo).
Rodar uma vez:  python _migrate_multitenant.py
"""
import os
import shutil
import sqlite3

import auth
from db import AUTH_DB, DATA_DIR, account_db_path

BASE = os.path.dirname(__file__)
SRC = os.path.join(BASE, "pulso.db")
OWNER_EMAIL = "rbcorreaneto@gmail.com"


def main():
    if not os.path.exists(SRC):
        print("pulso.db não encontrado, nada a migrar.")
        return
    os.makedirs(DATA_DIR, exist_ok=True)

    src = sqlite3.connect(SRC)
    src.row_factory = sqlite3.Row

    # 1. banco central de auth
    ac = sqlite3.connect(AUTH_DB)
    auth._ensure(ac)
    accounts = src.execute("SELECT * FROM accounts").fetchall()
    for r in accounts:
        ac.execute(
            "INSERT OR REPLACE INTO accounts (id, name, email, password_hash, created_at) VALUES (?,?,?,?,?)",
            (r["id"], r["name"], r["email"], r["password_hash"], r["created_at"]),
        )
    for r in src.execute("SELECT * FROM sessions").fetchall():
        ac.execute("INSERT OR REPLACE INTO sessions VALUES (?,?,?)",
                   (r["token"], r["account_id"], r["created_at"]))
    ac.commit()
    ac.close()
    print(f"central: {len(accounts)} contas migradas para {AUTH_DB}")

    # 2. conta dona recebe os dados atuais
    owner = next((r for r in accounts if r["email"] == OWNER_EMAIL), None)
    if not owner:
        print(f"AVISO: conta {OWNER_EMAIL} não encontrada; dados atuais não associados.")
    else:
        dest = account_db_path(owner["id"])
        shutil.copyfile(SRC, dest)
        print(f"dados atuais -> conta id={owner['id']} ({OWNER_EMAIL}) em {dest}")

    src.close()
    print("migração concluída.")


if __name__ == "__main__":
    main()
