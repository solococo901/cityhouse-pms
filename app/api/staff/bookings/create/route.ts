import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* ======================================================
   HELPERS
====================================================== */

function getErrorMessage(
  message: string
) {
  if (
    message.includes(
      "ROOM_OCCUPIED"
    )
  ) {
    return "Phòng đã có booking trùng thời gian.";
  }

  if (
    message.includes(
      "NO_INVENTORY"
    )
  ) {
    return "Không còn inventory khả dụng cho thời gian đã chọn.";
  }

  if (
    message.includes(
      "INVALID_DATE_RANGE"
    )
  ) {
    return "Ngày check-out phải sau ngày check-in.";
  }

  if (
    message.includes(
      "ROOM_NOT_FOUND"
    )
  ) {
    return "Không tìm thấy phòng hoặc phòng đã ngưng hoạt động.";
  }

  if (
    message.includes(
      "RATE_PLAN_NOT_FOUND"
    )
  ) {
    return "Rate Plan không tồn tại, không thuộc property này hoặc đã ngưng hoạt động.";
  }

  if (
    message.includes(
      "RATE_NOT_FOUND"
    )
  ) {
    return "Rate Calendar chưa có đủ giá cho toàn bộ thời gian lưu trú.";
  }

  if (
    message.includes(
      "PERMISSION_DENIED"
    )
  ) {
    return "Bạn không có quyền tạo booking cho property này.";
  }

  return message;
}

/* ======================================================
   POST
====================================================== */

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
      error: authError,
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

    const body =
      await request.json();

    const propertyId =
      typeof body.propertyId ===
      "string"
        ? body.propertyId
        : "";

    const roomId =
      typeof body.roomId ===
      "string"
        ? body.roomId
        : "";

    const ratePlanId =
      typeof body.ratePlanId ===
      "string"
        ? body.ratePlanId
        : "";

    const checkIn =
      typeof body.checkIn ===
      "string"
        ? body.checkIn
        : "";

    const checkOut =
      typeof body.checkOut ===
      "string"
        ? body.checkOut
        : "";

    const firstName =
      typeof body.firstName ===
      "string"
        ? body.firstName.trim()
        : "";

    const lastName =
      typeof body.lastName ===
      "string"
        ? body.lastName.trim()
        : "";

    const phone =
      typeof body.phone ===
      "string"
        ? body.phone.trim()
        : "";

    const email =
      typeof body.email ===
      "string"
        ? body.email.trim()
        : "";

    const notes =
      typeof body.notes ===
      "string"
        ? body.notes.trim()
        : "";

    const adults =
      Number(
        body.adults ?? 1
      );

    const children =
      Number(
        body.children ?? 0
      );

    const totalAmount =
      Number(
        body.totalAmount ?? 0
      );

    if (
      !propertyId ||
      !roomId ||
      !checkIn ||
      !checkOut ||
      !firstName
    ) {
      return NextResponse.json(
        {
          error:
            "Vui lòng nhập đầy đủ property, phòng, ngày lưu trú và tên khách.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        adults
      ) ||
      adults < 1 ||
      !Number.isFinite(
        children
      ) ||
      children < 0 ||
      !Number.isFinite(
        totalAmount
      ) ||
      totalAmount < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Thông tin số khách hoặc Total Amount không hợp lệ.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Backward-compatible rollout:
     *
     * - Old UI does not send ratePlanId -> call the existing
     *   12-argument RPC which auto-selects Website rate.
     *
     * - New UI sends ratePlanId -> call the new 13-argument
     *   RPC so the selected plan is explicit.
     */
    const rpcArgs =
      ratePlanId
        ? {
            p_property_id:
              propertyId,

            p_room_id:
              roomId,

            p_check_in:
              checkIn,

            p_check_out:
              checkOut,

            p_first_name:
              firstName,

            p_last_name:
              lastName,

            p_phone:
              phone,

            p_email:
              email,

            p_adults:
              Math.trunc(
                adults
              ),

            p_children:
              Math.trunc(
                children
              ),

            p_total_amount:
              totalAmount,

            p_notes:
              notes,

            p_rate_plan_id:
              ratePlanId,
          }
        : {
            p_property_id:
              propertyId,

            p_room_id:
              roomId,

            p_check_in:
              checkIn,

            p_check_out:
              checkOut,

            p_first_name:
              firstName,

            p_last_name:
              lastName,

            p_phone:
              phone,

            p_email:
              email,

            p_adults:
              Math.trunc(
                adults
              ),

            p_children:
              Math.trunc(
                children
              ),

            p_total_amount:
              totalAmount,

            p_notes:
              notes,
          };

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "create_manual_booking",
        rpcArgs
      );

    if (
      error
    ) {
      console.error(
        "Create booking RPC:",
        error
      );

      return NextResponse.json(
        {
          error:
            getErrorMessage(
              error.message
            ),
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
  } catch (
    error
  ) {
    console.error(
      "Create booking:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể tạo booking.",
      },
      {
        status: 500,
      }
    );
  }
}
