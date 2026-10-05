"use client";

import {
  useState,
} from "react";

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  useRouter,
} from "next/navigation";


const CELL_WIDTH = 140;


type Room = {
  id: string;
  room_number: string;
  room_type_id: string;

  roomTypeName: string;
};


type Booking = {
  id: string;

  room_id: string | null;

  check_in: string;
  check_out: string;

  code: string;
  guestName: string;

  source: string;
  status: string;
};


type Props = {

  dates: string[];

  rooms: Room[];

  bookings: Booking[];

};


function dateDiff(
  start: string,
  end: string
) {

  const startDate =
    new Date(
      `${start}T00:00:00Z`
    );

  const endDate =
    new Date(
      `${end}T00:00:00Z`
    );

  return Math.round(
    (
      endDate.getTime() -
      startDate.getTime()
    ) /
    86400000
  );

}


function formatDate(
  value: string
) {

  return new Intl
    .DateTimeFormat(
      "en-GB",
      {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      }
    )
    .format(
      new Date(
        `${value}T00:00:00`
      )
    );

}


export default function ReservationCalendar({
  dates,
  rooms,
  bookings,
}: Props) {

  const router =
    useRouter();


  const sensors =
    useSensors(

      useSensor(
        PointerSensor,
        {
          activationConstraint: {
            distance: 5,
          },
        }
      )

    );


  const [
    moving,
    setMoving,
  ] =
    useState(false);


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");


  async function handleDragEnd(
    event: DragEndEvent
  ) {

    const {
      active,
      over,
    } = event;


    if (!over) {
      return;
    }


    const bookingRoomId =
      String(active.id);

    const targetRoomId =
      String(over.id);


    const booking =
      bookings.find(
        (item) =>
          item.id ===
          bookingRoomId
      );


    if (
      !booking ||
      booking.room_id ===
        targetRoomId
    ) {
      return;
    }


    setMoving(true);
    setErrorMessage("");


    const response =
      await fetch(
        "/api/staff/bookings/move-room",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            bookingRoomId,
            targetRoomId,
          }),
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      setErrorMessage(
        result.error ||
          "Không thể đổi phòng."
      );

      setMoving(false);

      return;

    }


    router.refresh();

    setMoving(false);

  }


  return (

    <DndContext
      sensors={sensors}
      onDragEnd={
        handleDragEnd
      }
    >

      <div>

        {errorMessage && (

          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

            {errorMessage}

          </div>

        )}


        {moving && (

          <div className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">

            Updating booking...

          </div>

        )}


        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">

          <div
            className="min-w-max"
          >

            {/* HEADER */}

            <div className="flex border-b bg-slate-50">

              <div className="sticky left-0 z-30 flex w-[180px] shrink-0 items-center border-r bg-slate-50 px-5 font-semibold text-slate-600">

                Room

              </div>


              {dates.map(
                (date) => (

                  <div
                    key={date}
                    style={{
                      width:
                        CELL_WIDTH,
                    }}
                    className="shrink-0 border-r px-3 py-4 text-center"
                  >

                    <p className="text-xs font-medium text-slate-500">

                      {formatDate(
                        date
                      )}

                    </p>

                  </div>

                )
              )}

            </div>


            {/* ROOMS */}

            {rooms.map(
              (room) => (

                <RoomRow
                  key={room.id}

                  room={room}

                  dates={dates}

                  bookings={
                    bookings.filter(
                      (booking) =>
                        booking.room_id ===
                        room.id
                    )
                  }
                />

              )
            )}

          </div>

        </div>

      </div>

    </DndContext>

  );

}


function RoomRow({
  room,
  dates,
  bookings,
}: {
  room: Room;
  dates: string[];
  bookings: Booking[];
}) {

  const {
    setNodeRef,
    isOver,
  } =
    useDroppable({
      id: room.id,
    });


  const startDate =
    dates[0];


  return (

    <div
      ref={setNodeRef}
      className={`flex border-b last:border-b-0 ${
        isOver
          ? "bg-blue-50"
          : "bg-white"
      }`}
    >

      <div className="sticky left-0 z-20 flex w-[180px] shrink-0 items-center border-r bg-white px-5">

        <div>

          <p className="font-bold text-slate-900">

            {room.room_number}

          </p>

          <p className="mt-1 text-xs text-slate-400">

            {room.roomTypeName}

          </p>

        </div>

      </div>


      <div
        className="relative flex h-[84px]"
        style={{
          width:
            dates.length *
            CELL_WIDTH,
        }}
      >

        {dates.map(
          (date) => (

            <div
              key={date}

              style={{
                width:
                  CELL_WIDTH,
              }}

              className="h-full shrink-0 border-r border-slate-100"
            />

          )
        )}


        {bookings.map(
          (booking) => {

            const start =
              Math.max(
                0,
                dateDiff(
                  startDate,
                  booking.check_in
                )
              );


            const end =
              Math.min(
                dates.length,
                dateDiff(
                  startDate,
                  booking.check_out
                )
              );


            const length =
              Math.max(
                1,
                end - start
              );


            return (

              <DraggableBooking
                key={booking.id}

                booking={
                  booking
                }

                left={
                  start *
                    CELL_WIDTH +
                  4
                }

                width={
                  length *
                    CELL_WIDTH -
                  8
                }
              />

            );

          }
        )}

      </div>

    </div>

  );

}


function DraggableBooking({
  booking,
  left,
  width,
}: {
  booking: Booking;
  left: number;
  width: number;
}) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } =
    useDraggable({
      id: booking.id,
    });


  const transformStyle =
    transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined;


  return (

    <button
      ref={setNodeRef}

      {...listeners}
      {...attributes}

      style={{
        position:
          "absolute",

        left,

        width,

        top: 12,

        transform:
          transformStyle,

        zIndex:
          isDragging
            ? 50
            : 10,
      }}

      className={`h-[58px] cursor-grab overflow-hidden rounded-xl border border-blue-200 bg-blue-100 px-3 text-left shadow-sm active:cursor-grabbing ${
        isDragging
          ? "opacity-70 shadow-xl"
          : ""
      }`}
    >

      <p className="truncate text-sm font-semibold text-blue-950">

        {booking.guestName}

      </p>

      <div className="mt-1 flex items-center gap-2 text-[11px] text-blue-700">

        <span>
          {booking.code}
        </span>

        <span>
          •
        </span>

        <span className="truncate">

          {booking.source}

        </span>

      </div>

    </button>

  );

}