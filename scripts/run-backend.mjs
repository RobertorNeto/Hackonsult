// Roda só o backend (usado por `npm run dev:back`).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";
const venvPy = isWin
  ? join(root, "backend", ".venv", "Scripts", "python.exe")
  : join(root, "backend", ".venv", "bin", "python");
const python = existsSync(venvPy) ? venvPy : isWin ? "python" : "python3";

const child = spawn(python, ["app.py"], {
  cwd: join(root, "backend"),
  stdio: "inherit",
  shell: isWin,
});
child.on("exit", (c) => process.exit(c ?? 0));
