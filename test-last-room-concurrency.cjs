const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const PROPERTY = "6882515a-46cb-4d3d-8685-436035ca5493";
const ROOM_TYPE = "7e060128-7b02-4ea6-982f-79afce93db12";
const RATE_PLAN = "649f71dd-130b-482f-9eb0-29581cd6a8f9";
const ROOM_A = "f44bfb54-21fc-4160-aa5e-e8ba6f266d38";
const ROOM_B = "edee5bc0-ff1a-41d8-96f8-455912e7795f";
const ADMIN = "22308f7b-4301-4349-b4e8-5e8e3c1ce234";
const DATE = "2026-10-19";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function assert(value, message) {
  if (!value) throw new Error(message);
}

function makeClient() {
  assert(process.env.TEST_DATABASE_URL, "Missing TEST_DATABASE_URL");

  return new Client({
    connectionString: process.env.TEST_DATABASE_URL,
    ssl: {
      ca: fs.readFileSync(
        path.join(process.cwd(), "certs", "prod-ca-2021.crt"),
        "utf8"
      ),
      rejectUnauthorized: true
    },
    query_timeout: 25000
  });
}

async function beginAdmin(client) {
  await client.query("BEGIN");
  await client.query(`
    SET LOCAL lock_timeout = '15s';
    SET LOCAL statement_timeout = '20s';
    SET LOCAL idle_in_transaction_session_timeout = '30s';
  `);

  await client.query(
    "SELECT set_config('request.jwt.claim.sub', $1, true)",
    [ADMIN]
  );

  await client.query(
    "SELECT set_config('request.jwt.claim.role', 'authenticated', true)"
  );

  const permission = await client.query(
    "SELECT public.can_operate_property($1::uuid) AS allowed",
    [PROPERTY]
  );

  assert(permission.rows[0].allowed === true, "ADMIN_PERMISSION_DENIED");
}

async function inventory(client) {
  const result = await client.query(`
    SELECT available_rooms, total_rooms, stop_sell
    FROM public.inventory_calendar
    WHERE property_id = $1::uuid
      AND room_type_id = $2::uuid
      AND stay_date = $3::date
  `, [PROPERTY, ROOM_TYPE, DATE]);

  assert(result.rowCount === 1, "INVENTORY_ROW_MISSING");
  return result.rows[0];
}

async function book(client, roomId, suffix) {
  const result = await client.query(`
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
  `, [
    PROPERTY,
    roomId,
    "2026-10-19",
    "2026-10-20",
    "Concurrency",
    suffix,
    null,
    null,
    1,
    0,
    500000,
    "PMS_CONCURRENCY_TEST_LAST_ROOM",
    RATE_PLAN
  ]);

  const value = result.rows[0]?.result;
  assert(value != null, `${suffix}_BOOKING_RESULT_EMPTY`);

  const parsed = typeof value === "string" ? JSON.parse(value) : value;

  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed.success === false || parsed.error)
  ) {
    throw new Error(
      `${suffix}_BOOKING_REJECTED: ${JSON.stringify(parsed)}`
    );
  }

  return parsed;
}

