"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import {
  useState,
} from "react";

/* ======================================================
   TYPES
====================================================== */

type Issue = {
  code: string;

  type:
    | "error"
    | "warning";

  message: string;
};

type PreviewResult = {
  ready: boolean;

  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };

  property: {
    pmsCurrency: string;

    channexPropertyId:
      string;

    channexTitle:
      string;

    channexCurrency:
      string;

    channexTimezone:
      string;
  };

  mapping: {
    roomTypes: number;
    ratePlans: number;
  };

  counts: {
    availability: number;
    restrictions: number;
  };

  issues: Issue[];

  availabilityPayload: {
    values: any[];
  };

  restrictionsPayload: {
    values: any[];
  };
};

type Props = {
  propertyId: string;
};

/* ======================================================
   DATE
====================================================== */

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
      (
        item
      ) =>
        item.type ===
        "year"
    )?.value ?? "";

  const month =
    parts.find(
      (
        item
      ) =>
        item.type ===
        "month"
    )?.value ?? "";

  const day =
    parts.find(
      (
        item
      ) =>
        item.type ===
        "day"
    )?.value ?? "";

  return `${year}-${month}-${day}`;
}

function addDays(
  date: string,
  days: number
) {
  const value =
    new Date(
      `${date}T00:00:00Z`
    );

  value.setUTCDate(
    value.getUTCDate() +
      days
  );

  return value
    .toISOString()
    .slice(
      0,
      10
    );
}

/* ======================================================
   COMPONENT
====================================================== */

