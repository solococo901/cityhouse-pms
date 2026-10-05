"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AddRatePlanForm({
  propertyId,
}: {
  propertyId: string;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [refundable, setRefundable] = useState(true);
  const [mealPlan, setMealPlan] = useState("room_only");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("rate_plans")
      .insert({
        property_id: propertyId,
        name,
        code: code.toUpperCase(),
        refundable,
        meal_plan: mealPlan,
      });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setName("");
    setCode("");
    setRefundable(true);
    setMealPlan("room_only");

    router.refresh();

    setLoading(false);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div>
        <h2 className="font-semibold text-slate-900">
          Add Rate Plan
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Tạo chính sách giá bán cho khách sạn
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Standard Rate"
          required
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="STANDARD"
          required
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <select
          value={mealPlan}
          onChange={(e) => setMealPlan(e.target.value)}
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
        >
          <option value="room_only">
            Room Only
          </option>

          <option value="breakfast">
            Breakfast Included
          </option>
        </select>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm">

          <input
            type="checkbox"
            checked={refundable}
            onChange={(e) => setRefundable(e.target.checked)}
          />

          Refundable

        </label>

      </div>

      {errorMessage && (
        <p className="mt-4 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <button
        disabled={loading}
        className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : "Add Rate Plan"}
      </button>

    </form>
  );
}