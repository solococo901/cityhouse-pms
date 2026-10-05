import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const { data: properties } = await supabase
    .from("properties")
    .select(`
      id,
      code,
      name,
      address,
      active
    `)
    .order("name");

  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("*", {
      count: "exact",
      head: true,
    });

  const { count: roomCount } = await supabase
    .from("rooms")
    .select("*", {
      count: "exact",
      head: true,
    });

  return (
    <main className="min-h-screen bg-slate-50 p-8">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">
            CITYHOUSE PMS
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Admin Dashboard
          </h1>

          <p className="mt-2 text-slate-500">
            Property management overview
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Properties
            </p>

            <p className="mt-3 text-3xl font-bold">
              {properties?.length ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Rooms
            </p>

            <p className="mt-3 text-3xl font-bold">
              {roomCount ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Bookings
            </p>

            <p className="mt-3 text-3xl font-bold">
              {bookingCount ?? 0}
            </p>
          </div>

        </div>

        <div className="mt-8">

          <h2 className="mb-4 text-xl font-semibold">
            Properties
          </h2>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

            {properties?.map((property) => (
              <div
                key={property.id}
                className="rounded-2xl border bg-white p-6 shadow-sm"
              >

                <div className="flex items-start justify-between">

                  <div>
                    <p className="text-xs font-semibold text-blue-600">
                      {property.code}
                    </p>

                    <h3 className="mt-1 text-lg font-semibold">
                      {property.name}
                    </h3>
                  </div>

                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                    Active
                  </span>

                </div>

                <p className="mt-4 text-sm text-slate-500">
                  {property.address || "No address"}
                </p>

              </div>
            ))}

          </div>

        </div>

      </div>

    </main>
  );
}