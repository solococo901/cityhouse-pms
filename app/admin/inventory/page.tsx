import InventoryCalendar from "@/components/admin/inventory-calendar";
import { createClient } from "@/lib/supabase/server";

function getVietnamToday() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const year =
    parts.find((p) => p.type === "year")?.value;

  const month =
    parts.find((p) => p.type === "month")?.value;

  const day =
    parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function addDays(
  date: string,
  amount: number
) {
  const value =
    new Date(`${date}T00:00:00Z`);

  value.setUTCDate(
    value.getUTCDate() + amount
  );

  return value
    .toISOString()
    .slice(0, 10);
}

export default async function InventoryPage() {
  const supabase =
    await createClient();

  const { data: property } =
    await supabase
      .from("properties")
      .select(`
        id,
        code,
        name
      `)
      .eq("active", true)
      .order("name")
      .limit(1)
      .maybeSingle();

  if (!property) {
    return (
      <div>
        <h1 className="text-2xl font-bold">
          Inventory
        </h1>

        <p className="mt-3 text-slate-500">
          Chưa có property.
        </p>
      </div>
    );
  }

  const startDate =
    getVietnamToday();

  const dates =
    Array.from(
      {
        length: 14,
      },
      (_, index) =>
        addDays(
          startDate,
          index
        )
    );

  const endDate =
    dates[dates.length - 1];

  const [
    roomTypesResult,
    roomsResult,
    ratePlansResult,
    inventoryResult,
    ratesResult,
  ] = await Promise.all([

    supabase
      .from("room_types")
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "property_id",
        property.id
      )
      .eq("active", true)
      .order("name"),

    supabase
      .from("rooms")
      .select(`
        id,
        room_type_id
      `)
      .eq(
        "property_id",
        property.id
      )
      .eq("active", true),

    supabase
      .from("rate_plans")
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "property_id",
        property.id
      )
      .eq("active", true)
      .order("name"),

    supabase
      .from("inventory_calendar")
      .select("*")
      .eq(
        "property_id",
        property.id
      )
      .gte(
        "stay_date",
        startDate
      )
      .lte(
        "stay_date",
        endDate
      ),

    supabase
      .from("rate_calendar")
      .select("*")
      .eq(
        "property_id",
        property.id
      )
      .gte(
        "stay_date",
        startDate
      )
      .lte(
        "stay_date",
        endDate
      ),

  ]);

  const roomTypes =
    (roomTypesResult.data ?? [])
      .map((roomType) => {

        const totalRooms =
          (
            roomsResult.data ?? []
          ).filter(
            (room) =>
              room.room_type_id ===
              roomType.id
          ).length;

        return {
          ...roomType,
          totalRooms,
        };
      });

  return (
    <div className="mx-auto max-w-full">

      <div className="mb-8">

        <p className="text-sm font-semibold text-blue-600">
          {property.code}
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Rates & Inventory
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {property.name}
        </p>

      </div>

      <div className="mb-5 flex items-center gap-3">

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
          {dates[0]}
          {" → "}
          {dates[
            dates.length - 1
          ]}
        </div>

        <div className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          14 days
        </div>

      </div>

      <InventoryCalendar
        propertyId={
          property.id
        }
        dates={dates}
        roomTypes={roomTypes}
        ratePlans={
          ratePlansResult.data ??
          []
        }
        initialInventory={
          inventoryResult.data ??
          []
        }
        initialRates={
          ratesResult.data ??
          []
        }
      />

    </div>
  );
}