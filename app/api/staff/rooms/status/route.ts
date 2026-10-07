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


    const body =
      await request.json();


    const roomId =
      typeof body.roomId ===
        "string"
        ? body.roomId.trim()
        : "";


    const status =
      typeof body.status ===
        "string"
        ? body.status.trim()
        : "";


    const notes =
      typeof body.notes ===
        "string"
        ? body.notes.trim()
        : "";


    if (
      !roomId ||
      !status
    ) {

      return NextResponse.json(
        {
          error:
            "Missing roomId or status",
        },
        {
          status: 400,
        }
      );

    }


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "transition_room_status",
        {
          p_room_id:
            roomId,

          p_status:
            status,

          p_notes:
            notes ||
            null,
        }
      );


    if (error) {

      const rawMessage =
        error.message ||
        "Không thể cập nhật trạng thái phòng.";


      let message =
        rawMessage;


      let httpStatus =
        400;


      if (
        rawMessage.includes(
          "PERMISSION_DENIED"
        )
      ) {

        message =
          "Bạn không có quyền thao tác phòng này.";

        httpStatus =
          403;

      } else if (
        rawMessage.includes(
          "ROOM_NOT_FOUND"
        )
      ) {

        message =
          "Không tìm thấy phòng.";

        httpStatus =
          404;

      } else if (
        rawMessage.includes(
          "ROOM_INACTIVE"
        )
      ) {

        message =
          "Phòng đang inactive.";

        httpStatus =
          409;

      } else if (
        rawMessage.includes(
          "ROOM_HAS_IN_HOUSE_GUEST"
        )
      ) {

        message =
          "Phòng đang có khách checked-in, không thể đổi trạng thái Housekeeping.";

        httpStatus =
          409;

      } else if (
        rawMessage.includes(
          "INVALID_ROOM_STATUS_TRANSITION"
        )
      ) {

        message =
          "Trạng thái phòng hiện tại không cho phép thao tác này.";

        httpStatus =
          409;

      } else if (
        rawMessage.includes(
          "INVALID_HOUSEKEEPING_TARGET_STATUS"
        )
      ) {

        message =
          "Trạng thái Housekeeping không hợp lệ.";

        httpStatus =
          400;

      }


      return NextResponse.json(
        {
          error:
            message,

          code:
            rawMessage,
        },
        {
          status:
            httpStatus,
        }
      );

    }


    return NextResponse.json({
      success:
        true,

      data,
    });


  } catch (
    error
  ) {

    console.error(
      "Room status update:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Không thể cập nhật trạng thái phòng.",
      },
      {
        status: 500,
      }
    );

  }

}
