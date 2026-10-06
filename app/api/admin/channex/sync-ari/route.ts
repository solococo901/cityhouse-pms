import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

/* ======================================================
   TYPES
====================================================== */

type RoomMapping = {
  room_type_id: string;

  channex_room_type_id: string;
};

type RateMapping = {
  room_type_id: string;

  rate_plan_id: string;

  channex_rate_plan_id: string;
};

type InventoryRow = {
  room_type_id: string;

  stay_date: string;

  available_rooms:
    | number
    | string
    | null;

  min_stay:
    | number
    | string
    | null;

  stop_sell:
    | boolean
    | null;
};

type RateRow = {
  room_type_id: string;

  rate_plan_id: string;

  stay_date: string;

  price:
    | number
    | string
    | null;
};

type ChannexWarning =
  Record<
    string,
    unknown
  >;

type SyncWarning =
  ChannexWarning & {
    source:
      | "availability"
      | "restrictions";
  };

/* ======================================================
   HELPERS
====================================================== */

function isValidDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function dateDiff(
  start: string,
  end: string
) {
  const a =
    new Date(
      `${start}T00:00:00Z`
    );

  const b =
    new Date(
      `${end}T00:00:00Z`
    );

  return Math.round(
    (
      b.getTime() -
      a.getTime()
    ) /
      86400000
  );
}

function parseJson(
  text: string
) {
  try {
    return JSON.parse(
      text
    );
  } catch {
    return null;
  }
}

function getWarnings(
  result: unknown
): ChannexWarning[] {
  if (
    typeof result !==
      "object" ||
    result === null
  ) {
    return [];
  }

  const meta =
    (
      result as {
        meta?: {
          warnings?: unknown;
        };
      }
    ).meta;

  if (
    !Array.isArray(
      meta?.warnings
    )
  ) {
    return [];
  }

  return meta.warnings.filter(
    (
      warning:
        unknown
    ): warning is ChannexWarning =>
      typeof warning ===
        "object" &&
      warning !==
        null &&
      !Array.isArray(
        warning
      )
  );
}

/* ======================================================
   POST
====================================================== */

