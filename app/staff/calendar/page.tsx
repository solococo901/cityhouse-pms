import ReservationCalendar from "@/components/staff/reservation-calendar";
import CreateBookingModal from "@/components/staff/create-booking-modal";
import CalendarToolbar from "@/components/staff/calendar-toolbar";

import { createClient } from "@/lib/supabase/server";

export const instant = false;

/* ======================================================
   DATE HELPERS
====================================================== */

function currentVietnamMonth() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (item) =>
        item.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (item) =>
        item.type === "month"
    )?.value ?? "";

  return `${year}-${month}`;
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

function getMonthDates(
  month: string
) {
  const [
    year,
    monthNumber,
  ] = month
    .split("-")
    .map(Number);

  const totalDays =
    new Date(
      Date.UTC(
        year,
        monthNumber,
        0
      )
    ).getUTCDate();

  return Array.from(
    {
      length: totalDays,
    },
    (_, index) =>
      `${month}-${String(
        index + 1
      ).padStart(2, "0")}`
  );
}

/* ======================================================
   PAGE
====================================================== */

export default async function StaffCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?:
      | string
      | string[];
  }>;
}) {
  /* ======================================================
     SEARCH PARAMS
  ====================================================== */

  const params =
    await searchParams;

  const rawMonth =
    Array.isArray(
      params.month
    )
      ? params.month[0]
      : params.month;

  const month =
    rawMonth &&
    /^\d{4}-\d{2}$/.test(
      rawMonth
    )
      ? rawMonth
      : currentVietnamMonth();

  /* ======================================================
     CALENDAR DATES
  ====================================================== */

  const dates =
    getMonthDates(
      month
    );

  const startDate =
    dates[0];

  const endDate =
    addDays(
      dates[
        dates.length - 1
      ],
      1
    );

  /* ======================================================
     SUPABASE
  ====================================================== */

  const supabase =
    await createClient();

  /* ======================================================
     PROPERTY
  ====================================================== */

  const {
    data: property,
    error: propertyError,
  } = await supabase
    .from("properties")
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
    propertyError ||
    !property
  ) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Không tìm thấy property.
        </div>
      </div>
    );
  }

  /* ======================================================
     LOAD DATA
  ====================================================== */

  const [
    roomsResult,
    roomTypesResult,
    ratePlansResult,
    bookingRoomsResult,
    inventoryResult,
    ratesResult,
  ] = await Promise.all([
    /* ROOMS */

    supabase
      .from("rooms")
      .select(`
        id,
        room_number,
        room_type_id,
        floor,
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

    /* ROOM TYPES */

    supabase
      .from("room_types")
      .select(`
        id,
        name,
        code
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

    /* RATE PLANS FOR CREATE BOOKING MODAL */

    supabase
      .from("rate_plans")
      .select(`
        id,
        name,
        code,
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
        "name"
      ),

    /* BOOKINGS */

    supabase
      .from("booking_rooms")
      .select(`
        id,

        room_id,
        room_type_id,

        check_in,
        check_out,

        check_in_time,
        check_out_time,

        adults,
        children,

        bookings!inner (
          id,
          property_id,

          code,
          source,
          status,

          total_amount,
          currency,

          notes,

          check_in_time,
          check_out_time,

          guests (
            first_name,
            last_name,
            phone,
            email
          )
        )
      `)
      .eq(
        "bookings.property_id",
        property.id
      )
      .lt(
        "check_in",
        endDate
      )
      .gt(
        "check_out",
        startDate
      ),

    /* INVENTORY */

    supabase
      .from(
        "inventory_calendar"
      )
      .select(`
        room_type_id,
        stay_date,
        total_rooms,
        available_rooms
      `)
      .eq(
        "property_id",
        property.id
      )
      .gte(
        "stay_date",
        startDate
      )
      .lt(
        "stay_date",
        endDate
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
        property.id
      )
      .gte(
        "stay_date",
        startDate
      )
      .lt(
        "stay_date",
        endDate
      ),
  ]);

  /* ======================================================
     LOG QUERY ERRORS
  ====================================================== */

  if (
    roomsResult.error
  ) {
    console.error(
      "Rooms error:",
      roomsResult.error
    );
  }

  if (
    roomTypesResult.error
  ) {
    console.error(
      "Room Types error:",
      roomTypesResult.error
    );
  }

  if (
    ratePlansResult.error
  ) {
    console.error(
      "Rate Plans error:",
      ratePlansResult.error
    );
  }

  if (
    bookingRoomsResult.error
  ) {
    console.error(
      "Bookings error:",
      bookingRoomsResult.error
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
     ROOM TYPES
  ====================================================== */

  const roomTypes =
    roomTypesResult.data ??
    [];

  /* ======================================================
     ROOMS
  ====================================================== */

  const rooms =
    (
      roomsResult.data ??
      []
    ).map(
      (room) => {
        const roomType =
          roomTypes.find(
            (type) =>
              type.id ===
              room.room_type_id
          );

        return {
          id:
            room.id,

          room_number:
            room.room_number,

          room_type_id:
            room.room_type_id,

          roomTypeName:
            roomType?.name ??
            "Unknown",
        };
      }
    );

  /* ======================================================
     RATE PLANS

     Keep Website rate first when it exists.
  ====================================================== */

  const ratePlans =
    (
      ratePlansResult.data ??
      []
    )
      .map(
        (ratePlan) => ({
          id:
            ratePlan.id,

          name:
            ratePlan.name,

          code:
            ratePlan.code,
        })
      )
      .sort(
        (a, b) => {
          const aPriority =
            a.code === "WEBSITE"
              ? 0
              : 1;

          const bPriority =
            b.code === "WEBSITE"
              ? 0
              : 1;

          if (
            aPriority !==
            bPriority
          ) {
            return (
              aPriority -
              bPriority
            );
          }

          return a.name.localeCompare(
            b.name
          );
        }
      );

  /* ======================================================
     BOOKINGS
  ====================================================== */

  const bookings =
    (
      bookingRoomsResult.data ??
      []
    ).map(
      (row: any) => {
        const booking =
          row.bookings;

        const guest =
          booking?.guests;

        const room =
          rooms.find(
            (item) =>
              item.id ===
              row.room_id
          );

        const guestName =
          [
            guest?.first_name,
            guest?.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
          "Guest";

        return {
          /*
           * booking_rooms.id
           * dùng cho drag / resize
           */
          id:
            row.id,

          /*
           * bookings.id
           * dùng check-in / checkout
           */
          bookingId:
            booking?.id ??
            "",

          room_id:
            row.room_id,

          roomNumber:
            room?.room_number ??
            "Unassigned",

          roomTypeName:
            room?.roomTypeName ??
            "Unknown",

          check_in:
            row.check_in,

          check_out:
            row.check_out,

          code:
            booking?.code ??
            "",

          guestName,

          phone:
            guest?.phone ??
            null,

          email:
            guest?.email ??
            null,

          source:
            booking?.source ??
            "direct",

          status:
            booking?.status ??
            "confirmed",

          totalAmount:
            Number(
              booking
                ?.total_amount ??
                0
            ),

          currency:
            booking?.currency ??
            "VND",

          notes:
            booking?.notes ??
            null,
        };
      }
    );

  /* ======================================================
     INVENTORY
  ====================================================== */

  const inventory =
    (
      inventoryResult.data ??
      []
    ).map(
      (item) => ({
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
      (item) => ({
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
    <div className="-m-8 bg-white">
      {/* ==================================================
          PAGE HEADER
      ================================================== */}

      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-blue-600">
            {property.code}
          </p>

          <h1 className="text-lg font-bold text-slate-900">
            Reservation Calendar
          </h1>

          <p className="text-xs text-slate-500">
            {property.name}
          </p>
        </div>

        <CreateBookingModal
          propertyId={
            property.id
          }
          rooms={rooms}
          ratePlans={
            ratePlans
          }
        />
      </div>

      {/* ==================================================
          TOOLBAR
      ================================================== */}

      <div className="bg-white px-2 pt-2">
        <CalendarToolbar
          month={month}
        />
      </div>

      {/* ==================================================
          RESERVATION CALENDAR
      ================================================== */}

      <ReservationCalendar
        dates={dates}
        rooms={rooms}
        bookings={bookings}
        inventory={inventory}
        rates={rates}
      />
    </div>
  );
}
