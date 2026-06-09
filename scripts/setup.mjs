// Setup único: cria o venv do backend, instala deps Python e deps do frontend.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";
const backend = join(root, "backend");
const frontend = join(root, "frontend");
const sysPython = isWin ? "python" : "python3";
const venvPy = isWin
  ? join(backend, ".venv", "Scripts", "python.exe")
  : join(backend, ".venv", "bin", "python");

function step(label, cmd, args, cwd) {
  console.log(`\n\x1b[36m[setup]\x1b[0m ${label}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: isWin });
  if (r.status !== 0) {
    console.error(`\x1b[31m[setup]\x1b[0m falhou: ${label}`);
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(venvPy)) {
  step("criando venv do backend", sysPython, ["-m", "venv", ".venv"], backend);
}
step("instalando deps Python", venvPy, ["-m", "pip", "install", "-q", "-r", "requirements.txt"], backend);
step("instalando deps do frontend", "pnpm", ["install"], frontend);

console.log("\n\x1b[32m[setup]\x1b[0m pronto. Rode `npm run dev`.");
