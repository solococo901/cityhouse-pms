"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

/* ======================================================
   TYPES
====================================================== */

export type InventoryCalendarRoomType = {
  id: string;
  name: string;
  code: string;
  totalRooms?: number;
};

export type InventoryCalendarRatePlan = {
  id: string;
  name: string;
  code: string;
};

export type InventoryCalendarInventoryRow = {
  id?: string;

  room_type_id: string;

  stay_date: string;

  total_rooms: number;

  available_rooms: number;

  min_stay: number;

  stop_sell: boolean;
};

export type InventoryCalendarRateRow = {
  id?: string;

  room_type_id: string;

  rate_plan_id: string;

  stay_date: string;

  price:
    | number
    | string;
};

type Props = {
  dates: string[];

  roomTypes:
    InventoryCalendarRoomType[];

  ratePlans:
    InventoryCalendarRatePlan[];

  inventory:
    InventoryCalendarInventoryRow[];

  rates:
    InventoryCalendarRateRow[];
};

/* ======================================================
   HELPERS
====================================================== */

function formatWeekday(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday:
        "short",
      timeZone:
        "UTC",
    }
  )
    .format(
      new Date(
        `${date}T00:00:00Z`
      )
    )
    .toUpperCase();
}

function formatShortDate(
  date: string
) {
  const value =
    new Date(
      `${date}T00:00:00Z`
    );

  const day =
    String(
      value.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  const month =
    String(
      value.getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  return `${day}/${month}`;
}

/* ======================================================
   COMPONENT
====================================================== */

export default function InventoryCalendar({
  dates,
  roomTypes,
  ratePlans,
  inventory,
  rates,
}: Props) {
  /*
   * Đây là phần quan trọng.
   *
   * Component trước của bạn có thể đang:
   *
   * useState(inventory)
   * useState(rates)
   *
   * nhưng không sync lại khi Server Component
   * router.refresh() truyền props mới xuống.
   */

  const [
    inventoryRows,
    setInventoryRows,
  ] =
    useState<
      InventoryCalendarInventoryRow[]
    >(
      inventory
    );

  const [
    rateRows,
    setRateRows,
  ] =
    useState<
      InventoryCalendarRateRow[]
    >(
      rates
    );

  /* ======================================================
     SYNC SERVER PROPS → CLIENT STATE
  ====================================================== */

  useEffect(() => {
    setInventoryRows(
      inventory
    );
  }, [
    inventory,
  ]);

  useEffect(() => {
    setRateRows(
      rates
    );
  }, [
    rates,
  ]);

  /* ======================================================
     MAPS FOR FAST LOOKUP
  ====================================================== */

  const inventoryMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          InventoryCalendarInventoryRow
        >();

      for (
        const row of
          inventoryRows
      ) {
        map.set(
          `${row.room_type_id}:${row.stay_date}`,
          row
        );
      }

      return map;
    }, [
      inventoryRows,
    ]);

  const rateMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          InventoryCalendarRateRow
        >();

      for (
        const row of
          rateRows
      ) {
        map.set(
          `${row.room_type_id}:${row.rate_plan_id}:${row.stay_date}`,
          row
        );
      }

      return map;
    }, [
      rateRows,
    ]);

  /* ======================================================
     LOCAL INVENTORY UPDATE
  ====================================================== */

  function updateInventoryLocal(
    roomTypeId: string,
    stayDate: string,
    field:
      | "available_rooms"
      | "min_stay"
      | "stop_sell",
    value:
      | number
      | boolean
  ) {
    setInventoryRows(
      (
        current
      ) =>
        current.map(
          (
            row
          ) => {
            if (
              row.room_type_id ===
                roomTypeId &&
              row.stay_date ===
                stayDate
            ) {
              return {
                ...row,

                [field]:
                  value,
              };
            }

            return row;
          }
        )
    );
  }

  /* ======================================================
     LOCAL RATE UPDATE
  ====================================================== */

  function updateRateLocal(
    roomTypeId: string,
    ratePlanId: string,
    stayDate: string,
    value: number
  ) {
    setRateRows(
      (
        current
      ) =>
        current.map(
          (
            row
          ) => {
            if (
              row.room_type_id ===
                roomTypeId &&
              row.rate_plan_id ===
                ratePlanId &&
              row.stay_date ===
                stayDate
            ) {
              return {
                ...row,
                price:
                  value,
              };
            }

            return row;
          }
        )
    );
  }

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

      <div className="overflow-x-auto">

        <div className="min-w-max">

          {/* ==================================================
              DATE HEADER
          ================================================== */}

          <div className="flex border-b border-slate-200 bg-slate-50">

            <div className="sticky left-0 z-30 flex w-[170px] shrink-0 items-center border-r border-slate-200 bg-slate-50 px-4 py-3">

              <span className="text-xs font-semibold text-slate-600">
                Room / Rate
              </span>

            </div>

            {dates.map(
              (
                date
              ) => (

                <div
                  key={
                    date
                  }
                  className="w-[110px] shrink-0 border-r border-slate-200 px-2 py-2 text-center"
                >

                  <p className="text-[10px] font-medium text-slate-400">
                    {
                      formatWeekday(
                        date
                      )
                    }
                  </p>

                  <p className="mt-1 text-xs font-bold text-slate-800">
                    {
                      formatShortDate(
                        date
                      )
                    }
                  </p>

                </div>

              )
            )}

          </div>

          {/* ==================================================
              ROOM TYPES
          ================================================== */}

          {roomTypes.map(
            (
              roomType
            ) => (

              <div
                key={
                  roomType.id
                }
              >

                {/* ==========================================
                    ROOM TYPE HEADER
                ========================================== */}

                <div className="flex bg-slate-900">

                  <div className="sticky left-0 z-20 flex w-[170px] shrink-0 items-center bg-slate-900 px-4 py-2">

                    <span className="text-xs font-bold text-white">
                      {
                        roomType.name
                      }
                    </span>

                    <span className="ml-2 text-[10px] text-slate-400">
                      {
                        roomType.code
                      }

                      {roomType.totalRooms !==
                        undefined && (
                        <>
                          {" · "}
                          {
                            roomType.totalRooms
                          }{" "}
                          rooms
                        </>
                      )}
                    </span>

                  </div>

                  <div
                    style={{
                      width:
                        dates.length *
                        110,
                    }}
                    className="shrink-0 bg-slate-900"
                  />

                </div>

                {/* ==========================================
                    AVAILABLE
                ========================================== */}

                <InventoryNumberRow
                  label="Available"

                  dates={
                    dates
                  }

                  getValue={(
                    date
                  ) =>
                    inventoryMap.get(
                      `${roomType.id}:${date}`
                    )
                      ?.available_rooms ??
                    0
                  }

                  onChange={(
                    date,
                    value
                  ) =>
                    updateInventoryLocal(
                      roomType.id,
                      date,
                      "available_rooms",
                      value
                    )
                  }
                />

                {/* ==========================================
                    MIN STAY
                ========================================== */}

                <InventoryNumberRow
                  label="Min Stay"

                  muted

                  dates={
                    dates
                  }

                  getValue={(
                    date
                  ) =>
                    inventoryMap.get(
                      `${roomType.id}:${date}`
                    )
                      ?.min_stay ??
                    1
                  }

                  onChange={(
                    date,
                    value
                  ) =>
                    updateInventoryLocal(
                      roomType.id,
                      date,
                      "min_stay",
                      value
                    )
                  }
                />

                {/* ==========================================
                    STOP SELL
                ========================================== */}

                <div className="flex min-h-[44px] border-b border-slate-200">

                  <div className="sticky left-0 z-20 flex w-[170px] shrink-0 items-center border-r border-slate-200 bg-white px-4">

                    <span className="text-xs text-slate-500">
                      Stop Sell
                    </span>

                  </div>

                  {dates.map(
                    (
                      date
                    ) => {
                      const row =
                        inventoryMap.get(
                          `${roomType.id}:${date}`
                        );

                      const checked =
                        row
                          ?.stop_sell ??
                        false;

                      return (

                        <div
                          key={
                            date
                          }
                          className="flex w-[110px] shrink-0 items-center justify-center border-r border-slate-100"
                        >

                          <input
                            type="checkbox"
                            checked={
                              checked
                            }
                            onChange={(
                              event
                            ) =>
                              updateInventoryLocal(
                                roomType.id,
                                date,
                                "stop_sell",
                                event
                                  .target
                                  .checked
                              )
                            }
                            className="h-4 w-4 cursor-pointer rounded border-slate-300"
                          />

                        </div>

                      );
                    }
                  )}

                </div>

                {/* ==========================================
                    RATE PLANS
                ========================================== */}

                {ratePlans.map(
                  (
                    ratePlan
                  ) => (

                    <div
                      key={
                        `${roomType.id}-${ratePlan.id}`
                      }
                      className="flex min-h-[58px] border-b border-slate-200"
                    >

                      {/* RATE PLAN NAME */}

                      <div className="sticky left-0 z-20 flex w-[170px] shrink-0 items-center border-r border-slate-200 bg-white px-4">

                        <div>

                          <p className="text-xs font-semibold text-slate-700">
                            {
                              ratePlan.name
                            }
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Price
                          </p>

                        </div>

                      </div>

                      {/* RATE CELLS */}

                      {dates.map(
                        (
                          date
                        ) => {
                          const key =
                            `${roomType.id}:${ratePlan.id}:${date}`;

                          const row =
                            rateMap.get(
                              key
                            );

                          const price =
                            Number(
                              row
                                ?.price ??
                              0
                            );

                          return (

                            <div
                              key={
                                date
                              }
                              className="flex w-[110px] shrink-0 items-center border-r border-slate-100 px-1.5"
                            >

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
                                  updateRateLocal(
                                    roomType.id,
                                    ratePlan.id,
                                    date,
                                    Number(
                                      event
                                        .target
                                        .value ||
                                        0
                                    )
                                  )
                                }
                                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-[11px] text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                              />

                            </div>

                          );
                        }
                      )}

                    </div>

                  )
                )}

              </div>

            )
          )}

        </div>

      </div>

    </div>
  );
}

