import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
/* ======================================================
   TYPES
====================================================== */
type RateRow = {
  stay_date: string;
  price:
    | number
    | string
    | null;
};
type InventoryRow = {
  stay_date: string;
  available_rooms:
    | number
    | string
    | null;
  stop_sell:
    | boolean
    | null;
};
/* ======================================================
   HELPERS
====================================================== */
function isDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}
function addDays(
  date: string,
  amount: number
) {
  const value =
    new Date(
      `${date}T00:00:00Z`
    );
  value.setUTCDate(
    value.getUTCDate() +
      amount
  );
  return value
    .toISOString()
    .slice(0, 10);
}
function dateDiff(
  start: string,
  end: string
) {
  const a =
    new Date(
      `${start}T00:00:00Z`
    );
  const b =
    new Date(
      `${end}T00:00:00Z`
    );
  return Math.round(
    (
      b.getTime() -
      a.getTime()
    ) /
      86400000
  );
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
    if (
      !propertyId ||
      !roomId ||
      !ratePlanId ||
      !isDate(
        checkIn
      ) ||
      !isDate(
        checkOut
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu property, phòng, Rate Plan hoặc ngày lưu trú.",
        },
        {
          status: 400,
        }
      );
    }
    const nights =
      dateDiff(
        checkIn,
        checkOut
      );
    if (
      nights <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Ngày check-out phải sau ngày check-in.",
        },
        {
          status: 400,
        }
      );
    }
    const {
      data: canOperate,
      error: permissionError,
    } =
      await supabase.rpc(
        "can_operate_property",
        {
          target_property_id:
            propertyId,
        }
      );
    if (
      permissionError ||
      !canOperate
    ) {
      return NextResponse.json(
        {
          error:
            "Bạn không có quyền thao tác property này.",
        },
        {
          status: 403,
        }
      );
    }
    const [
      roomResult,
      ratePlanResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "rooms"
          )
          .select(`
            id,
            room_number,
            room_type_id,
            active
          `)
          .eq(
            "id",
            roomId
          )
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "active",
            true
          )
          .maybeSingle(),
        supabase
          .from(
            "rate_plans"
          )
          .select(`
            id,
            name,
            code,
            active
          `)
          .eq(
            "id",
            ratePlanId
          )
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "active",
            true
          )
          .maybeSingle(),
      ]);
    if (
      roomResult.error ||
      !roomResult.data
    ) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy phòng hoặc phòng đã ngưng hoạt động.",
        },
        {
          status: 400,
        }
      );
    }
    if (
      ratePlanResult.error ||
      !ratePlanResult.data
    ) {
      return NextResponse.json(
        {
          error:
            "Rate Plan không tồn tại hoặc đã ngưng hoạt động.",
        },
        {
          status: 400,
        }
      );
    }
    const room =
      roomResult.data;
    const ratePlan =
      ratePlanResult.data;
    const [
      ratesResult,
      inventoryResult,
      conflictResult,
      roomBlockResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "rate_calendar"
          )
          .select(`
            stay_date,
            price
          `)
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "room_type_id",
            room.room_type_id
          )
          .eq(
            "rate_plan_id",
            ratePlanId
          )
          .gte(
            "stay_date",
            checkIn
          )
          .lt(
            "stay_date",
            checkOut
          )
          .order(
            "stay_date"
          ),
        supabase
          .from(
            "inventory_calendar"
          )
          .select(`
            stay_date,
            available_rooms,
            stop_sell
          `)
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "room_type_id",
            room.room_type_id
          )
          .gte(
            "stay_date",
            checkIn
          )
          .lt(
            "stay_date",
            checkOut
          )
          .order(
            "stay_date"
          ),
        supabase
          .from(
            "booking_rooms"
          )
          .select(`
            id,
            bookings!inner (
              status
            )
          `)
          .eq(
            "room_id",
            roomId
          )
          .lt(
            "check_in",
            checkOut
          )
          .gt(
            "check_out",
            checkIn
          )
          .not(
            "bookings.status",
            "in",
            "(cancelled,no_show,checked_out)"
          )
          .limit(1),

        supabase
          .from(
            "room_blocks"
          )
          .select(`
            id,
            start_date,
            end_date,
            reason,
            status
          `)
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "room_id",
            roomId
          )
          .eq(
            "status",
            "active"
          )
          .lt(
            "start_date",
            checkOut
          )
          .gt(
            "end_date",
            checkIn
          )
          .limit(1),
      ]);
    if (
      ratesResult.error
    ) {
      throw new Error(
        ratesResult.error.message
      );
    }
    if (
      inventoryResult.error
    ) {
      throw new Error(
        inventoryResult.error.message
      );
    }
    if (
      conflictResult.error
    ) {
      throw new Error(
        conflictResult.error.message
      );
    }

    if (
      roomBlockResult.error
    ) {
      throw new Error(
        roomBlockResult.error.message
      );
    }

    if (
      (
        conflictResult.data ??
        []
      ).length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "Phòng đã có booking trùng thời gian.",
          code:
            "ROOM_OCCUPIED",
        },
        {
          status: 409,
        }
      );
    }

    if (
      (
        roomBlockResult.data ??
        []
      ).length > 0
    ) {
      const block =
        roomBlockResult.data?.[0];

      return NextResponse.json(
        {
          error:
            "Phòng đang bị khóa bảo trì trong thời gian lưu trú đã chọn.",

          code:
            "ROOM_BLOCKED",

          block:
            block
              ? {
                  id:
                    block.id,

                  startDate:
                    block.start_date,

                  endDate:
                    block.end_date,

                  reason:
                    block.reason,
                }
              : null,
        },
        {
          status: 409,
        }
      );
    }

    const rateRows =
      (
        ratesResult.data ??
        []
      ) as RateRow[];
    const inventoryRows =
      (
        inventoryResult.data ??
        []
      ) as InventoryRow[];
    const rateMap =
      new Map(
        rateRows.map(
          (row) => [
            row.stay_date,
            Number(
              row.price ?? 0
            ),
          ]
        )
      );
    const inventoryMap =
      new Map(
        inventoryRows.map(
          (row) => [
            row.stay_date,
            row,
          ]
        )
      );
    const missingRateDates:
      string[] = [];
    const unavailableDates:
      string[] = [];
    const nightlyRates:
      {
        stayDate: string;
        price: number;
      }[] = [];
    let suggestedTotal =
      0;
    for (
      let index = 0;
      index < nights;
      index += 1
    ) {
      const stayDate =
        addDays(
          checkIn,
          index
        );
      const price =
        rateMap.get(
          stayDate
        );
      if (
        price === undefined ||
        !Number.isFinite(
          price
        ) ||
        price <= 0
      ) {
        missingRateDates.push(
          stayDate
        );
      } else {
        nightlyRates.push({
          stayDate,
          price,
        });
        suggestedTotal +=
          price;
      }
      const inventory =
        inventoryMap.get(
          stayDate
        );
      if (
        !inventory ||
        Number(
          inventory.available_rooms ??
            0
        ) <= 0 ||
        inventory.stop_sell ===
          true
      ) {
        unavailableDates.push(
          stayDate
        );
      }
    }
    if (
      missingRateDates.length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Rate Calendar chưa có đủ giá cho toàn bộ thời gian lưu trú.",
          code:
            "RATE_NOT_FOUND",
          missingRateDates,
        },
        {
          status: 409,
        }
      );
    }
    if (
      unavailableDates.length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Không còn inventory khả dụng cho toàn bộ thời gian lưu trú.",
          code:
            "NO_INVENTORY",
          unavailableDates,
        },
        {
          status: 409,
        }
      );
    }
    return NextResponse.json({
      success: true,
      room: {
        id:
          room.id,
        roomNumber:
          room.room_number,
        roomTypeId:
          room.room_type_id,
      },
      ratePlan: {
        id:
          ratePlan.id,
        name:
          ratePlan.name,
        code:
          ratePlan.code,
      },
      checkIn,
      checkOut,
      nights,
      nightlyRates,
      suggestedTotal,
      currency:
        "VND",
    });
  } catch (
    error
  ) {
    console.error(
      "Booking quote:",
      error
    );
    return NextResponse.json(
      {
        error:
          "Không thể tính giá booking.",
      },
      {
        status: 500,
      }
    );
  }
}
