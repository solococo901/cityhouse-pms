import { NextResponse } from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

type ChannexProperty = {
  id?: string;

  attributes?: {
    title?: string;
    name?: string;
  };
};

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

    /* =========================================
       BODY
    ========================================= */

    const body =
      await request.json();

    const {
      propertyId,
      channexPropertyId,
    } = body;

    if (
      !propertyId ||
      !channexPropertyId
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu thông tin mapping.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       PMS PROPERTY
    ========================================= */

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
      return NextResponse.json(
        {
          error:
            propertyError.message,
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
            "Không tìm thấy PMS property.",
        },
        {
          status: 404,
        }
      );
    }

    /* =========================================
       ADMIN PERMISSION

       Database của bạn đang dùng parameter:
       target_property_id
    ========================================= */

    const {
      data: canManage,
      error: permissionError,
    } =
      await supabase.rpc(
        "can_manage_property",
        {
          target_property_id:
            propertyId,
        }
      );

    if (permissionError) {
      console.error(
        "Permission:",
        permissionError
      );

      return NextResponse.json(
        {
          error:
            `Không thể kiểm tra quyền: ${permissionError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    if (!canManage) {
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
       CHANNEX CONFIG
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

    /* =========================================
       VERIFY CHANNEX PROPERTY
    ========================================= */

    const channexResponse =
      await fetch(
        `${baseUrl}/api/v1/properties/`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            "user-api-key":
              apiKey,
          },

          cache:
            "no-store",
        }
      );

    const rawText =
      await channexResponse.text();

    let channexResult: any =
      null;

    try {
      channexResult =
        JSON.parse(
          rawText
        );
    } catch {
      channexResult =
        null;
    }

    if (
      !channexResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            `Channex trả về lỗi ${channexResponse.status}.`,
        },
        {
          status: 400,
        }
      );
    }

    const channexProperties:
      ChannexProperty[] =
      Array.isArray(
        channexResult?.data
      )
        ? channexResult.data
        : [];

    const selected =
      channexProperties.find(
        (item) =>
          item.id ===
          channexPropertyId
      );

    if (!selected) {
      return NextResponse.json(
        {
          error:
            "Property Channex không thuộc API Key hiện tại.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================
       SAVE CONNECTION
    ========================================= */

    const environment =
      baseUrl.includes(
        "staging"
      )
        ? "staging"
        : "production";

    const now =
      new Date()
        .toISOString();

    const {
      data: connection,
      error: saveError,
    } =
      await supabase
        .from(
          "channel_connections"
        )
        .upsert(
          {
            property_id:
              propertyId,

            provider:
              "channex",

            environment,

            channex_property_id:
              channexPropertyId,

            connection_status:
              "connected",

            active:
              true,

            last_tested_at:
              now,

            last_error:
              null,

            updated_at:
              now,
          },
          {
            onConflict:
              "property_id,provider,environment",
          }
        )
        .select(`
          id,
          property_id,
          provider,
          environment,
          channex_property_id,
          connection_status
        `)
        .single();

    if (saveError) {
      console.error(
        "Save connection:",
        saveError
      );

      return NextResponse.json(
        {
          error:
            `Không thể lưu mapping: ${saveError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,

      connection,

      channexProperty: {
        id:
          selected.id,

        title:
          selected.attributes
            ?.title ??
          selected.attributes
            ?.name ??
          "Channex Property",
      },
    });
  } catch (error) {
    console.error(
      "Map Channex property:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể map property.",
      },
      {
        status: 500,
      }
    );
  }
}