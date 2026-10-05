import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/* ======================================================
   TYPES
====================================================== */

type ChannexProperty = {
  id?: string;

  attributes?: {
    title?: string;
    name?: string;

    city?: string;
    country?: string;

    currency?: string;
    timezone?: string;
  };
};

/* ======================================================
   POST
====================================================== */

export async function POST(
  request: Request
) {
  try {
    /* ==================================================
       SUPABASE
    ================================================== */

    const supabase =
      await createClient();

    /* ==================================================
       AUTH
    ================================================== */

    const {
      data: {
        user,
      },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
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

    const {
      propertyId,
    } = body;

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

    /* ==================================================
       CHECK PMS PROPERTY

       Không gọi can_access_property() ở đây nữa.

       Query này chạy bằng Supabase session hiện tại.
    ================================================== */

    const {
      data: property,
      error: propertyError,
    } =
      await supabase
        .from("properties")
        .select(`
          id,
          code,
          name
        `)
        .eq(
          "id",
          propertyId
        )
        .maybeSingle();

    if (propertyError) {
      console.error(
        "Property query error:",
        propertyError
      );

      return NextResponse.json(
        {
          error:
            `Không thể đọc property: ${propertyError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    if (!property) {
      return NextResponse.json(
        {
          error:
            "Không tìm thấy property hoặc tài khoản hiện tại không có quyền truy cập.",
        },
        {
          status: 404,
        }
      );
    }

    /* ==================================================
       ENVIRONMENT
    ================================================== */

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

    /* ==================================================
       CHANNEX REQUEST
    ================================================== */

    const response =
      await fetch(
        `${baseUrl}/api/v1/properties/`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            "user-api-key":
              apiKey,
          },

          cache:
            "no-store",
        }
      );

    /* ==================================================
       READ RESPONSE
    ================================================== */

    const rawText =
      await response.text();

    let result: any =
      null;

    if (rawText) {
      try {
        result =
          JSON.parse(
            rawText
          );
      } catch {
        result =
          null;
      }
    }

    /* ==================================================
       CHANNEX ERROR
    ================================================== */

    if (!response.ok) {
      console.error(
        "Channex API error:",
        {
          status:
            response.status,

          body:
            result ??
            rawText,
        }
      );

      let message =
        `Channex trả về lỗi ${response.status}.`;

      if (
        response.status ===
        401
      ) {
        message =
          "Channex API Key không hợp lệ hoặc API Key chưa được kích hoạt.";
      }

      if (
        response.status ===
        403
      ) {
        message =
          "Channex API Key không có quyền truy cập property.";
      }

      return NextResponse.json(
        {
          error:
            message,

          channexStatus:
            response.status,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       NORMALIZE PROPERTIES
    ================================================== */

    const rawProperties =
      Array.isArray(
        result?.data
      )
        ? result.data
        : [];

    const properties =
      rawProperties.map(
        (
          item:
            ChannexProperty
        ) => ({
          id:
            item.id ??
            "",

          title:
            item.attributes
              ?.title ??
            item.attributes
              ?.name ??
            "Unnamed property",

          city:
            item.attributes
              ?.city ??
            "",

          country:
            item.attributes
              ?.country ??
            "",

          currency:
            item.attributes
              ?.currency ??
            "",

          timezone:
            item.attributes
              ?.timezone ??
            "",
        })
      );

    /* ==================================================
       SUCCESS
    ================================================== */

    return NextResponse.json({
      success: true,

      environment:
        baseUrl.includes(
          "staging"
        )
          ? "staging"
          : "production",

      pmsProperty: {
        id:
          property.id,

        code:
          property.code,

        name:
          property.name,
      },

      count:
        properties.length,

      properties,
    });
  } catch (error) {
    console.error(
      "Channex test connection error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể kết nối tới Channex.",
      },
      {
        status: 500,
      }
    );
  }
}