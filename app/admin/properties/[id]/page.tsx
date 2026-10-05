import { notFound } from "next/navigation";

import AddRoomForm from "@/components/admin/add-room-form";
import AddRoomTypeForm from "@/components/admin/add-room-type-form";

import { createClient } from "@/lib/supabase/server";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const [
    propertyResult,
    roomTypesResult,
    roomsResult,
  ] = await Promise.all([

    supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .single(),

    supabase
      .from("room_types")
      .select("*")
      .eq("property_id", id)
      .order("name"),

    supabase
      .from("rooms")
      .select("*")
      .eq("property_id", id)
      .order("room_number"),

  ]);

  const property = propertyResult.data;
  const roomTypes = roomTypesResult.data ?? [];
  const rooms = roomsResult.data ?? [];

  if (!property) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl">

      <div className="mb-8">

        <p className="text-sm font-semibold text-blue-600">
          {property.code}
        </p>

        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          {property.name}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {property.address}
        </p>

      </div>


      <div className="grid gap-5 md:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-5">

          <p className="text-sm text-slate-500">
            Room Types
          </p>

          <p className="mt-2 text-3xl font-bold">
            {roomTypes.length}
          </p>

        </div>


        <div className="rounded-2xl border border-slate-200 bg-white p-5">

          <p className="text-sm text-slate-500">
            Physical Rooms
          </p>

          <p className="mt-2 text-3xl font-bold">
            {rooms.length}
          </p>

        </div>


        <div className="rounded-2xl border border-slate-200 bg-white p-5">

          <p className="text-sm text-slate-500">
            Currency
          </p>

          <p className="mt-2 text-3xl font-bold">
            {property.currency}
          </p>

        </div>

      </div>


      <div className="mt-8">
        <AddRoomTypeForm
          propertyId={property.id}
        />
      </div>


      <div className="mt-5">
        <AddRoomForm
          propertyId={property.id}
          roomTypes={roomTypes.map((roomType) => ({
            id: roomType.id,
            name: roomType.name,
          }))}
        />
      </div>


      <div className="mt-8">

        <h2 className="mb-4 text-lg font-semibold">
          Room Types
        </h2>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          {roomTypes.map((roomType) => (

            <div
              key={roomType.id}
              className="flex items-center justify-between border-b border-slate-100 px-6 py-4 last:border-0"
            >

              <div>

                <p className="font-semibold text-slate-900">
                  {roomType.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {roomType.code}
                </p>

              </div>

              <div className="text-sm text-slate-500">
                Max {roomType.max_occupancy} guests
              </div>

            </div>

          ))}

        </div>

      </div>


      <div className="mt-8">

        <h2 className="mb-4 text-lg font-semibold">
          Rooms
        </h2>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">

          {rooms.map((room) => {

            const roomType = roomTypes.find(
              (type) => type.id === room.room_type_id
            );

            return (
              <div
                key={room.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >

                <div className="flex items-center justify-between">

                  <p className="text-xl font-bold text-slate-900">
                    {room.room_number}
                  </p>

                  <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                    {room.status}
                  </span>

                </div>

                <p className="mt-3 text-sm text-slate-500">
                  {roomType?.name ?? "Unknown"}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Floor {room.floor || "-"}
                </p>

              </div>
            );
          })}

        </div>

      </div>

    </div>
  );
}