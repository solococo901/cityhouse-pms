"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  CircleDot,
  Clock3,
  DoorOpen,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";


type RoomStatus =
  | "available"
  | "occupied"
  | "dirty"
  | "cleaning"
  | "out_of_order";


type Room = {
  id: string;
  property_id: string;
  room_type_id: string;
  room_number: string;
  floor: string | null;
  status: RoomStatus;
  active: boolean;
  updated_at: string;
  roomTypeName: string;
};


type Filter =
  | "all"
  | "dirty"
  | "cleaning"
  | "available";


type Props = {
  rooms: Room[];
};


type PendingAction = {
  room: Room;
  nextStatus:
    | "cleaning"
    | "available";
} | null;


function statusLabel(
  status: RoomStatus
) {

  switch (status) {

    case "available":
      return "Available";

    case "occupied":
      return "Occupied";

    case "dirty":
      return "Dirty";

    case "cleaning":
      return "Cleaning";

    case "out_of_order":
      return "Out of Order";

  }

}


function statusClass(
  status: RoomStatus
) {

  switch (status) {

    case "available":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "occupied":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "dirty":
      return "border-red-200 bg-red-50 text-red-700";

    case "cleaning":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "out_of_order":
      return "border-slate-300 bg-slate-100 text-slate-700";

  }

}


