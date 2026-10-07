import {

  createAdminClient,

} from "@/lib/supabase/admin";



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



export type AriWorkerResult = {

  propertyId: string;



  processed: number;



  availability: number;



  restrictions: number;



  status:

    | "empty"

    | "accepted"

    | "warning"

    | "error";



  warnings:

    ChannexWarning[];



  error?:

    string;

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



function getWarnings(

  result: unknown

): ChannexWarning[] {

  if (

    typeof result !==

      "object" ||

    result ===

      null

  ) {

    return [];

  }



  const meta =

    (

      result as {

        meta?: {

          warnings?:

            unknown;

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



function getMinDate(

  values: string[]

) {

  return [

    ...values,

  ].sort()[0];

}



function getMaxDate(

  values: string[]

) {

  const sorted = [

    ...values,

  ].sort();



  return sorted[

    sorted.length -

      1

  ];

}



/* ======================================================

   WORKER

====================================================== */



export async function processAriQueueForProperty(

  propertyId: string,

  batchLimit =

    100

): Promise<AriWorkerResult> {

  const supabase =

    createAdminClient();



  let claimedJobs:

    QueueRow[] =

    [];



  let jobsForBatch:

    QueueRow[] =

    [];



  try {

    /* ==================================================

       CLAIM

    ================================================== */



    const {

      data:

        claimData,



      error:

        claimError,

    } =

      await supabase.rpc(

        "claim_channex_ari_queue_system",

        {

          target_property_id:

            propertyId,



          batch_limit:

            Math.min(

              Math.max(

                batchLimit,

                1

              ),

              500

            ),

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

        claimData ??

        []

      ) as QueueRow[];



    jobsForBatch =

      claimedJobs;



    if (

      claimedJobs.length ===

      0

    ) {

      return {

        propertyId,



        processed:

          0,



        availability:

          0,



        restrictions:

          0,



        status:

          "empty",



        warnings:

          [],

      };

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



    const pmsCurrency =

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

      throw new Error(

        "Missing CHANNEX_API_KEY."

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



    const propertyText =

      await propertyResponse.text();



    const propertyResult =

      parseJson(

        propertyText

      );



    if (

      !propertyResponse.ok

    ) {

      throw new Error(

        `Không đọc được Channex Property (${propertyResponse.status}).`

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

       LOAD STRUCTURE

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



    const structureError =

      ratePlansResult.error ||

      roomMappingsResult.error ||

      rateMappingsResult.error;



    if (

      structureError

    ) {

      throw new Error(

        structureError.message

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

      getMinDate(

        jobDates

      );



    const dateTo =

      getMaxDate(

        jobDates

      );



    /* ==================================================

       LOAD CURRENT PMS VALUES

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



    const inventoryRows =

      (

        inventoryResult.data ??

        []

      ) as InventoryRow[];



    const rateRows =

      (

        ratesResult.data ??

        []

      ) as RateRow[];



    const inventoryMap =

      new Map(

        inventoryRows.map(

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

        rateRows.map(

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

      return {

        propertyId,



        processed:

          claimedJobs.length,



        availability:

          0,



        restrictions:

          0,



        status:

          "warning",



        warnings:

          isolatedJobWarnings,

      };

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

        property_id:

          string;



        room_type_id:

          string;



        date:

          string;



        availability:

          number;

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



      const inventory =

        inventoryMap.get(

          key

        );



      if (

        !inventory

      ) {

        throw new Error(

          `Missing Inventory: ${roomTypeId}/${stayDate}.`

        );

      }



      const channexRoomId =

        roomMap.get(

          roomTypeId

        );



      if (

        !channexRoomId

      ) {

        throw new Error(

          `Room Type chưa map Channex: ${roomTypeId}.`

        );

      }



      const availability =

        Number(

          inventory.available_rooms ??

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

          `Availability không hợp lệ: ${stayDate}.`

        );

      }



      availabilityValues.push({

        property_id:

          connection

            .channex_property_id,



        room_type_id:

          channexRoomId,



        date:

          stayDate,



        availability,

      });

    }



    /* ==================================================

       RESTRICTIONS

    ================================================== */



    const restrictionValues:

      {

        property_id:

          string;



        rate_plan_id:

          string;



        date:

          string;



        rate:

          string;



        min_stay_arrival:

          number;



        stop_sell:

          boolean;

      }[] = [];



    const usedRatePlanIds =

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

          `Missing Rate: ${roomTypeId}/${ratePlanId}/${stayDate}.`

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

          `Rate phải > 0: ${stayDate}.`

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

          `Rate Plan chưa map Channex: ${roomTypeId}/${ratePlanId}.`

        );

      }



      usedRatePlanIds.add(

        channexRatePlanId

      );



      const inventory =

        inventoryMap.get(

          `${roomTypeId}:${stayDate}`

        );



      if (

        !inventory

      ) {

        throw new Error(

          `Missing Inventory cho Rate: ${roomTypeId}/${stayDate}.`

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

              inventory.min_stay ??

              1

            )

          ),



        stop_sell:

          Boolean(

            inventory.stop_sell

          ),

      });

    }



    /* ==================================================

       RATE PLAN CURRENCY SAFETY

    ================================================== */



    await Promise.all(

      Array.from(

        usedRatePlanIds

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



          const responseText =

            await response.text();



          const result =

            parseJson(

              responseText

            );



          if (

            !response.ok

          ) {

            throw new Error(

              `Không kiểm tra được Rate Plan ${ratePlanId}.`

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

              `Rate Plan ${ratePlanId}: ${currency}, cần ${pmsCurrency}.`

            );

          }

        }

      )

    );



    /* ==================================================

       SEND AVAILABILITY

    ================================================== */



    let availabilityResult:

      unknown =

      null;



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



            cache:

              "no-store",



            body:

              JSON.stringify({

                values:

                  availabilityValues,

              }),

          }

        );



      const responseText =

        await response.text();



      availabilityResult =

        parseJson(

          responseText

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

      unknown =

      null;



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



            cache:

              "no-store",



            body:

              JSON.stringify({

                values:

                  restrictionValues,

              }),

          }

        );



      const responseText =

        await response.text();



      restrictionsResult =

        parseJson(

          responseText

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



    const warnings:

      ChannexWarning[] = [

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

       QUEUE → SYNCED

    ================================================== */



    const now =

      new Date()

        .toISOString();



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

            now,



          updated_at:

            now,

        })

        .in(

          "id",

          jobIds

        );



    if (

      completeError

    ) {

      throw new Error(

        completeError.message

      );

    }



    /* ==================================================

       SYNC HISTORY

    ================================================== */



    const syncStatus =

      warnings.length >

      0

        ? "warning"

        : "accepted";



    const {

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

            syncStatus,



          availability_count:

            availabilityValues.length,



          restrictions_count:

            restrictionValues.length,



          warnings,



          availability_response:

            availabilityResult,



          restrictions_response:

            restrictionsResult,



          /*

           * Cron không có user.

           */

          created_by:

            null,

        });



    if (

      logError

    ) {

      console.error(

        "Worker Sync Log:",

        logError

      );

    }



    return {

      propertyId,



      processed:

        claimedJobs.length,



      availability:

        availabilityValues.length,



      restrictions:

        restrictionValues.length,



      status:

        syncStatus,



      warnings,

    };

  } catch (

    error

  ) {

    const message =

      error instanceof

      Error

        ? error.message

        : "ARI Worker failed.";



    console.error(

      `ARI Worker ${propertyId}:`,

      error

    );



    /* ==================================================

       QUEUE → ERROR

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



    return {

      propertyId,



      processed:

        claimedJobs.length,



      availability:

        0,



      restrictions:

        0,



      status:

        "error",



      warnings:

        [],



      error:

        message,

    };

  }

}