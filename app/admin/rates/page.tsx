import AddRatePlanForm from "@/components/admin/add-rate-plan-form";
import { createClient } from "@/lib/supabase/server";

export default async function RatesPage() {
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id, name, code")
    .eq("active", true)
    .order("name")
    .limit(1)
    .maybeSingle();

  if (!property) {
    return (
      <div>
        <h1 className="text-2xl font-bold">
          Rates
        </h1>

        <p className="mt-3 text-slate-500">
          Chưa có property.
        </p>
      </div>
    );
  }

  const { data: ratePlans } = await supabase
    .from("rate_plans")
    .select("*")
    .eq("property_id", property.id)
    .order("name");

  return (
    <div className="mx-auto max-w-7xl">

      <div className="mb-8">

        <p className="text-sm font-semibold text-blue-600">
          {property.code}
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Rate Plans
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {property.name}
        </p>

      </div>

      <AddRatePlanForm
        propertyId={property.id}
      />

      <div className="mt-8">

        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Rate Plans
        </h2>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          {ratePlans?.map((rate) => (

            <div
              key={rate.id}
              className="flex items-center justify-between border-b border-slate-100 px-6 py-5 last:border-none"
            >

              <div>

                <div className="flex items-center gap-3">

                  <h3 className="font-semibold text-slate-900">
                    {rate.name}
                  </h3>

                  {rate.active && (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">
                      Active
                    </span>
                  )}

                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {rate.code}
                </p>

              </div>

              <div className="text-right">

                <p className="text-sm text-slate-600">
                  {rate.refundable
                    ? "Refundable"
                    : "Non-refundable"}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {rate.meal_plan}
                </p>

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>
  );
}