import {
  createAdminClient,
} from "@/lib/supabase/admin";

/* ======================================================
   TYPES
====================================================== */

type ChannelConnection = {
  id: string;
  property_id: string;
  channex_property_id: string | null;
  provider: string;
  environment: string | null;
  connection_status: string | null;
  active: boolean | null;
};

type ChannexCustomer = {
  meta?: unknown;
  name?: string | null;
  surname?: string | null;
  state?: string | null;
  zip?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  language?: string | null;
  mail?: string | null;
  phone?: string | null;
};

type ChannexOccupancy = {
  children?: number | null;
  adults?: number | null;
  ages?: unknown[];
  infants?: number | null;
};

type ChannexRoom = {
  meta?: unknown;
  taxes?: unknown[];
  services?: unknown[];
  amount?: string | number | null;
  days?: Record<
    string,
    string | number
  >;
  ota_commission?:
    | string
    | number
    | null;
  guests?: Array<{
    name?: string | null;
    surname?: string | null;
  }>;
  occupancy?: ChannexOccupancy;
  rate_plan_id?: string | null;
  room_type_id?: string | null;
  booking_room_id?: string | null;
  checkout_date?: string | null;
  checkin_date?: string | null;
  is_cancelled?: boolean | null;
  ota_unique_id?: string | null;
};

type ChannexBookingRevisionAttributes = {
  id?: string | null;

  meta?: {
    source?: string | null;
    [key: string]: unknown;
  } | null;

  status?: string | null;

  services?: unknown[];

  currency?: string | null;

  amount?:
    | string
    | number
    | null;

  agent?: unknown;

  unique_id?: string | null;

  inserted_at?: string | null;

  channel_id?: string | null;

  ota_reservation_code?:
    | string
    | null;

  system_id?: string | null;

  ota_name?: string | null;

  property_id?: string | null;

  rooms?: ChannexRoom[];

  booking_id?: string | null;

  arrival_date?: string | null;

  arrival_hour?: string | null;

  customer?: ChannexCustomer | null;

  departure_date?: string | null;

  deposits?: unknown[];

  notes?: string | null;

  ota_commission?:
    | string
    | number
    | null;

  payment_collect?: string | null;

  payment_type?: string | null;

  occupancy?: ChannexOccupancy | null;

  guarantee?: unknown;

  secondary_ota?: unknown;

  acknowledge_status?: string | null;

  raw_message?: string | null;

  is_crs_revision?: boolean | null;
};

type ChannexBookingRevision = {
  id?: string | null;
  type?: string | null;

  attributes?:
    ChannexBookingRevisionAttributes;

  relationships?: unknown;
};

type ChannexFeedResponse = {
  data?: ChannexBookingRevision[];
  meta?: unknown;
};

type RpcResult = {
  success?: boolean;
  already_processed?: boolean;
  already_exists?: boolean;
  revision_id?: string;
  booking_id?: string | null;
  booking_code?: string;
  guest_id?: string;
  room_count?: number;
  night_count?: number;
  status?: string;
  error?: string;
};

export type BookingRevisionItemResult = {
  revisionId: string;
  channelBookingId:
    | string
    | null;

  eventType:
    | string
    | null;

  status:
    | "processed"
    | "acknowledged"
    | "unsupported"
    | "error";

  bookingId?:
    | string
    | null;

  error?: string;
};

export type BookingRevisionWorkerResult = {
  connectionId: string;
  propertyId: string;

  fetched: number;
  processed: number;
  acknowledged: number;
  unsupported: number;
  errors: number;

  items:
    BookingRevisionItemResult[];
};

/* ======================================================
   HELPERS
====================================================== */

function asString(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
    : null;
}

function asNumber(
  value: unknown,
  fallback = 0
) {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  ) {
    return value;
  }

  if (
    typeof value ===
    "string"
  ) {
    const parsed =
      Number(value);

    if (
      Number.isFinite(
        parsed
      )
    ) {
      return parsed;
    }
  }

  return fallback;
}

