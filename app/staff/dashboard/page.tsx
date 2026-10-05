import { createClient } from "@/lib/supabase/server";

export default async function StaffDashboardPage() {
  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select(`
      id,
      room_number,
      floor,
      status,
      room_types (
        name
      )
    `)
    .order("room_number");

  return (
    <main className="min-h-screen bg-slate-50 p-8">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8">

          <p className="text-sm font-semibold text-blue-600">
            CITYHOUSE PMS
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Staff Dashboard
          </h1>

          <p className="mt-2 text-slate-500">
            Front desk operations
          </p>

        </div>

        <div className="rounded-2xl border bg-white shadow-sm">

          <div className="border-b p-5">
            <h2 className="font-semibold">
              Rooms
            </h2>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">

            {rooms?.map((room) => (

              <div
                key={room.id}
                className="rounded-xl border p-4"
              >

                <div className="flex items-center justify-between">

                  <span className="text-xl font-bold">
                    {room.room_number}
                  </span>

                  <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                    {room.status}
                  </span>

                </div>

                <p className="mt-3 text-sm text-slate-500">
                  Floor {room.floor}
                </p>

              </div>

            ))}

          </div>

        </div>

      </div>

    </main>
  );
}