"use client";

import Link from "next/link";

import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Sparkles,
} from "lucide-react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";


const menu = [
  {
    name: "Dashboard",
    href: "/staff/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Calendar",
    href: "/staff/calendar",
    icon: CalendarDays,
  },
  {
    name: "Housekeeping",
    href: "/staff/housekeeping",
    icon: Sparkles,
  },
];


export default function StaffSidebar() {

  const pathname =
    usePathname();

  const router =
    useRouter();


  async function logout() {

    const supabase =
      createClient();

    await supabase.auth.signOut();

    router.replace("/login");

    router.refresh();

  }


  return (

    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-slate-200 bg-white">

      <div className="border-b border-slate-200 px-6 py-6">

        <p className="text-xs font-bold tracking-[0.25em] text-blue-600">
          CITYHOUSE
        </p>

        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Staff PMS
        </h1>

      </div>


      <nav className="flex-1 space-y-1 p-4">

        {menu.map(
          (item) => {

            const Icon =
              item.icon;

            const active =
              pathname ===
                item.href ||
              pathname.startsWith(
                `${item.href}/`
              );

            return (

              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >

                <Icon size={19} />

                {item.name}

              </Link>

            );

          }
        )}

      </nav>


      <div className="border-t p-4">

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600"
        >

          <LogOut size={19} />

          Sign out

        </button>

      </div>

    </aside>

  );
}
