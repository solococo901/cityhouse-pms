"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Search,
  X,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

/* ======================================================
   TYPES
====================================================== */

type Props = {
  month: string;
};

/* ======================================================
   HELPERS
====================================================== */

function addMonth(
  month: string,
  amount: number
) {
  const date = new Date(
    `${month}-01T00:00:00Z`
  );

  date.setUTCMonth(
    date.getUTCMonth() + amount
  );

  return date
    .toISOString()
    .slice(0, 7);
}

function monthTitle(
  month: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  )
    .format(
      new Date(
        `${month}-01T00:00:00Z`
      )
    )
    .toUpperCase();
}

function longMonthTitle(
  month: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  ).format(
    new Date(
      `${month}-01T00:00:00Z`
    )
  );
}

function getTodayVietnam() {
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

  return {
    month:
      `${year}-${month}`,

    date:
      `${year}-${month}-${day}`,

    day:
      Number(day),
  };
}

/* ======================================================
   COMPONENT
====================================================== */

export default function CalendarToolbar({
  month,
}: Props) {
  const router =
    useRouter();

  const [
    pickerOpen,
    setPickerOpen,
  ] =
    useState(false);

  const [
    pickerMonth,
    setPickerMonth,
  ] =
    useState(month);

  const today =
    getTodayVietnam();

  /* ======================================================
     MONTH DATA
  ====================================================== */

  const monthData =
    useMemo(() => {
      const [
        year,
        monthNumber,
      ] =
        pickerMonth
          .split("-")
          .map(Number);

      const firstDay =
        new Date(
          Date.UTC(
            year,
            monthNumber - 1,
            1
          )
        );

      const lastDay =
        new Date(
          Date.UTC(
            year,
            monthNumber,
            0
          )
        );

      let offset =
        firstDay.getUTCDay();

      /*
       * Calendar bắt đầu từ Monday.
       *
       * JS:
       * Sun = 0
       * Mon = 1
       *
       * UI:
       * Mon = 0
       */

      offset =
        offset === 0
          ? 6
          : offset - 1;

      return {
        year,

        monthNumber,

        days:
          lastDay.getUTCDate(),

        offset,
      };
    }, [
      pickerMonth,
    ]);

  /* ======================================================
     NAVIGATION
  ====================================================== */

  function navigateMonth(
    value: string
  ) {
    setPickerOpen(false);

    router.push(
      `/staff/calendar?month=${value}`
    );
  }

  function previousMonth() {
    navigateMonth(
      addMonth(
        month,
        -1
      )
    );
  }

  function nextMonth() {
    navigateMonth(
      addMonth(
        month,
        1
      )
    );
  }

  function goToday() {
    navigateMonth(
      today.month
    );
  }

  function selectDay(
    day: number
  ) {
    const date =
      `${pickerMonth}-${String(
        day
      ).padStart(
        2,
        "0"
      )}`;

    /*
     * Hiện Calendar render nguyên tháng.
     * Ta truyền thêm focus để bước sau
     * tự scroll đến ngày được chọn.
     */

    setPickerOpen(false);

    router.push(
      `/staff/calendar?month=${pickerMonth}&focus=${date}`
    );
  }

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <div className="relative">

      {/* ==================================================
          TOP TOOLBAR
      ================================================== */}

      <div className="flex min-h-[42px] items-center border border-slate-200 bg-slate-100">

        {/* ICON GROUP */}

        <div className="flex items-center gap-1.5 border-r border-slate-300 px-2">

          <button
            type="button"
            title="View"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300"
          >
            <List
              size={15}
            />
          </button>


          <button
            type="button"
            title="Calendar"
            onClick={() => {
              setPickerMonth(
                month
              );

              setPickerOpen(
                (
                  current
                ) =>
                  !current
              );
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              pickerOpen
                ? "bg-blue-600 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
          >
            <CalendarDays
              size={15}
            />
          </button>


          <button
            type="button"
            title="Search reservations"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300"
          >
            <Search
              size={15}
            />
          </button>


          <button
            type="button"
            title="New reservation"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600"
          >
            <Plus
              size={17}
            />
          </button>

        </div>


        {/* MONTH TITLE */}

        <button
          type="button"
          onClick={() => {
            setPickerMonth(
              month
            );

            setPickerOpen(
              (
                current
              ) =>
                !current
            );
          }}
          className="h-[42px] px-4 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
        >
          {monthTitle(
            month
          )}
        </button>

      </div>


      {/* ==================================================
          PREVIOUS / TODAY / NEXT
      ================================================== */}

      <div className="flex h-[42px] items-center gap-1.5 border-x border-b border-slate-200 bg-white px-2">

        <button
          type="button"
          title="Previous month"
          onClick={
            previousMonth
          }
          className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-400 bg-white text-blue-600 transition hover:bg-blue-50"
        >
          <ChevronLeft
            size={14}
          />
        </button>


        <button
          type="button"
          onClick={
            goToday
          }
          className="h-7 rounded-full border border-blue-400 bg-white px-4 text-[11px] font-bold text-blue-600 transition hover:bg-blue-50"
        >
          TODAY
        </button>


        <button
          type="button"
          title="Next month"
          onClick={
            nextMonth
          }
          className="flex h-7 w-7 items-center justify-center rounded-full border border-blue-400 bg-white text-blue-600 transition hover:bg-blue-50"
        >
          <ChevronRight
            size={14}
          />
        </button>

      </div>


      {/* ==================================================
          DATE PICKER POPUP
      ================================================== */}

      {pickerOpen && (

        <>
          {/* OVERLAY */}

          <button
            type="button"
            aria-label="Close calendar"
            onClick={() =>
              setPickerOpen(
                false
              )
            }
            className="fixed inset-0 z-[190] cursor-default bg-transparent"
          />


          {/* POPUP */}

          <div className="absolute left-4 top-[45px] z-[200] w-[310px] rounded-lg border border-slate-200 bg-white shadow-2xl">

            {/* PICKER HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-3">

              <button
                type="button"
                onClick={() =>
                  setPickerMonth(
                    addMonth(
                      pickerMonth,
                      -1
                    )
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
              >
                <ChevronLeft
                  size={16}
                />
              </button>


              <p className="text-sm font-semibold text-slate-800">
                {longMonthTitle(
                  pickerMonth
                )}
              </p>


              <div className="flex items-center">

                <button
                  type="button"
                  onClick={() =>
                    setPickerMonth(
                      addMonth(
                        pickerMonth,
                        1
                      )
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
                >
                  <ChevronRight
                    size={16}
                  />
                </button>


                <button
                  type="button"
                  onClick={() =>
                    setPickerOpen(
                      false
                    )
                  }
                  className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100"
                >
                  <X
                    size={15}
                  />
                </button>

              </div>

            </div>


            {/* WEEKDAY */}

            <div className="grid grid-cols-7 px-3 pt-2">

              {[
                "Mo",
                "Tu",
                "We",
                "Th",
                "Fr",
                "Sa",
                "Su",
              ].map(
                (
                  item
                ) => (

                  <div
                    key={
                      item
                    }
                    className="py-2 text-center text-xs font-medium text-slate-500"
                  >
                    {
                      item
                    }
                  </div>

                )
              )}

            </div>


            {/* DAYS */}

            <div className="grid grid-cols-7 gap-y-1 px-3 pb-4">

              {/* EMPTY CELLS */}

              {Array.from({
                length:
                  monthData.offset,
              }).map(
                (
                  _,
                  index
                ) => (

                  <div
                    key={`empty-${index}`}
                    className="h-9"
                  />

                )
              )}


              {/* MONTH DAYS */}

              {Array.from({
                length:
                  monthData.days,
              }).map(
                (
                  _,
                  index
                ) => {
                  const day =
                    index +
                    1;

                  const isToday =
                    pickerMonth ===
                      today.month &&
                    day ===
                      today.day;

                  return (

                    <button
                      key={
                        day
                      }
                      type="button"
                      onClick={() =>
                        selectDay(
                          day
                        )
                      }
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-md text-sm transition ${
                        isToday
                          ? "bg-blue-600 font-semibold text-white"
                          : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      {day}
                    </button>

                  );
                }
              )}

            </div>

          </div>

        </>

      )}

    </div>
  );
}