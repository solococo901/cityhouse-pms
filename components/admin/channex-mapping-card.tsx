"use client";

import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

/* ======================================================
   TYPES
====================================================== */

type PmsRoomType = {
  id: string;
  code: string;
  name: string;
};

type PmsRatePlan = {
  id: string;
  code: string;
  name: string;
};

type ExistingRoomMapping = {
  room_type_id: string;
  channex_room_type_id: string;
};

type ExistingRateMapping = {
  room_type_id: string;
  rate_plan_id: string;
  channex_rate_plan_id: string;
};

type ChannexRoomType = {
  id: string;
  title: string;
  propertyId: string;
  defaultOccupancy: number;
};

type ChannexRatePlan = {
  id: string;
  title: string;

  propertyId: string;
  roomTypeId: string;

  occupancy: number;

  parentRatePlanId:
  | string
  | null;

  sellMode: string;
};

type Props = {
  propertyId: string;

  roomTypes: PmsRoomType[];

  ratePlans: PmsRatePlan[];

  existingRoomMappings:
  ExistingRoomMapping[];

  existingRateMappings:
  ExistingRateMapping[];
};

/* ======================================================
   COMPONENT
====================================================== */

export default function ChannexMappingCard({
  propertyId,
  roomTypes,
  ratePlans,
  existingRoomMappings,
  existingRateMappings,
}: Props) {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    creatingRates,
    setCreatingRates,
  ] = useState(false);

  const [
    loaded,
    setLoaded,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    channexRoomTypes,
    setChannexRoomTypes,
  ] = useState<
    ChannexRoomType[]
  >([]);

  const [
    channexRatePlans,
    setChannexRatePlans,
  ] = useState<
    ChannexRatePlan[]
  >([]);

  /* ======================================================
     ROOM SELECTIONS
  ====================================================== */

  const [
    roomSelections,
    setRoomSelections,
  ] = useState<
    Record<string, string>
  >(() => {
    const result:
      Record<string, string> =
      {};

    for (
      const mapping of
      existingRoomMappings
    ) {
      result[
        mapping.room_type_id
      ] =
        mapping
          .channex_room_type_id;
    }

    return result;
  });

  /* ======================================================
     RATE SELECTIONS
  ====================================================== */

  const [
    rateSelections,
    setRateSelections,
  ] = useState<
    Record<string, string>
  >(() => {
    const result:
      Record<string, string> =
      {};

    for (
      const mapping of
      existingRateMappings
    ) {
      result[
        `${mapping.room_type_id}:${mapping.rate_plan_id}`
      ] =
        mapping
          .channex_rate_plan_id;
    }

    return result;
  });

  /* ======================================================
     SYNC SERVER DATA
  ====================================================== */

  useEffect(() => {
    const next:
      Record<string, string> =
      {};

    for (
      const mapping of
      existingRoomMappings
    ) {
      next[
        mapping.room_type_id
      ] =
        mapping
          .channex_room_type_id;
    }

    setRoomSelections(
      next
    );
  }, [
    existingRoomMappings,
  ]);

  useEffect(() => {
    const next:
      Record<string, string> =
      {};

    for (
      const mapping of
      existingRateMappings
    ) {
      next[
        `${mapping.room_type_id}:${mapping.rate_plan_id}`
      ] =
        mapping
          .channex_rate_plan_id;
    }

    setRateSelections(
      next
    );
  }, [
    existingRateMappings,
  ]);

  /* ======================================================
     LOAD OPTIONS
  ====================================================== */

  async function loadOptions() {
    setLoading(true);

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/channex/mapping-options?propertyId=${encodeURIComponent(
            propertyId
          )}`,
          {
            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        setErrorMessage(
          result.error ||
          "Không thể tải dữ liệu Channex."
        );

        return;
      }

      setChannexRoomTypes(
        result.roomTypes ??
        []
      );

      setChannexRatePlans(
        result.ratePlans ??
        []
      );

      setLoaded(true);
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi khi tải dữ liệu Channex."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ======================================================
     DUPLICATE CHECK
  ====================================================== */

  const duplicateRatePlanIds =
    useMemo(() => {
      const counts =
        new Map<
          string,
          number
        >();

      Object.values(
        rateSelections
      )
        .filter(Boolean)
        .forEach(
          (
            value
          ) => {
            counts.set(
              value,
              (
                counts.get(
                  value
                ) ?? 0
              ) + 1
            );
          }
        );

      return new Set(
        Array.from(
          counts.entries()
        )
          .filter(
            (
              [
                ,
                count,
              ]
            ) =>
              count > 1
          )
          .map(
            (
              [
                id,
              ]
            ) =>
              id
          )
      );
    }, [
      rateSelections,
    ]);

  const hasDuplicateRates =
    duplicateRatePlanIds
      .size > 0;

  /* ======================================================
     USED RATE PLAN IDs
  ====================================================== */

  function isRatePlanUsedElsewhere(
    channexRatePlanId: string,
    currentKey: string
  ) {
    return Object.entries(
      rateSelections
    ).some(
      (
        [
          key,
          value,
        ]
      ) =>
        key !==
        currentKey &&
        value ===
        channexRatePlanId
    );
  }

  /* ======================================================
     COUNTERS
  ====================================================== */

  const mappedRooms =
    useMemo(
      () =>
        roomTypes.filter(
          (
            room
          ) =>
            Boolean(
              roomSelections[
              room.id
              ]
            )
        ).length,
      [
        roomTypes,
        roomSelections,
      ]
    );

  const totalRates =
    roomTypes.length *
    ratePlans.length;

  const mappedRates =
    useMemo(() => {
      let count =
        0;

      for (
        const room of
        roomTypes
      ) {
        for (
          const rate of
          ratePlans
        ) {
          if (
            rateSelections[
            `${room.id}:${rate.id}`
            ]
          ) {
            count +=
              1;
          }
        }
      }

      return count;
    }, [
      roomTypes,
      ratePlans,
      rateSelections,
    ]);

  const complete =
    roomTypes.length >
    0 &&
    mappedRooms ===
    roomTypes.length &&
    mappedRates ===
    totalRates &&
    !hasDuplicateRates;







  async function createMissingRatePlans() {
    if (
      mappedRooms !==
      roomTypes.length
    ) {
      setErrorMessage(
        "Hãy map toàn bộ Room Types trước."
      );

      return;
    }

    setCreatingRates(
      true
    );

    setErrorMessage("");

    setSuccessMessage("");

    try {
      const currentRoomMappings =
        roomTypes.map(
          (
            room
          ) => ({
            roomTypeId:
              room.id,

            channexRoomTypeId:
              roomSelections[
              room.id
              ] || "",
          })
        );

      const response =
        await fetch(
          "/api/admin/channex/create-rate-plans",
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

                roomSelections:
                  currentRoomMappings,
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
          "Không thể tạo Rate Plans trên Channex."
        );

        return;
      }

      /*
       * Auto-map các Rate Plan
       * vừa tạo / đã tồn tại.
       */

      const mappings =
        Array.isArray(
          result.mappings
        )
          ? result.mappings
          : [];

      setRateSelections(
        (
          current
        ) => {
          const next = {
            ...current,
          };

          for (
            const mapping of
            mappings
          ) {
            next[
              `${mapping.roomTypeId}:${mapping.ratePlanId}`
            ] =
              mapping
                .channexRatePlanId;
          }

          return next;
        }
      );

      setSuccessMessage(
        `Channex: tạo mới ${result.createdCount ?? 0} Rate Plans, dùng lại ${result.reusedCount ?? 0} Rate Plans.`
      );

      /*
       * Reload options để dropdown
       * có các Rate Plan mới.
       */

      const reloadResponse =
        await fetch(
          `/api/admin/channex/mapping-options?propertyId=${encodeURIComponent(
            propertyId
          )}`,
          {
            cache:
              "no-store",
          }
        );

      const reloadResult =
        await reloadResponse.json();

      if (
        reloadResponse.ok
      ) {
        setChannexRoomTypes(
          reloadResult.roomTypes ??
          []
        );

        setChannexRatePlans(
          reloadResult.ratePlans ??
          []
        );
      }
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi khi tạo Rate Plans trên Channex."
      );
    } finally {
      setCreatingRates(
        false
      );
    }
  }

  /* ======================================================
     SAVE
  ====================================================== */

  async function saveMappings() {
    if (
      hasDuplicateRates
    ) {
      setErrorMessage(
        "Một Channex Rate Plan đang được dùng cho nhiều PMS Rate Plans. Mỗi mapping phải là duy nhất."
      );

      return;
    }

    setSaving(true);

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const roomMappings =
        roomTypes.map(
          (
            room
          ) => ({
            roomTypeId:
              room.id,

            channexRoomTypeId:
              roomSelections[
              room.id
              ] ||
              "",
          })
        );

      const rateMappings =
        roomTypes.flatMap(
          (
            room
          ) =>
            ratePlans.map(
              (
                rate
              ) => ({
                roomTypeId:
                  room.id,

                ratePlanId:
                  rate.id,

                channexRatePlanId:
                  rateSelections[
                  `${room.id}:${rate.id}`
                  ] ||
                  "",
              })
            )
        );

      const response =
        await fetch(
          "/api/admin/channex/save-mappings",
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
                roomMappings,
                rateMappings,
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
          "Không thể lưu mapping."
        );

        return;
      }

      setSuccessMessage(
        `Đã lưu ${result.result?.room_mappings ?? 0} Room Type mappings và ${result.result?.rate_mappings ?? 0} Rate Plan mappings.`
      );

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi khi lưu mapping."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Room & Rate Mapping
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Map cấu trúc PMS với cấu trúc Channex.
          </p>
        </div>

        <div className="flex gap-2">

          <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            Rooms{" "}
            {mappedRooms}/
            {roomTypes.length}
          </div>

          <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            Rates{" "}
            {mappedRates}/
            {totalRates}
          </div>

        </div>

      </div>

      <div className="p-6">

        {/* LOAD */}
        <div className="flex flex-wrap gap-3">

          <button
            type="button"
            disabled={
              loading ||
              creatingRates
            }
            onClick={
              loadOptions
            }
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >

            {loading ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <RefreshCw
                size={17}
              />
            )}

            {loading
              ? "Loading..."
              : loaded
                ? "Reload Channex Data"
                : "Load Channex Room & Rates"}

          </button>


          <button
            type="button"
            disabled={
              creatingRates ||
              mappedRooms !==
              roomTypes.length
            }
            onClick={
              createMissingRatePlans
            }
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >

            {creatingRates && (
              <Loader2
                size={17}
                className="animate-spin"
              />
            )}

            {creatingRates
              ? "Creating Rate Plans..."
              : "Create PMS Rate Plans on Channex"}

          </button>

        </div>


        {/* ERRORS */}

        {errorMessage && (

          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {
              errorMessage
            }
          </div>

        )}

        {successMessage && (

          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {
              successMessage
            }
          </div>

        )}

        {/* DUPLICATE WARNING */}

        {hasDuplicateRates && (

          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">

            <TriangleAlert
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div>

              <p className="font-semibold">
                Rate Plan mapping bị trùng
              </p>

              <p className="mt-1 leading-6">

                Một Channex Rate Plan không thể được map với nhiều PMS Rate Plans.
                Bạn cần tạo đủ Rate Plans trên Channex hoặc chọn các Rate Plan khác nhau.

              </p>

            </div>

          </div>

        )}

        {loaded && (

          <>
            {/* ==================================================
                ROOM TYPES
            ================================================== */}

            <div className="mt-7">

              <h3 className="font-bold text-slate-900">
                Room Types
              </h3>

              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">

                {roomTypes.map(
                  (
                    room
                  ) => (

                    <div
                      key={
                        room.id
                      }
                      className="grid items-center gap-4 border-b border-slate-200 p-4 last:border-b-0 md:grid-cols-[1fr_auto_1fr]"
                    >

                      <div>

                        <p className="font-semibold text-slate-900">
                          {
                            room.name
                          }
                        </p>

                        <p className="text-xs text-slate-400">
                          {
                            room.code
                          }
                        </p>

                      </div>

                      <ArrowRight
                        size={17}
                        className="text-slate-400"
                      />

                      <select
                        value={
                          roomSelections[
                          room.id
                          ] || ""
                        }
                        onChange={(
                          event
                        ) => {
                          const value =
                            event
                              .target
                              .value;

                          setRoomSelections(
                            (
                              current
                            ) => ({
                              ...current,

                              [room.id]:
                                value,
                            })
                          );

                          setRateSelections(
                            (
                              current
                            ) => {
                              const next = {
                                ...current,
                              };

                              for (
                                const rate of
                                ratePlans
                              ) {
                                delete next[
                                  `${room.id}:${rate.id}`
                                ];
                              }

                              return next;
                            }
                          );
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                      >

                        <option value="">
                          Select Channex Room Type
                        </option>

                        {channexRoomTypes.map(
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
                              disabled={
                                Object.entries(
                                  roomSelections
                                ).some(
                                  (
                                    [
                                      key,
                                      value,
                                    ]
                                  ) =>
                                    key !==
                                    room.id &&
                                    value ===
                                    item.id
                                )
                              }
                            >
                              {
                                item.title
                              }
                            </option>

                          )
                        )}

                      </select>

                    </div>

                  )
                )}

              </div>

            </div>

            {/* ==================================================
                RATE PLANS
            ================================================== */}

            <div className="mt-8">

              <h3 className="font-bold text-slate-900">
                Rate Plans
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Mỗi PMS Rate Plan phải map tới một Channex Rate Plan riêng.
              </p>

              <div className="mt-4 space-y-5">

                {roomTypes.map(
                  (
                    room
                  ) => {
                    const targetRoomId =
                      roomSelections[
                      room.id
                      ] || "";

                    const availableRates =
                      channexRatePlans.filter(
                        (
                          item
                        ) =>
                          item.roomTypeId ===
                          targetRoomId
                      );

                    return (

                      <div
                        key={
                          room.id
                        }
                        className="overflow-hidden rounded-xl border border-slate-200"
                      >

                        <div className="bg-slate-50 px-4 py-3">

                          <p className="font-semibold text-slate-900">
                            {
                              room.name
                            }
                          </p>

                          <p className="text-xs text-slate-400">
                            {
                              room.code
                            }
                          </p>

                        </div>

                        {ratePlans.map(
                          (
                            rate
                          ) => {
                            const key =
                              `${room.id}:${rate.id}`;

                            return (

                              <div
                                key={
                                  key
                                }
                                className="grid items-center gap-4 border-t border-slate-200 p-4 md:grid-cols-[1fr_auto_1fr]"
                              >

                                <div>

                                  <p className="text-sm font-semibold text-slate-800">
                                    {
                                      rate.name
                                    }
                                  </p>

                                  <p className="text-xs text-slate-400">
                                    {
                                      rate.code
                                    }
                                  </p>

                                </div>

                                <ArrowRight
                                  size={17}
                                  className="text-slate-400"
                                />

                                <select
                                  disabled={
                                    !targetRoomId
                                  }
                                  value={
                                    rateSelections[
                                    key
                                    ] || ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setRateSelections(
                                      (
                                        current
                                      ) => ({
                                        ...current,

                                        [key]:
                                          event
                                            .target
                                            .value,
                                      })
                                    )
                                  }
                                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400 focus:border-blue-500"
                                >

                                  <option value="">
                                    {targetRoomId
                                      ? "Select Channex Rate Plan"
                                      : "Map Room Type first"}
                                  </option>

                                  {availableRates.map(
                                    (
                                      item
                                    ) => {
                                      const currentlySelected =
                                        rateSelections[
                                        key
                                        ] ===
                                        item.id;

                                      const usedElsewhere =
                                        isRatePlanUsedElsewhere(
                                          item.id,
                                          key
                                        );

                                      return (

                                        <option
                                          key={
                                            item.id
                                          }
                                          value={
                                            item.id
                                          }
                                          disabled={
                                            usedElsewhere &&
                                            !currentlySelected
                                          }
                                        >
                                          {
                                            item.title
                                          }

                                          {usedElsewhere &&
                                            !currentlySelected
                                            ? " — already mapped"
                                            : ""}
                                        </option>

                                      );
                                    }
                                  )}

                                </select>

                              </div>

                            );
                          }
                        )}

                      </div>

                    );
                  }
                )}

              </div>

            </div>

            {/* ==================================================
                SAVE
            ================================================== */}

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">

              <div>

                {complete ? (

                  <div className="flex items-center gap-2 text-sm font-semibold text-green-700">

                    <CheckCircle2
                      size={17}
                    />

                    Mapping complete — Ready for ARI

                  </div>

                ) : (

                  <p className="text-sm text-slate-500">

                    {hasDuplicateRates
                      ? "Xử lý Rate Plan trùng trước khi lưu."
                      : "Hoàn tất tất cả mapping trước khi Sync ARI."}

                  </p>

                )}

              </div>

              <button
                type="button"
                disabled={
                  saving ||
                  !complete
                }
                onClick={
                  saveMappings
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >

                {saving && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}

                {saving
                  ? "Saving..."
                  : "Save Mapping"}

              </button>

            </div>

          </>

        )}

      </div>

    </div>
  );
}