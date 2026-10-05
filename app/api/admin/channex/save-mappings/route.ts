import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

type RoomMapping = {
  roomTypeId: string;
  channexRoomTypeId: string;
};

type RateMapping = {
  roomTypeId: string;
  ratePlanId: string;
  channexRatePlanId: string;
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

    const roomMappings =
      (
        Array.isArray(
          body.roomMappings
        )
          ? body.roomMappings
          : []
      ) as RoomMapping[];

    const rateMappings =
      (
        Array.isArray(
          body.rateMappings
        )
          ? body.rateMappings
          : []
      ) as RateMapping[];

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
       ADMIN
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
      error: connectionError,
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
        .single();

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

    /* =========================================
       REQUIRE COMPLETE ROOM MAPPING
    ========================================= */

    const {
      data: pmsRoomTypes,
    } =
      await supabase
        .from(
          "room_types"
        )
        .select(`
          id
        `)
        .eq(
          "property_id",
          propertyId
        )
        .eq(
          "active",
          true
        );

    const validRoomIds =
      new Set(
        (
          pmsRoomTypes ??
          []
        ).map(
          (
            item
          ) =>
            item.id
        )
      );

    for (
      const mapping of
        roomMappings
    ) {
      if (
        !validRoomIds.has(
          mapping.roomTypeId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Có Room Type PMS không hợp lệ.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /* =========================================
       SAVE VIA TRANSACTION RPC
    ========================================= */

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "replace_channel_mappings",
        {
          target_connection_id:
            connection.id,

          room_mappings:
            roomMappings,

          rate_mappings:
            rateMappings,
        }
      );

    if (error) {
      console.error(
        "Save mappings:",
        error
      );

      return NextResponse.json(
        {
          error:
            error.message,
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
      "Save Channex mappings:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Không thể lưu mapping.",
      },
      {
        status: 500,
      }
    );
  }
}