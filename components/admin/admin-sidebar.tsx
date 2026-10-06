"use client";

import Link from "next/link";

import {
  BadgeDollarSign,
  BedDouble,
  Building2,
  Cable,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  LogOut,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

/* ======================================================
   TYPES
====================================================== */

type MenuItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

/* ======================================================
   MENU
====================================================== */

const menuGroups: MenuGroup[] = [
  {
    title: "Overview",

    items: [
      {
        name: "Dashboard",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },

  {
    title: "Property Management",

    items: [
      {
        name: "Properties",
        href: "/admin/properties",
        icon: Building2,
      },

      {
        name: "Rooms",
        href: "/admin/rooms",
        icon: BedDouble,
      },
    ],
  },

  {
    title: "Revenue",

    items: [
      {
        name: "Rates",
        href: "/admin/rates",
        icon: BadgeDollarSign,
      },

      {
        name: "Inventory",
        href: "/admin/inventory",
        icon: CalendarDays,
      },
    ],
  },

  {
    title: "Distribution",

    items: [
      {
        name: "Channels",
        href: "/admin/channels",
        icon: Cable,
      },
    ],
  },
];

/* ======================================================
   COMPONENT
====================================================== */

export default function AdminSidebar() {
  const pathname =
    usePathname();

  const router =
    useRouter();

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);

  /* ======================================================
     ACTIVE MENU
  ====================================================== */

  function isActive(
    href: string
  ) {
    return (
      pathname === href ||
      pathname.startsWith(
        `${href}/`
      )
    );
  }

  /* ======================================================
     LOGOUT
  ====================================================== */

  async function logout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      const supabase =
        createClient();

      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "Logout error:",
          error
        );

        return;
      }

      router.replace(
        "/login"
      );

      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white">

      {/* ==================================================
          BRAND
      ================================================== */}

      <div className="flex h-[76px] shrink-0 items-center border-b border-slate-200 px-5">

        <Link
          href="/admin/dashboard"
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Building2
              size={20}
              strokeWidth={2}
            />
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">
              CITYHOUSE
            </p>

            <h1 className="mt-0.5 text-base font-bold leading-none text-slate-900">
              PMS
            </h1>
          </div>
        </Link>

      </div>

      {/* ==================================================
          PROPERTY
      ================================================== */}

      <div className="px-4 pt-4">

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Building2
                size={17}
                strokeWidth={2}
              />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Current Property
              </p>

              <p className="mt-1 truncate text-xs font-semibold text-slate-800">
                CityHouse TERA Kim Nguyên
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* ==================================================
          MENU
      ================================================== */}

      <nav className="flex-1 overflow-y-auto px-3 py-5">

        <div className="space-y-6">

          {menuGroups.map(
            (
              group
            ) => (
              <div
                key={
                  group.title
                }
              >

                {/* GROUP TITLE */}

                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  {
                    group.title
                  }
                </p>

                {/* GROUP ITEMS */}

                <div className="space-y-1">

                  {group.items.map(
                    (
                      item
                    ) => {
                      const Icon =
                        item.icon;

                      const active =
                        isActive(
                          item.href
                        );

                      return (
                        <Link
                          key={
                            item.href
                          }

                          href={
                            item.href
                          }

                          className={`
                            group
                            flex
                            h-11
                            items-center
                            gap-3
                            rounded-xl
                            px-3
                            text-sm
                            font-medium
                            transition-all

                            ${
                              active
                                ? "bg-blue-50 text-blue-700"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }
                          `}
                        >

                          {/* ICON */}

                          <div
                            className={`
                              flex
                              h-8
                              w-8
                              shrink-0
                              items-center
                              justify-center
                              rounded-lg
                              transition

                              ${
                                active
                                  ? "bg-blue-100 text-blue-600"
                                  : "text-slate-400 group-hover:bg-white group-hover:text-slate-600"
                              }
                            `}
                          >
                            <Icon
                              size={17}
                              strokeWidth={2}
                            />
                          </div>

                          {/* LABEL */}

                          <span className="flex-1 truncate">
                            {
                              item.name
                            }
                          </span>

                          {/* ACTIVE ARROW */}

                          {active && (
                            <ChevronRight
                              size={14}
                              strokeWidth={2}
                              className="text-blue-500"
                            />
                          )}

                        </Link>
                      );
                    }
                  )}

                </div>

              </div>
            )
          )}

        </div>

      </nav>

      {/* ==================================================
          USER / SIGN OUT
      ================================================== */}

      <div className="shrink-0 border-t border-slate-200 p-4">

        {/* USER */}

        <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            AD
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-800">
              Administrator
            </p>

            <p className="truncate text-[10px] text-slate-400">
              CityHouse PMS
            </p>
          </div>

        </div>

        {/* LOGOUT */}

        <button
          type="button"

          disabled={
            loggingOut
          }

          onClick={
            logout
          }

          className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex h-8 w-8 items-center justify-center">

            {loggingOut ? (
              <Loader2
                size={18}
                strokeWidth={2}
                className="animate-spin"
              />
            ) : (
              <LogOut
                size={18}
                strokeWidth={2}
              />
            )}

          </div>

          <span>
            {
              loggingOut
                ? "Signing out..."
                : "Sign out"
            }
          </span>

        </button>

      </div>

    </aside>
  );
}