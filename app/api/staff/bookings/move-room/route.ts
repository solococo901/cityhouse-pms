import { NextResponse } from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export async function POST(
  request: Request
) {
  try {
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

    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

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

    if (error) {
      let message =
        error.message;

      if (
        error.message.includes(
          "ROOM_OCCUPIED"
        )
      ) {
        message =
          "Phòng này đã có booking trong khoảng thời gian đó.";
      }

      if (
        error.message.includes(
          "NO_INVENTORY"
        )
      ) {
        message =
          "Room type mới không còn inventory.";
      }

      if (
        error.message.includes(
          "PERMISSION_DENIED"
        )
      ) {
        message =
          "Bạn không có quyền đổi phòng.";
      }

      return NextResponse.json(
        {
          error: message,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

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