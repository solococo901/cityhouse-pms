import Link from "next/link";

import {
  Building2,
  ChevronRight,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export default async function PropertiesPage() {
  const supabase = await createClient();

  const { data: properties } = await supabase
    .from("properties")
    .select(`
      id,
      code,
      name,
      address,
      currency,
      timezone,
      active
    `)
    .order("name");

  return (
    <div className="mx-auto max-w-7xl">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Properties
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Quản lý các khách sạn và tòa nhà
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        {properties?.map((property) => (

          <Link
            key={property.id}
            href={`/admin/properties/${property.id}`}
            className="flex items-center justify-between border-b border-slate-100 px-6 py-5 last:border-0 hover:bg-slate-50"
          >

            <div className="flex items-center gap-4">

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Building2 size={22} />
              </div>

              <div>

                <div className="flex items-center gap-3">

                  <h2 className="font-semibold text-slate-900">
                    {property.name}
                  </h2>

                  {property.active && (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                      Active
                    </span>
                  )}

                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {property.code}
                  {" · "}
                  {property.address || "No address"}
                </p>

              </div>

            </div>

            <ChevronRight
              size={20}
              className="text-slate-400"
            />

          </Link>

        ))}

      </div>

    </div>
  );
}