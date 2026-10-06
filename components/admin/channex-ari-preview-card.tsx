"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  Send,
  ShieldCheck,
  X,
  XCircle,
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
    channexPropertyId: string;
    channexTitle: string;
    channexCurrency: string;
    channexTimezone: string;
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
    values: unknown[];
  };

  restrictionsPayload: {
    values: unknown[];
  };
};

type SyncWarning = {
  source?: string;

  [key: string]:
    unknown;
};

type SyncResult = {
  accepted: boolean;

  success: boolean;

  status:
    | "accepted"
    | "warning"
    | "error";

  counts?: {
    availability: number;
    restrictions: number;
  };

  warnings?: SyncWarning[];

  log?: {
    id: string;
    status: string;
    created_at: string;
  } | null;
};

type Props = {
  propertyId: string;
};

/* ======================================================
   DATE HELPERS
====================================================== */

function todayVietnam() {
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

function formatDate(
  value: string
) {
  try {
    return new Intl.DateTimeFormat(
      "vi-VN",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",
      }
    ).format(
      new Date(
        `${value}T00:00:00`
      )
    );
  } catch {
    return value;
  }
}

/* ======================================================
   COMPONENT
====================================================== */

export default function ChannexAriPreviewCard({
  propertyId,
}: Props) {
  const initialDate =
    todayVietnam();

  /* ======================================================
     DATE STATE
  ====================================================== */

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

  /* ======================================================
     PREVIEW STATE
  ====================================================== */

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
     CURRENCY STATE
  ====================================================== */

  const [
    fixingCurrency,
    setFixingCurrency,
  ] =
    useState(false);

  const [
    currencyMessage,
    setCurrencyMessage,
  ] =
    useState("");

  /* ======================================================
     SYNC STATE
  ====================================================== */

  const [
    showConfirm,
    setShowConfirm,
  ] =
    useState(false);

  const [
    syncing,
    setSyncing,
  ] =
    useState(false);

  const [
    syncResult,
    setSyncResult,
  ] =
    useState<
      SyncResult |
      null
    >(null);

  const [
    syncError,
    setSyncError,
  ] =
    useState("");

  /* ======================================================
     GENERATE PREVIEW
  ====================================================== */

  async function generatePreview() {
    setLoading(
      true
    );

    setErrorMessage(
      ""
    );

    /*
     * KHÔNG setSyncResult(null) ở đây.
     *
     * Sau khi Sync xong chúng ta vẫn muốn giữ
     * thông báo kết quả Sync trên màn hình.
     */

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

      const text =
        await response.text();

      let result:
        any = {};

      try {
        result =
          text
            ? JSON.parse(
                text
              )
            : {};
      } catch {
        result = {};
      }

      if (
        !response.ok
      ) {
        setErrorMessage(
          result.error ||
            `Không thể tạo ARI Preview (${response.status}).`
        );

        return;
      }

      setPreview(
        result
      );
    } catch (
      error
    ) {
      console.error(
        "Generate ARI Preview:",
        error
      );

      setErrorMessage(
        "Có lỗi khi tạo ARI Preview."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /* ======================================================
     FIX CURRENCY
  ====================================================== */

  async function fixCurrency() {
    setFixingCurrency(
      true
    );

    setErrorMessage(
      ""
    );

    setCurrencyMessage(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/admin/channex/normalize-currency",
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
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        let message =
          result.error ||
          "Không thể sửa currency.";

        if (
          result.details
        ) {
          message +=
            ` ${JSON.stringify(
              result.details
            )}`;
        }

        setErrorMessage(
          message
        );

        return;
      }

      setCurrencyMessage(
        `Đã cập nhật Channex sang ${result.targetCurrency ?? "VND"}.`
      );

      await generatePreview();
    } catch (
      error
    ) {
      console.error(
        "Fix Channex Currency:",
        error
      );

      setErrorMessage(
        "Có lỗi khi sửa Channex Currency."
      );
    } finally {
      setFixingCurrency(
        false
      );
    }
  }

  /* ======================================================
     SYNC ARI
  ====================================================== */

  async function syncToChannex() {
    if (
      !preview ||
      !preview.ready
    ) {
      setSyncError(
        "ARI Preview chưa sẵn sàng."
      );

      return;
    }

    setSyncing(
      true
    );

    setSyncError(
      ""
    );

    setSyncResult(
      null
    );

    try {
      const response =
        await fetch(
          "/api/admin/channex/sync-ari",
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
                endDate,
              }),
          }
        );

      const text =
        await response.text();

      let result:
        any = {};

      try {
        result =
          text
            ? JSON.parse(
                text
              )
            : {};
      } catch {
        result = {
          error:
            text ||
            "Server trả response không hợp lệ.",
        };
      }

      console.log(
        "SYNC ARI RESPONSE:",
        response.status,
        result
      );

      if (
        !response.ok
      ) {
        setSyncError(
          result.error ||
            `Sync ARI thất bại (${response.status}).`
        );

        setShowConfirm(
          false
        );

        return;
      }

      /* ==================================================
         SAVE RESULT
      ================================================== */

      setSyncResult({
        accepted:
          result.accepted ??
          true,

        success:
          result.success ??
          false,

        status:
          result.status ??
          "accepted",

        counts:
          result.counts,

        warnings:
          result.warnings ??
          [],

        log:
          result.log ??
          null,
      });

      /* ==================================================
         CLOSE MODAL
      ================================================== */

      setShowConfirm(
        false
      );

      /* ==================================================
         IMPORTANT

         Báo cho ChannexSyncHistoryCard rằng
         vừa có một lần Sync mới.

         History component sẽ tự fetch lại.
      ================================================== */

      window.dispatchEvent(
        new CustomEvent(
          "channex-sync-completed"
        )
      );

      /* ==================================================
         REFRESH PREVIEW

         Không làm mất syncResult.
      ================================================== */

      await generatePreview();
    } catch (
      error
    ) {
      console.error(
        "Sync ARI error:",
        error
      );

      setSyncError(
        error instanceof
        Error
          ? error.message
          : "Có lỗi khi Sync ARI sang Channex."
      );

      setShowConfirm(
        false
      );
    } finally {
      setSyncing(
        false
      );
    }
  }

  /* ======================================================
     DERIVED STATE
  ====================================================== */

  const currencyMismatch =
    Boolean(
      preview &&
        preview
          .property
          .pmsCurrency !==
          preview
            .property
            .channexCurrency
    );

  const hasBlockingIssue =
    Boolean(
      preview?.issues.some(
        (
          issue
        ) =>
          issue.type ===
          "error"
      )
    );

  const canSync =
    Boolean(
      preview &&
        preview.ready &&
        !currencyMismatch &&
        !hasBlockingIssue &&
        preview
          .counts
          .availability >
          0 &&
        preview
          .counts
          .restrictions >
          0
    );

  /* ======================================================
     UI
  ====================================================== */

  return (
    <>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">

        {/* ==================================================
            HEADER
        ================================================== */}

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

            STAGING

          </div>

        </div>

        {/* ==================================================
            BODY
        ================================================== */}

        <div className="p-6">

          {/* ==================================================
              DATE RANGE
          ================================================== */}

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
                ) => {
                  setStartDate(
                    event
                      .target
                      .value
                  );

                  setPreview(
                    null
                  );

                  setSyncResult(
                    null
                  );

                  setSyncError(
                    ""
                  );
                }}

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
                ) => {
                  setEndDate(
                    event
                      .target
                      .value
                  );

                  setPreview(
                    null
                  );

                  setSyncResult(
                    null
                  );

                  setSyncError(
                    ""
                  );
                }}

                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
              />

            </div>

          </div>

          {/* ==================================================
              PREVIEW BUTTON
          ================================================== */}

          <button
            type="button"

            disabled={
              loading ||
              syncing ||
              fixingCurrency ||
              !startDate ||
              !endDate
            }

            onClick={
              generatePreview
            }

            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
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

          {/* ==================================================
              ERROR
          ================================================== */}

          {errorMessage && (

            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">

              {
                errorMessage
              }

            </div>

          )}

          {/* ==================================================
              CURRENCY MESSAGE
          ================================================== */}

          {currencyMessage && (

            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">

              <div className="flex items-center gap-2 font-semibold text-green-700">

                <CheckCircle2
                  size={17}
                />

                Currency updated

              </div>

              <p className="mt-1 text-sm text-green-700">
                {
                  currencyMessage
                }
              </p>

            </div>

          )}

          {/* ==================================================
              SYNC ERROR
          ================================================== */}

          {syncError && (

            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">

              <div className="flex items-center gap-2 font-semibold text-red-700">

                <XCircle
                  size={17}
                />

                Sync failed

              </div>

              <p className="mt-1 text-sm text-red-700">
                {
                  syncError
                }
              </p>

            </div>

          )}

          {/* ==================================================
              SYNC RESULT
          ================================================== */}

          {syncResult && (

            <div
              className={`mt-5 rounded-xl border p-4 ${
                syncResult.status ===
                "accepted"
                  ? "border-green-200 bg-green-50"
                  : syncResult.status ===
                    "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-red-200 bg-red-50"
              }`}
            >

              <div className="flex items-center gap-2">

                {syncResult.status ===
                "accepted" ? (

                  <CheckCircle2
                    size={18}
                    className="text-green-700"
                  />

                ) : syncResult.status ===
                  "warning" ? (

                  <AlertTriangle
                    size={18}
                    className="text-amber-700"
                  />

                ) : (

                  <XCircle
                    size={18}
                    className="text-red-700"
                  />

                )}


                <p className="font-semibold text-slate-900">

                  {syncResult.status ===
                  "accepted"
                    ? "ARI Sync accepted"
                    : syncResult.status ===
                      "warning"
                      ? "ARI Sync accepted with warnings"
                      : "ARI Sync failed"}

                </p>

              </div>


              {syncResult.counts && (

                <p className="mt-2 text-sm text-slate-600">

                  {
                    syncResult
                      .counts
                      .availability
                  }

                  {" "}
                  availability updates ·{" "}

                  {
                    syncResult
                      .counts
                      .restrictions
                  }

                  {" "}
                  rate/restriction updates

                </p>

              )}


              {syncResult.log?.id && (

                <p className="mt-2 break-all text-xs text-slate-500">

                  Sync Log ID:{" "}

                  <strong>
                    {
                      syncResult
                        .log
                        .id
                    }
                  </strong>

                </p>

              )}


              {syncResult.warnings &&
                syncResult
                  .warnings
                  .length >
                  0 && (

                <div className="mt-4">

                  <p className="text-sm font-semibold text-amber-800">
                    Channex warnings
                  </p>

                  <pre className="mt-2 max-h-[240px] overflow-auto rounded-xl bg-white/70 p-3 text-xs leading-5 text-slate-700">
                    {JSON.stringify(
                      syncResult
                        .warnings,
                      null,
                      2
                    )}
                  </pre>

                </div>

              )}

            </div>

          )}

          {/* ==================================================
              PREVIEW
          ================================================== */}

          {preview && (

            <>

              {/* ==============================================
                  STATUS
              ============================================== */}

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

              {/* ==============================================
                  PROPERTY INFO
              ============================================== */}

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

              {/* ==============================================
                  CURRENCY FIX
              ============================================== */}

              {currencyMismatch && (

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">

                  <div className="flex items-start gap-3">

                    <AlertTriangle
                      size={18}
                      className="mt-0.5 shrink-0 text-amber-700"
                    />


                    <div>

                      <p className="font-semibold text-amber-800">
                        Currency chưa đồng bộ
                      </p>

                      <p className="mt-1 text-sm leading-6 text-amber-700">

                        PMS đang dùng{" "}

                        <strong>
                          {
                            preview
                              .property
                              .pmsCurrency
                          }
                        </strong>

                        , Channex đang dùng{" "}

                        <strong>
                          {
                            preview
                              .property
                              .channexCurrency
                          }
                        </strong>

                        .

                      </p>


                      <button
                        type="button"

                        disabled={
                          fixingCurrency ||
                          loading ||
                          syncing
                        }

                        onClick={
                          fixCurrency
                        }

                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >

                        {fixingCurrency && (

                          <Loader2
                            size={16}
                            className="animate-spin"
                          />

                        )}

                        {fixingCurrency
                          ? "Fixing Currency..."
                          : `Fix Channex Currency → ${preview.property.pmsCurrency}`}

                      </button>

                    </div>

                  </div>

                </div>

              )}

              {/* ==============================================
                  ISSUES
              ============================================== */}

              {preview
                .issues
                .length >
                0 && (

                <div className="mt-5 space-y-2">

                  {preview.issues.map(
                    (
                      issue,
                      index
                    ) => (

                      <div
                        key={
                          `${issue.code}-${index}`
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

              {/* ==============================================
                  MAPPING
              ============================================== */}

              <div className="mt-5 grid gap-3 md:grid-cols-2">

                <InfoCard
                  label="Mapped Room Types"

                  value={
                    String(
                      preview
                        .mapping
                        .roomTypes
                    )
                  }
                />

                <InfoCard
                  label="Mapped Rate Plans"

                  value={
                    String(
                      preview
                        .mapping
                        .ratePlans
                    )
                  }
                />

              </div>

              {/* ==============================================
                  AVAILABILITY
              ============================================== */}

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

              {/* ==============================================
                  RATE & RESTRICTIONS
              ============================================== */}

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

              {/* ==============================================
                  SYNC
              ============================================== */}

              <div className="mt-7 border-t border-slate-200 pt-6">

                {canSync ? (

                  <div>

                    <div className="flex items-center gap-2 text-sm font-semibold text-green-700">

                      <CheckCircle2
                        size={17}
                      />

                      ARI validation passed. Ready to sync.

                    </div>


                    <button
                      type="button"

                      disabled={
                        syncing
                      }

                      onClick={() =>
                        setShowConfirm(
                          true
                        )
                      }

                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >

                      <Send
                        size={17}
                      />

                      Sync ARI to Channex

                    </button>


                    <p className="mt-2 text-xs text-slate-400">
                      Availability và Rate/Restrictions sẽ được gửi thật tới Channex.
                    </p>

                  </div>

                ) : (

                  <div>

                    <button
                      type="button"
                      disabled
                      className="rounded-xl bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-500"
                    >
                      Sync to Channex — Disabled
                    </button>

                    <p className="mt-2 text-xs text-slate-400">
                      Xử lý tất cả lỗi Preview trước khi Sync.
                    </p>

                  </div>

                )}

              </div>

            </>

          )}

        </div>

      </div>

      {/* ==================================================
          CONFIRM MODAL
      ================================================== */}

      {showConfirm &&
        preview && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">

          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>

                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                  Channex Staging
                </p>

                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Confirm ARI Sync
                </h3>

              </div>


              <button
                type="button"

                disabled={
                  syncing
                }

                onClick={() =>
                  setShowConfirm(
                    false
                  )
                }

                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >

                <X
                  size={20}
                />

              </button>

            </div>

            {/* BODY */}

            <div className="p-6">

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

                <div className="flex gap-3">

                  <AlertTriangle
                    size={20}
                    className="mt-0.5 shrink-0 text-amber-700"
                  />


                  <div>

                    <p className="font-semibold text-amber-800">
                      Đây là thao tác ghi dữ liệu thật
                    </p>

                    <p className="mt-1 text-sm leading-6 text-amber-700">
                      Availability, giá và restrictions trong khoảng ngày này sẽ được gửi tới Channex.
                    </p>

                  </div>

                </div>

              </div>


              <div className="mt-5 space-y-3">

                <ConfirmRow
                  label="Property"

                  value={
                    preview
                      .property
                      .channexTitle
                  }
                />

                <ConfirmRow
                  label="Date range"

                  value={`${formatDate(
                    startDate
                  )} → ${formatDate(
                    endDate
                  )}`}
                />

                <ConfirmRow
                  label="Availability"

                  value={`${preview.counts.availability} updates`}
                />

                <ConfirmRow
                  label="Rate / Restrictions"

                  value={`${preview.counts.restrictions} updates`}
                />

                <ConfirmRow
                  label="Currency"

                  value={
                    preview
                      .property
                      .pmsCurrency
                  }
                />

              </div>

            </div>

            {/* FOOTER */}

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">

              <button
                type="button"

                disabled={
                  syncing
                }

                onClick={() =>
                  setShowConfirm(
                    false
                  )
                }

                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>


              <button
                type="button"

                disabled={
                  syncing
                }

                onClick={
                  syncToChannex
                }

                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >

                {syncing ? (

                  <Loader2
                    size={16}
                    className="animate-spin"
                  />

                ) : (

                  <Send
                    size={16}
                  />

                )}

                {syncing
                  ? "Syncing..."
                  : "Confirm Sync"}

              </button>

            </div>

          </div>

        </div>

      )}

    </>
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
        {
          label
        }
      </p>

      <p className="mt-1 break-all text-sm font-semibold text-slate-800">
        {
          value ||
          "—"
        }
      </p>

    </div>
  );
}

/* ======================================================
   CONFIRM ROW
====================================================== */

function ConfirmRow({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">

      <p className="text-sm text-slate-500">
        {
          label
        }
      </p>

      <p className="text-right text-sm font-semibold text-slate-900">
        {
          value
        }
      </p>

    </div>
  );
}

/* ======================================================
   PAYLOAD PREVIEW
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