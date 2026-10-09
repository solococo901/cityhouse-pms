import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getErrorMessage(message: string): string {
  if (message.includes("PERMISSION_DENIED")) {
    return "Bạn không có quyền tạo booking cho property này.";
  }

  if (message.includes("ROOM_TYPE_NOT_FOUND")) {
    return "Room Type không tồn tại hoặc đã ngưng hoạt động.";
  }

  if (message.includes("RATE_PLAN_NOT_FOUND")) {
    return "Rate Plan không hợp lệ hoặc đã ngưng hoạt động.";
  }

  if (message.includes("INVALID_DATE_RANGE")) {
    return "Ngày check-out phải sau ngày check-in.";
  }

  if (message.includes("RATE_NOT_FOUND")) {
    return "Rate Calendar chưa có đủ giá cho thời gian lưu trú.";
  }

  if (message.includes("INVALID_RATE")) {
    return "Giá phòng trong Rate Calendar không hợp lệ.";
  }

  if (message.includes("NO_INVENTORY")) {
    return "Không còn inventory khả dụng trong thời gian đã chọn.";
  }

  if (message.includes("GUEST_NAME_REQUIRED")) {
    return "Vui lòng nhập tên khách.";
  }

  if (message.includes("INVALID_GUEST_COUNT")) {
    return "Số lượng khách không hợp lệ.";
  }

  if (message.includes("INVALID_TOTAL_AMOUNT")) {
    return "Tổng tiền booking không hợp lệ.";
  }

  return "Không thể tạo booking Unassigned. " + message;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const propertyId =
      typeof body.propertyId === "string"
        ? body.propertyId.trim()
        : "";

    const roomTypeId =
      typeof body.roomTypeId === "string"
        ? body.roomTypeId.trim()
        : "";

    const ratePlanId =
      typeof body.ratePlanId === "string"
        ? body.ratePlanId.trim()
        : "";

    const checkIn =
      typeof body.checkIn === "string"
        ? body.checkIn.trim()
        : "";

    const checkOut =
      typeof body.checkOut === "string"
        ? body.checkOut.trim()
        : "";

    const firstName =
      typeof body.firstName === "string"
        ? body.firstName.trim()
        : "";

    const lastName =
      typeof body.lastName === "string"
        ? body.lastName.trim()
        : "";

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim()
        : "";

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : "";

    const adults = Number(body.adults ?? 1);
    const children = Number(body.children ?? 0);
    const totalAmount = Number(body.totalAmount);

    if (
      !propertyId ||
      !roomTypeId ||
      !ratePlanId ||
      !firstName ||
      !isValidDate(checkIn) ||
      !isValidDate(checkOut) ||
      checkOut <= checkIn
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu property, Room Type, Rate Plan, tên khách hoặc ngày lưu trú không hợp lệ.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(adults) ||
      adults < 1 ||
      !Number.isInteger(children) ||
      children < 0 ||
      !Number.isFinite(totalAmount) ||
      totalAmount < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Số khách hoặc tổng tiền không hợp lệ.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc(
      "create_unassigned_booking",
      {
        p_property_id: propertyId,
        p_room_type_id: roomTypeId,
        p_rate_plan_id: ratePlanId,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: phone,
        p_email: email,
        p_adults: adults,
        p_children: children,
        p_total_amount: totalAmount,
        p_notes: notes,
      }
    );

    if (error) {
      console.error(
        "Create Unassigned Booking RPC:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: getErrorMessage(error.message || ""),
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      result: data,
    });
  } catch (error) {
    console.error("Create Unassigned Booking:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Không thể tạo booking Unassigned.",
      },
      { status: 500 }
    );
  }
}