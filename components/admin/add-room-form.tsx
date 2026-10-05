"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type RoomType = {
  id: string;
  name: string;
};

export default function AddRoomForm({
  propertyId,
  roomTypes,
}: {
  propertyId: string;
  roomTypes: RoomType[];
}) {
  const router = useRouter();

  const [roomNumber, setRoomNumber] = useState("");
  const [floor, setFloor] = useState("");

  const [roomTypeId, setRoomTypeId] = useState(
    roomTypes[0]?.id ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("rooms")
      .insert({
        property_id: propertyId,
        room_type_id: roomTypeId,
        room_number: roomNumber,
        floor,
      });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setRoomNumber("");
    setFloor("");

    router.refresh();

    setLoading(false);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white p-6"
    >

      <h3 className="font-semibold text-slate-900">
        Add Physical Room
      </h3>

      <div className="mt-5 grid gap-4 md:grid-cols-3">

        <input
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          placeholder="Room 301"
          required
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <input
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          placeholder="Floor 3"
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <select
          value={roomTypeId}
          onChange={(e) => setRoomTypeId(e.target.value)}
          required
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        >

          {roomTypes.map((roomType) => (

            <option
              key={roomType.id}
              value={roomType.id}
            >
              {roomType.name}
            </option>

          ))}

        </select>

      </div>

      {errorMessage && (
        <p className="mt-3 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <button
        disabled={loading || !roomTypeId}
        className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : "Add Room"}
      </button>

    </form>
  );
}