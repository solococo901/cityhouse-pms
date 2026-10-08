import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

/* ======================================================
   GET
====================================================== */

export async function GET(
  request: Request
) {
  /*
   * IMPORTANT:
   *
   * createClient() gọi cookies().
   *
   * Với Next.js 16 + cacheComponents,
   * cookies() có thể throw tín hiệu nội bộ để
   * Next dừng prerender và chuyển route sang request-time.
   *
   * Vì vậy KHÔNG đặt createClient() bên trong try/catch.
   */
  const supabase =
    await createClient();

  try {
    /* ==================================================
       AUTH
    ================================================== */

    const {
      data: {
        user,
      },
      error:
        authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
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

    /* ==================================================
       QUERY
    ================================================== */

    const url =
      new URL(
        request.url
      );

    const propertyId =
      url.searchParams.get(
        "propertyId"
      );

    const rawLimit =
      Number(
        url.searchParams.get(
          "limit"
        ) ??
        20
      );

    const limit =
      Math.min(
        50,
        Math.max(
          1,
          Number.isFinite(
            rawLimit
          )
            ? rawLimit
            : 20
        )
      );

    if (
      !propertyId
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu propertyId.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       PERMISSION
    ================================================== */

    const {
      data:
        canAccess,
      error:
        permissionError,
    } =
      await supabase.rpc(
        "can_access_property",
        {
          target_property_id:
            propertyId,
        }
      );

    if (
      permissionError ||
      !canAccess
    ) {
      return NextResponse.json(
        {
          error:
            "Không có quyền truy cập property.",
        },
        {
          status: 403,
        }
      );
    }

    /* ==================================================
       HISTORY
    ================================================== */

    const {
      data:
        logs,
      error:
        logsError,
    } =
      await supabase
        .from(
          "channel_sync_logs"
        )
        .select(`
          id,
          provider,
          sync_type,
          date_from,
          date_to,
          status,
          availability_count,
          restrictions_count,
          warnings,
          error_message,
          created_at
        `)
        .eq(
          "property_id",
          propertyId
        )
        .eq(
          "provider",
          "channex"
        )
        .eq(
          "sync_type",
          "ari"
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(
          limit
        );

    if (
      logsError
    ) {
      return NextResponse.json(
        {
          error:
            logsError.message,
        },
        {
          status: 500,
        }
      );
    }

    const rows =
      logs ??
      [];

    const lastSync =
      rows.length >
      0
        ? rows[0]
        : null;

    return NextResponse.json({
      success:
        true,

      lastSync,

      logs:
        rows,
    });
  } catch (
    error
  ) {
    console.error(
      "Channex Sync History:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể tải lịch sử Sync.",
      },
      {
        status: 500,
      }
    );
  }
}