async function main() {
  const a = makeClient();
  const b = makeClient();

  let aTx = false;
  let bTx = false;
  let aCommitted = false;
  let bPromise = null;

  try {
    await Promise.all([a.connect(), b.connect()]);
    console.log("SESSIONS: PASS");

    const base = await inventory(a);

    assert(Number(base.total_rooms) === 2, "BASE_TOTAL_NOT_2");
    assert(Number(base.available_rooms) === 1, "BASE_AVAILABLE_NOT_1");
    assert(base.stop_sell === false, "BASE_STOP_SELL");
    console.log("BASELINE_INVENTORY_1_OF_2: PASS");

    const rooms = await a.query(`
      SELECT id, room_number, active, status
      FROM public.rooms
      WHERE property_id = $1::uuid
        AND room_type_id = $2::uuid
        AND id = ANY($3::uuid[])
      ORDER BY room_number
    `, [PROPERTY, ROOM_TYPE, [ROOM_A, ROOM_B]]);

    assert(rooms.rowCount === 2, "TEST_ROOMS_MISSING");
    assert(
      rooms.rows.every(r => r.active && r.status === "available"),
      "TEST_ROOMS_NOT_AVAILABLE"
    );

    console.log("PHYSICAL_ROOMS: PASS");

    const connections = await a.query(`
      SELECT COUNT(*)::integer AS count
      FROM public.channel_connections
      WHERE property_id = $1::uuid
    `, [PROPERTY]);

    assert(connections.rows[0].count === 0, "TEST_HAS_CHANNEL_CONNECTION");
    console.log("CHANNEL_ISOLATION: PASS");

    const existing = await a.query(`
      SELECT COUNT(*)::integer AS count
      FROM public.booking_rooms br
      JOIN public.bookings bk ON bk.id = br.booking_id
      WHERE br.room_id = ANY($1::uuid[])
        AND bk.status IN ('confirmed', 'checked_in')
        AND bk.check_in < $2::date
        AND bk.check_out > $3::date
    `, [[ROOM_A, ROOM_B], "2026-10-20", DATE]);

    assert(existing.rows[0].count === 0, "EXISTING_ACTIVE_BOOKING");
    console.log("BOOKING_BASELINE: PASS");

    await beginAdmin(a);
    aTx = true;
    console.log("A: ADMIN_PERMISSION_PASS");

    await book(a, ROOM_A, "SessionA");
    console.log("A: BOOKING_CREATED_UNCOMMITTED");

    const afterA = await inventory(a);
    assert(Number(afterA.available_rooms) === 0, "A_DID_NOT_CONSUME_LAST_ROOM");
    console.log("A: INVENTORY_1_TO_0_PASS");

    await beginAdmin(b);
    bTx = true;
    console.log("B: ADMIN_PERMISSION_PASS");

    let bSettled = false;

    bPromise = book(b, ROOM_B, "SessionB")
      .then(value => {
        bSettled = true;
        return { success: true, value };
      })
      .catch(error => {
        bSettled = true;
        return {
          success: false,
          error: error.message,
          code: error.code || null
        };
      });

    console.log("B: BOOKING_REQUEST_STARTED");

    await sleep(1000);

    assert(!bSettled, "B_DID_NOT_WAIT_FOR_INVENTORY_LOCK");
    console.log("B: WAITING_FOR_INVENTORY_LOCK_PASS");

    await a.query("COMMIT");
    aTx = false;
    aCommitted = true;
    console.log("A: COMMIT_PASS");

    const bResult = await bPromise;

    if (bResult.success) {
      console.log("B: UNEXPECTED_BOOKING_SUCCESS");
      throw new Error("OVERBOOKING_RISK_SECOND_BOOKING_SUCCEEDED");
    }

    console.log("B: BOOKING_REJECTED");
    console.log("B_ERROR_CODE:", bResult.code || "N/A");
    console.log("B_ERROR_MESSAGE:", bResult.error);

    const inventoryError = /inventory|availability|available|no.room|not.enough|insufficient|hết.phòng|không.còn.phòng|không.đủ.phòng/i;
    assert(
      inventoryError.test(bResult.error),
      "B_REJECTED_BUT_NOT_CONFIRMED_INVENTORY_ERROR"
    );

    console.log("B: INVENTORY_REJECTION_PASS");

    await b.query("ROLLBACK");
    bTx = false;
    console.log("B: ROLLBACK_PASS");

    const finalInventory = await inventory(a);
    assert(Number(finalInventory.available_rooms) === 0, "FINAL_INVENTORY_NOT_0");
    assert(Number(finalInventory.total_rooms) === 2, "FINAL_TOTAL_CHANGED");
    console.log("FINAL_INVENTORY_0_OF_2: PASS");

    const finalBookings = await a.query(`
      SELECT
        r.room_number,
        bk.id AS booking_id,
        bk.status
      FROM public.booking_rooms br
      JOIN public.bookings bk ON bk.id = br.booking_id
      JOIN public.rooms r ON r.id = br.room_id
      WHERE br.room_id = ANY($1::uuid[])
        AND bk.status IN ('confirmed', 'checked_in')
        AND bk.check_in < $2::date
        AND bk.check_out > $3::date
      ORDER BY r.room_number
    `, [[ROOM_A, ROOM_B], "2026-10-20", DATE]);

    assert(finalBookings.rowCount === 1, "FINAL_BOOKING_COUNT_NOT_1");
    assert(
      finalBookings.rows[0].room_number === "TEST-101",
      "WRONG_BOOKING_PERSISTED"
    );

    console.log("FINAL_BOOKING_COUNT_1: PASS");
    console.log("FINAL_BOOKING_ROOM:", finalBookings.rows[0].room_number);
    console.log("FINAL_BOOKING_ID:", finalBookings.rows[0].booking_id);
    console.log("OVERBOOKING_PREVENTION: PASS");
    console.log("LAST_ROOM_CONCURRENCY: PASS");

  } catch (error) {
    console.error("LAST_ROOM_CONCURRENCY: FAIL");
    console.error("ERROR:", error.message);

    if (aCommitted) {
      console.error("ATTENTION: Booking A was committed. Do not rerun before inspection.");
    }

    process.exitCode = 1;

  } finally {
    if (aTx) await a.query("ROLLBACK").catch(() => {});
    if (bPromise) await bPromise.catch(() => {});
    if (bTx) await b.query("ROLLBACK").catch(() => {});

    await Promise.all([
      a.end().catch(() => {}),
      b.end().catch(() => {})
    ]);
  }
}

main().catch(error => {
  console.error("FATAL:", error.message);
  process.exitCode = 1;
});
