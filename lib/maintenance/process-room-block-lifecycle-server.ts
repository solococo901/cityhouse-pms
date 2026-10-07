import {
  createAdminClient,
} from "@/lib/supabase/admin";


export type RoomBlockLifecycleWarning =
  Record<
    string,
    unknown
  >;


export type RoomBlockLifecycleResult = {
  success: boolean;

  business_date:
    string;

  activated:
    number;

  already_active:
    number;

  expired:
    number;

  marked_dirty:
    number;

  skipped:
    number;

  warnings:
    RoomBlockLifecycleWarning[];
};


/* ======================================================
   ROOM BLOCK LIFECYCLE WORKER
====================================================== */

export async function processRoomBlockLifecycle():
Promise<RoomBlockLifecycleResult> {

  const supabase =
    createAdminClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "process_room_block_lifecycle_system"
    );


  if (error) {

    throw new Error(
      error.message
    );

  }


  const result =
    data as
      | RoomBlockLifecycleResult
      | null;


  if (
    !result ||
    result.success !==
      true
  ) {

    throw new Error(
      "Room block lifecycle returned an invalid result."
    );

  }


  return {
    success:
      true,

    business_date:
      String(
        result.business_date
      ),

    activated:
      Number(
        result.activated ??
        0
      ),

    already_active:
      Number(
        result.already_active ??
        0
      ),

    expired:
      Number(
        result.expired ??
        0
      ),

    marked_dirty:
      Number(
        result.marked_dirty ??
        0
      ),

    skipped:
      Number(
        result.skipped ??
        0
      ),

    warnings:
      Array.isArray(
        result.warnings
      )
        ? result.warnings
        : [],
  };

}
