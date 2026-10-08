import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

/* ======================================================
   TYPES
====================================================== */

type ChannexRoomType = {
  id?: string;

  attributes?: {
    id?: string;

    title?: string;

    property_id?: string;

    default_occupancy?:
      number;
  };
};

type ChannexRatePlan = {
  id?: string;

  attributes?: {
    id?: string;

    title?: string;

    property_id?: string;

    room_type_id?: string;

    occupancy?: number;

    parent_rate_plan_id?:
      string | null;

    sell_mode?: string;
  };
};

/* ======================================================
   GET
====================================================== */

export async function GET(
  request: Request
) {
 
    const supabase =
      await createClient();
 try {
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
       PROPERTY ID
    ========================================= */

    const url =
      new URL(
        request.url
      );

    const propertyId =
      url.searchParams.get(
        "propertyId"
      );

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
       ACCESS
    ========================================= */

    const {
      data: canAccess,
      error: accessError,
    } =
      await supabase.rpc(
        "can_access_property",
        {
          target_property_id:
            propertyId,
        }
      );

    if (
      accessError ||
      !canAccess
    ) {
      return NextResponse.json(
        {
          error:
            "Không có quyền truy cập property.",
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
      error: connectionError,
    } =
      await supabase
        .from(
          "channel_connections"
        )
        .select(`
          id,
          channex_property_id,
          environment
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
            "Property chưa được kết nối Channex.",
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

    /* =========================================
       CHANNEX ROOM TYPES
    ========================================= */

    const roomTypesUrl =
      new URL(
        `${baseUrl}/api/v1/room_types/options`
      );

    const ratePlansUrl =
      new URL(
        `${baseUrl}/api/v1/rate_plans/options`
      );

    ratePlansUrl.searchParams.set(
      "filter[property_id]",
      connection
        .channex_property_id
    );

    /* =========================================
       FETCH
    ========================================= */

    const [
      roomResponse,
      rateResponse,
    ] =
      await Promise.all([
        fetch(
          roomTypesUrl,
          {
            headers: {
              Accept:
                "application/json",

              "user-api-key":
                apiKey,
            },

            cache:
              "no-store",
          }
        ),

        fetch(
          ratePlansUrl,
          {
            headers: {
              Accept:
                "application/json",

              "user-api-key":
                apiKey,
            },

            cache:
              "no-store",
          }
        ),
      ]);

    /* =========================================
       ERROR
    ========================================= */

    if (
      !roomResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            `Không thể lấy Room Types từ Channex (${roomResponse.status}).`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !rateResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            `Không thể lấy Rate Plans từ Channex (${rateResponse.status}).`,
        },
        {
          status: 400,
        }
      );
    }

    const roomResult =
      await roomResponse.json();

    const rateResult =
      await rateResponse.json();

    /* =========================================
       NORMALIZE ROOM TYPES

       room_types/options trả toàn account,
       nên lọc lại theo Channex Property ID.
    ========================================= */

    const roomTypes =
      (
        Array.isArray(
          roomResult?.data
        )
          ? roomResult.data
          : []
      )
        .filter(
          (
            item:
              ChannexRoomType
          ) =>
            item.attributes
              ?.property_id ===
            connection
              .channex_property_id
        )
        .map(
          (
            item:
              ChannexRoomType
          ) => ({
            id:
              item.id ??
              "",

            title:
              item.attributes
                ?.title ??
              "Unnamed Room Type",

            propertyId:
              item.attributes
                ?.property_id ??
              "",

            defaultOccupancy:
              Number(
                item.attributes
                  ?.default_occupancy ??
                0
              ),
          })
        );

    /* =========================================
       NORMALIZE RATE PLANS
    ========================================= */

    const ratePlans =
      (
        Array.isArray(
          rateResult?.data
        )
          ? rateResult.data
          : []
      ).map(
        (
          item:
            ChannexRatePlan
        ) => ({
          id:
            item.id ??
            "",

          title:
            item.attributes
              ?.title ??
            "Unnamed Rate Plan",

          propertyId:
            item.attributes
              ?.property_id ??
            "",

          roomTypeId:
            item.attributes
              ?.room_type_id ??
            "",

          occupancy:
            Number(
              item.attributes
                ?.occupancy ??
              0
            ),

          parentRatePlanId:
            item.attributes
              ?.parent_rate_plan_id ??
            null,

          sellMode:
            item.attributes
              ?.sell_mode ??
            "",
        })
      );

    /* =========================================
       SUCCESS
    ========================================= */

    return NextResponse.json({
      success: true,

      connectionId:
        connection.id,

      channexPropertyId:
        connection
          .channex_property_id,

      roomTypes,

      ratePlans,
    });
  } catch (error) {
    console.error(
      "Channex mapping options:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể tải dữ liệu mapping.",
      },
      {
        status: 500,
      }
    );
  }
}