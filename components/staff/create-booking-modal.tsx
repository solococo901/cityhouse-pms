"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Plus,
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  syncChannexQueueNow,
} from "@/lib/channex/auto-sync-client";

type Room = {
  id: string;
  room_number: string;
  room_type_id: string;
  roomTypeName: string;
};

type RatePlan = {
  id: string;
  name: string;
  code: string | null;
};

type Quote = {
  success: true;

  room: {
    id: string;
    roomNumber: string;
    roomTypeId: string;
  };

  ratePlan: {
    id: string;
    name: string;
    code: string | null;
  };

  checkIn: string;
  checkOut: string;
  nights: number;

  nightlyRates: {
    stayDate: string;
    price: number;
  }[];

  suggestedTotal: number;
  currency: string;
};

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "vi-VN",
    {
      maximumFractionDigits: 0,
    }
  ).format(value);
}

export default function CreateBookingModal({
  propertyId,
  rooms,
  ratePlans,
}: {
  propertyId: string;
  rooms: Room[];
  ratePlans: RatePlan[];
}) {
  const router =
    useRouter();

  const [
    open,
    setOpen,
  ] =
    useState(false);

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
    roomId,
    setRoomId,
  ] =
    useState(
      rooms[0]?.id ?? ""
    );

  const [
    ratePlanId,
    setRatePlanId,
  ] =
    useState(
      ratePlans[0]?.id ?? ""
    );

  const [
    firstName,
    setFirstName,
  ] =
    useState("");

  const [
    lastName,
    setLastName,
  ] =
    useState("");

  const [
    phone,
    setPhone,
  ] =
    useState("");

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    checkIn,
    setCheckIn,
  ] =
    useState("");

  const [
    checkOut,
    setCheckOut,
  ] =
    useState("");

  const [
    adults,
    setAdults,
  ] =
    useState("1");

  const [
    children,
    setChildren,
  ] =
    useState("0");

  const [
    totalAmount,
    setTotalAmount,
  ] =
    useState("");

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    quote,
    setQuote,
  ] =
    useState<Quote | null>(
      null
    );

  const [
    quoteLoading,
    setQuoteLoading,
  ] =
    useState(false);

  const [
    quoteError,
    setQuoteError,
  ] =
    useState("");

  useEffect(() => {
    if (
      !roomId &&
      rooms[0]?.id
    ) {
      setRoomId(
        rooms[0].id
      );
    }
  }, [
    roomId,
    rooms,
  ]);

  useEffect(() => {
    if (
      !ratePlanId &&
      ratePlans[0]?.id
    ) {
      setRatePlanId(
        ratePlans[0].id
      );
    }
  }, [
    ratePlanId,
    ratePlans,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuote(null);
    setQuoteError("");
    setTotalAmount("");

    if (
      !propertyId ||
      !roomId ||
      !ratePlanId ||
      !checkIn ||
      !checkOut
    ) {
      setQuoteLoading(false);
      return;
    }

    if (
      checkOut <= checkIn
    ) {
      setQuoteLoading(false);
      setQuoteError(
        "Ngày check-out phải sau ngày check-in."
      );
      return;
    }

    const controller =
      new AbortController();

    async function loadQuote() {
      setQuoteLoading(true);

      try {
        const response =
          await fetch(
            "/api/staff/bookings/quote",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  propertyId,
                  roomId,
                  ratePlanId,
                  checkIn,
                  checkOut,
                }),
              signal:
                controller.signal,
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          setQuoteError(
            result.error ||
              "Không thể tính giá booking."
          );
          return;
        }

        const nextQuote =
          result as Quote;

        setQuote(
          nextQuote
        );

        setTotalAmount(
          String(
            nextQuote.suggestedTotal
          )
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.name ===
            "AbortError"
        ) {
          return;
        }

        setQuoteError(
          "Không thể tính giá booking."
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setQuoteLoading(false);
        }
      }
    }

    void loadQuote();

    return () => {
      controller.abort();
    };
  }, [
    open,
    propertyId,
    roomId,
    ratePlanId,
    checkIn,
    checkOut,
  ]);

  async function submit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!quote) {
      setErrorMessage(
        "Vui lòng chọn phòng, Rate Plan và ngày lưu trú hợp lệ trước khi tạo booking."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response =
        await fetch(
          "/api/staff/bookings/create",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                propertyId,
                roomId,
                ratePlanId,
                checkIn,
                checkOut,
                firstName,
                lastName,
                phone,
                email,
                adults,
                children,
                totalAmount,
                notes,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ||
            "Không thể tạo booking."
        );
        return;
      }

      await syncChannexQueueNow(
        propertyId
      );

      setOpen(false);
      router.refresh();
    } catch {
      setErrorMessage(
        "Không thể tạo booking."
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedRoom =
    rooms.find(
      (room) =>
        room.id === roomId
    ) ?? null;

  return (
    <>
      <button
        onClick={() =>
          setOpen(true)
        }
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
      >
        <Plus size={18} />
        New Booking
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  New Booking
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Direct reservation
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={submit}
              className="p-6"
            >
              <h3 className="font-semibold text-slate-900">
                Guest
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  required
                  value={firstName}
                  onChange={(event) =>
                    setFirstName(
                      event.target.value
                    )
                  }
                  placeholder="First name"
                  className="rounded-xl border px-4 py-3"
                />

                <input
                  value={lastName}
                  onChange={(event) =>
                    setLastName(
                      event.target.value
                    )
                  }
                  placeholder="Last name"
                  className="rounded-xl border px-4 py-3"
                />

                <input
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value
                    )
                  }
                  placeholder="Phone"
                  className="rounded-xl border px-4 py-3"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="Email"
                  className="rounded-xl border px-4 py-3"
                />
              </div>

              <h3 className="mt-8 font-semibold text-slate-900">
                Stay
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs text-slate-500">
                    Check-in
                  </label>

                  <input
                    type="date"
                    required
                    value={checkIn}
                    onChange={(event) =>
                      setCheckIn(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs text-slate-500">
                    Check-out
                  </label>

                  <input
                    type="date"
                    required
                    value={checkOut}
                    onChange={(event) =>
                      setCheckOut(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border px-4 py-3"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs text-slate-500">
                    Room
                  </label>

                  <select
                    required
                    value={roomId}
                    onChange={(event) =>
                      setRoomId(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border px-4 py-3"
                  >
                    {rooms.map(
                      (room) => (
                        <option
                          key={room.id}
                          value={room.id}
                        >
                          {room.room_number}
                          {" — "}
                          {room.roomTypeName}
                        </option>
                      )
                    )}
                  </select>

                  {selectedRoom && (
                    <p className="mt-2 text-xs text-slate-500">
                      Room Type: {selectedRoom.roomTypeName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs text-slate-500">
                    Rate Plan
                  </label>

                  <select
                    required
                    value={ratePlanId}
                    onChange={(event) =>
                      setRatePlanId(
                        event.target.value
                      )
                    }
                    disabled={
                      ratePlans.length ===
                      0
                    }
                    className="w-full rounded-xl border px-4 py-3 disabled:bg-slate-50"
                  >
                    {ratePlans.length ===
                    0 ? (
                      <option value="">
                        No active Rate Plan
                      </option>
                    ) : (
                      ratePlans.map(
                        (ratePlan) => (
                          <option
                            key={ratePlan.id}
                            value={ratePlan.id}
                          >
                            {ratePlan.name}
                            {ratePlan.code
                              ? ` (${ratePlan.code})`
                              : ""}
                          </option>
                        )
                      )
                    )}
                  </select>
                </div>

                <input
                  type="number"
                  min="1"
                  value={adults}
                  onChange={(event) =>
                    setAdults(
                      event.target.value
                    )
                  }
                  placeholder="Adults"
                  className="rounded-xl border px-4 py-3"
                />

                <input
                  type="number"
                  min="0"
                  value={children}
                  onChange={(event) =>
                    setChildren(
                      event.target.value
                    )
                  }
                  placeholder="Children"
                  className="rounded-xl border px-4 py-3"
                />
              </div>

              <h3 className="mt-8 font-semibold text-slate-900">
                Rate & Payment
              </h3>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {!checkIn ||
                !checkOut ? (
                  <p className="text-sm text-slate-500">
                    Chọn ngày lưu trú để tính giá.
                  </p>
                ) : quoteLoading ? (
                  <p className="text-sm text-slate-500">
                    Đang kiểm tra phòng và tính giá...
                  </p>
                ) : quoteError ? (
                  <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {quoteError}
                  </div>
                ) : quote ? (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {quote.ratePlan.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {quote.nights} night{quote.nights === 1 ? "" : "s"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          Suggested Total
                        </p>
                        <p className="text-lg font-bold text-slate-900">
                          {formatMoney(
                            quote.suggestedTotal
                          )} {quote.currency}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                      {quote.nightlyRates.map(
                        (night) => (
                          <div
                            key={night.stayDate}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-slate-500">
                              {night.stayDate}
                            </span>
                            <span className="font-medium text-slate-900">
                              {formatMoney(
                                night.price
                              )} VND
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Chọn phòng, Rate Plan và ngày lưu trú để tính giá.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs text-slate-500">
                  Final Total Amount
                </label>

                <input
                  type="number"
                  min="0"
                  step="10000"
                  required
                  value={totalAmount}
                  onChange={(event) =>
                    setTotalAmount(
                      event.target.value
                    )
                  }
                  placeholder="Total amount"
                  className="w-full rounded-xl border px-4 py-3"
                />

                {quote && (
                  <p className="mt-2 text-xs text-slate-500">
                    Suggested: {formatMoney(quote.suggestedTotal)} VND. Staff có thể chỉnh Final Total trước khi tạo booking.
                  </p>
                )}
              </div>

              <textarea
                value={notes}
                onChange={(event) =>
                  setNotes(
                    event.target.value
                  )
                }
                placeholder="Notes"
                rows={4}
                className="mt-4 w-full rounded-xl border px-4 py-3"
              />

              {errorMessage && (
                <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <button
                disabled={
                  loading ||
                  quoteLoading ||
                  !quote ||
                  ratePlans.length ===
                    0
                }
                className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Creating..."
                  : "Create Booking"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