function asInteger(
  value: unknown,
  fallback = 0
) {
  const numeric =
    asNumber(
      value,
      fallback
    );

  return Math.trunc(
    numeric
  );
}

function isIsoDate(
  value: unknown
): value is string {
  return (
    typeof value ===
      "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  );
}

function getBaseUrl() {
  return (
    process.env
      .CHANNEX_BASE_URL ||
    "https://staging.channex.io"
  ).replace(
    /\/+$/,
    ""
  );
}

function getApiKey() {
  const apiKey =
    process.env
      .CHANNEX_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing CHANNEX_API_KEY."
    );
  }

  return apiKey;
}

function buildHeaders() {
  return {
    Accept:
      "application/json",

    "Content-Type":
      "application/json",

    "user-api-key":
      getApiKey(),
  };
}

/**
 * IMPORTANT:
 * Do not persist the original revision object directly.
 *
 * Channex payloads can contain fields such as guarantee or
 * raw_message. This sanitizer intentionally whitelists only
 * fields needed for PMS operations/debugging and drops
 * guarantee/raw_message completely.
 */
function sanitizeRevision(
  revision:
    ChannexBookingRevision
) {
  const attributes =
    revision.attributes ??
    {};

  const customer =
    attributes.customer ??
    null;

  const occupancy =
    attributes.occupancy ??
    null;

  const rooms =
    Array.isArray(
      attributes.rooms
    )
      ? attributes.rooms.map(
          (
            room
          ) => ({
            amount:
              room.amount ??
              null,

            days:
              room.days ??
              {},

            ota_commission:
              room.ota_commission ??
              null,

            guests:
              Array.isArray(
                room.guests
              )
                ? room.guests.map(
                    (
                      guest
                    ) => ({
                      name:
                        guest.name ??
                        null,

                      surname:
                        guest.surname ??
                        null,
                    })
                  )
                : [],

            occupancy: {
              adults:
                room
                  .occupancy
                  ?.adults ??
                0,

              children:
                room
                  .occupancy
                  ?.children ??
                0,

              infants:
                room
                  .occupancy
                  ?.infants ??
                0,

              ages:
                Array.isArray(
                  room
                    .occupancy
                    ?.ages
                )
                  ? room
                      .occupancy
                      ?.ages
                  : [],
            },

            rate_plan_id:
              room.rate_plan_id ??
              null,

            room_type_id:
              room.room_type_id ??
              null,

            booking_room_id:
              room.booking_room_id ??
              null,

            checkout_date:
              room.checkout_date ??
              null,

            checkin_date:
              room.checkin_date ??
              null,

            is_cancelled:
              room.is_cancelled ??
              false,

            ota_unique_id:
              room.ota_unique_id ??
              null,
          })
        )
      : [];

  return {
    revision_id:
      revision.id ??
      attributes.id ??
      null,

    type:
      revision.type ??
      null,

    status:
      attributes.status ??
      null,

    meta: {
      source:
        attributes.meta
          ?.source ??
        null,
    },

    currency:
      attributes.currency ??
      null,

    amount:
      attributes.amount ??
      null,

    unique_id:
      attributes.unique_id ??
      null,

    inserted_at:
      attributes.inserted_at ??
      null,

    channel_id:
      attributes.channel_id ??
      null,

    ota_reservation_code:
      attributes
        .ota_reservation_code ??
      null,

    system_id:
      attributes.system_id ??
      null,

    ota_name:
      attributes.ota_name ??
      null,

    property_id:
      attributes.property_id ??
      null,

    booking_id:
      attributes.booking_id ??
      null,

    arrival_date:
      attributes.arrival_date ??
      null,

    arrival_hour:
      attributes.arrival_hour ??
      null,

    departure_date:
      attributes.departure_date ??
      null,

    notes:
      attributes.notes ??
      null,

    ota_commission:
      attributes
        .ota_commission ??
      null,

    payment_collect:
      attributes
        .payment_collect ??
      null,

    payment_type:
      attributes.payment_type ??
      null,

    occupancy: {
      adults:
        occupancy?.adults ??
        0,

      children:
        occupancy?.children ??
        0,

      infants:
        occupancy?.infants ??
        0,

      ages:
        Array.isArray(
          occupancy?.ages
        )
          ? occupancy?.ages
          : [],
    },

    customer:
      customer
        ? {
            name:
              customer.name ??
              null,

            surname:
              customer.surname ??
              null,

            state:
              customer.state ??
              null,

            zip:
              customer.zip ??
              null,

            address:
              customer.address ??
              null,

            city:
              customer.city ??
              null,

            country:
              customer.country ??
              null,

            language:
              customer.language ??
              null,

            mail:
              customer.mail ??
              null,

            phone:
              customer.phone ??
              null,
          }
        : null,

    rooms,

    acknowledge_status:
      attributes
        .acknowledge_status ??
      null,

    is_crs_revision:
      attributes
        .is_crs_revision ??
      null,

    /*
     * Deliberately omitted:
     *
     * guarantee
     * raw_message
     * agent
     * secondary_ota
     * deposits
     * services
     *
     * We can add explicitly sanitized subsets later if the PMS
     * actually needs them.
     */
  };
}

