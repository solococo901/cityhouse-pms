import ReservationCalendar from "@/components/staff/reservation-calendar";
import CreateBookingModal from "@/components/staff/create-booking-modal";

import { createClient } from "@/lib/supabase/server";

/* ======================================================
   DATE HELPERS
====================================================== */

function todayVietnam() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year =
    parts.find((part) => part.type === "year")?.value ?? "";

  const month =
    parts.find((part) => part.type === "month")?.value ?? "";

  const day =
    parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}-${month}-${day}`;
}

function addDays(
  date: string,
  amount: number
) {
  const value = new Date(
    `${date}T00:00:00Z`
  );

  value.setUTCDate(
    value.getUTCDate() + amount
  );

  return value
    .toISOString()
    .slice(0, 10);
}

/* ======================================================
   PAGE
====================================================== */

export default async function StaffCalendarPage() {
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
    .eq("active", true)
    .order("name")
    .limit(1)
    .maybeSingle();

  if (
    propertyError ||
    !property
  ) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        Không tìm thấy property.
      </div>
    );
  }

  /* ======================================================
     CALENDAR RANGE
  ====================================================== */

  const startDate =
    todayVietnam();

  const dates =
    Array.from(
      {
        length: 7,
      },
      (_, index) =>
        addDays(
          startDate,
          index
        )
    );

  const endDate =
    addDays(
      startDate,
      7
    );

  /* ======================================================
     LOAD DATA
  ====================================================== */

  const [
    roomsResult,
    roomTypesResult,
    bookingRoomsResult,
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

          guests (
            first_name,
            last_name,
            phone,
            email
          )
        )
      `)
      .lt(
        "check_in",
        endDate
      )
      .gt(
        "check_out",
        startDate
      ),
  ]);

  /* ======================================================
     ERROR
  ====================================================== */

  if (roomsResult.error) {
    console.error(
      "Rooms error:",
      roomsResult.error
    );
  }

  if (roomTypesResult.error) {
    console.error(
      "Room types error:",
      roomTypesResult.error
    );
  }

  if (bookingRoomsResult.error) {
    console.error(
      "Booking rooms error:",
      bookingRoomsResult.error
    );
  }

  /* ======================================================
     ROOM TYPES
  ====================================================== */

  const roomTypes =
    roomTypesResult.data ?? [];

  /* ======================================================
     ROOMS
  ====================================================== */

  const rooms =
    (
      roomsResult.data ?? []
    ).map((room) => {
      const roomType =
        roomTypes.find(
          (item) =>
            item.id ===
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
    });

  /* ======================================================
     BOOKINGS
  ====================================================== */

  const bookings =
    (
      bookingRoomsResult.data ?? []
    ).map((row: any) => {
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
         * dùng cho drag & drop
         */
        id:
          row.id,

        /*
         * bookings.id
         * dùng cho check-in/check-out
         */
        bookingId:
          booking?.id ?? "",

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
    });

  /* ======================================================
     PAGE
  ====================================================== */

  return (
    <div>
      {/* HEADER */}

      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-blue-600">
            {property.code}
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Reservation Calendar
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {property.name}
          </p>
        </div>

        {/* NEW BOOKING */}

        <CreateBookingModal
          propertyId={
            property.id
          }
          rooms={
            rooms.map(
              (room) => ({
                id:
                  room.id,

                room_number:
                  room.room_number,

                roomTypeName:
                  room.roomTypeName,
              })
            )
          }
        />
      </div>

      {/* DATE RANGE */}

      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          {dates[0]}
          {" → "}
          {
            dates[
              dates.length - 1
            ]
          }
        </div>

        <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          7 days
        </div>
      </div>

      {/* CALENDAR */}

      <ReservationCalendar
        dates={dates}
        rooms={rooms}
        bookings={bookings}
      />
    </div>
  );
}