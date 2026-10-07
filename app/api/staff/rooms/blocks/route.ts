import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  processAriQueueForProperty,
} from "@/lib/channex/process-ari-queue-server";


function mapRoomBlockError(
  rawMessage: string
) {

  if (
    rawMessage.includes(
      "PERMISSION_DENIED"
    )
  ) {
    return {
      status: 403,
      message:
        "Bạn không có quyền thao tác property này.",
    };
  }


  if (
    rawMessage.includes(
      "ROOM_NOT_FOUND"
    )
  ) {
    return {
      status: 404,
      message:
        "Không tìm thấy phòng.",
    };
  }


  if (
    rawMessage.includes(
      "ROOM_BLOCK_NOT_FOUND"
    )
  ) {
    return {
      status: 404,
      message:
        "Không tìm thấy room block.",
    };
  }


  if (
    rawMessage.includes(
      "ROOM_INACTIVE"
    )
  ) {
    return {
      status: 409,
      message:
        "Phòng đang inactive.",
    };
  }


  if (
    rawMessage.includes(
      "ROOM_ALREADY_OUT_OF_ORDER"
    )
  ) {
    return {
      status: 409,
      message:
        "Phòng hiện đã ở trạng thái Out of Order.",
    };
  }


  if (
    rawMessage.includes(
      "ROOM_BLOCK_OVERLAP"
    )
  ) {
    return {
      status: 409,
      message:
        "Phòng đã có một active block trùng khoảng ngày này.",
    };
  }


  if (
    rawMessage.includes(
      "ROOM_HAS_BOOKING_CONFLICT"
    )
  ) {
    return {
      status: 409,
      message:
        "Phòng có booking trùng với khoảng ngày cần block.",
    };
  }


  if (
    rawMessage.includes(
      "ROOM_HAS_IN_HOUSE_GUEST"
    )
  ) {
    return {
      status: 409,
      message:
        "Phòng đang có khách checked-in.",
    };
  }


  if (
    rawMessage.includes(
      "BLOCK_DATES_REQUIRED"
    )
  ) {
    return {
      status: 400,
      message:
        "Thiếu ngày bắt đầu hoặc ngày kết thúc.",
    };
  }


  if (
    rawMessage.includes(
      "INVALID_BLOCK_DATES"
    )
  ) {
    return {
      status: 400,
      message:
        "Khoảng ngày room block không hợp lệ.",
    };
  }


  if (
    rawMessage.includes(
      "PAST_ROOM_BLOCK_NOT_ALLOWED"
    )
  ) {
    return {
      status: 409,
      message:
        "Không thể tạo room block bắt đầu trong quá khứ.",
    };
  }


  if (
    rawMessage.includes(
      "ROOM_BLOCK_TOO_LONG"
    )
  ) {
    return {
      status: 400,
      message:
        "Khoảng room block quá dài.",
    };
  }


  if (
    rawMessage.includes(
      "BLOCK_REASON_REQUIRED"
    )
  ) {
    return {
      status: 400,
      message:
        "Vui lòng nhập lý do block phòng.",
    };
  }


  if (
    rawMessage.includes(
      "INVENTORY_ROW_NOT_FOUND"
    )
  ) {
    return {
      status: 409,
      message:
        "Inventory calendar chưa đủ dữ liệu cho khoảng ngày này.",
    };
  }


  if (
    rawMessage.includes(
      "NO_INVENTORY_TO_BLOCK"
    )
  ) {
    return {
      status: 409,
      message:
        "Không còn inventory để trừ cho room block.",
    };
  }


  return {
    status: 400,
    message:
      rawMessage,
  };

}


