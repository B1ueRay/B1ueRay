import "dotenv/config";
import { Client } from "pg";
import { spawnSync } from "node:child_process";
if (!process.env.TEST_DATABASE_URL && process.env.DEMO_MODE !== "true")
  throw new Error(
    "Set an isolated TEST_DATABASE_URL to run integration tests outside demo mode.",
  );
const source = new URL(
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
);
if (!process.env.TEST_DATABASE_URL) source.pathname = "/velora_test";
if (!source.pathname.includes("velora_test"))
  throw new Error("The test database name must include velora_test.");
const database = source.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+$/.test(database))
  throw new Error("Invalid test database name.");
const admin = new URL(source);
admin.pathname = "/postgres";
const client = new Client({ connectionString: admin.toString() });
await client.connect();
if (
  !(
    await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [database])
  ).rowCount
)
  await client.query(`CREATE DATABASE "${database}"`);
await client.end();
const env = {
  ...process.env,
  DATABASE_URL: source.toString(),
  TEST_DATABASE_URL: source.toString(),
};
for (const args of [
  ["run", "db:migrate"],
  ["run", "db:seed"],
  ["exec", "vitest", "--", "run"],
]) {
  const result = spawnSync("npm", args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status || 1);
}
