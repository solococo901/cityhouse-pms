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

type Issue = {
  code: string;

  type:
    | "error"
    | "warning";

  message: string;
};

type RatePlanCurrencyCheck = {
  id: string;

  title: string;

  currency: string;

  ok: boolean;
};

/* ======================================================
   HELPERS
====================================================== */

function validDate(
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
  const startDate =
    new Date(
      `${start}T00:00:00Z`
    );

  const endDate =
    new Date(
      `${end}T00:00:00Z`
    );

  return Math.round(
    (
      endDate.getTime() -
      startDate.getTime()
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

/* ======================================================
   GET
====================================================== */

export async function GET(
  request: Request
) {
 
    const supabase =
      await createClient();

       try {
    /* ==================================================
       AUTH
    ================================================== */

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

    /* ==================================================
       QUERY PARAMS
    ================================================== */

    const url =
      new URL(
        request.url
      );

    const propertyId =
      url.searchParams.get(
        "propertyId"
      );

    const startDate =
      url.searchParams.get(
        "startDate"
      );

    const endDate =
      url.searchParams.get(
        "endDate"
      );

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

    if (
      !validDate(
        startDate
      ) ||
      !validDate(
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

    const rangeDays =
      dateDiff(
        startDate,
        endDate
      );

    if (
      rangeDays <
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
      rangeDays >
      89
    ) {
      return NextResponse.json(
        {
          error:
            "Preview tối đa 90 ngày.",
        },
        {
          status: 400,
        }
      );
    }

    const totalDays =
      rangeDays +
      1;

    /* ==================================================
       ACCESS
    ================================================== */

    const {
      data: canAccess,
      error:
        accessError,
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

    const apiKey =
      process.env
        .CHANNEX_API_KEY;

    const environment =
      baseUrl.includes(
        "staging"
      )
        ? "staging"
        : "production";

    const pmsCurrency =
      process.env
        .PMS_CURRENCY ||
      "VND";

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

    const channexHeaders = {
      Accept:
        "application/json",

      "user-api-key":
        apiKey,
    };

    /* ==================================================
       CONNECTION
    ================================================== */

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
            "Property chưa được map hoàn chỉnh với Channex.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       PMS STRUCTURE + MAPPINGS
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
        /* PMS ROOM TYPES */

        supabase
          .from(
            "room_types"
          )
          .select(`
            id,
            code,
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

        /* PMS RATE PLANS */

        supabase
          .from(
            "rate_plans"
          )
          .select(`
            id,
            code,
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

    const firstError =
      roomTypesResult.error ||
      ratePlansResult.error ||
      roomMappingsResult.error ||
      rateMappingsResult.error ||
      inventoryResult.error ||
      ratesResult.error;

    if (
      firstError
    ) {
      return NextResponse.json(
        {
          error:
            firstError.message,
        },
        {
          status: 500,
        }
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
       MAPPING CHECK
    ================================================== */

    const roomMappingMap =
      new Map(
        roomMappings.map(
          (
            item
          ) => [
            item.room_type_id,
            item.channex_room_type_id,
          ]
        )
      );

    const rateMappingMap =
      new Map(
        rateMappings.map(
          (
            item
          ) => [
            `${item.room_type_id}:${item.rate_plan_id}`,
            item.channex_rate_plan_id,
          ]
        )
      );

    const missingRooms =
      roomTypes.filter(
        (
          room
        ) =>
          !roomMappingMap.has(
            room.id
          )
      );

    const missingRates:
      {
        room: string;
        rate: string;
      }[] = [];

    for (
      const room of
        roomTypes
    ) {
      for (
        const rate of
          ratePlans
      ) {
        if (
          !rateMappingMap.has(
            `${room.id}:${rate.id}`
          )
        ) {
          missingRates.push({
            room:
              room.name,

            rate:
              rate.name,
          });
        }
      }
    }

    if (
      missingRooms.length >
        0 ||
      missingRates.length >
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Room/Rate Mapping chưa hoàn chỉnh.",

          missingRooms:
            missingRooms.map(
              (
                item
              ) =>
                item.name
            ),

          missingRates,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       ISSUES
    ================================================== */

    const issues:
      Issue[] =
      [];

    /* ==================================================
       CHANNEX PROPERTY
    ================================================== */

    const propertyResponse =
      await fetch(
        `${baseUrl}/api/v1/properties/${connection.channex_property_id}`,
        {
          headers:
            channexHeaders,

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
            `Không thể đọc Channex Property (${propertyResponse.status}).`,
        },
        {
          status: 400,
        }
      );
    }

    const channexProperty =
      propertyResult
        ?.data ??
      null;

    const channexCurrency =
      channexProperty
        ?.attributes
        ?.currency ??
      "UNKNOWN";

    if (
      channexCurrency !==
      pmsCurrency
    ) {
      issues.push({
        code:
          "PROPERTY_CURRENCY_MISMATCH",

        type:
          "error",

        message:
          `Currency Property không khớp: PMS = ${pmsCurrency}, Channex Property = ${channexCurrency}.`,
      });
    }

    /* ==================================================
       CHANNEX RATE PLAN CURRENCY CHECK

       Property VND chưa đủ.
       Tất cả mapped Rate Plans cũng phải VND.
    ================================================== */

    const uniqueRatePlanIds =
      Array.from(
        new Set(
          rateMappings
            .map(
              (
                item
              ) =>
                item
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

    const ratePlanCurrencyChecks:
      RatePlanCurrencyCheck[] =
      await Promise.all(
        uniqueRatePlanIds.map(
          async (
            ratePlanId
          ) => {
            try {
              const response =
                await fetch(
                  `${baseUrl}/api/v1/rate_plans/${ratePlanId}`,
                  {
                    headers:
                      channexHeaders,

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

                ok:
                  response.ok,
              };
            } catch {
              return {
                id:
                  ratePlanId,

                title:
                  ratePlanId,

                currency:
                  "UNKNOWN",

                ok:
                  false,
              };
            }
          }
        )
      );

    for (
      const ratePlan of
        ratePlanCurrencyChecks
    ) {
      if (
        !ratePlan.ok
      ) {
        issues.push({
          code:
            "RATE_PLAN_CHECK_FAILED",

          type:
            "error",

          message:
            `Không thể đọc Channex Rate Plan "${ratePlan.title}" (${ratePlan.id}).`,
        });

        continue;
      }

      if (
        ratePlan.currency !==
        pmsCurrency
      ) {
        issues.push({
          code:
            "RATE_PLAN_CURRENCY_MISMATCH",

          type:
            "error",

          message:
            `Rate Plan "${ratePlan.title}" đang dùng ${ratePlan.currency}, PMS yêu cầu ${pmsCurrency}.`,
        });
      }
    }

    /* ==================================================
       INVENTORY LOOKUP
    ================================================== */

    const inventoryMap =
      new Map<
        string,
        InventoryRow
      >();

    for (
      const item of
        inventory
    ) {
      inventoryMap.set(
        `${item.room_type_id}:${item.stay_date}`,
        item
      );
    }

    /* ==================================================
       AVAILABILITY PAYLOAD
    ================================================== */

    const availabilityValues =
      inventory.flatMap(
        (
          item
        ) => {
          const channexRoomTypeId =
            roomMappingMap.get(
              item.room_type_id
            );

          if (
            !channexRoomTypeId
          ) {
            return [];
          }

          const availability =
            Number(
              item.available_rooms ??
              0
            );

          return [
            {
              property_id:
                connection
                  .channex_property_id,

              room_type_id:
                channexRoomTypeId,

              date:
                item.stay_date,

              availability:
                Math.max(
                  0,
                  availability
                ),
            },
          ];
        }
      );

    /* ==================================================
       RESTRICTIONS PAYLOAD
    ================================================== */

    const restrictionValues =
      rates.flatMap(
        (
          item
        ) => {
          const mappingKey =
            `${item.room_type_id}:${item.rate_plan_id}`;

          const channexRatePlanId =
            rateMappingMap.get(
              mappingKey
            );

          if (
            !channexRatePlanId
          ) {
            return [];
          }

          const inventoryRow =
            inventoryMap.get(
              `${item.room_type_id}:${item.stay_date}`
            );

          const value: {
            property_id: string;

            rate_plan_id: string;

            date: string;

            rate: string;

            min_stay_arrival?:
              number;

            stop_sell?:
              boolean;
          } = {
            property_id:
              connection
                .channex_property_id,

            rate_plan_id:
              channexRatePlanId,

            date:
              item.stay_date,

            rate:
              String(
                Math.round(
                  Number(
                    item.price ??
                    0
                  )
                )
              ),
          };

          if (
            inventoryRow
          ) {
            value.min_stay_arrival =
              Math.max(
                1,
                Number(
                  inventoryRow
                    .min_stay ??
                  1
                )
              );

            value.stop_sell =
              Boolean(
                inventoryRow
                  .stop_sell
              );
          }

          return [
            value,
          ];
        }
      );

    /* ==================================================
       EXPECTED ROW COUNTS
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
      issues.push({
        code:
          "INCOMPLETE_AVAILABILITY",

        type:
          "error",

        message:
          `Availability chưa đủ. Có ${availabilityValues.length}/${expectedAvailability} rows cho ${roomTypes.length} Room Types × ${totalDays} ngày.`,
      });
    }

    if (
      restrictionValues.length !==
      expectedRestrictions
    ) {
      issues.push({
        code:
          "INCOMPLETE_RATES",

        type:
          "error",

        message:
          `Rate data chưa đủ. Có ${restrictionValues.length}/${expectedRestrictions} rows cho ${roomTypes.length} Room Types × ${ratePlans.length} Rate Plans × ${totalDays} ngày.`,
      });
    }

    /* ==================================================
       INVALID AVAILABILITY
    ================================================== */

    const invalidAvailability =
      availabilityValues.filter(
        (
          item
        ) =>
          !Number.isInteger(
            item.availability
          ) ||
          item.availability <
            0
      );

    if (
      invalidAvailability.length >
      0
    ) {
      issues.push({
        code:
          "INVALID_AVAILABILITY",

        type:
          "error",

        message:
          `${invalidAvailability.length} Availability rows không hợp lệ.`,
      });
    }

    /* ==================================================
       ZERO / INVALID RATE
    ================================================== */

    const invalidRates =
      restrictionValues.filter(
        (
          item
        ) => {
          const rate =
            Number(
              item.rate
            );

          return (
            !Number.isFinite(
              rate
            ) ||
            rate <=
              0
          );
        }
      );

    if (
      invalidRates.length >
      0
    ) {
      issues.push({
        code:
          "INVALID_RATE",

        type:
          "error",

        message:
          `${invalidRates.length} rate rows có giá <= 0 hoặc không hợp lệ.`,
      });
    }

    /* ==================================================
       EMPTY DATA
    ================================================== */

    if (
      availabilityValues.length ===
      0
    ) {
      issues.push({
        code:
          "NO_AVAILABILITY",

        type:
          "error",

        message:
          "Không có Inventory trong khoảng ngày đã chọn.",
      });
    }

    if (
      restrictionValues.length ===
      0
    ) {
      issues.push({
        code:
          "NO_RATES",

        type:
          "error",

        message:
          "Không có Rate data trong khoảng ngày đã chọn.",
      });
    }

    /* ==================================================
       READY
    ================================================== */

    const ready =
      !issues.some(
        (
          issue
        ) =>
          issue.type ===
          "error"
      );

    /* ==================================================
       RESPONSE
    ================================================== */

    return NextResponse.json({
      success: true,

      ready,

      dateRange: {
        startDate,
        endDate,

        days:
          totalDays,
      },

      property: {
        pmsCurrency,

        channexPropertyId:
          connection
            .channex_property_id,

        channexTitle:
          channexProperty
            ?.attributes
            ?.title ??
          channexProperty
            ?.attributes
            ?.name ??
          "Channex Property",

        channexCurrency,

        channexTimezone:
          channexProperty
            ?.attributes
            ?.timezone ??
          "",
      },

      mapping: {
        roomTypes:
          roomMappings.length,

        ratePlans:
          rateMappings.length,
      },

      expected: {
        availability:
          expectedAvailability,

        restrictions:
          expectedRestrictions,
      },

      counts: {
        availability:
          availabilityValues.length,

        restrictions:
          restrictionValues.length,
      },

      ratePlanCurrencies:
        ratePlanCurrencyChecks,

      issues,

      availabilityPayload: {
        values:
          availabilityValues,
      },

      restrictionsPayload: {
        values:
          restrictionValues,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "ARI preview:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Không thể tạo ARI Preview.",
      },
      {
        status: 500,
      }
    );
  }
}