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


    const {
      bookingId,
      status,
    } =
      await request.json();


    if (
      !bookingId ||
      !status
    ) {

      return NextResponse.json(
        {
          error:
            "Missing bookingId or status",
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
        "set_booking_status",
        {

          p_booking_id:
            bookingId,

          p_status:
            status,

        }
      );


    if (error) {

      let message =
        error.message;


      if (
        message.includes(
          "INVALID_STATUS_TRANSITION"
        )
      ) {

        message =
          "Trạng thái booking hiện tại không cho phép thao tác này.";

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
          "Không thể cập nhật booking.",
      },
      {
        status: 500,
      }
    );

  }

}