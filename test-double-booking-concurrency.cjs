const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const PROPERTY_ID =
  "786eed27-b278-4122-8f41-afebbcd69202";

const ROOM_ID =
  "a70307a8-2a27-42b2-9717-2516efbd9e64";

const ROOM_TYPE_ID =
  "26cd011f-aa25-49bf-bfad-752c4c68fb25";

const RATE_PLAN_ID =
  "03516f8e-7cbf-42a2-bcec-e7337a1cb8a8";

const ADMIN_ID =
  "22308f7b-4301-4349-b4e8-5e8e3c1ce234";

const CHECK_IN = "2026-10-19";
const CHECK_OUT = "2026-10-20";

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

/* ======================================================
   DATABASE CONNECTION
====================================================== */

function createClient() {
  const env = fs.readFileSync(
    path.join(__dirname, ".env.test.local"),
    "utf8"
  );

  const line = env
    .split(/\r?\n/)
    .find(x =>
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
    path.join(
      __dirname,
      "certs",
      "prod-ca-2021.crt"
    ),
    "utf8"
  );

  return new Client({
    connectionString,
    ssl: {
      ca,
      rejectUnauthorized: true,
    },
    connectionTimeoutMillis: 10000,
    query_timeout: 12000,
  });
}

/* ======================================================
   TRANSACTION HELPERS
====================================================== */

async function beginAdminTransaction(client) {
  await client.query("BEGIN");

  await client.query(`
    SET LOCAL lock_timeout = '7s'
  `);

  await client.query(`
    SET LOCAL statement_timeout = '10s'
  `);

  await client.query(`
    SET LOCAL idle_in_transaction_session_timeout = '20s'
  `);

  await client.query(
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

  const permission = await client.query(
    `
    SELECT public.can_operate_property(
      $1::uuid
    ) AS allowed
    `,
    [PROPERTY_ID]
  );

  if (permission.rows[0]?.allowed !== true) {
    throw new Error("PERMISSION_DENIED");
  }
}

/* ======================================================
   CREATE MANUAL BOOKING
   13 ARG OVERLOAD
====================================================== */

async function createBooking(client, label) {
  const result = await client.query(
    `
    SELECT public.create_manual_booking(
      $1::uuid,
      $2::uuid,
      $3::date,
      $4::date,
      $5::text,
      $6::text,
      $7::text,
      $8::text,
      $9::integer,
      $10::integer,
      $11::numeric,
      $12::text,
      $13::uuid
    ) AS result
    `,
    [
      PROPERTY_ID,
      ROOM_ID,
      CHECK_IN,
      CHECK_OUT,
      "Concurrency",
      label,
      "",
      "",
      1,
      0,
      0,
      "ROLLBACK ONLY CONCURRENCY TEST",
      RATE_PLAN_ID,
    ]
  );

  const booking = result.rows[0]?.result;

  if (!booking || booking.success !== true) {
    throw new Error(
      `${label}: BOOKING_RPC_FAILED`
    );
  }

  if (!booking.booking_id) {
    throw new Error(
      `${label}: MISSING_BOOKING_ID`
    );
  }

  return booking;
}

/* ======================================================
   INVENTORY READ
====================================================== */

async function readInventory(client) {
  const result = await client.query(
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
      CHECK_IN,
    ]
  );

  if (result.rowCount !== 1) {
    throw new Error("INVENTORY_ROW_NOT_FOUND");
  }

  return result.rows[0];
}

/* ======================================================
   MAIN
====================================================== */

