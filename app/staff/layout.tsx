import {
  ReactNode,
} from "react";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import StaffSidebar
from "@/components/staff/staff-sidebar";


export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {

  const supabase =
    await createClient();


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();


  if (!user) {
    redirect("/login");
  }


  const {
    data: profile,
  } =
    await supabase
      .from("profiles")
      .select(`
        full_name,
        role,
        active
      `)
      .eq(
        "id",
        user.id
      )
      .single();


  if (
    !profile ||
    !profile.active
  ) {
    redirect("/login");
  }


  return (

    <div className="min-h-screen bg-slate-50">

      <StaffSidebar />


      <div className="ml-64">

        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">

          <div>

            <p className="text-sm font-medium text-slate-900">
              {profile.full_name ||
                "Staff"}
            </p>

            <p className="text-xs uppercase text-slate-400">
              {profile.role.replace(
                "_",
                " "
              )}
            </p>

          </div>


          <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
            Front Desk
          </div>

        </header>


        <main className="p-8">

          {children}

        </main>

      </div>

    </div>

  );

}