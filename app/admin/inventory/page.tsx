import InventoryCalendar from "@/components/admin/inventory-calendar";
import GenerateCalendarData from "@/components/admin/generate-calendar-data";
import BulkAriUpdate from "@/components/admin/bulk-ari-update";

import {
  createClient,
} from "@/lib/supabase/server";

/* ======================================================
   NEXT.JS

   Trang này dùng dữ liệu Supabase theo request.
   Không prerender bằng Instant Navigation.
====================================================== */

export const instant = false;

/* ======================================================
   DATE HELPERS
====================================================== */

function getVietnamToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Ho_Chi_Minh",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value ?? "";

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value ?? "";

  return `${year}-${month}-${day}`;
}

function addDays(
  date: string,
  amount: number
) {
  const value =
    new Date(
      `${date}T00:00:00Z`
    );

  value.setUTCDate(
    value.getUTCDate() +
      amount
  );

  return value
    .toISOString()
    .slice(0, 10);
}

/* ======================================================
   PAGE
====================================================== */

export default async function InventoryPage() {
  const supabase =
    await createClient();

  /* ======================================================
     PROPERTY
  ====================================================== */

  const {
    data: property,
    error: propertyError,
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
      .limit(1)
      .maybeSingle();

  if (
    propertyError
  ) {
    console.error(
      "Property error:",
      propertyError
    );
  }

  if (
    !property
  ) {
    return (
      <div className="mx-auto max-w-full">

        <h1 className="text-2xl font-bold text-slate-900">
          Inventory
        </h1>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
          Chưa có property.
        </div>

      </div>
    );
  }

  /* ======================================================
     DATE RANGE
     14 DAYS
  ====================================================== */

  const startDate =
    getVietnamToday();

  const dates =
    Array.from(
      {
        length: 14,
      },
      (
        _,
        index
      ) =>
        addDays(
          startDate,
          index
        )
    );

  const endDate =
    dates[
      dates.length - 1
    ];

  /* ======================================================
     LOAD DATA
  ====================================================== */

  const [
    roomTypesResult,
    roomsResult,
    ratePlansResult,
    inventoryResult,
    ratesResult,
  ] =
    await Promise.all([
      /* ==================================================
         ROOM TYPES
      ================================================== */

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
          property.id
        )
        .eq(
          "active",
          true
        )
        .order(
          "name"
        ),

      /* ==================================================
         ROOMS
      ================================================== */

      supabase
        .from(
          "rooms"
        )
        .select(`
          id,
          room_number,
          room_type_id,
          status,
          active
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
          "room_number"
        ),

      /* ==================================================
         RATE PLANS
      ================================================== */

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
          property.id
        )
        .eq(
          "active",
          true
        )
        .order(
          "name"
        ),

      /* ==================================================
         INVENTORY
      ================================================== */

      supabase
        .from(
          "inventory_calendar"
        )
        .select(`
          id,
          room_type_id,
          stay_date,
          total_rooms,
          available_rooms,
          min_stay,
          stop_sell
        `)
        .eq(
          "property_id",
          property.id
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

      /* ==================================================
         RATES
      ================================================== */

      supabase
        .from(
          "rate_calendar"
        )
        .select(`
          id,
          room_type_id,
          rate_plan_id,
          stay_date,
          price
        `)
        .eq(
          "property_id",
          property.id
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

  /* ======================================================
     ERRORS
  ====================================================== */

  if (
    roomTypesResult.error
  ) {
    console.error(
      "Room types error:",
      roomTypesResult.error
    );
  }

  if (
    roomsResult.error
  ) {
    console.error(
      "Rooms error:",
      roomsResult.error
    );
  }

  if (
    ratePlansResult.error
  ) {
    console.error(
      "Rate plans error:",
      ratePlansResult.error
    );
  }

  if (
    inventoryResult.error
  ) {
    console.error(
      "Inventory error:",
      inventoryResult.error
    );
  }

  if (
    ratesResult.error
  ) {
    console.error(
      "Rates error:",
      ratesResult.error
    );
  }

  /* ======================================================
     RAW DATA
  ====================================================== */

  const rawRoomTypes =
    roomTypesResult.data ??
    [];

  const rawRooms =
    roomsResult.data ??
    [];

  const rawRatePlans =
    ratePlansResult.data ??
    [];

  /* ======================================================
     ROOM TYPES
  ====================================================== */

  const roomTypes =
    rawRoomTypes.map(
      (
        roomType
      ) => {
        const totalRooms =
          rawRooms.filter(
            (
              room
            ) =>
              room.room_type_id ===
              roomType.id
          ).length;

        return {
          id:
            roomType.id,

          code:
            roomType.code,

          name:
            roomType.name,

          totalRooms,
        };
      }
    );

  /* ======================================================
     RATE PLANS
  ====================================================== */

  const ratePlans =
    rawRatePlans.map(
      (
        ratePlan
      ) => ({
        id:
          ratePlan.id,

        code:
          ratePlan.code,

        name:
          ratePlan.name,
      })
    );

  /* ======================================================
     INVENTORY

     Chuẩn hóa dữ liệu trước khi truyền
     sang Client Component.
  ====================================================== */

  const inventory =
    (
      inventoryResult.data ??
      []
    ).map(
      (
        item
      ) => ({
        id:
          item.id,

        room_type_id:
          item.room_type_id,

        stay_date:
          item.stay_date,

        total_rooms:
          Number(
            item.total_rooms ??
            0
          ),

        available_rooms:
          Number(
            item.available_rooms ??
            0
          ),

        min_stay:
          Number(
            item.min_stay ??
            1
          ),

        stop_sell:
          Boolean(
            item.stop_sell
          ),
      })
    );

  /* ======================================================
     RATES
  ====================================================== */

  const rates =
    (
      ratesResult.data ??
      []
    ).map(
      (
        item
      ) => ({
        id:
          item.id,

        room_type_id:
          item.room_type_id,

        rate_plan_id:
          item.rate_plan_id,

        stay_date:
          item.stay_date,

        price:
          Number(
            item.price ??
            0
          ),
      })
    );

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <div className="mx-auto max-w-full">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="mb-8">

        <p className="text-sm font-semibold text-blue-600">
          {
            property.code
          }
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Rates & Inventory
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {
            property.name
          }
        </p>

      </div>

      {/* ==================================================
          CURRENT RANGE
      ================================================== */}

      <div className="mb-5 flex flex-wrap items-center gap-3">

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">

          {
            dates[0]
          }

          {" → "}

          {
            dates[
              dates.length -
                1
            ]
          }

        </div>

        <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          14 days
        </div>

      </div>

      {/* ==================================================
          GENERATE CALENDAR DATA
      ================================================== */}

      <div className="mb-6">

        <GenerateCalendarData
          propertyId={
            property.id
          }
        />

      </div>

      {/* ==================================================
          BULK UPDATE
      ================================================== */}

      <div className="mb-6">

        <BulkAriUpdate
          propertyId={
            property.id
          }

          roomTypes={
            roomTypes.map(
              (
                item
              ) => ({
                id:
                  item.id,

                name:
                  item.name,
              })
            )
          }

          ratePlans={
            ratePlans.map(
              (
                item
              ) => ({
                id:
                  item.id,

                name:
                  item.name,

                code:
                  item.code,
              })
            )
          }
        />

      </div>

      {/* ==================================================
          INVENTORY CALENDAR
      ================================================== */}

      <InventoryCalendar
        dates={
          dates
        }

        roomTypes={
          roomTypes
        }

        ratePlans={
          ratePlans
        }

        inventory={
          inventory
        }

        rates={
          rates
        }
      />

    </div>
  );
}