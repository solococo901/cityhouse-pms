"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

/* ======================================================
   TYPES
====================================================== */

type QueueStatus =
  | "pending"
  | "processing"
  | "synced"
  | "error";

type QueueRow = {
  id: string;

  room_type_id:
    string;

  rate_plan_id:
    | string
    | null;

  stay_date:
    string;

  entity_type:
    | "inventory"
    | "rate";

  status:
    QueueStatus;

  attempts:
    number;

  last_error:
    | string
    | null;

  last_enqueued_at:
    string;

  synced_at:
    | string
    | null;
};

type QueueResult = {
  success:
    boolean;

  summary: {
    pending: number;
    processing: number;
    error: number;
    synced: number;
  };

  recent:
    QueueRow[];
};

type AutoSyncDetail = {
  status:
    | "scheduled"
    | "syncing"
    | "success"
    | "error";

  processed?:
    number;

  availability?:
    number;

  restrictions?:
    number;

  message?:
    string;
};

type Props = {
  propertyId:
    string;
};

/* ======================================================
   COMPONENT
====================================================== */

export default function ChannexAriQueueCard({
  propertyId,
}: Props) {
  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    processing,
    setProcessing,
  ] =
    useState(
      false
    );

  const [
    result,
    setResult,
  ] =
    useState<
      QueueResult |
      null
    >(
      null
    );

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

  const [
    autoStatus,
    setAutoStatus,
  ] =
    useState<
      AutoSyncDetail |
      null
    >(
      null
    );

  /* ======================================================
     LOAD QUEUE
  ====================================================== */

  const loadQueue =
    useCallback(
      async () => {
        setLoading(
          true
        );

        try {
          const params =
            new URLSearchParams({
              propertyId,
            });

          const response =
            await fetch(
              `/api/admin/channex/process-ari-queue?${params.toString()}`,
              {
                cache:
                  "no-store",
              }
            );

          const text =
            await response.text();

          let data:
            any = {};

          try {
            data =
              text
                ? JSON.parse(
                    text
                  )
                : {};
          } catch {
            data = {};
          }

          if (
            !response.ok
          ) {
            setErrorMessage(
              data.error ||
                "Không thể tải ARI Queue."
            );

            return;
          }

          setResult(
            data
          );
        } catch (
          error
        ) {
          console.error(
            "Load ARI Queue:",
            error
          );

          setErrorMessage(
            "Không thể tải ARI Queue."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        propertyId,
      ]
    );

  /* ======================================================
     INITIAL LOAD
  ====================================================== */

  useEffect(
    () => {
      void loadQueue();
    },
    [
      loadQueue,
    ]
  );

  /* ======================================================
     AUTO REFRESH QUEUE EVENT
  ====================================================== */

  useEffect(
    () => {
      const handler =
        () => {
          void loadQueue();
        };

      window.addEventListener(
        "channex-queue-updated",
        handler
      );

      return () => {
        window.removeEventListener(
          "channex-queue-updated",
          handler
        );
      };
    },
    [
      loadQueue,
    ]
  );

  /* ======================================================
     AUTO SYNC STATUS EVENT
  ====================================================== */

  useEffect(
    () => {
      const handler =
        (
          event:
            Event
        ) => {
          const customEvent =
            event as
              CustomEvent<
                AutoSyncDetail
              >;

          setAutoStatus(
            customEvent
              .detail
          );

          if (
            customEvent
              .detail
              .status ===
            "error"
          ) {
            setErrorMessage(
              customEvent
                .detail
                .message ||
                "Auto Sync thất bại."
            );
          }

          if (
            customEvent
              .detail
              .status ===
            "success"
          ) {
            setSuccessMessage(
              customEvent
                .detail
                .message ||
                "Auto Sync thành công."
            );
          }
        };

      window.addEventListener(
        "channex-auto-sync-status",
        handler
      );

      return () => {
        window.removeEventListener(
          "channex-auto-sync-status",
          handler
        );
      };
    },
    []
  );

  /* ======================================================
     MANUAL PROCESS
  ====================================================== */

  async function processQueue() {
    setProcessing(
      true
    );

    setErrorMessage(
      ""
    );

    setSuccessMessage(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/admin/channex/process-ari-queue",
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

                limit:
                  100,
              }),
          }
        );

      const text =
        await response.text();

      let data:
        any = {};

      try {
        data =
          text
            ? JSON.parse(
                text
              )
            : {};
      } catch {
        data = {};
      }

      if (
        !response.ok
      ) {
        setErrorMessage(
          data.error ||
            "Process Queue thất bại."
        );

        await loadQueue();

        return;
      }

      if (
        data.processed ===
        0
      ) {
        setSuccessMessage(
          "Queue hiện không có dữ liệu đang chờ."
        );
      } else {
        setSuccessMessage(
          `Đã xử lý ${data.processed} queue jobs · ${data.availability ?? 0} availability · ${data.restrictions ?? 0} rate/restriction updates.`
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          "channex-sync-completed"
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "channex-queue-updated"
        )
      );

      await loadQueue();
    } catch (
      error
    ) {
      console.error(
        "Process Queue:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Có lỗi khi xử lý ARI Queue."
      );
    } finally {
      setProcessing(
        false
      );
    }
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">

        <div>

          <div className="flex items-center gap-3">

            <h2 className="text-lg font-bold text-slate-900">
              ARI Queue
            </h2>

            {autoStatus && (

              <AutoSyncBadge
                status={
                  autoStatus.status
                }
              />

            )}

          </div>

          <p className="mt-1 text-sm text-slate-500">
            Những thay đổi giá và inventory đang chờ gửi sang Channex.
          </p>

          {autoStatus
            ?.message && (

            <p className="mt-1 text-xs text-slate-400">
              {
                autoStatus.message
              }
            </p>

          )}

        </div>


        <div className="flex items-center gap-2">

          <button
            type="button"

            disabled={
              loading ||
              processing
            }

            onClick={
              loadQueue
            }

            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >

            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh

          </button>


          <button
            type="button"

            disabled={
              processing ||
              !result ||
              (
                result
                  .summary
                  .pending ===
                  0 &&
                result
                  .summary
                  .error ===
                  0
              )
            }

            onClick={
              processQueue
            }

            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >

            {processing ? (

              <Loader2
                size={16}
                className="animate-spin"
              />

            ) : (

              <Play
                size={16}
              />

            )}

            {processing
              ? "Processing..."
              : "Process Queue"}

          </button>

        </div>

      </div>

      {/* BODY */}

      <div className="p-6">

        {errorMessage && (

          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

            <XCircle
              size={17}
              className="mt-0.5 shrink-0"
            />

            {
              errorMessage
            }

          </div>

        )}


        {successMessage && (

          <div className="mb-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">

            <CheckCircle2
              size={17}
              className="mt-0.5 shrink-0"
            />

            {
              successMessage
            }

          </div>

        )}


        {!result &&
          loading && (

          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">

            <Loader2
              size={17}
              className="animate-spin"
            />

            Loading ARI Queue...

          </div>

        )}


        {result && (

          <>

            {/* SUMMARY */}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              <SummaryCard
                label="Pending"

                value={
                  result
                    .summary
                    .pending
                }

                status="pending"
              />

              <SummaryCard
                label="Processing"

                value={
                  result
                    .summary
                    .processing
                }

                status="processing"
              />

              <SummaryCard
                label="Error"

                value={
                  result
                    .summary
                    .error
                }

                status="error"
              />

              <SummaryCard
                label="Synced"

                value={
                  result
                    .summary
                    .synced
                }

                status="synced"
              />

            </div>

            {/* RECENT */}

            <div className="mt-6">

              <h3 className="font-semibold text-slate-900">
                Recent Queue Jobs
              </h3>


              {result
                .recent
                .length ===
                0 ? (

                <div className="mt-3 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
                  Chưa có ARI Queue.
                </div>

              ) : (

                <div className="mt-3 space-y-2">

                  {result.recent.map(
                    (
                      item
                    ) => (

                    <QueueRowCard
                      key={
                        item.id
                      }

                      item={
                        item
                      }
                    />

                    )
                  )}

                </div>

              )}

            </div>

          </>

        )}

      </div>

    </div>
  );
}

