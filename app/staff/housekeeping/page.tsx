import HousekeepingBoard
from "@/components/staff/housekeeping-board";

import {
  createClient,
} from "@/lib/supabase/server";

export const instant = false;


/* ======================================================
   PAGE
====================================================== */

export default async function HousekeepingPage() {

  const supabase =
    await createClient();


  const {
    data: property,
    error: propertyError,
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
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Không tìm thấy property đang hoạt động.
      </div>
    );

  }


  const {
    data: rooms,
    error: roomsError,
  } =
    await supabase
      .from("rooms")
      .select(`
        id,
        property_id,
        room_type_id,
        room_number,
        floor,
        status,
        active,
        updated_at
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
      );


  if (roomsError) {

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {roomsError.message}
      </div>
    );

  }


  const {
    data: roomTypes,
    error: roomTypesError,
  } =
    await supabase
      .from("room_types")
      .select(`
        id,
        name
      `)
      .eq(
        "property_id",
        property.id
      );


  if (roomTypesError) {

    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {roomTypesError.message}
      </div>
    );

  }


  const roomTypeMap =
    new Map(
      (
        roomTypes ??
        []
      ).map(
        (roomType) => [
          roomType.id,
          roomType.name,
        ]
      )
    );


  const normalizedRooms =
    (
      rooms ??
      []
    ).map(
      (room) => ({
        ...room,

        roomTypeName:
          roomTypeMap.get(
            room.room_type_id
          ) ??
          "Unknown",
      })
    );


  return (
    <div className="space-y-6">

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
          Hotel Operations
        </p>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Housekeeping
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {property.name} · cập nhật trạng thái dọn phòng theo thời gian thực.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            Property:{" "}
            <span className="font-semibold text-slate-900">
              {property.code}
            </span>
          </div>

        </div>
      </div>


      <HousekeepingBoard
        rooms={
          normalizedRooms
        }
      />

    </div>
  );

}
