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
    query_timeout: 10000,
  });
}

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

const lockSql = `
  SELECT id
  FROM public.inventory_calendar
  WHERE property_id = $1
    AND room_type_id = $2
    AND stay_date = $3
  FOR UPDATE
`;

const params = [
  "786eed27-b278-4122-8f41-afebbcd69202",
  "26cd011f-aa25-49bf-bfad-752c4c68fb25",
  "2026-10-15",
];

async function main() {
  const a = createClient();
  const b = createClient();

  let transactionA = false;
  let transactionB = false;

  try {
    await Promise.all([a.connect(), b.connect()]);

    await a.query("BEGIN");
    transactionA = true;

    await a.query("SET LOCAL lock_timeout = '5s'");
    await a.query("SET LOCAL statement_timeout = '8s'");

    const locked = await a.query(lockSql, params);

    if (locked.rowCount !== 1) {
      throw new Error("TEST_FAILED: Inventory row not found");
    }

    console.log("A: ROW_LOCK_ACQUIRED");

    await b.query("BEGIN");
    transactionB = true;

    await b.query("SET LOCAL lock_timeout = '5s'");
    await b.query("SET LOCAL statement_timeout = '8s'");

    console.log("B: REQUESTING_SAME_ROW_LOCK");

    let bFinished = false;

    const bLockPromise = b.query(lockSql, params)
      .then(result => {
        bFinished = true;
        return result;
      });

    await sleep(1000);

    if (bFinished) {
      throw new Error(
        "TEST_FAILED: B acquired lock while A held it"
      );
    }

    console.log("B: BLOCKED_AS_EXPECTED");

    await a.query("ROLLBACK");
    transactionA = false;

    console.log("A: ROLLBACK_LOCK_RELEASED");

    const bResult = await bLockPromise;

    if (bResult.rowCount !== 1) {
      throw new Error("TEST_FAILED: B did not acquire row");
    }

    console.log("B: ROW_LOCK_ACQUIRED_AFTER_A_RELEASE");

    await b.query("ROLLBACK");
    transactionB = false;

    console.log("ROW_LOCK_CONCURRENCY: PASS");
  } finally {
    if (transactionA) {
      await a.query("ROLLBACK").catch(() => {});
    }

    if (transactionB) {
      await b.query("ROLLBACK").catch(() => {});
    }

    await Promise.allSettled([
      a.end(),
      b.end(),
    ]);
  }
}

main().catch(error => {
  console.error("ROW_LOCK_CONCURRENCY: FAIL");
  console.error("ERROR_CODE:", error.code || "UNKNOWN");
  console.error("ERROR_MESSAGE:", error.message);
  process.exitCode = 1;
});