function formatUpdatedAt(
  value: string
) {

  try {

    return new Intl.DateTimeFormat(
      "vi-VN",
      {
        timeZone:
          "Asia/Ho_Chi_Minh",

        day:
          "2-digit",

        month:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    ).format(
      new Date(value)
    );

  } catch {

    return value;

  }

}


export default function HousekeepingBoard({
  rooms,
}: Props) {

  const router =
    useRouter();


  const [
    filter,
    setFilter,
  ] =
    useState<Filter>(
      "all"
    );


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    pendingAction,
    setPendingAction,
  ] =
    useState<PendingAction>(
      null
    );


  const [
    notes,
    setNotes,
  ] =
    useState("");


  const [
    loadingRoomId,
    setLoadingRoomId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");


  const counts =
    useMemo(
      () => ({
        all:
          rooms.length,

        dirty:
          rooms.filter(
            (room) =>
              room.status ===
              "dirty"
          ).length,

        cleaning:
          rooms.filter(
            (room) =>
              room.status ===
              "cleaning"
          ).length,

        available:
          rooms.filter(
            (room) =>
              room.status ===
              "available"
          ).length,

        occupied:
          rooms.filter(
            (room) =>
              room.status ===
              "occupied"
          ).length,

        outOfOrder:
          rooms.filter(
            (room) =>
              room.status ===
              "out_of_order"
          ).length,
      }),
      [
        rooms,
      ]
    );


  const visibleRooms =
    useMemo(
      () => {

        const keyword =
          search
            .trim()
            .toLowerCase();


        return rooms.filter(
          (room) => {

            const matchFilter =
              filter ===
                "all" ||
              room.status ===
                filter;


            const matchSearch =
              !keyword ||
              room.room_number
                .toLowerCase()
                .includes(
                  keyword
                ) ||
              room.roomTypeName
                .toLowerCase()
                .includes(
                  keyword
                ) ||
              (
                room.floor ??
                ""
              )
                .toLowerCase()
                .includes(
                  keyword
                );


            return (
              matchFilter &&
              matchSearch
            );

          }
        );

      },
      [
        rooms,
        filter,
        search,
      ]
    );


  function openAction(
    room: Room,
    nextStatus:
      | "cleaning"
      | "available"
  ) {

    setErrorMessage(
      ""
    );


    setPendingAction({
      room,
      nextStatus,
    });


    setNotes(
      nextStatus ===
        "cleaning"
        ? "Housekeeping bắt đầu dọn phòng."
        : "Housekeeping hoàn tất, phòng sẵn sàng nhận khách."
    );

  }


  async function submitAction() {

    if (
      !pendingAction
    ) {
      return;
    }


    setLoadingRoomId(
      pendingAction.room.id
    );


    setErrorMessage(
      ""
    );


    try {

      const response =
        await fetch(
          "/api/staff/rooms/status",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                roomId:
                  pendingAction.room.id,

                status:
                  pendingAction.nextStatus,

                notes:
                  notes.trim() ||
                  null,
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
            "Không thể cập nhật trạng thái phòng."
        );

        return;

      }


      setPendingAction(
        null
      );


      setNotes(
        ""
      );


      router.refresh();

    } catch (
      error
    ) {

      console.error(
        error
      );


      setErrorMessage(
        "Có lỗi xảy ra khi cập nhật trạng thái phòng."
      );

    } finally {

      setLoadingRoomId(
        null
      );

    }

  }


  const filters: Array<{
    key: Filter;
    label: string;
    count: number;
  }> = [
    {
      key: "all",
      label: "All",
      count:
        counts.all,
    },
    {
      key: "dirty",
      label: "Dirty",
      count:
        counts.dirty,
    },
    {
      key: "cleaning",
      label: "Cleaning",
      count:
        counts.cleaning,
    },
    {
      key: "available",
      label: "Available",
      count:
        counts.available,
    },
  ];


  return (
    <>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Dirty
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {counts.dirty}
              </p>
            </div>

            <div className="rounded-xl bg-red-50 p-3 text-red-600">
              <TriangleAlert size={22} />
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Chờ Housekeeping xử lý
          </p>
        </div>


        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Cleaning
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {counts.cleaning}
              </p>
            </div>

            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
              <Sparkles size={22} />
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Đang được vệ sinh
          </p>
        </div>


        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Available
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {counts.available}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Ready for Guest
          </p>
        </div>


        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Occupied
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {counts.occupied}
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <DoorOpen size={22} />
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Guest in-house
          </p>
        </div>

      </div>


      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

          <div className="flex flex-wrap gap-2">

            {filters.map(
              (item) => (

                <button
                  key={
                    item.key
                  }
                  type="button"
                  onClick={() =>
                    setFilter(
                      item.key
                    )
                  }
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    filter ===
                    item.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}{" "}
                  <span className={`ml-1 ${
                    filter ===
                    item.key
                      ? "text-slate-300"
                      : "text-slate-400"
                  }`}>
                    {item.count}
                  </span>
                </button>

              )
            )}

          </div>


          <div className="relative w-full xl:w-80">

            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search room, room type, floor..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />

          </div>

        </div>

      </div>


      {visibleRooms.length ===
        0 ? (

        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">

          <Sparkles
            size={32}
            className="mx-auto text-slate-300"
          />

          <p className="mt-4 font-semibold text-slate-700">
            Không có phòng phù hợp
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Thử đổi bộ lọc hoặc từ khóa tìm kiếm.
          </p>

        </div>

      ) : (

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">

          {visibleRooms.map(
            (room) => {

              const loading =
                loadingRoomId ===
                room.id;


              return (

                <div
                  key={
                    room.id
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Room
                      </p>

                      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                        {room.room_number}
                      </h2>
                    </div>


                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                        room.status
                      )}`}
                    >
                      {statusLabel(
                        room.status
                      )}
                    </span>

                  </div>


                  <div className="mt-4 space-y-2 text-sm">

                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">
                        Room type
                      </span>

                      <span className="font-medium text-slate-700">
                        {room.roomTypeName}
                      </span>
                    </div>


                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">
                        Floor
                      </span>

                      <span className="font-medium text-slate-700">
                        {room.floor ||
                          "—"}
                      </span>
                    </div>


                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-400">
                        Updated
                      </span>

                      <span className="font-medium text-slate-700">
                        {formatUpdatedAt(
                          room.updated_at
                        )}
                      </span>
                    </div>

                  </div>


                  <div className="mt-5 border-t border-slate-100 pt-4">

                    {room.status ===
                      "dirty" && (

                      <button
                        type="button"
                        disabled={
                          loading
                        }
                        onClick={() =>
                          openAction(
                            room,
                            "cleaning"
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Sparkles size={18} />

                        {loading
                          ? "PROCESSING..."
                          : "START CLEANING"}
                      </button>

                    )}


                    {room.status ===
                      "cleaning" && (

                      <button
                        type="button"
                        disabled={
                          loading
                        }
                        onClick={() =>
                          openAction(
                            room,
                            "available"
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 size={18} />

                        {loading
                          ? "PROCESSING..."
                          : "MARK AS READY"}
                      </button>

                    )}


                    {room.status ===
                      "available" && (

                      <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 size={18} />

                        READY FOR GUEST
                      </div>

                    )}


                    {room.status ===
                      "occupied" && (

                      <div className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                        <CircleDot size={18} />

                        GUEST IN-HOUSE
                      </div>

                    )}


                    {room.status ===
                      "out_of_order" && (

                      <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                        <TriangleAlert size={18} />

                        OUT OF ORDER
                      </div>

                    )}

                  </div>

                </div>

              );

            }
          )}

        </div>

      )}


      {counts.outOfOrder >
        0 && (

        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-600">
          Có{" "}
          <span className="font-semibold text-slate-900">
            {counts.outOfOrder}
          </span>{" "}
          phòng Out of Order. Các phòng này sẽ được xử lý ở module Maintenance riêng.
        </div>

      )}


      {pendingAction && (

        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                  Housekeeping
                </p>

                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Room{" "}
                  {pendingAction.room.room_number}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {statusLabel(
                    pendingAction.room.status
                  )}
                  {" "}
                  →{" "}
                  {statusLabel(
                    pendingAction.nextStatus
                  )}
                </p>
              </div>


              <button
                type="button"
                disabled={
                  Boolean(
                    loadingRoomId
                  )
                }
                onClick={() =>
                  setPendingAction(
                    null
                  )
                }
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>

            </div>


            <div className="space-y-4 p-5">

              {pendingAction.nextStatus ===
                "cleaning" ? (

                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                  Bắt đầu dọn phòng. Trạng thái phòng sẽ chuyển từ Dirty sang Cleaning.
                </div>

              ) : (

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Xác nhận phòng đã dọn xong và sẵn sàng nhận khách.
                </div>

              )}


              <div>

                <label
                  htmlFor="housekeeping-notes"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Notes
                </label>

                <textarea
                  id="housekeeping-notes"
                  value={
                    notes
                  }
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Housekeeping note..."
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />

              </div>


              {errorMessage && (

                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </div>

              )}

            </div>


            <div className="flex gap-3 border-t border-slate-200 px-5 py-4">

              <button
                type="button"
                disabled={
                  Boolean(
                    loadingRoomId
                  )
                }
                onClick={() =>
                  setPendingAction(
                    null
                  )
                }
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                CANCEL
              </button>


              <button
                type="button"
                disabled={
                  Boolean(
                    loadingRoomId
                  )
                }
                onClick={
                  submitAction
                }
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  pendingAction.nextStatus ===
                  "cleaning"
                    ? "bg-amber-500 hover:bg-amber-400"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >

                {pendingAction.nextStatus ===
                  "cleaning"
                  ? <Sparkles size={17} />
                  : <CheckCircle2 size={17} />
                }

                {loadingRoomId
                  ? "PROCESSING..."
                  : pendingAction.nextStatus ===
                    "cleaning"
                    ? "START CLEANING"
                    : "MARK AS READY"
                }

              </button>

            </div>

          </div>

        </div>

      )}


      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
        <Clock3
          size={16}
          className="mt-0.5 shrink-0 text-slate-400"
        />

        <p>
          Housekeeping chỉ cập nhật trạng thái phòng vật lý. Inventory bán phòng và Channex không thay đổi trong thao tác này.
        </p>
      </div>

    </>
  );

}
