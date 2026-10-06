"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
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

type SyncStatus =
  | "accepted"
  | "warning"
  | "error";

type SyncLog = {
  id: string;

  provider: string;

  sync_type: string;

  date_from: string;

  date_to: string;

  status:
    SyncStatus;

  availability_count:
    number;

  restrictions_count:
    number;

  warnings:
    unknown[] |
    null;

  error_message:
    string |
    null;

  created_at:
    string;
};

type HistoryResult = {
  success: boolean;

  lastSync:
    SyncLog |
    null;

  logs:
    SyncLog[];
};

type Props = {
  propertyId: string;
};

/* ======================================================
   HELPERS
====================================================== */

function formatDate(
  value: string
) {
  if (
    !value
  ) {
    return "—";
  }

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

function formatDateTime(
  value: string
) {
  try {
    return new Intl.DateTimeFormat(
      "vi-VN",
      {
        timeZone:
          "Asia/Ho_Chi_Minh",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",
      }
    ).format(
      new Date(
        value
      )
    );
  } catch {
    return value;
  }
}

/* ======================================================
   COMPONENT
====================================================== */

export default function ChannexSyncHistoryCard({
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
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    result,
    setResult,
  ] =
    useState<
      HistoryResult |
      null
    >(null);

  /* ======================================================
     LOAD
  ====================================================== */

  const loadHistory =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setErrorMessage(
          ""
        );

        try {
          const params =
            new URLSearchParams({
              propertyId,
              limit:
                "20",
            });

          const response =
            await fetch(
              `/api/admin/channex/sync-history?${params.toString()}`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok
          ) {
            setErrorMessage(
              data.error ||
                "Không thể tải lịch sử Sync."
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
            "Load Sync History:",
            error
          );

          setErrorMessage(
            "Có lỗi khi tải lịch sử Sync."
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
      void loadHistory();
    },
    [
      loadHistory,
    ]
  );

  /* ======================================================
     AUTO REFRESH AFTER SYNC
  ====================================================== */

  useEffect(
    () => {
      const handler =
        () => {
          void loadHistory();
        };

      window.addEventListener(
        "channex-sync-completed",
        handler
      );

      return () => {
        window.removeEventListener(
          "channex-sync-completed",
          handler
        );
      };
    },
    [
      loadHistory,
    ]
  );

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">

        <div>

          <h2 className="text-lg font-bold text-slate-900">
            Channex Sync History
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Lịch sử Availability, Rate và Restrictions đã gửi sang Channex.
          </p>

        </div>


        <button
          type="button"

          disabled={
            loading
          }

          onClick={
            loadHistory
          }

          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >

          {loading ? (

            <Loader2
              size={16}
              className="animate-spin"
            />

          ) : (

            <RefreshCw
              size={16}
            />

          )}

          Refresh

        </button>

      </div>

      {/* BODY */}

      <div className="p-6">

        {errorMessage && (

          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {
              errorMessage
            }
          </div>

        )}


        {loading &&
          !result && (

          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">

            <Loader2
              size={17}
              className="animate-spin"
            />

            Loading Sync History...

          </div>

        )}


        {result &&
          result.lastSync && (

          <div className="mb-6 grid gap-3 md:grid-cols-4">

            <InfoCard
              label="Last Sync"

              value={
                formatDateTime(
                  result
                    .lastSync
                    .created_at
                )
              }
            />

            <InfoCard
              label="Status"

              value={
                result
                  .lastSync
                  .status
                  .toUpperCase()
              }
            />

            <InfoCard
              label="Availability"

              value={
                String(
                  result
                    .lastSync
                    .availability_count
                )
              }
            />

            <InfoCard
              label="Rates / Restrictions"

              value={
                String(
                  result
                    .lastSync
                    .restrictions_count
                )
              }
            />

          </div>

        )}


        {result &&
          result.logs.length ===
            0 && (

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Chưa có lịch sử Sync ARI.
          </div>

        )}


        {result &&
          result.logs.length >
            0 && (

          <div className="space-y-3">

            {result.logs.map(
              (
                log
              ) => (

                <SyncLogRow
                  key={
                    log.id
                  }

                  log={
                    log
                  }
                />

              )
            )}

          </div>

        )}

      </div>

    </div>
  );
}

/* ======================================================
   SYNC LOG ROW
====================================================== */

function SyncLogRow({
  log,
}: {
  log: SyncLog;
}) {
  const warnings =
    Array.isArray(
      log.warnings
    )
      ? log.warnings
      : [];

  return (
    <div className="rounded-xl border border-slate-200 p-4">

      <div className="flex flex-wrap items-start justify-between gap-4">

        <div className="flex items-start gap-3">

          <StatusIcon
            status={
              log.status
            }
          />


          <div>

            <div className="flex flex-wrap items-center gap-2">

              <p className="font-semibold text-slate-900">

                {formatDate(
                  log.date_from
                )}

                {" → "}

                {formatDate(
                  log.date_to
                )}

              </p>

              <StatusBadge
                status={
                  log.status
                }
              />

            </div>


            <p className="mt-1 text-xs text-slate-400">

              <Clock3
                size={12}
                className="mr-1 inline"
              />

              {
                formatDateTime(
                  log.created_at
                )
              }

            </p>

          </div>

        </div>


        <div className="text-right text-sm">

          <p className="font-semibold text-slate-800">

            {
              log
                .availability_count
            }

            {" "}
            Availability

          </p>

          <p className="mt-1 text-slate-500">

            {
              log
                .restrictions_count
            }

            {" "}
            Rates / Restrictions

          </p>

        </div>

      </div>


      {log.error_message && (

        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">

          <strong>
            Error:
          </strong>

          {" "}

          {
            log
              .error_message
          }

        </div>

      )}


      {warnings.length >
        0 && (

        <details className="mt-4">

          <summary className="cursor-pointer text-sm font-semibold text-amber-700">

            {
              warnings.length
            }

            {" "}
            warning(s)

          </summary>

          <pre className="mt-3 max-h-[260px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-200">

            {JSON.stringify(
              warnings,
              null,
              2
            )}

          </pre>

        </details>

      )}


      <p className="mt-3 break-all text-xs text-slate-400">

        Log ID:{" "}

        {
          log.id
        }

      </p>

    </div>
  );
}

/* ======================================================
   STATUS ICON
====================================================== */

function StatusIcon({
  status,
}: {
  status: SyncStatus;
}) {
  if (
    status ===
    "accepted"
  ) {
    return (
      <div className="rounded-full bg-green-50 p-2 text-green-600">

        <CheckCircle2
          size={18}
        />

      </div>
    );
  }

  if (
    status ===
    "warning"
  ) {
    return (
      <div className="rounded-full bg-amber-50 p-2 text-amber-600">

        <AlertTriangle
          size={18}
        />

      </div>
    );
  }

  return (
    <div className="rounded-full bg-red-50 p-2 text-red-600">

      <XCircle
        size={18}
      />

    </div>
  );
}

/* ======================================================
   STATUS BADGE
====================================================== */

function StatusBadge({
  status,
}: {
  status: SyncStatus;
}) {
  const classes =
    status ===
    "accepted"
      ? "bg-green-50 text-green-700"
      : status ===
        "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${classes}`}
    >
      {
        status
      }
    </span>
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

      <p className="mt-1 break-all text-sm font-semibold text-slate-900">
        {
          value ||
          "—"
        }
      </p>

    </div>
  );
}