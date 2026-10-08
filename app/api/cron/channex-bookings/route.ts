import {
  NextResponse,
} from "next/server";

import {
  processBookingRevisionsForConnection,
} from "@/lib/channex/process-booking-revisions-server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

/* ======================================================
   AUTH
====================================================== */

function isAuthorized(
  request: Request
) {
  const cronSecret =
    process.env
      .CRON_SECRET;

  if (
    !cronSecret
  ) {
    return false;
  }

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    authorization ===
    `Bearer ${cronSecret}`
  ) {
    return true;
  }

  const headerSecret =
    request.headers.get(
      "x-cron-secret"
    );

  return (
    headerSecret ===
    cronSecret
  );
}

/* ======================================================
   HANDLER
====================================================== */

async function run(
  request: Request
) {
  try {
    /* ==================================================
       SECURITY
    ================================================== */

    if (
      !isAuthorized(
        request
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const supabase =
      createAdminClient();

    /* ==================================================
       ENVIRONMENT
    ================================================== */

    const baseUrl =
      (
        process.env
          .CHANNEX_BASE_URL ||
        "https://staging.channex.io"
      ).replace(
        /\/+$/,
        ""
      );

    const environment =
      baseUrl.includes(
        "staging"
      )
        ? "staging"
        : "production";

    /* ==================================================
       ACTIVE CHANNEX CONNECTIONS
    ================================================== */

    const {
      data:
        connections,

      error:
        connectionError,
    } =
      await supabase
        .from(
          "channel_connections"
        )
        .select(`
          id,
          property_id,
          channex_property_id
        `)
        .eq(
          "provider",
          "channex"
        )
        .eq(
          "environment",
          environment
        )
        .eq(
          "connection_status",
          "connected"
        )
        .eq(
          "active",
          true
        );

    if (
      connectionError
    ) {
      return NextResponse.json(
        {
          success:
            false,

          environment,

          error:
            connectionError.message,
        },
        {
          status: 500,
        }
      );
    }

    /* ==================================================
       NO CONNECTIONS
    ================================================== */

    if (
      !connections ||
      connections.length ===
        0
    ) {
      return NextResponse.json({
        success:
          true,

        environment,

        connections:
          0,

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

        results:
          [],

        connectionErrors:
          [],

        message:
          "Không có Channex connection đang connected.",
      });
    }

    /* ==================================================
       PROCESS CONNECTIONS

       Chạy tuần tự:
       - tránh spam Channex
       - giữ thứ tự booking revisions
       - dễ kiểm soát modified/cancelled sau này
    ================================================== */

    const results:
      Awaited<
        ReturnType<
          typeof processBookingRevisionsForConnection
        >
      >[] = [];

    const connectionErrors: {
      connectionId:
        string;

      propertyId:
        string | null;

      error:
        string;
    }[] = [];

    for (
      const connection of
        connections
    ) {
      try {
        const result =
          await processBookingRevisionsForConnection(
            connection.id,
            50
          );

        results.push(
          result
        );
      } catch (
        error
      ) {
        const message =
          error instanceof
          Error
            ? error.message
            : String(
                error
              );

        console.error(
          `Channex Booking Cron ${connection.id}:`,
          error
        );

        connectionErrors.push({
          connectionId:
            connection.id,

          propertyId:
            connection.property_id ??
            null,

          error:
            message,
        });
      }
    }

    /* ==================================================
       SUMMARY
    ================================================== */

    const fetched =
      results.reduce(
        (
          total,
          item
        ) =>
          total +
          item.fetched,
        0
      );

    const processed =
      results.reduce(
        (
          total,
          item
        ) =>
          total +
          item.processed,
        0
      );

    const acknowledged =
      results.reduce(
        (
          total,
          item
        ) =>
          total +
          item.acknowledged,
        0
      );

    const unsupported =
      results.reduce(
        (
          total,
          item
        ) =>
          total +
          item.unsupported,
        0
      );

    const workerErrors =
      results.reduce(
        (
          total,
          item
        ) =>
          total +
          item.errors,
        0
      );

    const errors =
      workerErrors +
      connectionErrors.length;

    /* ==================================================
       RESPONSE
    ================================================== */

    return NextResponse.json({
      success:
        errors ===
          0 &&
        unsupported ===
          0,

      environment,

      connections:
        connections.length,

      fetched,

      processed,

      acknowledged,

      unsupported,

      errors,

      results,

      connectionErrors,
    });
  } catch (
    error
  ) {
    console.error(
      "Channex Booking Cron:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof
          Error
            ? error.message
            : "Channex Booking Cron failed.",
      },
      {
        status: 500,
      }
    );
  }
}

/* ======================================================
   GET / POST
====================================================== */

export async function GET(
  request: Request
) {
  return run(
    request
  );
}

export async function POST(
  request: Request
) {
  return run(
    request
  );
}