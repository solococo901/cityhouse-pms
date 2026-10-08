import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/* ======================================================
   NEXT.JS

   Root page dùng auth + Supabase theo request.
====================================================== */

export const instant =
  false;

/* ======================================================
   PAGE
====================================================== */

export default async function HomePage() {
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
      .select("role")
      .eq(
        "id",
        user.id
      )
      .single();

  if (!profile) {
    redirect("/login");
  }

  if (
    profile.role === "super_admin" ||
    profile.role === "admin" ||
    profile.role === "manager"
  ) {
    redirect(
      "/admin/dashboard"
    );
  }

  redirect(
    "/staff/dashboard"
  );
}