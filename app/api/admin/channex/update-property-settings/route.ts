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

    /* =========================================
       AUTH
    ========================================= */

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

    /* =========================================
       BODY
    ========================================= */

    const body =
      await request.json();

    const propertyId =
      body.propertyId as
        | string
        | undefined;

    if (!propertyId) {
      return NextResponse.json(
        {
          error:
            "Thiếu propertyId.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       ADMIN PERMISSION
    ========================================= */

    const {
      data: canManage,
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
            "Bạn không có quyền Admin trên property này.",
        },
        {
          status: 403,
        }
      );
    }

    /* =========================================
       CONNECTION
    ========================================= */

    const {
      data: connection,
      error:
        connectionError,
    } =
      await supabase
        .from(
          "channel_connections"
        )
        .select(`
          id,
          channex_property_id
        `)
        .eq(
          "property_id",
          propertyId
        )
        .eq(
          "provider",
          "channex"
        )
        .eq(
          "active",
          true
        )
        .maybeSingle();

    if (
      connectionError ||
      !connection
    ) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy Channex connection.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      !connection
        .channex_property_id
    ) {
      return NextResponse.json(
        {
          error:
            "Property chưa được map với Channex.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       ENV
    ========================================= */

    const baseUrl =
      (
        process.env
          .CHANNEX_BASE_URL ||
        "https://staging.channex.io"
      ).replace(
        /\/+$/,
        ""
      );

    const apiKey =
      process.env
        .CHANNEX_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Server chưa cấu hình CHANNEX_API_KEY.",
        },
        {
          status: 500,
        }
      );
    }

    const headers = {
      Accept:
        "application/json",

      "Content-Type":
        "application/json",

      "user-api-key":
        apiKey,
    };

    /* =========================================
       GET CURRENT PROPERTY
    ========================================= */

    const currentResponse =
      await fetch(
        `${baseUrl}/api/v1/properties/${connection.channex_property_id}`,
        {
          method:
            "GET",

          headers,

          cache:
            "no-store",
        }
      );

    const currentText =
      await currentResponse.text();

    let currentResult:
      any = null;

    try {
      currentResult =
        JSON.parse(
          currentText
        );
    } catch {
      currentResult =
        null;
    }

    if (
      !currentResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            `Không thể đọc Channex Property (${currentResponse.status}).`,
        },
        {
          status: 400,
        }
      );
    }

    const attributes =
      currentResult
        ?.data
        ?.attributes;

    if (
      !attributes
    ) {
      return NextResponse.json(
        {
          error:
            "Channex không trả về Property attributes.",
        },
        {
          status: 400,
        }
      );
    }

    const title =
      attributes.title ||
      attributes.name;

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Không lấy được title của Channex Property.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       UPDATE PROPERTY
    ========================================= */

    const updateResponse =
      await fetch(
        `${baseUrl}/api/v1/properties/${connection.channex_property_id}`,
        {
          method:
            "PUT",

          headers,

          body:
            JSON.stringify({
              property: {
                title,

                currency:
                  "VND",

                timezone:
                  "Asia/Ho_Chi_Minh",
              },
            }),

          cache:
            "no-store",
        }
      );

    const updateText =
      await updateResponse.text();

    let updateResult:
      any = null;

    try {
      updateResult =
        JSON.parse(
          updateText
        );
    } catch {
      updateResult =
        null;
    }

    if (
      !updateResponse.ok
    ) {
      console.error(
        "Update Channex property:",
        updateResponse.status,
        updateResult ??
          updateText
      );

      return NextResponse.json(
        {
          error:
            updateResult
              ?.errors
              ?.title ||
            `Channex trả về lỗi ${updateResponse.status}.`,

          details:
            updateResult
              ?.errors
              ?.details ??
            null,
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       VERIFY AGAIN
    ========================================= */

    const verifyResponse =
      await fetch(
        `${baseUrl}/api/v1/properties/${connection.channex_property_id}`,
        {
          method:
            "GET",

          headers,

          cache:
            "no-store",
        }
      );

    const verifyResult =
      await verifyResponse.json();

    const verifyAttributes =
      verifyResult
        ?.data
        ?.attributes;

    return NextResponse.json({
      success: true,

      propertyId:
        connection
          .channex_property_id,

      title:
        verifyAttributes
          ?.title ??
        title,

      currency:
        verifyAttributes
          ?.currency ??
        null,

      timezone:
        verifyAttributes
          ?.timezone ??
        null,
    });
  } catch (error) {
    console.error(
      "Update Channex Property Settings:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể cập nhật Channex Property.",
      },
      {
        status: 500,
      }
    );
  }
}