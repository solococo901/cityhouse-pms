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
       PREVIEW
    ========================================= */

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "preview_booking_change",
        {
          p_booking_room_id:
            bookingRoomId,

          p_target_room_id:
            targetRoomId,

          p_new_check_in:
            newCheckIn,

          p_new_check_out:
            newCheckOut,
        }
      );

    /* =========================================
       ERROR
    ========================================= */

    if (error) {
      const rawMessage =
        error.message || "";

      /* =========================================
         MAINTENANCE BLOCK
      ========================================= */

      if (
        rawMessage.includes(
          "ROOM_BLOCKED"
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Phòng đang bị khóa bảo trì trong thời gian lưu trú đã chọn.",

            code:
              "ROOM_BLOCKED",
          },
          {
            status: 409,
          }
        );
      }

      let message =
        rawMessage;

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
          "Không còn inventory cho khoảng ngày mới.";
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

      if (
        message.includes(
          "TARGET_ROOM_NOT_FOUND"
        )
      ) {
        message =
          "Không tìm thấy phòng đích hợp lệ.";
      }

      if (
        message.includes(
          "DIFFERENT_PROPERTY"
        )
      ) {
        message =
          "Không thể chuyển booking sang phòng thuộc tòa nhà khác.";
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
      preview: data,
    });
  } catch (error) {
    console.error(
      "Preview booking change error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể kiểm tra thay đổi booking.",
      },
      {
        status: 500,
      }
    );
  }
}