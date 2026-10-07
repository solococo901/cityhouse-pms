import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  processAriQueueForProperty,
} from "@/lib/channex/process-ari-queue-server";

/* ======================================================
   POST — MARK BOOKING NO-SHOW
====================================================== */

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

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
       BODY
    ================================================== */

    const body =
      await request.json();

    const bookingId =
      typeof body.bookingId ===
        "string"
        ? body.bookingId.trim()
        : "";

    const notes =
      typeof body.notes ===
        "string"
        ? body.notes.trim()
        : "";

    if (
      !bookingId
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu bookingId.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       LOAD BOOKING
       Lấy property_id để sync ARI sau khi no-show.
    ================================================== */

    const {
      data:
        booking,
      error:
        bookingError,
    } =
      await supabase
        .from(
          "bookings"
        )
        .select(`
          id,
          property_id,
          status
        `)
        .eq(
          "id",
          bookingId
        )
        .maybeSingle();

    if (
      bookingError
    ) {
      return NextResponse.json(
        {
          error:
            bookingError.message,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !booking
    ) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy booking.",
        },
        {
          status: 404,
        }
      );
    }

    const propertyId =
      booking.property_id;

    /* ==================================================
       NO-SHOW RPC
       RPC tự:
       - kiểm tra can_operate_property
       - lock booking
       - chỉ cho confirmed -> no_show
       - chống no-show 2 lần
       - trả inventory
       - đổi status
       - ghi booking_changes
       - inventory trigger enqueue ARI
    ================================================== */

    const {
      data:
        noShowResult,
      error:
        noShowError,
    } =
      await supabase.rpc(
        "mark_booking_no_show",
        {
          p_booking_id:
            bookingId,

          p_notes:
            notes ||
            null,
        }
      );

    if (
      noShowError
    ) {
      const message =
        noShowError.message ||
        "Không thể đánh dấu no-show.";

      let status =
        400;

      if (
        message.includes(
          "PERMISSION_DENIED"
        )
      ) {
        status =
          403;
      } else if (
        message.includes(
          "BOOKING_NOT_FOUND"
        )
      ) {
        status =
          404;
      } else if (
        message.includes(
          "INVALID_STATUS_TRANSITION"
        )
      ) {
        status =
          409;
      }

      return NextResponse.json(
        {
          error:
            message,
        },
        {
          status,
        }
      );
    }

    /* ==================================================
       SYNC CHANNEX NOW
       Không phụ thuộc browser debounce.
    ================================================== */

    const syncResult =
      await processAriQueueForProperty(
        propertyId,
        100
      );

    const syncWarning =
      syncResult.status ===
        "error"
        ? syncResult.error ||
          "Booking đã chuyển no-show nhưng Channex sync chưa thành công."
        : null;

    /* ==================================================
       RESULT
    ================================================== */

    return NextResponse.json({
      success:
        true,

      noShow:
        noShowResult,

      channex:
        syncResult,

      warning:
        syncWarning,
    });
  } catch (
    error
  ) {
    console.error(
      "Booking No Show:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Không thể đánh dấu no-show.",
      },
      {
        status: 500,
      }
    );
  }
}
