import {
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


export async function GET(
  request: Request
) {
  try {
    const secret =
      process.env
        .CRON_SECRET;

    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !secret ||
      authorization !==
        `Bearer ${secret}`
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status:
            401,
        }
      );
    }

    const supabase =
      createAdminClient();

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "properties"
        )
        .select(`
          id,
          code,
          name
        `)
        .limit(
          5
        );

    if (
      error
    ) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status:
            500,
        }
      );
    }

    return NextResponse.json({
      success:
        true,

      properties:
        data ??
        [],
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "Unknown error",
      },
      {
        status:
          500,
      }
    );
  }
}