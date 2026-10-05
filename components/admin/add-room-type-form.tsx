"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function AddRoomTypeForm({
  propertyId,
}: {
  propertyId: string;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [maxOccupancy, setMaxOccupancy] = useState("2");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("room_types")
      .insert({
        property_id: propertyId,
        name,
        code: code.toUpperCase(),
        max_occupancy: Number(maxOccupancy),
      });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setName("");
    setCode("");
    setMaxOccupancy("2");

    router.refresh();

    setLoading(false);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >

      <h3 className="font-semibold text-slate-900">
        Add Room Type
      </h3>

      <div className="mt-5 grid gap-4 md:grid-cols-3">

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Studio Deluxe"
          required
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="STUDIO_DLX"
          required
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <input
          type="number"
          min="1"
          value={maxOccupancy}
          onChange={(e) => setMaxOccupancy(e.target.value)}
          placeholder="Occupancy"
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

      </div>

      {errorMessage && (
        <p className="mt-3 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <button
        disabled={loading}
        className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : "Add Room Type"}
      </button>

    </form>
  );
}   