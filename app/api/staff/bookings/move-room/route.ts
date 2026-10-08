import { NextResponse } from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export async function POST(
  request: Request
) {
  try {
    /* =========================================
       BODY
    ========================================= */

    const body =
      await request.json();

    const {
      bookingRoomId,
      targetRoomId,
    } = body;

    if (
      !bookingRoomId ||
      !targetRoomId
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu bookingRoomId hoặc targetRoomId.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       AUTH
    ========================================= */

    const supabase =
      await createClient();

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
       MOVE ROOM
    ========================================= */

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "move_booking_room",
        {
          p_booking_room_id:
            bookingRoomId,

          p_target_room_id:
            targetRoomId,
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
        rawMessage.includes(
          "ROOM_OCCUPIED"
        )
      ) {
        message =
          "Phòng này đã có booking trong khoảng thời gian đó.";
      }

      if (
        rawMessage.includes(
          "NO_INVENTORY"
        )
      ) {
        message =
          "Room type mới không còn inventory.";
      }

      if (
        rawMessage.includes(
          "PERMISSION_DENIED"
        )
      ) {
        message =
          "Bạn không có quyền đổi phòng.";
      }

      if (
        rawMessage.includes(
          "BOOKING_ROOM_NOT_FOUND"
        )
      ) {
        message =
          "Không tìm thấy booking room.";
      }

      if (
        rawMessage.includes(
          "TARGET_ROOM_NOT_FOUND"
        )
      ) {
        message =
          "Không tìm thấy phòng đích hợp lệ.";
      }

      if (
        rawMessage.includes(
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
      data,
    });
  } catch (error) {
    console.error(
      "Move booking room error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể đổi phòng.",
      },
      {
        status: 500,
      }
    );
  }
}