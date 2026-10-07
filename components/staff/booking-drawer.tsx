"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

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
  booking:
    | CalendarBooking
    | null;

  onClose:
    () => void;
}) {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    cancelOpen,
    setCancelOpen,
  ] =
    useState(false);

  const [
    cancelNotes,
    setCancelNotes,
  ] =
    useState("");

  const [
    noShowOpen,
    setNoShowOpen,
  ] =
    useState(false);

  const [
    noShowNotes,
    setNoShowNotes,
  ] =
    useState("");

  const [
    businessDate,
    setBusinessDate,
  ] =
    useState("");

  /* ======================================================
     VIETNAM BUSINESS DATE
     Set after mount to avoid hydration mismatch.
  ====================================================== */

  useEffect(() => {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "Asia/Ho_Chi_Minh",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        }
      ).formatToParts(
        new Date()
      );

    const year =
      parts.find(
        (
          item
        ) =>
          item.type ===
          "year"
      )?.value ??
      "";

    const month =
      parts.find(
        (
          item
        ) =>
          item.type ===
          "month"
      )?.value ??
      "";

    const day =
      parts.find(
        (
          item
        ) =>
          item.type ===
          "day"
      )?.value ??
      "";

    if (
      year &&
      month &&
      day
    ) {
      setBusinessDate(
        `${year}-${month}-${day}`
      );
    }
  }, []);

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
  const currentBooking =
    booking;

  /* ======================================================
     CHANGE STATUS
  ====================================================== */

  async function changeStatus(
    status:
      | "checked_in"
      | "checked_out"
  ) {
    setLoading(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          "/api/staff/bookings/status",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                bookingId:
                  currentBooking.bookingId,

                status,
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
            "Không thể cập nhật booking."
        );

        return;
      }

      onClose();

      router.refresh();
    } catch (
      error
    ) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi xảy ra khi cập nhật booking."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ======================================================
     CANCEL BOOKING
  ====================================================== */

  async function cancelBooking() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          "/api/staff/bookings/cancel",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                bookingId:
                  currentBooking.bookingId,

                notes:
                  cancelNotes.trim() ||
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
            "Không thể hủy booking."
        );

        return;
      }

      if (
        result.warning
      ) {
        console.warn(
          "Cancel Booking Channex warning:",
          result.warning
        );
      }

      setCancelOpen(false);
      setCancelNotes("");

      onClose();

      router.refresh();
    } catch (
      error
    ) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi xảy ra khi hủy booking."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ======================================================
     MARK NO-SHOW
  ====================================================== */

  async function markNoShow() {
    setLoading(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          "/api/staff/bookings/no-show",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                bookingId:
                  currentBooking.bookingId,

                notes:
                  noShowNotes.trim() ||
                  null,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        if (
          result.error ===
          "FUTURE_CHECKIN_NO_SHOW_NOT_ALLOWED"
        ) {
          setErrorMessage(
            "Chưa đến ngày check-in. Không thể đánh dấu No-show."
          );
        } else {
          setErrorMessage(
            result.error ||
              "Không thể đánh dấu No-show."
          );
        }

        return;
      }

      if (
        result.warning
      ) {
        console.warn(
          "No-show Channex warning:",
          result.warning
        );
      }

      setNoShowOpen(
        false
      );

      setNoShowNotes(
        ""
      );

      onClose();

      router.refresh();
    } catch (
      error
    ) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi xảy ra khi đánh dấu No-show."
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
        currentBooking.totalAmount ||
          0
      )
    );

  /* ======================================================
     STATUS STYLE
  ====================================================== */

  function getStatusStyle() {
    switch (
      currentBooking.status
    ) {
      case "checked_in":
        return "bg-green-50 text-green-700";

      case "checked_out":
        return "bg-slate-100 text-slate-600";

      case "pending":
        return "bg-amber-50 text-amber-700";

      case "cancelled":
        return "bg-red-50 text-red-700";

      case "no_show":
        return "bg-orange-50 text-orange-700";

      default:
        return "bg-blue-50 text-blue-700";
    }
  }

  const canCancel =
    currentBooking.status ===
      "pending" ||
    currentBooking.status ===
      "confirmed";

  const isConfirmed =
    currentBooking.status ===
    "confirmed";

  const isFutureCheckIn =
    isConfirmed &&
    businessDate !== "" &&
    currentBooking.check_in >
      businessDate;

  const canMarkNoShow =
    isConfirmed &&
    businessDate !== "" &&
    currentBooking.check_in <=
      businessDate;

  return (
    <>
      {/* ==================================================
          OVERLAY
      ================================================== */}

      <button
        type="button"
        aria-label="Close booking drawer"
        onClick={
          onClose
        }
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
              {
                currentBooking.code
              }
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {
                currentBooking.guestName
              }
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X
              size={
                20
              }
            />
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
                {
                  currentBooking.status
                }
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
                {
                  currentBooking.check_in
                }
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">
                Check-out
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {
                  currentBooking.check_out
                }
              </p>
            </div>
          </div>

          {/* ROOM */}

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs text-slate-400">
              Room
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {
                currentBooking.roomNumber
              }
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {
                currentBooking.roomTypeName
              }
            </p>
          </div>

          {/* SOURCE */}

          <div>
            <p className="text-xs text-slate-400">
              Source
            </p>

            <p className="mt-1 font-medium capitalize text-slate-900">
              {
                currentBooking.source
              }
            </p>
          </div>

          {/* TOTAL */}

          <div>
            <p className="text-xs text-slate-400">
              Total
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {
                amount
              }{" "}
              {
                currentBooking.currency
              }
            </p>
          </div>

          {/* CONTACT */}

          {(
            currentBooking.phone ||
            currentBooking.email
          ) && (
            <div>
              <p className="text-xs text-slate-400">
                Guest Contact
              </p>

              {currentBooking.phone && (
                <p className="mt-2 text-sm text-slate-700">
                  {
                    currentBooking.phone
                  }
                </p>
              )}

              {currentBooking.email && (
                <p className="mt-1 text-sm text-slate-700">
                  {
                    currentBooking.email
                  }
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
                {
                  currentBooking.notes
                }
              </div>
            </div>
          )}

          {/* ERROR */}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {
                errorMessage
              }
            </div>
          )}

          {/* ==================================================
              CHECK IN
          ================================================== */}

          {currentBooking.status ===
            "confirmed" && (
            <button
              type="button"
              disabled={
                loading
              }
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
              disabled={
                loading
              }
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

          {/* ==================================================
              CANCEL BOOKING
          ================================================== */}

          {canCancel && (
            <button
              type="button"
              disabled={
                loading
              }
              onClick={() => {
                setErrorMessage(
                  ""
                );

                setCancelOpen(
                  true
                );
              }}
              className="w-full rounded-xl border border-red-200 bg-white py-3 font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              CANCEL BOOKING
            </button>
          )}

          {/* ==================================================
              MARK NO-SHOW
          ================================================== */}

          {canMarkNoShow && (
            <button
              type="button"
              disabled={
                loading
              }
              onClick={() => {
                setErrorMessage(
                  ""
                );

                setNoShowOpen(
                  true
                );
              }}
              className="w-full rounded-xl border border-orange-200 bg-white py-3 font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              MARK NO-SHOW
            </button>
          )}

          {isFutureCheckIn && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-700">
              No-show chỉ khả dụng từ ngày check-in (
              {
                currentBooking.check_in
              }
              ).
            </div>
          )}

          {/* CHECKED OUT */}

          {currentBooking.status ===
            "checked_out" && (
            <div className="rounded-xl bg-slate-100 p-4 text-center text-sm font-medium text-slate-600">
              Booking completed
            </div>
          )}

          {/* CANCELLED */}

          {currentBooking.status ===
            "cancelled" && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center text-sm font-medium text-red-700">
              Booking cancelled
            </div>
          )}

          {/* NO SHOW */}

          {currentBooking.status ===
            "no_show" && (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-center text-sm font-medium text-orange-700">
              Booking marked as no-show
            </div>
          )}
        </div>
      </aside>

      {/* ==================================================
          CANCEL CONFIRMATION MODAL
      ================================================== */}

      {cancelOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cancel Booking
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {
                    currentBooking.code
                  }{" "}
                  ·{" "}
                  {
                    currentBooking.guestName
                  }
                </p>
              </div>

              <button
                type="button"
                disabled={
                  loading
                }
                onClick={() =>
                  setCancelOpen(
                    false
                  )
                }
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X
                  size={
                    18
                  }
                />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                Hủy booking sẽ trả lại inventory cho các đêm đã giữ và đồng bộ availability sang Channex.
              </div>

              <div>
                <label
                  htmlFor="cancel-booking-notes"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Lý do hủy
                </label>

                <textarea
                  id="cancel-booking-notes"
                  value={
                    cancelNotes
                  }
                  onChange={(
                    event
                  ) =>
                    setCancelNotes(
                      event.target.value
                    )
                  }
                  rows={
                    4
                  }
                  placeholder="Ví dụ: Khách thay đổi kế hoạch..."
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-2 focus:ring-red-100"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {
                    errorMessage
                  }
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                disabled={
                  loading
                }
                onClick={() =>
                  setCancelOpen(
                    false
                  )
                }
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                KEEP BOOKING
              </button>

              <button
                type="button"
                disabled={
                  loading
                }
                onClick={
                  cancelBooking
                }
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "CANCELLING..."
                  : "CONFIRM CANCEL"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          NO-SHOW CONFIRMATION MODAL
      ================================================== */}

      {noShowOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Mark No-show
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {
                    currentBooking.code
                  }{" "}
                  ·{" "}
                  {
                    currentBooking.guestName
                  }
                </p>
              </div>

              <button
                type="button"
                disabled={
                  loading
                }
                onClick={() =>
                  setNoShowOpen(
                    false
                  )
                }
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X
                  size={
                    18
                  }
                />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800">
                Đánh dấu No-show sẽ trả lại inventory của booking và đồng bộ availability sang Channex. Giá trị booking và thanh toán hiện tại không tự động thay đổi.
              </div>

              <div>
                <label
                  htmlFor="no-show-booking-notes"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Ghi chú No-show
                </label>

                <textarea
                  id="no-show-booking-notes"
                  value={
                    noShowNotes
                  }
                  onChange={(
                    event
                  ) =>
                    setNoShowNotes(
                      event.target.value
                    )
                  }
                  rows={
                    4
                  }
                  placeholder="Ví dụ: Khách không đến và không liên hệ..."
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {
                    errorMessage
                  }
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                disabled={
                  loading
                }
                onClick={() =>
                  setNoShowOpen(
                    false
                  )
                }
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                KEEP BOOKING
              </button>

              <button
                type="button"
                disabled={
                  loading
                }
                onClick={
                  markNoShow
                }
                className="flex-1 rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "PROCESSING..."
                  : "CONFIRM NO-SHOW"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
