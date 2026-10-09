const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

function createClient() {
  const env = fs.readFileSync(
    path.join(__dirname, ".env.test.local"),
    "utf8"
  );

  const line = env
    .split(/\r?\n/)
    .find(x => /^\s*TEST_DATABASE_URL\s*=/.test(x));

  if (!line) {
    throw new Error("Missing TEST_DATABASE_URL");
  }

  const connectionString = line
    .replace(/^\s*TEST_DATABASE_URL\s*=\s*/, "")
    .trim()
    .replace(/^["']|["']$/g, "");

  const ca = fs.readFileSync(
    path.join(__dirname, "certs", "prod-ca-2021.crt"),
    "utf8"
  );

  return new Client({
    connectionString,
    ssl: {
      ca,
      rejectUnauthorized: true,
    },
    connectionTimeoutMillis: 10000,
  });
}

async function main() {
  const a = createClient();
  const b = createClient();

  try {
    await Promise.all([
      a.connect(),
      b.connect(),
    ]);

    const [ra, rb] = await Promise.all([
      a.query("SELECT pg_backend_pid() AS pid"),
      b.query("SELECT pg_backend_pid() AS pid"),
    ]);

    const pidA = ra.rows[0].pid;
    const pidB = rb.rows[0].pid;

    console.table([
      { session: "A", backend_pid: pidA },
      { session: "B", backend_pid: pidB },
    ]);

    if (pidA === pidB) {
      throw new Error(
        "TEST_FAILED: Sessions share the same backend PID"
      );
    }

    console.log("TWO_INDEPENDENT_SESSIONS: PASS");
  } finally {
    await Promise.allSettled([
      a.end(),
      b.end(),
    ]);
  }
}

main().catch(err => {
  console.error("TWO_INDEPENDENT_SESSIONS: FAIL");
  console.error("ERROR_CODE:", err.code || "UNKNOWN");
  console.error("ERROR_MESSAGE:", err.message);
  process.exitCode = 1;
});
