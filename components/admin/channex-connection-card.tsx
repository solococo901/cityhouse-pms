"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  PlugZap,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

/* ======================================================
   TYPES
====================================================== */

type ChannexProperty = {
  id: string;

  title: string;

  city: string;

  country: string;

  currency: string;

  timezone: string;
};

type ExistingConnection = {
  id: string;

  channexPropertyId:
    string | null;

  status: string;

  lastTestedAt:
    string | null;

  lastError:
    string | null;
};

type Props = {
  propertyId: string;

  propertyName: string;

  existingConnection:
    ExistingConnection | null;
};

/* ======================================================
   COMPONENT
====================================================== */

export default function ChannexConnectionCard({
  propertyId,
  propertyName,
  existingConnection,
}: Props) {
  const router =
    useRouter();

  /* ======================================================
     STATE
  ====================================================== */

  const [
    testing,
    setTesting,
  ] =
    useState(false);

  const [
    mappingId,
    setMappingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    connectionTested,
    setConnectionTested,
  ] =
    useState(false);

  const [
    properties,
    setProperties,
  ] =
    useState<
      ChannexProperty[]
    >([]);

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
    environment,
    setEnvironment,
  ] =
    useState(
      "staging"
    );

  /*
   * Local mapped ID để UI đổi ngay,
   * không cần chờ router.refresh().
   */
  const [
    mappedPropertyId,
    setMappedPropertyId,
  ] =
    useState<
      string | null
    >(
      existingConnection
        ?.channexPropertyId ??
        null
    );

  const [
    connectionStatus,
    setConnectionStatus,
  ] =
    useState(
      existingConnection
        ?.status ??
        "not_configured"
    );

  /* ======================================================
     TEST CONNECTION
  ====================================================== */

  async function testConnection() {
    setTesting(true);

    setErrorMessage("");

    setSuccessMessage("");

    setConnectionTested(
      false
    );

    setProperties([]);

    try {
      const response =
        await fetch(
          "/api/admin/channex/test-connection",
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
        setErrorMessage(
          result.error ||
            "Không thể kết nối Channex."
        );

        return;
      }

      setEnvironment(
        result.environment ||
          "staging"
      );

      setProperties(
        Array.isArray(
          result.properties
        )
          ? result.properties
          : []
      );

      setConnectionTested(
        true
      );
    } catch (error) {
      console.error(
        "Test Channex:",
        error
      );

      setErrorMessage(
        "Có lỗi xảy ra khi kết nối Channex."
      );
    } finally {
      setTesting(false);
    }
  }

  /* ======================================================
     MAP PROPERTY
  ====================================================== */

  async function mapProperty(
    channexPropertyId: string
  ) {
    setMappingId(
      channexPropertyId
    );

    setErrorMessage("");

    setSuccessMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/channex/map-property",
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

                channexPropertyId,
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
            "Không thể map Channex Property."
        );

        return;
      }

      /*
       * Update UI ngay.
       */

      setMappedPropertyId(
        channexPropertyId
      );

      setConnectionStatus(
        "connected"
      );

      setSuccessMessage(
        `${propertyName} đã được map với ${
          result
            .channexProperty
            ?.title ??
          "Channex Property"
        }.`
      );

      /*
       * Sau đó refresh Server Component
       * để page.tsx đọc connection mới.
       */

      router.refresh();
    } catch (error) {
      console.error(
        "Map Channex property:",
        error
      );

      setErrorMessage(
        "Có lỗi xảy ra khi lưu mapping."
      );
    } finally {
      setMappingId(
        null
      );
    }
  }

  /* ======================================================
     FORMAT DATE
  ====================================================== */

  function formatDate(
    value:
      | string
      | null
  ) {
    if (!value) {
      return "Never";
    }

    const date =
      new Date(
        value
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return new Intl.DateTimeFormat(
      "vi-VN",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      }
    ).format(
      date
    );
  }

  /* ======================================================
     CURRENT VALUES
  ====================================================== */

  const isMapped =
    Boolean(
      mappedPropertyId
    );

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">

        <div className="flex items-start gap-4">

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">

            <PlugZap
              size={22}
            />

          </div>

          <div>

            <h2 className="text-lg font-bold text-slate-900">
              Channex
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Channel Manager Integration
            </p>

          </div>

        </div>


        <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">

          {
            environment.toUpperCase()
          }

        </div>

      </div>


      {/* ==================================================
          BODY
      ================================================== */}

      <div className="p-6">

        {/* ==================================================
            PMS PROPERTY
        ================================================== */}

        <div className="rounded-xl bg-slate-50 p-4">

          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            PMS Property
          </p>

          <p className="mt-1 font-semibold text-slate-900">
            {
              propertyName
            }
          </p>

        </div>


        {/* ==================================================
            STATUS
        ================================================== */}

        <div className="mt-4 grid gap-3 md:grid-cols-2">

          {/* STATUS */}

          <div className="rounded-xl border border-slate-200 p-4">

            <p className="text-xs text-slate-400">
              Connection Status
            </p>

            <div className="mt-2">

              {connectionStatus ===
                "connected" &&
              isMapped ? (

                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">

                  <CheckCircle2
                    size={13}
                  />

                  Connected

                </span>

              ) : connectionStatus ===
                "error" ? (

                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">

                  <XCircle
                    size={13}
                  />

                  Error

                </span>

              ) : (

                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">

                  Not configured

                </span>

              )}

            </div>

          </div>


          {/* CHANNEX ID */}

          <div className="rounded-xl border border-slate-200 p-4">

            <p className="text-xs text-slate-400">
              Channex Property ID
            </p>

            <p className="mt-2 break-all text-sm font-medium text-slate-800">

              {
                mappedPropertyId ||
                "Not mapped"
              }

            </p>

          </div>

        </div>


        {/* ==================================================
            EXISTING CONNECTION
        ================================================== */}

        {existingConnection && (

          <div className="mt-3 rounded-xl border border-slate-200 p-4">

            <div className="flex flex-wrap items-start justify-between gap-4">

              <div>

                <p className="text-xs text-slate-400">
                  Last tested
                </p>

                <p className="mt-1 text-sm text-slate-700">

                  {
                    formatDate(
                      existingConnection
                        .lastTestedAt
                    )
                  }

                </p>

              </div>


              {existingConnection
                .lastError && (

                <div className="max-w-md">

                  <p className="text-xs text-slate-400">
                    Last Error
                  </p>

                  <p className="mt-1 text-sm text-red-600">
                    {
                      existingConnection
                        .lastError
                    }
                  </p>

                </div>

              )}

            </div>

          </div>

        )}


        {/* ==================================================
            TEST CONNECTION BUTTON
        ================================================== */}

        <button
          type="button"

          disabled={
            testing ||
            Boolean(
              mappingId
            )
          }

          onClick={
            testConnection
          }

          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >

          {testing ? (

            <Loader2
              size={17}
              className="animate-spin"
            />

          ) : connectionTested ? (

            <RefreshCw
              size={17}
            />

          ) : (

            <Server
              size={17}
            />

          )}

          {testing
            ? "Testing..."
            : connectionTested
              ? "Test Again"
              : "Test Channex Connection"}

        </button>


        {/* ==================================================
            CONNECTION SUCCESS
        ================================================== */}

        {connectionTested && (

          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">

            <div className="flex items-center gap-2 font-semibold text-green-700">

              <CheckCircle2
                size={17}
              />

              Connection successful

            </div>

            <p className="mt-1 text-sm text-green-700">

              Channex returned{" "}

              <strong>
                {
                  properties.length
                }
              </strong>

              {" "}properties.

            </p>

          </div>

        )}


        {/* ==================================================
            MAP SUCCESS
        ================================================== */}

        {successMessage && (

          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">

            <div className="flex items-center gap-2 font-semibold text-green-700">

              <CheckCircle2
                size={17}
              />

              Property mapped

            </div>

            <p className="mt-1 text-sm text-green-700">

              {
                successMessage
              }

            </p>

          </div>

        )}


        {/* ==================================================
            ERROR
        ================================================== */}

        {errorMessage && (

          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">

            <div className="flex items-center gap-2 font-semibold text-red-700">

              <XCircle
                size={17}
              />

              Operation failed

            </div>

            <p className="mt-2 text-sm leading-6 text-red-600">

              {
                errorMessage
              }

            </p>

          </div>

        )}


        {/* ==================================================
            CHANNEX PROPERTIES
        ================================================== */}

        {properties.length >
          0 && (

          <div className="mt-7">

            <div>

              <h3 className="font-semibold text-slate-900">
                Channex Properties
              </h3>

              <p className="mt-1 text-sm text-slate-500">

                Chọn property Channex tương ứng với{" "}

                <strong>
                  {
                    propertyName
                  }
                </strong>

                .

              </p>

            </div>


            <div className="mt-4 space-y-3">

              {properties.map(
                (
                  item
                ) => {
                  const selected =
                    mappedPropertyId ===
                    item.id;

                  const mapping =
                    mappingId ===
                    item.id;

                  return (

                    <div
                      key={
                        item.id
                      }

                      className={`rounded-2xl border p-5 transition ${
                        selected
                          ? "border-green-300 bg-green-50/40"
                          : "border-slate-200 bg-white hover:border-blue-300"
                      }`}
                    >

                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                        {/* =================================
                            PROPERTY INFO
                        ================================= */}

                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <h4 className="font-bold text-slate-900">

                              {
                                item.title
                              }

                            </h4>


                            {selected && (

                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold text-green-700">

                                <Check
                                  size={10}
                                />

                                MAPPED

                              </span>

                            )}

                          </div>


                          <p className="mt-1 break-all text-xs text-slate-400">

                            ID:{" "}

                            {
                              item.id
                            }

                          </p>


                          {(item.city ||
                            item.country) && (

                            <p className="mt-2 text-sm text-slate-500">

                              {
                                [
                                  item.city,
                                  item.country,
                                ]
                                  .filter(
                                    Boolean
                                  )
                                  .join(
                                    ", "
                                  )
                              }

                            </p>

                          )}


                          <div className="mt-3 flex flex-wrap gap-2">

                            {item.currency && (

                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">

                                {
                                  item.currency
                                }

                              </span>

                            )}


                            {item.timezone && (

                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">

                                {
                                  item.timezone
                                }

                              </span>

                            )}

                          </div>

                        </div>


                        {/* =================================
                            MAP ACTION
                        ================================= */}

                        <div className="shrink-0">

                          {selected ? (

                            <button
                              type="button"
                              disabled
                              className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-green-100 px-5 py-3 text-sm font-semibold text-green-700"
                            >

                              <CheckCircle2
                                size={17}
                              />

                              Mapped

                            </button>

                          ) : (

                            <button
                              type="button"

                              disabled={
                                Boolean(
                                  mappingId
                                )
                              }

                              onClick={() =>
                                mapProperty(
                                  item.id
                                )
                              }

                              className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >

                              {mapping ? (

                                <Loader2
                                  size={17}
                                  className="animate-spin"
                                />

                              ) : (

                                <ArrowRight
                                  size={17}
                                />

                              )}

                              {mapping
                                ? "Mapping..."
                                : "Map to CityHouse"}

                            </button>

                          )}

                        </div>

                      </div>

                    </div>

                  );
                }
              )}

            </div>

          </div>

        )}


        {/* ==================================================
            NO PROPERTIES
        ================================================== */}

        {connectionTested &&
          properties.length ===
            0 && (

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">

              <p className="font-semibold text-amber-800">
                No Channex properties
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-700">

                API Key hoạt động nhưng chưa có property nào được trả về.
                Kiểm tra Properties Access của API Key trên Channex Staging.

              </p>

            </div>

          )}

      </div>

    </div>
  );
}