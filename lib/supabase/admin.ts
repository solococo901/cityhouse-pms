import "server-only";

import {
  createClient,
} from "@supabase/supabase-js";

/* ======================================================
   SUPABASE ADMIN CLIENT

   SERVER ONLY.

   Dùng cho:
   - Cron worker
   - Background jobs
   - Server-side ARI processing

   KHÔNG được import file này vào Client Component.
====================================================== */

export function createAdminClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env
      .SUPABASE_SECRET_KEY;

  if (
    !supabaseUrl
  ) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL."
    );
  }

  if (
    !secretKey
  ) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY."
    );
  }

  return createClient(
    supabaseUrl,
    secretKey,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,

        detectSessionInUrl:
          false,
      },
    }
  );
}