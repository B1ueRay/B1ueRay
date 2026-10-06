import "dotenv/config";
import path from "node:path";
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
if (!existsSync(".next/standalone/server.js"))
  throw new Error("Run npm run build before starting production.");
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: "0.0.0.0",
    STORAGE_PATH: path.resolve(process.env.STORAGE_PATH || ".storage"),
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