async function main() {
  const a = createClient();
  const b = createClient();

  let txA = false;
  let txB = false;
  let bPromise = null;
  let bSettled = false;

  let bookingAId = null;
  let bookingBId = null;

  try {
    await Promise.all([
      a.connect(),
      b.connect(),
    ]);

    /* ==============================================
       VERIFY INDEPENDENT SESSIONS
    ============================================== */

    const [ra, rb] = await Promise.all([
      a.query("SELECT pg_backend_pid() AS pid"),
      b.query("SELECT pg_backend_pid() AS pid"),
    ]);

    if (ra.rows[0].pid === rb.rows[0].pid) {
      throw new Error("SESSIONS_NOT_INDEPENDENT");
    }

    console.log("SESSIONS: PASS");

    /* ==============================================
       BASELINE
    ============================================== */

    const baseline = await readInventory(a);

    if (
      baseline.total_rooms !== 4 ||
      baseline.available_rooms !== 4 ||
      baseline.stop_sell !== false
    ) {
      throw new Error("BASELINE_CHANGED");
    }

    const roomCheck = await a.query(
      `
      SELECT
        r.active,
        EXISTS (
          SELECT 1
          FROM public.booking_rooms br
          JOIN public.bookings bk
            ON bk.id = br.booking_id
          WHERE br.room_id = r.id
            AND bk.status NOT IN (
              'cancelled',
              'no_show',
              'checked_out'
            )
            AND daterange(
              br.check_in,
              br.check_out,
              '[)'
            ) && daterange(
              $2::date,
              $3::date,
              '[)'
            )
        ) AS occupied,
        EXISTS (
          SELECT 1
          FROM public.room_blocks block
          WHERE block.room_id = r.id
            AND block.status = 'active'
            AND daterange(
              block.start_date,
              block.end_date,
              '[)'
            ) && daterange(
              $2::date,
              $3::date,
              '[)'
            )
        ) AS blocked
      FROM public.rooms r
      WHERE r.id = $1
        AND r.property_id = $4
        AND r.room_type_id = $5
      `,
      [
        ROOM_ID,
        CHECK_IN,
        CHECK_OUT,
        PROPERTY_ID,
        ROOM_TYPE_ID,
      ]
    );

    if (
      roomCheck.rowCount !== 1 ||
      roomCheck.rows[0].active !== true ||
      roomCheck.rows[0].occupied !== false ||
      roomCheck.rows[0].blocked !== false
    ) {
      throw new Error("ROOM_BASELINE_CHANGED");
    }

    console.log("BASELINE: PASS");

    /* ==============================================
       TRANSACTION A
    ============================================== */

    txA = true;
    await beginAdminTransaction(a);

    console.log("A: ADMIN_PERMISSION_PASS");

    const bookingA = await createBooking(
      a,
      "TestA"
    );

    bookingAId = bookingA.booking_id;

    console.log("A: BOOKING_CREATED_UNCOMMITTED");

    const inventoryA = await readInventory(a);

    if (inventoryA.available_rooms !== 3) {
      throw new Error(
        "A_INVENTORY_DECREMENT_FAILED"
      );
    }

    console.log("A: INVENTORY_4_TO_3_PASS");

    /* ==============================================
       TRANSACTION B
    ============================================== */

    txB = true;
    await beginAdminTransaction(b);

    console.log("B: ADMIN_PERMISSION_PASS");

    bPromise = createBooking(b, "TestB").then(
      result => {
        bSettled = true;
        return {
          ok: true,
          result,
        };
      },
      error => {
        bSettled = true;
        return {
          ok: false,
          error,
        };
      }
    );

    console.log("B: BOOKING_REQUEST_STARTED");

    await sleep(1000);

    if (bSettled) {
      throw new Error(
        "B_FINISHED_WHILE_A_HELD_ROOM_LOCK"
      );
    }

    console.log("B: WAITING_FOR_ROOM_LOCK_PASS");

    /* ==============================================
       ROLLBACK TRANSACTION A
    ============================================== */

    await a.query("ROLLBACK");
    txA = false;

    console.log("A: ROLLBACK_PASS");

    /* ==============================================
       TRANSACTION B CONTINUES
    ============================================== */

    const outcome = await bPromise;

    if (!outcome.ok) {
      throw new Error(
        "B_UNEXPECTED_ERROR: " +
        outcome.error.message
      );
    }

    bookingBId = outcome.result.booking_id;

    if (bookingAId === bookingBId) {
      throw new Error("DUPLICATE_BOOKING_ID");
    }

    console.log(
      "B: BOOKING_CREATED_AFTER_A_ROLLBACK"
    );

    const inventoryB = await readInventory(b);

    if (inventoryB.available_rooms !== 3) {
      throw new Error(
        "B_INVENTORY_DECREMENT_FAILED"
      );
    }

    console.log("B: INVENTORY_4_TO_3_PASS");

    /* ==============================================
       ROLLBACK TRANSACTION B
    ============================================== */

    await b.query("ROLLBACK");
    txB = false;

    console.log("B: ROLLBACK_PASS");

    /* ==============================================
       VERIFY FINAL INVENTORY
    ============================================== */

    const finalInventory = await readInventory(a);

    if (
      finalInventory.total_rooms !== 4 ||
      finalInventory.available_rooms !== 4 ||
      finalInventory.stop_sell !== false
    ) {
      throw new Error(
        "FINAL_INVENTORY_CHANGED"
      );
    }

    console.log("FINAL_INVENTORY: PASS");

    /* ==============================================
       VERIFY NO TEST BOOKINGS PERSISTED
    ============================================== */

    const leftovers = await a.query(
      `
      SELECT count(*)::integer AS count
      FROM public.bookings
      WHERE id = ANY($1::uuid[])
      `,
      [[bookingAId, bookingBId]]
    );

    if (leftovers.rows[0].count !== 0) {
      throw new Error(
        "TEST_BOOKINGS_NOT_ROLLED_BACK"
      );
    }

    console.log("BOOKING_CLEANUP: PASS");

    console.log(
      "MANUAL_BOOKING_CONCURRENCY: PASS"
    );

  } finally {
    // Release A first so a waiting B can complete.
    if (txA) {
      await a.query("ROLLBACK").catch(() => {});
      txA = false;
    }

    if (bPromise && !bSettled) {
      await bPromise.catch(() => {});
    }

    if (txB) {
      await b.query("ROLLBACK").catch(() => {});
      txB = false;
    }

    await Promise.allSettled([
      a.end(),
      b.end(),
    ]);
  }
}

main().catch(error => {
  console.error(
    "MANUAL_BOOKING_CONCURRENCY: FAIL"
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