/* ======================================================
   POST - CREATE ROOM BLOCK
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


    const startDate =
      typeof body.startDate ===
        "string"
        ? body.startDate.trim()
        : "";


    const endDate =
      typeof body.endDate ===
        "string"
        ? body.endDate.trim()
        : "";


    const reason =
      typeof body.reason ===
        "string"
        ? body.reason.trim()
        : "";


    if (
      !roomId ||
      !startDate ||
      !endDate ||
      !reason
    ) {

      return NextResponse.json(
        {
          error:
            "Missing roomId, startDate, endDate or reason.",
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
        "create_room_block",
        {
          p_room_id:
            roomId,

          p_start_date:
            startDate,

          p_end_date:
            endDate,

          p_reason:
            reason,
        }
      );


    if (error) {

      const mapped =
        mapRoomBlockError(
          error.message ||
            "ROOM_BLOCK_CREATE_FAILED"
        );


      return NextResponse.json(
        {
          error:
            mapped.message,

          code:
            error.message,
        },
        {
          status:
            mapped.status,
        }
      );

    }


    const propertyId =
      typeof data?.property_id ===
        "string"
        ? data.property_id
        : null;


    let channex = null;

    let warning:
      string |
      null =
      null;


    if (propertyId) {

      try {

        channex =
          await processAriQueueForProperty(
            propertyId,
            100
          );


        if (
          channex.status ===
            "warning" ||
          channex.status ===
            "error"
        ) {

          warning =
            channex.error ||
            channex.warnings?.join(
              " | "
            ) ||
            "Room block đã lưu nhưng Channex ARI có cảnh báo.";

        }

      } catch (
        syncError
      ) {

        console.error(
          "Room block ARI sync:",
          syncError
        );


        warning =
          "Room block đã lưu nhưng chưa thể sync Channex ngay. Queue vẫn còn để worker xử lý lại.";

      }

    }


    return NextResponse.json({
      success:
        true,

      data,

      channex,

      warning,
    });


  } catch (
    error
  ) {

    console.error(
      "Create room block:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Không thể tạo room block.",
      },
      {
        status: 500,
      }
    );

  }

}


/* ======================================================
   DELETE - RELEASE ROOM BLOCK
====================================================== */

export async function DELETE(
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


    const blockId =
      typeof body.blockId ===
        "string"
        ? body.blockId.trim()
        : "";


    const notes =
      typeof body.notes ===
        "string"
        ? body.notes.trim()
        : "";


    if (
      !blockId
    ) {

      return NextResponse.json(
        {
          error:
            "Missing blockId.",
        },
        {
          status: 400,
        }
      );

    }


    const {
      data: block,
      error:
        blockError,
    } =
      await supabase
        .from(
          "room_blocks"
        )
        .select(`
          id,
          property_id
        `)
        .eq(
          "id",
          blockId
        )
        .maybeSingle();


    if (
      blockError
    ) {

      return NextResponse.json(
        {
          error:
            blockError.message,
        },
        {
          status: 400,
        }
      );

    }


    if (
      !block
    ) {

      return NextResponse.json(
        {
          error:
            "Không tìm thấy room block.",
        },
        {
          status: 404,
        }
      );

    }


    const {
      data,
      error,
    } =
      await supabase.rpc(
        "release_room_block",
        {
          p_block_id:
            blockId,

          p_notes:
            notes ||
            null,
        }
      );


    if (error) {

      const mapped =
        mapRoomBlockError(
          error.message ||
            "ROOM_BLOCK_RELEASE_FAILED"
        );


      return NextResponse.json(
        {
          error:
            mapped.message,

          code:
            error.message,
        },
        {
          status:
            mapped.status,
        }
      );

    }


    let channex = null;

    let warning:
      string |
      null =
      null;


    try {

      channex =
        await processAriQueueForProperty(
          block.property_id,
          100
        );


      if (
        channex.status ===
          "warning" ||
        channex.status ===
          "error"
      ) {

        warning =
          channex.error ||
          channex.warnings?.join(
            " | "
          ) ||
          "Room block đã release nhưng Channex ARI có cảnh báo.";

      }

    } catch (
      syncError
    ) {

      console.error(
        "Release room block ARI sync:",
        syncError
      );


      warning =
        "Room block đã release nhưng chưa thể sync Channex ngay. Queue vẫn còn để worker xử lý lại.";

    }


    return NextResponse.json({
      success:
        true,

      data,

      channex,

      warning,
    });


  } catch (
    error
  ) {

    console.error(
      "Release room block:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Không thể release room block.",
      },
      {
        status: 500,
      }
    );

  }

}
