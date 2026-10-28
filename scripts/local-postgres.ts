import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

// Development-only database, bound to this computer. Data survives restarts.
const databaseDir = fileURLToPath(
  new URL("../.local-postgres", import.meta.url)
);
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port: 54329,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
});

if (!existsSync(`${databaseDir}/PG_VERSION`)) await postgres.initialise();
await postgres.start();
const client = postgres.getPgClient();
await client.connect();
try {
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    ["open_instinct"]
  );
  if (result.rowCount === 0)
    await client.query('CREATE DATABASE "open_instinct"');
} finally {
  await client.end();
}
console.log("Local PostgreSQL ready on 127.0.0.1:54329. Press Ctrl+C to stop.");
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}
process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});
