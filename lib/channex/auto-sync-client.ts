"use client";

type ProcessResult = {
  success?: boolean;

  processed?: number;

  availability?: number;

  restrictions?: number;

  status?: string;

  error?: string;
};

export type AutoSyncStatusDetail = {
  status:
    | "scheduled"
    | "syncing"
    | "success"
    | "error";

  processed?: number;

  availability?: number;

  restrictions?: number;

  message?: string;
};

let timer:
  ReturnType<typeof setTimeout> |
  null =
  null;

let running =
  false;

let rerunRequested =
  false;

let currentPropertyId:
  string |
  null =
  null;

/* ======================================================
   EVENT
====================================================== */

function dispatchStatus(
  detail:
    AutoSyncStatusDetail
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "channex-auto-sync-status",
      {
        detail,
      }
    )
  );
}

/* ======================================================
   PROCESS
====================================================== */

async function processQueue(
  propertyId: string
) {
  if (
    running
  ) {
    rerunRequested =
      true;

    return;
  }

  running =
    true;

  rerunRequested =
    false;

  dispatchStatus({
    status:
      "syncing",

    message:
      "Đang đồng bộ Channex...",
  });

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

    let result:
      ProcessResult =
      {};

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

    if (
      !response.ok
    ) {
      throw new Error(
        result.error ||
          `Auto Sync thất bại (${response.status}).`
      );
    }

    const processed =
      result.processed ??
      0;

    dispatchStatus({
      status:
        "success",

      processed,

      availability:
        result.availability ??
        0,

      restrictions:
        result.restrictions ??
        0,

      message:
        processed >
        0
          ? `Đã đồng bộ ${processed} thay đổi sang Channex.`
          : "Không còn ARI cần đồng bộ.",
    });

    window.dispatchEvent(
      new CustomEvent(
        "channex-queue-updated"
      )
    );

    if (
      processed >
      0
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "channex-sync-completed"
        )
      );
    }
  } catch (
    error
  ) {
    console.error(
      "Auto Channex Sync:",
      error
    );

    dispatchStatus({
      status:
        "error",

      message:
        error instanceof
        Error
          ? error.message
          : "Không thể tự động đồng bộ Channex.",
    });

    window.dispatchEvent(
      new CustomEvent(
        "channex-queue-updated"
      )
    );
  } finally {
    running =
      false;

    if (
      rerunRequested &&
      currentPropertyId
    ) {
      rerunRequested =
        false;

      timer =
        setTimeout(
          () => {
            timer =
              null;

            void processQueue(
              currentPropertyId!
            );
          },
          1000
        );
    }
  }
}

/* ======================================================
   SCHEDULE
====================================================== */

export function scheduleChannexAriSync(
  propertyId: string,
  delayMs =
    2500
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  currentPropertyId =
    propertyId;

  if (
    running
  ) {
    rerunRequested =
      true;

    return;
  }

  if (
    timer
  ) {
    clearTimeout(
      timer
    );
  }

  dispatchStatus({
    status:
      "scheduled",

    message:
      "Đang chờ đồng bộ Channex...",
  });

  timer =
    setTimeout(
      () => {
        timer =
          null;

        void processQueue(
          propertyId
        );
      },
      delayMs
    );
}

/* ======================================================
   SYNC NOW
====================================================== */

export async function syncChannexQueueNow(
  propertyId: string
) {
  if (
    timer
  ) {
    clearTimeout(
      timer
    );

    timer =
      null;
  }

  currentPropertyId =
    propertyId;

  await processQueue(
    propertyId
  );
}