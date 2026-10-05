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

    const body =
      await request.json();

    const {
      propertyId,
      roomTypeId,
      ratePlanId,

      startDate,
      endDate,

      weekdays,

      price,
      availableRooms,
      minStay,
      stopSell,
    } = body;

    if (
      !propertyId ||
      !roomTypeId ||
      !startDate ||
      !endDate
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu thông tin bắt buộc.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Array.isArray(
        weekdays
      ) ||
      weekdays.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Vui lòng chọn ít nhất một ngày trong tuần.",
        },
        {
          status: 400,
        }
      );
    }

    const parsedPrice =
      price === "" ||
      price === null ||
      price === undefined
        ? null
        : Number(price);

    const parsedAvailability =
      availableRooms === "" ||
      availableRooms === null ||
      availableRooms === undefined
        ? null
        : Number(
            availableRooms
          );

    const parsedMinStay =
      minStay === "" ||
      minStay === null ||
      minStay === undefined
        ? null
        : Number(minStay);

    const parsedStopSell =
      stopSell ===
      "keep"
        ? null
        : stopSell === true ||
            stopSell ===
              "true"
          ? true
          : stopSell ===
                false ||
              stopSell ===
                "false"
            ? false
            : null;

    if (
      parsedPrice === null &&
      parsedAvailability ===
        null &&
      parsedMinStay === null &&
      parsedStopSell === null
    ) {
      return NextResponse.json(
        {
          error:
            "Không có dữ liệu nào cần cập nhật.",
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
        "bulk_update_ari",
        {
          p_property_id:
            propertyId,

          p_room_type_id:
            roomTypeId,

          p_rate_plan_id:
            ratePlanId ||
            null,

          p_start_date:
            startDate,

          p_end_date:
            endDate,

          p_weekdays:
            weekdays,

          p_price:
            parsedPrice,

          p_available_rooms:
            parsedAvailability,

          p_min_stay:
            parsedMinStay,

          p_stop_sell:
            parsedStopSell,
        }
      );

    if (error) {
      let message =
        error.message;

      if (
        message.includes(
          "PERMISSION_DENIED"
        )
      ) {
        message =
          "Bạn không có quyền chỉnh Rates & Inventory.";
      }

      if (
        message.includes(
          "MISSING_INVENTORY_DATA"
        )
      ) {
        message =
          "Khoảng ngày này chưa có Inventory. Hãy Generate Calendar Data trước.";
      }

      if (
        message.includes(
          "MISSING_RATE_DATA"
        )
      ) {
        message =
          "Khoảng ngày này chưa có Rate. Hãy Generate Calendar Data trước.";
      }

      if (
        message.includes(
          "INVALID_AVAILABILITY"
        )
      ) {
        message =
          "Availability không hợp lệ hoặc lớn hơn số phòng thực tế.";
      }

      if (
        message.includes(
          "RATE_PLAN_REQUIRED"
        )
      ) {
        message =
          "Vui lòng chọn Rate Plan khi cập nhật giá.";
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

    return NextResponse.json({
      success: true,
      result: data,
    });
  } catch (error) {
    console.error(
      "Bulk ARI update:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể cập nhật Rates & Inventory.",
      },
      {
        status: 500,
      }
    );
  }
}