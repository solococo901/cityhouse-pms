"use client";

import {
  useState,
} from "react";

import {
  CalendarRange,
  Check,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

type RoomType = {
  id: string;
  name: string;
};

type RatePlan = {
  id: string;
  name: string;
  code: string;
};

type Props = {
  propertyId: string;

  roomTypes:
    RoomType[];

  ratePlans:
    RatePlan[];
};

const WEEKDAYS = [
  {
    value: 1,
    label: "Mon",
  },
  {
    value: 2,
    label: "Tue",
  },
  {
    value: 3,
    label: "Wed",
  },
  {
    value: 4,
    label: "Thu",
  },
  {
    value: 5,
    label: "Fri",
  },
  {
    value: 6,
    label: "Sat",
  },
  {
    value: 7,
    label: "Sun",
  },
];

function todayVietnam() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Ho_Chi_Minh",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (item) =>
        item.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (item) =>
        item.type === "month"
    )?.value ?? "";

  const day =
    parts.find(
      (item) =>
        item.type === "day"
    )?.value ?? "";

  return `${year}-${month}-${day}`;
}

export default function BulkAriUpdate({
  propertyId,
  roomTypes,
  ratePlans,
}: Props) {
  const router =
    useRouter();

  const [
    roomTypeId,
    setRoomTypeId,
  ] =
    useState(
      roomTypes[0]?.id ??
        ""
    );

  const [
    ratePlanId,
    setRatePlanId,
  ] =
    useState(
      ratePlans[0]?.id ??
        ""
    );

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      todayVietnam()
    );

  const [
    endDate,
    setEndDate,
  ] =
    useState(
      todayVietnam()
    );

  const [
    weekdays,
    setWeekdays,
  ] =
    useState<number[]>([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
    ]);

  const [
    price,
    setPrice,
  ] =
    useState("");

  const [
    availability,
    setAvailability,
  ] =
    useState("");

  const [
    minStay,
    setMinStay,
  ] =
    useState("");

  const [
    stopSell,
    setStopSell,
  ] =
    useState<
      "keep" |
      "open" |
      "closed"
    >(
      "keep"
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  function toggleWeekday(
    value: number
  ) {
    setWeekdays(
      (
        current
      ) => {
        if (
          current.includes(
            value
          )
        ) {
          return current.filter(
            (item) =>
              item !== value
          );
        }

        return [
          ...current,
          value,
        ].sort();
      }
    );
  }

  function selectAllDays() {
    setWeekdays([
      1,
      2,
      3,
      4,
      5,
      6,
      7,
    ]);
  }

  function weekdaysOnly() {
    setWeekdays([
      1,
      2,
      3,
      4,
      5,
    ]);
  }

  function weekendsOnly() {
    setWeekdays([
      6,
      7,
    ]);
  }

  async function apply() {
    setLoading(true);

    setMessage("");
    setErrorMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/ari/bulk-update",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                propertyId,

                roomTypeId,

                ratePlanId:
                  ratePlanId ||
                  null,

                startDate,

                endDate,

                weekdays,

                price,

                availableRooms:
                  availability,

                minStay,

                stopSell:
                  stopSell ===
                  "keep"
                    ? "keep"
                    : stopSell ===
                        "closed"
                      ? true
                      : false,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        setErrorMessage(
          result.error ||
            "Không thể cập nhật."
        );

        return;
      }

      const data =
        result.result;

      setMessage(
        `Đã cập nhật ${data?.rates_updated ?? 0} ô giá và ${data?.inventory_updated ?? 0} ô inventory.`
      );

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi xảy ra khi cập nhật."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">

      {/* HEADER */}

      <div className="flex items-start gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

          <CalendarRange
            size={19}
          />

        </div>

        <div>

          <h2 className="font-semibold text-slate-900">
            Bulk Update
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Cập nhật giá và inventory cho nhiều ngày cùng lúc.
          </p>

        </div>

      </div>


      {/* ROOM + RATE */}

      <div className="mt-6 grid gap-4 md:grid-cols-2">

        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            Room Type
          </label>

          <select
            value={
              roomTypeId
            }
            onChange={(
              event
            ) =>
              setRoomTypeId(
                event.target.value
              )
            }
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
          >

            {roomTypes.map(
              (
                item
              ) => (

                <option
                  key={
                    item.id
                  }
                  value={
                    item.id
                  }
                >
                  {
                    item.name
                  }
                </option>

              )
            )}

          </select>

        </div>


        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            Rate Plan
          </label>

          <select
            value={
              ratePlanId
            }
            onChange={(
              event
            ) =>
              setRatePlanId(
                event.target.value
              )
            }
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
          >

            {ratePlans.map(
              (
                item
              ) => (

                <option
                  key={
                    item.id
                  }
                  value={
                    item.id
                  }
                >
                  {
                    item.name
                  }
                  {" — "}
                  {
                    item.code
                  }
                </option>

              )
            )}

          </select>

        </div>

      </div>


      {/* DATE RANGE */}

      <div className="mt-4 grid gap-4 md:grid-cols-2">

        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            From
          </label>

          <input
            type="date"
            value={
              startDate
            }
            onChange={(
              event
            ) =>
              setStartDate(
                event.target.value
              )
            }
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
          />

        </div>


        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            To
          </label>

          <input
            type="date"
            value={
              endDate
            }
            min={
              startDate
            }
            onChange={(
              event
            ) =>
              setEndDate(
                event.target.value
              )
            }
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
          />

        </div>

      </div>


      {/* DAYS OF WEEK */}

      <div className="mt-5">

        <div className="flex flex-wrap items-center justify-between gap-2">

          <label className="text-xs font-medium text-slate-500">
            Apply on
          </label>

          <div className="flex flex-wrap gap-1">

            <button
              type="button"
              onClick={
                selectAllDays
              }
              className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
            >
              All
            </button>

            <button
              type="button"
              onClick={
                weekdaysOnly
              }
              className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
            >
              Weekdays
            </button>

            <button
              type="button"
              onClick={
                weekendsOnly
              }
              className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
            >
              Weekend
            </button>

          </div>

        </div>


        <div className="mt-3 grid grid-cols-7 gap-2">

          {WEEKDAYS.map(
            (
              item
            ) => {
              const active =
                weekdays.includes(
                  item.value
                );

              return (

                <button
                  key={
                    item.value
                  }
                  type="button"
                  onClick={() =>
                    toggleWeekday(
                      item.value
                    )
                  }
                  className={`relative h-10 rounded-xl border text-xs font-semibold transition ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-400"
                  }`}
                >

                  {
                    item.label
                  }

                  {active && (

                    <Check
                      size={11}
                      className="absolute right-1 top-1"
                    />

                  )}

                </button>

              );
            }
          )}

        </div>

      </div>


      {/* ARI VALUES */}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        {/* PRICE */}

        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            Price
          </label>

          <input
            type="number"
            min="0"
            step="10000"
            value={
              price
            }
            onChange={(
              event
            ) =>
              setPrice(
                event.target.value
              )
            }
            placeholder="Leave unchanged"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
          />

        </div>


        {/* AVAILABILITY */}

        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            Availability
          </label>

          <input
            type="number"
            min="0"
            value={
              availability
            }
            onChange={(
              event
            ) =>
              setAvailability(
                event.target.value
              )
            }
            placeholder="Leave unchanged"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
          />

        </div>


        {/* MIN STAY */}

        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            Min Stay
          </label>

          <input
            type="number"
            min="1"
            value={
              minStay
            }
            onChange={(
              event
            ) =>
              setMinStay(
                event.target.value
              )
            }
            placeholder="Leave unchanged"
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
          />

        </div>


        {/* STOP SELL */}

        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            Stop Sell
          </label>

          <select
            value={
              stopSell
            }
            onChange={(
              event
            ) =>
              setStopSell(
                event.target.value as
                  | "keep"
                  | "open"
                  | "closed"
              )
            }
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
          >

            <option value="keep">
              Leave unchanged
            </option>

            <option value="open">
              Open
            </option>

            <option value="closed">
              Stop Sell
            </option>

          </select>

        </div>

      </div>


      {/* MESSAGES */}

      {errorMessage && (

        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {
            errorMessage
          }
        </div>

      )}


      {message && (

        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {
            message
          }
        </div>

      )}


      {/* APPLY */}

      <button
        type="button"
        disabled={
          loading ||
          !roomTypeId ||
          weekdays.length ===
            0
        }
        onClick={
          apply
        }
        className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Applying..."
          : "Apply Changes"}
      </button>

    </div>
  );
}