/* ======================================================
   NUMBER ROW
====================================================== */

function InventoryNumberRow({
  label,
  dates,
  getValue,
  onChange,
  muted = false,
}: {
  label: string;

  dates: string[];

  getValue: (
    date: string
  ) => number;

  onChange: (
    date: string,
    value: number
  ) => void;

  muted?: boolean;
}) {
  return (
    <div className="flex min-h-[44px] border-b border-slate-200">

      {/* LABEL */}

      <div className="sticky left-0 z-20 flex w-[170px] shrink-0 items-center border-r border-slate-200 bg-white px-4">

        <span
          className={`text-xs ${
            muted
              ? "text-slate-400"
              : "font-medium text-slate-600"
          }`}
        >
          {label}
        </span>

      </div>

      {/* CELLS */}

      {dates.map(
        (
          date
        ) => (

          <div
            key={
              date
            }
            className="flex w-[110px] shrink-0 items-center border-r border-slate-100 px-1.5"
          >

            <input
              type="number"
              min={
                label ===
                "Min Stay"
                  ? 1
                  : 0
              }
              value={
                getValue(
                  date
                )
              }
              onChange={(
                event
              ) =>
                onChange(
                  date,
                  Number(
                    event
                      .target
                      .value ||
                      0
                  )
                )
              }
              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-[11px] text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
            />

          </div>

        )
      )}

    </div>
  );
}