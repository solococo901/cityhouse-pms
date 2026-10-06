"use client";

import {
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  scheduleChannexAriSync,
} from "@/lib/channex/auto-sync-client";

/* ======================================================
   TYPES
====================================================== */

export type InventoryCalendarRoomType = {
  id: string;
  name: string;
  code: string;

  totalRooms?:
    number;
};

export type InventoryCalendarRatePlan = {
  id: string;
  name: string;
  code: string;
};

export type InventoryCalendarInventoryRow = {
  id?: string;

  room_type_id:
    string;

  stay_date:
    string;

  total_rooms:
    number;

  available_rooms:
    number;

  min_stay:
    number;

  stop_sell:
    boolean;
};

export type InventoryCalendarRateRow = {
  id?: string;

  room_type_id:
    string;

  rate_plan_id:
    string;

  stay_date:
    string;

  price:
    | number
    | string;
};

type Props = {
  propertyId:
    string;

  dates:
    string[];

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
  propertyId,
  dates,
  roomTypes,
  ratePlans,
  inventory,
  rates,
}: Props) {
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

  const [
    dirtyInventory,
    setDirtyInventory,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    dirtyRates,
    setDirtyRates,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    savingKeys,
    setSavingKeys,
  ] =
    useState<
      Set<string>
    >(
      new Set()
    );

  const [
    saveError,
    setSaveError,
  ] =
    useState("");

  const [
    saveMessage,
    setSaveMessage,
  ] =
    useState("");

  /* ======================================================
     SERVER PROPS → LOCAL
  ====================================================== */

  useEffect(
    () => {
      setInventoryRows(
        inventory
      );
    },
    [
      inventory,
    ]
  );

  useEffect(
    () => {
      setRateRows(
        rates
      );
    },
    [
      rates,
    ]
  );

  /* ======================================================
     MAPS
  ====================================================== */

  const inventoryMap =
    useMemo(
      () => {
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
      },
      [
        inventoryRows,
      ]
    );

  const rateMap =
    useMemo(
      () => {
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
      },
      [
        rateRows,
      ]
    );

  /* ======================================================
     SAVING STATE
  ====================================================== */

  function beginSaving(
    key: string
  ) {
    setSavingKeys(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        next.add(
          key
        );

        return next;
      }
    );
  }

  function endSaving(
    key: string
  ) {
    setSavingKeys(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        next.delete(
          key
        );

        return next;
      }
    );
  }

  function removeDirtyInventory(
    key: string
  ) {
    setDirtyInventory(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        next.delete(
          key
        );

        return next;
      }
    );
  }

  function removeDirtyRate(
    key: string
  ) {
    setDirtyRates(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        next.delete(
          key
        );

        return next;
      }
    );
  }

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
    const key =
      `${roomTypeId}:${stayDate}`;

    setDirtyInventory(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        next.add(
          key
        );

        return next;
      }
    );

    setInventoryRows(
      (
        current
      ) => {
        let found =
          false;

        const next =
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
                found =
                  true;

                return {
                  ...row,

                  [field]:
                    value,
                };
              }

              return row;
            }
          );

        if (
          found
        ) {
          return next;
        }

        const room =
          roomTypes.find(
            (
              item
            ) =>
              item.id ===
              roomTypeId
          );

        return [
          ...next,

          {
            room_type_id:
              roomTypeId,

            stay_date:
              stayDate,

            total_rooms:
              room
                ?.totalRooms ??
              0,

            available_rooms:
              field ===
              "available_rooms"
                ? Number(
                    value
                  )
                : 0,

            min_stay:
              field ===
              "min_stay"
                ? Number(
                    value
                  )
                : 1,

            stop_sell:
              field ===
              "stop_sell"
                ? Boolean(
                    value
                  )
                : false,
          },
        ];
      }
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
    const key =
      `${roomTypeId}:${ratePlanId}:${stayDate}`;

    setDirtyRates(
      (
        current
      ) => {
        const next =
          new Set(
            current
          );

        next.add(
          key
        );

        return next;
      }
    );

    setRateRows(
      (
        current
      ) => {
        let found =
          false;

        const next =
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
                found =
                  true;

                return {
                  ...row,

                  price:
                    value,
                };
              }

              return row;
            }
          );

        if (
          found
        ) {
          return next;
        }

        return [
          ...next,

          {
            room_type_id:
              roomTypeId,

            rate_plan_id:
              ratePlanId,

            stay_date:
              stayDate,

            price:
              value,
          },
        ];
      }
    );
  }

  /* ======================================================
     SAVE INVENTORY
  ====================================================== */

  async function saveInventory(
    roomTypeId: string,
    stayDate: string,
    force =
      false
  ) {
    const key =
      `${roomTypeId}:${stayDate}`;

    if (
      !force &&
      !dirtyInventory.has(
        key
      )
    ) {
      return;
    }

    const row =
      inventoryMap.get(
        key
      );

    if (
      !row
    ) {
      return;
    }

    const savingKey =
      `inventory:${key}`;

    beginSaving(
      savingKey
    );

    setSaveError(
      ""
    );

    setSaveMessage(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/admin/inventory/cell",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                entityType:
                  "inventory",

                propertyId,

                roomTypeId,

                stayDate,

                totalRooms:
                  row.total_rooms,

                availableRooms:
                  row.available_rooms,

                minStay:
                  row.min_stay,

                stopSell:
                  row.stop_sell,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Không thể lưu Inventory."
        );
      }

      if (
        data.data
      ) {
        setInventoryRows(
          (
            current
          ) =>
            current.map(
              (
                item
              ) =>
                item.room_type_id ===
                  roomTypeId &&
                item.stay_date ===
                  stayDate
                  ? {
                      ...item,
                      ...data.data,
                    }
                  : item
            )
        );
      }

      removeDirtyInventory(
        key
      );

      setSaveMessage(
        "Đã lưu. Đang chờ đồng bộ Channex..."
      );

      scheduleChannexAriSync(
        propertyId
      );
    } catch (
      error
    ) {
      console.error(
        "Save Inventory:",
        error
      );

      setSaveError(
        error instanceof
        Error
          ? error.message
          : "Không thể lưu Inventory."
      );
    } finally {
      endSaving(
        savingKey
      );
    }
  }

  /* ======================================================
     SAVE RATE
  ====================================================== */

  async function saveRate(
    roomTypeId: string,
    ratePlanId: string,
    stayDate: string
  ) {
    const key =
      `${roomTypeId}:${ratePlanId}:${stayDate}`;

    if (
      !dirtyRates.has(
        key
      )
    ) {
      return;
    }

    const row =
      rateMap.get(
        key
      );

    if (
      !row
    ) {
      return;
    }

    const price =
      Number(
        row.price
      );

    if (
      !Number.isFinite(
        price
      ) ||
      price <=
        0
    ) {
      setSaveError(
        "Giá phải lớn hơn 0."
      );

      return;
    }

    const savingKey =
      `rate:${key}`;

    beginSaving(
      savingKey
    );

    setSaveError(
      ""
    );

    setSaveMessage(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/admin/inventory/cell",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                entityType:
                  "rate",

                propertyId,

                roomTypeId,

                ratePlanId,

                stayDate,

                price,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "Không thể lưu Rate."
        );
      }

      if (
        data.data
      ) {
        setRateRows(
          (
            current
          ) =>
            current.map(
              (
                item
              ) =>
                item.room_type_id ===
                  roomTypeId &&
                item.rate_plan_id ===
                  ratePlanId &&
                item.stay_date ===
                  stayDate
                  ? {
                      ...item,
                      ...data.data,
                    }
                  : item
            )
        );
      }

      removeDirtyRate(
        key
      );

      setSaveMessage(
        "Đã lưu giá. Đang chờ đồng bộ Channex..."
      );

      scheduleChannexAriSync(
        propertyId
      );
    } catch (
      error
    ) {
      console.error(
        "Save Rate:",
        error
      );

      setSaveError(
        error instanceof
        Error
          ? error.message
          : "Không thể lưu Rate."
      );
    } finally {
      endSaving(
        savingKey
      );
    }
  }

  /* ======================================================
     AUTO SYNC STATUS
  ====================================================== */

  useEffect(
    () => {
      function handler(
        event:
          Event
      ) {
        const customEvent =
          event as
            CustomEvent<{
              status:
                string;

              message?:
                string;
            }>;

        if (
          customEvent
            .detail
            .status ===
          "error"
        ) {
          setSaveError(
            customEvent
              .detail
              .message ||
              "Channex Sync thất bại."
          );

          return;
        }

        if (
          customEvent
            .detail
            .message
        ) {
          setSaveMessage(
            customEvent
              .detail
              .message
          );
        }
      }

      window.addEventListener(
        "channex-auto-sync-status",
        handler
      );

      return () => {
        window.removeEventListener(
          "channex-auto-sync-status",
          handler
        );
      };
    },
    []
  );

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div>

      {/* SAVE STATUS */}

      {(saveMessage ||
        saveError) && (

        <div
          className={`mb-4 flex items-center gap-2 rounded-xl border p-3 text-sm ${
            saveError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >

          {saveError ? (

            <XCircle
              size={16}
            />

          ) : (

            <CheckCircle2
              size={16}
            />

          )}

          {
            saveError ||
            saveMessage
          }

        </div>

      )}


      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

        <div className="overflow-x-auto">

          <div className="min-w-max">

            {/* DATE HEADER */}

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


            {/* ROOM TYPES */}

            {roomTypes.map(
              (
                roomType
              ) => (

              <div
                key={
                  roomType.id
                }
              >

                {/* ROOM HEADER */}

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

                {/* AVAILABLE */}

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

                  onBlur={(
                    date
                  ) =>
                    void saveInventory(
                      roomType.id,
                      date
                    )
                  }

                  isSaving={(
                    date
                  ) =>
                    savingKeys.has(
                      `inventory:${roomType.id}:${date}`
                    )
                  }
                />

                {/* MIN STAY */}

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

                  onBlur={(
                    date
                  ) =>
                    void saveInventory(
                      roomType.id,
                      date
                    )
                  }

                  isSaving={(
                    date
                  ) =>
                    savingKeys.has(
                      `inventory:${roomType.id}:${date}`
                    )
                  }
                />

                {/* STOP SELL */}

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
                      const key =
                        `${roomType.id}:${date}`;

                      const row =
                        inventoryMap.get(
                          key
                        );

                      const checked =
                        row
                          ?.stop_sell ??
                        false;

                      const saving =
                        savingKeys.has(
                          `inventory:${key}`
                        );

                      return (

                        <div
                          key={
                            date
                          }

                          className="relative flex w-[110px] shrink-0 items-center justify-center border-r border-slate-100"
                        >

                          <input
                            type="checkbox"

                            checked={
                              checked
                            }

                            disabled={
                              saving
                            }

                            onChange={async (
                              event
                            ) => {
                              const value =
                                event
                                  .target
                                  .checked;

                              updateInventoryLocal(
                                roomType.id,
                                date,
                                "stop_sell",
                                value
                              );

                              /*
                               * Dùng row mới trực tiếp để tránh
                               * React state chưa update kịp.
                               */

                              const current =
                                row ?? {
                                  room_type_id:
                                    roomType.id,

                                  stay_date:
                                    date,

                                  total_rooms:
                                    roomType
                                      .totalRooms ??
                                    0,

                                  available_rooms:
                                    0,

                                  min_stay:
                                    1,

                                  stop_sell:
                                    false,
                                };

                              const savingKey =
                                `inventory:${key}`;

                              beginSaving(
                                savingKey
                              );

                              setSaveError(
                                ""
                              );

                              try {
                                const response =
                                  await fetch(
                                    "/api/admin/inventory/cell",
                                    {
                                      method:
                                        "POST",

                                      headers: {
                                        "Content-Type":
                                          "application/json",
                                      },

                                      body:
                                        JSON.stringify({
                                          entityType:
                                            "inventory",

                                          propertyId,

                                          roomTypeId:
                                            roomType.id,

                                          stayDate:
                                            date,

                                          totalRooms:
                                            current
                                              .total_rooms,

                                          availableRooms:
                                            current
                                              .available_rooms,

                                          minStay:
                                            current
                                              .min_stay,

                                          stopSell:
                                            value,
                                        }),
                                    }
                                  );

                                const data =
                                  await response.json();

                                if (
                                  !response.ok
                                ) {
                                  throw new Error(
                                    data.error ||
                                      "Không thể lưu Stop Sell."
                                  );
                                }

                                removeDirtyInventory(
                                  key
                                );

                                setSaveMessage(
                                  "Đã lưu. Đang chờ đồng bộ Channex..."
                                );

                                scheduleChannexAriSync(
                                  propertyId
                                );
                              } catch (
                                error
                              ) {
                                setSaveError(
                                  error instanceof
                                  Error
                                    ? error.message
                                    : "Không thể lưu Stop Sell."
                                );
                              } finally {
                                endSaving(
                                  savingKey
                                );
                              }
                            }}

                            className="h-4 w-4 cursor-pointer rounded border-slate-300"
                          />


                          {saving && (

                            <Loader2
                              size={12}
                              className="absolute right-2 animate-spin text-blue-500"
                            />

                          )}

                        </div>

                      );
                    }
                  )}

                </div>

                {/* RATE PLANS */}

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

                        const saving =
                          savingKeys.has(
                            `rate:${key}`
                          );

                        return (

                          <div
                            key={
                              date
                            }

                            className="relative flex w-[110px] shrink-0 items-center border-r border-slate-100 px-1.5"
                          >

                            <input
                              type="number"

                              min="0"

                              step="10000"

                              value={
                                price
                              }

                              disabled={
                                saving
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

                              onBlur={() =>
                                void saveRate(
                                  roomType.id,
                                  ratePlan.id,
                                  date
                                )
                              }

                              className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-[11px] text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-slate-50"
                            />


                            {saving && (

                              <Loader2
                                size={11}
                                className="absolute right-2 animate-spin text-blue-500"
                              />

                            )}

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
  onBlur,
  isSaving,
  muted =
    false,
}: {
  label:
    string;

  dates:
    string[];

  getValue: (
    date: string
  ) => number;

  onChange: (
    date: string,
    value: number
  ) => void;

  onBlur: (
    date: string
  ) => void;

  isSaving: (
    date: string
  ) => boolean;

  muted?:
    boolean;
}) {
  return (
    <div className="flex min-h-[44px] border-b border-slate-200">

      <div className="sticky left-0 z-20 flex w-[170px] shrink-0 items-center border-r border-slate-200 bg-white px-4">

        <span
          className={`text-xs ${
            muted
              ? "text-slate-400"
              : "font-medium text-slate-600"
          }`}
        >
          {
            label
          }
        </span>

      </div>


      {dates.map(
        (
          date
        ) => {
          const saving =
            isSaving(
              date
            );

          return (

            <div
              key={
                date
              }

              className="relative flex w-[110px] shrink-0 items-center border-r border-slate-100 px-1.5"
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

                disabled={
                  saving
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

                onBlur={() =>
                  onBlur(
                    date
                  )
                }

                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-[11px] text-slate-700 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-100 disabled:bg-slate-50"
              />


              {saving && (

                <Loader2
                  size={11}
                  className="absolute right-2 animate-spin text-blue-500"
                />

              )}

            </div>

          );
        }
      )}

    </div>
  );
}