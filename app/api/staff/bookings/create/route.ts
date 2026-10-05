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
      roomId,

      checkIn,
      checkOut,

      firstName,
      lastName,

      phone,
      email,

      adults,
      children,

      totalAmount,
      notes,
    } = body;


    if (
      !propertyId ||
      !roomId ||
      !checkIn ||
      !checkOut ||
      !firstName
    ) {

      return NextResponse.json(
        {
          error:
            "Vui lòng nhập đầy đủ thông tin bắt buộc.",
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
        "create_manual_booking",
        {

          p_property_id:
            propertyId,

          p_room_id:
            roomId,

          p_check_in:
            checkIn,

          p_check_out:
            checkOut,

          p_first_name:
            firstName,

          p_last_name:
            lastName || "",

          p_phone:
            phone || "",

          p_email:
            email || "",

          p_adults:
            Number(adults || 1),

          p_children:
            Number(children || 0),

          p_total_amount:
            Number(
              totalAmount || 0
            ),

          p_notes:
            notes || "",

        }
      );


    if (error) {

      let message =
        error.message;


      if (
        message.includes(
          "ROOM_OCCUPIED"
        )
      ) {

        message =
          "Phòng này đã có booking trong khoảng ngày đã chọn.";

      }


      if (
        message.includes(
          "NO_INVENTORY"
        )
      ) {

        message =
          "Room type này không còn inventory hoặc đang Stop Sell.";

      }


      if (
        message.includes(
          "INVALID_DATE_RANGE"
        )
      ) {

        message =
          "Ngày check-out phải sau ngày check-in.";

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


  } catch {

    return NextResponse.json(
      {
        error:
          "Không thể tạo booking.",
      },
      {
        status: 500,
      }
    );

  }

}