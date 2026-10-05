import ReservationCalendar
from "@/components/staff/reservation-calendar";

import {
  createClient,
} from "@/lib/supabase/server";


function todayVietnam() {

  const parts =
    new Intl
      .DateTimeFormat(
        "en-US",
        {
          timeZone:
            "Asia/Ho_Chi_Minh",

          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      )
      .formatToParts(
        new Date()
      );


  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;


  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;


  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;


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
    .slice(
      0,
      10
    );

}


export default async function StaffCalendarPage() {

  const supabase =
    await createClient();


  const {
    data: property,
  } =
    await supabase
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
      .order("name")
      .limit(1)
      .maybeSingle();


  if (!property) {

    return (

      <div>
        No property found.
      </div>

    );

  }


  const startDate =
    todayVietnam();


  const dates =
    Array.from(
      {
        length: 7,
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
    addDays(
      startDate,
      7
    );


  const [
    roomsResult,
    roomTypesResult,
    bookingRoomsResult,
  ] =
    await Promise.all([

      supabase
        .from("rooms")
        .select(`
          id,
          room_number,
          room_type_id,
          floor,
          status
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


      supabase
        .from("room_types")
        .select(`
          id,
          name
        `)
        .eq(
          "property_id",
          property.id
        ),


      supabase
        .from(
          "booking_rooms"
        )
        .select(`
          id,
          room_id,
          room_type_id,
          check_in,
          check_out,

          bookings!inner (
            id,
            code,
            source,
            status,

            guests (
              first_name,
              last_name
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


  const roomTypes =
    roomTypesResult.data ??
    [];


  const rooms =
    (
      roomsResult.data ??
      []
    ).map(
      (room) => {

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

      }
    );


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


        const guestName =
          [
            guest?.first_name,
            guest?.last_name,
          ]
            .filter(Boolean)
            .join(" ") ||
          "Guest";


        return {

          id:
            row.id,

          room_id:
            row.room_id,

          check_in:
            row.check_in,

          check_out:
            row.check_out,

          code:
            booking?.code ??
            "",

          guestName,

          source:
            booking?.source ??
            "direct",

          status:
            booking?.status ??
            "",

        };

      }
    );


  return (

    <div>

      <div className="mb-8">

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


      <ReservationCalendar
        dates={dates}
        rooms={rooms}
        bookings={bookings}
      />

    </div>

  );

}