function normalizeRooms(
  rooms: unknown
) {
  if (
    !Array.isArray(
      rooms
    )
  ) {
    return [];
  }

  return rooms.map(
    (
      rawRoom
    ) => {
      const room =
        (
          rawRoom ??
          {}
        ) as ChannexRoom;

      const occupancy:
        ChannexOccupancy =
        room.occupancy ??
        {};

      return {
        amount:
          room.amount ??
          0,

        days:
          room.days ??
          {},

        occupancy: {
          adults:
            asInteger(
              occupancy.adults,
              1
            ),

          children:
            asInteger(
              occupancy.children,
              0
            ),

          infants:
            asInteger(
              occupancy.infants,
              0
            ),

          ages:
            Array.isArray(
              occupancy.ages
            )
              ? occupancy.ages
              : [],
        },

        rate_plan_id:
          room.rate_plan_id ??
          null,

        room_type_id:
          room.room_type_id ??
          null,

        booking_room_id:
          room.booking_room_id ??
          null,

        checkout_date:
          room.checkout_date ??
          null,

        checkin_date:
          room.checkin_date ??
          null,

        is_cancelled:
          room.is_cancelled ??
          false,

        ota_unique_id:
          room.ota_unique_id ??
          null,
      };
    }
  );
}

function validateSupportedRevision(
  revision:
    ChannexBookingRevision,
  expectedChannexPropertyId:
    string
) {
  const attributes =
    revision.attributes ??
    {};

  const revisionId =
    asString(
      revision.id
    ) ??
    asString(
      attributes.id
    );

  const bookingId =
    asString(
      attributes.booking_id
    );

  const propertyId =
    asString(
      attributes.property_id
    );

  const status =
    asString(
      attributes.status
    );

  if (!revisionId) {
    throw new Error(
      "CHANNEX_REVISION_ID_MISSING"
    );
  }

  if (!bookingId) {
    throw new Error(
      "CHANNEX_BOOKING_ID_MISSING"
    );
  }

  if (
    propertyId !==
    expectedChannexPropertyId
  ) {
    throw new Error(
      "CHANNEX_PROPERTY_MISMATCH"
    );
  }

  if (
    status !== "new" &&
    status !== "modified"
  ) {
    throw new Error(
      `UNSUPPORTED_BOOKING_REVISION_STATUS:${status ?? "unknown"}`
    );
  }

  if (
    !isIsoDate(
      attributes.arrival_date
    ) ||
    !isIsoDate(
      attributes.departure_date
    )
  ) {
    throw new Error(
      "INVALID_BOOKING_DATES"
    );
  }

  if (
    !Array.isArray(
      attributes.rooms
    ) ||
    attributes.rooms.length ===
      0
  ) {
    throw new Error(
      "CHANNEX_ROOMS_MISSING"
    );
  }

  for (
    const room
    of attributes.rooms
  ) {
    if (
      !room.room_type_id
    ) {
      throw new Error(
        "CHANNEX_ROOM_TYPE_ID_MISSING"
      );
    }

    if (
      !room.rate_plan_id
    ) {
      throw new Error(
        "CHANNEX_RATE_PLAN_ID_MISSING"
      );
    }

    if (
      !isIsoDate(
        room.checkin_date
      ) ||
      !isIsoDate(
        room.checkout_date
      )
    ) {
      throw new Error(
        "INVALID_CHANNEX_ROOM_DATES"
      );
    }
  }

  return {
    revisionId,
    bookingId,
    status: status as
      | "new"
      | "modified",
  };
}

