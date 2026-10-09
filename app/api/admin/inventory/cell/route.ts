
import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

/* ======================================================
   HELPERS
====================================================== */

function validDate(
  value: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function getIsoWeekday(
  value: string
) {
  const weekday = new Date(
    `${value}T00:00:00.000Z`
  ).getUTCDay();

  return weekday === 0 ? 7 : weekday;
}

function validNonNegativeInteger(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function validPositiveInteger(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1
  );
}

function inventoryRpcError(
  message: string
) {
  if (
    message.includes(
      "AVAILABILITY_EXCEEDS_SAFE_CAPACITY"
    )
  ) {
    return {
      status: 409,
      error:
        "Số phòng khả dụng vượt quá sức chứa an toàn sau khi trừ booking và room block. Vui lòng tải lại lịch và kiểm tra số phòng hiện tại.",
      code:
        "AVAILABILITY_EXCEEDS_SAFE_CAPACITY",
    };
  }

  if (
    message.includes(
      "INVALID_AVAILABILITY"
    )
  ) {
    return {
      status: 400,
      error:
        "Số phòng khả dụng không hợp lệ hoặc vượt quá số phòng vật lý đang hoạt động.",
      code:
        "INVALID_AVAILABILITY",
    };
  }

  if (
    message.includes(
      "MISSING_INVENTORY_DATA"
    )
  ) {
    return {
      status: 409,
      error:
        "Chưa có dữ liệu inventory cho ngày này. Vui lòng tạo calendar data trước khi chỉnh sửa.",
      code:
        "MISSING_INVENTORY_DATA",
    };
  }

  if (
    message.includes(
      "INVALID_MIN_STAY"
    )
  ) {
    return {
      status: 400,
      error:
        "Minimum Stay phải lớn hơn hoặc bằng 1.",
      code:
        "INVALID_MIN_STAY",
    };
  }

  if (
    message.includes(
      "ROOM_TYPE_NOT_FOUND"
    )
  ) {
    return {
      status: 400,
      error:
        "Room Type không thuộc property này.",
      code:
        "ROOM_TYPE_NOT_FOUND",
    };
  }

  if (
    message.includes(
      "PERMISSION_DENIED"
    )
  ) {
    return {
      status: 403,
      error:
        "Bạn không có quyền chỉnh sửa property này.",
      code:
        "PERMISSION_DENIED",
    };
  }

  return {
    status: 500,
    error: message,
    code:
      "INVENTORY_UPDATE_FAILED",
  };
}

/* ======================================================
   POST
====================================================== */

export async function POST(
  request: Request
) {
  // Keep request-bound Supabase initialization
  // outside the broad try/catch for Next.js
  // cacheComponents compatibility.
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
       BODY
    ================================================== */

    const body =
      await request.json();

    const propertyId =
      body.propertyId as
        | string
        | undefined;

    const roomTypeId =
      body.roomTypeId as
        | string
        | undefined;

    const stayDate =
      body.stayDate as
        | string
        | undefined;

    const entityType =
      body.entityType as
        | "inventory"
        | "rate"
        | undefined;

    if (
      !propertyId ||
      !roomTypeId ||
      !stayDate ||
      !entityType
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu dữ liệu bắt buộc.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !validDate(
        stayDate
      )
    ) {
      return NextResponse.json(
        {
          error:
            "stayDate không hợp lệ.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      entityType !==
        "inventory" &&
      entityType !==
        "rate"
    ) {
      return NextResponse.json(
        {
          error:
            "entityType không hợp lệ.",
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
        canManage,
      error:
        permissionError,
    } =
      await supabase.rpc(
        "can_manage_property",
        {
          target_property_id:
            propertyId,
        }
      );

    if (
      permissionError ||
      !canManage
    ) {
      return NextResponse.json(
        {
          error:
            "Bạn không có quyền chỉnh sửa property này.",
        },
        {
          status: 403,
        }
      );
    }

    /* ==================================================
       VERIFY ROOM TYPE
    ================================================== */

    const {
      data:
        roomType,
      error:
        roomTypeError,
    } =
      await supabase
        .from(
          "room_types"
        )
        .select(`
          id
        `)
        .eq(
          "id",
          roomTypeId
        )
        .eq(
          "property_id",
          propertyId
        )
        .maybeSingle();

    if (
      roomTypeError ||
      !roomType
    ) {
      return NextResponse.json(
        {
          error:
            "Room Type không thuộc property này.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       INVENTORY

       SAFE SINGLE-CELL UPDATE

       IMPORTANT:
       - No direct inventory_calendar upsert.
       - No client-controlled total_rooms update.
       - Database RPC locks the inventory row.
       - Database RPC checks safe capacity.
       - Database RPC performs the update.
       - Existing DB ARI triggers remain active.
    ================================================== */

    if (
      entityType ===
      "inventory"
    ) {
      // totalRooms is intentionally NOT used
      // as a source of truth.
      //
      // Keep accepting the existing request
      // body shape for UI compatibility.

      const availableRooms =
        body.availableRooms ??
        0;

      const minStay =
        body.minStay ??
        1;

      const stopSell =
        body.stopSell ??
        false;

      /* ==============================================
         VALIDATE INPUT
      ============================================== */

      if (
        !validNonNegativeInteger(
          availableRooms
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Available Rooms phải là số nguyên không âm hợp lệ.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        !validPositiveInteger(
          minStay
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Minimum Stay phải là số nguyên lớn hơn hoặc bằng 1.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        typeof stopSell !==
        "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "stopSell phải là boolean.",
          },
          {
            status: 400,
          }
        );
      }

      /* ==============================================
         SAFE DATABASE TRANSACTION

         p_start_date = p_end_date
         => update exactly one calendar date.

         p_weekdays uses ISO:
         Monday = 1 ... Sunday = 7.

         p_price = null
         => existing rates are unchanged.

         p_rate_plan_id = null
         => allowed when price is null.

         RPC owns row locks, capacity validation,
         and the inventory update.
      ============================================== */

      const isoWeekday =
        getIsoWeekday(
          stayDate
        );

      const {
        data:
          updateResult,
        error:
          updateError,
      } =
        await supabase.rpc(
          "bulk_update_ari",
          {
            p_property_id:
              propertyId,

            p_room_type_id:
              roomTypeId,

            p_rate_plan_id:
              null,

            p_start_date:
              stayDate,

            p_end_date:
              stayDate,

            p_weekdays:
              [isoWeekday],

            p_price:
              null,

            p_available_rooms:
              availableRooms,

            p_min_stay:
              minStay,

            p_stop_sell:
              stopSell,
          }
        );

      /* ==============================================
         HANDLE RPC ERROR
      ============================================== */

      if (
        updateError
      ) {
        console.error(
          "Safe inventory cell update:",
          updateError
        );

        const mappedError =
          inventoryRpcError(
            updateError.message
          );

        return NextResponse.json(
          {
            error:
              mappedError.error,

            code:
              mappedError.code,
          },
          {
            status:
              mappedError.status,
          }
        );
      }

      /* ==============================================
         VERIFY RPC RESULT
      ============================================== */

      if (
        !updateResult ||
        updateResult.success !== true ||
        updateResult.inventory_updated !== 1
      ) {
        console.error(
          "Unexpected inventory RPC result:",
          updateResult
        );

        return NextResponse.json(
          {
            error:
              "Không thể xác nhận kết quả cập nhật inventory. Vui lòng tải lại lịch để kiểm tra dữ liệu thực tế.",

            code:
              "INVENTORY_UPDATE_UNVERIFIED",
          },
          {
            status: 500,
          }
        );
      }

      /* ==============================================
         READ BACK SAVED INVENTORY

         Preserve existing autosave JSON shape.

         Do not modify the row in this step.
      ============================================== */

      const {
        data:
          saved,
        error:
          readError,
      } =
        await supabase
          .from(
            "inventory_calendar"
          )
          .select(`
            id,
            room_type_id,
            stay_date,
            total_rooms,
            available_rooms,
            min_stay,
            stop_sell
          `)
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "room_type_id",
            roomTypeId
          )
          .eq(
            "stay_date",
            stayDate
          )
          .single();

      if (
        readError ||
        !saved
      ) {
        console.error(
          "Inventory readback failed:",
          readError
        );

        return NextResponse.json(
          {
            error:
              "Inventory đã được cập nhật nhưng không thể đọc lại dữ liệu. Vui lòng tải lại lịch.",

            code:
              "INVENTORY_READBACK_FAILED",
          },
          {
            status: 500,
          }
        );
      }

      /* ==============================================
         SUCCESS

         Existing response shape preserved:
         {
           success: true,
           entityType: "inventory",
           data: saved
         }
      ============================================== */

      return NextResponse.json({
        success:
          true,

        entityType:
          "inventory",

        data:
          saved,
      });
    }

    /* ==================================================
       RATE

       Existing behavior preserved.
       No inventory write in this branch.
    ================================================== */

    const ratePlanId =
      body.ratePlanId as
        | string
        | undefined;

    if (
      !ratePlanId
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu ratePlanId.",
        },
        {
          status: 400,
        }
      );
    }

    const price =
      Math.round(
        Number(
          body.price ??
          0
        )
      );

    if (
      !Number.isFinite(
        price
      ) ||
      price <=
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Giá phải lớn hơn 0.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       VERIFY RATE PLAN
    ================================================== */

    const {
      data:
        ratePlan,
      error:
        ratePlanError,
    } =
      await supabase
        .from(
          "rate_plans"
        )
        .select(`
          id
        `)
        .eq(
          "id",
          ratePlanId
        )
        .eq(
          "property_id",
          propertyId
        )
        .maybeSingle();

    if (
      ratePlanError ||
      !ratePlan
    ) {
      return NextResponse.json(
        {
          error:
            "Rate Plan không thuộc property này.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      data:
        savedRate,
      error:
        saveRateError,
    } =
      await supabase
        .from(
          "rate_calendar"
        )
        .upsert(
          {
            property_id:
              propertyId,

            room_type_id:
              roomTypeId,

            rate_plan_id:
              ratePlanId,

            stay_date:
              stayDate,

            price,
          },
          {
            onConflict:
              "property_id,room_type_id,rate_plan_id,stay_date",
          }
        )
        .select(`
          id,
          room_type_id,
          rate_plan_id,
          stay_date,
          price
        `)
        .single();

    if (
      saveRateError
    ) {
      return NextResponse.json(
        {
          error:
            saveRateError.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success:
        true,

      entityType:
        "rate",

      data:
        savedRate,
    });
  } catch (
    error
  ) {
    console.error(
      "Inventory cell update:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Không thể lưu dữ liệu.",
      },
      {
        status: 500,
      }
    );
  }
}
