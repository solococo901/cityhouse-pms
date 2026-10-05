import Link from "next/link";
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

  const { count: roomCount } = await supabase
    .from("rooms")
    .select("*", {
      count: "exact",
      head: true,
    });

  const { count: bookingCount } = await supabase
    .from("bookings")
    .select("*", {
      count: "exact",
      head: true,
    });

  return (
    <div className="mx-auto max-w-7xl">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Tổng quan hệ thống CityHouse PMS
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">
            Properties
          </p>

          <p className="mt-3 text-3xl font-bold text-slate-900">
            {properties?.length ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">
            Rooms
          </p>

          <p className="mt-3 text-3xl font-bold text-slate-900">
            {roomCount ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-500">
            Bookings
          </p>

          <p className="mt-3 text-3xl font-bold text-slate-900">
            {bookingCount ?? 0}
          </p>
        </div>

      </div>

      <div className="mt-8">

        <div className="mb-4 flex items-center justify-between">

          <h2 className="text-lg font-semibold text-slate-900">
            Properties
          </h2>

          <Link
            href="/admin/properties"
            className="text-sm font-medium text-blue-600"
          >
            View all
          </Link>

        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

          {properties?.map((property) => (

            <Link
              key={property.id}
              href={`/admin/properties/${property.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-sm"
            >

              <p className="text-xs font-semibold text-blue-600">
                {property.code}
              </p>

              <h3 className="mt-2 text-lg font-semibold text-slate-900">
                {property.name}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {property.address || "No address"}
              </p>

            </Link>

          ))}

        </div>

      </div>

    </div>
  );
}