async function fetchRevisionFeed(
  channexPropertyId:
    string
) {
  const baseUrl =
    getBaseUrl();

  const url =
    new URL(
      `${baseUrl}/api/v1/booking_revisions/feed`
    );

  url.searchParams.set(
    "filter[property_id]",
    channexPropertyId
  );

  url.searchParams.set(
    "order[inserted_at]",
    "asc"
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers:
          buildHeaders(),

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  let payload:
    ChannexFeedResponse =
    {};

  if (text) {
    try {
      payload =
        JSON.parse(
          text
        ) as ChannexFeedResponse;
    } catch {
      throw new Error(
        `CHANNEX_FEED_INVALID_JSON HTTP ${response.status}: ${text.slice(
          0,
          500
        )}`
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      `CHANNEX_FEED_HTTP_${response.status}: ${text.slice(
        0,
        1000
      )}`
    );
  }

  return Array.isArray(
    payload.data
  )
    ? payload.data
    : [];
}

async function acknowledgeRevision(
  revisionId:
    string
) {
  const baseUrl =
    getBaseUrl();

  const response =
    await fetch(
      `${baseUrl}/api/v1/booking_revisions/${encodeURIComponent(
        revisionId
      )}/ack`,
      {
        method:
          "POST",

        headers:
          buildHeaders(),

        cache:
          "no-store",
      }
    );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `CHANNEX_ACK_HTTP_${response.status}: ${text.slice(
        0,
        1000
      )}`
    );
  }

  return text;
}

async function markAckSuccess(
  connectionId: string,
  revisionId: string
) {
  const supabase =
    createAdminClient();

  let lastError:
    string | null =
    null;

  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    const {
      data: ledger,
      error: readError,
    } = await supabase
      .from(
        "channel_booking_revisions"
      )
      .select(
        `
          id,
          ack_attempts
        `
      )
      .eq(
        "connection_id",
        connectionId
      )
      .eq(
        "revision_id",
        revisionId
      )
      .maybeSingle();

    if (
      readError ||
      !ledger
    ) {
      lastError =
        readError
          ?.message ??
        "ACK_LEDGER_ROW_NOT_FOUND";

      continue;
    }

    const {
      error:
        updateError,
    } = await supabase
      .from(
        "channel_booking_revisions"
      )
      .update({
        ack_attempts:
          Number(
            ledger
              .ack_attempts ??
              0
          ) + 1,

        ack_last_error:
          null,

        acknowledged_at:
          new Date()
            .toISOString(),

        updated_at:
          new Date()
            .toISOString(),
      })
      .eq(
        "id",
        ledger.id
      );

    if (!updateError) {
      return;
    }

    lastError =
      updateError.message;
  }

  throw new Error(
    `ACK_SUCCEEDED_BUT_LEDGER_UPDATE_FAILED: ${lastError ?? "unknown"}`
  );
}

