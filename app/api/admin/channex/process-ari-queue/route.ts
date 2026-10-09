import {

  NextResponse,

} from "next/server";



import {

  createClient,

} from "@/lib/supabase/server";



/* ======================================================

   TYPES

====================================================== */



type QueueRow = {

  id: string;



  property_id: string;



  room_type_id: string;



  rate_plan_id:

    | string

    | null;



  stay_date: string;



  entity_type:

    | "inventory"

    | "rate";



  status:

    | "pending"

    | "processing"

    | "synced"

    | "error";



  attempts: number;

};



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



function minDate(

  values: string[]

) {

  return [

    ...values,

  ].sort()[0];

}



function maxDate(

  values: string[]

) {

  return [

    ...values,

  ].sort()[

    values.length -

      1

  ];

}



/* ======================================================

   GET — QUEUE STATUS

====================================================== */



export async function GET(

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



    if (

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



    const url =

      new URL(

        request.url

      );



    const propertyId =

      url.searchParams.get(

        "propertyId"

      );



    if (

      !propertyId

    ) {

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



    const {

      data:

        canAccess,

    } =

      await supabase.rpc(

        "can_access_property",

        {

          target_property_id:

            propertyId,

        }

      );



    if (

      !canAccess

    ) {

      return NextResponse.json(

        {

          error:

            "Không có quyền truy cập.",

        },

        {

          status: 403,

        }

      );

    }



    const [

      pendingResult,

      processingResult,

      errorResult,

      syncedResult,

      recentResult,

    ] =

      await Promise.all([

        supabase

          .from(

            "channel_ari_queue"

          )

          .select(

            "id",

            {

              count:

                "exact",



              head:

                true,

            }

          )

          .eq(

            "property_id",

            propertyId

          )

          .eq(

            "status",

            "pending"

          ),



        supabase

          .from(

            "channel_ari_queue"

          )

          .select(

            "id",

            {

              count:

                "exact",



              head:

                true,

            }

          )

          .eq(

            "property_id",

            propertyId

          )

          .eq(

            "status",

            "processing"

          ),



        supabase

          .from(

            "channel_ari_queue"

          )

          .select(

            "id",

            {

              count:

                "exact",



              head:

                true,

            }

          )

          .eq(

            "property_id",

            propertyId

          )

          .eq(

            "status",

            "error"

          ),



        supabase

          .from(

            "channel_ari_queue"

          )

          .select(

            "id",

            {

              count:

                "exact",



              head:

                true,

            }

          )

          .eq(

            "property_id",

            propertyId

          )

          .eq(

            "status",

            "synced"

          ),



        supabase

          .from(

            "channel_ari_queue"

          )

          .select(`

            id,

            room_type_id,

            rate_plan_id,

            stay_date,

            entity_type,

            status,

            attempts,

            last_error,

            last_enqueued_at,

            synced_at

          `)

          .eq(

            "property_id",

            propertyId

          )

          .order(

            "updated_at",

            {

              ascending:

                false,

            }

          )

          .limit(

            20

          ),

      ]);



    return NextResponse.json({

      success:

        true,



      summary: {

        pending:

          pendingResult.count ??

          0,



        processing:

          processingResult.count ??

          0,



        error:

          errorResult.count ??

          0,



        synced:

          syncedResult.count ??

          0,

      },



      recent:

        recentResult.data ??

        [],

    });

  } catch (

    error

  ) {

    console.error(

      "ARI Queue GET:",

      error

    );



    return NextResponse.json(

      {

        error:

          "Không thể đọc ARI Queue.",

      },

      {

        status: 500,

      }

    );

  }

}



/* ======================================================

   POST — PROCESS QUEUE

====================================================== */



export async function POST(

  request: Request

) {

  const supabase =

    await createClient();



  let claimedJobs:

    QueueRow[] =

    [];



  let jobsForBatch:

    QueueRow[] =

    [];



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



    /* ==================================================

       BODY

    ================================================== */



    const body =

      await request.json();



    const propertyId =

      body.propertyId as

        | string

        | undefined;



    const requestedLimit =

      Number(

        body.limit ??

        100

      );



    const batchLimit =

      Math.min(

        500,

        Math.max(

          1,

          Number.isFinite(

            requestedLimit

          )

            ? requestedLimit

            : 100

        )

      );



    if (

      !propertyId

    ) {

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

       ADMIN

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

            "Bạn không có quyền Admin.",

        },

        {

          status: 403,

        }

      );

    }


        /* ==================================================
       CHANNEX CONNECTION PREFLIGHT

       Prevent queue claim when the property
       has no active connected Channex connection.
    ================================================== */

    const precheckBaseUrl = (
      process.env.CHANNEX_BASE_URL ||
      "https://staging.channex.io"
    ).replace(/\/+$/, "");

    const precheckEnvironment =
      precheckBaseUrl.includes("staging")
        ? "staging"
        : "production";

    const {
      data: precheckConnection,
      error: precheckConnectionError,
    } = await supabase
      .from("channel_connections")
      .select(`
        id,
        connection_status,
        channex_property_id
      `)
      .eq("property_id", propertyId)
      .eq("provider", "channex")
      .eq("environment", precheckEnvironment)
      .eq("active", true)
      .maybeSingle();

    if (precheckConnectionError) {
      throw new Error(
        precheckConnectionError.message
      );
    }

    if (
      !precheckConnection ||
      precheckConnection.connection_status !==
        "connected" ||
      !precheckConnection.channex_property_id
    ) {
      return NextResponse.json({
        success: true,
        status: "warning",
        processed: 0,
        availability: 0,
        restrictions: 0,
        warnings: [
          {
            source: "connection",
            message:
              "Channex connection chưa sẵn sàng. ARI queue chưa được claim.",
          },
        ],
      });
    }


    /* ==================================================

       CLAIM JOBS

    ================================================== */



    const {

      data:

        claimedData,

      error:

        claimError,

    } =

      await supabase.rpc(

        "claim_channex_ari_queue",

        {

          target_property_id:

            propertyId,



          batch_limit:

            batchLimit,

        }

      );



    if (

      claimError

    ) {

      throw new Error(

        claimError.message

      );

    }



    claimedJobs =

      (

        claimedData ??

        []

      ) as QueueRow[];



    jobsForBatch =

      claimedJobs;



    if (

      claimedJobs.length ===

      0

    ) {

      return NextResponse.json({

        success:

          true,



        processed:

          0,



        message:

          "Không có ARI Queue đang chờ.",

      });

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

      throw new Error(

        "Thiếu CHANNEX_API_KEY."

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

      throw new Error(

        "Không tìm thấy Channex connection."

      );

    }



    if (

      connection

        .connection_status !==

        "connected" ||

      !connection

        .channex_property_id

    ) {

      throw new Error(

        "Channex connection chưa sẵn sàng."

      );

    }



    /* ==================================================

       PROPERTY CURRENCY

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



    const propertyResult =

      parseJson(

        await propertyResponse.text()

      );



    if (

      !propertyResponse.ok

    ) {

      throw new Error(

        "Không thể kiểm tra Channex Property."

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

      throw new Error(

        `Currency mismatch: PMS=${pmsCurrency}, Channex=${channexCurrency}.`

      );

    }



    /* ==================================================

       STRUCTURE + MAPPINGS

    ================================================== */



    const [

      ratePlansResult,

      roomMappingsResult,

      rateMappingsResult,

    ] =

      await Promise.all([

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

      ]);



    const queryError =

      ratePlansResult.error ||

      roomMappingsResult.error ||

      rateMappingsResult.error;



    if (

      queryError

    ) {

      throw new Error(

        queryError.message

      );

    }



    const activeRatePlans =

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



    const roomMap =

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



    const rateMap =

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



    /* ==================================================

       DATE RANGE

    ================================================== */



    const jobDates =

      claimedJobs.map(

        (

          job

        ) =>

          job.stay_date

      );



    const dateFrom =

      minDate(

        jobDates

      );



    const dateTo =

      maxDate(

        jobDates

      );



    /* ==================================================

       CURRENT PMS VALUES



       Luôn lấy dữ liệu MỚI NHẤT.

       Không lưu price/availability trong queue.

    ================================================== */



    const [

      inventoryResult,

      ratesResult,

    ] =

      await Promise.all([

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

            dateFrom

          )

          .lte(

            "stay_date",

            dateTo

          ),



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

            dateFrom

          )

          .lte(

            "stay_date",

            dateTo

          ),

      ]);



    if (

      inventoryResult.error

    ) {

      throw new Error(

        inventoryResult

          .error

          .message

      );

    }



    if (

      ratesResult.error

    ) {

      throw new Error(

        ratesResult

          .error

          .message

      );

    }



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



    const inventoryMap =

      new Map(

        inventory.map(

          (

            row

          ) => [

            `${row.room_type_id}:${row.stay_date}`,

            row,

          ]

        )

      );



    const rateRowMap =

      new Map(

        rates.map(

          (

            row

          ) => [

            `${row.room_type_id}:${row.rate_plan_id}:${row.stay_date}`,

            row,

          ]

        )

      );



    /* ==================================================

       ISOLATE INVALID QUEUE JOBS

       Một job stale / thiếu dữ liệu không được phép

       làm fail toàn bộ batch.

    ================================================== */



    const invalidJobs =

      new Map<

        string,

        string

      >();



    const isolatedJobWarnings:

      ChannexWarning[] =

      [];



    const validJobs:

      QueueRow[] =

      [];



    for (

      const job of

        claimedJobs

    ) {

      let validationError:

        | string

        | null =

        null;



      const inventoryKey =

        `${job.room_type_id}:${job.stay_date}`;



      const inventoryRow =

        inventoryMap.get(

          inventoryKey

        );



      if (

        job.entity_type ===

        "inventory"

      ) {

        if (

          !inventoryRow

        ) {

          validationError =

            `Không tìm thấy Inventory ${job.room_type_id}/${job.stay_date}.`;

        } else if (

          !roomMap.get(

            job.room_type_id

          )

        ) {

          validationError =

            `Room Type ${job.room_type_id} chưa map Channex.`;

        } else {

          const availability =

            Number(

              inventoryRow.available_rooms ??

              0

            );



          if (

            !Number.isInteger(

              availability

            ) ||

            availability < 0

          ) {

            validationError =

              `Availability không hợp lệ ${job.stay_date}.`;

          }

        }



        if (

          !validationError

        ) {

          for (

            const ratePlan of

              activeRatePlans

          ) {

            const rateKey =

              `${job.room_type_id}:${ratePlan.id}:${job.stay_date}`;



            const rateRow =

              rateRowMap.get(

                rateKey

              );



            if (

              !rateRow

            ) {

              validationError =

                `Không tìm thấy Rate ${job.room_type_id}/${ratePlan.id}/${job.stay_date}.`;



              break;

            }



            const price =

              Number(

                rateRow.price ??

                0

              );



            if (

              !Number.isFinite(

                price

              ) ||

              price <= 0

            ) {

              validationError =

                `Rate phải > 0 (${job.stay_date}).`;



              break;

            }



            if (

              !rateMap.get(

                `${job.room_type_id}:${ratePlan.id}`

              )

            ) {

              validationError =

                `Rate Plan chưa map Channex ${job.room_type_id}/${ratePlan.id}.`;



              break;

            }

          }

        }

      }



      if (

        job.entity_type ===

        "rate"

      ) {

        if (

          !job.rate_plan_id

        ) {

          validationError =

            `Rate queue ${job.id} thiếu rate_plan_id.`;

        } else {

          const rateKey =

            `${job.room_type_id}:${job.rate_plan_id}:${job.stay_date}`;



          const rateRow =

            rateRowMap.get(

              rateKey

            );



          if (

            !rateRow

          ) {

            validationError =

              `Không tìm thấy Rate ${job.room_type_id}/${job.rate_plan_id}/${job.stay_date}.`;

          } else {

            const price =

              Number(

                rateRow.price ??

                0

              );



            if (

              !Number.isFinite(

                price

              ) ||

              price <= 0

            ) {

              validationError =

                `Rate phải > 0 (${job.stay_date}).`;

            } else if (

              !rateMap.get(

                `${job.room_type_id}:${job.rate_plan_id}`

              )

            ) {

              validationError =

                `Rate Plan chưa map Channex ${job.room_type_id}/${job.rate_plan_id}.`;

            } else if (

              !inventoryRow

            ) {

              validationError =

                `Không tìm thấy Inventory cho Rate ${job.room_type_id}/${job.stay_date}.`;

            }

          }

        }

      }



      if (

        validationError

      ) {

        invalidJobs.set(

          job.id,

          validationError

        );

      } else {

        validJobs.push(

          job

        );

      }

    }



    jobsForBatch =

      validJobs;



    if (

      invalidJobs.size >

      0

    ) {

      const isolatedAt =

        new Date()

          .toISOString();



      await Promise.all(

        Array.from(

          invalidJobs.entries()

        ).map(

          async ([

            jobId,

            message,

          ]) => {

            const {

              error:

                isolateError,

            } =

              await supabase

                .from(

                  "channel_ari_queue"

                )

                .update({

                  status:

                    "error",



                  last_error:

                    message,



                  updated_at:

                    isolatedAt,

                })

                .eq(

                  "id",

                  jobId

                );



            if (

              isolateError

            ) {

              throw new Error(

                isolateError.message

              );

            }



            isolatedJobWarnings.push({

              source:

                "queue_validation",



              job_id:

                jobId,



              message,

            });

          }

        )

      );

    }



    if (

      jobsForBatch.length ===

      0

    ) {

      return NextResponse.json({

        success:

          true,



        status:

          "warning",



        processed:

          claimedJobs.length,



        availability:

          0,



        restrictions:

          0,



        isolated_errors:

          invalidJobs.size,



        warnings:

          isolatedJobWarnings,



        log:

          null,



        message:

          "Các queue job đã claim đều không hợp lệ và đã được cô lập.",

      });

    }



    /* ==================================================

       TARGET KEYS

    ================================================== */



    const availabilityKeys =

      new Set<

        string

      >();



    const restrictionKeys =

      new Set<

        string

      >();



    for (

      const job of

        jobsForBatch

    ) {

      if (

        job.entity_type ===

        "inventory"

      ) {

        availabilityKeys.add(

          `${job.room_type_id}:${job.stay_date}`

        );



        /*

         * Inventory contains min_stay + stop_sell.

         * Therefore all rates for that room/date

         * need restriction refresh.

         */



        for (

          const ratePlan of

            activeRatePlans

        ) {

          restrictionKeys.add(

            `${job.room_type_id}:${ratePlan.id}:${job.stay_date}`

          );

        }

      }



      if (

        job.entity_type ===

          "rate" &&

        job.rate_plan_id

      ) {

        restrictionKeys.add(

          `${job.room_type_id}:${job.rate_plan_id}:${job.stay_date}`

        );

      }

    }



    /* ==================================================

       AVAILABILITY PAYLOAD

    ================================================== */



    const availabilityValues:

      {

        property_id: string;



        room_type_id: string;



        date: string;



        availability: number;

      }[] = [];



    for (

      const key of

        availabilityKeys

    ) {

      const [

        roomTypeId,

        stayDate,

      ] =

        key.split(

          ":"

        );



      const row =

        inventoryMap.get(

          key

        );



      if (

        !row

      ) {

        throw new Error(

          `Không tìm thấy Inventory ${roomTypeId} ${stayDate}.`

        );

      }



      const channexRoomTypeId =

        roomMap.get(

          roomTypeId

        );



      if (

        !channexRoomTypeId

      ) {

        throw new Error(

          `Room Type ${roomTypeId} chưa map Channex.`

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

          `Availability không hợp lệ ${stayDate}.`

        );

      }



      availabilityValues.push({

        property_id:

          connection

            .channex_property_id,



        room_type_id:

          channexRoomTypeId,



        date:

          stayDate,



        availability,

      });

    }



    /* ==================================================

       RESTRICTION PAYLOAD

    ================================================== */



    const restrictionValues:

      {

        property_id: string;



        rate_plan_id: string;



        date: string;



        rate: string;



        min_stay_arrival: number;



        stop_sell: boolean;

      }[] = [];



    const usedChannexRateIds =

      new Set<

        string

      >();



    for (

      const key of

        restrictionKeys

    ) {

      const [

        roomTypeId,

        ratePlanId,

        stayDate,

      ] =

        key.split(

          ":"

        );



      const rateRow =

        rateRowMap.get(

          key

        );



      if (

        !rateRow

      ) {

        throw new Error(

          `Không tìm thấy Rate ${roomTypeId}/${ratePlanId}/${stayDate}.`

        );

      }



      const price =

        Number(

          rateRow.price ??

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

          `Rate phải > 0 (${stayDate}).`

        );

      }



      const channexRatePlanId =

        rateMap.get(

          `${roomTypeId}:${ratePlanId}`

        );



      if (

        !channexRatePlanId

      ) {

        throw new Error(

          `Rate Plan chưa map Channex ${roomTypeId}/${ratePlanId}.`

        );

      }



      usedChannexRateIds.add(

        channexRatePlanId

      );



      const inventoryRow =

        inventoryMap.get(

          `${roomTypeId}:${stayDate}`

        );



      if (

        !inventoryRow

      ) {

        throw new Error(

          `Không tìm thấy Inventory cho Rate ${stayDate}.`

        );

      }



      restrictionValues.push({

        property_id:

          connection

            .channex_property_id,



        rate_plan_id:

          channexRatePlanId,



        date:

          stayDate,



        rate:

          String(

            Math.round(

              price

            )

          ),



        min_stay_arrival:

          Math.max(

            1,

            Number(

              inventoryRow

                .min_stay ??

              1

            )

          ),



        stop_sell:

          Boolean(

            inventoryRow

              .stop_sell

          ),

      });

    }



    /* ==================================================

       VERIFY RATE PLAN CURRENCY

    ================================================== */



    await Promise.all(

      Array.from(

        usedChannexRateIds

      ).map(

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



          const result =

            parseJson(

              await response.text()

            );



          if (

            !response.ok

          ) {

            throw new Error(

              `Không đọc được Channex Rate Plan ${ratePlanId}.`

            );

          }



          const currency =

            result

              ?.data

              ?.attributes

              ?.currency ??

            "UNKNOWN";



          if (

            currency !==

            pmsCurrency

          ) {

            throw new Error(

              `Rate Plan ${ratePlanId} dùng ${currency}, cần ${pmsCurrency}.`

            );

          }

        }

      )

    );



    /* ==================================================

       SEND AVAILABILITY

    ================================================== */



    let availabilityResult:

      any = null;



    if (

      availabilityValues.length >

      0

    ) {

      const response =

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



      const text =

        await response.text();



      availabilityResult =

        parseJson(

          text

        );



      if (

        !response.ok

      ) {

        throw new Error(

          `Channex Availability HTTP ${response.status}.`

        );

      }

    }



    /* ==================================================

       SEND RESTRICTIONS

    ================================================== */



    let restrictionsResult:

      any = null;



    if (

      restrictionValues.length >

      0

    ) {

      const response =

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



      const text =

        await response.text();



      restrictionsResult =

        parseJson(

          text

        );



      if (

        !response.ok

      ) {

        throw new Error(

          `Channex Restrictions HTTP ${response.status}.`

        );

      }

    }



    /* ==================================================

       WARNINGS

    ================================================== */



    const warnings = [

      ...isolatedJobWarnings,



      ...getWarnings(

        availabilityResult

      ).map(

        (

          warning

        ) => ({

          ...warning,



          source:

            "availability",

        })

      ),



      ...getWarnings(

        restrictionsResult

      ).map(

        (

          warning

        ) => ({

          ...warning,



          source:

            "restrictions",

        })

      ),

    ];



    /* ==================================================

       COMPLETE JOBS

    ================================================== */



    const jobIds =

      jobsForBatch.map(

        (

          job

        ) =>

          job.id

      );



    const {

      error:

        completeError,

    } =

      await supabase

        .from(

          "channel_ari_queue"

        )

        .update({

          status:

            "synced",



          last_error:

            null,



          synced_at:

            new Date()

              .toISOString(),



          updated_at:

            new Date()

              .toISOString(),

        })

        .in(

          "id",

          jobIds

        );



    if (

      completeError

    ) {

      console.error(

        "Queue complete error:",

        completeError

      );

    }



    /* ==================================================

       SYNC LOG

    ================================================== */



    const logStatus =

      warnings.length >

      0

        ? "warning"

        : "accepted";



    const {

      data:

        syncLog,

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

            dateFrom,



          date_to:

            dateTo,



          status:

            logStatus,



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

        "ARI Queue sync log:",

        logError

      );

    }



    /* ==================================================

       SUCCESS

    ================================================== */



    return NextResponse.json({

      success:

        true,



      status:

        logStatus,



      processed:

        claimedJobs.length,



      availability:

        availabilityValues.length,



      restrictions:

        restrictionValues.length,



      isolated_errors:

        invalidJobs.size,



      warnings,



      log:

        syncLog ??

        null,

    });

  } catch (

    error

  ) {

    console.error(

      "Process ARI Queue:",

      error

    );



    const message =

      error instanceof

      Error

        ? error.message

        : "Không thể xử lý ARI Queue.";



    /* ==================================================

       MARK CLAIMED JOBS ERROR

    ================================================== */



    if (

      jobsForBatch.length >

      0

    ) {

      await supabase

        .from(

          "channel_ari_queue"

        )

        .update({

          status:

            "error",



          last_error:

            message,



          updated_at:

            new Date()

              .toISOString(),

        })

        .in(

          "id",

          jobsForBatch.map(

            (

              job

            ) =>

              job.id

          )

        );

    }



    return NextResponse.json(

      {

        error:

          message,

      },

      {

        status: 400,

      }

    );

  }

}