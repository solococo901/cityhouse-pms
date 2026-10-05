"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

/* ======================================================
   TYPE
====================================================== */

export type CalendarBooking = {
  // booking_rooms.id
  id: string;

  // bookings.id
  bookingId: string;

  room_id: string | null;

  roomNumber: string;
  roomTypeName: string;

  check_in: string;
  check_out: string;

  code: string;

  guestName: string;

  phone: string | null;
  email: string | null;

  source: string;
  status: string;

  totalAmount: number;
  currency: string;

  notes: string | null;
};

/* ======================================================
   COMPONENT
====================================================== */

export default function BookingDrawer({
  booking,
  onClose,
}: {
  booking: CalendarBooking | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  /* ======================================================
     KHÔNG CÓ BOOKING
  ====================================================== */

  if (!booking) {
    return null;
  }

  /*
   * Sau đoạn kiểm tra trên,
   * currentBooking chắc chắn không phải null.
   */
  const currentBooking = booking;

  /* ======================================================
     CHANGE STATUS
  ====================================================== */

  async function changeStatus(
    status: "checked_in" | "checked_out"
  ) {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/staff/bookings/status",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            bookingId:
              currentBooking.bookingId,

            status,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "Không thể cập nhật booking."
        );

        return;
      }

      onClose();

      router.refresh();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Có lỗi xảy ra khi cập nhật booking."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ======================================================
     MONEY FORMAT
  ====================================================== */

  const amount =
    new Intl.NumberFormat(
      "vi-VN"
    ).format(
      Number(
        currentBooking.totalAmount || 0
      )
    );

  /* ======================================================
     STATUS STYLE
  ====================================================== */

  function getStatusStyle() {
    switch (currentBooking.status) {
      case "checked_in":
        return "bg-green-50 text-green-700";

      case "checked_out":
        return "bg-slate-100 text-slate-600";

      case "pending":
        return "bg-amber-50 text-amber-700";

      case "cancelled":
        return "bg-red-50 text-red-700";

      default:
        return "bg-blue-50 text-blue-700";
    }
  }

  return (
    <>
      {/* ==================================================
          OVERLAY
      ================================================== */}

      <button
        type="button"
        aria-label="Close booking drawer"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default bg-black/20"
      />

      {/* ==================================================
          DRAWER
      ================================================== */}

      <aside className="fixed bottom-0 right-0 top-0 z-[90] w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">

        {/* HEADER */}

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">

          <div>

            <p className="text-xs font-semibold text-blue-600">
              {currentBooking.code}
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {currentBooking.guestName}
            </h2>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X size={20} />
          </button>

        </div>

        {/* CONTENT */}

        <div className="space-y-6 p-6">

          {/* STATUS */}

          <div>

            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Status
            </p>

            <div className="mt-2">

              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusStyle()}`}
              >
                {currentBooking.status}
              </span>

            </div>

          </div>

          {/* DATES */}

          <div className="grid grid-cols-2 gap-4">

            <div>

              <p className="text-xs text-slate-400">
                Check-in
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {currentBooking.check_in}
              </p>

            </div>

            <div>

              <p className="text-xs text-slate-400">
                Check-out
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {currentBooking.check_out}
              </p>

            </div>

          </div>

          {/* ROOM */}

          <div className="rounded-2xl bg-slate-50 p-4">

            <p className="text-xs text-slate-400">
              Room
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {currentBooking.roomNumber}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {currentBooking.roomTypeName}
            </p>

          </div>

          {/* SOURCE */}

          <div>

            <p className="text-xs text-slate-400">
              Source
            </p>

            <p className="mt-1 font-medium capitalize text-slate-900">
              {currentBooking.source}
            </p>

          </div>

          {/* TOTAL */}

          <div>

            <p className="text-xs text-slate-400">
              Total
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {amount}{" "}
              {currentBooking.currency}
            </p>

          </div>

          {/* CONTACT */}

          {(currentBooking.phone ||
            currentBooking.email) && (

            <div>

              <p className="text-xs text-slate-400">
                Guest Contact
              </p>

              {currentBooking.phone && (

                <p className="mt-2 text-sm text-slate-700">
                  {currentBooking.phone}
                </p>

              )}

              {currentBooking.email && (

                <p className="mt-1 text-sm text-slate-700">
                  {currentBooking.email}
                </p>

              )}

            </div>

          )}

          {/* NOTES */}

          {currentBooking.notes && (

            <div>

              <p className="text-xs text-slate-400">
                Notes
              </p>

              <div className="mt-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                {currentBooking.notes}
              </div>

            </div>

          )}

          {/* ERROR */}

          {errorMessage && (

            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorMessage}
            </div>

          )}

          {/* ==================================================
              CHECK IN
          ================================================== */}

          {currentBooking.status ===
            "confirmed" && (

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                changeStatus(
                  "checked_in"
                )
              }
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : "CHECK IN"}
            </button>

          )}

          {/* ==================================================
              CHECK OUT
          ================================================== */}

          {currentBooking.status ===
            "checked_in" && (

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                changeStatus(
                  "checked_out"
                )
              }
              className="w-full rounded-xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : "CHECK OUT"}
            </button>

          )}

          {/* CHECKED OUT */}

          {currentBooking.status ===
            "checked_out" && (

            <div className="rounded-xl bg-slate-100 p-4 text-center text-sm font-medium text-slate-600">
              Booking completed
            </div>

          )}

        </div>

      </aside>
    </>
  );
}