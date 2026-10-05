"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RoomType = {
  id: string;
  code: string;
  name: string;
  totalRooms: number;
};

type RatePlan = {
  id: string;
  code: string;
  name: string;
};

type InventoryRow = {
  id?: string;
  property_id: string;
  room_type_id: string;
  stay_date: string;
  total_rooms: number;
  available_rooms: number;
  min_stay: number;
  stop_sell: boolean;
};

type RateRow = {
  id?: string;
  property_id: string;
  room_type_id: string;
  rate_plan_id: string;
  stay_date: string;
  price: number;
};

type Props = {
  propertyId: string;
  dates: string[];
  roomTypes: RoomType[];
  ratePlans: RatePlan[];
  initialInventory: InventoryRow[];
  initialRates: RateRow[];
};

function displayDate(date: string) {
  const value = new Date(`${date}T00:00:00`);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
  }).format(value);
}

function displayDay(date: string) {
  const value = new Date(`${date}T00:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(value);
}

export default function InventoryCalendar({
  propertyId,
  dates,
  roomTypes,
  ratePlans,
  initialInventory,
  initialRates,
}: Props) {
  const supabase = createClient();

  const [inventory, setInventory] =
    useState<InventoryRow[]>(initialInventory);

  const [rates, setRates] =
    useState<RateRow[]>(initialRates);

  const [saving, setSaving] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  function getInventory(
    roomType: RoomType,
    date: string
  ): InventoryRow {
    return (
      inventory.find(
        (item) =>
          item.room_type_id === roomType.id &&
          item.stay_date === date
      ) ?? {
        property_id: propertyId,
        room_type_id: roomType.id,
        stay_date: date,
        total_rooms: roomType.totalRooms,
        available_rooms: roomType.totalRooms,
        min_stay: 1,
        stop_sell: false,
      }
    );
  }

  function getRate(
    roomTypeId: string,
    ratePlanId: string,
    date: string
  ): RateRow {
    return (
      rates.find(
        (item) =>
          item.room_type_id === roomTypeId &&
          item.rate_plan_id === ratePlanId &&
          item.stay_date === date
      ) ?? {
        property_id: propertyId,
        room_type_id: roomTypeId,
        rate_plan_id: ratePlanId,
        stay_date: date,
        price: 0,
      }
    );
  }

  function updateInventoryState(
    roomType: RoomType,
    date: string,
    patch: Partial<InventoryRow>
  ) {
    setInventory((current) => {
      const existing = current.find(
        (item) =>
          item.room_type_id === roomType.id &&
          item.stay_date === date
      );

      if (!existing) {
        return [
          ...current,
          {
            property_id: propertyId,
            room_type_id: roomType.id,
            stay_date: date,
            total_rooms: roomType.totalRooms,
            available_rooms: roomType.totalRooms,
            min_stay: 1,
            stop_sell: false,
            ...patch,
          },
        ];
      }

      return current.map((item) =>
        item.room_type_id === roomType.id &&
        item.stay_date === date
          ? {
              ...item,
              ...patch,
            }
          : item
      );
    });
  }

  async function saveInventory(
    roomType: RoomType,
    date: string,
    patch: Partial<InventoryRow>
  ) {
    setErrorMessage("");

    const current = getInventory(
      roomType,
      date
    );

    const payload = {
      property_id: propertyId,
      room_type_id: roomType.id,
      stay_date: date,

      total_rooms: roomType.totalRooms,

      available_rooms:
        patch.available_rooms ??
        current.available_rooms,

      min_stay:
        patch.min_stay ??
        current.min_stay,

      stop_sell:
        patch.stop_sell ??
        current.stop_sell,
    };

    const key =
      `${roomType.id}-${date}-inventory`;

    setSaving(key);

    const { error } = await supabase
      .from("inventory_calendar")
      .upsert(
        payload,
        {
          onConflict:
            "room_type_id,stay_date",
        }
      );

    if (error) {
      setErrorMessage(error.message);
    }

    setSaving(null);
  }

  function updateRateState(
    roomTypeId: string,
    ratePlanId: string,
    date: string,
    price: number
  ) {
    setRates((current) => {
      const existing = current.find(
        (item) =>
          item.room_type_id === roomTypeId &&
          item.rate_plan_id === ratePlanId &&
          item.stay_date === date
      );

      if (!existing) {
        return [
          ...current,
          {
            property_id: propertyId,
            room_type_id: roomTypeId,
            rate_plan_id: ratePlanId,
            stay_date: date,
            price,
          },
        ];
      }

      return current.map((item) =>
        item.room_type_id === roomTypeId &&
        item.rate_plan_id === ratePlanId &&
        item.stay_date === date
          ? {
              ...item,
              price,
            }
          : item
      );
    });
  }

  async function saveRate(
    roomTypeId: string,
    ratePlanId: string,
    date: string
  ) {
    setErrorMessage("");

    const rate = getRate(
      roomTypeId,
      ratePlanId,
      date
    );

    const key =
      `${roomTypeId}-${ratePlanId}-${date}`;

    setSaving(key);

    const { error } = await supabase
      .from("rate_calendar")
      .upsert(
        {
          property_id: propertyId,
          room_type_id: roomTypeId,
          rate_plan_id: ratePlanId,
          stay_date: date,
          price: rate.price,
        },
        {
          onConflict:
            "room_type_id,rate_plan_id,stay_date",
        }
      );

    if (error) {
      setErrorMessage(error.message);
    }

    setSaving(null);
  }

  return (
    <div>

      {errorMessage && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">

        <table className="min-w-[1400px] border-collapse text-sm">

          <thead>

            <tr className="border-b bg-slate-50">

              <th className="sticky left-0 z-20 min-w-[220px] bg-slate-50 px-5 py-4 text-left font-semibold text-slate-600">
                Room / Rate
              </th>

              {dates.map((date) => (

                <th
                  key={date}
                  className="min-w-[105px] border-l border-slate-200 px-3 py-3 text-center"
                >

                  <div className="text-xs font-medium uppercase text-slate-400">
                    {displayDay(date)}
                  </div>

                  <div className="mt-1 font-semibold text-slate-800">
                    {displayDate(date)}
                  </div>

                </th>

              ))}

            </tr>

          </thead>

          <tbody>

            {roomTypes.map((roomType) => (

              <RoomTypeSection
                key={roomType.id}
                roomType={roomType}
                dates={dates}
                ratePlans={ratePlans}
                getInventory={getInventory}
                getRate={getRate}
                updateInventoryState={updateInventoryState}
                saveInventory={saveInventory}
                updateRateState={updateRateState}
                saveRate={saveRate}
                saving={saving}
              />

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}

function RoomTypeSection({
  roomType,
  dates,
  ratePlans,
  getInventory,
  getRate,
  updateInventoryState,
  saveInventory,
  updateRateState,
  saveRate,
  saving,
}: any) {
  return (
    <>

      <tr className="border-b bg-slate-900">

        <td
          colSpan={dates.length + 1}
          className="px-5 py-3 font-semibold text-white"
        >
          {roomType.name}

          <span className="ml-3 text-xs font-normal text-slate-400">
            {roomType.code}
            {" · "}
            {roomType.totalRooms} rooms
          </span>
        </td>

      </tr>


      {/* AVAILABLE */}

      <tr className="border-b">

        <td className="sticky left-0 z-10 bg-white px-5 py-3 font-medium text-slate-700">
          Available
        </td>

        {dates.map((date: string) => {
          const row =
            getInventory(roomType, date);

          return (
            <td
              key={date}
              className="border-l border-slate-100 p-2"
            >

              <input
                type="number"
                min={0}
                max={roomType.totalRooms}
                value={row.available_rooms}
                onChange={(e) => {
                  updateInventoryState(
                    roomType,
                    date,
                    {
                      available_rooms:
                        Number(e.target.value),
                    }
                  );
                }}
                onBlur={() =>
                  saveInventory(
                    roomType,
                    date,
                    {
                      available_rooms:
                        getInventory(
                          roomType,
                          date
                        ).available_rooms,
                    }
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center font-semibold outline-none focus:border-blue-500"
              />

            </td>
          );
        })}

      </tr>


      {/* MIN STAY */}

      <tr className="border-b">

        <td className="sticky left-0 z-10 bg-white px-5 py-3 text-slate-500">
          Min Stay
        </td>

        {dates.map((date: string) => {
          const row =
            getInventory(roomType, date);

          return (
            <td
              key={date}
              className="border-l border-slate-100 p-2"
            >

              <input
                type="number"
                min={1}
                value={row.min_stay}
                onChange={(e) => {
                  updateInventoryState(
                    roomType,
                    date,
                    {
                      min_stay:
                        Number(e.target.value),
                    }
                  );
                }}
                onBlur={() =>
                  saveInventory(
                    roomType,
                    date,
                    {
                      min_stay:
                        getInventory(
                          roomType,
                          date
                        ).min_stay,
                    }
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center outline-none focus:border-blue-500"
              />

            </td>
          );
        })}

      </tr>


      {/* STOP SELL */}

      <tr className="border-b bg-slate-50/50">

        <td className="sticky left-0 z-10 bg-slate-50 px-5 py-3 text-slate-500">
          Stop Sell
        </td>

        {dates.map((date: string) => {
          const row =
            getInventory(roomType, date);

          return (
            <td
              key={date}
              className="border-l border-slate-100 text-center"
            >

              <input
                type="checkbox"
                checked={row.stop_sell}
                onChange={async (e) => {
                  const value =
                    e.target.checked;

                  updateInventoryState(
                    roomType,
                    date,
                    {
                      stop_sell: value,
                    }
                  );

                  await saveInventory(
                    roomType,
                    date,
                    {
                      stop_sell: value,
                    }
                  );
                }}
              />

            </td>
          );
        })}

      </tr>


      {/* RATE PLANS */}

      {ratePlans.map((ratePlan: RatePlan) => (

        <tr
          key={ratePlan.id}
          className="border-b"
        >

          <td className="sticky left-0 z-10 bg-white px-5 py-3">

            <p className="font-medium text-slate-700">
              {ratePlan.name}
            </p>

            <p className="text-xs text-slate-400">
              Price
            </p>

          </td>

          {dates.map((date: string) => {
            const rate =
              getRate(
                roomType.id,
                ratePlan.id,
                date
              );

            const key =
              `${roomType.id}-${ratePlan.id}-${date}`;

            return (
              <td
                key={date}
                className="border-l border-slate-100 p-2"
              >

                <div className="relative">

                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={rate.price}
                    onChange={(e) => {
                      updateRateState(
                        roomType.id,
                        ratePlan.id,
                        date,
                        Number(e.target.value)
                      );
                    }}
                    onBlur={() =>
                      saveRate(
                        roomType.id,
                        ratePlan.id,
                        date
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center text-xs outline-none focus:border-blue-500"
                  />

                  {saving === key && (
                    <div className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-blue-500">
                      saving
                    </div>
                  )}

                </div>

              </td>
            );
          })}

        </tr>

      ))}

    </>
  );
}