export async function POST(
  request: Request
) {
  const supabase =
    await createClient();

  let logPropertyId:
    string | null =
    null;

  let logConnectionId:
    string | null =
    null;

  let logStartDate =
    "";

  let logEndDate =
    "";

  let currentUserId:
    string | null =
    null;

  try {
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

    currentUserId =
      user.id;

    /* ==================================================
       BODY
    ================================================== */

    const body =
      await request.json();

    const propertyId =
      body.propertyId as
        | string
        | undefined;

    const startDate =
      body.startDate as
        | string
        | undefined;

    const endDate =
      body.endDate as
        | string
        | undefined;

    if (
      !propertyId ||
      !startDate ||
      !endDate
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu propertyId, startDate hoặc endDate.",
        },
        {
          status: 400,
        }
      );
    }

    logPropertyId =
      propertyId;

    logStartDate =
      startDate;

    logEndDate =
      endDate;

    /* ==================================================
       DATE VALIDATION
    ================================================== */

    if (
      !isValidDate(
        startDate
      ) ||
      !isValidDate(
        endDate
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Ngày không hợp lệ.",
        },
        {
          status: 400,
        }
      );
    }

    const totalDaysDiff =
      dateDiff(
        startDate,
        endDate
      );

    if (
      totalDaysDiff <
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Ngày kết thúc phải sau ngày bắt đầu.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      totalDaysDiff >
      89
    ) {
      return NextResponse.json(
        {
          error:
            "Sync tối đa 90 ngày mỗi lần.",
        },
        {
          status: 400,
        }
      );
    }

    const totalDays =
      totalDaysDiff +
      1;

    /* ==================================================
       ADMIN PERMISSION
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
            "Bạn không có quyền Admin trên property này.",
        },
        {
          status: 403,
        }
      );
    }

    /* ==================================================
       CHANNEX CONFIG
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

    const environment =
      baseUrl.includes(
        "staging"
      )
        ? "staging"
        : "production";

    const apiKey =
      process.env
        .CHANNEX_API_KEY;

    const pmsCurrency =
      process.env
        .PMS_CURRENCY ||
      "VND";

    if (
      !apiKey
    ) {
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

    /* ==================================================
       CONNECTION
    ================================================== */

    const {
      data:
        connection,

      error:
        connectionError,
    } =
      await supabase
        .from(
          "channel_connections"
        )
        .select(`
          id,
          channex_property_id,
          connection_status,
          active
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
          "environment",
          environment
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

    logConnectionId =
      connection.id;

    if (
      connection
        .connection_status !==
        "connected" ||
      !connection
        .channex_property_id
    ) {
      return NextResponse.json(
        {
          error:
            "Channex connection chưa sẵn sàng.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       LOAD PMS DATA
    ================================================== */

    const [
      roomTypesResult,
      ratePlansResult,

      roomMappingsResult,
      rateMappingsResult,

      inventoryResult,
      ratesResult,
    ] =
      await Promise.all([
        /* ROOM TYPES */

        supabase
          .from(
            "room_types"
          )
          .select(`
            id,
            name
          `)
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "active",
            true
          ),

        /* RATE PLANS */

        supabase
          .from(
            "rate_plans"
          )
          .select(`
            id,
            name
          `)
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "active",
            true
          ),

        /* ROOM MAPPINGS */

        supabase
          .from(
            "channel_room_mappings"
          )
          .select(`
            room_type_id,
            channex_room_type_id
          `)
          .eq(
            "connection_id",
            connection.id
          ),

        /* RATE MAPPINGS */

        supabase
          .from(
            "channel_rate_mappings"
          )
          .select(`
            room_type_id,
            rate_plan_id,
            channex_rate_plan_id
          `)
          .eq(
            "connection_id",
            connection.id
          ),

        /* INVENTORY */

        supabase
          .from(
            "inventory_calendar"
          )
          .select(`
            room_type_id,
            stay_date,
            available_rooms,
            min_stay,
            stop_sell
          `)
          .eq(
            "property_id",
            propertyId
          )
          .gte(
            "stay_date",
            startDate
          )
          .lte(
            "stay_date",
            endDate
          )
          .order(
            "stay_date"
          ),

        /* RATES */

        supabase
          .from(
            "rate_calendar"
          )
          .select(`
            room_type_id,
            rate_plan_id,
            stay_date,
            price
          `)
          .eq(
            "property_id",
            propertyId
          )
          .gte(
            "stay_date",
            startDate
          )
          .lte(
            "stay_date",
            endDate
          )
          .order(
            "stay_date"
          ),
      ]);

    /* ==================================================
       QUERY ERRORS
    ================================================== */

    const queryError =
      roomTypesResult.error ||
      ratePlansResult.error ||
      roomMappingsResult.error ||
      rateMappingsResult.error ||
      inventoryResult.error ||
      ratesResult.error;

    if (
      queryError
    ) {
      throw new Error(
        queryError.message
      );
    }

    const roomTypes =
      roomTypesResult.data ??
      [];

    const ratePlans =
      ratePlansResult.data ??
      [];

    const roomMappings =
      (
        roomMappingsResult.data ??
        []
      ) as RoomMapping[];

    const rateMappings =
      (
        rateMappingsResult.data ??
        []
      ) as RateMapping[];

    const inventory =
      (
        inventoryResult.data ??
        []
      ) as InventoryRow[];

    const rates =
      (
        ratesResult.data ??
        []
      ) as RateRow[];

    /* ==================================================
       VALIDATE ROOM MAPPING
    ================================================== */

    if (
      roomMappings.length !==
      roomTypes.length
    ) {
      return NextResponse.json(
        {
          error:
            `Room Type mapping chưa hoàn chỉnh (${roomMappings.length}/${roomTypes.length}).`,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       VALIDATE RATE MAPPING
    ================================================== */

    const expectedRateMappings =
      roomTypes.length *
      ratePlans.length;

    if (
      rateMappings.length !==
      expectedRateMappings
    ) {
      return NextResponse.json(
        {
          error:
            `Rate Plan mapping chưa hoàn chỉnh (${rateMappings.length}/${expectedRateMappings}).`,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       PROPERTY CURRENCY CHECK
    ================================================== */

    const propertyResponse =
      await fetch(
        `${baseUrl}/api/v1/properties/${connection.channex_property_id}`,
        {
          headers,

          cache:
            "no-store",
        }
      );

    const propertyText =
      await propertyResponse.text();

    const propertyResult =
      parseJson(
        propertyText
      );

    if (
      !propertyResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            `Không thể kiểm tra Channex Property (${propertyResponse.status}).`,

          details:
            propertyResult,
        },
        {
          status: 400,
        }
      );
    }

    const channexCurrency =
      propertyResult
        ?.data
        ?.attributes
        ?.currency ??
      "UNKNOWN";

    if (
      channexCurrency !==
      pmsCurrency
    ) {
      return NextResponse.json(
        {
          error:
            `Currency mismatch: PMS=${pmsCurrency}, Channex Property=${channexCurrency}.`,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       RATE PLAN CURRENCY CHECK
    ================================================== */

    const uniqueRatePlanIds =
      Array.from(
        new Set(
          rateMappings
            .map(
              (
                mapping
              ) =>
                mapping
                  .channex_rate_plan_id
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(
                  value
                )
            )
        )
      );

    const ratePlanChecks =
      await Promise.all(
        uniqueRatePlanIds.map(
          async (
            ratePlanId
          ) => {
            const response =
              await fetch(
                `${baseUrl}/api/v1/rate_plans/${ratePlanId}`,
                {
                  headers,

                  cache:
                    "no-store",
                }
              );

            const text =
              await response.text();

            const result =
              parseJson(
                text
              );

            return {
              id:
                ratePlanId,

              ok:
                response.ok,

              title:
                result
                  ?.data
                  ?.attributes
                  ?.title ??
                ratePlanId,

              currency:
                result
                  ?.data
                  ?.attributes
                  ?.currency ??
                "UNKNOWN",
            };
          }
        )
      );

    for (
      const check of
        ratePlanChecks
    ) {
      if (
        !check.ok
      ) {
        return NextResponse.json(
          {
            error:
              `Không thể kiểm tra Channex Rate Plan "${check.title}".`,
          },
          {
            status: 400,
          }
        );
      }

      if (
        check.currency !==
        pmsCurrency
      ) {
        return NextResponse.json(
          {
            error:
              `Rate Plan "${check.title}" (${check.id}) đang dùng ${check.currency}, cần ${pmsCurrency}.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    /* ==================================================
       MAP LOOKUPS
    ================================================== */

    const roomMap =
      new Map(
        roomMappings.map(
          (
            mapping
          ) => [
            mapping.room_type_id,
            mapping.channex_room_type_id,
          ]
        )
      );

    const rateMap =
      new Map(
        rateMappings.map(
          (
            mapping
          ) => [
            `${mapping.room_type_id}:${mapping.rate_plan_id}`,
            mapping.channex_rate_plan_id,
          ]
        )
      );

    const inventoryMap =
      new Map<
        string,
        InventoryRow
      >();

    for (
      const row of
        inventory
    ) {
      inventoryMap.set(
        `${row.room_type_id}:${row.stay_date}`,
        row
      );
    }

    /* ==================================================
       AVAILABILITY PAYLOAD
    ================================================== */

    const availabilityValues =
      inventory.map(
        (
          row
        ) => {
          const roomTypeId =
            roomMap.get(
              row.room_type_id
            );

          if (
            !roomTypeId
          ) {
            throw new Error(
              `Missing room mapping ${row.room_type_id}`
            );
          }

          const availability =
            Number(
              row.available_rooms ??
              0
            );

          if (
            !Number.isInteger(
              availability
            ) ||
            availability <
              0
          ) {
            throw new Error(
              `Invalid availability ${row.stay_date}`
            );
          }

          return {
            property_id:
              connection
                .channex_property_id,

            room_type_id:
              roomTypeId,

            date:
              row.stay_date,

            availability,
          };
        }
      );

    /* ==================================================
       RESTRICTIONS PAYLOAD
    ================================================== */

    const restrictionValues =
      rates.map(
        (
          row
        ) => {
          const mappingKey =
            `${row.room_type_id}:${row.rate_plan_id}`;

          const ratePlanId =
            rateMap.get(
              mappingKey
            );

          if (
            !ratePlanId
          ) {
            throw new Error(
              `Missing Rate Plan mapping ${mappingKey}`
            );
          }

          const price =
            Number(
              row.price ??
              0
            );

          if (
            !Number.isFinite(
              price
            ) ||
            price <=
              0
          ) {
            throw new Error(
              `Rate phải > 0: ${row.stay_date}`
            );
          }

          const inventoryRow =
            inventoryMap.get(
              `${row.room_type_id}:${row.stay_date}`
            );

          const minStay =
            Math.max(
              1,
              Number(
                inventoryRow
                  ?.min_stay ??
                1
              )
            );

          return {
            property_id:
              connection
                .channex_property_id,

            rate_plan_id:
              ratePlanId,

            date:
              row.stay_date,

            rate:
              String(
                Math.round(
                  price
                )
              ),

            min_stay_arrival:
              minStay,

            stop_sell:
              Boolean(
                inventoryRow
                  ?.stop_sell
              ),
          };
        }
      );

    /* ==================================================
       COMPLETENESS VALIDATION
    ================================================== */

    const expectedAvailability =
      roomTypes.length *
      totalDays;

    const expectedRestrictions =
      roomTypes.length *
      ratePlans.length *
      totalDays;

    if (
      availabilityValues.length !==
      expectedAvailability
    ) {
      return NextResponse.json(
        {
          error:
            `Availability chưa đủ: ${availabilityValues.length}/${expectedAvailability} rows.`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      restrictionValues.length !==
      expectedRestrictions
    ) {
      return NextResponse.json(
        {
          error:
            `Rate/Restrictions chưa đủ: ${restrictionValues.length}/${expectedRestrictions} rows.`,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       POST AVAILABILITY
    ================================================== */

    const availabilityResponse =
      await fetch(
        `${baseUrl}/api/v1/availability`,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify({
              values:
                availabilityValues,
            }),

          cache:
            "no-store",
        }
      );

    const availabilityText =
      await availabilityResponse.text();

    const availabilityResult =
      parseJson(
        availabilityText
      );

    if (
      !availabilityResponse.ok
    ) {
      await supabase
        .from(
          "channel_sync_logs"
        )
        .insert({
          property_id:
            propertyId,

          connection_id:
            connection.id,

          provider:
            "channex",

          sync_type:
            "ari",

          date_from:
            startDate,

          date_to:
            endDate,

          status:
            "error",

          availability_count:
            availabilityValues.length,

          restrictions_count:
            restrictionValues.length,

          error_message:
            `Availability HTTP ${availabilityResponse.status}`,

          availability_response:
            availabilityResult,

          created_by:
            user.id,
        });

      return NextResponse.json(
        {
          error:
            `Channex Availability trả về lỗi ${availabilityResponse.status}.`,

          response:
            availabilityResult,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       POST RESTRICTIONS
    ================================================== */

    const restrictionsResponse =
      await fetch(
        `${baseUrl}/api/v1/restrictions`,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify({
              values:
                restrictionValues,
            }),

          cache:
            "no-store",
        }
      );

    const restrictionsText =
      await restrictionsResponse.text();

    const restrictionsResult =
      parseJson(
        restrictionsText
      );

    if (
      !restrictionsResponse.ok
    ) {
      await supabase
        .from(
          "channel_sync_logs"
        )
        .insert({
          property_id:
            propertyId,

          connection_id:
            connection.id,

          provider:
            "channex",

          sync_type:
            "ari",

          date_from:
            startDate,

          date_to:
            endDate,

          status:
            "error",

          availability_count:
            availabilityValues.length,

          restrictions_count:
            restrictionValues.length,

          error_message:
            `Restrictions HTTP ${restrictionsResponse.status}`,

          availability_response:
            availabilityResult,

          restrictions_response:
            restrictionsResult,

          created_by:
            user.id,
        });

      return NextResponse.json(
        {
          error:
            `Availability đã được gửi nhưng Restrictions bị lỗi ${restrictionsResponse.status}.`,

          availability:
            availabilityResult,

          restrictions:
            restrictionsResult,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       WARNINGS
    ================================================== */

    const availabilityWarnings =
      getWarnings(
        availabilityResult
      );

    const restrictionWarnings =
      getWarnings(
        restrictionsResult
      );

    const warnings:
      SyncWarning[] = [
      ...availabilityWarnings.map(
        (
          warning
        ): SyncWarning => ({
          ...warning,

          source:
            "availability",
        })
      ),

      ...restrictionWarnings.map(
        (
          warning
        ): SyncWarning => ({
          ...warning,

          source:
            "restrictions",
        })
      ),
    ];

    const status:
      | "accepted"
      | "warning" =
      warnings.length >
      0
        ? "warning"
        : "accepted";

    /* ==================================================
       SAVE SYNC LOG
    ================================================== */

    const {
      data:
        log,

      error:
        logError,
    } =
      await supabase
        .from(
          "channel_sync_logs"
        )
        .insert({
          property_id:
            propertyId,

          connection_id:
            connection.id,

          provider:
            "channex",

          sync_type:
            "ari",

          date_from:
            startDate,

          date_to:
            endDate,

          status,

          availability_count:
            availabilityValues.length,

          restrictions_count:
            restrictionValues.length,

          warnings,

          availability_response:
            availabilityResult,

          restrictions_response:
            restrictionsResult,

          created_by:
            user.id,
        })
        .select(`
          id,
          status,
          created_at
        `)
        .single();

    if (
      logError
    ) {
      console.error(
        "Sync log error:",
        logError
      );
    }

    /* ==================================================
       SUCCESS RESPONSE
    ================================================== */

    return NextResponse.json({
      success:
        warnings.length ===
        0,

      accepted:
        true,

      status,

      currency:
        pmsCurrency,

      counts: {
        availability:
          availabilityValues.length,

        restrictions:
          restrictionValues.length,
      },

      expected: {
        availability:
          expectedAvailability,

        restrictions:
          expectedRestrictions,
      },

      warnings,

      availability:
        availabilityResult,

      restrictions:
        restrictionsResult,

      log:
        log ??
        null,
    });
  } catch (
    error
  ) {
    console.error(
      "Sync Channex ARI:",
      error
    );

    /* ==================================================
       ERROR LOG
    ================================================== */

    if (
      logPropertyId &&
      logConnectionId &&
      logStartDate &&
      logEndDate
    ) {
      await supabase
        .from(
          "channel_sync_logs"
        )
        .insert({
          property_id:
            logPropertyId,

          connection_id:
            logConnectionId,

          provider:
            "channex",

          sync_type:
            "ari",

          date_from:
            logStartDate,

          date_to:
            logEndDate,

          status:
            "error",

          error_message:
            error instanceof
            Error
              ? error.message
              : "Unknown error",

          created_by:
            currentUserId,
        });
    }

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Không thể Sync ARI.",
      },
      {
        status: 500,
      }
    );
  }
}