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
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
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
    ================================================== */

    if (
      entityType ===
      "inventory"
    ) {
      const totalRooms =
        Math.max(
          0,
          Math.round(
            Number(
              body.totalRooms ??
              0
            )
          )
        );

      const availableRooms =
        Math.max(
          0,
          Math.round(
            Number(
              body.availableRooms ??
              0
            )
          )
        );

      const minStay =
        Math.max(
          1,
          Math.round(
            Number(
              body.minStay ??
              1
            )
          )
        );

      const stopSell =
        Boolean(
          body.stopSell
        );

      if (
        availableRooms >
        totalRooms &&
        totalRooms >
        0
      ) {
        return NextResponse.json(
          {
            error:
              `Available Rooms (${availableRooms}) không thể lớn hơn Total Rooms (${totalRooms}).`,
          },
          {
            status: 400,
          }
        );
      }

      const {
        data:
          saved,
        error:
          saveError,
      } =
        await supabase
          .from(
            "inventory_calendar"
          )
          .upsert(
            {
              property_id:
                propertyId,

              room_type_id:
                roomTypeId,

              stay_date:
                stayDate,

              total_rooms:
                totalRooms,

              available_rooms:
                availableRooms,

              min_stay:
                minStay,

              stop_sell:
                stopSell,
            },
            {
              onConflict:
                "property_id,room_type_id,stay_date",
            }
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
          .single();

      if (
        saveError
      ) {
        return NextResponse.json(
          {
            error:
              saveError.message,
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
          "inventory",

        data:
          saved,
      });
    }

    /* ==================================================
       RATE
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