export default function ChannexAriPreviewCard({
  propertyId,
}: Props) {
  const initialDate =
    todayVietnam();

  const [
    startDate,
    setStartDate,
  ] =
    useState(
      initialDate
    );

  const [
    endDate,
    setEndDate,
  ] =
    useState(
      addDays(
        initialDate,
        13
      )
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
    preview,
    setPreview,
  ] =
    useState<
      PreviewResult |
      null
    >(null);

  /* ======================================================
     PREVIEW
  ====================================================== */

  async function generatePreview() {
    setLoading(true);

    setErrorMessage("");

    setPreview(
      null
    );

    try {
      const params =
        new URLSearchParams({
          propertyId,
          startDate,
          endDate,
        });

      const response =
        await fetch(
          `/api/admin/channex/ari-preview?${params.toString()}`,
          {
            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        setErrorMessage(
          result.error ||
            "Không thể tạo ARI Preview."
        );

        return;
      }

      setPreview(
        result
      );
    } catch (error) {
      console.error(
        error
      );

      setErrorMessage(
        "Có lỗi khi tạo ARI Preview."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">

      {/* HEADER */}

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">

        <div>

          <h2 className="text-lg font-bold text-slate-900">
            ARI Preview
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Kiểm tra Availability, Rate và Restrictions trước khi gửi sang Channex.
          </p>

        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">

          <ShieldCheck
            size={14}
          />

          PREVIEW ONLY

        </div>

      </div>


      <div className="p-6">

        {/* DATE RANGE */}

        <div className="grid gap-4 md:grid-cols-2">

          <div>

            <label className="mb-2 block text-xs font-medium text-slate-500">
              From
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
                  event
                    .target
                    .value
                )
              }
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />

          </div>


          <div>

            <label className="mb-2 block text-xs font-medium text-slate-500">
              To
            </label>

            <input
              type="date"
              value={
                endDate
              }
              min={
                startDate
              }
              onChange={(
                event
              ) =>
                setEndDate(
                  event
                    .target
                    .value
                )
              }
              className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />

          </div>

        </div>


        <button
          type="button"
          disabled={
            loading ||
            !startDate ||
            !endDate
          }
          onClick={
            generatePreview
          }
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
        >

          {loading ? (

            <Loader2
              size={17}
              className="animate-spin"
            />

          ) : (

            <Eye
              size={17}
            />

          )}

          {loading
            ? "Generating..."
            : "Generate ARI Preview"}

        </button>


        {errorMessage && (

          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {
              errorMessage
            }
          </div>

        )}


        {preview && (

          <>
            {/* STATUS */}

            <div
              className={`mt-6 rounded-xl border p-4 ${
                preview.ready
                  ? "border-green-200 bg-green-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >

              <div className="flex items-center gap-2">

                {preview.ready ? (

                  <CheckCircle2
                    size={18}
                    className="text-green-700"
                  />

                ) : (

                  <AlertTriangle
                    size={18}
                    className="text-amber-700"
                  />

                )}

                <p
                  className={`font-semibold ${
                    preview.ready
                      ? "text-green-800"
                      : "text-amber-800"
                  }`}
                >

                  {preview.ready
                    ? "ARI payload is ready"
                    : "ARI payload is NOT ready"}

                </p>

              </div>

              <p className="mt-1 text-sm text-slate-600">

                {
                  preview
                    .dateRange
                    .days
                }
                {" "}
                days ·{" "}
                {
                  preview
                    .counts
                    .availability
                }
                {" "}
                availability updates ·{" "}
                {
                  preview
                    .counts
                    .restrictions
                }
                {" "}
                rate/restriction updates

              </p>

            </div>


            {/* PROPERTY */}

            <div className="mt-5 grid gap-3 md:grid-cols-3">

              <InfoCard
                label="Channex Property"
                value={
                  preview
                    .property
                    .channexTitle
                }
              />

              <InfoCard
                label="PMS Currency"
                value={
                  preview
                    .property
                    .pmsCurrency
                }
              />

              <InfoCard
                label="Channex Currency"
                value={
                  preview
                    .property
                    .channexCurrency
                }
              />

            </div>


            {/* ISSUES */}

            {preview
              .issues
              .length >
              0 && (

              <div className="mt-5 space-y-2">

                {preview.issues.map(
                  (
                    issue
                  ) => (

                    <div
                      key={
                        issue.code
                      }
                      className={`rounded-xl border p-4 text-sm ${
                        issue.type ===
                        "error"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >

                      <strong>
                        {
                          issue.code
                        }
                      </strong>

                      <span>
                        {" — "}
                        {
                          issue.message
                        }
                      </span>

                    </div>

                  )
                )}

              </div>

            )}


            {/* AVAILABILITY */}

            <div className="mt-7">

              <div className="mb-3">

                <h3 className="font-bold text-slate-900">
                  Availability Payload
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  POST /api/v1/availability
                </p>

              </div>

              <PayloadPreview
                data={{
                  values:
                    preview
                      .availabilityPayload
                      .values
                      .slice(
                        0,
                        10
                      ),
                }}
              />

              {preview
                .availabilityPayload
                .values
                .length >
                10 && (

                <p className="mt-2 text-xs text-slate-400">
                  Showing first 10 of{" "}
                  {
                    preview
                      .availabilityPayload
                      .values
                      .length
                  }
                  {" "}
                  values.
                </p>

              )}

            </div>


            {/* RESTRICTIONS */}

            <div className="mt-7">

              <div className="mb-3">

                <h3 className="font-bold text-slate-900">
                  Rate & Restrictions Payload
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  POST /api/v1/restrictions
                </p>

              </div>

              <PayloadPreview
                data={{
                  values:
                    preview
                      .restrictionsPayload
                      .values
                      .slice(
                        0,
                        10
                      ),
                }}
              />

              {preview
                .restrictionsPayload
                .values
                .length >
                10 && (

                <p className="mt-2 text-xs text-slate-400">
                  Showing first 10 of{" "}
                  {
                    preview
                      .restrictionsPayload
                      .values
                      .length
                  }
                  {" "}
                  values.
                </p>

              )}

            </div>


            {/* SYNC DISABLED */}

            <div className="mt-7 border-t border-slate-200 pt-6">

              <button
                type="button"
                disabled
                className="rounded-xl bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-500"
              >
                Sync to Channex — Disabled
              </button>

              <p className="mt-2 text-xs text-slate-400">
                Bước hiện tại chỉ Preview. Chưa có request ghi ARI nào được gửi sang Channex.
              </p>

            </div>

          </>

        )}

      </div>

    </div>
  );
}

/* ======================================================
   INFO CARD
====================================================== */

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">

      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-all text-sm font-semibold text-slate-800">
        {value || "—"}
      </p>

    </div>
  );
}

/* ======================================================
   PAYLOAD
====================================================== */

function PayloadPreview({
  data,
}: {
  data: unknown;
}) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">

      {JSON.stringify(
        data,
        null,
        2
      )}

    </pre>
  );
}