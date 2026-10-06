import {
  NextResponse,
} from "next/server";

import {
  processAriQueueForProperty,
} from "@/lib/channex/process-ari-queue-server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

/* ======================================================
   CONFIG
====================================================== */

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

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
       ACTIVE CONNECTIONS
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
          property_id
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
          error:
            connectionError.message,
        },
        {
          status: 500,
        }
      );
    }

    /* ==================================================
       UNIQUE PROPERTY IDS
    ================================================== */

    const propertyIds =
      Array.from(
        new Set(
          (
            connections ??
            []
          )
            .map(
              (
                item
              ) =>
                item.property_id
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(
                  value
                )
            )
        )
      );

    if (
      propertyIds.length ===
      0
    ) {
      return NextResponse.json({
        success:
          true,

        environment,

        properties:
          0,

        processed:
          0,

        message:
          "Không có Channex Property đang connected.",
      });
    }

    /* ==================================================
       PROCESS EACH PROPERTY

       Chạy tuần tự để không spam Channex.
    ================================================== */

    const results = [];

    for (
      const propertyId of
        propertyIds
    ) {
      const result =
        await processAriQueueForProperty(
          propertyId,
          100
        );

      results.push(
        result
      );
    }

    /* ==================================================
       SUMMARY
    ================================================== */

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

    const availability =
      results.reduce(
        (
          total,
          item
        ) =>
          total +
          item.availability,
        0
      );

    const restrictions =
      results.reduce(
        (
          total,
          item
        ) =>
          total +
          item.restrictions,
        0
      );

    const errors =
      results.filter(
        (
          item
        ) =>
          item.status ===
          "error"
      );

    return NextResponse.json({
      success:
        errors.length ===
        0,

      environment,

      properties:
        propertyIds.length,

      processed,

      availability,

      restrictions,

      errors:
        errors.length,

      results,
    });
  } catch (
    error
  ) {
    console.error(
      "Channex ARI Cron:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Channex ARI Cron failed.",
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