/* ======================================================
   AUTO BADGE
====================================================== */

function AutoSyncBadge({
  status,
}: {
  status:
    AutoSyncDetail["status"];
}) {
  if (
    status ===
    "syncing"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">

        <Loader2
          size={11}
          className="animate-spin"
        />

        AUTO SYNCING

      </span>
    );
  }

  if (
    status ===
    "scheduled"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">

        <Clock3
          size={11}
        />

        AUTO QUEUED

      </span>
    );
  }

  if (
    status ===
    "error"
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">

        <AlertTriangle
          size={11}
        />

        AUTO ERROR

      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">

      <CheckCircle2
        size={11}
      />

      AUTO SYNCED

    </span>
  );
}

/* ======================================================
   SUMMARY
====================================================== */

function SummaryCard({
  label,
  value,
  status,
}: {
  label:
    string;

  value:
    number;

  status:
    QueueStatus;
}) {
  const className =
    status ===
    "pending"
      ? "text-amber-700"
      : status ===
        "processing"
        ? "text-blue-700"
        : status ===
          "error"
          ? "text-red-700"
          : "text-green-700";

  return (
    <div className="rounded-xl border border-slate-200 p-4">

      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {
          label
        }
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${className}`}
      >
        {
          value
        }
      </p>

    </div>
  );
}

/* ======================================================
   ROW
====================================================== */

function QueueRowCard({
  item,
}: {
  item:
    QueueRow;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">

      <div className="flex flex-wrap items-start justify-between gap-3">

        <div className="flex items-start gap-3">

          <StatusIcon
            status={
              item.status
            }
          />


          <div>

            <p className="font-semibold text-slate-900">
              {
                item.entity_type ===
                "inventory"
                  ? "Inventory"
                  : "Rate"
              }
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {
                item.stay_date
              }
            </p>

          </div>

        </div>


        <div className="text-right">

          <StatusBadge
            status={
              item.status
            }
          />

          <p className="mt-2 text-xs text-slate-400">

            Attempts:{" "}

            {
              item.attempts
            }

          </p>

        </div>

      </div>


      {item.last_error && (

        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">
          {
            item.last_error
          }
        </div>

      )}


      <div className="mt-3 break-all text-[11px] text-slate-400">

        Room:{" "}
        {
          item.room_type_id
        }

        {item.rate_plan_id && (

          <>
            {" · Rate: "}
            {
              item.rate_plan_id
            }
          </>

        )}

      </div>

    </div>
  );
}

/* ======================================================
   STATUS ICON
====================================================== */

function StatusIcon({
  status,
}: {
  status:
    QueueStatus;
}) {
  if (
    status ===
    "synced"
  ) {
    return (
      <CheckCircle2
        size={20}
        className="text-green-600"
      />
    );
  }

  if (
    status ===
    "processing"
  ) {
    return (
      <Loader2
        size={20}
        className="animate-spin text-blue-600"
      />
    );
  }

  if (
    status ===
    "error"
  ) {
    return (
      <XCircle
        size={20}
        className="text-red-600"
      />
    );
  }

  return (
    <Clock3
      size={20}
      className="text-amber-600"
    />
  );
}

/* ======================================================
   STATUS BADGE
====================================================== */

function StatusBadge({
  status,
}: {
  status:
    QueueStatus;
}) {
  const className =
    status ===
    "synced"
      ? "bg-green-50 text-green-700"
      : status ===
        "processing"
        ? "bg-blue-50 text-blue-700"
        : status ===
          "error"
          ? "bg-red-50 text-red-700"
          : "bg-amber-50 text-amber-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${className}`}
    >
      {
        status
      }
    </span>
  );
}