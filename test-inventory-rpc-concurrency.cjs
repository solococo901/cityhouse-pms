const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const PROPERTY_ID =
  "786eed27-b278-4122-8f41-afebbcd69202";

const ROOM_TYPE_ID =
  "26cd011f-aa25-49bf-bfad-752c4c68fb25";

const ADMIN_ID =
  "22308f7b-4301-4349-b4e8-5e8e3c1ce234";

const STAY_DATE = "2026-10-15";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function createClient() {
  const content = fs.readFileSync(
    path.join(__dirname, ".env.test.local"),
    "utf8"
  );

  const line = content
    .split(/\r?\n/)
    .find((x) =>
      /^\s*TEST_DATABASE_URL\s*=/.test(x)
    );

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

async function rollback(client, active) {
  if (!active) return;

  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error(
      "ROLLBACK_ERROR:",
      error.message
    );
  }
}

async function main() {
  const a = createClient();
  const b = createClient();

  let txA = false;
  let txB = false;

  let rpcSettled = false;
  let rpcPromise = null;

  try {
    await Promise.all([
      a.connect(),
      b.connect(),
    ]);

    const [sessionA, sessionB] =
      await Promise.all([
        a.query("SELECT pg_backend_pid() AS pid"),
        b.query("SELECT pg_backend_pid() AS pid"),
      ]);

    if (
      sessionA.rows[0].pid ===
      sessionB.rows[0].pid
    ) {
      throw new Error(
        "TEST_FAILED: Sessions not independent"
      );
    }

    console.log("SESSIONS: PASS");

    /* ===========================================
       BASELINE
    =========================================== */

    const baseline = await a.query(
      `
      SELECT
        total_rooms,
        available_rooms,
        stop_sell
      FROM public.inventory_calendar
      WHERE property_id = $1
        AND room_type_id = $2
        AND stay_date = $3
      `,
      [
        PROPERTY_ID,
        ROOM_TYPE_ID,
        STAY_DATE,
      ]
    );

    if (
      baseline.rowCount !== 1 ||
      baseline.rows[0].total_rooms !== 4 ||
      baseline.rows[0].available_rooms !== 3 ||
      baseline.rows[0].stop_sell !== false
    ) {
      throw new Error(
        "TEST_BLOCKED: Inventory baseline changed"
      );
    }

    console.log("BASELINE: PASS");

    /* ===========================================
       TRANSACTION A: LOCK INVENTORY
    =========================================== */

    await a.query("BEGIN");
    txA = true;

    await a.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    await a.query(
      "SET LOCAL statement_timeout = '8s'"
    );

    await a.query(
      "SET LOCAL idle_in_transaction_session_timeout = '15s'"
    );

    const locked = await a.query(
      `
      SELECT id
      FROM public.inventory_calendar
      WHERE property_id = $1
        AND room_type_id = $2
        AND stay_date = $3
      FOR UPDATE
      `,
      [
        PROPERTY_ID,
        ROOM_TYPE_ID,
        STAY_DATE,
      ]
    );

    if (locked.rowCount !== 1) {
      throw new Error(
        "TEST_FAILED: Unable to lock inventory"
      );
    }

    console.log("A: INVENTORY_LOCK_ACQUIRED");

    /* ===========================================
       TRANSACTION B: ADMIN CONTEXT
    =========================================== */

    await b.query("BEGIN");
    txB = true;

    await b.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    await b.query(
      "SET LOCAL statement_timeout = '8s'"
    );

    await b.query(
      "SET LOCAL idle_in_transaction_session_timeout = '15s'"
    );

    await b.query(
      `
      SELECT
        set_config(
          'request.jwt.claim.sub',
          $1,
          true
        ),
        set_config(
          'request.jwt.claim.role',
          'authenticated',
          true
        )
      `,
      [ADMIN_ID]
    );

    const permission = await b.query(
      `
      SELECT
        public.can_manage_property($1::uuid)
          AS allowed
      `,
      [PROPERTY_ID]
    );

    if (permission.rows[0].allowed !== true) {
      throw new Error(
        "TEST_BLOCKED: Admin permission denied"
      );
    }

    console.log("B: ADMIN_PERMISSION_PASS");

    /* ===========================================
       TRANSACTION B: RPC REQUEST
    =========================================== */

    console.log(
      "B: REQUESTING_AVAILABILITY_4"
    );

    rpcPromise = b.query(
      `
      SELECT public.bulk_update_ari(
        $1::uuid,
        $2::uuid,
        NULL::uuid,
        $3::date,
        $3::date,
        ARRAY[4]::integer[],
        NULL::numeric,
        4::integer,
        NULL::integer,
        NULL::boolean
      ) AS result
      `,
      [
        PROPERTY_ID,
        ROOM_TYPE_ID,
        STAY_DATE,
      ]
    ).then(
      (result) => {
        rpcSettled = true;

        return {
          success: true,
          result,
        };
      },
      (error) => {
        rpcSettled = true;

        return {
          success: false,
          error,
        };
      }
    );

    await sleep(1000);

    if (rpcSettled) {
      throw new Error(
        "TEST_FAILED: RPC finished while row was locked"
      );
    }

    console.log("B: WAITING_FOR_A_LOCK_PASS");

    /* ===========================================
       RELEASE A
    =========================================== */

    await a.query("ROLLBACK");
    txA = false;

    console.log("A: LOCK_RELEASED");

    /* ===========================================
       VERIFY RPC REJECTION
    =========================================== */

    const outcome = await rpcPromise;

    if (outcome.success) {
      throw new Error(
        "TEST_FAILED: Unsafe RPC update accepted"
      );
    }

    const message =
      outcome.error?.message || "";

    if (
      !message.includes(
        "AVAILABILITY_EXCEEDS_SAFE_CAPACITY"
      )
    ) {
      throw new Error(
        "TEST_FAILED: Unexpected RPC error: " +
        message
      );
    }

    console.log(
      "B: SAFE_CAPACITY_REJECTION_PASS"
    );

    await b.query("ROLLBACK");
    txB = false;

    /* ===========================================
       FINAL INVENTORY VERIFICATION
    =========================================== */

    const finalResult = await a.query(
      `
      SELECT
        total_rooms,
        available_rooms,
        stop_sell
      FROM public.inventory_calendar
      WHERE property_id = $1
        AND room_type_id = $2
        AND stay_date = $3
      `,
      [
        PROPERTY_ID,
        ROOM_TYPE_ID,
        STAY_DATE,
      ]
    );

    if (
      finalResult.rowCount !== 1 ||
      finalResult.rows[0].total_rooms !== 4 ||
      finalResult.rows[0].available_rooms !== 3 ||
      finalResult.rows[0].stop_sell !== false
    ) {
      throw new Error(
        "TEST_FAILED: Final inventory changed"
      );
    }

    console.log("FINAL_INVENTORY: PASS");
    console.log("RPC_CONCURRENCY: PASS");

  } finally {
    // Settle any outstanding RPC before closing clients.
    if (rpcPromise && !rpcSettled) {
      await rollback(a, txA);
      txA = false;

      await rpcPromise.catch(() => {});
    }

    await rollback(a, txA);
    await rollback(b, txB);

    await Promise.allSettled([
      a.end(),
      b.end(),
    ]);
  }
}

main().catch((error) => {
  console.error("RPC_CONCURRENCY: FAIL");
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
