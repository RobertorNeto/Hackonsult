// Sobe backend (Flask) + frontend (Vite) juntos, com saída prefixada.
// Sem dependências externas — só Node. Ctrl+C derruba os dois.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";

// python do venv, com fallback pro python do sistema
const venvPy = isWin
  ? join(root, "backend", ".venv", "Scripts", "python.exe")
  : join(root, "backend", ".venv", "bin", "python");
const python = existsSync(venvPy) ? venvPy : isWin ? "python" : "python3";

if (!existsSync(venvPy)) {
  console.log("\x1b[33m[pulso]\x1b[0m venv não encontrado — usando python do sistema. Rode `npm run setup` p/ criar o venv.");
}

const procs = [];

function run(name, command, args, cwd, color) {
  const child = spawn(command, args, { cwd, shell: isWin, env: process.env });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, isErr) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const l of lines) (isErr ? process.stderr : process.stdout).write(tag + l + "\n");
    });
  };
  pipe(child.stdout, false);
  pipe(child.stderr, true);
  child.on("exit", (code) => {
    process.stdout.write(tag + `saiu (código ${code})\n`);
    shutdown();
  });
  procs.push(child);
  return child;
}

let down = false;
function shutdown() {
  if (down) return;
  down = true;
  for (const p of procs) {
    if (p.exitCode !== null) continue;
    if (isWin) {
      // mata a árvore (shell + filhos: vite/python)
      spawn("taskkill", ["/pid", String(p.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      p.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(0), 400);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("\x1b[36m[pulso]\x1b[0m subindo backend (:5001) + frontend (:5173). Ctrl+C para parar.\n");

// backend primeiro (frontend faz proxy /api -> :5000)
run("back", python, ["app.py"], join(root, "backend"), "35");
run("front", "pnpm", ["dev"], join(root, "frontend"), "32");
