// PostgreSQL local para desenvolvimento (PGlite em WebAssembly — nada para instalar).
//
//   node scripts/local-db.mjs              → só sobe o banco (Ctrl+C para parar)
//   node scripts/local-db.mjs <comando>    → sobe o banco, roda o comando e encerra junto
//
// Se a porta já estiver em uso (banco já rodando em outro terminal), apenas roda o comando.
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = 5433;
const DATA_DIR = "./.pgdata";
const command = process.argv.slice(2).join(" ");

const portInUse = () =>
  new Promise((resolve) => {
    const s = createConnection({ port: PORT, host: "127.0.0.1" });
    s.once("connect", () => (s.end(), resolve(true)));
    s.once("error", () => resolve(false));
  });

function run(cmd) {
  return new Promise((resolve) => {
    // shell: true é necessário no Windows para achar npm/npx/next (.cmd)
    const child = spawn(cmd, { stdio: "inherit", shell: true });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

if (await portInUse()) {
  if (!command) {
    console.log(`Já existe um banco rodando na porta ${PORT}.`);
    process.exit(0);
  }
  process.exit(await run(command));
}

const db = await PGlite.create(DATA_DIR);
const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 10 });
await server.start();
console.log(`▸ PostgreSQL (PGlite) em postgresql://postgres@127.0.0.1:${PORT}/postgres — dados em ${DATA_DIR}`);

let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  await server.stop().catch(() => {});
  await db.close().catch(() => {});
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

if (command) shutdown(await run(command));
