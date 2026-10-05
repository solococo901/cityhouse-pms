import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    /* =========================================
       AUTH
    ========================================= */

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
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

    /* =========================================
       BODY
    ========================================= */

    const body =
      await request.json();

    const {
      propertyId,
      startDate,
      days,
    } = body;

    if (
      !propertyId ||
      !startDate ||
      !days
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu thông tin generate calendar.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       VALIDATE DAYS
    ========================================= */

    if (
      ![
        30,
        90,
        365,
      ].includes(
        Number(days)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Days phải là 30, 90 hoặc 365.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       RPC
    ========================================= */

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "generate_calendar_data",
        {
          p_property_id:
            propertyId,

          p_start_date:
            startDate,

          p_days:
            Number(days),
        }
      );

    if (error) {
      let message =
        error.message;

      if (
        message.includes(
          "PERMISSION_DENIED"
        )
      ) {
        message =
          "Bạn không có quyền generate dữ liệu Calendar.";
      }

      if (
        message.includes(
          "INVALID_DAYS"
        )
      ) {
        message =
          "Chỉ hỗ trợ generate 30, 90 hoặc 365 ngày.";
      }

      return NextResponse.json(
        {
          error:
            message,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
    });
  } catch (error) {
    console.error(
      "Generate calendar:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể generate Calendar.",
      },
      {
        status: 500,
      }
    );
  }
}