async function markAckFailure(
  connectionId: string,
  revisionId: string,
  message: string
) {
  const supabase =
    createAdminClient();

  const {
    data: ledger,
  } = await supabase
    .from(
      "channel_booking_revisions"
    )
    .select(
      `
        id,
        ack_attempts
      `
    )
    .eq(
      "connection_id",
      connectionId
    )
    .eq(
      "revision_id",
      revisionId
    )
    .maybeSingle();

  if (!ledger) {
    return;
  }

  await supabase
    .from(
      "channel_booking_revisions"
    )
    .update({
      ack_attempts:
        Number(
          ledger
            .ack_attempts ??
            0
        ) + 1,

      ack_last_error:
        message.slice(
          0,
          5000
        ),

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      ledger.id
    );
}

/* ======================================================
   WORKER
====================================================== */

export async function processBookingRevisionsForConnection(
  connectionId:
    string,
  batchLimit = 50
): Promise<BookingRevisionWorkerResult> {
  const supabase =
    createAdminClient();

  const {
    data:
      connectionData,

    error:
      connectionError,
  } = await supabase
    .from(
      "channel_connections"
    )
    .select(
      `
        id,
        property_id,
        channex_property_id,
        provider,
        environment,
        connection_status,
        active
      `
    )
    .eq(
      "id",
      connectionId
    )
    .maybeSingle();

  if (
    connectionError
  ) {
    throw new Error(
      connectionError.message
    );
  }

  if (
    !connectionData
  ) {
    throw new Error(
      "CHANNEL_CONNECTION_NOT_FOUND"
    );
  }

  const connection =
    connectionData as
      ChannelConnection;

  if (
    connection.provider !==
      "channex" ||
    connection.active !==
      true ||
    connection
      .connection_status !==
      "connected"
  ) {
    throw new Error(
      "CHANNEL_CONNECTION_NOT_ACTIVE"
    );
  }

  if (
    !connection
      .channex_property_id
  ) {
    throw new Error(
      "CHANNEX_PROPERTY_ID_MISSING"
    );
  }

  const result:
    BookingRevisionWorkerResult =
    {
      connectionId:
        connection.id,

      propertyId:
        connection.property_id,

      fetched:
        0,

      processed:
        0,

      acknowledged:
        0,

      unsupported:
        0,

      errors:
        0,

      items:
        [],
    };

  const feed =
    await fetchRevisionFeed(
      connection
        .channex_property_id
    );

  /*
   * Process oldest-first, sequentially.
   *
   * This is intentional. Later, modified/cancelled revisions for
   * the same booking must preserve revision order.
   */
  const revisions =
    feed.slice(
      0,
      Math.min(
        Math.max(
          batchLimit,
          1
        ),
        100
      )
    );

  result.fetched =
    revisions.length;

  for (
    const revision
    of revisions
  ) {
    const rawRevisionId =
      asString(
        revision.id
      ) ??
      asString(
        revision
          .attributes
          ?.id
      ) ??
      "unknown";

    const rawBookingId =
      asString(
        revision
          .attributes
          ?.booking_id
      );

    const rawStatus =
      asString(
        revision
          .attributes
          ?.status
      );

    try {
      const validated =
        validateSupportedRevision(
          revision,
          connection
            .channex_property_id
        );

      const attributes =
        revision.attributes ??
        {};

      const occupancy:
        ChannexOccupancy =
        attributes.occupancy ??
        {};

      const customer:
        ChannexCustomer =
        attributes.customer ??
        {};

      const sanitized =
        sanitizeRevision(
          revision
        );

      const normalizedRooms =
        normalizeRooms(
          attributes.rooms
        );

      const rpcArguments = {
        p_connection_id:
          connection.id,

        p_revision_id:
          validated.revisionId,

        p_channel_booking_id:
          validated.bookingId,

        p_channex_property_id:
          connection
            .channex_property_id,

        p_unique_id:
          attributes
            .unique_id ??
          null,

        p_ota_name:
          attributes
            .ota_name ??
          null,

        p_currency:
          attributes
            .currency ??
          "VND",

        p_amount:
          asNumber(
            attributes.amount,
            0
          ),

        p_arrival_date:
          attributes
            .arrival_date,

        p_departure_date:
          attributes
            .departure_date,

        p_adults:
          Math.max(
            asInteger(
              occupancy.adults,
              1
            ),
            1
          ),

        p_children:
          Math.max(
            asInteger(
              occupancy.children,
              0
            ),
            0
          ),

        p_customer: {
          name:
            customer.name ??
            null,

          surname:
            customer.surname ??
            null,

          phone:
            customer.phone ??
            null,

          mail:
            customer.mail ??
            null,

          country:
            customer.country ??
            null,

          address:
            customer.address ??
            null,

          city:
            customer.city ??
            null,

          state:
            customer.state ??
            null,

          zip:
            customer.zip ??
            null,

          language:
            customer.language ??
            null,
        },

        p_rooms:
          normalizedRooms,

        p_notes:
          attributes.notes ??
          null,

        p_delivery_source:
          "feed",

        p_raw_payload:
          sanitized,
      };

      let rpcData:
        unknown =
        null;

      let rpcError:
        {
          message: string;
        } | null =
        null;

      if (
        validated.status ===
        "new"
      ) {
        const response =
          await supabase.rpc(
            "ingest_channex_new_booking_revision",
            {
              ...rpcArguments,

              /*
               * No trusted payment settlement mapping yet.
               * Do not infer "paid" from Channex payment method.
               */
              p_amount_paid:
                0,
            }
          );

        rpcData =
          response.data;

        rpcError =
          response.error;
      } else {
        const response =
          await supabase.rpc(
            "ingest_channex_modified_booking_revision",
            rpcArguments
          );

        rpcData =
          response.data;

        rpcError =
          response.error;
      }

      if (
        rpcError
      ) {
        throw new Error(
          `INGEST_RPC_ERROR: ${rpcError.message}`
        );
      }

      const rpcResult =
        (
          rpcData ??
          {}
        ) as RpcResult;

      if (
        rpcResult.success !==
        true
      ) {
        throw new Error(
          `INGEST_FAILED: ${rpcResult.error ?? "unknown"}`
        );
      }

      result.processed +=
        1;

      /*
       * ACK only after PMS persistence succeeded.
       *
       * If ACK fails, the revision remains in Channex feed.
       * Next worker run is safe because the ingest RPC is
       * idempotent and will return already_processed.
       */
      try {
        await acknowledgeRevision(
          validated.revisionId
        );
      } catch (
        ackError
      ) {
        const message =
          ackError instanceof
          Error
            ? ackError.message
            : String(
                ackError
              );

        await markAckFailure(
          connection.id,
          validated.revisionId,
          message
        );

        throw ackError;
      }

      await markAckSuccess(
        connection.id,
        validated.revisionId
      );

      result.acknowledged +=
        1;

      result.items.push({
        revisionId:
          validated.revisionId,

        channelBookingId:
          validated.bookingId,

        eventType:
          validated.status,

        status:
          "acknowledged",

        bookingId:
          rpcResult.booking_id ??
          null,
      });
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        message.startsWith(
          "UNSUPPORTED_BOOKING_REVISION_STATUS:"
        )
      ) {
        /*
         * CRITICAL:
         * Never ACK unsupported revision statuses.
         *
         * NEW and MODIFIED are supported here. CANCELLED and
         * any future unknown status must remain in the feed until
         * dedicated handlers are implemented and tested.
         */
        result.unsupported +=
          1;

        result.items.push({
          revisionId:
            rawRevisionId,

          channelBookingId:
            rawBookingId,

          eventType:
            rawStatus,

          status:
            "unsupported",

          error:
            message,
        });

        continue;
      }

      result.errors +=
        1;

      result.items.push({
        revisionId:
          rawRevisionId,

        channelBookingId:
          rawBookingId,

        eventType:
          rawStatus,

        status:
          "error",

        error:
          message,
      });
    }
  }

  return result;
}
