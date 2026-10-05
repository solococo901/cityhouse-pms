"use client";


import {
  useState,
} from "react";

import {
  CalendarPlus,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

type Props = {
  propertyId: string;
};

function todayVietnam() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Ho_Chi_Minh",

        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (item) =>
        item.type === "year"
    )?.value ?? "";

  const month =
    parts.find(
      (item) =>
        item.type === "month"
    )?.value ?? "";

  const day =
    parts.find(
      (item) =>
        item.type === "day"
    )?.value ?? "";

  return `${year}-${month}-${day}`;
}

export default function GenerateCalendarData({
  propertyId,
}: Props) {
  const router =
    useRouter();

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      todayVietnam()
    );

  const [
    days,
    setDays,
  ] =
    useState(
      90
    );

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
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  async function generate() {
    setLoading(true);

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/calendar/generate",
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
                startDate,
                days,
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
            "Generate thất bại."
        );

        return;
      }

      const data =
        result.result;

      setSuccessMessage(
        `Đã tạo ${data.inventory_inserted ?? 0} inventory rows và ${data.rates_inserted ?? 0} rate rows.`
      );

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi xảy ra khi generate."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">

      <div className="flex items-start gap-3">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <CalendarPlus
            size={19}
          />
        </div>

        <div>

          <h2 className="font-semibold text-slate-900">
            Generate Calendar Data
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Tạo Inventory và Rate cho các ngày tương lai còn thiếu.
          </p>

        </div>

      </div>


      <div className="mt-5 grid gap-4 md:grid-cols-2">

        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            Start date
          </label>

          <input
            type="date"
            value={
              startDate
            }
            onChange={(
              event
            ) =>
              setStartDate(
                event.target.value
              )
            }
            className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
          />

        </div>


        <div>

          <label className="mb-2 block text-xs font-medium text-slate-500">
            Generate
          </label>

          <div className="grid grid-cols-3 gap-2">

            {[
              30,
              90,
              365,
            ].map(
              (
                value
              ) => (

                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setDays(
                      value
                    )
                  }
                  className={`h-11 rounded-xl border text-sm font-semibold transition ${
                    days ===
                    value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {value}
                  {" "}
                  days
                </button>

              )
            )}

          </div>

        </div>

      </div>


      {errorMessage && (

        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {
            errorMessage
          }
        </div>

      )}


      {successMessage && (

        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {
            successMessage
          }
        </div>

      )}


      <button
        type="button"
        disabled={
          loading ||
          !startDate
        }
        onClick={
          generate
        }
        className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {loading
          ? "Generating..."
          : `Generate ${days} Days`}
      </button>

    </div>
  );
}