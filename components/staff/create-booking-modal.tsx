"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  Plus,
  X,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";


type Room = {

  id: string;

  room_number: string;

  roomTypeName: string;

};


export default function CreateBookingModal({
  propertyId,
  rooms,
}: {
  propertyId: string;
  rooms: Room[];
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


  async function submit(
    event:
      FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();

    setLoading(true);

    setErrorMessage("");


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

      setLoading(false);

      return;

    }


    setOpen(false);

    router.refresh();

    setLoading(false);

  }


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

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">

            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-5">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  New Booking
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Direct reservation
                </p>

              </div>


              <button
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

              <h3 className="font-semibold">
                Guest
              </h3>


              <div className="mt-4 grid gap-4 md:grid-cols-2">

                <input
                  required
                  value={firstName}
                  onChange={(e) =>
                    setFirstName(
                      e.target.value
                    )
                  }
                  placeholder="First name"
                  className="rounded-xl border px-4 py-3"
                />

                <input
                  value={lastName}
                  onChange={(e) =>
                    setLastName(
                      e.target.value
                    )
                  }
                  placeholder="Last name"
                  className="rounded-xl border px-4 py-3"
                />

                <input
                  value={phone}
                  onChange={(e) =>
                    setPhone(
                      e.target.value
                    )
                  }
                  placeholder="Phone"
                  className="rounded-xl border px-4 py-3"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  placeholder="Email"
                  className="rounded-xl border px-4 py-3"
                />

              </div>


              <h3 className="mt-8 font-semibold">
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
                    onChange={(e) =>
                      setCheckIn(
                        e.target.value
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
                    onChange={(e) =>
                      setCheckOut(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border px-4 py-3"
                  />

                </div>


                <div className="md:col-span-2">

                  <label className="mb-2 block text-xs text-slate-500">
                    Room
                  </label>

                  <select
                    required
                    value={roomId}
                    onChange={(e) =>
                      setRoomId(
                        e.target.value
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

                </div>


                <input
                  type="number"
                  min="1"
                  value={adults}
                  onChange={(e) =>
                    setAdults(
                      e.target.value
                    )
                  }
                  placeholder="Adults"
                  className="rounded-xl border px-4 py-3"
                />


                <input
                  type="number"
                  min="0"
                  value={children}
                  onChange={(e) =>
                    setChildren(
                      e.target.value
                    )
                  }
                  placeholder="Children"
                  className="rounded-xl border px-4 py-3"
                />

              </div>


              <h3 className="mt-8 font-semibold">
                Payment
              </h3>


              <div className="mt-4">

                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={totalAmount}
                  onChange={(e) =>
                    setTotalAmount(
                      e.target.value
                    )
                  }
                  placeholder="Total amount"
                  className="w-full rounded-xl border px-4 py-3"
                />

              </div>


              <textarea
                value={notes}
                onChange={(e) =>
                  setNotes(
                    e.target.value
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
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-50"
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