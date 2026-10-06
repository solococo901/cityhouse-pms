import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

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

    if (!propertyId) {
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
       PERMISSION
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

    if (!apiKey) {
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
            "Property chưa map với Channex.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       UPDATE PROPERTY CURRENCY
    ================================================== */

    const propertyGetResponse =
      await fetch(
        `${baseUrl}/api/v1/properties/${connection.channex_property_id}`,
        {
          headers,

          cache:
            "no-store",
        }
      );

    const propertyGetText =
      await propertyGetResponse.text();

    const propertyGetResult =
      parseJson(
        propertyGetText
      );

    if (
      !propertyGetResponse.ok
    ) {
      return NextResponse.json(
        {
          error:
            `Không đọc được Channex Property (${propertyGetResponse.status}).`,

          details:
            propertyGetResult,
        },
        {
          status: 400,
        }
      );
    }

    const propertyAttrs =
      propertyGetResult
        ?.data
        ?.attributes;

    if (!propertyAttrs) {
      return NextResponse.json(
        {
          error:
            "Channex Property không có attributes.",
        },
        {
          status: 400,
        }
      );
    }

    const propertyBefore =
      propertyAttrs.currency ??
      null;

    if (
      propertyBefore !==
      targetCurrency
    ) {
      const propertyUpdateResponse =
        await fetch(
          `${baseUrl}/api/v1/properties/${connection.channex_property_id}`,
          {
            method:
              "PUT",

            headers,

            cache:
              "no-store",

            body:
              JSON.stringify({
                property: {
                  title:
                    propertyAttrs.title ??
                    propertyAttrs.name ??
                    "CityHouse Property",

                  currency:
                    targetCurrency,

                  timezone:
                    "Asia/Ho_Chi_Minh",
                },
              }),
          }
        );

      const propertyUpdateText =
        await propertyUpdateResponse.text();

      const propertyUpdateResult =
        parseJson(
          propertyUpdateText
        );

      if (
        !propertyUpdateResponse.ok
      ) {
        return NextResponse.json(
          {
            error:
              `Không thể update Property currency (${propertyUpdateResponse.status}).`,

            details:
              propertyUpdateResult,
          },
          {
            status: 400,
          }
        );
      }
    }

    /* ==================================================
       GET MAPPED RATE PLAN IDS
    ================================================== */

    const {
      data:
        mappings,
      error:
        mappingsError,
    } =
      await supabase
        .from(
          "channel_rate_mappings"
        )
        .select(`
          channex_rate_plan_id
        `)
        .eq(
          "connection_id",
          connection.id
        );

    if (
      mappingsError
    ) {
      return NextResponse.json(
        {
          error:
            mappingsError.message,
        },
        {
          status: 500,
        }
      );
    }

    const ratePlanIds =
      Array.from(
        new Set(
          (
            mappings ??
            []
          )
            .map(
              (
                item
              ) =>
                item
                  .channex_rate_plan_id
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            )
        )
      );

    if (
      ratePlanIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Không có mapped Channex Rate Plan.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       NORMALIZE RATE PLANS
    ================================================== */

    const results:
      {
        id: string;

        title: string;

        before:
          | string
          | null;

        after:
          | string
          | null;

        updated: boolean;
      }[] = [];

    for (
      const ratePlanId of
        ratePlanIds
    ) {
      /* ===============================================
         GET RATE PLAN
      =============================================== */

      const getResponse =
        await fetch(
          `${baseUrl}/api/v1/rate_plans/${ratePlanId}`,
          {
            headers,

            cache:
              "no-store",
          }
        );

      const getText =
        await getResponse.text();

      const getResult =
        parseJson(
          getText
        );

      if (
        !getResponse.ok
      ) {
        return NextResponse.json(
          {
            error:
              `Không đọc được Rate Plan ${ratePlanId}.`,

            details:
              getResult,
          },
          {
            status: 400,
          }
        );
      }

      const data =
        getResult?.data;

      const attrs =
        data?.attributes;

      const relationships =
        data?.relationships;

      if (!attrs) {
        return NextResponse.json(
          {
            error:
              `Rate Plan ${ratePlanId} không có attributes.`,
          },
          {
            status: 400,
          }
        );
      }

      const beforeCurrency =
        attrs.currency ??
        null;

      /* ===============================================
         ALREADY CORRECT
      =============================================== */

      if (
        beforeCurrency ===
        targetCurrency
      ) {
        results.push({
          id:
            ratePlanId,

          title:
            attrs.title ??
            ratePlanId,

          before:
            beforeCurrency,

          after:
            beforeCurrency,

          updated:
            false,
        });

        continue;
      }

      /* ===============================================
         RELATIONSHIPS
      =============================================== */

      const channexPropertyId =
        relationships
          ?.property
          ?.data
          ?.id;

      const channexRoomTypeId =
        relationships
          ?.room_type
          ?.data
          ?.id;

      const taxSetId =
        relationships
          ?.tax_set
          ?.data
          ?.id ??
        null;

      if (
        !channexPropertyId ||
        !channexRoomTypeId
      ) {
        return NextResponse.json(
          {
            error:
              `Rate Plan ${ratePlanId} thiếu property_id hoặc room_type_id.`,
          },
          {
            status: 400,
          }
        );
      }

      /* ===============================================
         OPTIONS
      =============================================== */

      const options =
        Array.isArray(
          attrs.options
        )
          ? attrs.options.map(
              (
                option:
                  any
              ) => {
                const item:
                  Record<
                    string,
                    unknown
                  > = {
                  occupancy:
                    Number(
                      option
                        .occupancy
                    ),

                  is_primary:
                    Boolean(
                      option
                        .is_primary
                    ),

                  rate:
                    Number(
                      option
                        .rate ??
                      0
                    ),
                };

                if (
                  option
                    .derived_option
                ) {
                  item.derived_option =
                    option
                      .derived_option;
                }

                return item;
              }
            )
          : [];

      if (
        options.length ===
        0
      ) {
        return NextResponse.json(
          {
            error:
              `Rate Plan ${attrs.title ?? ratePlanId} không có occupancy options.`,
          },
          {
            status: 400,
          }
        );
      }

      /* ===============================================
         UPDATE PAYLOAD

         Chỉ giữ những field cần thiết + dữ liệu hiện tại.
      =============================================== */

      const ratePlanPayload:
        Record<
          string,
          unknown
        > = {
        title:
          attrs.title,

        property_id:
          channexPropertyId,

        room_type_id:
          channexRoomTypeId,

        options,

        currency:
          targetCurrency,

        sell_mode:
          attrs.sell_mode ??
          "per_room",

        rate_mode:
          attrs.rate_mode ??
          "manual",

        children_fee:
          attrs.children_fee ??
          "0.00",

        infant_fee:
          attrs.infant_fee ??
          "0.00",

        max_stay:
          attrs.max_stay ??
          [
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],

        min_stay_arrival:
          attrs.min_stay_arrival ??
          [
            1,
            1,
            1,
            1,
            1,
            1,
            1,
          ],

        min_stay_through:
          attrs.min_stay_through ??
          [
            1,
            1,
            1,
            1,
            1,
            1,
            1,
          ],

        closed_to_arrival:
          attrs.closed_to_arrival ??
          [
            false,
            false,
            false,
            false,
            false,
            false,
            false,
          ],

        closed_to_departure:
          attrs.closed_to_departure ??
          [
            false,
            false,
            false,
            false,
            false,
            false,
            false,
          ],

        stop_sell:
          attrs.stop_sell ??
          [
            false,
            false,
            false,
            false,
            false,
            false,
            false,
          ],

        inherit_rate:
          Boolean(
            attrs.inherit_rate
          ),

        inherit_closed_to_arrival:
          Boolean(
            attrs
              .inherit_closed_to_arrival
          ),

        inherit_closed_to_departure:
          Boolean(
            attrs
              .inherit_closed_to_departure
          ),

        inherit_stop_sell:
          Boolean(
            attrs
              .inherit_stop_sell
          ),

        inherit_min_stay_arrival:
          Boolean(
            attrs
              .inherit_min_stay_arrival
          ),

        inherit_min_stay_through:
          Boolean(
            attrs
              .inherit_min_stay_through
          ),

        inherit_max_stay:
          Boolean(
            attrs
              .inherit_max_stay
          ),

        inherit_max_sell:
          Boolean(
            attrs
              .inherit_max_sell
          ),

        inherit_max_availability:
          Boolean(
            attrs
              .inherit_max_availability
          ),

        inherit_availability_offset:
          Boolean(
            attrs
              .inherit_availability_offset
          ),
      };

      /* ===============================================
         OPTIONAL FIELDS
      =============================================== */

      if (
        taxSetId
      ) {
        ratePlanPayload
          .tax_set_id =
          taxSetId;
      }

      if (
        attrs
          .parent_rate_plan_id
      ) {
        ratePlanPayload
          .parent_rate_plan_id =
          attrs
            .parent_rate_plan_id;
      } else {
        ratePlanPayload
          .parent_rate_plan_id =
          null;
      }

      if (
        attrs
          .auto_rate_settings
      ) {
        ratePlanPayload
          .auto_rate_settings =
          attrs
            .auto_rate_settings;
      }

      if (
        attrs.meal_type
      ) {
        ratePlanPayload
          .meal_type =
          attrs.meal_type;
      }

      /* ===============================================
         PUT RATE PLAN
      =============================================== */

      const updateResponse =
        await fetch(
          `${baseUrl}/api/v1/rate_plans/${ratePlanId}`,
          {
            method:
              "PUT",

            headers,

            cache:
              "no-store",

            body:
              JSON.stringify({
                rate_plan:
                  ratePlanPayload,
              }),
          }
        );

      const updateText =
        await updateResponse.text();

      const updateResult =
        parseJson(
          updateText
        );

      if (
        !updateResponse.ok
      ) {
        console.error(
          "Update Rate Plan failed:",
          ratePlanId,
          updateResult ??
            updateText
        );

        return NextResponse.json(
          {
            error:
              `Không thể đổi currency Rate Plan "${attrs.title ?? ratePlanId}" (${updateResponse.status}).`,

            ratePlanId,

            details:
              updateResult ??
              updateText,
          },
          {
            status: 400,
          }
        );
      }

      /* ===============================================
         VERIFY AGAIN
      =============================================== */

      const verifyResponse =
        await fetch(
          `${baseUrl}/api/v1/rate_plans/${ratePlanId}`,
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
              `Đã update nhưng không verify được Rate Plan ${ratePlanId}.`,
          },
          {
            status: 400,
          }
        );
      }

      const afterCurrency =
        verifyResult
          ?.data
          ?.attributes
          ?.currency ??
        null;

      if (
        afterCurrency !==
        targetCurrency
      ) {
        return NextResponse.json(
          {
            error:
              `Rate Plan ${ratePlanId} vẫn là ${afterCurrency ?? "UNKNOWN"} sau khi update.`,

            ratePlanId,

            before:
              beforeCurrency,

            after:
              afterCurrency,
          },
          {
            status: 400,
          }
        );
      }

      results.push({
        id:
          ratePlanId,

        title:
          attrs.title ??
          ratePlanId,

        before:
          beforeCurrency,

        after:
          afterCurrency,

        updated:
          true,
      });
    }

    /* ==================================================
       FINAL VERIFY PROPERTY
    ================================================== */

    const finalPropertyResponse =
      await fetch(
        `${baseUrl}/api/v1/properties/${connection.channex_property_id}`,
        {
          headers,

          cache:
            "no-store",
        }
      );

    const finalPropertyText =
      await finalPropertyResponse.text();

    const finalPropertyResult =
      parseJson(
        finalPropertyText
      );

    const finalPropertyCurrency =
      finalPropertyResult
        ?.data
        ?.attributes
        ?.currency ??
      null;

    /* ==================================================
       RESPONSE
    ================================================== */

    return NextResponse.json({
      success:
        true,

      targetCurrency,

      property: {
        id:
          connection
            .channex_property_id,

        before:
          propertyBefore,

        after:
          finalPropertyCurrency,
      },

      ratePlans:
        results,

      ratePlansTotal:
        results.length,

      ratePlansUpdated:
        results.filter(
          (
            item
          ) =>
            item.updated
        ).length,

      ratePlansAlreadyCorrect:
        results.filter(
          (
            item
          ) =>
            !item.updated
        ).length,
    });
  } catch (
    error
  ) {
    console.error(
      "Normalize Channex currency:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Không thể chuẩn hóa Channex currency.",
      },
      {
        status: 500,
      }
    );
  }
}