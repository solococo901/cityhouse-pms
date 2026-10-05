"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";

import BookingDrawer, {
  CalendarBooking,
} from "@/components/staff/booking-drawer";

const CELL_WIDTH = 140;

type Room = {
  id: string;
  room_number: string;
  room_type_id: string;
  roomTypeName: string;
};

type Props = {
  dates: string[];
  rooms: Room[];
  bookings: CalendarBooking[];
};

/* ======================================================
   DATE HELPERS
====================================================== */

function dateDiff(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  return Math.round(
    (endDate.getTime() - startDate.getTime()) / 86400000
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${value}T00:00:00Z`));
}

/* ======================================================
   MAIN CALENDAR
====================================================== */

export default function ReservationCalendar({
  dates,
  rooms,
  bookings,
}: Props) {
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const [moving, setMoving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [selectedBooking, setSelectedBooking] =
    useState<CalendarBooking | null>(null);

  /* ======================================================
     MOVE BOOKING
  ====================================================== */

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const bookingRoomId = String(active.id);
    const targetRoomId = String(over.id);

    const booking = bookings.find(
      (item) => item.id === bookingRoomId
    );

    if (!booking) {
      return;
    }

    // Thả vào chính phòng hiện tại
    if (booking.room_id === targetRoomId) {
      return;
    }

    setMoving(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/staff/bookings/move-room",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            bookingRoomId,
            targetRoomId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error || "Không thể đổi phòng."
        );

        return;
      }

      setSelectedBooking(null);

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Có lỗi xảy ra khi đổi phòng."
      );
    } finally {
      setMoving(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <div>
        {/* ERROR */}

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* MOVING */}

        {moving && (
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-700">
            Updating booking...
          </div>
        )}

        {/* CALENDAR */}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <div className="min-w-max">
            {/* HEADER */}

            <div className="flex border-b border-slate-200 bg-slate-50">
              <div className="sticky left-0 z-30 flex w-[180px] shrink-0 items-center border-r border-slate-200 bg-slate-50 px-5 font-semibold text-slate-600">
                Room
              </div>

              {dates.map((date) => (
                <div
                  key={date}
                  style={{
                    width: CELL_WIDTH,
                  }}
                  className="shrink-0 border-r border-slate-200 px-3 py-4 text-center"
                >
                  <p className="text-xs font-medium text-slate-500">
                    {formatDate(date)}
                  </p>
                </div>
              ))}
            </div>

            {/* ROOMS */}

            {rooms.map((room) => (
              <RoomRow
                key={room.id}
                room={room}
                dates={dates}
                bookings={bookings.filter(
                  (booking) =>
                    booking.room_id === room.id
                )}
                onOpenBooking={(booking) =>
                  setSelectedBooking(booking)
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* BOOKING DRAWER */}

      <BookingDrawer
        booking={selectedBooking}
        onClose={() =>
          setSelectedBooking(null)
        }
      />
    </DndContext>
  );
}

/* ======================================================
   ROOM ROW
====================================================== */

function RoomRow({
  room,
  dates,
  bookings,
  onOpenBooking,
}: {
  room: Room;
  dates: string[];
  bookings: CalendarBooking[];

  onOpenBooking: (
    booking: CalendarBooking
  ) => void;
}) {
  const { setNodeRef, isOver } =
    useDroppable({
      id: room.id,
    });

  const startDate = dates[0];

  return (
    <div
      ref={setNodeRef}
      className={`flex border-b border-slate-200 last:border-b-0 ${
        isOver
          ? "bg-blue-50"
          : "bg-white"
      }`}
    >
      {/* ROOM INFO */}

      <div className="sticky left-0 z-20 flex w-[180px] shrink-0 items-center border-r border-slate-200 bg-white px-5">
        <div>
          <p className="font-bold text-slate-900">
            {room.room_number}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {room.roomTypeName}
          </p>
        </div>
      </div>

      {/* TIMELINE */}

      <div
        className="relative flex h-[84px]"
        style={{
          width: dates.length * CELL_WIDTH,
        }}
      >
        {/* BACKGROUND CELLS */}

        {dates.map((date) => (
          <div
            key={date}
            style={{
              width: CELL_WIDTH,
            }}
            className="h-full shrink-0 border-r border-slate-100"
          />
        ))}

        {/* BOOKINGS */}

        {bookings.map((booking) => {
          const bookingStart = dateDiff(
            startDate,
            booking.check_in
          );

          const bookingEnd = dateDiff(
            startDate,
            booking.check_out
          );

          // Booking nằm hoàn toàn ngoài range đang hiển thị
          if (
            bookingEnd <= 0 ||
            bookingStart >= dates.length
          ) {
            return null;
          }

          const visibleStart = Math.max(
            bookingStart,
            0
          );

          const visibleEnd = Math.min(
            bookingEnd,
            dates.length
          );

          const nights = Math.max(
            1,
            visibleEnd - visibleStart
          );

          const left =
            visibleStart * CELL_WIDTH + 4;

          const width =
            nights * CELL_WIDTH - 8;

          return (
            <DraggableBooking
              key={booking.id}
              booking={booking}
              left={left}
              width={width}
              onOpen={() =>
                onOpenBooking(booking)
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/* ======================================================
   BOOKING CARD
====================================================== */

function DraggableBooking({
  booking,
  left,
  width,
  onOpen,
}: {
  booking: CalendarBooking;
  left: number;
  width: number;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: booking.id,
  });

  const transformStyle = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : undefined;

  function statusStyle() {
    switch (booking.status) {
      case "checked_in":
        return "border-green-200 bg-green-100 text-green-950";

      case "checked_out":
        return "border-slate-200 bg-slate-100 text-slate-700";

      case "pending":
        return "border-amber-200 bg-amber-100 text-amber-950";

      case "cancelled":
        return "border-red-200 bg-red-50 text-red-700";

      default:
        return "border-blue-200 bg-blue-100 text-blue-950";
    }
  }

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={{
        position: "absolute",

        left,
        width,

        top: 12,

        transform: transformStyle,

        zIndex: isDragging
          ? 50
          : 10,

        touchAction: "none",
      }}
      className={`
        h-[58px]
        cursor-grab
        overflow-hidden
        rounded-xl
        border
        px-3
        text-left
        shadow-sm
        transition

        active:cursor-grabbing

        ${statusStyle()}

        ${
          isDragging
            ? "opacity-70 shadow-xl"
            : "hover:shadow-md"
        }
      `}
    >
      <p className="truncate text-sm font-semibold">
        {booking.guestName}
      </p>

      <div className="mt-1 flex items-center gap-2 text-[11px] opacity-70">
        <span className="truncate">
          {booking.code}
        </span>

        <span>•</span>

        <span className="truncate capitalize">
          {booking.source}
        </span>
      </div>
    </button>
  );
}