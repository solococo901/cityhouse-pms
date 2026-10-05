"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("Không tìm thấy tài khoản.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      setErrorMessage("Không tìm thấy hồ sơ người dùng.");
      setLoading(false);
      return;
    }

    if (!profile.active) {
      await supabase.auth.signOut();

      setErrorMessage("Tài khoản đã bị khóa.");
      setLoading(false);
      return;
    }

    if (
      profile.role === "super_admin" ||
      profile.role === "admin" ||
      profile.role === "manager"
    ) {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/staff/dashboard");
    }

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">

      <div className="w-full max-w-md">

        <div className="mb-10 text-center">
          <div className="text-sm font-semibold tracking-[0.3em] text-blue-400">
            CITYHOUSE
          </div>

          <h1 className="mt-3 text-3xl font-bold text-white">
            Property Management System
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Sign in to manage your properties
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl"
        >

          <div className="mb-5">
            <label className="mb-2 block text-sm text-slate-300">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="admin@cityhousemore.com"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm text-slate-300">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            />
          </div>

          {errorMessage && (
            <div className="mb-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

        </form>

      </div>

    </main>
  );
}