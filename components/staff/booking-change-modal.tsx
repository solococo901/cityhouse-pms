"use client";

import { useState } from "react";
import {
  ArrowRight,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ======================================================
   TYPES
====================================================== */

export type BookingChangePreview = {
  booking_id: string;

  booking_room_id: string;

  old_room_id: string | null;
  new_room_id: string;

  old_room_type_id: string;
  new_room_type_id: string;

  old_check_in: string;
  old_check_out: string;

  new_check_in: string;
  new_check_out: string;

  old_nights: number;
  new_nights: number;

  committed_amount_before: number;

  calculated_new_amount: number;

  additional_charge: number;

  committed_amount_after: number;

  refund_amount: number;

  room_available: boolean;

  inventory_available: boolean;
};

type Props = {
  preview: BookingChangePreview | null;

  targetRoomNumber: string;

  targetRoomTypeName: string;

  onClose: () => void;
};

/* ======================================================
   MONEY FORMAT
====================================================== */

function money(value: number) {
  return (
    new Intl.NumberFormat(
      "vi-VN"
    ).format(Number(value || 0)) + "đ"
  );
}

/* ======================================================
   COMPONENT
====================================================== */

export default function BookingChangeModal({
  preview,
  targetRoomNumber,
  targetRoomTypeName,
  onClose,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /* ======================================================
     NO PREVIEW
  ====================================================== */

  if (!preview) {
    return null;
  }

  /*
   * Quan trọng:
   *
   * Sau đoạn if phía trên,
   * currentPreview chắc chắn KHÔNG null.
   *
   * Dùng currentPreview trong async function
   * để TypeScript không báo:
   *
   * 'preview' is possibly 'null'
   */

  const currentPreview = preview;

  /* ======================================================
     CONFIRM CHANGE
  ====================================================== */

  async function confirmChange() {
    setLoading(true);

    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/staff/bookings/confirm-change",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            bookingRoomId:
              currentPreview.booking_room_id,

            targetRoomId:
              currentPreview.new_room_id,

            newCheckIn:
              currentPreview.new_check_in,

            newCheckOut:
              currentPreview.new_check_out,

            notes:
              "Changed from reservation calendar",
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "Không thể thay đổi booking."
        );

        return;
      }

      onClose();

      router.refresh();
    } catch (error) {
      console.error(
        "Confirm change error:",
        error
      );

      setErrorMessage(
        "Có lỗi xảy ra khi thay đổi booking."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ======================================================
     PRICE STATUS
  ====================================================== */

  const hasAdditionalCharge =
    currentPreview.additional_charge > 0;

  const newPriceIsLower =
    currentPreview.calculated_new_amount <
    currentPreview.committed_amount_before;

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <>
      {/* BACKDROP */}

      <button
        type="button"
        aria-label="Close booking change modal"
        onClick={onClose}
        className="fixed inset-0 z-[100] cursor-default bg-black/40"
      />

      {/* MODAL CONTAINER */}

      <div className="pointer-events-none fixed inset-0 z-[110] flex items-center justify-center p-5">

        <div className="pointer-events-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">

          {/* ==================================================
              HEADER
          ================================================== */}

          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">

            <div>

              <h2 className="text-xl font-bold text-slate-900">
                Change Reservation
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review before confirming
              </p>

            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            >
              <X size={20} />
            </button>

          </div>

          {/* ==================================================
              BODY
          ================================================== */}

          <div className="p-6">

            {/* ==================================================
                CURRENT → NEW
            ================================================== */}

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">

              {/* CURRENT */}

              <div className="rounded-2xl border border-slate-200 p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Current
                </p>

                <p className="mt-3 font-semibold text-slate-900">
                  {
                    currentPreview.old_check_in
                  }
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  →
                  {" "}
                  {
                    currentPreview.old_check_out
                  }
                </p>

                <p className="mt-3 text-sm text-slate-500">
                  {
                    currentPreview.old_nights
                  }
                  {" "}
                  nights
                </p>

              </div>

              {/* ARROW */}

              <ArrowRight
                size={20}
                className="text-slate-400"
              />

              {/* NEW */}

              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">

                <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                  New
                </p>

                <p className="mt-3 font-semibold text-slate-900">
                  {
                    currentPreview.new_check_in
                  }
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  →
                  {" "}
                  {
                    currentPreview.new_check_out
                  }
                </p>

                <p className="mt-3 text-sm text-slate-500">
                  {
                    currentPreview.new_nights
                  }
                  {" "}
                  nights
                </p>

              </div>

            </div>

            {/* ==================================================
                TARGET ROOM
            ================================================== */}

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">

              <p className="text-xs text-slate-400">
                New room
              </p>

              <p className="mt-1 text-lg font-bold text-slate-900">
                Room{" "}
                {targetRoomNumber}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {targetRoomTypeName}
              </p>

            </div>

            {/* ==================================================
                PRICE BREAKDOWN
            ================================================== */}

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">

              {/* CURRENT PRICE */}

              <div className="flex items-center justify-between px-5 py-4">

                <span className="text-sm text-slate-500">
                  Current committed price
                </span>

                <strong className="text-slate-900">
                  {money(
                    currentPreview.committed_amount_before
                  )}
                </strong>

              </div>

              {/* NEW VALUE */}

              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">

                <span className="text-sm text-slate-500">
                  New stay value
                </span>

                <strong className="text-slate-900">
                  {money(
                    currentPreview.calculated_new_amount
                  )}
                </strong>

              </div>

              {/* FINAL TOTAL */}

              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-4">

                <span className="text-sm font-medium text-slate-600">
                  Final booking total
                </span>

                <strong className="text-lg text-slate-900">
                  {money(
                    currentPreview.committed_amount_after
                  )}
                </strong>

              </div>

            </div>

            {/* ==================================================
                PRICE DIFFERENCE
            ================================================== */}

            {hasAdditionalCharge ? (

              /* PRICE HIGHER */

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">

                <p className="text-sm font-medium text-amber-700">
                  Additional charge
                </p>

                <p className="mt-1 text-2xl font-bold text-amber-900">
                  +
                  {money(
                    currentPreview.additional_charge
                  )}
                </p>

                <p className="mt-2 text-xs leading-5 text-amber-700">
                  Giá kỳ lưu trú mới cao hơn.
                  Khách cần thanh toán thêm phần chênh lệch này.
                </p>

              </div>

            ) : newPriceIsLower ? (

              /* PRICE LOWER */

              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">

                <p className="font-medium text-blue-800">
                  Giá kỳ mới thấp hơn
                </p>

                <p className="mt-2 text-sm leading-6 text-blue-700">
                  Theo chính sách hiện tại,
                  booking vẫn giữ nguyên giá đã cam kết.
                  Không hoàn lại phần chênh lệch.
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-blue-200 pt-4">

                  <span className="text-sm text-blue-700">
                    Refund
                  </span>

                  <strong className="text-blue-900">
                    0đ
                  </strong>

                </div>

              </div>

            ) : (

              /* SAME PRICE */

              <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-5">

                <p className="font-medium text-green-800">
                  No price difference
                </p>

                <p className="mt-1 text-sm text-green-700">
                  Có thể đổi booking mà không cần thu thêm.
                </p>

              </div>

            )}

            {/* ==================================================
                ERROR
            ================================================== */}

            {errorMessage && (

              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {errorMessage}
              </div>

            )}

            {/* ==================================================
                ACTIONS
            ================================================== */}

            <div className="mt-6 flex gap-3">

              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={confirmChange}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Updating..."
                  : "Confirm Change"}
              </button>

            </div>

          </div>

        </div>

      </div>
    </>
  );
}