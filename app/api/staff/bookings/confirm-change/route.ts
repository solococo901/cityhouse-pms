import { NextResponse } from "next/server";

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
      bookingRoomId,
      targetRoomId,

      newCheckIn,
      newCheckOut,

      notes,
    } = body;

    if (
      !bookingRoomId ||
      !targetRoomId ||
      !newCheckIn ||
      !newCheckOut
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu thông tin thay đổi booking.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       CONFIRM
    ========================================= */

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "confirm_booking_change",
        {
          p_booking_room_id:
            bookingRoomId,

          p_target_room_id:
            targetRoomId,

          p_new_check_in:
            newCheckIn,

          p_new_check_out:
            newCheckOut,

          p_notes:
            notes || null,
        }
      );

    /* =========================================
       ERROR
    ========================================= */

    if (error) {
      let message =
        error.message;

      if (
        message.includes(
          "ROOM_OCCUPIED"
        )
      ) {
        message =
          "Phòng này đã có booking trong khoảng ngày mới.";
      }

      if (
        message.includes(
          "NO_INVENTORY"
        )
      ) {
        message =
          "Không còn phòng trống trong khoảng ngày mới.";
      }

      if (
        message.includes(
          "RATE_NOT_FOUND"
        )
      ) {
        message =
          "Một hoặc nhiều ngày mới chưa được thiết lập giá.";
      }

      if (
        message.includes(
          "RATE_PLAN_NOT_FOUND"
        )
      ) {
        message =
          "Booking chưa có Rate Plan hợp lệ.";
      }

      if (
        message.includes(
          "INVALID_DATE_RANGE"
        )
      ) {
        message =
          "Ngày check-out phải sau ngày check-in.";
      }

      if (
        message.includes(
          "BOOKING_STATUS_LOCKED"
        )
      ) {
        message =
          "Booking ở trạng thái hiện tại không thể đổi ngày.";
      }

      if (
        message.includes(
          "PERMISSION_DENIED"
        )
      ) {
        message =
          "Bạn không có quyền thay đổi booking.";
      }

      if (
        message.includes(
          "BOOKING_ROOM_NOT_FOUND"
        )
      ) {
        message =
          "Không tìm thấy booking room.";
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

    /* =========================================
       SUCCESS
    ========================================= */

    return NextResponse.json({
      success: true,

      result:
        data,
    });
  } catch (error) {
    console.error(
      "Confirm booking change:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể thay đổi booking.",
      },
      {
        status: 500,
      }
    );
  }
}