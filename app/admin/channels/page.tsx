import ChannexAriPreviewCard from "@/components/admin/channex-ari-preview-card";
import ChannexConnectionCard from "@/components/admin/channex-connection-card";
import ChannexMappingCard from "@/components/admin/channex-mapping-card";
import ChannexSyncHistoryCard from "@/components/admin/channex-sync-history-card";
import ChannexAriQueueCard from "@/components/admin/channex-ari-queue-card";

import {
  createClient,
} from "@/lib/supabase/server";

/* ======================================================
   NEXT.JS
====================================================== */

export const instant =
  false;

/* ======================================================
   PAGE
====================================================== */

export default async function ChannelsPage() {
  const supabase =
    await createClient();

  /* ======================================================
     PROPERTY
  ====================================================== */

  const {
    data:
    property,

    error:
    propertyError,
  } =
    await supabase
      .from(
        "properties"
      )
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "active",
        true
      )
      .order(
        "name"
      )
      .limit(
        1
      )
      .maybeSingle();

  if (
    propertyError
  ) {
    console.error(
      "Channels property error:",
      propertyError
    );
  }

  if (
    !property
  ) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
        Chưa có property.
      </div>
    );
  }

  /* ======================================================
     CHANNEX CONNECTION
  ====================================================== */

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
        provider,
        environment,
        channex_property_id,
        connection_status,
        last_tested_at,
        last_error,
        active
      `)
      .eq(
        "property_id",
        property.id
      )
      .eq(
        "provider",
        "channex"
      )
      .eq(
        "environment",
        "staging"
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    connectionError
  ) {
    console.error(
      "Channels connection error:",
      connectionError
    );
  }

  /* ======================================================
     PMS ROOM TYPES
  ====================================================== */

  const {
    data:
    roomTypesData,

    error:
    roomTypesError,
  } =
    await supabase
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
        property.id
      )
      .eq(
        "active",
        true
      )
      .order(
        "name"
      );

  if (
    roomTypesError
  ) {
    console.error(
      "Channels room types error:",
      roomTypesError
    );
  }

  /* ======================================================
     PMS RATE PLANS
  ====================================================== */

  const {
    data:
    ratePlansData,

    error:
    ratePlansError,
  } =
    await supabase
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
        property.id
      )
      .eq(
        "active",
        true
      )
      .order(
        "name"
      );

  if (
    ratePlansError
  ) {
    console.error(
      "Channels rate plans error:",
      ratePlansError
    );
  }

  /* ======================================================
     NORMALIZED PMS DATA
  ====================================================== */

  const roomTypes =
    roomTypesData ??
    [];

  const ratePlans =
    ratePlansData ??
    [];

  /* ======================================================
     EXISTING MAPPINGS
  ====================================================== */

  let existingRoomMappings:
    {
      room_type_id:
      string;

      channex_room_type_id:
      string;
    }[] = [];

  let existingRateMappings:
    {
      room_type_id:
      string;

      rate_plan_id:
      string;

      channex_rate_plan_id:
      string;
    }[] = [];

  if (
    connection
  ) {
    const [
      roomMappingsResult,
      rateMappingsResult,
    ] =
      await Promise.all([
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
      ]);

    if (
      roomMappingsResult.error
    ) {
      console.error(
        "Room mapping error:",
        roomMappingsResult.error
      );
    }

    if (
      rateMappingsResult.error
    ) {
      console.error(
        "Rate mapping error:",
        rateMappingsResult.error
      );
    }

    existingRoomMappings =
      roomMappingsResult.data ??
      [];

    existingRateMappings =
      rateMappingsResult.data ??
      [];
  }

  /* ======================================================
     PROPERTY MAPPED
  ====================================================== */

  const propertyMapped =
    Boolean(
      connection &&
      connection
        .channex_property_id &&
      connection
        .connection_status ===
      "connected"
    );

  /* ======================================================
     ROOM MAPPING COMPLETENESS
  ====================================================== */

  const activeRoomIds =
    new Set(
      roomTypes.map(
        (
          room
        ) =>
          room.id
      )
    );

  const mappedRoomIds =
    new Set(
      existingRoomMappings
        .filter(
          (
            mapping
          ) =>
            activeRoomIds.has(
              mapping
                .room_type_id
            ) &&
            Boolean(
              mapping
                .channex_room_type_id
            )
        )
        .map(
          (
            mapping
          ) =>
            mapping
              .room_type_id
        )
    );

  const roomsMappingComplete =
    roomTypes.length >
    0 &&
    mappedRoomIds.size ===
    roomTypes.length;

  /* ======================================================
     EXPECTED RATE MAPPINGS

     Room Type × Rate Plan.

     2 rooms × 2 rate plans = 4.
  ====================================================== */

  const expectedRateMappingKeys =
    new Set<
      string
    >();

  for (
    const room of
    roomTypes
  ) {
    for (
      const rate of
      ratePlans
    ) {
      expectedRateMappingKeys.add(
        `${room.id}:${rate.id}`
      );
    }
  }

  /* ======================================================
     EXISTING RATE MAPPING KEYS
  ====================================================== */

  const existingRateMappingKeys =
    new Set(
      existingRateMappings
        .filter(
          (
            mapping
          ) =>
            Boolean(
              mapping
                .channex_rate_plan_id
            )
        )
        .map(
          (
            mapping
          ) =>
            `${mapping.room_type_id}:${mapping.rate_plan_id}`
        )
    );

  /* ======================================================
     RATE MAPPING COMPLETENESS
  ====================================================== */

  let ratesMappingComplete =
    expectedRateMappingKeys
      .size >
    0;

  for (
    const key of
    expectedRateMappingKeys
  ) {
    if (
      !existingRateMappingKeys.has(
        key
      )
    ) {
      ratesMappingComplete =
        false;

      break;
    }
  }

  /* ======================================================
     FINAL MAPPING STATUS
  ====================================================== */

  const mappingComplete =
    propertyMapped &&
    roomsMappingComplete &&
    ratesMappingComplete;

  /* ======================================================
     COUNTERS
  ====================================================== */

  const expectedRoomMappings =
    roomTypes.length;

  const actualRoomMappings =
    mappedRoomIds.size;

  const expectedRateMappings =
    expectedRateMappingKeys
      .size;

  const actualRateMappings =
    Array.from(
      expectedRateMappingKeys
    ).filter(
      (
        key
      ) =>
        existingRateMappingKeys.has(
          key
        )
    ).length;

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="mx-auto max-w-5xl">

      {/* ==================================================
          PAGE HEADER
      ================================================== */}

      <div className="mb-8">

        <p className="text-sm font-semibold text-blue-600">
          {
            property.code
          }
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Channels
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {
            property.name
          }
        </p>

      </div>

      {/* ==================================================
          CHANNEX CONNECTION
      ================================================== */}

      <ChannexConnectionCard
        propertyId={
          property.id
        }

        propertyName={
          property.name
        }

        existingConnection={
          connection
            ? {
              id:
                connection.id,

              channexPropertyId:
                connection
                  .channex_property_id,

              status:
                connection
                  .connection_status,

              lastTestedAt:
                connection
                  .last_tested_at,

              lastError:
                connection
                  .last_error,
            }
            : null
        }
      />

      {/* ==================================================
          ROOM + RATE MAPPING
      ================================================== */}

      {propertyMapped && (

        <ChannexMappingCard
          propertyId={
            property.id
          }

          roomTypes={
            roomTypes
          }

          ratePlans={
            ratePlans
          }

          existingRoomMappings={
            existingRoomMappings
          }

          existingRateMappings={
            existingRateMappings
          }
        />

      )}

      {/* ==================================================
          MAPPING STATUS
      ================================================== */}

      {propertyMapped && (

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>

              <h2 className="font-bold text-slate-900">
                Channex Mapping Status
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Mapping phải hoàn chỉnh trước khi tạo ARI Preview.
              </p>

            </div>


            <div
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mappingComplete
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
                }`}
            >

              {mappingComplete
                ? "READY FOR ARI"
                : "MAPPING REQUIRED"}

            </div>

          </div>


          <div className="mt-4 grid gap-3 md:grid-cols-2">

            {/* ROOM TYPE */}

            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Room Types
              </p>

              <p
                className={`mt-2 text-lg font-bold ${roomsMappingComplete
                    ? "text-green-700"
                    : "text-amber-700"
                  }`}
              >

                {
                  actualRoomMappings
                }

                /

                {
                  expectedRoomMappings
                }

              </p>

            </div>

            {/* RATE PLAN */}

            <div className="rounded-xl bg-slate-50 p-4">

              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Rate Plans
              </p>

              <p
                className={`mt-2 text-lg font-bold ${ratesMappingComplete
                    ? "text-green-700"
                    : "text-amber-700"
                  }`}
              >

                {
                  actualRateMappings
                }

                /

                {
                  expectedRateMappings
                }

              </p>

            </div>

          </div>

        </div>

      )}

      {/* ==================================================
          ARI + HISTORY
      ================================================== */}

      {mappingComplete && (
        <>
          <ChannexAriPreviewCard
            propertyId={
              property.id
            }
          />

          <ChannexAriQueueCard
            propertyId={
              property.id
            }
          />

          <ChannexSyncHistoryCard
            propertyId={
              property.id
            }
          />
        </>
      )}

      {/* ==================================================
          WAITING
      ================================================== */}

      {propertyMapped &&
        !mappingComplete && (

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">

            <p className="font-semibold text-amber-800">
              ARI Preview chưa khả dụng
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-700">

              Hoàn tất toàn bộ Room Type và Rate Plan mapping rồi bấm{" "}

              <strong>
                Save Mapping
              </strong>

              . Sau đó ARI Preview sẽ tự xuất hiện.

            </p>

          </div>

        )}

    </div>
  );
}