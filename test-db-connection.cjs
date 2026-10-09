
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

/* ======================================================
   LOAD CONNECTION CONFIG
====================================================== */

function loadDatabaseUrl() {
  const envPath = path.join(
    __dirname,
    ".env.test.local"
  );

  const content = fs.readFileSync(
    envPath,
    "utf8"
  );

  const line = content
    .split(/\r?\n/)
    .find((value) =>
      /^\s*TEST_DATABASE_URL\s*=/.test(value)
    );

  if (!line) {
    throw new Error(
      "Missing TEST_DATABASE_URL"
    );
  }

  return line
    .replace(
      /^\s*TEST_DATABASE_URL\s*=\s*/,
      ""
    )
    .trim()
    .replace(/^["']|["']$/g, "");
}

function createDatabaseClient() {
  return new Client({
    connectionString: loadDatabaseUrl(),

    ssl: {
      ca: fs.readFileSync(
        path.join(
          __dirname,
          "certs",
          "prod-ca-2021.crt"
        ),
        "utf8"
      ),
      rejectUnauthorized: true,
    },

    connectionTimeoutMillis: 10000,
  });
}

/* ======================================================
   MAIN
====================================================== */

async function main() {
  const clientA = createDatabaseClient();
  const clientB = createDatabaseClient();

  let connectedA = false;
  let connectedB = false;

  try {
    await clientA.connect();
    connectedA = true;

    await clientB.connect();
    connectedB = true;

    const [resultA, resultB] =
      await Promise.all([
        clientA.query(`
          SELECT
            pg_backend_pid() AS backend_pid,
            current_setting(
              'transaction_isolation'
            ) AS isolation_level
        `),

        clientB.query(`
          SELECT
            pg_backend_pid() AS backend_pid,
            current_setting(
              'transaction_isolation'
            ) AS isolation_level
        `),
      ]);

    const sessionA = resultA.rows[0];
    const sessionB = resultB.rows[0];

    console.table([
      {
        session: "A",
        ...sessionA,
      },
      {
        session: "B",
        ...sessionB,
      },
    ]);

    if (
      sessionA.backend_pid ===
      sessionB.backend_pid
    ) {
      throw new Error(
        "TEST_FAILED: Sessions share backend PID"
      );
    }

    console.log(
      "TWO_INDEPENDENT_SESSIONS: PASS"
    );
  } finally {
    if (connectedA) {
      await clientA.end().catch(() => {});
    }

    if (connectedB) {
      await clientB.end().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(
    "TWO_INDEPENDENT_SESSIONS: FAIL"
  );

  console.error(
    "ERROR_CODE:",
    error.code || "UNKNOWN"
  );

  console.error(
    "ERROR_MESSAGE:",
    error.message
  );

  process.exitCode = 1;
});
