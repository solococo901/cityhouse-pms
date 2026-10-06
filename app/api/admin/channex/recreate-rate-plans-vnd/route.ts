import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

/* ======================================================
   TYPES
====================================================== */

type MappingRow = {
  room_type_id: string;

  rate_plan_id: string;

  channex_rate_plan_id: string;
};

type PmsRoomType = {
  id: string;

  name: string;

  code: string;
};

type PmsRatePlan = {
  id: string;

  name: string;

  code: string;
};

/* ======================================================
   HELPERS
====================================================== */

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

function todayVietnam() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Ho_Chi_Minh",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (
        item
      ) =>
        item.type ===
        "year"
    )?.value ?? "";

  const month =
    parts.find(
      (
        item
      ) =>
        item.type ===
        "month"
    )?.value ?? "";

  const day =
    parts.find(
      (
        item
      ) =>
        item.type ===
        "day"
    )?.value ?? "";

  return `${year}-${month}-${day}`;
}

/* ======================================================
   POST
====================================================== */

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

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

    /* ==================================================
       BODY
    ================================================== */

    const body =
      await request.json();

    const propertyId =
      body.propertyId as
        | string
        | undefined;

    if (
      !propertyId
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu PMS propertyId.",
        },
        {
          status: 400,
        }
      );
    }

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
       CONFIG
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

    const targetCurrency =
      process.env
        .PMS_CURRENCY ||
      "VND";

    const environment =
      baseUrl.includes(
        "staging"
      )
        ? "staging"
        : "production";

    if (
      !apiKey
    ) {
      return NextResponse.json(
        {
          error:
            "Thiếu CHANNEX_API_KEY.",
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
          property_id,
          channex_property_id,
          connection_status
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
            "Channex connection chưa sẵn sàng.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       VERIFY PROPERTY CURRENCY
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
            `Không đọc được Channex Property (${propertyResponse.status}).`,

          details:
            propertyResult,
        },
        {
          status: 400,
        }
      );
    }

    const propertyCurrency =
      propertyResult
        ?.data
        ?.attributes
        ?.currency ??
      "UNKNOWN";

    if (
      propertyCurrency !==
      targetCurrency
    ) {
      return NextResponse.json(
        {
          error:
            `Channex Property vẫn là ${propertyCurrency}, cần ${targetCurrency}.`,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       LOAD PMS STRUCTURE + MAPPINGS
    ================================================== */

    const [
      mappingsResult,
      roomTypesResult,
      ratePlansResult,
    ] =
      await Promise.all([
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
          ),

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
          ),
      ]);

    const firstError =
      mappingsResult.error ||
      roomTypesResult.error ||
      ratePlansResult.error;

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

    const mappings =
      (
        mappingsResult.data ??
        []
      ) as MappingRow[];

    const roomTypes =
      (
        roomTypesResult.data ??
        []
      ) as PmsRoomType[];

    const ratePlans =
      (
        ratePlansResult.data ??
        []
      ) as PmsRatePlan[];

    if (
      mappings.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Không có Rate Plan mapping.",
        },
        {
          status: 400,
        }
      );
    }

    const roomTypeMap =
      new Map(
        roomTypes.map(
          (
            item
          ) => [
            item.id,
            item,
          ]
        )
      );

    const pmsRatePlanMap =
      new Map(
        ratePlans.map(
          (
            item
          ) => [
            item.id,
            item,
          ]
        )
      );

    /* ==================================================
       RESULTS
    ================================================== */

    const migrationResults:
      {
        roomType: string;

        ratePlan: string;

        oldChannexRatePlanId: string;

        newChannexRatePlanId:
          string | null;

        oldCurrency:
          string | null;

        newCurrency:
          string | null;

        migrated: boolean;

        message: string;
      }[] = [];

    const today =
      todayVietnam();

    /* ==================================================
       MIGRATE EACH MAPPING
    ================================================== */

    for (
      const mapping of
        mappings
    ) {
      const room =
        roomTypeMap.get(
          mapping.room_type_id
        );

      const pmsRatePlan =
        pmsRatePlanMap.get(
          mapping.rate_plan_id
        );

      /* ===============================================
         READ OLD CHANNEX RATE PLAN
      =============================================== */

      const oldResponse =
        await fetch(
          `${baseUrl}/api/v1/rate_plans/${mapping.channex_rate_plan_id}`,
          {
            headers,

            cache:
              "no-store",
          }
        );

      const oldText =
        await oldResponse.text();

      const oldResult =
        parseJson(
          oldText
        );

      if (
        !oldResponse.ok
      ) {
        return NextResponse.json(
          {
            error:
              `Không đọc được Channex Rate Plan ${mapping.channex_rate_plan_id}.`,

            details:
              oldResult,
          },
          {
            status: 400,
          }
        );
      }

      const oldData =
        oldResult
          ?.data;

      const oldAttrs =
        oldData
          ?.attributes;

      const oldRelationships =
        oldData
          ?.relationships;

      if (
        !oldAttrs
      ) {
        return NextResponse.json(
          {
            error:
              `Rate Plan ${mapping.channex_rate_plan_id} không có attributes.`,
          },
          {
            status: 400,
          }
        );
      }

      const oldCurrency =
        oldAttrs.currency ??
        "UNKNOWN";

      /* ===============================================
         ALREADY VND
      =============================================== */

      if (
        oldCurrency ===
        targetCurrency
      ) {
        migrationResults.push({
          roomType:
            room?.name ??
            mapping.room_type_id,

          ratePlan:
            pmsRatePlan?.name ??
            mapping.rate_plan_id,

          oldChannexRatePlanId:
            mapping
              .channex_rate_plan_id,

          newChannexRatePlanId:
            mapping
              .channex_rate_plan_id,

          oldCurrency,

          newCurrency:
            oldCurrency,

          migrated:
            false,

          message:
            `Rate Plan đã là ${targetCurrency}.`,
        });

        continue;
      }

      /* ===============================================
         CHANNEX ROOM TYPE
      =============================================== */

      const channexRoomTypeId =
        oldRelationships
          ?.room_type
          ?.data
          ?.id;

      if (
        !channexRoomTypeId
      ) {
        return NextResponse.json(
          {
            error:
              `Không lấy được Channex Room Type của "${oldAttrs.title ?? mapping.channex_rate_plan_id}".`,
          },
          {
            status: 400,
          }
        );
      }

      /* ===============================================
         INITIAL PMS RATE

         Dùng giá PMS gần nhất làm giá khởi tạo,
         thay vì 0 hoặc giá USD cũ.
      =============================================== */

      const {
        data:
          currentRate,
        error:
          currentRateError,
      } =
        await supabase
          .from(
            "rate_calendar"
          )
          .select(`
            price,
            stay_date
          `)
          .eq(
            "property_id",
            propertyId
          )
          .eq(
            "room_type_id",
            mapping.room_type_id
          )
          .eq(
            "rate_plan_id",
            mapping.rate_plan_id
          )
          .gte(
            "stay_date",
            today
          )
          .gt(
            "price",
            0
          )
          .order(
            "stay_date",
            {
              ascending:
                true,
            }
          )
          .limit(
            1
          )
          .maybeSingle();

      if (
        currentRateError
      ) {
        return NextResponse.json(
          {
            error:
              currentRateError.message,
          },
          {
            status: 500,
          }
        );
      }

      const initialRate =
        Math.max(
          1,
          Math.round(
            Number(
              currentRate
                ?.price ??
              1
            )
          )
        );

      /* ===============================================
         OCCUPANCY OPTIONS
      =============================================== */

      let options:
        {
          occupancy: number;

          is_primary: boolean;

          rate: number;
        }[] = [];

      if (
        Array.isArray(
          oldAttrs.options
        ) &&
        oldAttrs.options.length >
          0
      ) {
        options =
          oldAttrs.options.map(
            (
              option:
                any
            ) => ({
              occupancy:
                Math.max(
                  1,
                  Number(
                    option
                      .occupancy ??
                    1
                  )
                ),

              is_primary:
                Boolean(
                  option
                    .is_primary
                ),

              rate:
                initialRate,
            })
          );
      } else {
        options = [
          {
            occupancy:
              1,

            is_primary:
              true,

            rate:
              initialRate,
          },
        ];
      }

      if (
        !options.some(
          (
            item
          ) =>
            item.is_primary
        )
      ) {
        options[0]
          .is_primary =
          true;
      }

      /* ===============================================
         NEW TITLE
      =============================================== */

      const baseTitle =
        oldAttrs.title ??
        `${room?.name ?? "Room"} - ${pmsRatePlan?.name ?? "Rate"}`;

      const newTitle =
        baseTitle.includes(
          "[VND]"
        )
          ? baseTitle
          : `${baseTitle} [VND]`;

      /* ===============================================
         CREATE NEW VND RATE PLAN
      =============================================== */

      const createResponse =
        await fetch(
          `${baseUrl}/api/v1/rate_plans`,
          {
            method:
              "POST",

            headers,

            cache:
              "no-store",

            body:
              JSON.stringify({
                rate_plan: {
                  title:
                    newTitle,

                  property_id:
                    connection
                      .channex_property_id,

                  room_type_id:
                    channexRoomTypeId,

                  currency:
                    targetCurrency,

                  options,

                  sell_mode:
                    oldAttrs
                      .sell_mode ??
                    "per_room",

                  /*
                   * PMS quản lý Rate trực tiếp,
                   * nên Rate Plan mới dùng manual.
                   */
                  rate_mode:
                    "manual",
                },
              }),
          }
        );

      const createText =
        await createResponse.text();

      const createResult =
        parseJson(
          createText
        );

      if (
        !createResponse.ok
      ) {
        console.error(
          "Create VND Rate Plan:",
          createResponse.status,
          createResult ??
            createText
        );

        return NextResponse.json(
          {
            error:
              `Không tạo được VND Rate Plan "${newTitle}" (${createResponse.status}).`,

            oldRatePlanId:
              mapping
                .channex_rate_plan_id,

            details:
              createResult ??
              createText,
          },
          {
            status: 400,
          }
        );
      }

      const newRatePlanId =
        createResult
          ?.data
          ?.id;

      if (
        !newRatePlanId
      ) {
        return NextResponse.json(
          {
            error:
              `Channex đã tạo Rate Plan nhưng không trả về ID cho "${newTitle}".`,

            details:
              createResult,
          },
          {
            status: 400,
          }
        );
      }

      /* ===============================================
         VERIFY NEW RATE PLAN
      =============================================== */

      const verifyResponse =
        await fetch(
          `${baseUrl}/api/v1/rate_plans/${newRatePlanId}`,
          {
            headers,

            cache:
              "no-store",
          }
        );

      const verifyText =
        await verifyResponse.text();

      const verifyResult =
        parseJson(
          verifyText
        );

      if (
        !verifyResponse.ok
      ) {
        return NextResponse.json(
          {
            error:
              `Đã tạo ${newTitle} nhưng không verify được.`,

            newRatePlanId,
          },
          {
            status: 400,
          }
        );
      }

      const newCurrency =
        verifyResult
          ?.data
          ?.attributes
          ?.currency ??
        "UNKNOWN";

      if (
        newCurrency !==
        targetCurrency
      ) {
        return NextResponse.json(
          {
            error:
              `Rate Plan mới "${newTitle}" vẫn dùng ${newCurrency}, cần ${targetCurrency}.`,

            oldRatePlanId:
              mapping
                .channex_rate_plan_id,

            newRatePlanId,

            expectedCurrency:
              targetCurrency,

            actualCurrency:
              newCurrency,
          },
          {
            status: 400,
          }
        );
      }

      /* ===============================================
         REMAP PMS → NEW VND RATE PLAN

         Chỉ remap SAU KHI verify VND thành công.
      =============================================== */

      const {
        data:
          remapResult,
        error:
          remapError,
      } =
        await supabase.rpc(
          "remap_channex_rate_plan",
          {
            target_connection_id:
              connection.id,

            target_room_type_id:
              mapping.room_type_id,

            target_rate_plan_id:
              mapping.rate_plan_id,

            new_channex_rate_plan_id:
              newRatePlanId,
          }
        );

      if (
        remapError
      ) {
        console.error(
          "Remap failed:",
          remapError
        );

        return NextResponse.json(
          {
            error:
              `Rate Plan VND đã được tạo nhưng cập nhật mapping thất bại.`,

            oldRatePlanId:
              mapping
                .channex_rate_plan_id,

            newRatePlanId,

            remapError:
              remapError.message,

            /*
             * Không delete Rate Plan mới.
             * Giữ ID để recovery thủ công nếu cần.
             */
          },
          {
            status: 500,
          }
        );
      }

      console.log(
        "Rate Plan remapped:",
        remapResult
      );

      migrationResults.push({
        roomType:
          room?.name ??
          mapping.room_type_id,

        ratePlan:
          pmsRatePlan?.name ??
          mapping.rate_plan_id,

        oldChannexRatePlanId:
          mapping
            .channex_rate_plan_id,

        newChannexRatePlanId:
          newRatePlanId,

        oldCurrency,

        newCurrency,

        migrated:
          true,

        message:
          `${oldCurrency} → ${newCurrency}`,
      });
    }

    /* ==================================================
       FINAL VERIFY ALL CURRENT MAPPINGS
    ================================================== */

    const {
      data:
        finalMappings,
      error:
        finalMappingsError,
    } =
      await supabase
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
        );

    if (
      finalMappingsError
    ) {
      return NextResponse.json(
        {
          error:
            finalMappingsError.message,
        },
        {
          status: 500,
        }
      );
    }

    const finalChecks =
      await Promise.all(
        (
          finalMappings ??
          []
        ).map(
          async (
            item
          ) => {
            const response =
              await fetch(
                `${baseUrl}/api/v1/rate_plans/${item.channex_rate_plan_id}`,
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
              roomTypeId:
                item
                  .room_type_id,

              ratePlanId:
                item
                  .rate_plan_id,

              channexRatePlanId:
                item
                  .channex_rate_plan_id,

              title:
                result
                  ?.data
                  ?.attributes
                  ?.title ??
                item
                  .channex_rate_plan_id,

              currency:
                result
                  ?.data
                  ?.attributes
                  ?.currency ??
                "UNKNOWN",

              ok:
                response.ok,
            };
          }
        )
      );

    const invalid =
      finalChecks.filter(
        (
          item
        ) =>
          !item.ok ||
          item.currency !==
            targetCurrency
      );

    if (
      invalid.length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Migration hoàn tất một phần nhưng vẫn còn Rate Plan không phải VND.",

          invalid,

          migrations:
            migrationResults,
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       SUCCESS
    ================================================== */

    return NextResponse.json({
      success:
        true,

      currency:
        targetCurrency,

      propertyId:

        propertyId,

      channexPropertyId:
        connection
          .channex_property_id,

      totalMappings:
        finalChecks.length,

      migrated:
        migrationResults.filter(
          (
            item
          ) =>
            item.migrated
        ).length,

      alreadyCorrect:
        migrationResults.filter(
          (
            item
          ) =>
            !item.migrated
        ).length,

      migrations:
        migrationResults,

      currentMappings:
        finalChecks,

      oldRatePlansDeleted:
        false,

      message:
        "Đã tạo Rate Plans VND mới và remap PMS. Các Rate Plans USD cũ vẫn được giữ lại để rollback.",
    });
  } catch (
    error
  ) {
    console.error(
      "Recreate Channex VND Rate Plans:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Không thể migrate Channex Rate Plans sang VND.",
      },
      {
        status: 500,
      }
    );
  }
}